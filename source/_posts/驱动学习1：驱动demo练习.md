---
title: 驱动学习1：驱动demo练习
date: 2025-08-21 11:09:10
tags:
categories:
- Linux内核驱动
---

> 前言
> 
> 环境：openeluer
> 
> 内核：5.10.0+
> 
> 代码参考：
> 
> 通过网盘分享的文件： 链接: https://pan.baidu.com/s/14-4XSjm-wvpqxdWcGoXXvw?pwd=9gj7 提取码: 9gj7 复制这段内容后打开百度网盘手机App，操作更方便哦
> 

# 内核模块相关的基本工具与信息

- lsmod：查看内核模块
- insmod：加载内核模块
- rmmod：卸载内核模块

# 一、hello驱动

在linux中，驱动本身不加载进内核的话就只是个模块，模块加载进内核后，才能被内核调用，所以，我们先编写一个最简单的hello驱动来验证一下

```c
// hello.c
#include <linux/init.h>
#include <linux/module.h>

static int __init hello_init(void){
    printk(KERN_INFO "Hello world! I am Akira\n");
    return 0;
}
module_init(hello_init);

static void __exit hello_exit(void){
    printk(KERN_INFO "Hello world! Akira exit\n");
}
module_exit(hello_exit);

MODULE_AUTHOR("Tian Zheng <tianzheng_edu@163.com>");
MODULE_LICENSE("GPL v2");
MODULE_DESCRIPTION("A Simple Hello World Driver Module");
MODULE_ALIAS("a simple module");
```

其中，

- `module_init()`和`module_exit()`是内核模块的初始化和卸载函数
- `__init`和`__exit`是内核模块的初始化和卸载函数的宏定义
- `MODULE_AUTHOR()`是模块作者的宏定义，`MODULE_LICENSE()`是模块许可证的宏定义，`MODULE_DESCRIPTION()`是模块描述的宏定义

```makefile
# Makefile
KVERS = $(shell uname -r)

obj-m += hello.o

build: kernel_modules

kernel_modules:
	make -C /lib/modules/$(KVERS)/build M=$(CURDIR) modules

clean:
	make -C /lib/modules/$(KVERS)/build M=$(CURDIR) clean
```

运行`make`生成模块文件`hello.ko`

<img src="生成hello_ko文件.png">

运行`insmod hello.ko`加载模块

接着`lsmod | grep hello`查看模块是否加载成功

用`dmesg`能看到末尾有输出了我刚刚在`hello_init()`中打印的`Hello world! I am Akira`信息，模块加载成功

最后用`rmmod hello`卸载模块，重新运行`dmesg`，就能看到`hello_exit()`中输出`Hello world! Akira exit`

恭喜你，完成了第一个驱动的编写与加载！

<img src="第一个hello驱动的加载与测试.png">


# 参考

> [宋宝国驱动git仓](https://gitee.com/PennyLee/learn-LDDD)