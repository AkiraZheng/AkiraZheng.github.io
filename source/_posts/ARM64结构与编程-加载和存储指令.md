---
title: 'ARM64结构与编程:加载和存储指令'
date: 2025-09-14 18:45:40
tags:
---

# 一、加载和存储指令

ARM64指令集提供了很多加载和存储指令，比如：

寄存器与物理内存数据之间的加载与存储：

- `ldr`：加载指令，从寄存器B存储的地址内存中加载数据到寄存器
    - `ldr <A>, [<B>]`
    - 寄存器A <--- 寄存器B存储的地址中内存的数据
- `str`：存储指令，将寄存器A中的数据存储到寄存器B存储的 地址内存中
    - `str <A>, [<B>]`
    - 寄存器 A 中的数据 ---> 寄存器 B 存储的 地址内存中
- `ldp`：加载指令，`ldp`指令可以加载 16 个字节
    - `ldp <A>, <B>, [<C>]`
    - 以 C 的值为起始地址，加载这个地址的数据到 A 中，然后 C+8 作为新的起始地址，加载这个地址的数据到 B 中
- `stp`：存储指令
    - `stp <A>, <B>, [<C>]`
    - 存储 A 的数据到 C 地址中，然后存储 B 的数据到 C+8 地址中

值域复制指令

- `mov`：移动指令
    - `mov <A> , value`

比较指令：

- `cmp`：比较指令
    - `cmp <目标操作数>, <源操作数>`
    - 比较的结果会修改标志位
    
`cmp`指令可以根据比较符号来进行跳转：

| 条件描述 | x86 标志位 | AArch64 条件码 | 含义 |
|----------|------------|----------------|------|
| `ax = bx`  | `ZF = 1`              | `eq` (Z=1)               | 相等 |
| `ax != bx` | `ZF = 0`              | `ne` (Z=0)               | 不相等 |
| `ax < bx`  | `CF = 1`              | `lo` / `cc` (C=0) 无符号<br>`lt` (N≠V) 有符号 | 小于 |
| `ax >= bx` | `CF = 0`              | `hs` / `cs` (C=1) 无符号<br>`ge` (N=V) 有符号 | 大于等于 |
| `ax > bx`  | `CF = 0 且 ZF = 0`    | `hi` (C=1 ∧ Z=0) 无符号<br>`gt` (Z=0 ∧ N=V) 有符号 | 大于 |
| `ax <= bx` | `CF = 1 或 ZF = 1`    | `ls` (C=0 ∨ Z=1) 无符号<br>`le` (Z=1 ∨ N≠V) 有符号 | 小于等于 |

使用实例：

```armasm
cmp     x0, x2          ; 设置标志
b.eq    label           ; x0 == x2
b.lt    label           ; 有符号 x0 < x2
b.lo    label           ; 无符号 x0 < x2
```

# 二、简单地址偏移代码实践

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

# 三、实现`memcpy`汇编函数

从 0x80000 地址拷贝 32 个字节到 0x200000 地址。

用`cmp`指令辅助判断是否已经copy了32个字节。
- 一个地址索引对应的存储单元 1 Byte（8 bit）
- 每次`ldr`指令只能 copy 8 个字节，因此 32 个字节需要 4 次`ldr`指令

<img src=2025-09-17-23-57-59.png>

```assembly
//memcpy: copy 32 bytes from 0x80000 to 0x200000
.global my_memcpy_test
my_memcpy_test:
    mov x0, 0x80000 // source address
    mov x1, 0x200000 // destination address
    add x2, x0, 32 // number of bytes to copy
// loop to copy each byte
1:
    ldr x4, [x0], #8 //ldr then add 8 to x0
    str x4, [x1], #8
    cmp x0, x2
    b.cc 1b // if not done, repeat

    ret
```

以读第一次为例：

```
地址      内容（十六进制）
0x80000   0xA0
0x80001   0x00
0x80002   0x38
0x80003   0xD5
0x80004   0x1F
0x80005   0x20
0x80006   0x03
0x80007   0xD5
```

读 `ldr x4, [x0]` 后 `x4 = 0xD50320D53800A0`

# 四、实现`memset`函数

`memset`函数的功能是把一个内存块的每个字节都设置为某个值。其 c 语言实现原型如下：

```c
void *__memset_1bytes(void *s, int num, size_t n){
    char *p = s;
    while(n--){
        *p++ = c;
    }
    return s;
}
```

