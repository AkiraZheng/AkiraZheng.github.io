---
title: 'ARM64结构与编程:中断处理'
date: 2026-02-08 19:43:57
tags:
categories:
    - ARM64结构与编程实操
---

# ARM64 中断处理

**CPU 核心**中有一对管理中断的管脚：**IRQ**（普通中断）和 **FIQ**（快速中断）。

关于这两种中断，**PSTATE状态寄存器**中有 **I** 位和 **F** 位分别用于控制 IRQ 和 FIQ 中断的使能状态：
- **I = 1**：IRQ 中断被禁用，CPU 将不会响应 IRQ 中断请求。
- **F = 1**：FIQ 中断被禁用，CPU 将不会响应 FIQ 中断请求。

实际上，当我们在内核进行异常处理的时候，**会自动将 I 和 F 位设置为 1**，也就是在处理异常的过程中会禁止其他中断的发生，以确保当前异常处理的完整性和安全性。

ARM 中，除了 CPU 外，还有一个重要的独立的芯片叫做 **GIC**（Generic Interrupt Controller，**通用中断控制器**），目前已经有gicv4、gicv4.1，gicv4.2了。

- gicv4.0：支持 LPI 直通
- gicv4.1：支持 LPI 直通和 IPI 直通

以树莓派4B为例，树莓派有两个中断控制器，**一种是 legacy，这种是基于寄存器管理的中断控制器**；另一种是 **gic400 的中断控制器**，同一时刻只能使用一种中断控制器（默认使用 gic400）。其中 GIC 负责**管理和分发**来自外设的中断请求到 CPU。GIC 与 CPU 之间通过 IRQ 和 FIQ 管脚进行通信的通用框图如下（GIC v2）：

<img src=2026-02-08-19-59-35.png>

- Distributor - 控制路由：由 `GICD_` 寄存器包含**中断设置和配置**，配置中指明了可以把中断路由到哪个CPU中。负责仲裁和分发中断请求到 CPU。
    - 前32个中断源（SGI 和 PPI）是硬件设置好的，RO
    - 从第32个中断源（SPI）开始是可软件编程配置其路由的，RW
- CPU Interface - 控制中断响应状态：由 `GICC_` 寄存器包含**中断状态和控制**，CPU 通过读取这些寄存器来获取当前的中断状态，并根据需要进行响应。

同样以树莓派为例，它支持以下 IRQ 中断源：

<img src=2026-02-08-20-26-48.png>

# 实验一：仿照出legacy完成时钟中断

简单的中断源，不需要GIC的参与，直接通过legacy中断控制器来处理就行了。

## legacy IRQ 中断路由

legacy 中断控制器分成两部分：`ARM_LOCAL routing`和`ARMC routing`。

以ARM Core IRQs 为例，它会被路由到**Per-Core routing**中，然后到达 Masked IRQn Status 寄存器中，最后通过 Pending 寄存器来判断是哪个中断源被触发了。

<img src=2026-02-08-20-45-50.png>

## 中断状态寄存器

包括`pending0`、`pending1`、`pending2`和`SOURCEn`四个寄存器。

<img src=2026-02-08-20-36-21.png>

结合上面树莓派legacy IRQ 状态寄存器的连接图，可以看到：

1. 比如当 source 寄存器的 bit[8] 被设置成 1 的时候，表示 GPIO0 这个中断源被触发了，那么需要读取 pending2 的寄存器
2. 读 pending2 的时候发现其中的 bit[24] 被置位了，那么我们接下去需要读取 pending0 寄存器，发现其中的 bit[0] 被置位了，那么就说明 GPIO0 这个中断源被触发了。（同理，如果 pending2 的 bit[25] 被置位了，那么需要读取 pending1 寄存器）

# GIC 中断

## 基础

GIC 控制器的版本有很多，常见的有 GIC V1、GIC V2 和 GIC V3（当前已经出到 GIC v4了--26.3.18）：

- GIC V1：支持8核，支持1020个中断源，支持 8 bit优先级，支持软件触发中断。

- GIC V2：虚拟化支持（支持三种中断类型：SGI、PPI、SPI）

- GIC V3：支持CPU核数大于8，支持基于 message 的中断（支持4种中断类型：SGI、PPI、SPI、LPI）

GIC 从 v3 开始就支持 4 种中断类型了，分别是 SGI、PPI、SPI 和 LPI：

