---
title: Linux内核学习：early_param机制
date:: 2025-09-22 15:07:33
tags:
categories:
- Linux内核基础
---

内核启动时，bootloader 会通过命令行传递各种参数。`early_param` 是内核提供的一种机制，用于在启动的**早期阶段**解析和处理这些参数。

这些参数通常是 bootloader（如 UEFI、GRUB）通过命令行传递给内核的，例如：

```bash
# grub/grub.conf 或内核命令行
console=ttyS0,115200 root=/dev/sda1 init=/bin/init debug loglevel=8
```

与普通的内核模块参数不同，`early_param` 处理器会在内核初始化的**非常早期**被调用，此时很多子系统（slab、工作队列等）还未初始化完成，因此对代码有严格限制。

## 应用场景

`early_param` 主要用于那些必须在内核启动早期就确定的配置项：

| 场景 | 说明 |
|------|------|
| **控制台配置** | 在 printk 初始化前就确定输出设备（串口、tty） |
| **内存布局调整** | 保留内存区域、设置内存大小限制 |
| **调试选项** | 开启早期调试输出、设置日志级别 |
| **设备树定位** | 指定设备树的物理地址 |
| **虚拟化支持** | earlyprintk、earlycon 等早期调试手段 |
| **架构特定配置** | ARM64 的页表配置、CPU 模式等 |

## 为什么需要？

如果用普通内核模块参数或 sysfs，处理时机太晚：

1. **控制台**：printk 初始化后才发现要改串口波特率，之前的关键启动信息就丢失了
2. **内存保留**：内存管理器初始化后，无法再从总内存中"挖"出一块保留区域
3. **设备树**：设备树解析必须在内存管理初始化之前完成

## 使用方法

### 基本用法

使用 `early_param` 宏注册参数处理函数：

```c
#include <linux/init.h>
#include <linux/printk.h>

static int __init my_early_param_handler(char *param)
{
    /* param 是参数的值部分（如果有），NULL 表示没有值 */
    if (param)
        pr_info("my_param received value: %s\n", param);
    else
        pr_info("my_param received (no value)\n");

    return 0; /* 返回 0 表示成功，非 0 表示失败 */
}

/* 注册参数处理器：my_param 是参数名 */
early_param("my_param", my_early_param_handler);
```

命令行使用示例：

```bash
# 传递值
my_param=hello

# 仅传递参数名（无值）
my_param

# 在其他参数中混合
console=ttyS0 my_param=debug root=/dev/sda1
```

### 参数宏对比

| 宏 | 用途 | 处理时机 | 可用函数 |
|---|---|---|---|
| `early_param` | 通用早期参数 | parse_args() 阶段 | 有限（无 slab、kmalloc 等） |
| `early_param_on_off` | on/off 类型参数 | parse_args() 阶段 | 有限 |
| `setup_param` | 延迟到稍晚阶段 | start_kernel() 中 | 稍多一点 |
| `module_param` | 内核模块参数 | 模块加载时 | 全部可用 |

### 处理 on/off 类型参数

```c
static bool my_feature_enable = false;

static int __init my_feature_enable_handler(char *str)
{
    return strtobool(str, &my_feature_enable);
}

early_param_on_off("my_feature", my_feature_enable_handler, my_feature_enable_handler);

/* 使用 */
if (my_feature_enable)
    do_something();
```

## 限制和注意点

### 不能使用 kmalloc/kfree

早期阶段内存分配器未初始化，只能使用：
- 静态变量
- 栈上内存
- 特殊的 `memblock` 分配器（如果已初始化）

```c
/* 错误：早期不可用 */
early_param("bad", func_that_calls_kmalloc);

/* 正确：使用静态缓冲区 */
static char early_buffer[256];
static int __init early_handler(char *p)
{
    if (p)
        strlcpy(early_buffer, p, sizeof(early_buffer));
    return 0;
}
```

### 不能使用 printk 的完整功能

早期的 `printk` 可能还未初始化串口，建议使用 `pr_info`、`pr_debug` 等宏，它们会缓冲输出直到控制台可用。

### 避免依赖其他子系统

不要依赖网络、文件系统、工作队列等功能，它们都还没初始化。

## 工作原理

### 在内核启动流程中的位置

```
bootloader
    ↓ (传递命令行参数)
start_kernel()
    ↓
setup_arch()          <--- 架构初始化
    ↓
setup_command_line()  <--- 保存命令行到 saved_command_line
    ↓
parse_early_options() <--- 解析 early_param ✓
    ↓
parse_args("early options", cmdline, NULL);
    ↓
trap_init()           <--- 陷阱/中断初始化
    ↓
mm_init()             <--- 内存管理初始化
    ↓
...
```

`parse_args()` 会遍历命令行，对每个参数查找注册的 `early_param` 处理器并调用。

### 底层实现

```c
/* include/linux/init.h */

struct obs_kernel_param {
    const char *str;       /* 参数名 */
    int (*setup_func)(char *); /* 处理函数 */
    int early;             /* 1 表示 early_param，0 表示普通参数 */
};

/* 通过链接段自动收集所有 early_param */
#define __early_param __used __section("__param")
```

所有 `early_param` 宏定义的处理器会被放入特殊的 ELF 段 `.init.data` 的 `__param` 段中，启动时由内核遍历此段。

## 与普通参数的对比

```c
/* early_param：在 parse_args() 阶段处理 */
early_param("debug", early_debug_handler);

/* 普通内核参数：在 start_kernel() 更晚的阶段处理 */
static int debug_param;
module_param(debug_param, int, 0644);

/* 延迟参数：当子系统准备好时才处理 */
late_initcall(my_late_init);
```

## 实际案例：earlycon

```c
/* 驱动/serial/earlycon.c */

static int __init param_setup_earlycon(char *buf)
{
    /* 解析 earlycon=uart,mmio,0x9000000,115200n8 */
    return setup_earlycon(buf);
}
early_param("earlycon", param_setup_earlycon);
```

命令行：
```bash
earlycon=uart,mmio,0x9000000,115200n8
```

这样可以在内核完全初始化串口驱动之前，就通过简单的 MMIO 直接向 UART 寄存器写入数据，实现早期调试输出。

## 参考资料

- [Linux Kernel Documentation: kernel-parameters.txt](https://www.kernel.org/doc/html/latest/admin/admin-guide/kernel-parameters.html)
- [include/linux/init.h](https://elixir.bootlin.com/linux/latest/source/include/linux/init.h)
- [init/main.c - start_kernel()](https://elixir.bootlin.com/linux/latest/source/init/main.c)
