---
title: HACDBS v2 硬件脏位清理深度解析 — 基于 Leo Bras patch v2
date: 2026-07-02 20:18:12
tags:
categories:
    - 虚拟化
---

# HACDBS v2 硬件脏位清理深度解析 — 基于 Leo Bras patch v2

**核心问题：**HACDBS 里硬件自动识别 DBM+writable-dirty → writable-clean，**但只在收到 HACDBSBR\_EL2 触发后才执行**，不是随时自动。本文档基于 Leo Bras 2026-06-29 提交的 patch v2（共 13 个 patch, 2186 行）的真实源码。

**配套文档：**《传统脏页 Bitmap 迁移路径深度解析（无 HACDBS）》

# 一、PTE.DBM 位的真实位置

```c
#define KVM_PTE_LEAF_ATTR_HI_S2_DBM    BIT(51)  // ← ★ Dirty Bit Modifier
```

**关键位号：DBM 在 Stage-2 PTE 的 bit[51]**（属于高位段 KVM\_PTE\_LEAF\_ATTR\_HI）。不是 bit[7]（bit[7] 是 S2AP[1]）。这个位号是从 Leo Bras patch v2 的真实源码里查到的。

```text
Stage-2 PTE bits (4KB granule, with FEAT_HACDBS):
  bit[0]    = Valid
  bit[1]    = Type (0=Block, 1=Page)
  bit[2:5]  = AttrIndx
  bit[6:7]  = S2AP  (bit 6=S2AP[0], bit 7=S2AP[1])
  bit[8:9]  = SH
  bit[10]   = AF
  bit[11]   = nG
  bit[50]   = 保留
  bit[51]   = DBM          ← ★ Dirty Bit Modifier (FEAT_HACDBS)
  bit[52]   = UXN
  bit[53]   = PXN
  bit[54]   = Contiguous
```

**DBM + writable-dirty 的语义：**

- AP=RO：writable-clean
- AP=RW：writable-dirty

- **DBM=0 + AP=RO**：→ guest 第一次写会 trap 到 EL2

- **DBM=1 + AP=RO**：→ guest 写直接成功，不再 trap

**硬件在 DBM=1 的前提下，出现permission fault的时候自动恢复写权限** —— 即 "writable-dirty → writable-clean"。这是 ARM ARM DDI 0487M.b 白纸黑字的描述。

# 二、hw\_entries 数据结构与编码

```c
hw_entries = kmalloc_objs(u64, entries_sz, GFP_KERNEL);
// entries_sz = PAGE_SIZE / sizeof(u64) = 512

// hw_entries[i] 编码格式（每个 8 字节）：
//   bit[55:12]  = IPA    (44-bit, max 16TB guest)
//   bit[11:4]   = 保留
//   bit[3:1]    = TTWL   (Translation Table Walk Level)
//   bit[0]      = Valid
```

```c
/* HDBSS entry field definitions */
#define HDBSS_ENTRY_VALID    BIT(0)
#define HDBSS_ENTRY_TTWL_SHIFT  (1)
#define HDBSS_ENTRY_TTWL_MASK   (GENMASK(3, 1))
#define HDBSS_ENTRY_TTWL(x) \
    (((x) << HDBSS_ENTRY_TTWL_SHIFT) & HDBSS_ENTRY_TTWL_MASK)
#define HDBSS_ENTRY_TTWL_RESV   HDBSS_ENTRY_TTWL(-4)
#define HDBSS_ENTRY_IPA         GENMASK_ULL(55, 12)
```

**hw\_entries 的本质：**

- **软件维护**的 u64 数组（512 项 = 一个 page 大小）

- **物理连续内存**（kmalloc，不是 vmalloc），硬件可以直接 DMA-style 读取

- 每个 entry 是 **IPA 列表 + 寻路提示（TTWL）**，告诉硬件「去清这个 IPA 对应的 PTE 的 AP 位，从 writable-dirty 状态 恢复为 writable-clean」

所以 hw\_entries 不是 bitmap（不是 1bit/page 的紧凑结构），而是**显式的 IPA 数组**，每项 8 字节。

**为什么用显式 IPA 而不是 bitmap[i] 直接传给硬件？**

原因：硬件**只知道 IPA 物理地址**，不知道 memslot 的 base\_gfn，也不知道 bitmap 是 per-memslot 的。软件必须做**算术换算**：index i → memslot 内 gfn = base + i → gpa = gfn<<12 → IPA。把 IPA 编码进 entry [55:12]，加上 TTWL 和 Valid，硬件才认得。

# 三、bitmap index → IPA：mask\_to\_hdbss 源码解析

```c
static inline int mask_to_hdbss(unsigned long *mask, u64 *hw_entries,
                                const gfn_t offset, u64 ttwl,
                                int idx, int entries_sz)
{
    while (idx < entries_sz) {
        int j = __ffs(*mask);                // 找 mask 里最低位的 1
        u64 a = gfn_to_gpa(offset + j);      // ← ★ index j → GFN → GPA（IPA）

        hw_entries[idx++] = (a & HDBSS_ENTRY_IPA) |  // IPA 编码进 [55:12]
                            ttwl |                    // TTWL 寻路提示
                            HDBSS_ENTRY_VALID;        // 标记 entry 有效

        *mask &= ~BIT(j);
        if (!*mask)
            break;
    }
    return idx;
}
```

