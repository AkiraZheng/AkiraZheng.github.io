---
title: 虚机下 VFIO 设备 BAR 空间分配与 BAR 重叠报错分析(一)
date: 2026-07-29 14:00:00
categories: 虚拟化
tags:
  - VFIO
  - KVM
  - QEMU
  - ARM64
  - PCI
---

本文分析 ARM64 64KB PAGE_SIZE 环境下，VFIO 设备直通时 BAR 空间分配涉及的基础数据结构与关联关系。涉及 QEMU MemoryRegion、KVM memslot、Stage-2 页表等多层数据结构。所有代码引用均来自 openEuler QEMU（`openeuler_qemu`）和 openEuler Kernel（`openeuler/kernel`），已逐一对照源码验证。

## 1. 四种地址空间

VFIO PCI 直通场景涉及四种地址，分属三个主体管理：

| 地址 | 全称 | 谁分配 | 存在哪里 | 示例 |
|------|------|--------|----------|------|
| GVA | Guest Virtual Address | Guest 内核 (ioremap) | Guest S1 页表 PTE | `0xffff_8000_ca00_0300` |
| GPA | Guest Physical Address | QEMU 命令行(窗口基址) + Guest PCI 枚举(BAR 偏移) | BAR 配置寄存器、S2 PTE | `0x8000_2000_0300` |
| HVA | Host Virtual Address | Host 内核 (mmap 返回值) | QEMU `ram_block->host` | `0x7fff_a000_0300` |
| HPA | Host Physical Address | Host BIOS/PCI 枚举 | S2 PTE 的目标字段 | `0x0800_0000_0300` |

以 Guest 驱动访问设备 BAR2 内偏移 `0x300` 的寄存器为例，四种地址的翻译链路：

```
Guest 指令: ldr x0, [x3]        (x3 = io_base + 0x300)

  GVA 0xffff_8000_ca00_0300
    ↓ Guest S1 (TTBR1_EL1)        ← Guest OS 管理
  GPA 0x8000_2000_0300
    ↓ Host S2 (VTTBR_EL2)         ← KVM 管理
  HPA 0x0800_0000_0300
    ↓ 物理总线
  设备寄存器
```

四种地址的高位含义完全不同，互相之间没有数值上的映射关系。低 16 位（64KB 页内偏移）在四级翻译中保持不变。

## 2. 三套页表

VHE 模式下 Host 内核运行在 EL2，Guest 运行在 EL1。Guest 访问设备只需要 Guest S1 + Host S2 两套页表，但 KVM 建 S2 时依赖 Host S1 用户页表作为「脚手架」——QEMU 通过 `ioctl(KVM_SET_USER_MEMORY_REGION)` 把一个 `{GPA, HVA, size}` 三元组传给 KVM，KVM 拿到这个 section 后，用其中的 HVA 调用 `get_user_pages()`，走 Host S1 页表（TTBR0_EL2）查到设备 BAR 的 HPA，再将 `GPA → HPA` 填入 S2 PTE。如果 Host S1 尚未建立（mmap 后首次访问），会触发 page fault，由 VFIO 驱动的 fault 回调 `io_remap_pfn_range` 建立 Host S1 PTE。

| 寄存器 | 翻译关系 | 页表由谁管理 | 角色 |
|--------|---------|------------|------|
| TTBR1_EL1 | GVA → GPA | Guest OS | Guest 自己的翻译 |
| TTBR0_EL2 | HVA → HPA | Host 内核 | S2 的「脚手架」 |
| VTTBR_EL2 | GPA → HPA | KVM (Host 内核) | Guest 运行时的硬件路径 |

