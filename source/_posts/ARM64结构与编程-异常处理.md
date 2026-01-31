---
title: 'ARM64结构与编程:异常处理'
date: 2026-01-11 17:12:04
tags:
categories:
    - ARM64结构与编程实操
---

# 一、异常等级

ARM 的异常等级分为四个等级：

- EL0：非特权模式，用户态，运行用户应用程序
- EL1：特权模式，内核态，运行操作系统内核（VHE 模式下操作系统内核运行在 EL2）
- EL2：虚拟化模式，运行虚拟机监控器 Hypervisor
- EL3：安全模式，运行可信执行环境（TEE）

<img src=2026-01-11-17-44-32.png>

# 二、异常类型

当异常发生时，通常会 trap 到更高的 EL 级别进行处理。然后处理完通过`eret`指令返回到之前的 EL 级别继续执行。

<img src=2026-01-11-17-28-30.png>

返回到原先的 Level 后，我们应该执行**原先发生异常的那条指令**呢？还是跳过它**继续执行下一条指令**呢？这取决于异常的类型。

ARM64 异常类型分为同步异常和异步异常两种

- 同步异常一般指的是异常是由**当前**指令引起的，例如除零、非法指令等，因此这种异常需要由高级别的决定怎么处理，能否修复。**除系统调用外**，同步异常`eret`返回后**重新执行发生异常的那条指令**。
    - 系统调用异常（SVC、HVC、SMC）
    - MMU 引发的异常（缺页、访问没有权限的页面）
    - 对齐检查异常（SP 和 PC 对齐检查）
    - 未分配指令异常（非法指令、没有被定义的指令、在不恰当的等级访问没有权限的寄存器）
- 异步异常一般指的是异常是由**外部事件**引起的，例如中断等，当前正在执行的指令跟出现的异常是没有依赖关系的，因此这种异常处理完后**直接继续执行下一条指令**。
    - IRQ 中断
    - FIQ 中断
    - SERROR 中断，没法被修复的错误


# 三、异常入口

异常入口是要清楚发生异常后，CPU 要做什么。 当异常发生时，CPU 会自动执行以下操作：

- PSTATE 保存到 `SPSR_ELx` 中
    - PSTATE 包含当前的处理器状态信息，包括**条件标志、中断使能位等**
- 返回地址 PC 保存到 `ELR_ELx` 中
- PSTATE 寄存器里的 DAIF 标志位会被设置为 1，相当于把调试异常、SError 异常、IRQ 异常和 FIQ 异常全部关闭，防止在异常处理过程中被打断。
- 更新 `ESR_ELx` 寄存器，记录**异常的类型和原因**
- SP 执行 `SP_ELx` 寄存器，**切换到对应 EL 级别的栈**
- 切换到对应的 EL 级别，跳转到**异常向量表**中对应的异常处理程序地址

# 四、异常返回

<img src=2026-01-11-18-11-18.png>

异常返回时，操作系统会执行 `eret` 指令，CPU 会**自动**执行以下操作：

- 从 `ELR_ELx` 寄存器中恢复 PC 指针
    - 同步异常（非系统调用的同步异常）：PC 执行异常现场的**当条指令**
    - 异步异常：PC 执行异常现场的**下一条指令**
- 从 `SPSR_ELx` 寄存器中恢复 PSTATE 状态
    - `SPSR.M[3:0]` 字段记录了要返回恢复到哪个 EL 级别
    - `SPSR.M[4]`记录了异常现场的模式：
        - 0：AArch64 模式
        - 1：AArch32 模式

    <img src=2026-01-11-18-17-59.png>


# 五、异常处理的路由

异常处理的路由指的是发生异常后，要**跳转到哪个 EL 级别进行处理**。

当出现异常时，CPU 会根据当前的 EL 级别和异常类型，切换到相应的 EL 级别进行处理。通常情况下，异常**会从较低的 EL 级别切换到较高的 EL 级别进行处理**。例如，当在 EL0 运行的用户应用程序发生异常时，CPU 会切换到 EL1 进行处理。

异常**也可以同级别处理**，例如在 EL1 运行的内核代码发生异常时，CPU 仍然在 EL1 进行处理。但是 **EL0 的异常不能在 EL0 进行处理**，必须切换到高级别中。

为了实现跳转，每个 EL 等级需要在系统启动时分配一个对应的**栈空间**，一般 4KB 大小即可。当要做异常跳转的时候，让 `SP_ELx` 指向对应 EL 级别的栈地址。

#  六、异常向量表

异常向量表需要软件配置，且有固定的格式，每个EL都有自己的异常向量表（除了EL0，EL0不处理异常）。

