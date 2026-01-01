---
title: linux内核驱动debug方法
date: 2025-12-24 19:48:13
tags:
categories: 
- Linux内核基础
---

当我们需要查看**内核中函数是否调用、入参值是否符合预期、函数返回值、函数调用栈**等问题时，我们可以在启动机器后，通过`trace`方法来动态获取这些信息。

`ftrace`是最常用的工具，其中`kprobe`和`tracepoint`是其中的两个子工具。

# 通用操作

## 过滤

如果要过滤的话，可以查看该函数的`format`才能知道怎么过滤：

```shell
cat events/目录/函数名/format
# eg：
cat events/irq/irq_handler_entry/format
```

然后就可以根据`format`中的字段来过滤：

```shell
echo 'irq==123' > events/irq/irq_handler_entry/filter
```

## 查看有哪些可用的 trace events

查看的是包括 tracepoint 和 kprobe 在内的所有 trace 事件，说白了，`kprobe` 事件也是 trace event 的一种。所以我们`| grep kprobe`就能看到所有的 kprobe 事件，跟我们平时`| grep kvm`看到的某个子模块 (kvm) 事件是一样的。

```shell
cat available_events | grep kprobe
cat available_events | grep kvm
```

## set_event 设置跟踪的事件

```shell
echo 'kvm:kvm_exit' > set_event
echo 'kvm:kvm_entry' > set_event
cat set_event
```

# kprobe

内核中几乎所有函数都可以被`kprobe`拦截，包括内核初始化时的函数。`kprobe`可以用来跟踪函数的调用、入参值和返回值，且不需要**手动写trace代码**。

`cd /sys/kernel/debug/tracing`

## 查看

查看所有kprobe可用的函数（几乎所有内核函数都在`available_filter_functions`中）：

```shell
cat available_filter_functions | grep __setup_irq
```

当前已经添加跟踪的事件：

```shell
cat kprobe_events
```

## 禁用所有已存在的 kprobe 事件

```shell
# 禁用所有已存在的 kprobe 事件（关键步骤）
# 这会关闭所有 events/kprobes/ 下的 enable 开关
echo 0 > events/kprobes/enable 2>/dev/null
```

进行一些清除操作

```shell
echo nop > current_tracer
echo 0 > tracing_on
echo > trace
```

## 添加 kprobe 事件到 kprobe_events

原生`tracing`目录下是没有`events/kprobes/`目录的，但是为了方便管理 kprobe 事件，我们可以把 kprobe 事件都添加到`events/kprobes/`目录下进行管理。（echo 命令里带不带 kprobes 都会被定向到kprobes文件夹中）

添加的事项可以有 `p` 标志的和 `r`标志的，其中 `r`标志的表示跟踪的是这个函数的**返回值**

```shell
echo 'p:kprobes/p___setup_irq __setup_irq irq=%x0 desc=%x1 new=%x2' > kprobe_events
echo `r:kprobes/r___setup_irq __setup_irq ret=$retval` > kprobe_events
cat kprobe_events # 此时就能看到刚刚添加的 kprobe 事件
ls events/kprobes/  | grep __setup_irq  # 此时能看到 __setup_irq 事件了
```

其中可以根据参数类型来选择不同的格式化输出：

```shell
echo 'p:vfio_pci_set_msi_trigger vfio_pci_set_msi_trigger type=%x1:u32 count=%x3:u32 flags=%x4:u32' > kprobe_events
echo 'p:nic_open hns3_nic_net_up name=+0(%x0):string state=+64(%x0):x64' > kprobe_events
```

参数类型：

- `:x8-64`：表示 8-64 位十六进制数
- `:s8-64`：表示 8-64 位有符号十进制数
- `:u8-64`：表示 8-64 位无符号十
- `:string`：表示字符串

寄存器参数：寄存器一般是通用寄存器，在 ARM64 架构中，参数传递通常使用 **x0 ~ x7** 寄存器，按照传入参数顺序依次为
- 第一个参数：`%x0`
- 第二个参数：`%x1`
- ...

所以我们一般要求函数参数控制在 5 个以内，如果函数参数超过了寄存器的数量，额外的参数通常会通过 栈 或 其他寄存器 传递。

<!-- 如果不确定偏移值到底是多少，可以先不带参数类型添加进去`echo 'p:kprobes/nic_open hns3_nic_net_up' > kprobe_events`，添加成功后，再查看`/sys/kernel/debug/tracing/events/kprobes/nic_open/format`，根据偏移量再重新添加进去。偏移量一般是相对于传入的参数是一个结构体指针的偏移。