**这一段是你问的"index i 是否传给硬件"的答案：**

**不是直接传 index i，而是做算术换算 → IPA**。三步走：

- **Step 1**：`__ffs(*mask)` 在 mask 里找最低位的 1，得到局部偏移 j（mask 内 0~63）

- **Step 2**：`gfn_to_gpa(offset + j)` —— offset 是 memslot 内的 gfn 起点，+j 是绝对 gfn，左移 12 位变成 GPA/IPA

- **Step 3**：把 IPA 编码进 entry 的 bit[55:12]，加上 TTWL 和 Valid 位，硬件认得

这样硬件扫描 entry 列表时，每个 entry 就是**一个完整的 IPA 寻址指令**，不需要外部上下文。

**TTWL（Translation Table Walk Level）的含义：**

IPA 在 stage-2 里可能映射在 L0/L1/L2/L3 任意一级。TTWL 是**硬件寻路提示**，告诉 PE 从哪一级开始下钻：

- TTWL=0 → L3（最终 4KB page descriptor）

- TTWL=1 → L2（PMD 级 block descriptor）

- TTWL=2 → L1（PUD 级 block descriptor）

- TTWL=-4 → 终止哨兵（`HDBSS_ENTRY_TTWL_RESV`），告诉硬件 hw\_entries 数组结束了

在 patch 里固定用 `HDBSS_ENTRY_TTWL(KVM_PGTABLE_LAST_LEVEL)`（最后一级）作为起始值，意味着软件期望 PTE 都在最末级 —— 这通常是因为 dirty 跟踪只针对 4KB 页。

# 四、dirty\_bit\_clear：软件做的不是"清 dirty"

```c
static int dirty_bit_clear(struct kvm *kvm, u64 *hw_entries, int size)
{
    u64 hcr_el2;
    int ret;

    preempt_disable();

    hcr_el2 = read_sysreg(HCR_EL2);
    write_sysreg(hcr_el2 | HCR_EL2_VM, HCR_EL2);  // ← 进 stage-2 翻译
    __load_stage2(&kvm->arch.mmu);                 // ← 加载 VM 的 stage-2 TTBR

    hacdbs_start(hw_entries, size);                 // ← ★ 配置 HACDBSBR_EL2 触发硬件
    do {
        wfi();                                      // ← CPU 睡，让硬件干活
    } while (this_cpu_read(hacdbs_pcp.status) == HACDBS_RUNNING);

    ret = hacdbs_stop();                            // ← 关 HACDBSBR_EL2.EN
    write_sysreg(hcr_el2, HCR_EL2);                 // ← 退出 stage-2 翻译
    isb();

    preempt_enable();
    return ret;
}
```

```c
static void hacdbs_start(u64 *hw_entries, int size)
{
    int size_b = size * sizeof(hw_entries[0]);
    int size_p2 = max(roundup_pow_of_two(size_b), PAGE_SIZE);
    u64 br;

    /* 不满时填个哨兵 entry（TTWL_RESV），告诉硬件数组结束 */
    if (size_b < size_p2)
        hw_entries[size] = HDBSS_ENTRY_VALID | HDBSS_ENTRY_TTWL_RESV;

    sysreg_clear_set_s(SYS_HACDBSCONS_EL2,
                       HACDBSCONS_EL2_ERR_REASON | HACDBSCONS_EL2_INDEX, 0);

    br = (virt_to_phys(hw_entries) & HACDBSBR_EL2_BADDR_MASK) |
         FIELD_PREP(HACDBSBR_EL2_SZ, ilog2(size_p2) - 12) |
         FIELD_PREP(HACDBSBR_EL2_EN, 1);        // ← ★ EN=1 启动硬件 sweep

    this_cpu_write(hacdbs_pcp.status, HACDBS_RUNNING);
    this_cpu_write(hacdbs_pcp.size, size);
    write_sysreg_s(br, SYS_HACDBSBR_EL2);
    isb();
}

static int hacdbs_stop(void)
{
    write_sysreg_s(0, SYS_HACDBSBR_EL2);    // ← 清 EN，关硬件
    isb();
    if (this_cpu_read(hacdbs_pcp.status) == HACDBS_ERROR) {
        u64 cons = read_sysreg_s(SYS_HACDBSCONS_EL2);
        int idx = FIELD_GET(HACDBSCONS_EL2_INDEX, cons);
        this_cpu_write(hacdbs_pcp.status, HACDBS_IDLE);
        return idx;                          // 返回出错时的 entry index
    }
    return this_cpu_read(hacdbs_pcp.size);
}
```

**dirty\_bit\_clear 不是"清 dirty 的函数"，是"配置 + 唤醒硬件的函数"：**

- ✅ 它做的：写 HCR\_EL2.VM、加载 stage-2、写 HACDBSBR\_EL2（BADDR+SZ+EN）、CPU WFI 等待、中断唤醒后清 EN