<!-- 在进行汇编实现时，我们假设内存地址 `s` 和 `count` 不是 16 字节对齐的，需要我们先对齐到 16 字节，然后再进行操作。 -->

这里保证传入的参数地址 s 和 n 是 16 的倍数（按16对齐），num 是 8 字节的。由于 n 的对齐要求是 16，因此我们可以使用`ldp`和`stp`指令进行内存操作，相比 8 字节 8 字节地写入而言，速度会快些。（支持 16 字节对齐）

同时，汇编中的函数允许传参，传参时会用 `x0 ~ x7` 寄存器传递参数，因此，函数的参数个数不能超过 8 个。

在汇编中，我们定义的方法为`__memset_16bytes`，调用这个 memset 函数的语法例子为`__memset_16bytes(0x200000, 0x5555555555555555, 128)`，表示往地址 0x200000 的起始地址中写入 128 个 0x55。

我们先实现一个假设传参对齐的汇编函数：

```assembly
//memset(void *s, int c, size_t n): set n bytes to 0x55
// 0x55 is 1 byte
.global __memset_16bytes
__memset_16bytes:
    // x4 跟第三个传参（x2）的 n 进行对别，作为判断条件
    mov x4, #0

//loop: 一次设置 16 bytes
1:
    stp x1, x1, [x0], #16 //一次写入 16 bytes 到内存
    add x4, x4, #16 //每次增加 16 bytes
    cmp x4, x2 //判断是否达到 n bytes
    b.ne 1b
    
    ret
```

并用规范的声明和调用来进行测试：

```c
//kernel.c
extern void __memset_16bytes(void *dest, unsigned long data, int n);
__memset_16bytes((void*)0x200000, 0x5555555555555555, 128);//memset test
```

<img src=2025-09-21-19-47-12.png>

实际上我们在c语言调用时一般会`memset(0x200004, 0x55, 102)`，也就是不一定保证 16 位对齐，且传入的 data 是单字节的，需要我们在封装的 c 函数中实现对齐判断、自动对齐、填充 data 为8字节的操作。（也就是传入0x55，填充为汇编函数__memset_16bytes可以用的0x5555555555555555）。

对齐到 16 的倍数就是要求地址的 低 4 位必须是 0。因此用`if(addr & (align - 1))`来判断低4位是否为0。

下面在这个汇编函数的基础上，假设内存地址 s 和 n 都不是保证 16 字节对齐的，那么此时，我们在调用所写的汇编函数之前，应该先用 c 语言代码实现对齐：

```c
//memset.c
#include "memset.h"


static void * __memset_1byte(void *s, int c, size_t count)
{
    //对于无法对齐的部分，逐字节设置，纯c语言实现
    char *xs = s;
    while(count--){
        *xs++ = c;
    }

    return s;
}

//s 和 count 要转换成16的倍数对齐，c 要转换成 8 bytes
static void * __memset(char *s, int c, size_t count)
{
    //进行对齐
    char *p = s;
    unsigned long align = 16;
    size_t size, left = count;
    int n,i;
    unsigned long addr = (unsigned long)p;//8 bytes
    unsigned long data = 0ULL;

    // transform c to 8 bytes data(unsigned long)
    //(eg c=0x55 → data=0x5555555555555555)
    for(i = 0; i < 8; i++){
        data |= (((unsigned long)c) & 0xff) << (i * 8);
    }

    //1. check start address is aligned with 16 bytes
    if(addr & (align - 1)){
        //firstly, set the bytes before aligned address
        size = addr & (align - 1);
        __memset_1byte(p, c, size);
        p += size;
        left -= size;
    }

    // align 16 bytes
    //at least 16 bytes need to be set
    if(left >= align){
        n = left / align;
        left = left % align;

        __memset_16bytes(p, data, 16*n);

        if(left){
            __memset_1byte(p + 16*n, c, left);
        }
    }

    return s;
}

void *my_memset(void *s, int c, size_t count){
    return __memset(s, c, count);
}
```

```c
//memset.h
#ifndef __MEMSET_H__
#define __MEMSET_H__

typedef unsigned int size_t;

void *__memset_16bytes(void *s, unsigned long val, unsigned long count);
void *my_memset(void *s, int c, size_t count);

#endif
```

```c
//kernel.c
my_memset((void*)0x200000, 0x55, 128);//memset test
my_memset((void*)0x200004, 0xAA, 102);
```