---
title: TLB特性学习
date: 2025-09-02 15:20:52
tags:
---

# 一、TLB 管理

## 1.1 为什么需要TLB？

在处理器中，需要MMU内存管理来将**虚拟地址翻译成物理地址**，在这个过程中，需要访问页表，而**页表实际是存储在主内存中**，所以一次页表查询需要多次访问内存（n级页表访问n次），当多次访问同一个地址时会不断访问内存导致处理器长时间延迟。

因此可以泳**高速缓存**的思想，将地址映射结果进行缓存，而该缓存我们使用**TLB 快表**。TLB 用于缓存已经翻译好的**页表项**，在进行虚拟地址翻译时，当TLB命中时直接取TLB的结果，当TLB未命中时，MMU进行一次地址查询，然后将页表项结果存入 TLB 缓存中。

TLB 一般内嵌在 MMU 内部（MMU通常会包含一个TLB，在虚拟化中可以实现虚拟机与物理机之间的隔离和映射--两阶段映射）。

## 1.2 TLB 高速缓存的命中流程

虚拟地址一般包含`VPN`虚拟地址页帧号和`页内偏移量`，同时物理地址包含有`PFN`物理页号，因此要实现一一对应的话，要求TLB存有匹配的`VPN-PFN`

现代TLB映射方式通常有三种方式：
- 直接映射
- 全相连映射
- 组相连映射

其中现代处理器采用最多的是**组相连映射**方式，在一个**n路组相连 TLB 中，一组包含n个TLB项**，需要虚拟地址中增加一个**索引域**来找到对应的**组**

当在 TLB 中命中后，由**物理页号PFN + 虚拟地址中的 页内偏移量**可以得到最终的物理地址；该物理地址送到**PIPT映射方式的高速缓存**中，若命中则直接处理该数据。

结合上述流程，可以得到整个TLB命中流程如下图所示：

<img src="./picture/TLB命中流程.png">

## 1.3 TLB重名和同名问题

**1）重名问题**

重名问题是指**多个进程的不同虚拟地址映射到同一个物理地址**
- 结论：TLB不会出现重名问题

重名问题举例：（以Cache数据缓存为例）

假设
- 进程1的VA1虚拟地址 映射 到 PA 物理地址
- 进程2的VA2虚拟地址 映射 到 PA 物理地址

此时两个虚拟地址中存的数据Data都在各自的Cache中有缓存过，此时若在进程1中通过VA1对实际物理地址PA处的数据做了修改，那么重名的进程2的缓存中并没有更新该缓存，因此存的还是旧数据，就出现了重名问题。关于Cache的重名问题如下图所示：

<img src="./picture/Cache重名问题示意图.png">

而TLB中存的是**标记+物理页号PFN**，也就是**VA到PA的映射关系**，而不是数据，PA物理地址不变，因此TLB中不会出现重名问题（进程1的操作不影响进程2的地址映射关系）


**2）同名问题**

同名问题是指**多个进程中同个虚拟地址映射到不同的物理地址中**
- 结论：TLB会出现同名问题

同名问题举例：（以TLB地址映射为例）

假设
- 进程1中的VA 映射到 PA1物理地址
- 进程2中的VA 映射到 PA2物理地址

此时如果出现**进程1切换到进程2**的操作，如果TLB没有更新，那么会出现TLB中存的映射关系依然为**VA->PA1**，此时进程2如果需要寻VA地址对应的物理地址，就会从TLB中命中取出**PA1**这个地址，因此会出现错误。关于TLB同名问题如下图所示：

<img src="./picture/TLB同名问题示意图.png">

因此说明TLB会出现同名问题，此时的解决办法是切换进程时清除当前所有的TLB项，保证不影响下一个进程的映射。但是这样会导致下一个进程完全没有映射的缓存，导致刚开始执行时的性能大幅下降。因此ARMv8提出了一种硬件解决方法---ASID方案。

**3）ASID方案**

ASID方案是新增一个ASID值来标识某个进程，这样TLB表就可以通过同时匹配**ASID+虚拟地址标记**来唯一确定某个进程的某个地址的映射。

ASID不等同于进程唯一表示ID，而是存在页表基地址寄存器`TTBR0_EL1`或`TTBR1_EL1`中，由转换控制寄存器`TCR`来确定在哪个寄存器中进行配置的，当**切换进程**时，需要把该进程持有的ASID加载进`TTBR1_EL1`中。