- ❌ 它没做：任何 page walk、任何 PTE 修改、任何 dirty 位翻转

**真正"清 dirty"的代码是硬件跑的**（PE 自动 stage-2 walk 命中 PTE，原子做 `W 1→0`）。软件只是触发器。

**WFI（Wait For Interrupt）的意义：**

CPU 进入 idle，释放流水线资源给硬件。HACDBS sweep 完成后通过 **HACDBS 中断**唤醒 CPU：

```c
static irqreturn_t hacdbsirq_handler(int irq, void *pcpu)
{
    u64 cons = read_sysreg_s(SYS_HACDBSCONS_EL2);
    unsigned long err = FIELD_GET(HACDBSCONS_EL2_ERR_REASON, cons);
    switch (err) {
    case HACDBSCONS_EL2_ERR_REASON_NOF:        // 正常完成（No Fault）
        this_cpu_write(hacdbs_pcp.status, HACDBS_IDLE);
        break;
    case HACDBSCONS_EL2_ERR_REASON_IPAHACF:     // IPA Hardware Access Fault
        /* ... */
    }
}
```

`wfi()` 退出时唤醒 CPU，进入 `irq_handler`，检查 HACDBSCONS\_EL2 状态，决定成功还是回退。

# 五、硬件 sweep 工作流程

```text
软件触发 (CPU)
  │
  ├─ write_sysreg(SYS_HACDBSBR_EL2, BADDR | SZ | EN=1)
  │   └─ 硬件识别到 EN=1，开始工作
  │
  └─ wfi()  ← CPU 睡
       │
       ▼
  硬件自动执行：
  │
  ├─ 1. 读取 HACDBSBR_EL2.BADDR → 找到 hw_entries 物理地址
  │
  ├─ 2. 对每个 entry（直到 TTWL_RESV 哨兵）：
  │     a. 取 IPA = entry[55:12]
  │     b. 取 TTWL = entry[3:1]
  │     c. 从 TTWL 级开始 stage-2 walk（L3 → L2 → L1 → L0）
  │     d. 命中 PTE 后，原子操作：
  │          PTE.W   ← 0
  │     e. 写 HACDBSCONS_EL2.INDEX 汇报当前进度
  │
  ├─ 3. 所有 entry 处理完 → 触发 HACDBS 中断
  │
  └─ 4. 软件从 wfi 醒来
       │
       ▼
  软件继续：
  ├─ 检查 HACDBSCONS_EL2.ERR_REASON
  ├─ 如果 NOF（成功）：ret = size（处理的 entry 数）
  ├─ 如果出错：ret = HACDBSCONS_EL2.INDEX（出错时的 entry）
  └─ 写_sysreg(SYS_HACDBSBR_EL2, 0) 关掉 EN
```

**关键原子操作：PTE.W 1→0**

这是**硬件自动完成**的，用户态/内核态软件完全不需要介入（除了写 HACDBSBR\_EL2）。这就是 HACDBS 名字的来源 —— **H**ardware **A**ccelerated **C**lean **D**irty **B**it **S**tate。

结合 FEAT\_HACDBS 的特性：

- guest 第一次写 PTE 时，硬件就**自动做 DBM 0→1 + W 1→0**（无需 trap）

- software 想 reset 整批 dirty 时，调 dirty\_bit\_clear，硬件批量做 **DBM 1→0 + W 0→1**

- 整个过程 hardware 维护 PTE，software 只读 PTE 状态就能知道哪些页 dirty（DBM=1）

**关于 dbm track 时机（KVM\_GET\_DIRTY\_LOG 路径）：**

实际上在 Leo Bras patch v2 里，**dirty tracking 仍然依赖 stage-2 page fault**（guest 写触发的 DABT 路径），由 `mark_page_dirty_in_slot()` 把脏位置入 memslot dirty bitmap。HACDBS/HDBSS 这次 patch 引入的 dirty\_bit\_clear 是**reverse 方向** —— 当 software 已经知道哪些页 dirty（bitmap 里 bit=1），想批量清除硬件记录的 dirty state 时，调用此函数让硬件做 DBM 复位。

所以三阶段分工：

1. **Dirty 标记阶段**：guest 写 → DABT trap → `mark_page_dirty_in_slot()` → 置 memslot dirty\_bitmap

2. **Dirty 取走阶段**：QEMU `ioctl(KVM_GET_DIRTY_LOG)` → xchg bitmap → copy\_to\_user

3. **Dirty 复位阶段**：`dirty_bit_clear()` → HACDBSBR\_EL2 → 硬件批量清 PTE.DBM + 恢复 W

# 六、HACDBS vs 软件 page walk 关键差异