而这里的`+0(%x0):string`表示从第 0 个偏移量开始读取字符串，`+64(%x0):x64`表示从第 64 个偏移量开始读取一个 64 位十六进制数。可以通过`cat /sys/kernel/debug/tracing/events/kprobes/nic_open/format`来查看具体的偏移量。 -->

查找对应偏移量的方法：

```shell
# way 1
cat /proc/kallsyms | grep hns3_nic_net_up  # /proc/kallsyms 中包含了内核中所有符号的地址，查看函数地址

# way 2
objdump -d /path/to/vmlinux | grep hns3_nic_net_up -A 20  # 反汇编查看函数实现

# way 3：gdb 可以调试内核并查看寄存器的使用（结构体偏移量推荐用gdb查看，可以参考下面的文章）
gdb /path/to/vmlinux
(gdb) disassemble hns3_nic_net_up

# way 4：
# pahole 是查看内核结构体布局的最佳工具，它直接解析 DWARF 调试信息。
# 假设我们要看：vfio_pci_core_device的入参结构体布局：
# dnf install -y dwarves
pahole -C vfio_pci_core_device
```

偏移量的获取参考[Kernel调试追踪技术之 Kprobe on ARM64](https://cloud.tencent.com/developer/article/2404303)

## 过滤、禁止输出调用栈

```shell
echo 'name=="eth2"' > events/kprobes/filter  # 过滤入参 name==eth2 的事件
# echo name!="eth2" > events/kprobes/nic_open/filter  # 过滤入参 name!=eth2 的事件
echo 'pid!=1234' > events/kprobes/filter  # 过滤特定 pid 的事件
echo nostacktrace > trace_options  # 关闭调用栈的打印，只看 __setup_irq 的入参显示
echo nostacktrace > events/kprobes/p___setup_irq/trigger # 关闭特定 kprobe 事件的调用栈打印
```

## 启动追踪

```shell
echo 1 > events/kprobes/enable # 启用所有 kprobe 事件
# echo 1 > events/kprobes/nic_open/enable  # 单独启用某个 kprobe 事件
echo 1 > tracing_on
```

## 查看输出

```shell
cat trace # 可以看到所有的 trace，包括耗时
cat trace_pipe # 实时采集管道，退出后就看不到了
cat trace_pipe | tee /tmp/trace.log # 使用tee同时输出到屏幕和文件
```

## 停止追踪

```shell
echo '-:p___setup_irq' > kprobe_events  # 删除某个 kprobe 事件
echo 0 > events/kprobes/enable
# echo 0 > events/kprobes/p___setup_irq/enable  # 单独禁用某个 kprobe 事件
echo 0 > tracing_on
```

## 清空缓存

```shell
echo > trace
```

## 示例：使用 kprobe 跟踪`__setup_irq`

用 kprobe 查看`__setup_irq`：

```shell
cd /sys/kernel/debug/tracing

# 禁用所有已存在的 kprobe 事件（关键步骤）
# 这会关闭所有 events/kprobes/ 下的 enable 开关
echo 0 > events/kprobes/enable 2>/dev/null

# 1. 查看当前已经添加跟踪的事件
cat kprobe_events

# 2. 使用简单ftrace查看
echo 'p:kprobes/__setup_irq __setup_irq irq=%x0 desc=%x1 new=%x2' > kprobe_events
# 刚开始 ./events/kprobes/路径 查不到有 __setup_irq
# 事件 echo 进 kprobe_events 后，在./events/kprobes/路径下就有这个 __setup_irq
echo nostacktrace > trace_options  # 关闭调用栈的打印，只看 __setup_irq 的入参显示
echo 1 > events/kprobes/enable
echo 1 > tracing_on

# 3. 查看输出
# cat trace # 可以看到所有的 trace，包括耗时
cat trace_pipe # 实时采集管道，退出后就看不到了
cat trace_pipe | tee /tmp/trace.log # 使用tee同时输出到屏幕和文件

# 4. 停止追踪
echo 0 > tracing_on

# 5. 清空缓存
echo > trace
```

# tracepoint 内核插桩

其优点是可以按照我们预期地输出信息，且可以替代`printk`。缺点是需要内核源码中明确定义 tracepoint 事件，且无法像 kprobe 通过`echo 'name=="eth2"' > events/kprobes/filter`来过滤特定 pid 的 tracepoint 事件，需要在桩函数代码中自己实现过滤。

trace point 是内核中预定义的跟踪点，通常用于跟踪内核事件。与 kprobe 不同，tracepoint 需要内核源码中明确定义。并显式调用 tracepoint 事件。

有时我们需要`printk`来输出信息，但`printk`的输出量很大，且无法控制输出格式。而 tracepoint 可以通过 ftrace 来控制输出，且输出格式可以自定义。

`tracepoint`都有一个 name、一个 enable 开关和一系列桩函数。


## tracepoint 结构体

在`./include/linux/tracepoint-defs.h`中提供了`tracepoint struct`结构体来定义 tracepoint 的信息。

```c
struct tracepoint {
        const char *name;               /* Tracepoint name */
        struct static_key_false key;
        struct static_call_key *static_call_key;
        void *static_call_tramp;
        void *iterator;
        void *probestub;
        struct tracepoint_func __rcu *funcs;
        struct tracepoint_ext *ext;
};
```

## 创建 tracepoint

内核里已经自带实现了许多 tracepoint 桩函数，可以在`/sys/kernel/debug/tracing/events/`目录下看到。

```shell
root@akira:/sys/kernel/tracing# ls ./events/irq
enable  filter  irq_handler_entry  irq_handler_exit  softirq_entry  softirq_exit  softirq_raise
```

如果想实现添加自己的 tracepoint，可以参考下面的步骤：

首先要在内核中插件入 tracepoint，需要在内核源码中添加 tracepoint 的定义和实现。一般基于模块粒度创建一个`trace`头文件，本例中创建`./include/trace/events/irq.`。

比如对于`irq`，可以在`./include/trace/events/irq.h`中添加 tracepoint 定义：

```c
/* SPDX-License-Identifier: GPL-2.0 */
#undef TRACE_SYSTEM
#define TRACE_SYSTEM irq

#if !defined(_TRACE_IRQ_H) || defined(TRACE_HEADER_MULTI_READ)
#define _TRACE_IRQ_H

#include <linux/tracepoint.h>
```

然后可以在`./include/trace/events/irq.h`中添加 tracepoint 的定义和实现，一个 tracepoint 文件可以包含多个事件，这里以`irq_handler_exit`为例：

```c
 /**
  * irq_handler_exit - called immediately after the irq action handler returns
  * @irq: irq number
  * @action: pointer to struct irqaction
  * @ret: return value
  *
  * If the @ret value is set to IRQ_HANDLED, then we know that the corresponding
  * @action->handler successfully handled this irq. Otherwise, the irq might be
  * a shared irq line, or the irq was not handled successfully. Can be used in
  * conjunction with the irq_handler_entry to understand irq handler latencies.
  */
 TRACE_EVENT(irq_handler_exit,                          // tracepoint name 可自定义，后面使用时用 trace_irq_handler_exit 来调用
 
         TP_PROTO(int irq, struct irqaction *action, int ret),

         TP_ARGS(irq, action, ret),                             // 函数参数
 
         TP_STRUCT__entry(                      // 表示当前 trace 函数定义了这些变量  
                 __field(        int,    irq     )
                 __field(        int,    ret     )
         ),
 
         TP_fast_assign(            // 对前面定义的 trace 函数变量进行赋值
                 __entry->irq    = irq;
                 __entry->ret    = ret;
         ),
 
         TP_printk("irq=%d ret=%s",
                  __entry->irq, __entry->ret ? "handled" : "unhandled") // tracepoint 的输出格式，也就是前面说的可以替代printk的地方
);
```

## 代码中调用 tracepoint

在内核代码中，可以通过`trace_irq_handler_exit`来调用 tracepoint。比如在`./kernel/irq/handle.c`中添加：

```c
#include <trace/events/irq.h>
trace_irq_handler_exit(irq, action, res);
```

## 内核中动态查看相关桩函数的打印

查看可用的 tracepoint 以及它们的输出格式：

```shell
# 查看所有 irq 相关的 tracepoints
ls events/irq/

# 查看特定 tracepoint 的格式
cat events/irq/irq_handler_exit/format

# 输出示例：
name: irq_handler_exit
ID: 1234
format:
        field:unsigned short common_type;       offset:0;       size:2; signed:0;
        field:unsigned char common_flags;       offset:2;       size:1; signed:0;
        field:unsigned char common_preempt_count;       offset:3;       size:1; signed:0;
        field:int common_pid;   offset:4;       size:4; signed:1;
        field:int irq;  offset:8;       size:4; signed:1;
        field:int ret;  offset:12;      size:4; signed:1;
```

启用和查看 tracepoint

```shell
# 方法1：单个启用
echo 1 > events/irq/irq_handler_exit/enable

# 方法2：启用所有 irq 相关的 tracepoints
echo 1 > events/irq/enable

# 开启跟踪
echo 1 > tracing_on

# 查看输出
cat trace
# 或实时查看
cat trace_pipe

# 停止跟踪
echo 0 > tracing_on
echo 0 > events/irq/irq_handler_exit/enable
```

也可以使用 perf 工具来查看 tracepoint 的输出：

```shell
# 查看所有可用的 tracepoints
sudo perf list | grep irq:

# 记录 tracepoint 事件
sudo perf record -e irq:irq_handler_exit -a sleep 10

# 实时查看
sudo perf trace -e irq:irq_handler_exit

# 统计事件计数
sudo perf stat -e irq:irq_handler_exit -a sleep 10
```

# perf 性能分析工具

perf 是基于 Linux 内核提供的 tracepoint 性能事件 perf_events 来进行性能分析的工具。它可以用于分析 CPU 性能、内存性能、I/O 性能等方面的问题。

- `perf stat`：用于统计性能事件的计数，例如 CPU 周期数、指令数、缓存命中率等。简单的屏幕输出，支持的指令可以用`perf stat -h`查看。
    
    `perf stat -a sleep 10`：统计全系统在 10 秒内的性能事件计数。

    假设有一个测试的可执行文件要分析，可以使用以下命令： `perf stat -e cycles,instructions,cache-references,cache-misses ./test_program`

    - -a：显示所有 CPU 上的统计信息。
    - -c：显示指定 CPU 上的统计信息。
    - -e：指定要显示的事件。
    - -i：禁止子任务继承父任务的性能计数器。
    - -r：重复执行 n 次目标程序，并给出性能指标在 n 次执行中的变化范围。
    - -p：指定要显示的进程的 ID。
    - -t：指定要显示的线程的 ID。

- `perf record`：用于记录性能事件的采样数据，可以生成性能分析报告。可以与`-e`选项指定要记录的事件类型。通过`perf record -h`查看指令参数
    
    比如针对 irq ：`perf record -e "irq:irq_handler_exit,irq:irq_handler_entry" -a -- sleep 2`

    - -a：分析整个系统的性能
    - -A：以 append 的方式写输出文件
    - -c：事件的采样周期
    - -C：只采集指定 CPU 数据
    - -e：选择性能事件，可以是硬件事件也可以是软件事件
    - -f：以 OverWrite 的方式写输出文件
    - -g：记录函数间的调用关系
    - -o：指定输出文件，默认为 perf.data
    - -p：指定一个进程的 ID 来采集特定进程的数据
    - -t：指定一个线程的 ID 来采集特定线程的数据

- `perf report`：针对`perf record`生成的采样数据进行分析和报告。通过`perf report -h`查看指令参数
    
    比如：`perf report`

    - -c<n>：指定采样周期
    - -C<cpu>：只显示指定 CPU 的信息
    - -d<dos>：只显示指定 dos 的符号
    - -g：生成函数调用关系图，具体等同于 perf top 命令中的 -g
    - -i：导入的数据文件的名称，默认为 perf.data
    - -M：以指定汇编指令风格显示
    - –sort：分类统计信息，如 PID、COMM、CPU 等
    - -S：只考虑指定符号
    - -U：只显示已解析的符号
    - -v：显示每个符号的地址

- `perf annotate`：用于查看特定函数或代码段的**汇编代码**，并采集显示每行代码的耗时，可以帮助我们找到代码、函数的执行瓶颈。通过`perf annotate -h`查看指令参数

    比如：`perf annotate -i perf.data`

    - -C<cpu>：指定某个 CPU 事件
    - -d：只解析指定文件中符号
    - -i：指定输入文件
    - -k：指定内核文件
    - -s：指定符号定位

<img src=2025-12-26-22-03-58.png>

<img src=2025-12-26-22-09-27.png>

1. 第一列：Children

    这列表示当前函数或符号所占的执行时间占比。

    例如，77.14% 表示该项在整个分析的执行时间中占用了 99.95%。

2. 第三列：Command

    这列显示了执行命令的名称。例如，swapper 是 Linux 内核中的一个常见进程，负责交换内存页。

3. 第四列：Shared Object

    这列显示符号所属的共享对象或库。

    在这个例子中，[kernel.kallsysms] 表示这是内核的符号。

    [k] 表示该符号或函数是在内核模式下执行的。

4. 第五列：Symbol

    这列列出了对应的符号或**函数名称**。例如：default_idle_call。

## 查看可用的性能事件

```shell
perf -h
perf list # 查看所有可用的性能事件
perf list | grep kvm  # 查看某个子模块的性能事件
```

## 生成火焰图

要生成火焰图必须有调用栈信息，所以需要在`perf record`时加上`-g`选项。

用`perf record -g`记录采样数据后，通过`perf script > out.perf`生成脚本文件，该脚本数据可以用于生成火焰图。

然后使用`FlameGraph`工具生成火焰图。

```shell
git clone https://github.com/brendangregg/FlameGraph.git
cd FlameGraph
```

生成火焰图：

```shell
./stackcollapse-perf.pl ../out.perf > out.folded
./flamegraph.pl out.folded > flamegraph.svg
```

将生成的`flamegraph.svg`文件用浏览器打开即可看到火焰图。

## 实战

### 代码

写一个简单的测试程序 test.c：

```c
#include <stdio.h>
#include <unistd.h>

int main(void)
{
        int times_s = 10;//10s
        int num = 1;
        for (int i = 0; i < times_s * 1000; ++i) {
                num += 1;
                usleep(1000);//睡眠1ms
        }
        return 0;
}
```

编译并运行（运行的时候加上 perf record）：

```shell
gcc -o test test.c
perf record ./test # 只记录函数调用，没有调用关系
```

<img src=2025-12-26-22-26-52.png>

- 22.22% test libc-2.31.so clock_nanosleep@GLIBC_2.17：

    这表示 test 程序在执行时，clock_nanosleep 函数占用了 22.22% 的 CPU 时间。

    clock_nanosleep 来自 libc-2.31.so 库，表示程序在执行睡眠操作（或者等待）时占用了大量 CPU 时间。

- 13.68% test [kernel.kallsysms] __arm64_sys_clock_nanosleep：

    这个符号表示内核调用 __arm64_sys_clock_nanosleep，也就是说内核在处理 clock_nanosleep 系统调用时占用了 13.68% 的 CPU 时间。

    __arm64_sys_clock_nanosleep 是 ARM64 平台下的系统调用处理函数。

- 13.25% test [kernel.kallsysms] el0_svc_common.constprop.0：

    该符号与内核中系统调用的处理有关，尤其是与特定的服务调用（SVC）相关。

    SVC（Supervisor Call） 是一种特权指令，用于从用户模式切换到内核模式。

- 8.55% test [kernel.kallsysms] common_nsleep：

    这个符号表示内核中的 common_nsleep，与常见的睡眠操作有关。它占用了 8.55% 的 CPU 时间。

### 耗时排查

下面针对这个测试程序通过`annotate`查看具体的汇编代码及耗时百分比：

```shell
perf record -g ./test
perf annotate -i perf.data
```

<img src=2026-01-01-14-39-30.png>

### 火焰图

下面针对这个测试程序生成火焰图：

```shell
perf record -g ./test  # -g: 记录完整的调用栈，有完整的调用栈才能生成火焰图
perf script > out.perf
cd FlameGraph
./stackcollapse-perf.pl ../out.perf > out.folded
./flamegraph.pl out.folded > flamegraph.svg
```


生成火焰图的效果图：

<img src=2025-12-26-22-46-24.png>

这个火焰图**主要显示了程序在执行 `usleep()` 导致的系统调用 `nanosleep()` 时花费了大量时间**。您提供的代码正是导致此性能特征的原因。

*   **Y轴（垂直方向）：** 表示函数调用栈的深度。底部的函数是调用者（父函数），其上方的函数是被调用者（子函数）。
*   **X轴（水平方向）：** 表示该函数在性能分析采样期间占用的 CPU 时间比例，**宽度越宽，表示占用 CPU 时间越长**。X轴上的顺序没有特定的时间含义，仅用于最大化地合并相同调用栈的矩形块。
*   **颜色：** 通常没有特定含义，仅用于区分不同的函数或表示新旧版本对比等。

结合代码中有一个循环，每次循环都会调用 `usleep(1000)`（睡眠 1 毫秒）。

```c
for (int i = 0; i < times_s * 1000; ++i) {
        num += 1;
        usleep(1000);//睡眠1us
}
```

这个火焰图显示：

1. 最底层的 test（您的程序二进制文件，或 main 函数）是程序的起点。
2. main 函数调用了 libc_start_main，然后调用 usleep。
3. usleep 最终导致了 nanosleep 或类似的系统调用，例如 hrtimer_nanosleep 和 do_nanosleep，这些调用在图中形成了最宽的“火焰尖”。

结论：
- 图中最宽的区域是与 nanosleep 相关的系统调用栈。这表明您的程序大部分时间都花在了“睡眠”（等待）状态，而不是在执行计算任务。火焰图有效地指出了性能瓶颈在于频繁且耗时的睡眠操作。

> [Linux 性能分析工具 perf 的使用指南](https://zhuanlan.zhihu.com/p/8497782204)