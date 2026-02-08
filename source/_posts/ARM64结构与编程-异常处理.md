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

在 spec 里，定义了四种异常类型的入口顺序：

- 同步异常
- IRQ 异常
- FIQ 异常
- SError 异常

每个 EL 级别都有这四种异常类型的入口，因此 lnux 内核里保证 VBAR_EL1 的异常向量表和对齐方式以为下：

<img src=2026-02-04-20-20-58.png>

其中，`kernel_ventry`是宏定义，定义在`arch/arm64/kernel/vectors.S`文件中：

```armasm
.macro kernel_ventry type, el, label, regsize = 64
.align 7                       // align to 128 bytes，每个entry表项都是128字节
sub sp, sp, #S_FRAME_SIZE // create stack frame，S_FRAME_SIZE表示栈宽大小
b el \()\el\()_\label  //比如在EL1的 FIQ 中断中，会跳转到异常向量表中 el1_fiq_invalid 异常处理函数中，也就是变成 b el1_fiq_invalid
.endm
```

<img src=2026-02-04-20-38-03.png>

其中，`kernel_entry`宏是用来保存异常现场的（上下文），保存CPU中的重要信息。

<img src=2026-02-04-20-42-53.png>

<img src=2026-02-04-19-32-53.png>


四种异常类型的入口地址偏移分别是：

<img src=2026-02-04-19-35-51.png>

# 七、同步异常的解析

同步异常的原因可以通过 `ESR_ELx` 寄存器来解析，`ESR_ELx` 寄存器中包含了异常的**类型和原因信息**：

<img src=2026-02-08-15-06-21.png>

其中比较创建的 EC 有：

- `EC == 0b100000`：Instruction Abort from a lower Exception level，指令访问内存异常，且是来自 lower EL 的异常
- `EC == 0b100001`：Instruction Abort taken without a change in Exception level，来自当前 EL 的指令访问内存异常
- `EC == 0b100100`：Data Abort from a lower Exception level，数据访问内存异常，且是来自 lower EL 的异常
- `EC == 0b100101`：Data Abort taken without a change in Exception level，来自当前 EL 的数据访问内存异常

当异常发生时，硬件会填充 `ESR_ELx` 寄存器的 EC 域来表示异常的类型和原因。软件可以通过读取 `ESR_ELx` 寄存器来获取异常的详细信息，从而进行相应的处理。处理流程如下：

<img src=2026-02-08-15-11-48.png>

ISS 域的编码规则如下：

<img src=2026-02-08-15-38-19.png>

其中`DFSC`很重要，可以从`DFSC`的编码直接确认是由于缺页、权限异常还是其他原因导致的。

<img src=2026-02-08-15-40-00.png>

linux 源码`arch/arm64/kvm/handle_exit.c`中有与各ESR对应的异常处理函数表：

<img src=2026-02-08-15-35-03.png>



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

# 实验二：实现同步异常处理

本实验的异常暂时不做保存异常上下文的操作，只是简单地将异常全部触发 panic。

ARM v8 中指令通常是 4 字节对齐的，因此我们可以通过**故意执行一个未对齐的内存访问指令**来触发同步异常。

首先创建一个 EL1 的异常向量表`vectors`：

```armasm
// vectors.S
#define BAD_SYNC 0
#define BAD_IRQ  1
#define BAD_FIQ  2
#define BAD_ERROR 3

/*
* 定义 inv_entry 宏，用于生成无效异常处理程序
* 参数：
*   el: 异常发生时的异常级别（0 或 1）
*   reason: 异常原因代码
 */
    .macro inv_entry el, reason
    //kernel_entry el //上下文保存-未实现
    mov x0, sp
    mov x1, #\reason
    mrs x2, esr_el1
    b bad_mode //在kernel.c的函数中定义异常处理函数bad_mode
    .endm

/*
* 定义 vtentry 宏，用于生成异常向量表的表项，每个表项占 128 字节
* 参数：
*   label: 异常处理程序的标签
 */
    .macro vtentry label
    .align 7         // 128 字节对齐
    b \label
    .endm

/*
* 异常向量表
* ARM 的异常向量表一共占 2048 字节（4*4*128）
* 因此用 align 11 表示 2048 字节对齐
* 分为 4 组，根据四个异常类型每组有4个表项，每个表项占 128 字节
 */

.align 11
.global vectors
vectors:
    /*
    * Current EL with SP0
    * 异常描述：当前系统运行在EL1时使用EL0的栈指针SP
     */
    vtentry el1_sync_invalid
    vtentry el1_irq_invalid
    vtentry el1_fiq_invalid
    vtentry el1_serror_invalid

    /*
    * Current EL with SPx
    * 异常描述：当前系统运行在EL1时使用当前EL1的栈指针SP
    *          说明是在内核态下发生的异常
    * 当前我们只实现此处的 IRQ 中断
     */
    vtentry el1_sync_invalid
    vtentry el1_irq_invalid
    vtentry el1_fiq_invalid
    vtentry el1_serror_invalid

    /*
    * Lower EL using AArch64
    * 异常描述：在用户态下发生的异常
     */
    vtentry el0_sync_invalid
    vtentry el0_irq_invalid 
    vtentry el0_fiq_invalid
    vtentry el0_serror_invalid

    /*
    * Lower EL using AArch32
    * 异常描述：在用户态下发生的异常
    */
    vtentry el0_sync_invalid
    vtentry el0_irq_invalid
    vtentry el0_fiq_invalid
    vtentry el0_serror_invalid

el1_sync_invalid:
    inv_entry 1, BAD_SYNC
el1_irq_invalid:
    inv_entry 1, BAD_IRQ
el1_fiq_invalid:
    inv_entry 1, BAD_FIQ
el1_serror_invalid:
    inv_entry 1, BAD_ERROR
el0_sync_invalid:
    inv_entry 0, BAD_SYNC
el0_irq_invalid:
    inv_entry 0, BAD_IRQ
el0_fiq_invalid:
    inv_entry 0, BAD_FIQ
el0_serror_invalid:
    inv_entry 0, BAD_ERROR
```

