---
title: 'ARM64结构与编程:QEMU_BenOS环境搭建'
date: 2025-09-14 17:21:03
tags:
---

> 项目仓库：[https://github.com/AkiraZheng/BenOS_ARM.git](https://github.com/AkiraZheng/BenOS_ARM.git)

# 一、安装QEMU环境

在Ubuntu 20.04 LTS上安装定制的QEMU环境，需要两个文件`openocd-benos_1.0-3_amd64.deb`，`qemu-system-arm-pi4_4.1.50-3_without_GIC_amd64.deb`

把两个 .deb 文件放在同一目录，然后
```bash
sudo apt update

sudo dpkg -i *.deb          # 先装包
sudo apt-get install -f     # 自动补依赖

sudo apt install gcc-aarch64-linux-gnu
sudo apt install gdb-multiarch
```

# 二、代码仓配置

`armv8_trainning.git-20240318.tar.xz`代码解压到ubuntu中

```bash
sudo mkdir BenOS_code
sudo mv ./armv8_trainning.git-20240318.tar.xz ./BenOS_code/
sudo chmod 777 -R ./BenOS_code
cd ./BenOS_code
tar -Jxf  armv8_trainning.git-20240318.tar.xz
git log --oneline
```

<img src=2025-09-15-00-03-44.png>


在工作目录下载实验参考代码的git repo:

```bash
cd /home/akira/BenOS_Learn/BenOS_code/
mkdir code
git clone ssh://akira@ubuntu/home/akira/BenOS_Learn/BenOS_code/armv8_trainning.git

# git diff 3262911^ f280813 # 查看某一次提交所修改的代码，跟旧代码相比较
```

此时就能生成一个名为`armv8_trainning`的目录，里面有代码

<img src=2025-09-14-18-06-06.png>

代码下有两个分支：

- main：是完整的代码，仅供参考
- my_labs：是BenOS的空骨架，在这里完成实验

<img src=2025-09-15-00-06-15.png>

我们切换到`my_labs`分支进行实验：

```bash
git branch my_lab
git checkout my_lab
git checkout -b my_lab 3262911
# git reset 3262911 --hard
```

当需要提交代码时，可以提交到

```
ssh://akira@ubuntu/home/akira/BenOS_Learn/BenOS_code/armv8_trainning.git
```

# 三、QEMU运行BenOS

在`lab01`的实验中打印一个`hello world`

```bash
make
make run
```

<img src=2025-09-14-18-24-43.png>

代码运行结果：

```shell
akira@ubuntu:~/BenOS_Learn/BenOS_code/code/armv8_trainning/lab01$ make
mkdir -p build
aarch64-linux-gnu-gcc -DCONFIG_BOARD_PI4B -g -Wall -nostdlib -nostdinc -Iinclude -MMD -c src/pl_uart.c -o build/pl_uart_c.o
mkdir -p build
aarch64-linux-gnu-gcc -DCONFIG_BOARD_PI4B -g -Wall -nostdlib -nostdinc -Iinclude -MMD -c src/kernel.c -o build/kernel_c.o
aarch64-linux-gnu-gcc -g -Iinclude  -MMD -c src/mm.S -o build/mm_s.o
aarch64-linux-gnu-gcc -g -Iinclude  -MMD -c src/boot.S -o build/boot_s.o
aarch64-linux-gnu-ld -T src/linker.ld -o build/benos.elf  build/pl_uart_c.o build/kernel_c.o build/mm_s.o build/boot_s.o
aarch64-linux-gnu-objcopy build/benos.elf -O binary benos.bin
akira@ubuntu:~/BenOS_Learn/BenOS_code/code/armv8_trainning/lab01$ make run
qemu-system-aarch64 -machine raspi4 -nographic -kernel benos.bin
Welcome BenOS!
```

Ctrl-A 松手后再按 X 退出

然后尝试用QEMU+GDB进行调试。

在一个终端中输入以下命令，启动qemu的gdb调试环境

```bash
make debug
```

在另一个终端中输入

<!-- gdb的使用方法后面挪到linux技巧中 -->
```bash

gdb-multiarch --tui ./build/benos.elf
(gdb) target remote localhost:1234t
(gdb) b _start
(gdb) c
(gdb) layout regs # 查看寄存器
(gdb) s # 运行下一条指令
# (gdb) n # 跳过当前函数
(gdb) x/x $pc # 查看当前pc地址的值
```

退出：

```bash
(gdb) q
```