- 进程中的标识：而ASID一般为`8 or 16`位，用于标识某个进程。
    - 由于每个进程会有自己的`TTBR`配置信息，当进程切换回来时，会从内核中恢复装载该进程的TTBR信息，因此当切换为某个进程时，会更新该进程的TTBR信息到处理器的寄存器中。
    - 当创建新进程时，会通过**位图机制**分配一个ASID给该进程。
- TLB中的标识：在TLB每项中也加上对于进程的ASID标志，每次确认是否命中时，会跟当前`TTBR`寄存器中的ASID值进行匹配，只有当ASID值以及虚拟地址的虚拟页表号VPN标识都匹配时，才算命中。

通过上述流程就可以避免每次切换进程都刷新所有TLB表。**只有当ASID被分配完了，这时才需要刷新全部的TLB来重新分配ASID**。

同时，为了防止CPU熔断漏洞攻击出现CPU熔断问题，ARM采用了`KPTI`方案，将 TLB 也分为用户态表和内核态表，同时给每个进程分匹配**奇数+偶数**两个`ASID`
- **用户态时用奇数ASID来访问TLB**
- **内核态时用偶数ASID来访问TLB**

这样就可以防止攻击者在用户态 trap 进内核态并更新内核态的页表到 TLB 后，回到用户态可以利用 ASID 访问内核态地址空间的问题。

**在虚拟化中，有一个类似的方案，是在TLB表项中加入VMID来进行标识。**

## 1.5 ARMv8架构下高速缓存Cache共享域一致性

ARM 根据数据共视范围可分为 4 个共享域，**在存在共享域的范围内，所有可访问的硬件都要做好缓存一致性**：
- 不可共享域：`L1 Cache`，单个**CPU 核独享**的，不需要确保一致性
- 内部共享域：`L2 Cache`，单个**CPU 处理器多核之间共享**的，需要确保内部共享域一致性
- 外部共享域：`L3 Cache`，**多个CPU 处理器之间共享**的，需要确保外部共享域一致性
- 系统共享域：**所有设备（硬件单元）共享**的，如CPU、GPU、DMA、NPU等，需要确保系统共享域一致性

其中，针对各个共享域通常有两种协议可以保证共享域缓存的一致性：`MESI`协议和`AMBA`协议。
- 其中`MESI`协议是纯硬件实现的，只适合处理**内部共享域一致性**问题
- 而`AMBA`协议对**所有共享域的一致性问题**都有效，其中`ACE`协议是`AMBA`协议的一种。在跨 CPU 处理缓存一致性问题时，通常通过**广播**方式通知其他 CPU 进行缓存更新。

<img src="./picture/ARMv8架构下高速缓存Cache共享域划分.png">



## 1.6 虚拟化场景下两阶段映射的页表项

KVM 是 Linux 内核中的一部分，KVM 可将 Linux 转变为 hypervisor，使主机计算机能够运行多个隔离的虚拟环境(VM)，主要实现对 **CPU** 和 **内存** 二者的虚拟化，KVM 存在 type2 Hypevisor ：
- type1 hypervisor: 直接控制硬件资源和客户机；没有宿主OS；

- type2 hypervisor: Hypervisor运行在宿主机操作系统之上，**Hypervisor只是宿主机操作系统的一个应用程序**；宿主OS完全控制硬件和资源(CPU,内存等)。

而 QEMU 是虚拟化的用户态部分，为每个 VM 虚拟机创建一个线程，针对每个 vCPU 创建一个线程，Guest OS/应用运行在vCPU上；模拟I/O功能。KVM是内核模块，初始化CPU硬件，打开虚拟化模式；通常不负责I/O。两者的关系如下图所示：

<img src="./picture/虚拟化KVM和QEMU.png">

<img src="./picture/虚拟化KVM和QEMU的等级关系.png">

其中，为了实现对虚拟机内存的隔离与保护，ARM的SMMU中使用了两阶段页表，在 Stage2 中允许 hyervisor 控制虚拟机的内存试图、控制虚拟机可以访问哪些内存映射的系统资源，从而实现虚拟机间的隔离。而 Stage1 则是虚拟机内部的页表映射，具体如下图所示：