EL1的异常向量表的基地址可以通过寄存器`VBAR_EL1`来配置，所有要切到 EL1 处理的异常，都会跳转到这个地址开始执行。

<img src=2026-01-28-18-17-46.png>

由于 64 位的地址中，前面bit[10:0]是保留地址，不使用的，因此异常向量表的地址**需要2KB对齐**（2^11 = 2048）。所以一般在配置异常向量表基地址的时候都会用**align 11**来对齐。

异常向量表的设计理念是必须放在一个连续的块中，这个块的大小是 2KB（2048 字节），因为异常向量表中有 16 个入口，每个入口占用 128 字节（16 x 128 = 2048 字节）。


先看一个简单的地址空间示意（只画一小段，VBAR_EL1 对齐示意图（2KB 对齐直观图））：

```text
地址（假设高位都是 0xFFFF0000_0000_0000 之类，这里只关心低 16bit）

... ────────────────────────────────────────────────
0xF800  ──────────────┐
                      │  2KB 对齐边界（0xF800 = 0b xxxx xxxx xxxx 0000 0000 0000）
0xF801  ──────────────┤
0xF802  ──────────────┤
...                   │
0xFFFF  ──────────────┘ 这一整块 0xF800 ~ 0xFFFF 共 0x800 = 2048 字节 = 2KB

下一个 2KB 对齐块：
0x10000 ──────────────┐
                      │  2KB 对齐边界（0x10000 = 0b xxxx xxxx xxxx 0000 0000 0000）
...                   │
0x107FF ──────────────┘
... ────────────────────────────────────────────────
```

VBAR_EL1 的低 11 位是 RES0，也就是：

```text
VBAR_EL1[10:0] = 0
这意味着 VBAR_EL1 实际上只能取这些值：

text
...0000_0000_0000
...0000_0001_0000_0000_0000 (0x800)
...0000_0010_0000_0000_0000 (0x1000)
...0000_0011_0000_0000_0000 (0x1800)
...
```

也就是只能指向每个 2KB 块的起始地址。

如果你写入一个没对齐的地址，比如：

```text
你写：  VBAR_EL1 = 0x0000_0000_0001_2345
硬件用：VBAR_EL1 = 0x0000_0000_0001_2000   （低 11 位被清零）
```

所以向量表必须整体放在 [0x0000_0000_0001_2000, 0x0000_0000_0001_27FF] 这 2KB 里。

裸机汇编里保证 VBAR_EL1 对齐的方式以为下：

```armasm
.section .vectors
.align 11          // Align to 2KB boundary
.globl vector_table
vector_table:
	// 当前 EL，SP0
    b   sync_el_sp0
    .align 7                // 128B 对齐
	b   irq_el_sp0
	.align 7
	b   fiq_el_sp0
	.align 7
	b   serr_el_sp0
	.align 7
	// 当前 EL，SPx
	b   sync_el_spx
	.align 7
	b   irq_el_spx
	.align 7
	b   fiq_el_spx
	.align 7
	b   serr_el_spx
	.align 7
	// Lower EL using AArch64
    ...
```





# 实验一：跳转到 EL1

QEMU 虚机跳转到 Benos 代码时，是出于 EL2 级别的，因此我们需要在 Benos 内核初始化代码中，**切换到 EL1 级别**。

因此，我们需要在 EL2 中触发一次异常，并在同级别 EL2 中处理这个异常，从而实现跳转到 EL1。

跳转到 EL1 需要配置 EL1 的一些相关寄存器做以下几步：

- 设置 `HCR_EL2` 寄存器，这个寄存器是配置 hypervisor 的一些配置项，这里的 `RW,bit[31]` 域表示了 EL1 运行在 AArch64 模式还是 AArch32 模式
    - 0：AArch32 模式 （默认）
    - 1：AArch64 模式
- 设置 `SCTRL_EL1` 寄存器，这个寄存器是配置一些如 MMU、cache、大小端的配置项
    - `M,bit[0]` 域表示是否开启 MMU
        - 0：关闭 MMU（目前系统内核还没写内存翻译的代码，因此先关闭）
        - 1：开启 MMU
    - `EE,bit[25]` 域表示 EL1 的大小端模式
        - 0：小端模式（这里也设置成小端）
        - 1：大端模式
- 设置 `SPSR_EL2` 寄存器，这个寄存器是保存异常现场的 PSTATE 状态，需要关闭中断并设置返回的 EL 级别
    - `M,bit[3:0]` 域表示要切到哪个 EL 级别（我们这里是要切到 EL1）
        - `0b0101`：EL1h 模式，使用 SP_EL1 寄存器作为栈指针
- 设置异常返回寄存器 `ELR_EL2`，让他返回到 EL1_entry 入口汇编函数里
- 执行 `eret` 指令，跳转到 EL1 级别

