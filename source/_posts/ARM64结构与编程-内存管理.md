---
title: 'ARM64结构与编程:内存管理'
date: 2026-03-21 01:16:47
tags:
categories:
    - ARM64结构与编程实操
---

内存管理的基础内容可以看另一篇博客：[内存管理篇](https://akirazheng.github.io/2025/11/04/ARM64%E5%9F%BA%E7%A1%80%E7%9F%A5%E8%AF%86/)

# VMSA

## MMU

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

<!-- <img src=2026-03-21-03-25-26.png> -->

<img src=2026-03-22-01-45-30.png>

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

# 实验一：建立恒等映射：VA=PA

实际上多进程运行的系统中，我们不会用恒等映射，VA不会等于PA。但是某些特殊场景下是要求用恒等映射的。

我们知道，在MMU开启后，PC指令存的值也是虚拟地址，然后经过页表映射成物理地址后，在内存中查找对应的代码来执行。

但是在 MMU 初始化的过渡阶段，必须采用恒等映射，防止开启 MMU 前预取的指令在开启 MMU 后，被当做是虚拟地址，地址转换后导致访问异常。

MMU 初始化阶段之所以用恒等映射，是因为现代处理器是多级流水线架构，在使能 MMU 前，处理器会用**物理地址来预取多条指令**。

- PC 中的值直接是物理地址
- CPU 使用 PC 的值直接从物理内存取指令
- 没有地址转换
- eg：`PC = 0x80000  →  直接读取物理地址 0x80000 处的指令`

但是当 MMU 打开后，之前预取的指令会以虚拟地址来访问，到 MMU 中查找对应的物理地址，因此，这里恒等映射是为了保证处理器在开启 MMU 前后可以连续取指令。

- PC 中的值是虚拟地址
- CPU 需要通过 MMU 将虚拟地址转换为物理地址
- 查询页表 (PGD→PUD→PMD→PTE) 获取物理地址
- eg：`PC = 0x80000  →  MMU查询页表  →  物理地址 0x80000  →  读取指令`，可以看到，恒等映射的话，能确保之前预取的 PC 值经过页表转换后依然不变，这样才能正常访问。

一般来说，为了防止访问失败，一般在打开 MMU 的前后 1~2MB 建立恒等映射就行，这种操作称为**自举**。当然，我们实验中选择映射 512 MB 的恒等映射，也是为了能对这块区域进行测试，更方便观察。

实验原理是，只对前 512 MB 的内存建立恒等映射，后面的不建立页表，这样的话就可以写一个 test case 来验证前 512 MB 的内存访问是正常的（0x00000000~0x1FFFFFFF），而访问超过 512 MB 的内存会触发页错误异常。来验证我们建立的页表映射是正确的。

```
512MB = 2^29 bytes = 0x20000000 bytes
地址范围：0x00000000 ~ 0x1FFFFFFF
```

每个页的地址范围（512MB / 4KB = 131,072 个页）：

| 页号 | 起始地址 | 结束地址 |
|------|----------|----------|
| 0 | 0x00000000 | 0x00000FFF |
| 1 | 0x00001000 | 0x00001FFF |
| 2 | 0x00002000 | 0x00002FFF |
| ... | ... | ... |
| 131,071 | 0x1FFFF000 | 0x1FFFFFFF |

## 一、创建页表

各级页表的大小是固定的，也就是`PAGE_SIZE = 4KB`，四级页表中，每级的页的 entry 大小都是 8 bytes（64位，存下一级的基地址），每一页都是 4 KB，所以每一页的页表项 entry 数量是固定的：

```
entry 数量 = 页面大小 / 每个 entry 的大小
           = 4KB / 8 bytes
           = 4096 / 8
           = 512
```

其中每个 entry（页表项）的大小是 8 bytes（64位），存储物理地址的高位和标志位。512个 entry 正好填满一个 4KB 页面。

创建 4 KB 页表的代码为：

```c
static unsigned long early_pgtable_alloc(void)
{
       unsigned long phys;

       phys = get_free_page();
       memset((void *)phys, 0, PAGE_SIZE);

       return phys;
}
```

### 创建 PGD 页表 && 实现映射

<img src=2026-03-21-22-28-11.png>

创建页表时会先创建 text 段映射，原因是：CPU 正在执行的代码就在 text 段中，启用 MMU 后，CPU 的下一条指令地址必须在页表中已存在，否则会立即触发页错误导致崩溃。这就是自包含代码的自举问题。早期初始化阶段，只需要确保代码段能继续执行（ROX），其他数据段、栈等可以在后面逐步映射。

ELF 文件中的段：

| 段名 | 含义 | 权限 |
|------|------|------|
| .text | 代码段（可执行的机器指令） | R + X（可读+可执行） |
| .data | 已初始化数据段（全局变量） | R + W（可读+可写） |
| .bss | 未初始化数据段 | R + W |
| .rodata | 只读数据段（字符串常量等） | R（只读） |

在链接脚本`./src/linker.ld`中，`_text_boot`和`_etext`分别是 text 段的起始地址和结束地址，链接器会根据这些符号来确定 text 段在内存中的位置和大小。

```armasm
SECTIONS
{
    	/*
	 * 设置benos的加载入口地址为0x80000
	 *
	 * 这里“.”表示location counter，当前位置
	 */
	. = 0x80000,
	/*
	 * 这里是第一个段text.boot，起始地址就是0x80000
	 * 这个段存放了benos的第一条指令
	 */
	_text_boot = .;
	.text.boot : { *(.text.boot) }
	_etext_boot = .;

	/*
	 * text代码段
	 */
	_text = .;
	.text :
	{
		*(.text)         //会自动收集所有编译单元中的.text段内容，链接器把它们连续放在一起
	}
	_etext = .;
}
```

**大小来源**：代码段大小（`_etext - _text`）不是手动定义的，而是由编译器和链接器自动计算。编译器将每个 `.c` 文件编译成 `.o` 文件时生成 .text 段，链接器在链接时把所有 .text 段收集并连续排列，最终形成完整的代码段。`_text` 和 `_etext` 之间的内容就是**所有函数编译后的机器指令，包括内核代码、启动代码等**。

这种设计让代码段大小自动适应代码规模。**当添加或删除代码时，编译器会自动调整 .text 段大小，链接器会更新 `_etext` 的值，映射代码不需要手动修改**。这样既保证了正确性，又提高了可维护性。

创建 text 映射的代码如下：

```c
static void create_identical_mapping(void)
{
    unsigned long start;
    unsigned long end;

    /* 创建 .text 代码段 */
    start = (unsigned long) &_text_boot;    //链接器中定义的代码段的起始地址
    end = (unsigned long) &_etext;  //链接器中定义的代码段的结束地址
    //text代码段的可执行权限是ROX只读可执行的，这里创建的时候会顺便把pgd页也分配了
    __create_pgd_mapping((pgd_t *)idmap_pg_dir, start, start,
                    end - start, PAGE_KERNEL_ROX,
                    early_pgtable_alloc,
                    0);//flags 是 0，表示不设置了NO_BLOCK_MAPPINGS标志
    //...
}
```

用 gdb 查看你 start 和 end 的值，就可以算出 text 段大小：

```gdb
(gdb) p/x start
$3 = 0x80000
(gdb) p/x end
$4 = 0x848d0
(gdb) 
```

之后就会在创建 text 的时候，顺便把 pgd 页表创建了，并逐级创建 text 字段的页表：

```c
/**
 * @brief 创建 size 大小内存的PGD页表映射
 *
 * @param pgdir     [in] PGD页表目录的基地址
 * @param phys    [in] 要映射的物理起始地址
 * @param virt    [in] 要映射的虚拟起始地址
 * @param size    [in] 要映射的内存大小（字节）
 * @param prot    [in] 页表保护属性（如PAGE_KERNEL_ROX）
 * @param alloc_pgtable [in] 分配页表的函数指针，用于分配下一级页表
 * @param flags   [in] 映射标志位
 * @return        void 无返回值
 */
static void __create_pgd_mapping(pgd_t *pgdir, unsigned long phys, unsigned long virt,
                    unsigned long size, unsigned long prot,
                    unsigned long (*alloc_pgtable)(void), unsigned long flags)
{
    //1. 通过PGD页表的基地址+取virt中的PGD索引得到PGD entry的地址
    pgd_t * pgdp = pgd_offset_raw(pgdir, virt);

    //2. 将地址页对齐（清除低12位偏移），确保从页边界开始映射
    unsigned long addr, end, next;
    phys &= PAGE_MASK;  // 物理地址页对齐，只保留 PFN 的位
    addr = virt & PAGE_MASK;  // 虚拟地址页对齐，只保留 VFN 的位
    end = PAGE_ALIGN(virt + size);

    //3. 逐级往下创建页表：pud->pmd->pte
    do {
        next = pgd_addr_end(addr, end);//获得下一个pgd页的地址，如果当页能覆盖，那么说明不需要next，next=addr
        alloc_init_pud(pgdp, addr, next, phys,
                prot, alloc_pgtable, flags);
        phys += next - addr;
    } while (pgdp++, addr = next, addr != end);
}
```

其中，pdg entry可能是没有填充下一级 pud 页基地址拼接起来的 64 位 entry值的，因此该 entry 的填充会在`alloc_init_pud` 函数中完成，创建完一个 pud 页后，就可以拿到pud 页的基地址，也就可以填充给 pgd entry 了。填充规则如下图所示：

<img src=2026-03-21-03-22-16.png>

### 创建 PUD 页表 && 实现映射

如果上一级 pgd entry `pgd_t *pgdp` 指向的 pud 页不存在，才会创建一个 pud 页并填充到 pgd entry 中。否则会直接映射下一级 pmd 页表。

pud 页的创建是通过从上一级页表 pgd entry 指针中获取 entry 里的 64 位数据，这 64 位数据可以提取出 pud 页的基地址，然后根据 va 提取的 pud 页 index 索引拼接获取下一级 pud entry 的物理地址。

然后再映射到下一级 pmd 页表中`alloc_init_pmd`。

```c
/**
 * @brief 创建 PUD 页表映射
 *
 * @param pgdp         [in] PGD 条目的指针，用于获取或创建对应的 PUD 页
 * @param addr         [in] 虚拟起始地址
 * @param end          [in] 虚拟结束地址
 * @param phys         [in] 物理起始地址（恒等映射时通常等于 addr）
 * @param prot         [in] 页表保护属性（如 PAGE_KERNEL_ROX）
 * @param alloc_pgtable [in] 页表分配函数指针，用于分配下一级页表
 * @param flags        [in] 映射标志位
 * @return             void 无返回值
 */
static void alloc_init_pud(pgd_t *pgdp, unsigned long addr,
               unsigned long end, unsigned long phys,
               unsigned long prot,
               unsigned long (*alloc_pgtable)(void),
               unsigned long flags)
{
       pgd_t pgd = *pgdp;
       pud_t *pudp;
       unsigned long next;

       /* 创建pud页 
        * 如果pgd[pgd_entry_idx]存的pud页基地址是空的，说明还没建立该页
        */
       if (pgd_none(pgd)) {
               unsigned long pud_phys;

               pud_phys = alloc_pgtable();

               //set_pgd：将__pgd拼接的64位数据填充到pgd页表项entry中
               //__pgd是通过pud的下一级页基地址和PUD_TYPE_TABLE配置拼接起来的64位值
               set_pgd(pgdp, __pgd(pud_phys | PUD_TYPE_TABLE));
               pgd = *pgdp;
       }

       //得到下一级 pud entry 的 物理地址
       pudp = pud_offset_phys(pgdp, addr);
       do {
               next = pud_addr_end(addr, end);//获得下一个pud页的地址，如果当页能覆盖，那么说明不需要next，next=addr
               alloc_init_pmd(pudp, addr, next, phys,
                               prot, alloc_pgtable, flags);
               phys += next - addr;

       } while (pudp++, addr = next, addr != end);
}
```

### 创建 PMD 页表 && 实现映射

PMD 页表的创建跟创建 PUD 页表一样，只是在映射下一级页表的逻辑中有所差异，因为内存分为**块类型页表项**和**页表page table类型页表项**，如果是块类型页表项，则直接调用`pmd_set_section`函数，没有下一级 PTE 页表了，否则调用`alloc_init_pte`函数创建下一级 PTE 页表。

<img src=2026-03-21-03-22-16.png>

```c
void pmd_set_section(pmd_t *pmdp, unsigned long phys,
               unsigned long prot)
{
       unsigned long sect_prot = PMD_TYPE_SECT | mk_sect_prot(prot);

       pmd_t new_pmd = pfn_pmd(phys >> PMD_SHIFT, sect_prot);

       //往 pmdp entry 中填所映射的物理地址的 PFN 值
       set_pmd(pmdp, new_pmd);
}

static void alloc_init_pmd(pud_t *pudp, unsigned long addr,
               unsigned long end, unsigned long phys,
               unsigned long prot,
               unsigned long (*alloc_pgtable)(void),
               unsigned long flags)
{
       pud_t pud = *pudp;
       pmd_t *pmdp;
       unsigned long next;

       if (pud_none(pud)) {
               unsigned long pmd_phys;

               pmd_phys = alloc_pgtable();
               set_pud(pudp, __pud(pmd_phys | PUD_TYPE_TABLE));
               pud = *pudp;
       }

       pmdp = pmd_offset_phys(pudp, addr);
       do {
               next = pmd_addr_end(addr, end);

               if (((addr | next | phys) & ~SECTION_MASK) == 0 && // 地址对齐检查
                               (flags & NO_BLOCK_MAPPINGS) == 0) // flags 检查出是NO_BLOCK_MAPPINGS块映射
                       pmd_set_section(pmdp, phys, prot);
               else
                       alloc_init_pte(pmdp, addr, next, phys,
                                       prot,  alloc_pgtable, flags);//创建下一级 PTE 映射

               phys += next - addr;
       } while (pmdp++, addr = next, addr != end);
}
```

代码跑到 alloc_init_pmd 函数中，我们 gdb 打断点查看一下它的 flags 值：

```c
(gdb) p flags
$1 = 0
(gdb) 
```

发现我们前面 create 的内存的属性全部都是`0`，而 `NO_BLOCK_MAPPINGS` 值是`1`。所以全部会走 PTE create 逻辑，创建 PTE 页表。

### 创建 PTE 页表 && 实现映射

最后一级 PTE 的映射就很简单了，只用把 PFN 值填到 PTE entry 中就行了

```c
static void alloc_init_pte(pmd_t *pmdp, unsigned long addr,
               unsigned long end, unsigned long phys,
               unsigned long prot,
               unsigned long (*alloc_pgtable)(void),
               unsigned long flags)
{
       pmd_t pmd = *pmdp;
       pte_t *ptep;

       if (pmd_none(pmd)) {
               unsigned long pte_phys;

               pte_phys = alloc_pgtable();
               set_pmd(pmdp, __pmd(pte_phys | PMD_TYPE_TABLE));
               pmd = *pmdp;
       }

       ptep = pte_offset_phys(pmdp, addr);
       do {
               set_pte(ptep, pfn_pte(phys >> PAGE_SHIFT, prot)); //最后一级了直接配 PFN 值给 entry
               phys += PAGE_SIZE;
       } while (ptep++, addr += PAGE_SIZE, addr != end);
}
```

还要注意一下 `set_pte` 的填充协议跟 L0~L2级别页表不一样：

<!-- <img src=2026-03-21-03-25-26.png> -->

<img src=2026-03-22-01-45-30.png>

## 二、初始化 MMU

要注意，页表修改后，需要把相关的 TLB entry 刷新掉，否则可能会访问到过期的 TLB entry 导致访问错误。

初始化 MMU 的时候需要做的事：

1. 初始化 PGD 页表目录：清空 PGD 页，准备好页表基地址（idmap_pg_dir）
2. 创建代码段（.text）映射：建立恒等映射（VA=PA），确保启用 MMU 后代码能继续执行
3. 创建测试内存映射：建立 512MB 内存的页表映射，用于测试页表功能
4. 创建 MMIO 映射：为设备寄存器区域建立映射，使用设备内存属性
5. 配置 CPU MMU 寄存器：设置内存属性（MAIR）、虚拟/物理地址范围（TCR）、浮点支持等
6. 启用 MMU：设置页表基地址（TTBR0），使能 MMU（SCTLR_EL1.M），刷新 TLB

```c
void paging_init(void)
{
   memset(idmap_pg_dir, 0, PAGE_SIZE);//创建第一页 pgd 页，其中idmap_pg_dir就是基地址，需要填到TTBR中
   create_identical_mapping();//创建text段的内存映射，并创建用于测试的 512 MB 内存的页表映射
   create_mmio_mapping();//创建mmio I/O 映射。
   cpu_init();//配置CPU启动MMU的各种寄存器配置，比如页表粒度（4KB）、va/pa地址范围（48bits）、内存属性...
   enable_mmu();//使能mmu使能位、填充L0页表基地址到TTBR0中
   printk("enable mmu done\n");
}
```

## 三、访问测试

该测试中，需要创建完 text 内存映射后，再创建 512MB 的内存映射：

```c
static void create_identical_mapping(void)
{
    //...

    /* 创建 512 MB 内存的页表 */
    /*map memory*/
       start = PAGE_ALIGN((unsigned long)_etext);
       end = TOTAL_MEMORY;
       __create_pgd_mapping((pgd_t *)idmap_pg_dir, start, start,
                       end - start, PAGE_KERNEL,
                       early_pgtable_alloc,
                       0);
}
```

代码中只设置了代码段~512MB的内存，因此先测试创建的内存以内的地址访问会触发页错误异常（TOTAL_MEMORY - 4096），然后测试没有内存映射的地址访问会触发页错误异常：


```c
static int test_access_map_address(void)
{
       unsigned long address = TOTAL_MEMORY - 4096;

       *(unsigned long *)address = 0x55;

       printk("%s access 0x%x done\n", __func__, address);

       return 0;
}

/*
 * 访问一个没有建立映射的地址
 * 应该会触发一级页表访问错误。
 *
 * Translation fault, level 1
 *
 * 见armv8.6手册第2995页
 */
static int test_access_unmap_address(void)
{
       unsigned long address = TOTAL_MEMORY + 4096;

       *(unsigned long *)address = 0x55;

       printk("%s access 0x%x done\n", __func__, address);

       return 0;
}

static void test_mmu(void)
{
       test_access_map_address();//在已经建立页表的512MB内访问内存
       test_access_unmap_address();//在建立映射之外的地址进行访问：触发abort
}
```

最后的运行结果如下：

```shell
akira@akira:~/BenOS/BenOS_ARM/benos$ make run
qemu-system-aarch64 -machine raspi3 -nographic -kernel benos.bin
Booting at EL2
Booting at EL1
Welcome BenOS!
printk init done
<0x800880> func_c
el = 1
done
enable mmu done
test_access_map_address access 0x1ffff000 done
Bad mode for Sync Abort, far:0x20001000, esr:0x0000000096000046 - DABT (current EL)
ESR info:
  ESR = 0x96000046
  Exception class = DABT (current EL), IL = 32 bits
  Data abort:
  SET = 0, FnV = 0
  EA = 0, S1PTW = 0
  CM = 0, WnR = 1
  DFSC = Translation fault, level2
Kernel panic
```

# 实验二：dump 页表

我们 debug 内存相关的内容的时候，经常需要 dump 出页表的**虚拟地址、页表项属性**等信息。