<img src="./picture/SMMU两阶段页表.png">

两阶段页表可以粗略理解为下面的过程：

<img src="./picture/TLB两阶段页表.PNG">

如上图所示，stage 1可以理解为**guest 虚拟地址 -> guest 物理地址的映射**（其中的物理地址是客户机自认为的），stage 2可以理解为**guest 物理地址 -> 实际宿主机 host 的物理地址**（真实的物理地址）。因此可以清晰地看出，就算没有guest，stage 2也是一直存在的

通过配置`VMID`可以实现跟非虚拟化下类似于`ASID`的隔离功能
- `ASID`隔离标识各个进程
- `VMID`隔离各个虚拟机 `VM`


## 1.6 TLB管理指令：刷新TLB-维护TLB一致性

内存一致性是由`DMB、DSB、ISB`三个指令来保证的，其中ISB可以解决页表不一致问题，相应地，对于TLB而言，当PTE页表失效or被修改时，也要确保TLB跟PTE的一致性。

为了防止在 PTE 被修改后，旧的 TLB 被指令先预取了，导致出现最后找到错误的物理地址的问题，因此在修改 PTE 时必须严格遵循以下顺序来刷新与他对应的缓存：
1. 先刷新 `TLB` 缓存
2. 再修改 `PTE` 页表

由于`TLBI`指令在内存执行次序上没有特权，也就是依然有可能会被乱序执行，因此需要通过**内存屏障指令**来维护TLB执行次序：

- 单处理核中用：`DSB NSH`
- 多核中用：`DSB ISH`

对于 TLB 的清除，ARMv8 中通过指令 `TLBI` 来实现，其中 `TLBI` 指令的格式如下：

```armasm
TLBI <type><level> {IS/OS}  {<Xt>}
```

其中各项的说明如下：

- type：可以选择删除哪些 TLB 项，如可以选择删除整个 TLB，也可以与`VMID`、`ASID`配合，指定清除某些 TLB 项（因此可以清除虚拟机的，也可以清除host的）
    - 使所有 TLB 项失效的类型：`ALL`、`VMALL`、`VALLS12`
        - `ALL`
        - `VMALL`（针对虚拟化的），只失效当前 guest 的 stage 1 页表转换阶段一
        - `VMALLS12`（针对虚拟化的）：失效当前 stage 1 和 stage 2 页表转换两阶段
    - 使`ASID`对应的**某一个** TLB 项失效：`VA`
        - 同时`Xt`中需要指定**虚拟地址+ASID**
    - 使`ASID`对应的**所有** TLB 项失效：`ASID`
        - 同时`Xt`中需要指定`ASID`
- level：指定失效的地址空间层级（如E1、E2、E3），对应ARM的异常级别（EL0/EL1/EL2/EL3）
    - `ALLE1`：EL1和EL0的所有TLB条目无效化
    - `VALE2`：EL2的虚拟地址VA的最后一级的TLB无效化
- {IS/OS}：Inner Shareable（可选），确定 TLB 清除指令广播的范围
    - `IS`：广播到**内部共享**范围内的所有 CPU 核心
    - `OS`：广播到**外部共享**范围内的所有 CPU 核心
    - 默认不选：只影响当前核心，不广播
- Xt：输入寄存器（可选），用于传递参数，由64位组成，可以同时传递如**ASID、TTL（指定哪一级别的页表）、虚拟地址**等。

通过配合`TLBI`指令+`IS/OS`能实现 TLB 表清除的广播通知，TLB广播机制是为了确保**多核间 TLB 保持一致性**，只有当所有收到广播的CPU完成了TLB的维护操作。

ARM架构中`TLBI`的广播范围分为`IS`和`OS`，如下所示：

<img src="./picture/TLBI广播范围.png">

其中，一个Core中有L1 和 L2 TLB，每个Core内都维护着 TLB 表，而进程每次被cpu调度回来时可能不定地被调度到某个pCPU中，因此一个进程可能在多个pCPU的 TLB 表留下痕迹，最终导致在进行 TLB 表更新时需要TLBI广播到其他Core中。

<img src="./picture/Cortex-A72处理器内部体系结构.png">

## 1.7 常见需要 TLB 刷新的场景

