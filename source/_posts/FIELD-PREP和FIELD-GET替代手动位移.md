---
title: FIELD_PREP和FIELD_GET替代手动位移
date: 2025-11-20 01:11:20
tags:
categories: 
- Linux内核基础
---

在 Linux 内核中，处理寄存器字段时经常需要进行位移和掩码操作。传统方式虽然有效，但可读性差、容易出错。为此，内核提供了两个宏：

- `FIELD_GET(mask, val)`：从 `val` 中提取字段

- `FIELD_PREP(mask, val)`：将字段值准备好，放入对应位置

# 传统的方式：手动位移 + 掩码

```c
#define FIELD_SHIFT  8
#define FIELD_MASK   (0xF << FIELD_SHIFT)

u32 reg = (val << FIELD_SHIFT) & FIELD_MASK;      // 设置字段
u32 val = (reg & FIELD_MASK) >> FIELD_SHIFT;      // 读取字段
```

也可能是结合`GENMASK`生成 mask：

```c
#define FIELD_MASK   GENMASK(11, 8)  // 表示一个 4-bit 字段，从 bit 8 到 bit 11 被设成 1，其他位为 0

u32 reg = (val << 8) & FIELD_MASK;
u32 val = (reg & FIELD_MASK) >> 8;
```

虽然 `GENMASK()` 提高了掩码的可读性，但仍需手动处理位移，容易出错。

# 使用 `FIELD_GET()` 和 `FIELD_PREP()`

为了统一风格并减少错误，Linux 内核推荐使用：

- `FIELD_PREP(mask, val)`：将字段值 `val` 放入对应位置

- `FIELD_GET(mask, reg)`：从寄存器中提取字段值

```c
#define FIELD_MASK   GENMASK(11, 8)

u32 reg = FIELD_PREP(FIELD_MASK, val);    // 设置字段
u32 val = FIELD_GET(FIELD_MASK, reg);     // 读取字段
```

这种方式完全避免了手动位移，使代码更简洁、易读。