```c
// sysregs.h
/* 设置 HCR 寄存器的标志位：
* - HCR_RW: 用于设置寄存器的读写权限位。
* - HCR_HOST_NVHE_FLAGS: 用于配置非虚拟化主机环境的标志位。
*/

#define HCR_RW          (1UL << 31)
#define HCR_HOST_NVHE_FLAGS  (HCR_RW)

/* 设置 SCTLR 寄存器的标志位：
* - SCTRL_EE_LITTLE_ENDIAN: 设置异常级别为小端模式。
* - SCTRL_EOE_LITTLE_ENDIAN: 设置外部异常为小端模式。
* - SCTRL_MMU_DISABLED: 禁用内存管理单元 (MMU)
* - SCTRL_VALUE_MMU_DISABLED: 组合上述标志以表示 MMU 被禁用的配置。
*/

#define SCTRL_EE_LITTLE_ENDIAN    (0 << 25)
#define SCTRL_EOE_LITTLE_ENDIAN   (0 << 24)
#define SCTRL_MMU_DISABLED        (0 << 0)
#define SCTRL_VALUE_MMU_DISABLED   (SCTRL_EE_LITTLE_ENDIAN | SCTRL_EOE_LITTLE_ENDIAN | SCTRL_MMU_DISABLED)

/* 设置 SPSR 寄存器的标志位：
* - SPSR_MASK_ALL: 用于屏蔽所有中断。
* - SPSR_EL1h: 设置为 EL1 的高权限模式。
* - SPSR_EL2h: 设置为 EL2 的高权限模式。
* - SPSR_EL1: 组合标志以表示进入 EL1 高权限模式。
* - SPSR_EL2: 组合标志以表示进入 EL2 高权限模式。
*/

#define SPSR_MASK_ALL        (0b111 << 6)
#define SPSR_EL1h           (0b0101 << 0)
#define SPSR_EL2h           (0b1001 << 0)
#define SPSR_EL1            (SPSR_MASK_ALL | SPSR_EL1h)
#define SPSR_EL2            (SPSR_MASK_ALL | SPSR_EL2h)

/* 设置 CurrentEL 寄存器的标志位：
* - CurrentEL_EL1: 表示当前处于 EL1。
* - CurrentEL_EL2: 表示当前处于 EL2。
* - CurrentEL_EL3: 表示当前处于 EL3。
*/

#define CurrentEL_EL1       (0b01 << 2)
#define CurrentEL_EL2       (0b10 << 2)
#define CurrentEL_EL3       (0b11 << 2)
```

```armasm
// boot.s
#include "mm.h"
#include "sysregs.h"

.section .rodata
.align 3 // align to 8 bytes
.globl el_string1
el_string1:
	.string "Booting at EL"

.section ".text.boot"
.globl _start
_start:
	mrs	x0, mpidr_el1		
	and	x0, x0,#0xFF		// Check processor id
	cbz	x0, master		// Hang for all non-primary CPU
	b	proc_hang

proc_hang: 
	b 	proc_hang

master:
	/* init uart and print the string */
	bl __init_uart

	mrs x5, CurrentEL		// Read CurrentEL
	cmp x5, #CurrentEL_EL3
	b.eq el3_entry
	b el2_entry

el3_entry:
	eret

el2_entry:
	bl print_el //It should print "Booting at EL2"

	/* The Execution state for EL1 is AArch64 */
	ldr x0, =HCR_HOST_NVHE_FLAGS
	msr hcr_el2, x0

	ldr x0, =SCTRL_VALUE_MMU_DISABLED
	msr sctlr_el1, x0

	ldr x0, =SPSR_EL1
	msr spsr_el2, x0

	adr x0, el1_entry
	msr elr_el2, x0

	eret

el1_entry:
	/* Now in EL1 */
	bl print_el //It should print "Booting at EL1"

	adr x0, _bss
	adr x1, _ebss
	sub x1,x1,x0
	bl memzero

	mov sp, #LOW_MEMORY
	bl kernel_main
	b proc_hang		// Should never return here

print_el:
	mov x10, x30

	/* 
		print EL
	*/
	adrp x0, el_string1
	add x0, x0, :lo12:el_string1
	bl put_string_uart

	mrs x5, CurrentEL
	/* get the currentEL value */
	lsr x2, x5, #2
	mov x0, #48
	add x0, x0, x2
	bl put_uart
    /* print the new line tab 
    没有下面的代码，print完会卡在这，无法ret返回，也就导致EL2第一次print后，代码就卡住了
    */
    mov x0, #10
    bl put_uart
    
    mov x30, x10
    ret 
```