- **SGI**（Software Generated Interrupt，软件生成中断）：软件生成中断，用于CPU间通信，**给其他核心发送中断信号**，也称为 **IPI**（Inter-Processor Interrupt，**核心间中断**）。**所有CPU共享一个SGI**。
- **PPI**（Private Peripheral Interrupt，**私有外设中断**）：私有外设中断，每个CPU独有 PPI 中断源。比如 Generic Timer 就是一个典型的 PPI 中断源。**每个CPU对应一个PPI**。
- **SPI**（Shared Peripheral Interrupt，共享外设中断）：由系统中的共享外设触发的中断，多个 CPU 核心可以共享同一个 SPI 中断源。
- **LPI**（Locality-specific Peripheral Interrupt，特定位置外设中断）：是基于**消息传递机制的中断类型**，允许外设根据其与 CPU 的物理位置来触发中断，提供更高效的中断处理方式。

| 中断类型 | 中断号范围 | 主要用途与特点 |
| :--- | :--- | :--- |
| **SGI** | 0-15 | 软件触发的中断。通常用于处理器间通信（IPI，Inter-Processor Interrupts）。一个CPU可以通过写寄存器触发另一个CPU的中断 。 |
| **PPI** | 16-31 | 私有外设中断。这是每个CPU核心独有的中断，只能发给绑定的那个CPU。典型的例子包括每个CPU本地的计时器（Local Timer）和性能监视单元 。 |
| **SPI** | 32-1019 | 共享外设中断。这是最常见的外设中断类型，由GIC分发给某一个CPU进行处理。比如按键、触摸屏、网络控制器等设备触发的中断都属于SPI 。 |
| **LPI** |  8192 起 | 基于消息的中断。这是GICv3引入的全新类型，其配置信息存储在内存表中，而非硬件寄存器中。它通常用于**PCIe MSI/MSI-X**中断，需要配合ITS（Interrupt Translation Service）组件使用，以实现高效、大规模的中断传递 。 |

**LPI的特殊要求:**

LPI（Locality-specific Peripheral Interrupt）是GICv3引入的新型中断机制：

1. **基于消息的信号**：使用**内存写操作**而非物理信号线
2. **需要ITS支持**：Interrupt Translation Service负责中断路由转换
3. **配置存储在内存中**：中断属性表、集合表等**存储在系统内存**
4. **仅支持Group 1**：LPI只能属于中断Group 1
5. **虚拟化需求**：虚拟化环境需要虚拟ITS（vITS）支持


**中断有四种状态：**

- **Pending**：中断请求已经被触发，但还没有被 CPU 处理。
- **Active**：中断正在被 CPU 处理。
- **Inactive**：中断没有被触发，也没有被 CPU 处理。
- **Pending and Active**：CPU正在响应该中断源的中断请求，但是该中断源又发送中断过来。

在软件代码实现中，状态的变化不用软件手动去设置，而是由 GIC 硬件自动根据中断的发生和处理情况来更新的。软件只需要执行完中断处理函数后，向 GIC 的 **EOI（End of Interrupt）寄存器写入中断号**，通知 GIC 中断处理完成，GIC 就会自动更新该中断的状态。

CPU 上 4 种中断状态的状态图如下所示：

<img src=2026-03-18-21-45-21.png>

下面用一张信号图来表示信号的变化流程，其中假设 M 和 N 是中断0和中断1，且 N 的优先级高于 M，M 和 N 都会路由到同一个 CPU，CPU0 上：

<img src=2026-03-18-22-12-38.png>

以路由的GICD寄存器来说，GICD_ITARGETSRn 寄存器中每 8 bit 用于配置一个中断源的路由，也就是一个 32 bits 寄存器可以配置 4 个中断源的路由。会由**一组 GICD_ITARGETSRn 寄存器**配置路由，而不是一个寄存器，可以通过文档中**计算出某个中断源对应的寄存器和位偏移**来配置路由。

## GIC-400为例，介绍初始化流程

1. 设置distributor和CPU interface寄存器组的**基地址**

2. 读取GICD_TYPER寄存器，计算当前**GIC最大支持多少个中断源**。

3. 初始化distributor
    
    ① Disable distributor
    
    ② 设置SPI中断的路由
    
    ③ 设置SPI中断的触发类型，例如level触发
    
    ④ Disactive和disable所有的中断源，因为希望在外设注册中断的时候再去使能，而不是在初始化的时候就把所有的中断源都使能了
    
    ⑤ Enable distributor

