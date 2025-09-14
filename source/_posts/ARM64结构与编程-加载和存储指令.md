---
title: 'ARM64结构与编程:加载和存储指令'
date: 2025-09-14 18:45:40
tags:
---

# 一、加载和存储指令

ARM64指令集提供了很多加载和存储指令，比如：
- `ldr`：加载指令，从内存中加载数据到寄存器
- `str`：存储指令，将寄存器中的数据存储到内存中
- `ldrb`：加载指令，从内存中加载一个字节数据到寄存器
- `strb`：存储指令，将寄存器中的字节数据存储到内存中

# 二、代码实践

在`kernel.c`中 extern 实现加载和存储指令的汇编代码函数：

```c
extern void ldr_test(void);

void my_ldr_test(void)
{
	ldr_test(); // Call the external assembly function
}
```

其中`ldr_test`函数的实现在`arm_test.S`中：

```armasm
.global ldr_test
ldr_test:
    mov x1, 0x80000 // address 0x80000 in x1
    mov x3, 16 // Load immediate decimal value 16 into x3

    ldr x0, [x1] // Load the value from memory address in x1 (0x80000) into x0

    ldr x2, [x1, #8] // Load the value from memory address (x1 + 8) into x2

    ldr x4, [x1, x3] // Load the value from memory address (x1 + x3) into x4, it's 0x80010

    ldr x5, [x1, x3, LSL #3] // Load the value from memory address (x1 + (x3 << 2)) into x5, it's 0x80040

    ret
```

然后就能编译运行。

<img src=2025-09-14-19-33-07.png>