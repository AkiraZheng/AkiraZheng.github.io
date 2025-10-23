---
title: 'Linux:内核通知机制'
date: 2025-09-29 17:29:24
tags:
categories: 
- Linux内核基础
---

以内核中`/arch/arm64/kvm/arm.c`为例，在内核初始化时注册了一个 CPU 低功耗事件发生时的接收通知器，用于处理 CPU 低功耗事件：

```c
//file: arm.c
static void __init hyp_cpu_pm_init(void)
{
    if (!is_protected_kvm_enabled())
        cpu_pm_register_notifier(&hyp_init_cpu_pm_nb);
}
```

上述通知器中，`cpu_pm_register_notifier`函数是 LPI 模块在`cpu_pm.c`中定义的一个通知链函数，`hyp_cpu_pm_init`通过调用该函数，可以实现将 `hyp_init_cpu_pm_nb`回调结构体注册到 CPU 低功耗通知链中，使 KVM 模块也能作为 CPU 低功耗事件发生时的一个观察者。

```c
//file: cpu_pm.c
/**
 * cpu_pm_register_notifier - register a driver with cpu_pm
 * @nb: notifier block to register
 *
 * Add a driver to a list of drivers that are notified about
 * CPU and CPU cluster low power entry and exit.
 *
 * This function has the same return conditions as raw_notifier_chain_register.
 */
int cpu_pm_register_notifier(struct notifier_block *nb)
{
	unsigned long flags;
	int ret;

	raw_spin_lock_irqsave(&cpu_pm_notifier.lock, flags);
	ret = raw_notifier_chain_register(&cpu_pm_notifier.chain, nb);
	raw_spin_unlock_irqrestore(&cpu_pm_notifier.lock, flags);
	return ret;
}
EXPORT_SYMBOL_GPL(cpu_pm_register_notifier);
```

在`hyp_cpu_pm_init`中注册了回调结构体`hyp_init_cpu_pm_nb`，结构体中注册了一些回调函数指针`hyp_init_cpu_pm_notifier`，也称为通知块（订阅事件）

```c
//file: arm.c
static struct notifier_block hyp_init_cpu_pm_nb = {
	.notifier_call = hyp_init_cpu_pm_notifier,
};
```

`notifier_block`结构体是 Linux 内核中的一种数据结构，用于实现观察者模式，它允许内核的不同部分将自己注册为监听器（观察者）以侦听特定事件。当这些事件发生时，内核会通知所有注册的notifier block，它们可以对事件做出适当的响应。

`struct notifier_block` 在Linux内核头文件 `include/linux/notifier.h` 中定义，并具有以下结构：

```c
//file: arm.c
struct notifier_block;

typedef	int (*notifier_fn_t)(struct notifier_block *nb,
			unsigned long action, void *data);
struct notifier_block {
	notifier_fn_t notifier_call;
	struct notifier_block __rcu *next;
	int priority;
};
```

- `notifier_call`：这个字段指向在通知事件发生时将被调用的回调函数。回调函数的函数签名定义为 `typedef int (*notifier_fn_t)(struct notifier_block *nb,unsigned long action, void *data);`。nb 参数是指向 notifier block 本身的指针，action 包含通知类型，而 data 则是指向与事件相关的附加数据的指针。
- `next`：这个字段是指向链中下一个 notifier block 的指针。Linux内核维护一个已注册的 notifier block 的链表，该字段使得可以遍历整个链表。
- `priority`：这个字段决定了该 notifier block 相对于其他已注册 notifier block 的优先级。当多个块为同一事件注册时，内核按照优先级降序通知它们。具有较高优先级值的 notifier block 将在具有较低优先级值的之前收到通知。

要使用 struct notifier_block，内核模块可以使用Linux内核提供的函数进行注册，例如 register_inotifier() 或register_netdevice_notifier()，具体取决于特定的事件类别。

