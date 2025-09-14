---
title: 虚拟化：CPU虚拟化
date: 2025-09-14 14:23:37
tags:
categories:
    - 虚拟化
---

# 一、虚拟化类型介绍

Hypervisor：虚拟机管理程序，也叫做 VMM（Virtual Machine Manager），Hypervisor 位于计算机硬件和虚拟机之间，负责管理和分配计算机资源给各个虚拟机。

- Type1：第一类虚拟机管理程序就像**小型操作系统**，目的就是管理所有的虚拟机，常见的虚拟化软件有Xen、ACRN等

    - 运行级别：Hyprvisor 运行在 **EL2**，VM 的**操作系统OS、内核**运行在 **EL1**
    
        <img src=2025-09-14-15-32-54.png>

- Type2：第二类虚拟机管理程序依赖于Windows、Linux等主机操作系统来分配和管理调度资源，常见的虚拟化软件有VMware Player、KVM以及Virtual Box等。也就是说这一类必须有一个**宿主操作系统**

<img src=2025-09-14-15-40-09.png>

kvm 属于 type2 虚拟化，但是由于硬件问题，为了方便直接用 qemu 做实验，我们将在 benos 基础上设计一个 type1 的软件虚拟化。这部分在后面的实操会再进一步介绍。

# 二、vCPU

在虚拟化中，一个 VM 虚拟机由 vCPU、虚拟的内存、存储、网络等，组成的独立运行的计算机。其中一个 VM 可以有多个进程，每个进程可以运行在不同的 vCPU 上。

<img src="2025-09-14-14-55-33.png">

而对于 host 来说， vcpu 其实就是一个线程，他会被 hypervisor 调度到不同的 pCPU 上运行，但是同一时间内，一个 vcpu 只能被一个 pCPU 运行。vCPU 被调度 load 的过程如下：

<img src=2025-09-14-15-47-51.png>

从上述过程可以看出，CPU/vCPU 运行的本质行为其实就是从 PC 寄存器所指内存区域中不断取出指令解码执行，我们不难想到的是，实现一个虚拟机最简单粗暴的方法便是通过模拟每一条指令对应的行为，从而使得 VM 的行为对 VMM 而言是完全可控的。 



> [type 1 和 type 2 虚拟机的区别](https://www.techtarget.com/searchitoperations/tip/Whats-the-difference-between-Type-1-vs-Type-2-hypervisor)
>
> [CPU 虚拟化](https://ctf-wiki.org/pwn/virtualization/basic-knowledge/cpu-virtualization/)

# 三、异常处理

vCPU 之间的调度、任务处理其实基本离不开多个 EL 级别的切换，而 EL 级别切换的实现，需要通过异常处理来实现。比如我们实现从 pCPU 切换到 vCPU 的过程是 EL2 切换到 EL1 的过程。

关于异常，我们划分为**同步异常**和**异步异常**两种：

- 同步异常：
    - 系统调用：svc，hvc，SMC等
    - MMU引发的异常：缺页
    - SP和PC对齐检查

- 异步异常：其中通常将**中断（IQR、FQR、SERROR）**划分为异步异常，这种异常是跟指令无关的。

当异常发生时，可能会 trap 到其他的 EL 中进行处理，也会进行一些上下文保存等操作，根据操作系统根据异常类型，跳转到合适的异常向量表中进行处理：

<img src=2025-09-14-16-07-22.png>

其中，针对异常向量表，在`VBAR_ELx`寄存器中保存了各类异常的**处理程序跳转地址**。具体来说，会跳转到`VBAR_ELx + 0x[xxx]`处，这个过程与非虚拟化场景一样，但是差别是在`hypervisor`中也要初始化一个对应的`VBAR_ELx`异常向量表

在内核中，有两个关于 RETURN 的寄存器：

- `x30`：**子函数**返回地址，使用 `ret` 指令返回
- `ELR_ELx`：**异常处理程序**返回地址，使用 `eret` 指令返回
    - 对于**异步异常**，它的返回地址是中断发生时的**下一条指令**，或者没有执行的第一条指令。
    - 对于**不是system call**的同步异常，返回的是 **触发同步异常的那一条指令**。
    - 对于**system call**，它是返回**svc/hvc指令的下一条指令**

异常处理过程中，需要路由到进行异常处理的 EL 中。异常处理最低也要在 EL1 中处理，EL0 不处理异常，而虚拟化场景下，很多需要路由到 EL2 （hypervisor）中进行。

由`HCR_EL2` 与 `SCR_EL3` 两个寄存器控制路由，HCR_EL2.RW 记录了 EL1 运行在32位模式还是64位模式。

<img src=2025-09-14-16-34-54.png>

# 四、实验

在非虚拟化场景下，`BenOS`运行在 EL1 中，在虚拟化场景下，我们将`BenOS`运行在 EL2 中，充当 hypervisor