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
cat /sys/kernel/debug/tracing/events/目录/函数名/format
# eg：
cat /sys/kernel/debug/tracing/events/irq/irq_handler_entry/format
```

然后就可以根据`format`中的字段来过滤：

```shell
echo 'irq==123' > /sys/kernel/debug/tracing/events/irq/irq_handler_entry/filter
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

```shell
echo 'p:kprobes/__setup_irq __setup_irq irq=%x0 desc=%x1 new=%x2' > kprobe_events
cat kprobe_events # 此时就能看到刚刚添加的 kprobe 事件
ls events/kprobes/  | grep __setup_irq  # 此时能看到 __setup_irq 事件了
```

## 过滤、禁止输出调用栈

```shell
echo 'name=="eth2"' > events/kprobes/filter  # 过滤入参 name==eth2 的事件
echo 'pid!=1234' > events/kprobes/filter  # 过滤特定 pid 的事件
echo nostacktrace > /sys/kernel/debug/tracing/trace_options  # 关闭调用栈的打印，只看 __setup_irq 的入参显示
```

## 启动追踪

```shell
echo 1 > events/kprobes/enable
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
echo nostacktrace > /sys/kernel/debug/tracing/trace_options  # 关闭调用栈的打印，只看 __setup_irq 的入参显示
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
ls /sys/kernel/tracing/events/irq/

# 查看特定 tracepoint 的格式
cat /sys/kernel/tracing/events/irq/irq_handler_exit/format

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
echo 1 > /sys/kernel/tracing/events/irq/irq_handler_exit/enable

# 方法2：启用所有 irq 相关的 tracepoints
echo 1 > /sys/kernel/tracing/events/irq/enable

# 开启跟踪
echo 1 > /sys/kernel/tracing/tracing_on

# 查看输出
cat /sys/kernel/tracing/trace
# 或实时查看
cat /sys/kernel/tracing/trace_pipe

# 停止跟踪
echo 0 > /sys/kernel/tracing/tracing_on
echo 0 > /sys/kernel/tracing/events/irq/irq_handler_exit/enable
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