三套页表的建立有先后顺序：Phase 1 QEMU mmap 获取 HVA（只建 VMA，Host S1 延迟）→ Phase 2 KVM 建 memslot 时通过 `get_user_pages` 触发 Host S1 建立，再填 S2 PTE → Phase 3 Guest ioremap 建 Guest S1。运行时只有 Guest S1 + Host S2 参与翻译，Host S1 不参与。详细流程见[附录 A](#附录-a三套页表建立流程与运行时关系)。

## 3. QEMU 侧数据结构

以下结构都在 QEMU 进程用户态（Host EL0）中，是 QEMU 管理 Guest 物理地址空间的内部表示。

### 3.1 MemoryRegion —— MR 树节点

每个 `MemoryRegion` 描述 Guest 物理地址空间中的一段区域。关键字段（`include/exec/memory.h`）：

```c
struct MemoryRegion {
    char *name;                 // "mach-virt.ram", "0000:00:01.0 base BAR 4"
    hwaddr addr;                // 在父 MR 内的偏移 (GPA = 父 MR 基址 + addr)
    Int128 size;                // 区域大小 (被 sub_page_bar 修改的就是这个字段)
    bool ram;                   // RAM 类型? (QEMU 可分配后端内存)
    bool ram_device;            // ram_device? (VFIO mmap 的 BAR)
    int32_t priority;           // 在父的子链表中的优先级 (pci_update_mappings=1, sub_page_bar=0)
    QTAILQ_HEAD(, MemoryRegion) subregions;  // 子 MR 链表 (树拓扑)
    RAMBlock *ram_block;        // 如果 ram=true, 指向后端 RAM 块 (.host = HVA)
    const MemoryRegionOps *ops; // 如果 ram=false, 指向 IO 回调函数表 (没有 HVA)
};
```

三种核心 MR 类型：

| 类型 | 标志 | 有无 HVA | KVM 建 memslot? | Guest 访问路径 |
|------|------|---------|----------------|--------------|
| RAM | `ram=true, ram_device=false` | 有 (QEMU malloc) | 是 | S2 命中 → 硬件直达 |
| RAM device | `ram=true, ram_device=true` | 有 (mmap 返回) | 是 | S2 命中 → 硬件直达 |
| IO | `ops != NULL, ram=false` | 没有 | 否 | S2 miss → VM exit → QEMU ops 回调 |

`subregions` 和 `ram_block` 是两个正交的字段，不是取舍关系：

- `subregions` → 树结构（拓扑）：QTAILQ 链表，存子 MR。负责「这个 GPA 区间包含哪些子区域」
- `ram_block` → 数据后端（存储）：`ram_block->host` 是 HVA 指针。负责「这个 MR 的实际数据在宿主机的哪个地址」

| subregions | ram_block | 例子 | 说明 |
|---|---|---|---|
| 有 | 无 | `bar->mr`, `region.mem` | 纯容器/IO 层，通过子 MR 定义内容 |
| 无 | 有 | `mmaps[0].mem`, `mach-virt.ram` | 叶子节点，`ram_block->host` = HVA |
| 有 | 有 | 被 overlay 切割的 RAM | 罕见 |
| 无 | 无 | GIC, UART 等纯 IO MR | 只通过 `ops` 回调处理 MMIO |

在 VFIO BAR 场景中的完整 MR 树（从根到叶子）：

```
system_memory (根容器, 覆盖整个 GPA 空间, ram_block=NULL)
  ├── mach-virt.ram        [GPA 0x0, 2GB]   ram=true, ram_block->host=HVA(QEMU malloc)
  ├── GIC                  [GPA 0x0800_0000]  IO, ops=gic_ops, ram_block=NULL
  ├── UART                  [GPA 0x0900_0000]  IO, ops=serial_ops, ram_block=NULL
  └── pcie-mmio (alias)     [GPA 0x8000_0000_0000]  → GPEX io_mmio (整个 PCI 总线的 MMIO 空间)
        │
        │  无 Root Port 时, 所有 VF 直接在 bus 0 上:
        │  每个设备的多个 BAR 都是同级子区域, 各自有独立的 GPA offset:
        │
        ├── Dev0 BAR0 bar->mr  [offset 0x000000]  → region.mem → mmaps[0].mem (ram_device, 2MB)
        ├── Dev0 BAR2 bar->mr  [offset 0x200000]  → region.mem → mmaps[0].mem (ram_device, 64KB)
        ├── Dev1 BAR0 bar->mr  [offset 0x400000]  → region.mem → mmaps[0].mem (ram_device, 2MB)
        ├── Dev1 BAR2 bar->mr  [offset 0x208000]  → region.mem → mmaps[0].mem (ram_device, 64KB)
        │   (pci_update_mappings 逐个遍历 PCI_NUM_REGIONS, 每个 BAR 独立挂入 GPEX io_mmio)
        │   (两个 VF 的 BAR2 offset 可能靠太近 → GPA 重叠)
        │
        │  有 Root Port 时, 每个 Root Port 是一个 PCI Bridge:
        │
        └── RootPort0 bridge_mem (alias)  [offset = bridge window base]
              │   pci_bridge_init_alias (pci_bridge.c:161):
              │     memory_region_init_alias(alias, ..., sec_bus.address_space_mem, base, size)
              │     memory_region_add_subregion_overlap(parent->address_space_mem, base, alias, 1)
              │
              └── → RootPort0 sec_bus.address_space_mem (bridge 自己的地址空间, pci_bridge.c:382)
                    └── Dev0 bar->mr  → ... → mmaps[0].mem (ram_device)

        └── RootPort1 bridge_mem (alias)  [offset = 另一个 bridge window base]
              └── → RootPort1 sec_bus.address_space_mem
                    └── Dev1 bar->mr  → ... → mmaps[0].mem (ram_device)
```

`system_memory` 是 QEMU 全局变量（`system/memory.c`），代表 Guest 的整个物理地址空间，本身只是一个空容器——不存数据，不映射到任何实际内存。`pcie-mmio` 是一个 alias MR，把 GPEX `io_mmio`（PCI host bridge 的 MMIO 地址空间）映射到 `system_memory` 的高地址区间。

**无 Root Port 时**，所有 VF 直接挂在 bus 0 上，它们的 BAR MR 都是 GPEX `io_mmio` 的同级子区域。Guest 为各 BAR 分配的 GPA 如果间隔不够，MR 在 GPA 空间中就会重叠。

**有 Root Port 时**，每个 Root Port 是一个 PCI Bridge（`pci_bridge.c:382`），拥有独立的 `sec_bus.address_space_mem`。Bridge 通过 `pci_bridge_init_alias`（`pci_bridge.c:161`）在父总线地址空间中创建一个 alias MR（bridge window），映射到自己的 `sec_bus.address_space_mem`。Guest 为每个 Root Port 分配独立的 bridge window，window 之间不重叠，因此不同 Root Port 下的 VF BAR 不会在 GPA 空间中冲突。

KVM 建 memslot 时只关心叶子 ram_device MR 的 `ram_block->host`（HVA）。中间的容器 MR、alias MR 和 IO MR 没有 `ram_block`，不触发 memslot 创建。

`ops`（`MemoryRegionOps *`）定义 MMIO 读写回调，与 `ram` 互斥——要么走硬件直达（`ram=true`），要么走 QEMU 软件模拟（`ops != NULL`）。VFIO region ops（`hw/vfio/helpers.c:260`）的回调是 `.read = vfio_region_read` / `.write = vfio_region_write`，内部调 `pread(vfio_fd, ..., fd_offset+addr)` / `pwrite(...)` 完成设备访问。`max_access_size = 8`，慢路径只支持 1~8 字节单次访问。两类 MR 的快慢路径对比和 KVM MMIO 派发流程见[附录 B](#附录-bops-回调与-mmio-慢路径派发)。

### 3.2 VFIO 三层结构与 MR 树对应

VFIO PCI 设备的每个 BAR 在 QEMU 中有三层嵌套结构，对应 MR 树的三层：

```
VFIOBAR (hw/vfio/pci.h)                     MR 树                          value (normal)
├─ MemoryRegion *mr;           ──────────→  bar->mr          (L1: container) 64KB
├─ size_t size;                              .size = bar->size              64KB
└─ VFIORegion region;          (vfio-common.h)
   ├─ MemoryRegion *mem;       ──────────→  region.mem       (L2: IO ops)    64KB
   ├─ size_t size;                           .size = region.size            64KB
   └─ VFIOMmap *mmaps;
      └─ mmaps[0]
         ├─ MemoryRegion mem;  ──────────→  mmaps[0].mem     (L3: ram_dev)   64KB
         ├─ void *mmap;                      .size = mmaps[0].size          64KB
         └─ size_t size;                     .ram_block->host = mmap ptr    64KB
                                             .ram_block->size               64KB

  PCIIORegion.r->size  = 64KB     (from memory_region_size(bar->mr))
  PCIIORegion.r->addr  = GPA      (written by Guest PCI enum)
  wmask                 = 0xFFFFFFFFFFFF0000  (~(64KB - 1))
```

只有最内层的 `mmaps[0].mem`（ram_device 类型，`ram=true`）才能触发 KVM memslot 注册。它在 mmap 成功时由 `memory_region_init_ram_device_ptr` 创建（`system/memory.c:1703`），设置 `mr->ram = true`、`mr->ram_device = true`、`mr->terminates = true`、`mr->ram_block->host = mmap 指针`。mmap 失败时不会创建此 MR。

### 3.3 PCIIORegion —— PCI BAR 台账

每个 PCI BAR 对应一个 `PCIIORegion`，`r->size` 在 `pci_register_bar()` 后不再改变（`hw/pci/pci.c:1323`）：

```c
r->size = size;              // 来自 memory_region_size(bar->mr)
r->addr = PCI_BAR_UNMAPPED;  // 尚未分配 GPA
wmask = ~(size - 1);         // 写入虚拟 PCI 配置空间
```

Guest PCI 枚举时写 BAR = 全1，QEMU 返回 `val & wmask`，Guest 从 wmask 中推断 BAR 大小。`r->size` 决定了 Guest 看到的 BAR 大小，也决定了 Guest 为多个 BAR 分配 GPA 时的间隔。

### 3.4 FlatView —— MR 树的展平视图

MR 树是嵌套结构，KVM 需要按 GPA 查找，所以 QEMU 把树展开成 FlatView——一组按 GPA 排序、不重叠的 `FlatRange` 数组：

```c
struct FlatRange {
    MemoryRegion *mr;        // 指向对应 MR
    hwaddr offset_in_region; // MR 内部偏移
    AddrRange addr;          // { start: GPA, size: 字节数 }
};
```

FlatView 渲染时，子 MR 按 QTAILQ 链表顺序遍历（`system/memory.c:646`），高 priority 的先渲染占据 GPA，低 priority 的只填空隙（`system/memory.c:666` 注释：`Render the region itself into any gaps left by the current view`）。这是后续多 VF BAR 重叠截断的机制基础。

QTAILQ 排序规则（`system/memory.c:2699-2701`）：priority 降序，同 priority 时后插入的排前面（运算符是 `>=`，配合 `INSERT_BEFORE`）。

### 3.5 KVMSlot —— QEMU 侧 memslot 缓存

QEMU 内部维护 `KVMSlot` 列表作为本地缓存，通过 `ioctl(KVM_SET_USER_MEMORY_REGION)` 与内核的 `kvm_memory_slot` 同步：

```c
typedef struct KVMSlot {
    hwaddr start_addr;       // GPA
    ram_addr_t memory_size;  // 大小 (页对齐)
    void *ram;               // HVA (mmap'd 指针)
    int slot;
    int flags;
} KVMSlot;
```

## 4. KVM 侧数据结构

以下结构在 Host 内核（EL2）中。

`kvm_memory_slot` 是内核侧的 memslot，存 `base_gfn`(GPA>>PAGE_SHIFT)、`npages`(页数)、`userspace_addr`(HVA)。memslot 不存 HPA——KVM 需要 HPA 时通过 `get_user_pages(userspace_addr)` 动态查 Host S1 页表获取。

每个 memslot 对应 S2 页表中的一段 GPA→HPA 映射。KVM 在创建 memslot 的同时填入 S2 PTE。

## 5. 数据结构关系链路

从 QEMU MR 树到 KVM S2 页表的完整关联链路：

```
QEMU EL0                                    KVM EL2
─────────────                               ─────────

MemoryRegion (ram_device)
  .ram_block->host = HVA
       │
       ↓ render_memory_region
FlatRange
  .mr = ram_device MR
  .addr.size = 实际区间大小
       │
       ↓ section_from_flat_range
MemoryRegionSection
  .mr = ram_device MR
  .size = FlatRange.addr.size
  .offset_within_address_space = GPA
       │
       ↓ kvm_region_add → kvm_region_commit
       │   (先 DEL 后 ADD)
       ↓ kvm_set_phys_mem
       │
       ├─ !memory_region_is_ram(mr)?  → 跳过 (IO 类型)
       ├─ kvm_align_section → 0?      → 跳过 (小于 PAGE_SIZE)
       │
       ↓ 组装 KVMSlot
KVMSlot
  .start_addr = GPA
  .memory_size = 页对齐后大小
  .ram = HVA
       │
       ↓ ioctl(KVM_SET_USER_MEMORY_REGION)
       │
                                            kvm_memory_slot
                                              .base_gfn = GPA >> PAGE_SHIFT
                                              .npages = 页数
                                              .userspace_addr = HVA
                                                   │
                                                   ↓ kvm_arch_commit_memory_region
                                                   │   get_user_pages(HVA)
                                                   │   → 查 Host S1 (TTBR0_EL2)
                                                   │   → HPA
                                                   ↓ 填 S2 PTE (VTTBR_EL2)
                                              GPA → HPA (Device-nGnRE)
```

链路中有两个关键过滤点：

1. `kvm_set_phys_mem` 中的 `!memory_region_is_ram(mr)` 检查（`kvm-all.c:1349`）：IO 类型 MR（`ram=false`）直接跳过，不建 memslot
2. `kvm_align_section` 中的页对齐检查（`kvm-all.c:266`）：section size 小于 PAGE_SIZE 时返回 0，直接跳过

## 6. 实例：正常场景下各 size 字段的值

以 `vfio-pci` 驱动绑定一个 BAR2 物理大小为 64KB 的设备为例，64KB PAGE_SIZE 环境下，QEMU 启动后各结构体的 size 字段值：

| 结构体 | 字段 | 类型 | 值 | 来源 |
|--------|------|------|-----|------|
| `VFIORegion` | `.size` | `size_t` | 64KB (0x10000) | `ioctl` 返回的 `info.size` |
| `VFIOBAR` | `.size` | `size_t` | 64KB | `bar->size = bar->region.size` (pci.c:1785) |
| `VFIOMmap` | `.size` | `size_t` | 64KB | `mmaps[0].size = region->size` (helpers.c:388) |
| `MemoryRegion` (bar->mr) | `.size` | `Int128` | 64KB | `memory_region_init_io(..., bar->size)` (pci.c:1808) |
| `MemoryRegion` (region->mem) | `.size` | `Int128` | 64KB | region setup 时设定 |
| `MemoryRegion` (mmaps[0].mem) | `.size` | `Int128` | 64KB | `memory_region_init_ram_device_ptr(..., mmaps[0].size)` (helpers.c:469) |
| `RAMBlock` | `.size` | `ram_addr_t` | 64KB | `qemu_ram_alloc_from_ptr(size=64KB, ...)` (memory.c:1719) |
| `PCIIORegion` | `.size` | `pcibus_t` | 64KB | `r->size = memory_region_size(bar->mr)` (pci.c:1323) |
| wmask | — | `uint64_t` | 0xFFFFFFFFFFFF0000 | `~(64KB - 1)` (pci.c:1330) |

所有 size 字段都是 64KB，mmap 成功，ram_device MR 创建，KVM memslot 建立，S2 页表就绪。Guest 访问 BAR2 时 S2 命中，硬件直达设备，无 VM exit。

---

# 附录 A：三套页表建立流程与运行时关系

```
 ============================================================
  Phase 1: QEMU mmap  [EL0 -> EL2]
 ============================================================

  QEMU(EL0)                          Host Kernel(EL2)
  ---------                          ----------------
  mmap(vfio_fd, BAR2)
               --------------------->
                                     VFIO driver:
                                       vma->vm_pgoff = BAR2_HPA >> PAGE_SHIFT
                                       vma->vm_ops = vfio_pci_mmap_ops
                                     <---- return HVA ----
  HVA = 0x7fff_xxxx_0000

  [Host S1 PTE: NOT built yet (lazy)]
  [VMA records: HVA range <-> BAR2_HPA page frame]

 ============================================================
  Phase 2: KVM create memslot + build S2  [EL0 -> EL2]
 ============================================================

  QEMU(EL0)                          Host Kernel(EL2)
  ---------                          ----------------
  ioctl(KVM_SET_USER_MEMORY_REGION,
        {GPA=0x8000_200000,
         HVA=0x7fff_xxxx_0000,
         size=64KB})
               --------------------->
                                     kvm_arch_commit_memory_region():
                                       get_user_pages(HVA)
                                         |- walk Host S1 (TTBR0_EL2)
                                         |- Host S1 PTE miss!
                                         |- page fault
                                         |-   vfio_pci_mmap_fault():
                                         |-     io_remap_pfn_range(HVA, BAR2_HPA)
                                         |-     --> Host S1 PTE built: HVA -> HPA
                                         |- HPA = 0x0800_0000_0000

                                       fill S2 PTE (VTTBR_EL2):
                                         GPA 0x8000_200000 -> HPA 0x0800_0000_0000
                                         attr = Device-nGnRE

  [Host S1 PTE: HVA -> HPA]     <-- built as scaffolding
  [Host S2 PTE: GPA -> HPA]     <-- built for Guest runtime

 ============================================================
  Phase 3: Guest ioremap  [EL1]
 ============================================================

  Guest(EL1)
  ----------
  io_base = ioremap(GPA=0x8000_200000, 64KB)
    -> alloc GVA = 0xffff_8000_ca00_0000
    -> fill Guest S1 PTE (TTBR1_EL1):
         GVA 0xffff_8000_ca00_0000 -> GPA 0x8000_200000

  [Guest S1 PTE: GVA -> GPA]    <-- built by Guest OS

 ============================================================
  Runtime: Guest access BAR2  [EL1, hardware, no VM exit]
 ============================================================

  Guest: ldr x0, [x3]   (x3 = GVA 0xffff_8000_ca00_0300)

    GVA 0xffff_8000_ca00_0300
      |
      |  Stage 1: Guest S1 (TTBR1_EL1)     [built in Phase 3]
      v
    GPA 0x8000_2000_0300
      |
      |  Stage 2: Host S2 (VTTBR_EL2)      [built in Phase 2]
      v
    HPA 0x0800_0000_0300
      |
      v
    Device BAR2 register (offset 0x300)

  TTBR0_EL2 (Host S1) is NOT used in runtime translation.
  It only served as scaffolding in Phase 2 to find HPA.

 ============================================================
```

# 附录 B：ops 回调与 MMIO 慢路径派发

`ops`（`MemoryRegionOps *`）定义了该 MR 的 MMIO 读写回调，与 `ram` 互斥——要么走硬件直达（`ram=true`），要么走 QEMU 软件模拟（`ops != NULL`）：

```c
struct MemoryRegionOps {
    uint64_t (*read)(void *opaque, hwaddr addr, unsigned size);     // MMIO 读
    void (*write)(void *opaque, hwaddr addr, uint64_t data, unsigned size); // MMIO 写
    struct {
        unsigned min_access_size;   // 最小单次访问粒度 (1, 2, 4, 8)
        unsigned max_access_size;   // 最大单次访问粒度 (最大 8 字节)
    } valid;
};
```

两类 MR 对比：

| | `ops = NULL, ram = true` | `ops != NULL, ram = false` |
|---|---|---|
| 例子 | `mach-virt.ram`, `mmaps[0].mem` | `region.mem`, GIC, UART |
| Guest 访问路径 | S2 命中 → 硬件直达设备 | S2 miss → VM exit → QEMU ops 回调 |
| KVM 建 memslot? | 是 | 否 |
| 速度 | 快（无 VM exit） | 慢（每次都要退出到 QEMU） |
| 访问粒度限制 | 无（任意大小） | 受 `ops->valid.max_access_size` 限制（最大 8 字节） |

VFIO BAR 场景下快路径与慢路径的分界：

```
mmap 成功时 (ram_device MR 存在):
  mmaps[0].mem  ← ops = NULL, ram = true
  → KVM memslot → S2 PTE → Guest 直接 S2 访问 → 硬件直达 (fast path)

mmap 失败时 (仅有 IO MR):
  region.mem    ← ops = vfio_region_ops, ram = false
  → 无 memslot, 无 S2 映射
  → Guest 访问 → S2 miss → VM exit → KVM_EXIT_MMIO → QEMU
  → ops->read/write → vfio_region_read() → pread(VFIO_fd) (slow path)
```

在慢路径中，CPU 触发 Data Abort，硬件填写 ESR 寄存器给 KVM。KVM 对 QEMU 有一个 MMIO 接口：`kvm_run` 结构体。KVM 填充后返回给 QEMU，QEMU 自己决定如何分发到具体的 MR：

```
Guest ldr → S2 miss → VM exit

KVM [Host EL2] 解码 ESR, 填充 kvm_run:
  kvm_run->mmio.phys_addr = GPA 0x8000_200300
  kvm_run->mmio.len       = 8
  kvm_run->mmio.is_write  = false
  kvm_run->exit_reason    = KVM_EXIT_MMIO
  → 返回 QEMU

QEMU [Host EL0] 收到 KVM_EXIT_MMIO:
  address_space_rw(GPA)
  → 查 FlatView → 找到 region.mem
  → 调用 region.mem->ops->read(...)   ← QEMU 自己的代码, 还在 EL0
  → vfio_region_read() → pread(VFIO_fd) → syscall → 进入 Host EL2
```

KVM 只负责「把这个问题交给 QEMU」，ops 是 QEMU 收到后的内部处理。

> **伏笔**：当 BAR2 mmap 失败后，只剩下 `region.mem`（IO 类型，`ops->valid.max_access_size = 8`）。Guest 执行 `ldp x0, x1, [x3]` 时是 128-bit（16 字节）原子操作，超出 VFIO region ops 的最大粒度，KVM 的 ISV=0 也无法解码指令 → 只能向 Guest 注入 SEA → kernel panic。