4. 初始化CPU interface
    
    ① 设置GICC_PMR，设置中断优先级mask level
    
    ② Enable CPU interface

## 注册中断

1. 初始化外设

2. 查找该外设的中断在GIC-400的中断号，例如PNS timer的中断号为30

3. 设置GIC_DIST_ENABLE_SET寄存器来enable这个中断号

4. 打开设备相关的中断，例如树莓派上的generic timer，需要打开ARM_LOCAL寄存器组中的TIMER_CNTRL0寄存器中相关的enable位。

5. 打开CPU的PSTATE中位（PSTATE.I）

## 中断响应

1. 中断发生

2. 异常向量表

3. 跳转到GIC中断函数里，gic_handle_irq()

4. 读取**GICC_IAR**寄存器，获取中断号

5. 根据中断号来进行相应中断处理，例如读取的中断号为30，说明是PNS的generic timer，然后跳转到 generic timer的处理函数里。

# 实验二：GIC 实现generic timer中断

实现要求：初始化 GIC-400 控制器 -> 为 generic timer 注册中断 -> 触发 generic timer 中断 -> 响应 generic timer 中断（打印 "Core 0 Interrupt: Hello, world!"）

## GIC 相关的寄存器

在`include/arm-gic.h`中定义了 GIC-400 的相关寄存器，这些寄存器的地址都是相对于 GIC 的基地址的偏移地址，含义如下：

一、CPU Interface 寄存器组（GIC_CPU_ 开头）

CPU Interface 是每个 CPU 核心独立拥有的接口，用于控制中断的响应、优先级和完成。

- **GIC_CPU_CTRL** (0x00): 控制寄存器：用于启用/禁用 CPU Interface，以及控制中断信号的行为。
- **GIC_CPU_PRIMASK** (0x04): 优先级屏蔽寄存器：设置当前 CPU 允许处理的最低中断优先级。只有优先级高于此值的中断才能被响应。
- **GIC_CPU_BINPOINT** (0x08): 优先级分组寄存器：用于将优先级位拆分为抢占优先级和子优先级，决定中断抢占的粒度。
- **GIC_CPU_INTACK** (0x0c): 中断响应寄存器：读取该寄存器可获取当前待处理中断的中断号，同时表示 CPU 开始处理该中断。
- **GIC_CPU_EOI** (0x10): 中断结束寄存器：写入中断号通知 GIC 中断处理完成，GIC 可清除该中断的 active 状态。
- **GIC_CPU_RUNNINGPRI** (0x14): 当前运行优先级：只读，表示当前 CPU 正在处理的中断的优先级。
- **GIC_CPU_HIGHPRI** (0x18): 最高待处理优先级：只读，表示当前 CPU 上最高优先级的待处理中断的优先级。
- **GIC_CPU_ALIAS_BINPOINT** (0x1c): 别名分组寄存器：在某些安全模式下使用的备用优先级分组配置。
- **GIC_CPU_ACTIVEPRIO** (0xd0): 活动优先级寄存器组：记录当前 CPU 上所有 active 的中断的优先级（GICv2 架构特有）。
- **GIC_CPU_IDENT** (0xfc): 标识寄存器：只读，用于识别 CPU Interface 的版本和实现 ID。

CPU Interface 相关的常量定义：

- **GICC_ENABLE** (0x1): 启用 CPU Interface 的位掩码
- **GICC_INT_PRI_THRESHOLD** (0xf0): 默认的中断优先级阈值（只允许优先级 >= 0xf0 的中断通过）
- **GICC_IAR_INT_ID_MASK** (0x3ff): 用于从 IAR 寄存器读取的中断号中提取低 10 位（0-1023）
- **GICC_INT_SPURIOUS** (1023): 伪中断号，当读取 IAR 时返回此值表示没有有效中断
- **GICC_DIS_BYPASS_MASK** (0x1e0): 禁用旁路模式的掩码（用于配置信号直通模式）

二、Distributor 寄存器组（GIC_DIST_ 开头）

Distributor 负责全局中断的管理，包括中断的使能、优先级、路由等配置。