|维度|软件 walk（传统）|HACDBS（patch v2）|
|---|---|---|
|触发入口|`kvm_arch_mmu_enable_log_dirty_pt_masked()`|`__kvm_arch_dirty_log_clear()`|
|路径|软件逐 bit 软件 walk stage-2|硬件批量扫整张 stage-2|
|持锁|`mmu_lock` 长时间持有|持锁时间短（清 DBM 期间硬件做，CPU WFI 中）|
|vCPU 并发|其他 vCPU 阻塞在 mmu\_lock|其他 vCPU 可以正常 schedule（preempt\_disable 不影响）|
|单次开销|O(masks 数) × page walk depth（4 次内存读）|O(N entries) / hardware sweep speed|
|适用规模|小范围 dirty 划算|大范围 dirty 更划算|
|错误处理|简单（软件自己 try again）|复杂（HACDBSCONS\_EL2.ERR\_REASON: NOF / IPAHACF...）|
|WFI|不用|CPU 睡眠，硬件 async 干活|
|PTE 修改|软件改 W 位|硬件原子做 DBM 1→0 + W 0→1|
|hw\_entries 内存|不用|kmalloc 一页（512 项）|
|中断|不用|HACDBS 中断唤醒 WFI|

**最关键的差异：**软件 walk 是一次一页（per-bit 软件 page walk），HACDBS 是一次一批（per-batch 硬件 sweep）。两者**触发时机不同**，不是替代关系：

- **软件 walk**在 KVM\_GET\_DIRTY\_LOG 里立即生效（mask + enable\_log\_dirty\_pt\_masked）

- **HACDBS**在 KVM\_GET\_DIRTY\_LOG 后**异步**生效（dirty\_bit\_clear 写 HACDBSBR\_EL2）

实际上 Leo Bras patch 里，`__kvm_arch_dirty_log_clear()` 是**替换**软件 walk 路径 —— 主框架代码不调用 `kvm_arch_mmu_enable_log_dirty_pt_masked()`，而是调用 arch-generic 的 `kvm_arch_dirty_log_clear()`，arm64 实现里就走 HACDBS 路径。

# 七、完整调用链（基于 patch v2）

```text
QEMU 迁移线程
  │
  └─ ioctl(KVM_GET_DIRTY_LOG)                  [QEMU 发起]
       │
       └─ kvm_vm_ioctl_get_dirty_log()          [virt/kvm/kvm_main.c 主框架]
            │
            └─ kvm_get_dirty_log_protect()      [主框架，未改]
                 │
                 ├─ kvm_arch_sync_dirty_log()       [arm64: 空操作]
                 │
                 ├─ mask = xchg(&dirty_bitmap[i], 0)    ← 原子清零
                 │
                 └─ ★ kvm_arch_dirty_log_clear()       [新加 arch-generic 接口]
                       │
                       └─ __kvm_arch_dirty_log_clear()  [arm64 实现, dirty_bit.c]
                            │
                            ├─ hw_entries = kmalloc_objs(u64, 512)   ← 申请 hw_entries
                            │
                            ├─ write_lock(&kvm->mmu_lock)
                            │
                            ├─ for i in [start, end):                 ← 遍历 bitmap 每个 long
                            │     │
                            │     ├─ mask = xchg(&dirty_bitmap[i], 0)
                            │     │
                            │     └─ do {
                            │           idx = mask_to_hdbss(&mask, hw_entries,
                            │                                offset, ttwl, idx, entries_sz)
                            │           if (idx >= entries_sz) {
                            │               ret = dirty_bit_clear(kvm, hw_entries, idx);
                            │               if (ret != idx) goto error;
                            │               idx = 0;
                            │           }
                            │       } while (mask);
                            │
                            ├─ if (idx != 0)
                            │     dirty_bit_clear(kvm, hw_entries, idx);
                            │
                            ├─ write_unlock(&kvm->mmu_lock)
                            │
                            └─ kfree(hw_entries)
                            │
                            └─ dirty_bit_clear(kvm, hw_entries, idx)   ← ★ 触发硬件
                                 │
                                 ├─ preempt_disable()
                                 │
                                 ├─ hcr_el2 = read_sysreg(HCR_EL2)
                                 │  write_sysreg(hcr_el2 | HCR_EL2_VM, HCR_EL2)
                                 │  __load_stage2(&kvm->arch.mmu)              ← 进 stage-2 翻译
                                 │
                                 ├─ hacdbs_start(hw_entries, size)
                                 │   ├─ hw_entries[size] = TTWL_RESV (哨兵)
                                 │   ├─ br = virt_to_phys(hw_entries) | SZ | EN=1
                                 │   └─ write_sysreg_s(br, SYS_HACDBSBR_EL2)     ← ★ 启动硬件
                                 │
                                 ├─ wfi()                                          ← CPU 睡
                                 │
                                 │  ┌──────────────────────────────┐
                                 │  │ 硬件自动 sweep（并行执行）: │
                                 │  │  对每个 entry:               │
                                 │  │    stage-2 walk → PTE        │
                                 │  │    DBM 1→0 + W 0→1 (原子)   │
                                 │  │    写 HACDBSCONS_EL2.INDEX  │
                                 │  └──────────────────────────────┘
                                 │
                                 ├─ 硬件完成 → HACDBS 中断 → CPU 醒
                                 │  hacdbsirq_handler() 读 HACDBSCONS_EL2.ERR_REASON
                                 │
                                 ├─ hacdbs_stop()
                                 │  └─ write_sysreg_s(0, SYS_HACDBSBR_EL2)        ← 关硬件
                                 │
                                 ├─ write_sysreg(hcr_el2, HCR_EL2)                ← 退出 stage-2
                                 ├─ isb()
                                 └─ preempt_enable()
                 │
                 └─ copy_to_user()                                            ← 给 QEMU
```