```c
// kernel.c
//对应异常向量表inv_entry函数传入的reason参数：0~3
static const char * const bad_mode_handler[] = {
	"Sync Abort",
	"IRQ",
	"FIQ",
	"SError",
};

void bad_mode(struct pt_regs *regs, int reason, unsigned long esr)
{
	printk("Bad mode for %s, far:0x%x, esr:0x%016llx\n",//其中far_el1为故障地址寄存器
		bad_mode_handler[reason],
		read_sysreg(far_el1),
		esr);
}
```

编写完 EL1 的异常向量表后，需要在进入 EL1 的`el1_entry`函数中，配置`VBAR_EL1`寄存器，让 CPU 知道 EL1 的异常向量表地址：

```armasm
// boot.s

el1_entry:
	//...

	/* 设置 EL1 的异常向量表地址到 vbar 寄存器中 */
	ldr x5, =vectors
	msr vbar_el1, x5
	isb

	//...
```

完成后，就可以正常编译运行了。但是此时我们还没有触发异常，因此我们需要在`kernel_main`函数中，故意通过**指令未对齐**来触发Instruction Alignment Fault（指令对齐故障）：

```c
// kernel.c
extern void trigger_alignment(void);

void kernel_main(void)
{
	//...

	trigger_alignment();

	//...
}
```

如果我们只是通过下面的方式来访问内存，是不触发异常的：

```armasm
// entry.S
.global trigger_alignment	//执行到这里，地址是0x83004，是4字节对齐的，不会触发异常
trigger_alignment:
    ldr x0, =0x80002
    ldr x1, [x0]
    ret
```

<img src=2026-02-04-21-55-54.png>

但是如果我们在`trigger_alignment`前面加上一个字节的偏移，就会触发异常：

```armasm
// entry.S
string_test:		//83004
    .string "t"		//t 和 \0 分别占用83004和83005两个字节

.global trigger_alignment
trigger_alignment:		 //执行到这里变差83006，是未对齐的地址，触发异常
    // 故意触发指令对齐异常
    //在 ARM v8 中，指令通常是 4 字节对齐的
    // 而0x83006不是4的倍数，所以访问的是没有4字节对齐的地址，进而触发对齐异常
    ldr x0, =0x80002
    ldr x1, [x0]
    ret
```

<img src=2026-02-04-22-01-52.png>

<img src=2026-02-04-22-07-56.png>

进一步通过单步调试来查看单步调试到trigger_alignment的时候发生的报错：

<img src=2026-02-04-22-20-58.png>


从上面`x/4i 0x83004`的反汇编结果可以看到，CPU 在执行到`ldr x1, [x0]`这条指令时，触发了对齐异常

按照指令规则，当前应该会执行`0x83004`这条指令，CPU会尝试去执行这条指令，但是由于我们塞了一个`.string "t"`，导致此时 CPU 尝试从`string test`处执行，也就是说，错误地把它当成一条指令来执行了，结果自然就触发了对齐异常。也就是说，内存跑飞了。

进一步地，如果我们想执行`trigger_alignment`函数后不触发异常，可以将`string_test`进行对齐：

```armasm
// entry.S
string_test:		//83004
	.string "t"
	.align 2        //对齐到4字节边界

.global trigger_alignment
trigger_alignment:		
	ldr x0, =0x80002
	ldr x1, [x0]  s
	ret
```


| 情况 | 内存布局 | 执行结果 |
| :--- | :--- | :--- |
| **不加字符串** | `trigger_alignment` 位于 `0x83004` (对齐) | CPU 正常读取 `ldr` 指令，执行成功。 |
| **加了字符串** | `0x83004` 变成了数据 `'t'` | CPU 把数据当指令读，读到非法编码，崩了。 |
| **加了字符串且没对齐** | `trigger_alignment` 位于 `0x83006` | CPU 根本无法从该地址提取指令，直接触发对齐故障。 |