软件(OS)对于TLB的控制只有一种方式：TLB刷新(flush)，即使TLB失效。失效后，需要重新通过页表进行地址转换，同时会生成相应的新的TLB entry。

TLB刷新会带来一定的性能损失，但当页表被修改时，或发生进程切换时，由于原有TLB中缓存的内容已经失效，此时必须通过软件触发TLB刷新操作。

- 进程/虚拟机上下文切换
    - 进程切换：针对`ASID`无效化处理：

      ```armasm
      // 假设 X0 存储新进程的 ASID（地址空间 ID）
      TLBI ASIDE1, X0    // 无效化当前核的旧 ASID 对应的 TLB 条目
      DSB ISH            // 数据同步屏障，确保 TLBI 完成
      ISB                // 指令同步屏障，保证后续指令使用新页表
      ```
    - Hypervisor 切到 Guest时，需要无效化 stage 2页表

      ```armasm
      TLBI ALLE2          // 无效化所有 Stage-2 TLB（针对当前 VMID）
      DSB ISH
      ```
- 当内核自己动态更新页表时，例如**重新映射内核内存**、**添加新页面**或**更改访问权限**时

    ```armasm
    TLBI VAAE1IS, X0  // X0 存储需无效化的虚拟地址，且广播到内部共享域
    DSB ISH
    ```

    - 例如：内存分配/释放（如 `mmap/munmap`）
    - 例如：调整内存权限（如 `mprotect` 设置只读→可写）
    - 用`flush_tlb_kernel_range`：清除内核态的一段范围内的地址空间

- 虚拟化场景（KVM/QEMU）
    - Guest 内部修改页表后，Hypervisor 需确保 Host TLB 的一致性更新（stage 1修改后，需要更新stage 2的相关TLB）
      ```armasm
      TLBI IPAS2E1, X0    // X0 存储 Guest 物理地址（GPA）
      DSB ISH
      ```
    - 迁移过程中，目标 Host 需无效化旧 TLB 以加载新物理页映射。（无效化目标 host stage 2的所有 TLB）
      ```armasm
      TLBI ALLE2          // 无效化所有 Stage-2 TLB
      DSB ISH
      ```

# 二、TLB 相关的代码学习

## 2.1 tlbflush.h TLB表项刷新方法

armv8.4 支持 TLBI特性，相比原始的 TLB 刷新方法，TLBI 特性支持一种指令集批量处理地址刷新方法，性能更高，但是需要硬件支持。源码中提供了 TLBI 刷新方法，具体实现在 tlbflush.h 中。

在 Linux 中，与 TLB 清空相关的宏都在 `arch/arm64/include/asm/tlbflush.h` 文件中定义。在汇编层面，一个简易的 TLB 清空示例如下：

   ```armasm
    TLBI IPAS2E1, X0    // X0 存储 Guest 物理地址（GPA），广播到内部共享域
    DSB ISH             // 数据同步屏障，确保 TLBI 完成
   ```

在 linux 源码中，所有的 TLB flush 操作遵循下面的标准流程（模版）：

```c
 *	DSB ISHST	// Ensure prior page-table updates have completed
 *	TLBI ...	// Invalidate the TLB
 *	DSB ISH		// Ensure the TLB invalidation has completed
 *      if (invalidated kernel mappings)
 *		ISB	// Discard any instructions fetched from the old mapping
```

1. DSB ISHST：确保之前的页表更新已经完成
2. TLBI ...：根据前面提及的各级别 TLB 缓存级别及对应的广播范围，进行 TLB 清除
3. DSB ISH：确保 TLB 广播清除已经完成
4. 可选 ISB：如果有内核映射的失效，还需要 ISB 指令丢弃旧映射下可能已预取的指令

其中，TLB flush 提供的核心接口有：

- `flush_tlb_all`: 失效所有CPU上的全部TLB
- `flush_tlb_mm`: 失效指定ASID的用户空间TLB
- `flush_tlb_range`: 失效指定虚拟地址区间的TLB
- `flush_tlb_kernel_range`: 针对内核映射的区间失效
- `flush_tlb_page`: 失效单个用户页表项

这些函数是内核内存管理的关键接口，确保虚拟地址空间的变更能被所有CPU及时感知。

### 2.1.1 针对 VMID 的 TLB 失效

通过修改`__tlbi(op);`里面的`op`参数，可以指定失效的TLB类型。