**三个 ★ 标记的关键节点：**

- **★ 1（kvm\_arch\_dirty\_log\_clear）**：patch v2 新加的 arch-generic 入口，让 arm64 能用硬件加速

- **★ 2（mask\_to\_hdbss）**：把 bitmap 的 index i 换算成 IPA，编码进 hw\_entries entry

- **★ 3（write\_sysreg HACDBSBR\_EL2）**：唯一的硬件触发点，硬件从这一行开始 sweep

整条链里 software 主导的只有 ★ 1 → ★ 2 → ★ 3，之后就是硬件干活、软件睡觉等中断。

# 八、三个核心问题的最终回答

## 问题 1：硬件会自动识别 DBM+writable-dirty → writable-clean 吗？

**答：是的，但只在收到 HACDBSBR\_EL2 触发后。**

- **触发时机**：`write_sysreg(SYS_HACDBSBR_EL2, BADDR | SZ | EN=1)` 之后

- **硬件行为**：对 hw\_entries 里每个 entry，stage-2 walk 找到 PTE，**原子操作**做 `PTE.DBM ← 0` + `PTE.W ← 1`（即"writable-dirty → writable-clean"）

- **不是随时自动**：硬件不会主动扫描 stage-2，必须 software 显式触发

- **反向自动**（FEAT\_HACDBS 的另一面）：guest 第一次写 PTE 时，硬件**自动**做 `DBM 0→1 + W 1→0`（无需 trap）

## 问题 2：hw\_entries 存的是什么？是否需要把 bitmap[i] 的 index i 传给硬件？

**答：hw\_entries 是显式的 IPA 数组，不直接传 index i。**

- **存储内容**：每个 u64 entry 编码 `{IPA[55:12] + TTWL[3:1] + Valid[0]}`

- **为什么不用 bitmap[i]**：硬件只知道 IPA，不知道 memslot 的 base\_gfn。software 必须做算术换算：`index j → gfn = offset + j → IPA = gfn << 12`

- **换算函数**：`mask_to_hdbss()`，对每个 mask 里的 1 bit，`gfn_to_gpa(offset + __ffs(mask))` 转 IPA，编码进 entry

- **内存**：kmalloc 一页（512 项），物理连续，硬件直接 DMA-style 读取

## 问题 3：dirty\_bit\_clear 函数有什么用？既然硬件可以自动识别和复位？

**答：dirty\_bit\_clear 不是"清 dirty 的函数"，是"配置 + 触发硬件的函数"。**

- **它做的**：写 HCR\_EL2.VM、加载 stage-2、写 HACDBSBR\_EL2（BADDR + SZ + EN=1）、CPU WFI 等待、中断唤醒后清 EN

- **它没做的**：任何 page walk、任何 PTE 修改、任何 dirty 位翻转

- **真正的 dirty 清理**由硬件做（PE 自动 stage-2 walk 命中 PTE，原子做 DBM 1→0 + W 0→1）

- **为什么需要这个软件函数**：

    - 硬件不知道哪些页 dirty，必须 software 提供 hw\_entries IPA 列表

    - 软件需要配置 HCR\_EL2.VM + 加载 stage-2 TTBR 来建立硬件 sweep 的上下文

    - 软件需要写 HACDBSBR\_EL2.EN=1 来启动硬件 sweep

    - WFI + 中断机制是 software 和 hardware 的同步点

**一句话总结：**

`dirty_bit_clear()` 把 **bitmap 索引 i** 转换成 **IPA 列表 hw\_entries**，写 **HACDBSBR\_EL2.EN=1** 触发硬件；硬件做 **stage-2 walk → PTE.DBM 1→0 + W 0→1**（即 "writable-dirty → writable-clean"）；完成后 **触发 HACDBS 中断唤醒 CPU**。

# 九、为什么 HACDBS 只做 dirty bit clean？—— 纯属性修改 vs 内存管理操作

**核心结论：**HACDBS 只处理 PTE 的属性 bit（DBM + W），不涉及 HPA 变化、内存分配、内存释放。这种**纯属性修改**操作最适合硬件 MMU 加速。其他涉及 HPA 的 PTE 操作（如 map / unmap / split / move）必须由软件做。

## 9.1 纯属性修改的特征