- **GIC_DIST_CTRL** (0x000): 控制寄存器：全局启用/禁用 Distributor
- **GIC_DIST_CTR** (0x004): 类型寄存器：只读，提供 GIC 支持的中断线数量、CPU 接口数量等信息
- **GIC_DIST_IGROUP** (0x080): 中断组寄存器：配置中断属于 Group 0（安全）还是 Group 1（非安全）
- **GIC_DIST_ENABLE_SET** (0x100): 中断使能设置寄存器：向该寄存器写入 1 可启用对应中断
- **GIC_DIST_ENABLE_CLEAR** (0x180): 中断使能清除寄存器：向该寄存器写入 1 可禁用对应中断
- **GIC_DIST_PENDING_SET** (0x200): 中断挂起设置寄存器：软件可向该寄存器写入 1 来触发一个中断
- **GIC_DIST_PENDING_CLEAR** (0x280): 中断挂起清除寄存器：清除中断的 pending 状态
- **GIC_DIST_ACTIVE_SET** (0x300): 中断活跃设置寄存器：手动将中断标记为 active（通常由硬件自动设置）
- **GIC_DIST_ACTIVE_CLEAR** (0x380): 中断活跃清除寄存器：手动清除 active 状态
- **GIC_DIST_PRI** (0x400): 优先级寄存器：为每个中断配置优先级（每 8 位一个中断）
- **GIC_DIST_TARGET** (0x800): 目标 CPU 寄存器：配置 SPI 中断可以路由到哪些 CPU（位图表示）
- **GIC_DIST_CONFIG** (0xc00): 配置寄存器：配置中断的触发类型（电平触发或边沿触发）
- **GIC_DIST_SOFTINT** (0xf00): 软件触发中断寄存器：写入该寄存器可触发 SGI，指定目标 CPU 和中断号
- **GIC_DIST_SGI_PENDING_CLEAR** (0xf10): SGI 挂起清除寄存器：清除特定 SGI 的 pending 状态
- **GIC_DIST_SGI_PENDING_SET** (0xf20): SGI 挂起设置寄存器：设置特定 SGI 的 pending 状态

Distributor 相关的常量定义：

- **GICD_ENABLE** (0x1): 启用 Distributor 的位掩码
- **GICD_DISABLE** (0x0): 禁用 Distributor 的值
- **GICD_INT_ACTLOW_LVLTRIG** (0x0): 配置中断为低电平有效
- **GICD_INT_EN_CLR_X32** (0xffffffff): 一次性禁用 32 个中断的掩码（全 32 位置 1）
- **GICD_INT_EN_SET_SGI** (0x0000ffff): 用于设置 SGI（0-15 号中断）的使能位
- **GICD_INT_EN_CLR_PPI** (0xffff0000): 用于清除 PPI（16-31 号中断）的使能位
- **GICD_INT_DEF_PRI** (0xa0): 默认的中断优先级值（0xa0，较低优先级）

三、其中，SGI（0-15）、PPI（16-31）、SPI（32 以上） 在这些寄存器中的处理方式不同：

- GICD_INT_EN_SET_SGI 专门用于操作 SGI 中断（低 16 位）

- GICD_INT_EN_CLR_PPI 专门用于操作 PPI 中断（高 16 位）

- 优先级值：GIC 中优先级值越小，优先级越高。0xa0 是中等偏低的优先级。

- 寄存器访问：大部分寄存器是 banked 的，即每个 CPU 看到的内容可能不同（特别是 PPI 和 SGI 相关的配置）。

- GICD_INT_ACTLOW_LVLTRIG：表示电平触发且低电平有效，这是 GIC-400 的默认配置。

## 初始化

```c
int gic_init(int chip, unsigned long dist_base, unsigned long cpu_base)
{
    struct gic_chip_data *gic;
    int gic_irqs;
    int virq_base;

    gic = &gic_data[chip];

    /* 1. 初始化基地址 */
    gic->raw_dist_base = dist_base;
    gic->raw_cpu_base = cpu_base;

    /* 2. 计算 GIC 支持的中断数量 */
    gic_irqs = readl(gic_dist_base(gic) + GIC_DIST_CTRL) & 0x1f; //0x1f 是 GICD_TYPER 寄存器的前 5 位，表示支持的中断数量
    gic_irqs = (gic_irqs + 1) * 32; // 每个 GICD_TYPER 寄存器表示支持 32 个中断，所以需要加 1 后乘以 32 才能得到实际支持的中断数量
    if (gic_irqs > 1020) // GICv2 最大支持 1020 个中断
        gic_irqs = 1020;
    gic->gic_irqs = gic_irqs;

    printk("%s: cpu_base:0x%x, dist_base:0x%x, gic_irqs:%d\n",
                       __func__, cpu_base, dist_base, gic->gic_irqs);

    /* 3. 初始化 GIC 分发器 */
    gic_dist_init(gic);
    /* 4. 初始化 GIC CPU interface */
    gic_cpu_init(gic);

    return 0;
}
```