- `local_flush_tlb_all`: `VMALLE1`没有指定广播范围，因此在当前 VMID 下，使当前 cpu 下的 E1 级的所有 TLB 失效，这里仅仅包括虚拟化场景下阶段 1 的 TLB

    ```c
    static inline void local_flush_tlb_all(void)
    {
        dsb(nshst);
        __tlbi(vmalle1);
        dsb(nsh);
        isb();
    }
    ```

- `flush_tlb_all`:`VMALLE1IS`指定广播范围，因此，在当前 VMID 下，使所有 CPU 中 E1 级的 TLB 失效，这里包括虚拟化场景下阶段 1 和 2 的 TLB

    ```c
    static inline void flush_tlb_all(void)
    {
        dsb(ishst);
        __tlbi(vmalle1is);
        dsb(ish);
        isb();
    }
    ```

### 2.1.2 针对 ASID 的 TLB 失效

- `flush_tlb_mm`: `ASIDE1IS`
  - 级别：E1
  - 指定广播范围：IS 共享域所有 CPUs
  - 作用：会使所有 cpu 中 EL1 包含的 所有关于 ASID 这个进程的 TLB 失效

  为了获取表示当前进程的 ASID，方法中传入的进程的 `mm_struct` 结构体指针（进程的内存描述符），该结构体中保存了进程的 ASID。
    
    `__tlbi`对内核态中的 TLB 进行失效操作
    
    `__tlbi_user`对用户态中的 TLB 进行失效操作
    
    ```c
    static inline void flush_tlb_mm(struct mm_struct *mm)
    {
        unsigned long asid;
    
        dsb(ishst);
        asid = __TLBI_VADDR(0, ASID(mm));
        __tlbi(aside1is, asid);
        __tlbi_user(aside1is, asid);
        dsb(ish);
    }
    ```

- `flush_tlb_page_nosync`:`VALE1IS`
    - 级别：E1
    - 指定广播范围：IS 共享域所有 CPUs
    - 指定虚拟地址：虚拟地址域 vma 下的 uaddr 地址
    - 作用：会使所有 cpu 中 EL1 的关于 ASID 这个进程的 指定虚拟地址 的 TLB 失效

    ```c
    static inline void flush_tlb_page_nosync(struct vm_area_struct *vma,
                         unsigned long uaddr)
    {
        unsigned long addr;
    
        dsb(ishst);
        addr = __TLBI_VADDR(uaddr, ASID(vma->vm_mm));
        __tlbi(vale1is, addr);
        __tlbi_user(vale1is, addr);
    }
    ```

    一般使用`flush_tlb_page`函数来调用上面的`flush_tlb_page_nosync`进行刷新，确保在结束时进行`dsb`同步屏障

    ```c
  static inline void flush_tlb_page(struct vm_area_struct *vma,
				  unsigned long uaddr)
    {
    flush_tlb_page_nosync(vma, uaddr);
    dsb(ish);
    }
    ```