```text
操作前 PTE:           0x0000_0000_0040_0E01
                    ─┬─ ─┬─ ─┬─ ─┬─ ─┬─ ─┬─
                     │   │   │   │   │   └── bit[0]: Valid=1
                     │   │   │   │   └────── bit[1]: Type=Page
                     │   │   │   └────────── bit[2:5]: AttrIndx=0
                     │   │   └────────────── bit[6]: S2AP[0]=0 (R)
                     │   └────────────────── bit[7]: S2AP[1]=1 (W=1)
                     └────────────────────── bit[51]: DBM=0

修改后 PTE:           0x0000_0000_0080_0E01  ← bit[7] W 清 0，DBM 不变
                    ─┬─ ─┬─ ─┬─ ─┬─ ─┬─ ─┬─
                     │   │   │   │   │   │   │   ← bit[0..6,51] 全部不变
                     │   │   │   │   │   └────── bit[1]: Type=Page (不变)
                     │   │   │   │   └────────── bit[2:5]: AttrIndx=0 (不变)
                     │   │   │   └────────────── bit[6]: S2AP[0]=0 (不变)
                     │   │   └────────────────── bit[7]: S2AP[1]=0 (W=0 ← ★ 改这里)
                     │   └────────────────────── bit[51]: DBM=0 (不变)

HPA:                0x1234_5000  (★ 完全不变)
```

**纯属性修改的关键特征：**

- ✅ **HPA（指向的物理页）完全不变**

- ✅ **其他 bit 完全不变**

- ❌ **只动了 1~2 个 bit**（W 位 / DBM 位 / AF 位）

这种操作本质就是"位翻转"，跟 HPA 是什么没关系，**硬件完全能做**。

## 9.2 硬件做"位翻转"的流程

```text
硬件拿到 IPA（要改哪个 GFN）
  │
  ▼
Stage-2 page walk：找到那个 IPA 对应的 PTE
  │
  ▼
硬件检查：PTE.DBM 是否 = 1？
  │
  ├─ 是 → 原子做：DBM 1→0 + W 0→1
  │       ★ 这是 HACDBS 的目标操作
  │
  └─ 否 → 跳过（PTE 本来就是干净的，不需要改）
  │
  ▼
继续处理下一个 entry
```

**硬件做的四个优势：**

1. **Page walk 走 MMU 内部加速器**（不走系统总线）

2. **原子 RMW**（软件做不到，硬件微码保证）

3. **批量处理**（多个 entry 一次性 sweep）

4. **CPU 睡觉**（WFI，其他 vCPU 不阻塞）

## 9.3 哪些 PTE 操作硬件做不了

|操作|软件做|硬件做|谁做|
|---|---|---|---|
|改 PTE 的一个 bit（W / DBM / AF）|慢但通用|快但受限|**硬件**|
|修改 PTE 指向的物理页（HPA）|必须|❌ 不知道新 HPA|**软件**|
|创建新的 PTE（map 新页）|必须|❌ 需要新分配 HPA|**软件**|
|拆大页（block → 4K × 512）|必须|❌ 需要新表|**软件**|
|删 PTE（unmap）|必须|❌ 需要 put\_page|**软件**|
|解决 TLB miss（自动 walk）|不需要|CPU 自动做|**硬件**|

### 9.3.1 创建新 PTE（map）—— 必须软件做

```text
初始状态：L2 table[5] = 0  （没有 PTE，是无效 entry）
目标：     L2 table[5] = 0x0000_0000_0040_0E01  （创建 PTE）

需要的输入：
  • L0/L1/L2 table 的物理地址（已有）
  • IPA（用户给）
  • HPA（新分配的物理页地址）         ← ★ 硬件不知道
  • 权限位（用户给）                 ← ★ 硬件不知道

硬件能自动获取吗？
  • HPA → ❌ 硬件不知道 HPA，HPA 是 host 内核分配的
  • 权限位 → ❌ 硬件不知道 KVM 想给什么权限
```

**为什么硬件做不了：**

- 硬件不知道新分配的 HPA 是多少（host 内核 alloc\_page 出来的）

- 硬件不知道 KVM 想设什么权限（这是软件策略决定）

- **结论：必须软件做**

### 9.3.2 拆大页（split block descriptor）—— 必须软件做

```text
初始状态：L1 table[3] = 0x0000_0001_2340_0C01  ← Block descriptor (1GB 页)

目标：     L1 table[3] = new_L2_table_phys     ← 变成 table descriptor
          new_L2_table:
            L2[0]   = 0x0000_0001_2340_0C01   ← 拆分后的 4KB PTE #0
            L2[1]   = 0x0000_0001_2350_0C01   ← 拆分后的 4KB PTE #1
            ...
            L2[511] = 0x0000_0001_1234_0C01   ← 拆分后的 4KB PTE #511
```

**为什么硬件做不了：**

- 拆大页要 **kmalloc 一张新的 L2 table**（软件内存分配）

- 要把原来 block descriptor 的属性**展开**到 512 个新 PTE（软件逻辑）

- 要考虑 4KB 对齐、contiguous bit 等复杂属性（软件策略）

- **结论：必须软件做**

### 9.3.3 删除 PTE（unmap）—— 必须软件做

```text
初始状态：L2 table[5] = 0x0000_0000_0040_0E01  ← PTE 指向某页
目标：     L2 table[5] = 0  ← 清空

但是！需要做：
  • 这个页可能被其他进程引用（refcount > 0）
  • 需要 put_page() 释放 host 物理页
  • 需要 unmap 反向通知（mmu notifier）
```

**为什么硬件做不了：**

- 释放物理页涉及 host 内核 refcount（软件语义）