1. 设置distributor和CPU interface寄存器组的**基地址**

```c
/* GIC V2*/
#define GIC_V2_DISTRIBUTOR_BASE     (ARM_LOCAL_BASE + 0x00041000)
#define GIC_V2_CPU_INTERFACE_BASE   (ARM_LOCAL_BASE + 0x00042000)
```

2. 读取GICD_TYPER寄存器，计算当前**GIC最大支持多少个中断源**。

```c
    /* 2. 计算 GIC 支持的中断数量 */
    gic_irqs = readl(gic_dist_base(gic) + GIC_DIST_CTRL) & 0x1f; //0x1f 是 GICD_TYPER 寄存器的前 5 位，表示支持的中断数量
    gic_irqs = (gic_irqs + 1) * 32; // 每个 GICD_TYPER 寄存器表示支持 32 个中断，所以需要加 1 后乘以 32 才能得到实际支持的中断数量
    if (gic_irqs > 1020) // GICv2 最大支持 1020 个中断
        gic_irqs = 1020;
    gic->gic_irqs = gic_irqs;

```

通过在`GIC_DIST_CTRL`寄存器中读取前 5 位（0x1f）来获取支持的中断数量，然后根据 GIC 的设计，每个寄存器块支持 32 个中断，所以需要加 1 后乘以 32 来计算实际支持的中断数量。最后还要检查是否超过 GICv2 的最大限制（1020 个中断）。

3. 初始化distributor
    
    ① Disable distributor
    
    ② 设置SPI中断的路由
    
    ③ 设置SPI中断的触发类型，例如level触发
    
    ④ Disactive和disable所有的中断源，因为希望在外设注册中断的时候再去使能，而不是在初始化的时候就把所有的中断源都使能了
    
    ⑤ Enable distributor

```c
static void gic_dist_init(struct gic_chip_data *gic)
{
       unsigned long base = gic_dist_base(gic);
       unsigned int cpumask;
       unsigned int gic_irqs = gic->gic_irqs;
       int i;

       /* 关闭中断*/
       writel(GICD_DISABLE, base + GIC_DIST_CTRL);

       /* 设置中断路由：GIC_DIST_TARGET
        *
        * 前32个中断(SGI/PPI)怎么路由是GIC芯片固定的，因此先读GIC_DIST_TARGET前面的值
        * 然后全部填充到 SPI的中断号 */
       cpumask = gic_get_cpumask(gic);
       cpumask |= cpumask << 8;
       cpumask |= cpumask << 16;

       for (i = 32; i < gic_irqs; i += 4)
               writel(cpumask, base + GIC_DIST_TARGET + i * 4 / 4);

       /* 设置低电平触发 */
       for (i = 32; i < gic_irqs; i += 16)
               writel(GICD_INT_ACTLOW_LVLTRIG, base + GIC_DIST_CONFIG + i / 4);

       /* Deactivate and disable all 中断（SGI， PPI， SPI）.
        *
        * 当注册中断的时候才 enable某个一个SPI中断，例如调用gic_unmask_irq()*/
       for (i = 0; i < gic_irqs; i += 32) {
               writel(GICD_INT_EN_CLR_X32, base +
                               GIC_DIST_ACTIVE_CLEAR + i / 8);
               writel(GICD_INT_EN_CLR_X32, base +
                               GIC_DIST_ENABLE_CLEAR + i / 8);
       }

       /*打开SGI中断（0～15），可能SMP会用到，所以初始化会默认打开*/
       writel(GICD_INT_EN_SET_SGI, base + GIC_DIST_ENABLE_SET);

       /* 打开中断：Enable group0 and group1 interrupt forwarding.*/
       writel(GICD_ENABLE, base + GIC_DIST_CTRL);
}
```

## 注册使能某个中断源

```c
static void gic_set_irq(int irq, unsigned int offset)
{
    // 根据芯片手册，GICD_ISENABLER 寄存器每 32 位对应一个中断的使能位，因此需要计算出对应的寄存器地址和位位置
    unsigned int mask = 1 << (irq % 32);

    writel(mask, gic_get_dist_base() + offset + (irq / 32) * 4);
}
void gicv2_unmask_irq(int irq)
{
       gic_set_irq(irq, GIC_DIST_ENABLE_SET);
}

//gicv2_unmask_irq(GENERIC_TIMER_IRQ);
```