- `__flush_tlb_range`:
    - 级别：E1
    - 指定广播范围：IS 共享域所有 CPUs
    - 指定虚拟地址：虚拟地址域 vma 下 指定范围[start, end]内 的 uaddr 地址
    - 作用：指定虚拟内存区域（vm_area_struct）内失效（刷新）一段地址范围的TLB条目

    ```c
    static inline void __flush_tlb_range(struct vm_area_struct *vma,
				     unsigned long start, unsigned long end,
				     unsigned long stride, bool last_level,
				     int tlb_level)
    {
    int num = 0;
    int scale = 0;
    unsigned long asid, addr, pages;
    
        start = round_down(start, stride);
        end = round_up(end, stride);
        pages = (end - start) >> PAGE_SHIFT;
    
        /*
         * When not uses TLB range ops, we can handle up to
         * (MAX_TLBI_OPS - 1) pages;
         * When uses TLB range ops, we can handle up to
         * (MAX_TLBI_RANGE_PAGES - 1) pages.
         */
        if ((!system_supports_tlb_range() &&
             (end - start) >= (MAX_TLBI_OPS * stride)) ||
            pages >= MAX_TLBI_RANGE_PAGES) {
            flush_tlb_mm(vma->vm_mm);
            return;
        }
    
        dsb(ishst);
        asid = ASID(vma->vm_mm);
    
        /*
         * When the CPU does not support TLB range operations, flush the TLB
         * entries one by one at the granularity of 'stride'. If the the TLB
         * range ops are supported, then:
         *
         * 1. If 'pages' is odd, flush the first page through non-range
         *    operations;
         *
         * 2. For remaining pages: the minimum range granularity is decided
         *    by 'scale', so multiple range TLBI operations may be required.
         *    Start from scale = 0, flush the corresponding number of pages
         *    ((num+1)*2^(5*scale+1) starting from 'addr'), then increase it
         *    until no pages left.
         *
         * Note that certain ranges can be represented by either num = 31 and
         * scale or num = 0 and scale + 1. The loop below favours the latter
         * since num is limited to 30 by the __TLBI_RANGE_NUM() macro.
         */
        while (pages > 0) {
            if (!system_supports_tlb_range() ||
                pages % 2 == 1) {
                addr = __TLBI_VADDR(start, asid);
                if (last_level) {
                    __tlbi_level(vale1is, addr, tlb_level);
                    __tlbi_user_level(vale1is, addr, tlb_level);
                } else {
                    __tlbi_level(vae1is, addr, tlb_level);
                    __tlbi_user_level(vae1is, addr, tlb_level);
                }
                start += stride;
                pages -= stride >> PAGE_SHIFT;
                continue;
            }
    
            num = __TLBI_RANGE_NUM(pages, scale);
            if (num >= 0) {
                addr = __TLBI_VADDR_RANGE(start, asid, scale,
                              num, tlb_level);
                if (last_level) {
                    __tlbi(rvale1is, addr);
                    __tlbi_user(rvale1is, addr);
                } else {
                    __tlbi(rvae1is, addr);
                    __tlbi_user(rvae1is, addr);
                }
                start += __TLBI_RANGE_PAGES(num, scale) << PAGE_SHIFT;
                pages -= __TLBI_RANGE_PAGES(num, scale);
            }
            scale++;
        }
        dsb(ish);
    }
    ```
    通过三个可选的参数来灵活控制清除策略：

  - unsigned long stride
    
    表示每次TLB失效操作的步长（即地址区间的跨度），通常为页大小。它决定了每次循环处理多少地址空间，影响失效的粒度。

  - bool last_level
     
    指示是否只失效最后一级页表（即叶子页表项）。如果为 true，只刷新最后一级页表对应的TLB条目；如果为 false，则可能还会失效中间级别（如PGD/PUD/PMD）的walk cache。
    
  - int tlb_level
  
    指定TLB失效操作针对的页表级别（如L1、L2、L3）。在支持ARMv8.4-TTL的CPU上，这个参数会作为TLBI指令的level hint，帮助硬件更精确地失效对应级别的TLB条目。如果为0，则不带级别提示，执行普通失效。
  
  首先用`round_down`和`round_up`将`start`和`end`对齐到`stride`整数倍，确保后面可以按`stride`步长逐页操作 TLB，同时`pages`是对齐后需要操作的页数
    
    