- 需要通知 page cache、文件系统等（软件回调）

- **结论：必须软件做**

### 9.3.4 修改 HPA（move page）—— 必须软件做

```text
初始：L2 table[5] = 0x0000_0000_0040_0E01  ← HPA = 0x1234_5000
目标：L2 table[5] = 0x0000_0000_00A0_0E01  ← HPA = 0x2345_0000 （换了物理页）
```

**为什么硬件做不了：**

- HPA 由 host 内核分配，硬件不知道新 HPA

- 需要 copy 旧页内容到新页（软件 I/O）

- **结论：必须软件做**

## 9.4 一句话本质

**纯属性修改（HPA 不变，只动权限/状态 bit）→ 硬件做最划算**

**涉及 HPA / 内存分配 / 内存释放 → 必须软件做**

## 9.5 对应到 HACDBS 的设计

Leo Bras patch v2 里，**HACDBS 只用于 dirty bit clean**，**不是因为 dirty bit 简单**，而是因为：

1. **dirty bit 翻转是纯属性修改**（DBM 1→0 + W 0→1）

2. **PTE 指向的物理页不变**

3. **不需要新分配内存**

4. **不需要通知其他子系统**

5. **只动 2 个 bit**（DBM + W）

|扩展|操作|PTE 改的 bit|HPA 变吗|
|---|---|---|---|
|FEAT\_HAFDBS|Access Flag 管理|AF（1 bit）|不变|
|FEAT\_HACDBS|Dirty Bit Modifier|DBM + W（2 bit）|不变|
|FEAT\_HDBSS|Dirty 批量扫描|DBM + W（2 bit）|不变|
|FEAT\_BTI|Branch Target Identification|PTE.PXN/UXN 语义|不变|
|FEAT\_PAuth|Pointer Authentication|PTE.PAC 位|不变|

**共同点：全是纯属性修改。**

这是 ARM 硬件扩展的**通用模式**：**软件搞不定的"批量 + 一致性 + 原子性"操作，硬件下沉到 MMU 做。**

HACDBS 不是"硬件替代软件做所有页表管理"，而是"硬件接管软件做不划算的那一类操作（纯属性 bit 翻转）"。

# 十、hw\_entries 与 HDBSS 的精确关系（基于 patch v2 真实数据流）

**本章核心结论：**hw\_entries **就是** HDBSS（同一个东西的两个名字），二者不是"独立"也不是"无关"。HACDBS 引擎通过 HACDBSBR\_EL2.BADDR 拿到这段内存的物理地址，按 HDBSS 协议消费里面的 entry。

## 10.1 命名直接对应

|名称|ARM 规范名|patch v2 代码名|
|---|---|---|
|内存中的 8-byte entry 结构|**HDBSS** (Hardware Dirty Bit State Structure)|`u64 *hw_entries` 数组|
|entry 格式（IPA + TTWL + Valid）|HDBSS entry format|`HDBSS_ENTRY_*` 宏|
|基地址系统寄存器|HACDBSBR\_EL2 (HACDBS HDBSS Base Register)|`SYS_HACDBSBR_EL2`|
|硬件消费引擎|FEAT\_HACDBS mechanism|HACDBS 微架构单元|
|反向解析函数（hw\_entries → bitmap）|（非规范）|`hdbss_to_bitmap()`|
|正向填充函数（bitmap → hw\_entries）|（非规范）|`mask_to_hdbss()`|

**关键观察：**代码里 `hdbss_to_bitmap()` 和 `mask_to_hdbss()` 这两个函数名直接用了 "hdbss"，等同于在说 "处理 HDBSS 的函数"。

所以 **hw\_entries = HDBSS**，是同一个内存结构在软件侧起的不同名字。

## 10.2 ARM ARM 规范里 HDBSS 的定义

**ARM ARM 原文：**

> "The HDBSS is a structure in memory that consists of a sequence of 8-byte entries, each describing a translation table entry to be processed by the FEAT\_HACDBS mechanism."
> 

**翻译：**HDBSS 是**内存中由 8 字节 entry 组成的结构**，每个 entry 描述一个要由 FEAT\_HACDBS 处理的 translation table entry。

→ `u64 *hw_entries` 数组**完全符合这个定义**，没有任何偏移。

## 10.3 HACDBSBR\_EL2 名字里的"HDBSS"

```c
/* 全名 = HACDBS HDBSS Base Register */
#define SYS_HACDBSBR_EL2       ...

/* 字段定义（来自 patch v2） */
#define HACDBSBR_EL2_BADDR_MASK    GENMASK_ULL(55, 12)   // HDBSS 物理地址
#define HACDBSBR_EL2_SZ            GENMASK_ULL(9, 0)     // HDBSS 大小
#define HACDBSBR_EL2_EN            BIT(0)                // 启动 HACDBS 引擎
```

**注意：**`HACDBSBR_EL2` 这个寄存器名字**直接由 HACDBS + HDBSS 复合而成**，全名 = "HACDBS HDBSS Base Register"。