通过调用 `gic_set_irq` 函数并传入 `GIC_DIST_ENABLE_SET` 来使能指定的中断号（例如 `GENERIC_TIMER_IRQ`）。这个函数会根据中断号计算出对应的寄存器和位偏移，然后向相应的寄存器写入值来启用该中断。

## 中断响应

异常向量：

中断向量表的设计可以查看之前的博客[六、异常向量表+实验二：实现同步异常处理](https://akirazheng.github.io/2026/01/11/ARM64%E7%BB%93%E6%9E%84%E4%B8%8E%E7%BC%96%E7%A8%8B-%E5%BC%82%E5%B8%B8%E5%A4%84%E7%90%86/)

```c
//异常向量表在 vectors 变量中，其中el1_irq会指向el1_irq汇编处理函数
el1_irq:
        /*把中断现场时的lr寄存器保存到栈顶里，
	  否则调用kernel_entry函数来保存中断现场，lr寄存器已经被破环

	  这里先让sp减去8，然后保存 lr到 sp-8的地方
	 */
	str x30, [sp, -8]!
	bl kernel_entry
	bl irq_handle //会调用gic_handle_irq函数来处理GIC具体的中断

	/* 注意在kernel_exit函数里，需要把 刚才保存在sp-8的lr寄存器恢复*/
	bl kernel_exit
```

中断处理：

```c
/* 中断处理函数 */
void gic_handle_irq(void)
{
       struct gic_chip_data *gic = &gic_data[0];
       unsigned long base = gic_cpu_base(gic);
       unsigned int irqstat, irqnr;

       /* 中断处理 */
       do {
            irqstat = readl(base + GIC_CPU_INTACK);
            irqnr = irqstat & GICC_IAR_INT_ID_MASK;

            /* 读取 GICC_IAR 寄存器，获取中断号
            *  并根据中断号处理对应的中断，例如如果是 GENERIC_TIMER_IRQ timer中断 就调用 handle_timer_irq() 函数处理定时器中断
            *  最后调用 gicv2_eoi_irq() 函数向 GICv2 发送 End of Interrupt (EOI) 信号，告诉 GICv2 中断处理完成，可以继续处理下一个中断
            */
            if (irqnr == GENERIC_TIMER_IRQ)
                    handle_timer_irq();

            gicv2_eoi_irq(irqnr);

       } while (0);

}
```

通过读取 `GICC_IAR` 寄存器来获取当前待处理的中断号，然后根据中断号调用相应的处理函数（例如 `handle_timer_irq()`）。处理完成后，调用 `gicv2_eoi_irq()` 向 GICv2 发送 End of Interrupt (EOI) 信号，通知 GIC 中断处理完成，可以继续处理下一个中断。


## debug

由于使用的是`CONFIG_BOARD_PI3B`，在gic init的时候就炸了，触发异常：

```
kernel_main
 └── gic_init()
       └── readl(0x40041000)  <- 这里炸了
```

CPU执行 readl() 时：

- 访问了非法地址 0x40041000

- MMU / 总线返回 abort

- 立即触发 synchronous exception

原因是 gic_init() 访问了 Pi3 不存在的 GIC 寄存器，导致访问非法地址触发异常。现象如下：

```shell
Bad mode for Sync Abort, far:0x40041000, esr:0x0000000096000010 - DABT (current EL)    
ESR info:                                                                              
  ESR = 0x96000010                                                                     
  Exception class = DABT (current EL), IL = 32 bits                                    
  Data abort:                                                                          
  SET = 0, FnV = 0                                                                     
  EA = 0, S1PTW = 0                                                                    
  CM = 0, WnR = 0                                                                      
  DFSC = <NULL>  
```

所以在写的代码中，通过`ifndef CONFIG_BOARD_PI3B`来避免在 Pi3B 上执行 GIC 初始化代码，也就是这部分GIC功能只在 Pi4B 上启用。

科普：

树莓派4（Raspberry Pi 4）支持并使用 ARM GIC-400 通用中断控制器。它是 BCM2711 芯片组的一部分，负责管理基于 Cortex-A72 处理器的系统中的中断。

树莓派3（Raspberry Pi 3）使用的Broadcom BCM2837 SoC（基于ARM Cortex-A53核心）主要依赖于其自定义的传统中断控制器，不支持通用的ARM GIC-400架构。虽然它具有通用中断控制器（GIC）的功能，但并非GIC-400系列硬件。