同样以`kvm`中针对 CPU 低功耗的事件监听为例，当完成注册后，就可以在`hyp_init_cpu_pm_notifier`函数中添加一些监听到该事件后的具体事件处理代码，当 LPI 低功耗模块在`cpu_pm.c`中发起`notifier_call_chain`时，就可以 call 所有注册了的监听者执行相关的事件处理。在`cpu_pm.c`中发起`notifier_call_chain`的代码为：

```c
//file: cpu_pm.c
static int cpu_pm_notify(enum cpu_pm_event event)
{
	int ret;

	rcu_read_lock();
	ret = raw_notifier_call_chain(&cpu_pm_notifier.chain, event, NULL);
	rcu_read_unlock();

	return notifier_to_errno(ret);
}


/**
 * cpu_pm_exit - CPU low power exit notifier
 *
 * Notifies listeners that a single CPU is exiting a low power state that may
 * have caused some blocks in the same power domain as the cpu to reset.
 *
 * Notified drivers can include VFP co-processor, interrupt controller
 * and its PM extensions, local CPU timers context save/restore which
 * shouldn't be interrupted. Hence it must be called with interrupts disabled.
 *
 * Return conditions are same as __raw_notifier_call_chain.
 */
int cpu_pm_exit(void)
{
	return cpu_pm_notify(CPU_PM_EXIT);
}
EXPORT_SYMBOL_GPL(cpu_pm_exit);
```

以 kvm 为例，整体的 notifier 通知链机制流程图如下所示：

```
     +---------------------------------------------------------+                          +----------------------------------------+
     |  [kvm/arm.c]                                            |                          |     [cpu_pm.c]                         |
     |  hyp_cpu_pm_init                                        |                          |     cpu_pm_exit                        |
     |      +->cpu_pm_register_notifier                        |                          |         +->cpu_pm_notify               |
     |           +->.notifier_call = hyp_init_cpu_pm_notifier  |                          |             +->raw_notifier_call_chain |
     +----------+----------------------------------------------+                          +-------+--------------------------------+
                |                                                                                 |
                |Register an observer with the cpu_pm (LPI) module.                               |Call the notifier chain.
                |                                                                                 |
                v                                                                                 v
     +--------------------------------+                                                   +---------------------------------+
     |                                |                                                   |                                 |
  +--+  [cpu_pm.c]                    |                                                   |     [cpu_pm.c]                  +------------+
  |  |  raw_notifier_chain_register() |                                                   |     raw_notifier_call_chain()   |            |
  |  +--------------------------------+                                                   +---------------------------------+            |
  |                                                                                                                                      |
  |                                                                                                                                      |
  |Add one notifier_block to the notifier chain.                                                                                                                                      |
  |                                                                                                                                      |
  |  +-------------------------------------------------------------------------------------------------------------------------------+   |
  |  |                                                          notifier chain                                                       |   |
  |  |                                                                                                                               |   |
  +---->notifier_block n -----> notifier_block ... ------> notifier_block 3 ----> notifier_block 2 -----> notifier_block 1           |   |
     |         |                      |                          |                      |                       |                    |   |
     +---------|----------------------|--------------------------|----------------------|-----------------------|--------------------+   | call for all functions.
               |                      |                          |                      |                       |                        |
               |                      |                          |                      |                       |                        |
               |                      |                          |                      |                       |                        |
               |                      |                          |                      |                       |                        |
               |                      |                          |                      |                       |                        |
               |                      |                          |                      |                       |                        |
               |                      |                          |                      |                       |                        |
     +---------|----------------------|--------------------------|----------------------|-----------------------|--------------------+   |
     |         |                      |                          | callback funcions    |                       |                    |   |
     |         v                      v                          v                      v                       v                    |   |
     |+-------------------------+ +-------------+       +-------------------+      +--------------+     +-----------------+          <---+
     || call_n                  | |call_...     |       |       call_3      |      |    call_2    |     |       call_1    |          |
     || hyp_init_cpu_pm_notifier| |             |       |                   |      |              |     |                 |          |
     |+-------------------------+ +-------------+       +-------------------+      +--------------+     +-----------------+          |
     +-------------------------------------------------------------------------------------------------------------------------------+

```