这说明在硬件实现层面，**HACDBS 和 HDBSS 是绑定的**，不是一个独立一个可选 —— 启动 HACDBS 的同时必须提供 HDBSS 的基地址。

## 10.4 hw\_entries 的真实数据流（两条路径）

### 10.4.1 路径 A：从 dirty bitmap 出发（KVM\_GET\_DIRTY\_LOG）

```text
memslot 的 dirty_bitmap (软件维护，1 bit/page, 紧凑)
  │
  │  mask_to_hdbss() 逐个 __ffs 找 1 bit
  │  内部 while 循环: 把 mask 里的 1 bits 转成 IPA
  │  写入 hw_entries[idx++]
  │
  ▼
hw_entries[]  ← 软件填充的 8-byte IPA 列表（HDBSS buffer）
  │
  │  循环复用：塞满 512 项触发一次
  │
  ▼
HACDBSBR_EL2.BADDR ← virt_to_phys(hw_entries)
HACDBSBR_EL2.EN = 1
  │
  ▼
硬件 HACDBS 引擎
  │  按 HDBSS 协议逐 entry 消费
  │  stage-2 walk + atomic DBM 1→0 + W 0→1
  │
  ▼
PTE (硬件 atomic 修改)
  │
  │  HACDBS 中断唤醒 CPU
  │
  ▼
ret = 实际处理 entry 数
  │
  │  错误时: hdbss_to_bitmap() 把 hw_entries 反算回 dirty_bitmap
  │
  ▼
dirty_bitmap (错误恢复用)
```

### 10.4.2 路径 B：从 dirty ring 出发（KVM\_DIRTY\_RING）

```text
dirty_gfns[] ring (软件/硬件维护的 GFN 列表)
  │
  │  for 循环：把 dirty_gfns 转成 hw_entries
  │  gfn = slot_offset + entry->offset
  │  hw_entries[i] = gfn_to_gpa(gfn) | ttwl | Valid
  │
  ▼
hw_entries[]  ← 软件填充的 8-byte IPA 列表（HDBSS buffer）
  │
  │  满则触发
  │
  ▼
HACDBSBR_EL2.BADDR ← virt_to_phys(hw_entries)
HACDBSBR_EL2.EN = 1
  │
  ▼
硬件 HACDBS 引擎消费（HDBSS 协议）
  │
  ▼
PTE atomic 修改
  │
  ▼
成功 entry 对应 dirty_gfns 标为 invalid
ring->reset_index += ret
```

## 10.5 真实调用节奏：批量填充 + 满则触发

```c
hw_entries = kmalloc_objs(u64, 512, GFP_KERNEL);  // 一次性分配
write_lock(&kvm->mmu_lock);

for (unsigned long i = start; i < end; i++) {   // 遍历 bitmap 每个 long
    unsigned long mask = xchg(&dirty_bitmap[i], 0);

    do {
        // ★ 把 mask 里的 1 bits 填进 hw_entries
        // mask_to_hdbss 内部是 while 循环
        idx = mask_to_hdbss(&mask, hw_entries, offset, ttwl, idx, entries_sz);

        // ★ 塞满 512 项就立刻触发一次
        if (idx >= entries_sz) {
            ret = dirty_bit_clear(kvm, hw_entries, idx);  // 硬件 sweep
            idx = 0;  // 重置，继续往里塞
        }
    } while (mask);
}

// 最后不满 512 项的也触发一次
if (idx != 0)
    ret = dirty_bit_clear(kvm, hw_entries, idx);

write_unlock(&kvm->mmu_lock);
kfree(hw_entries);  // 一次性释放
```

**三个关键节奏：**

1. **批量填充**：软件持续往 hw\_entries 塞 IPA（mask\_to\_hdbss 内部 while）

2. **满则触发**：塞满 512 项才让硬件处理一次；如果总量是 2000 项，可能触发 4 次硬件 sweep（512+512+512+464）

3. **循环复用**：整段 hw\_entries **不重新分配**，触发后清零 idx 继续塞

**三个常见误解：**

- ❌ "软件一把填完再给硬件" —— **错**。是循环复用，每满 512 项就触发一次

- ❌ "软件一条一条触发" —— **错**。是批量，per-bit 触发开销太大

- ❌ "hw\_entries 跟 HDBSS 没关系" —— **错**。hw\_entries 就是 HDBSS 在 patch v2 里的代码命名

## 10.6 一句话总结

**hw\_entries = HDBSS = 同一段物理内存**，里面是 8-byte entry 数组，每个 entry 编码 \{IPA + TTWL + Valid\}。

**软件的工作**：从 dirty\_bitmap 或 dirty\_gfns ring 抽出要清 dirty 的 PTE 列表，**循环复用**地填进 HDBSS buffer，**满 512 项**就把 HDBSS 物理地址写进 HACDBSBR\_EL2.BADDR 并置 EN=1，触发硬件 sweep。

**硬件的工作**：按 HDBSS 协议**逐 entry 消费**，对每个 entry 做 stage-2 walk + atomic 改 PTE.DBM + PTE.W，完成后触发 HACDBS 中断唤醒 CPU。

> (注：内容由 AI 生成，请谨慎参考）