```

                                                            +---------+
                                                            |   开始  |
                                                            +----+----+
                                                                 |
                                             +-------------------V---------------+
                                             |  start,end对齐为步长stride整数倍  |
                                             +-------------------+---------------+
                                                                 |
                                             +-------------------V---------------+
                                             |  计算需要的总操作页数pages        |
                                             +-------------------+---------------+
                                                                 |
                                             +-------------------V---------------+
                                             |  操作范围pages过大                |
                                             +-------------------+---------------+
                                            NO                   |              YES
                       +-----------------------------------------+-------------------------------------------+
                       |                                                                                     |
              +--------V--------+                                                             +--------------V-------------+
              | 硬件不支持or    |                                                             | flush_tlb_mm               |
              | pages为单数     |                                                             | 将整个ASID进程的TLB全flush |
              +--------+--------+                                                             +--------------+-------------+
      +--------------->+<------------------------------------------------------------------+                 |
      |                +-----------------------------------------+                         |                 |
      |                |YES                 NO                   |                         |                 |
      |      +---------V------------+             +--------------V----------------+        |                 |
      |      |  __TLBI_VADDR        |             |     __TLBI_VADDR_RANGE        |        |                 |
      |      |  (start, asid)       |             |     (start, asid, scale,      |        |                 |
      |      |  生成start所在单个页 |             |      num, tlb_level);         |        |                 |
      |      |  的TLBI操作数        |             |     失效一批连续几页的TLB条目 |        |                 |
      +      +---------+------------+             +--------------+----------------+        |                 |
      |                |                                         |                         |                 |
      |                |                                         |                         |                 |
      |                |                                         |                         |                 |
      |                |                          +--------------V-----------------+       |                 |
      |                |                          |     扩大连续页数的范围scale++  |       |                 |
      |                |                          +--------------+-----------------+       |                 |
      |   Pages > 0    |                                         |     Pages > 0           |                 |
      +----------------+                                         +-------------------------+                 |
                       |                                         |                                           |
                       |                                         |                                           |
                       +------------------------------------+----+-------------------------------------------+
                                                            |
                                                  +---------V----------+
                                                  |     结束Return     |
                                                  +--------------------+
                                                                                    
```
批量失效的页数由公式 (num + 1) * 2^(5 * scale + 1) 决定，其中 num 和 scale 都是整数。
由于 2^(5 * scale + 1) 总是偶数，所以无论 num 取何值，最终结果都是偶数页。
- `flush_tlb_kernel_range`
  
  只针对内核的范围失效，没有用户空间ASID这么复杂的权限管理，因此实现方法比较简单

  ```c
  static inline void flush_tlb_kernel_range(unsigned long start, unsigned long end)
  {
  unsigned long addr;
  
      if ((end - start) > (MAX_TLBI_OPS * PAGE_SIZE)) {
          flush_tlb_all();
          return;
      }
  
      start = __TLBI_VADDR(start, 0);
      end = __TLBI_VADDR(end, 0);
  
      dsb(ishst);
      for (addr = start; addr < end; addr += 1 << (PAGE_SHIFT - 12))
          __tlbi(vaale1is, addr);
      dsb(ish);
      isb();
  }

  ```
  
- `flush_tlb_kernel_range`: 用于失效（刷新）与中间页表级别（如 pgd、pud、pmd）相关的TLB条目
  - 作用：确保了内核在修改中间页表项后，所有CPU都能及时失效相关的TLB和步进缓存
  
  ```c
  static inline void flush_tlb_kernel_range(unsigned long start, unsigned long end)
  {
      unsigned long addr;
  
      if ((end - start) > (MAX_TLBI_OPS * PAGE_SIZE)) {
          flush_tlb_all();
          return;
      }
  
      start = __TLBI_VADDR(start, 0);
      end = __TLBI_VADDR(end, 0);
  
      dsb(ishst);
      for (addr = start; addr < end; addr += 1 << (PAGE_SHIFT - 12))
          __tlbi(vaale1is, addr);
      dsb(ish);
      isb();
  }
  ```


> [TLB一致性维护--代码解读](https://www.cnblogs.com/linhaostudy/p/18226874)

# 参考

> [1] [对TLBI的一个初步认识-by wangzhou](https://codehub-y.huawei.com/w00606512/dev_notes/wiki?categoryId=247351&sn=WIKI202507242387049)
>
> [2] 《ARM64体系结构编程与实践》第17章TLB管理
>
> [3] [ARM内部共享CPU与外部共享域CPU：四、缓存一致性相关](https://www.cnblogs.com/tianrenbushuai/p/18501643)
>
> [4] [SMMU和IOMMU技术-SMMU两阶段页表](https://zhuanlan.zhihu.com/p/76643300)
>
> [5] [虚拟化下存在的两阶段映射的页表项](https://blog.csdn.net/flyingnosky/article/details/122629731)
>
> [6] [KVM-QEMU](https://www.cnblogs.com/ppddcsz/p/16879813.html)
>
> [7] [IOMMU和Arm SMMU介绍](https://www.openeuler.org/zh/blog/wxggg/2020-11-21-iommu-smmu-intro.html)
>
> [8] [一步一图带你构建 Linux 页表体系 —— 详解虚拟内存如何与物理内存进行映射 ](https://www.cnblogs.com/binlovetech/p/17571929.html)
>
> [9] [TLB源码学习_kernel 3.10内核源码分析--TLB相关--TLB概念、flush、TLB lazy模式 【转】](https://www.cnblogs.com/sky-heaven/p/5133747.html)
