---
title: 'ARM64结构与编程:内存管理'
date: 2026-03-21 01:16:47
tags:
categories:
    - ARM64结构与编程实操
---

内存管理的基础内容可以看另一篇博客：[内存管理篇](https://akirazheng.github.io/2025/11/04/ARM64%E5%9F%BA%E7%A1%80%E7%9F%A5%E8%AF%86/)

# VMSA

VMSA 提供了 MMU 硬件单元，MMU 中还包含了 TLB，保留的是 MMU 页表翻译后的转换结果。

MMU 硬件单元用来实现 VA 到 PA 的地址转换（转换由硬件自动转换）：

- 硬件遍历页表：table walk
- TTBR0/1：页表基地址寄存器，指向当前使用的页表（一级页表）的物理地址

其中，TTBR0 通常用于用户空间地址转换，TTBR1 用于内核空间地址转换。为了实现用户态和内核态进程的隔离，保证内核空间不被用户空间访问，因此可以看到我们总线有 64 bit，但实际上用户空间和内核空间的地址范围都被限制在 48 bit 内，原因是这样就可以通过 TTBR0 和 TTBR1 分别指向不同的页表来实现用户空间和内核空间的地址转换。

- 内核空间：0xFFFF000000000000 ~ 0xFFFFFFFFFFFFFFFF，占用高位虚拟地址空间
- 用户空间：0x0000000000000000 ~ 0x0000FFFFFFFFFFFF，占用低位虚拟地址空间

<img src=2026-03-21-03-16-15.png>


硬件单元的作用：

- 地址转换：将虚拟地址转换为物理地址
- 权限检查：根据页表项中的权限位检查访问权限
- 内存属性检查：根据页表项中的内存属性位检查访问类型（如缓存策略）

## 页表描述符

L0-L2页表描述符有三种类型：

- 无效页表项：表示该页表项无效，访问该页会触发页错误异常
- 块类型页表项：表示该页表项直接映射一个大页（如2MB或1GB），不需要继续遍历下一级页表
- 页表page table类型页表项：表示该页表项指向下一级页表（最常见）

<img src=2026-03-21-03-22-16.png>

L3页表描述符有五种类型：

- 无效页表项：表示该页表项无效，访问该页会触发页错误异常
- 保留页表项：表示该页表项保留，访问该页会触发页错误异常
- 4KB粒度页表项：表示该页表项映射一个4KB的页
- 16KB粒度页表项：表示该页表项映射一个16KB的页
- 64KB粒度页表项：表示该页表项映射一个64KB的页

<img src=2026-03-21-03-25-26.png>

页表属性包含了该 entry 的读写权限位、访问位、脏位、内存属性位等信息，stage1的一些典型页表属性如下：

<!-- <img src=2026-03-21-03-35-56.png> -->

<!-- <img src=2026-03-21-04-09-46.png> -->

<img src=2026-03-21-04-18-51.png>

- Device-nGnRnE： 不支持聚合操作，不支持指令重排，不支持提前写应答。
- Device-nGnRE： 不支持聚合操作，不支持指令重排，支持提前写应答。
- Device-nGRE： 不支持聚合操作，支持指令重排，支持提前写应答。
- Device-GRE： 支持聚合操作，支持指令重排，支持提前写应答。

<img src=2026-03-21-03-42-22.png>

Armv8 上利用 TLB 进行的一个优化： 通过设置 Contiguous bit，利用一个 TLB entry 来完成多个连续 page 的 VA 到 PA 的转换。

使用 Contiguous bit 的条件：
- 页面对应的 VA 必须是连续的

- 对于 4KB 的页面，16 个连续的 page

- 对于 16KB 的页面，32 或者 128 个连续的 page

- 对于 64KB 的页面，32 个连续的 page

- 连续的页面必须有相同的属性

- 起始地址必须以页面对齐

根据上述这些 Attribute 配置，在linux kernel中定义了一些代表 Attribute 集合属性的宏：

```c
//.linux/include/asm/pgtable-prot.h
#define PAGE_KERNEL      __pgprot(PROT_NORMAL)                         // 内核普通内存页面
#define PAGE_KERNEL_RO   __pgprot((PROT_NORMAL & ~PTE_WRITE) | PTE_RDONLY)      // 内核只读页面
#define PAGE_KERNEL_ROX  __pgprot((PROT_NORMAL & ~(PTE_WRITE | PTE_PXN)) | PTE_RDONLY) // 内核只读可执行页面
#define PAGE_KERNEL_EXEC __pgprot((PROT_NORMAL & ~PTE_PXN))            // 内核可执行页面
#define PAGE_KERNEL_EXEC_CONT __pgprot((PROT_NORMAL & ~PTE_PXN) | PTE_CONT)       // 内核可执行连续页面（物理页面连续）
```

