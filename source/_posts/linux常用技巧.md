---
title: linux常用技巧
date: 2025-09-03 15:50:10
tags:
---

# 1. vim

- `.`:小数点，重复上一次的命令

## vim 中进行查找

1）基本查找命令

查找下一个匹配项：

```
/<搜索内容>
```
- 按下 / 键，输入要查找的内容，然后按下回车键 Enter。
- 例如：`/hello`表示查找  hello

2）跳转到另一个查找结果

`/hello`查找后，要先按 enter 键，然后按 `n` 键才能跳转到下一个匹配项。

- 跳转到下一个匹配项：按`n`键
- 跳转到上一个匹配项：按`N`键

3）[vim-drawit操作指南](https://www.cnblogs.com/imzhi/p/vim-drawit.html)

## vim 中复制粘贴

复制：

- `yy`: 复制当前行
- `nyy`: 复制从当前行开始的 n 行（例如：`3yy` 复制当前行及其下两行，共三行）

粘贴：

- `p`: 在光标后粘贴

## 光标移动

- `NG`: 跳转到第 N 行
- `:n`: 跳转到第 N 行（好用！）
- `gg`: 跳转到第一行, 相当于 `1G`
- `G`: 跳转到最后一行
- `w`: 光标跳到下一个单词的开头
- `e`: 光标跳到当前单词的结尾
- `$`: 跳转到这一行的末尾
- `%`: 跳转到匹配的括号处（大括号、中括号）
- `*`: 高亮显示所有与当前光标所在单词**相同的单词处**
  - 按 `n` 跳转到下一个匹配处
  - 按 `N` 跳转到上一个匹配处

组合命令：

<start position> <end position> <command>

example:

- `0y$`: 复制从行首到行尾的内容
  - `0`: 行首
  - `y`: 复制
  - `+y`：复制选中的内容到系统剪贴板。(需要安装 xclip,通过`:version`查看当前是否支持与系统剪贴板交互，`-clipboard`为不支持)
  - `$`: 行尾

其他高级组合用法符号说明：

- `viw`：选择当前单词（包括单词的前后空格）
- `0`: 行首
- `^`: 到本行**第一个**非空字符
- `$`: 行尾
- `g`: 到本行**最后一个**非空字符
- `fa`: 到下一个匹配的字符 a 处（可以改变 a 为其他字符）
- `t,`: 到逗号前的第一个字符（逗号可以改变为其他字符）

## 配置vim显示行号

```shell
# 打开vimrc配置文件
vim ~/.vimrc
```

在vimrc配置文件中添加如下内容：

```vim
set number "行号显示
syntax on " 打开语法高亮
set background=dark " 如果背景是黑色，最好加上这句
```

## vim 双屏

### 方法一：vsp

vim 查看一个文件后，用`:vsp`来跟另一个文件进行比较（双屏）

```shell
vim ./file1.c
:vsp ./file2.c
```

如果要打开另一个文件：

```shell
:e ./file3.c
```

然后如果要切到第二个屏进行查找的话，可以用快捷键`CTRL+ww`或者`CTRL+h/j/k/l`通过方向键切过去

### 方法二：-O

加上`-O`参数直接多屏打开多个文件，通过垂直屏幕的方式。

```shell
vim -O file1.c file2.c
```

## vim 中显示当前文件的 路径&&文件名

在底部输入`:f`然后 Enter

## vim 中多个文件选择和切换

```shell
:buffers
```

<img src=2026-01-10-12-05-43.png>

然后找到要跳转的文件的编号，比如上图中的`irqchip.c`的编号是`1`，然后输入：

```shell
:buffer 1
```

## vim 块操作

多行注释：

- `ctrl+v` 进入可视化模式
- 按**方向键**向下多选同一光标下的多行
- 选完按 `shift+i`
- 然后**输入想输入的符号**（如注释）
- 输完按 `esc` 退出编辑模式后就会发现选中的块都加上了注释

如果想实现比如，**把//删除然后替换成“**，需要：
- `ctrl+v`
- `l` 向右选中“//”
- `j` 选中多行
- 按 `c` 删除，并输入 `“` 添加 `“` 字符
- 最后按 `esc`键退出编辑模式



# 2. terminal 操作

## `find`

查找并忽略没有权限的文件的报错信息：

```shell
find / -name "文件名.c" 2>/dev/null
```

## 查找内核的路径

`uname -a`: 显示当前内核信息

`ls -l /usr/src`: 找到 uname -r 显示的版本的内核路径

## 查看bios版本

`sudo dmidecode -t bios`

## 查看操作系统版本

`cat /etc/os-release`

## 查看磁盘哪个占用最高

```shell
df -h
du -sh ./* | sort -rh

sudo du -sh /* 2>/dev/null | sort -hr
# 2>/dev/null: 忽略没有权限访问的目录产生的错误信息
# 后面再加一个 | head -n 10 的话，就只显示占用最高的前10个目录了
```

```
18G     /home
7.5G    /usr
348M    /root
277M    /boot
166M    /var
35M     /etc
12M     /run
40K     /opt
16K     /lost+found
4.0K    /srv
```

假设逐层检查发现是 `/var/crash` 占用最高，如果确认占用最高的目录删除后没有影响，那么就删除该目录：

```shell
rm -rf /var/crash/*
```

## 查看 CPU 使用率

通常用`top`就能查看，但是如果要指定查看某个`CPU`的使用率可以用`mpstat -P 1 1`，这个还可以查看中断率

## 设置环境变量

用 `export` 命令设置环境变量，例如：

配置路径：

```shell
export PATH=$PATH:/usr/local/bin
```

配置变量：

```shell
export $VAR=value
echo $VAR # 验证环境变量是否正确设置到系统中
```

## 开关内核打印

有时候我们在应用层调试程序的时候想暂时屏蔽掉内核的无用打印，可以在 host 用以下方法暂时关闭，这样开启 guest 虚机的时候就不会将内核信息打印到主机中，影响性能：

```shell
echo 0 > /proc/sys/kernel/printk
```

打开内核打印：

```shell
echo 7 > /proc/sys/kernel/printk
```

## 内核编译选项

### 查看已经启动的内核是否包含哪个编译项

内核的编译选项一般存在`/boot/config-$(uname -r)`中，所以可以结合`grep`查看当前内核有没有编进去你想找的编译选项

```shell
# 查看当前包含的所有编译选项
cat /boot/config-$(uname -r)
zcat /proc/config.gz | grep CONFIG_XXX

# 查找有没有 KUT kvm 单元测试的编译选项
grep -r CONFIG_KUT /boot/config-$(uname -r)
```

### 查看编好的 rpm 包是否包含某个编译选项

如果是编了 rpm 包，还没有 rpm 添加进服务器内核，且没有更新内核的话：

```shell
rpm2cpio kernel-xxx.rpm | cpio -idmv # 这样会把内核解压到当前目录下，生成一个`boot`和`lib`目录
grep -r "CONFIG_XXX" .
```

对于已经`rpm -qa`安装的内核包，可以用以下命令查看内核编译选项：

```shell
rpm -q --configfiles kernel-<version>.rpm
```

### linux rpm 包添加 tracing

如果内核没有编译 tracing，可以重新编译内核，添加 tracing 编译选项：

```shell
CONFIG_FTRACE=y
CONFIG_TRACING=y
CONFIG_KPROBES=y
CONFIG_KPROBE_EVENTS=y # /sys/kernel/debug/tracing/kprobe_events
CONFIG_DYNAMIC_FTRACE=y
CONFIG_DYNAMIC_EVENTS=y
CONFIG_FUNCTION_TRACER=y
CONFIG_EVENT_TRACING=y
CONFIG_KPROBE_EVENTS=y
CONFIG_UPROBE_EVENTS=y
# 辅助调试
CONFIG_KALLSYMS=y
CONFIG_KALLSYMS_ALL=y
CONFIG_DEBUG_INFO=y
```

## 修改 linux-root 密码

```shell
sudo passwd root
# 验证sudo的密码后，输入新密码
```

## 设置维持 ssh 连接不断连

```shell
# sudo vim /etc/ssh/sshd_config
sudo vim ~/.ssh/config
```

然后在文件中写入如下内容：
```shell
Host *
    ServerAliveInterval 60
```

最后，记得重启sshd服务：`service sshd restart`

## scp，cp

服务器与服务器之间进行文件传输用scp

`scp user1@ip1:/home/user1/file1.txt user2@ip2:/home/user2/file2.txt`

> [设置维持 ssh 连接不断连](https://ngwind.github.io/2019/01/25/%E4%BF%9D%E6%8C%81ssh%E6%9C%8D%E5%8A%A1%E8%BF%9E%E6%8E%A5%E4%B8%8D%E6%96%AD%E5%BC%80%E7%9A%84%E6%96%B9%E6%B3%95/)

单个服务器内进行文件复制粘贴用cp

`cp file1.txt file2.txt`

`cp -r /home/dir1 /home/dir2` 在源目录下有子目录时，用-r参数，表示递归复制

## ll 文件字节数

```shell
akira@akira:~/linux-code$ ll tags
-rw-rw-r-- 1 akira akira 1005478272 Dec 24 14:00 tags
```

`1005478272`单位是字节，以**3位**为间隔，可以展开成`1,005,478,272`

- 1005478.272 **KB**
- 1005.478272 **MB**
- 1.005478272 **GB**

## 修改默认内核选项

### 方法一（推荐）

这个方法不会把其他内核的 cmdline 刷掉，配完就可以直接重启了

```shell
grubby --default-kernel #查看默认启动内核
grubby --set-default /boot/vmlinuz-xxx # 可以先 ls /boot/ 查看有哪些内核，然后把想要的内核设置为默认内核
```

### 方法二

先查看你要改为默认选项的内核的编号

```shell
awk -F\' '/menuentry / { print i++ " : " $2 }' /boot/efi/EFI/openEuler/grub.cfg
```

然后修改grub配置文件，将`GRUB_DEFAULT`的值改为目标内核编号：

```shell
cp /etc/default/grub /etc/default/grub.bak
vim /etc/default/grub
# GRUB_DEFAULT=5
grub2-mkconfig -o /boot/efi/EFI/openEuler/grub.cfg  # 每次都会刷新 grub 文件，把生成的 grub 中其他内核新增的 cmdline 也刷掉
```

# 3. gdb 调试

## 常用指令

```gdb
gdb-multiarch --tui ./build/xxx.elf 
target remote localhost:1234
b _start
c
b kernel_main
c
```

```gdb
layout regs # 查看寄存器
s # 运行下一条指令
# n # 跳过当前函数
x/x $pc # 查看当前pc地址的值
q # 退出
```

## 查看某个地址处内存的值：

按当前寄存器值查看

看 x1 指向的同一块目的地址`x/4xg 0x200000`

> [gdb查看内存的值](https://blog.csdn.net/u014470361/article/details/102230583)

## 查看变量值

2. 查看变量值

你可以在调试过程中查看变量的值。例如，要查看 index 的值：

```shell
(gdb) print index
```

查看 data 数组的某个元素：

```shell
(gdb) print data[0]
```

print / p

```gdb
p var        # 打印变量值
p i          # 打印整数 i 的值
p/x i        # 以十六进制打印 i
p/d i        # 以十进制打印 i
p/t i        # 以二进制打印 i
p/f fval     # 打印浮点数
```


print string 指针

```gdb
p s
$1 = 0x555555559260 "hello world"
p *s
$2 = 104 'h'       # 打印第一个字符
```


print 数组

```gdb
p arr        # 打印数组指针
p *arr@10    # 打印 arr 数组的前10个元素
p arr[0]     # 打印数组第一个元素
```

## 设置断点

函数断点

```gdb
break main          # 在 main 函数处断点
break my_func       # 在 my_func 函数入口断点
c
```

行号断点

```gdb
break main.cpp:25    # 在 main.cpp 第25行设置断点
c
```

条件断点

```gdb
break main.cpp:30 if i==5  # 仅当 i==5 时停下
```

## 运行与继续执行

```gdb
run                 # 从头开始运行
continue / c        # 继续执行到下一个断点
finish              # 执行当前函数并返回
```

## 单步调试


step / s：进入函数内部执行

```gdb
step
```

next / n：执行下一行，但不进入函数内部

```gdb
next
```

你已经在 print_el 里了，那就直接跳出去：

```gdb
(gdb) finish
```

跳到下一个断点：

```gdb
# 设置多个断点后，连续执行到下一个断点
(gdb) break function1
(gdb) break function2
(gdb) run # 运行程序
(gdb) continue  # 从当前位置执行到function1
(gdb) continue  # 从function1执行到function2
```

stepi / si：按 CPU 指令单步执行

```gdb
stepi
```

nexti / ni：按指令单步，但不进入函数

```gdb
nexti
```

## 调试线程

如果你的程序使用了多线程，gdb 会处理每个线程。你可以使用以下命令查看线程：

```shell
(gdb) info threads
```

这个命令会列出所有线程及其状态。你可以使用以下命令切换到某个特定线程：

```shell
(gdb) thread <thread_number>
```

例如，如果你想切换到线程 2：

```shell
(gdb) thread 2
(gdb) continue
```

## 普通可执行文件调试

**1. 添加编译参数**

首先确保编译可执行文件的`Makefile`中添加了`-g`参数：

```Makefile
gcc -g ......
```

**2. 启动调试器**

在编译完成后，启动 gdb 调试器：

```shell
gdb ./my_program
```

这将启动 gdb 并加载你的程序 my_program

**3. 设置断点**

你可以在你想要的地方设置断点。例如，要在 access_data_array 函数的开头设置断点，可以使用以下命令：

```shell
(gdb) break access_data_array
```

或者，你也可以在特定的行号处设置断点。例如，设置在第 18 行 处：

```shell
(gdb) break 18
```

**4. 运行程序**

```shell
(gdb) run
```

## gdb 调试 qemu

单纯调试用户态qemu代码的话，可以直接在 host 上用 gdb 调试 qemu 进程：

```shell
gdb --args <普通的启动起虚机指令>
(gdb) b main
(gdb) r
(gdb) bt full        # 查看完整调用栈和局部变量
(gdb) disassemble    # 查看汇编代码
(gdb) info locals    # 查看局部变量
```

示例：

```shell
[root@localhost kernel]# gdb --args ./qemu_build/qemu-system-aarch64 -accel kvm -machine virt,kernel_irqchip=on,gic-version=3,nvdimm=on -net none -nographic -kernel Image -initrd minifs.cpio.gz -bios QEMU_EFI_2403_SP1.fd -cpu host -m 3G -smp cpus=1,maxcpus=2 -append 'rdinit=init console=ttyAMA0 earlycon=pl011,0x9000000 cpufreq.off=1 kpti=off acpi=on kernel.hardlockup_panic=0 disable_sdei_nmi_watchdog nosoftlockup'
GNU gdb (GDB) openEuler 14.1-4.oe2403sp2
Copyright (C) 2023 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
Type "show copying" and "show warranty" for details.
This GDB was configured as "aarch64-openEuler-linux-gnu".
Type "show configuration" for configuration details.
For bug reporting instructions, please see:
<https://www.gnu.org/software/gdb/bugs/>.
Find the GDB manual and other documentation resources online at:
    <http://www.gnu.org/software/gdb/documentation/>.

For help, type "help".
Type "apropos word" to search for commands related to "word"...
Reading symbols from ./qemu_build/qemu-system-aarch64...
(gdb) b kvm_arm_vcpu_init
Breakpoint 1 at 0x79d464: file ../target/arm/kvm.c, line 100.
(gdb) r
Starting program: /home/zt/kernel/qemu_build/qemu-system-aarch64 -accel kvm -machine virt,kernel_irqchip=on,gic-version=3,nvdimm=on -net none -nographic -kernel Image -initrd minifs.cpio.gz -bios QEMU_EFI_2403_SP1.fd -cpu host -m 3G -smp cpus=1,maxcpus=2 -append rdinit=init\ console=ttyAMA0\ earlycon=pl011,0x9000000\ cpufreq.off=1\ kpti=off\ acpi=on\ kernel.hardlockup_panic=0\ disable_sdei_nmi_watchdog\ nosoftlockup
Missing separate debuginfos, use: dnf debuginfo-install glibc-2.38-59.oe2403sp2.aarch64
Missing separate debuginfo for /home/zt/kernel/CMC_B191/lib64/libbpf.so.0.
The debuginfo package for this file is probably broken.
Missing separate debuginfo for /home/zt/kernel/CMC_B191/lib64/liburing.so.1.
The debuginfo package for this file is probably broken.
[Thread debugging using libthread_db enabled]
Using host libthread_db library "/usr/lib64/libthread_db.so.1".
[New Thread 0xfffff627ec80 (LWP 3059187)]
33 base 0x4000000000 size 0x4000000 enable 1 highmem_compact 1
34 base 0x4010000000 size 0x10000000 enable 1 highmem_compact 1
35 base 0x8000000000 size 0x8000000000 enable 1 highmem_compact 1
36 base 0x10000000000 size 0x1000 enable 1 highmem_compact 1
37 base 0x10001000000 size 0x1000000 enable 1 highmem_compact 1
38 base 0x18000000000 size 0x8000000000 enable 1 highmem_compact 1
39 base 0x20000000000 size 0x8000000000 enable 1 highmem_compact 1
40 base 0x28000000000 size 0x100000000 enable 1 highmem_compact 1
41 base 0x28100000000 size 0x300 enable 1 highmem_compact 1
42 base 0x40000000000 size 0x20000000000 enable 1 highmem_compact 1
43 base 0x60000000000 size 0x20000000000 enable 1 highmem_compact 1
configure accelerator virt-8.2 start
machine init start
TLBID: KVM_CAP_ARM_TLBIDOMAIN not supported, hack max_vdomains=32
cpu init start
[New Thread 0xfffff5368c80 (LWP 3059189)]
[Switching to Thread 0xfffff5368c80 (LWP 3059189)]

Thread 3 "qemu-system-aar" hit Breakpoint 1, kvm_arm_vcpu_init (cs=cs@entry=0xaaaaacb28d60) at ../target/arm/kvm.c:100
warning: 100    ../target/arm/kvm.c: No such file or directory
Missing separate debuginfos, use: dnf debuginfo-install brotli-1.1.0-1.oe2403sp2.aarch64 bzip2-1.0.8-8.oe2403sp2.aarch64 cyrus-sasl-lib-2.1.28-5.oe2403sp2.aarch64 daxctl-libs-78-2.oe2403sp2.aarch64 dtc-1.7.0-3.oe2403sp2.aarch64 e2fsprogs-1.47.0-8.oe2403sp2.aarch64 elfutils-libelf-0.190-10.oe2403sp2.aarch64 elfutils-libs-0.190-10.oe2403sp2.aarch64 glib2-2.78.3-8.oe2403sp2.aarch64 keyutils-libs-1.6.3-9.oe2403sp2.aarch64 kmod-libs-30-4.oe2403sp2.aarch64 krb5-libs-1.21.2-15.oe2403sp2.aarch64 libatomic-12.3.1-95.oe2403sp2.aarch64 libblkid-2.39.1-22.oe2403sp2.aarch64 libcap-2.69-5.oe2403sp2.aarch64 libcurl-8.4.0-18.oe2403sp2.aarch64 libffi-3.4.4-4.oe2403sp2.aarch64 libidn2-2.3.4-1.oe2403sp2.aarch64 libmount-2.39.1-22.oe2403sp2.aarch64 libnghttp2-1.58.0-2.oe2403sp2.aarch64 libnl3-3.7.0-5.oe2403sp2.aarch64 libpsl-0.21.2-1.oe2403sp2.aarch64 libselinux-3.5-4.oe2403sp2.aarch64 libssh-0.10.5-3.oe2403sp2.aarch64 libunistring-1.1-2.oe2403sp2.aarch64 libuuid-2.39.1-22.oe2403sp2.aarch64 libxcrypt-4.4.36-3.oe2403sp2.aarch64 ncurses-libs-6.4-9.oe2403sp2.aarch64 openldap-2.6.5-6.oe2403sp2.aarch64 openssl-libs-3.0.12-17.oe2403sp2.aarch64 pcre2-10.42-13.oe2403sp2.aarch64 systemd-libs-255-43.oe2403sp2.aarch64 xz-libs-5.4.7-6.oe2403sp2.aarch64 zlib-1.2.13-4.oe2403sp2.aarch64 zstd-1.5.5-3.oe2403sp2.aarch64
(gdb) p cs->cpu_index
$1 = 0
(gdb) bt full
#0  kvm_arm_vcpu_init (cs=cs@entry=0xaaaaacb28d60) at ../target/arm/kvm.c:100
        cpu = <optimized out>
        init = {target = 2871283072, features = {43690, 2897382752, 43690, 2897382752, 43690, 2897394016, 43690}}
#1  0x0000aaaaab241b34 in kvm_arch_init_vcpu (cs=cs@entry=0xaaaaacb28d60) at ../target/arm/kvm64.c:943
        ret = 0
        mpidr = 281474795733568
        cpu = 0xaaaaacb28d60
        env = 0xaaaaacb2b9b0
        psciver = 281474795733568
        __PRETTY_FUNCTION__ = "kvm_arch_init_vcpu"
#2  0x0000aaaaab4b4f3c in kvm_init_vcpu (cpu=cpu@entry=0xaaaaacb28d60, errp=0xaaaaac6d00d8 <error_fatal>) at ../accel/kvm/kvm-all.c:498
        s = 0xaaaaac79a430
        mmap_size = <optimized out>
        ret = <optimized out>
        __func__ = "kvm_init_vcpu"
#3  0x0000aaaaab4b6ab8 in kvm_vcpu_thread_fn (arg=arg@entry=0xaaaaacb28d60) at ../accel/kvm/kvm-accel-ops.c:42
        cpu = 0xaaaaacb28d60
        r = <optimized out>
#4  0x0000aaaaab6545ec in qemu_thread_start (args=<optimized out>) at ../util/qemu-thread-posix.c:541
        __cancel_buf = {__cancel_jmp_buf = {{__cancel_jmp_buf = {187650018900256, 187650018900576, 960, 281474841998080, 281474829188608, 19, 281474787287040, 281474830368768, 0, 281474795736192,
                281474795734032, 14877629996790952176, 0, 14877536904344532532, 0, 0, 0, 0, 0, 0, 0, 0}, __mask_was_saved = 0}}, __pad = {0xfffff5368440, 0x0, 0x0, 0x0}}
        __cancel_routine = 0xaaaaab654650 <qemu_thread_atexit_notify>
        __cancel_arg = <optimized out>
        __not_first_call = <optimized out>
        qemu_thread_args = <optimized out>
        start_routine = 0xaaaaab4b6a50 <kvm_vcpu_thread_fn>
        arg = 0xaaaaacb28d60
        r = <optimized out>
#5  0x0000fffff73500e4 in ?? () from /usr/lib64/libc.so.6
No symbol table info available.
#6  0x0000fffff73b80cc in ?? () from /usr/lib64/libc.so.6
No symbol table info available.
(gdb) c
Continuing.
[Switching to Thread 0xfffff7f86bc0 (LWP 3059185)]

Thread 1 "qemu-system-aar" hit Breakpoint 1, kvm_arm_vcpu_init (cs=cs@entry=0xaaaaacb28d60) at ../target/arm/kvm.c:100
100     in ../target/arm/kvm.c
(gdb) p cs->cpu_index
$2 = 0
(gdb) bt full
#0  kvm_arm_vcpu_init (cs=cs@entry=0xaaaaacb28d60) at ../target/arm/kvm.c:100
        cpu = <optimized out>
        init = {target = 2875641344, features = {43690, 4294961184, 65535, 2871123740, 43690, 2897679344, 43690}}
#1  0x0000aaaaab23e810 in kvm_arm_reset_vcpu (cpu=cpu@entry=0xaaaaacb28d60) at ../target/arm/kvm.c:901
        ret = <optimized out>
        cs = 0xaaaaacb28d60
#2  0x0000aaaaab21eaa4 in arm_cpu_reset_hold (obj=<optimized out>) at ../target/arm/cpu.c:567
        s = <optimized out>
        cpu = 0xaaaaacb28d60
        acc = <optimized out>
        env = 0xaaaaacb2b9b0
#3  0x0000aaaaab4c2774 in resettable_phase_hold (obj=obj@entry=0xaaaaacb28d60, opaque=opaque@entry=0x0, type=type@entry=RESET_TYPE_COLD) at ../hw/core/resettable.c:184
        tr_func = <optimized out>
        rc = 0xaaaaacaacdb0
        s = 0xaaaaacb28de4
        obj_typename = 0xaaaaac77d4d0 "host-arm-cpu"
        __PRETTY_FUNCTION__ = "resettable_phase_hold"
#4  0x0000aaaaab4c2ae8 in resettable_assert_reset (obj=obj@entry=0xaaaaacb28d60, type=type@entry=RESET_TYPE_COLD) at ../hw/core/resettable.c:60
        __PRETTY_FUNCTION__ = "resettable_assert_reset"
#5  0x0000aaaaab4c2ed8 in resettable_reset (obj=0xaaaaacb28d60, type=type@entry=RESET_TYPE_COLD) at ../hw/core/resettable.c:45
No locals.
#6  0x0000aaaaab4c1748 in device_cold_reset (dev=<optimized out>) at ../hw/core/qdev.c:255
No locals.
#7  0x0000aaaaaae52c34 in cpu_reset (cpu=cpu@entry=0xaaaaacb28d60) at ../hw/core/cpu-common.c:114
No locals.
#8  0x0000aaaaab221a18 in arm_cpu_realizefn (dev=0xaaaaacb28d60, errp=0xffffffffeac0) at ../target/arm/cpu.c:2399
        cs = 0xaaaaacb28d60
        cpu = 0xaaaaacb28d60
        isar = 0xaaaaacb3ee40
        acc = 0xaaaaacaac700
        env = 0xaaaaacb2b9b0
        pagebits = <optimized out>
        local_err = 0x0
        __func__ = "arm_cpu_realizefn"
        __PRETTY_FUNCTION__ = "arm_cpu_realizefn"
        ms = <optimized out>
        smp_cpus = 1
        has_secure = <optimized out>
#9  0x0000aaaaab4c0e90 in device_set_realized (obj=0xaaaaacb28d60, value=<optimized out>, errp=0xffffffffeb78) at ../hw/core/qdev.c:510
        dev = 0xaaaaacb28d60
        dc = 0xaaaaacaac700
        hotplug_ctrl = 0xaaaaacae6de0
        bus = <optimized out>
        ncl = <optimized out>
        local_err = 0x0
        unattached_parent = true
        unattached_count = 1
        __func__ = "device_set_realized"
        __PRETTY_FUNCTION__ = "device_set_realized"
#10 0x0000aaaaab4c4e74 in property_set_bool (obj=0xaaaaacb28d60, v=<optimized out>, name=<optimized out>, opaque=0xaaaaac79e500, errp=0xffffffffeb78) at ../qom/object.c:2305
        prop = 0xaaaaac79e500
        value = true
#11 0x0000aaaaab4c86d0 in object_property_set (obj=obj@entry=0xaaaaacb28d60, name=name@entry=0xaaaaab7d35d8 "realized", v=v@entry=0xaaaaacb489a0, errp=0xffffffffeb78, errp@entry=0xaaaaac6d00d8 <error_fatal>)
    at ../qom/object.c:1435
        _auto_errp_prop = {local_err = 0x0, errp = 0xaaaaac6d00d8 <error_fatal>}
        prop = <optimized out>
        __func__ = "object_property_set"
#12 0x0000aaaaab4cc03c in object_property_set_qobject (obj=obj@entry=0xaaaaacb28d60, name=name@entry=0xaaaaab7d35d8 "realized", value=value@entry=0xaaaaacb48980, errp=errp@entry=0xaaaaac6d00d8 <error_fatal>)
    at ../qom/qom-qobject.c:28
        v = 0xaaaaacb489a0
        ok = <optimized out>
#13 0x0000aaaaab4c8e00 in object_property_set_bool (obj=0xaaaaacb28d60, name=0xaaaaab7d35d8 "realized", value=<optimized out>, errp=0xaaaaac6d00d8 <error_fatal>) at ../qom/object.c:1504
        qbool = 0xaaaaacb48980
        ok = <optimized out>
--Type <RET> for more, q to quit, c to continue without paging--
        _obj5 = <optimized out>
        __mptr = <optimized out>
#14 0x0000aaaaab1b7bf0 in machvirt_init (machine=0xaaaaacae6de0) at ../hw/arm/virt.c:2941
        cpuobj = 0xaaaaacb28d60
        cs = 0xaaaaacb28d60
        vms = 0xaaaaacae6de0
        vmc = 0xaaaaacabe410
        mc = <optimized out>
        possible_cpus = <optimized out>
        secure_tag_sysmem = 0x0
        secure_sysmem = <optimized out>
        tag_sysmem = 0x0
        sysmem = 0xaaaaacaef520
        n = 0
        virt_max_cpus = <optimized out>
        firmware_loaded = <optimized out>
        aarch64 = true
        has_ged = true
        smp_cpus = <optimized out>
        max_cpus = 2
        cpu_class = <optimized out>
        __PRETTY_FUNCTION__ = "machvirt_init"
#15 0x0000aaaaaaec1acc in machine_run_board_init (machine=0xaaaaacae6de0, mem_path=<optimized out>, errp=<optimized out>, errp@entry=0xaaaaac6d00d8 <error_fatal>) at ../hw/core/machine.c:1511
        _auto_errp_prop = {local_err = 0x0, errp = 0xaaaaac6d00d8 <error_fatal>}
        machine_class = 0xaaaaacabe410
        oc = <optimized out>
        cc = <optimized out>
        __func__ = "machine_run_board_init"
#16 0x0000aaaaab1281ec in qemu_init_board () at ../system/vl.c:2697
No locals.
#17 qmp_x_exit_preconfig (errp=<optimized out>) at ../system/vl.c:2789
        __func__ = "qmp_x_exit_preconfig"
#18 0x0000aaaaab12bb74 in qmp_x_exit_preconfig (errp=<optimized out>) at ../system/vl.c:2784
        __func__ = "qmp_x_exit_preconfig"
        local_err = <optimized out>
#19 qemu_init (argc=<optimized out>, argv=<optimized out>) at ../system/vl.c:3867
        opts = <optimized out>
        icount_opts = <optimized out>
        accel_opts = <optimized out>
        olist = <optimized out>
        optind = 22
        optarg = 0xfffffffff652 "rdinit=init console=ttyAMA0 earlycon=pl011,0x9000000 cpufreq.off=1 kpti=off acpi=on kernel.hardlockup_panic=0 disable_sdei_nmi_watchdog nosoftlockup"
        machine_class = 0xaaaaacabe410
        userconfig = <optimized out>
        vmstate_dump_file = <optimized out>
        __PRETTY_FUNCTION__ = "qemu_init"
#20 0x0000aaaaaae513ac in main (argc=<optimized out>, argv=<optimized out>) at ../system/main.c:49
No locals.
(gdb) c
Continuing.

Thread 1 "qemu-system-aar" hit Breakpoint 1, kvm_arm_vcpu_init (cs=cs@entry=0xaaaaacb84a70) at ../target/arm/kvm.c:100
100     in ../target/arm/kvm.c
(gdb) p cs->cpu_index
$3 = 1
(gdb) bt full
#0  kvm_arm_vcpu_init (cs=cs@entry=0xaaaaacb84a70) at ../target/arm/kvm.c:100
        cpu = <optimized out>
        init = {target = 2871283072, features = {43690, 2897758832, 43690, 2897758832, 43690, 2897770096, 43690}}
#1  0x0000aaaaab241b34 in kvm_arch_init_vcpu (cs=cs@entry=0xaaaaacb84a70) at ../target/arm/kvm64.c:943
        ret = 0
        mpidr = 187649994985712
        cpu = 0xaaaaacb84a70
        env = 0xaaaaacb876c0
        psciver = 187
        __PRETTY_FUNCTION__ = "kvm_arch_init_vcpu"
#2  0x0000aaaaab23ea54 in kvm_arm_create_host_vcpu (cpu=0xaaaaacb84a70) at ../target/arm/kvm.c:952
        cs = 0xaaaaacb84a70
        vcpu_id = 1
        ret = <optimized out>
#3  0x0000aaaaab1b9168 in machvirt_init (machine=0xaaaaacae6de0) at ../hw/arm/virt.c:2965
        cpu_slot = 0xaaaaac79cce8
        cpuobj = 0xaaaaacb84a70
        cs = 0xaaaaacb84a70
        vms = 0xaaaaacae6de0
        vmc = 0xaaaaacabe410
        mc = <optimized out>
        possible_cpus = <optimized out>
        secure_tag_sysmem = 0x0
        secure_sysmem = <optimized out>
        tag_sysmem = 0x0
        sysmem = 0xaaaaacaef520
        n = 1
        virt_max_cpus = <optimized out>
        firmware_loaded = <optimized out>
        aarch64 = true
        has_ged = true
        smp_cpus = <optimized out>
        max_cpus = 2
        cpu_class = <optimized out>
        __PRETTY_FUNCTION__ = "machvirt_init"
#4  0x0000aaaaaaec1acc in machine_run_board_init (machine=0xaaaaacae6de0, mem_path=<optimized out>, errp=<optimized out>, errp@entry=0xaaaaac6d00d8 <error_fatal>) at ../hw/core/machine.c:1511
        _auto_errp_prop = {local_err = 0x0, errp = 0xaaaaac6d00d8 <error_fatal>}
        machine_class = 0xaaaaacabe410
        oc = <optimized out>
        cc = <optimized out>
        __func__ = "machine_run_board_init"
#5  0x0000aaaaab1281ec in qemu_init_board () at ../system/vl.c:2697
No locals.
#6  qmp_x_exit_preconfig (errp=<optimized out>) at ../system/vl.c:2789
        __func__ = "qmp_x_exit_preconfig"
#7  0x0000aaaaab12bb74 in qmp_x_exit_preconfig (errp=<optimized out>) at ../system/vl.c:2784
        __func__ = "qmp_x_exit_preconfig"
        local_err = <optimized out>
#8  qemu_init (argc=<optimized out>, argv=<optimized out>) at ../system/vl.c:3867
        opts = <optimized out>
        icount_opts = <optimized out>
        accel_opts = <optimized out>
        olist = <optimized out>
        optind = 22
        optarg = 0xfffffffff652 "rdinit=init console=ttyAMA0 earlycon=pl011,0x9000000 cpufreq.off=1 kpti=off acpi=on kernel.hardlockup_panic=0 disable_sdei_nmi_watchdog nosoftlockup"
        machine_class = 0xaaaaacabe410
        userconfig = <optimized out>
        vmstate_dump_file = <optimized out>
        __PRETTY_FUNCTION__ = "qemu_init"
#9  0x0000aaaaaae513ac in main (argc=<optimized out>, argv=<optimized out>) at ../system/main.c:49
No locals.
(gdb) c
Continuing.
memory_region_add_reservation 0x28100000000 size 768 round up 4096
create fdt for ubios-information-table 0x28100000000
ubios_info_tables=0x28100000000, ubc_tables_addr=0x28100000040,ubios table size=4096, UBIOS_UBC_TABLE_CNT 1,UBIOS_UMMU_TABLE_CNT 1
ubios root total_size 64
bus controller total_size 440
init ub cluster mode 0
ub_feature sysfs not available, all features disabled
MAR0 decode_addr 0x280030d0000, cc ba 0x400000 size 0x80000, nc ba 0x600000 size 0x80000
MAR1 decode_addr 0x280060d0000, cc ba 0x0 size 0x0, nc ba 0x0 size 0x0
MAR2 decode_addr 0x280080d0000, cc ba 0x0 size 0x0, nc ba 0x0 size 0x0
MAR3 decode_addr 0x2800a0d0000, cc ba 0x480000 size 0x80000, nc ba 0x680000 size 0x80000
MAR4 decode_addr 0x2800c0d0000, cc ba 0x500000 size 0x100000, nc ba 0x700000 size 0x100000
init ubc_table[0]=0x18000000000, interrupt_id=[0x1fff-0x2ffe]
ubc ubios->tables[0] = 0x28100000040 ubc_table = 0xfffff4a00040
ummu total_size 200
ummu vendor info reg_base=0x2800e800000
init ummu_table[0]=0x28040000000,pmu_addr=0x28040005000,pmu_size=0x1000,pmu_interrupt_id=0x898a
ummu ubios->tables[1] = 0x28100000200 ummu_table=0xfffff4a00200
rsv_mem total_size 64
each ub-dev emulated ub cfg size is 0x43800 bytes
alloc ub reg mem size: msgq_reg 1048576, fm_msgq_reg 1048576
ummu disabled.
load the kernel
device init start

Thread 3 "qemu-system-aar" received signal SIGUSR1, User defined signal 1.
[Switching to Thread 0xfffff5368c80 (LWP 3059189)]
0x0000fffff734cac8 in ?? () from /usr/lib64/libc.so.6
(gdb) p cs->cpu_index
No symbol "cs" in current context.
(gdb)
```

## gdb + qemu 调试内核

此时需要内核的 vmlinux 文件，并且需要在编译内核的时候添加`CONFIG_DEBUG_INFO=y`编译选项，这样才能在 gdb 中看到内核的函数名和行号等信息。

起虚机指令：

```shell
qemu-system-aarch64 \
-machine virt,gic-version=3 \
-enable-kvm -cpu host -m 4G -smp 4 -net none -nographic \
-kernel Image -initrd minifs.cpio.gz \
-bios QEMU_EFI.fd \
-append "rdinit=init root=init console=ttyAMA0 earlycon=pl011,0x9000000" \
-s -S
```

一定要加上`-s -S`参数，这样虚机才会在启动后停在第一行，等待 gdb 连接。

接着开启一个新的ssh界面，使用gdb连接到虚机并调试内核：

```shell
gdb vmlinux
(gdb) target remote localhost:1234
# (gdb) b kernel_main 
# (gdb) c
(gdb) b start_kernel 
(gdb) c
```

# 4. qemu 使用

## 将虚机 log 存到文件中

```shell
# 用 tee 指令可以实时把 log 输出到终端的同时也写入到文件中
<启虚机指令> | tee qemu.log 2>&1
```

## qemu 指令

## qemu 制作共享镜像

```shell
qemu-nbd -f qcow2 -c /dev/nbd0 /path/to/image.qcow2
```

## qemu 主线编译运行


### 克隆QEMU工程

克隆工程时必须加入`g--recurse-submodules`把子工程一并克隆下来

```shell
git clone --recurse-submodules https://github.com/qemu/qemu.git
```

**注意：克隆工程时一定要加上`--recurse-submodules`，否则很容易出现版本问题**

### QEMU编译

编译arm64架构下的qemu虚拟机：

```shell
mkdir build
cd build

# 执行前先创建QEMU的Python环境
# 执行 ../configure 时，不加`--target-list`参数的话会使后面 make 时编译所有x86、ARM、RISC-V架构的代码，时间很久

../configure --target-list=aarch64-softmmu

make -j64

ll qemu-system-aarch64 # 确认是否编译成可执行文件
```

编译完确认没报错后，需要打包生成的`qemu-system-aarch64`，然后由于选择的是动态编译，所以需要把所有的动态库打包进去：

```shell
mkdir qemu_build
cp qemu-system-aarch64 qemu_build/
mkdir qemu_build/libs
ldd qemu-system-aarch64 | awk '{print $3}' | grep '^/' | xargs -I {} cp -v {} qemu_build/libs/	#拷贝动态库
tar czf qemu_build.tar.gz qemu_build/
```

### 测试验证

将编译的qemu放到开发板中进行测试验证

```shell
scp qemu_build.tar.gz <user>@<server>:</path/>
tar -xzvf qemu_build.tar.gz
```

启动虚机：

```shell
./qemu_build/qemu_build/qemu-system-aarch64 -machine virt,gic-version=3 \
-enable-kvm -cpu host -m 4G -smp 4 -net none -nographic \
-kernel Image -initrd minifs.cpio.gz \
-bios QEMU_EFI.fd \
-append "rdinit=init root=init console=ttyAMA0 earlycon=pl011,0x9000000"
```

如果编译中出现库找不到的问题，可能是因为编译机跟开发机环境不一样，可以尝试下面的方法：

```shell
patchelf --set-rpath '$ORIGIN/libs' ./qemu_build/qemu-system-aarch64
ldd ./qemu-system-aarch64 | grep '=> /' | awk '{print $3}' | xargs -I {} cp -v {} libs/
```

## virsh 指令

```shell
# 安装相关依赖和启动服务
yum install -y libvirt sshpass
systemctl start libvirtd

# 创建共享目录
mkdir -p /tmp/shared_host

# virsh 启动虚机

virsh define file_name.xml
virsh start file_name --console

# 重新进入虚机
virsh console file_name

# 退出虚机
# ctrl+] 退出

# 查看虚机绑核状态
virsh vcpupin file_name

# 查看全局虚机数量状态
virsh list

# 删除销毁虚机
virsh destroy file_name
virsh undefine file_name

# 查看分配的 DHCP 租约（virsh自动分配给vm的网络IP）
virsh net-dhcp-leases default

# 检查默认网络状态
virsh net-list --all

# 销毁默认网络
virsh net-destroy default

# 启动默认网络
virsh net-start default

# 查看虚机的详细信息（qemu monitor）
virsh qemu-monitor-command <虚机名称> --hmp "<指令>"
# 例如查看虚机的 CPU 信息
virsh qemu-monitor-command vm1 --hmp "info cpus"

```

## 查看用qemu起的虚机 pid

`ps -ef | grep qemu`

`ps aux | grep qemu`

# 5. Linux 中对工程代码的跳转、函数查找

## vim 中函数跳转

### way1：使用 cscope 实现函数跳转（功能更齐全）

如果你的 Vim 配置了 `+cscope` 支持（可以通过 `:version` 命令查看），你可以使用 cscope 来进行函数跳转。

<!-- 安装 ctags

在工程源目录下为所有文件生成 ctags：`ctags -R *`

在 vim 中使用 ctags 跳转：`:tag 函数名` -->

**1.** 生成 cscope 数据库：

在你的项目目录中，生成 cscope 数据库文件。打开终端，进入项目目录，执行：
```shell
cscope -Rbq
```
- R：递归查找源代码。

- b：生成数据库文件。

- q：启用快速查询。

**2.** 在 Vim 中启动 cscope：

启动 Vim 后，使用以下命令打开 cscope 数据库：

```shell
:cs add cscope.out
```

这将加载刚才生成的 cscope 数据库。

**3.** 进行函数跳转：

- 使用 `:cs find c <function_name>` 查找并跳转到某个函数的定义位置。

- 使用 `Ctrl-]` 跳转到光标所在函数的**定义**。

  - `:f` 查看当前跳转到了哪个文件中

- 使用`:tjump/函数名`

- 使用 `Ctrl-T` 返回到跳转之前的位置。

### way2：使用 tag 文件实现函数跳转（基于 ctags）【推荐】

另一个常用的跳转方式是使用 ctags 来生成标签文件，这可以在 Vim 中实现函数的跳转。

**1.** 安装 ctags：

如果你没有安装 ctags，可以通过包管理器安装：

```shell
sudo apt-get install exuberant-ctags
```

**2.** 生成标签文件：

在项目根目录下运行以下命令来生成标签文件：

```shell
ctags -R .
ls
```

- R：递归生成所有源代码文件的标签。

**3.** 在 Vim 中启用 tag 文件：

打开项目后，Vim 会自动加载当前目录下的 tags 文件。你可以使用以下命令手动加载：

在项目根目录启动 Vim：

```shell
vim
```

```shell
:set tags=./tags;
```

**4.** 跳转到函数定义：

将光标移动到你想跳转的函数名上，然后按 `Ctrl-]` 跳转到该函数的定义。

如果要返回到之前的位置，按 `Ctrl-T`。

你还可以使用 `:tag <function_name>` 跳转到函数定义。

<!-- ## shell 中查找整个哪个文件包含某个函数名 -->

## 更新 tag

第一种方法是使用 vim 插件 `vim-gutentags`，它会在保存文件时，自动在后台增量更新 tags 文件。

第二种方法是手动增量更新 tags 文件：

```shell
ctags -R -a .
ctags -R -a <filename>
```

`-a` 参数表示追加模式，这样可以避免每次都重新生成整个 tags 文件。

## 工程目录下查找某个函数名

`grep -r "函数名" path`

`grep -rn "函数名" path # n: 显示行号`

`grep -r "待查找内容" --include="*.c"`

# 6. 打造最强vim ide

安装工具 vim 插件管理工具：

```shell
git clone https://github.com/VundleVim/Vundle.vim.git ~/.vim/bundle/Vundle.vim
```

然后把事先准备好的 `.vimrc` 文件放到 home 目录下，获取链接：[https://pan.quark.cn/s/84d039d2ffc2](https://pan.quark.cn/s/84d039d2ffc2)

```shell
cp /path/to/your/.vimrc ~/.vimrc
```

打开 vim，执行以下命令安装和查看插件：

```shell
vim
:PluginInstall
:PluginList
```

## ctags

安装 ctags：

```shell
sudo apt-get install exuberant-ctags
ctags --version
```

每个工程目录下生成 tags 文件：

```shell
ctags -R .
vim
:set tags=./tags;
```

常用的快捷键有两个：

- `Ctrl-]`：跳转到光标所在函数的定义。
- `Ctrl-T`：返回到跳转之前的位置。

## cscope

ctags 只能跳转到函数定义，无法跳转到函数调用处，而 cscope 可以实现这两个功能。

安装 cscope：

```shell
sudo apt-get install cscope
cscope --version
```

每个工程目录下生成 cscope 数据库文件：

```shell
# 下面的命令会生成 3 个文件： cscope.out、cscope.in.out、cscope.po.out
# 其中 cscope.out 是主要的数据库文件，另外两个是加速索引
cscope -Rbq
```

为了方便使用，我们已经在`.vimrc`中配置好了 cscope 的快捷键：

```vim
"nmap <C-_>s :cs find s <C-R>=expand("<cword>")<CR><CR>
"F5 查找c符号； F6 查找字符串；   F7 查找函数定义； F8 查找函数谁调用了，
nmap <silent> <F5> :cs find s <C-R>=expand("<cword>")<CR><CR> :botright copen<CR><CR>
nmap <silent> <F6> :cs find t <C-R>=expand("<cword>")<CR><CR> :botright copen<CR><CR>
"nmap <silent> <F7> :cs find g <C-R>=expand("<cword>")<CR><CR> 
nmap <silent> <F7> :cs find c <C-R>=expand("<cword>")<CR><CR> :botright copen<CR><CR>
```

常用快捷键说明：`fn + Fx`

- `F5`：查找符号（变量、宏等）
- `F6`：全工程查找光标下的字符串（其中就包含了函数调用处）
- `F7`：全工程查找函数调用处

找到后，会自动打开底部窗口显示查找结果，输入下面的命令后就可以通过`hjkl`键在结果中进行上下选择：

```vim
:copen
```

找到想去的地方后，按回车键 Enter 就可以跳转过去。

<img src=2026-01-10-12-11-45.png>

输入下面的命令关闭窗口：

```vim
:cclose
```

## tagbar

`.vmrc`中已经配置好了 tagbar 插件

- 打开 tagbar 窗口：

```vim
:TagbarToggle
```

- 关闭 tagbar 窗口：

```vim
:TagbarClose
```

## nerdtree

用于左侧显示目录树

`.vmrc`中已经配置好了 nerdtree 插件

## 动态语法检测

`.vmrc`中已经配置好了 Ale 插件，左侧显示语法错误，其中`x`表示错误，`w`表示警告，

`:ALEFix`可以自动修复一些简单的语法错误。

## YCM 代码自动补全

`.vmrc`中已经配置好了 YouCompleteMe 插件，该插件对 vim 的版本号有要求。

同时还需要安装一些依赖：

```shell
sudo apt-get install build-essential cmake vim-nox python3-dev
```

检查 python 版本是否为 Python3：

```shell 
python
```

接下来编译 YouCompleteMe：

```shell
cd ~/.vim/bundle/YouCompleteMe
python3 install.py --clangd-completer
# 如果需要支持 C++11 及以上标准，可以加上 --clang-completer 标志
```

编译完之后，还要把`~/.vim/bundle/YouCompleteMe/third_party/ycmd/examples/.ycm_extra_conf.py`文件复制到`./.vim`目录下：

```shell
cp ~/.vim/bundle/YouCompleteMe/third_party/ycmd/examples/.ycm_extra_conf.py ~/.vim/
```

以及在`.vimrc`中添加了相关配置就行了。

## LSP 自动补全

但是由于 YCM 需要各种 vim 版本要求、python 要求，没达到要求的还要重新编译，非常麻烦，所以推荐使用 LSP 方式来实现代码自动补全。

先安装`clangd`：

```shell
sudo apt-get install clangd
clangd --background-index # 启动后台索引功能
```

`.vimrc`中已经配置相关插件，`:PluginInstall`安装完插件后，在你的 linux 工程目录下创建一个`compile_commands.json`文件：

**linux 内核工程下生成 compile_commands.json：**

linux 的话推荐用`scripts/clang-tools/gen_compile_commands.py`

```shell
make defconfig
scripts/clang-tools/gen_compile_commands.py
```

然后打开`c`文件，可以查看是否启用了 LSP 补全：

```vim
:LspStatus
:LspLog # 遇到问题可以查看日志
```

<img src=2026-01-10-12-36-58.png>

**其他C/C++ 项目生成 compile_commands.json：**

可以使用`cmake`生成：

```shell
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ..
```

这会在项目根目录下生成一个 compile_commands.json 文件，clangd 使用该文件来获取编译选项。

如果你的项目不是用 cmake 构建的，一般 clang 会自动生成`gen_compile_commands.py`，可以利用该工具来生成 compile_commands.json：

```shell
cp /path/scripts/gen_compile_commands.py
python3 gen_compile_commands.py
```

> 参考：[vim安装LSP语法补全插件](https://www.kawabangga.com/posts/3745)

# 7. 编译

## 反汇编

编译完二进制文件`.o`等二进制可执行文件后，可以使用 `objdump -d` 反汇编查看函数的汇编代码。

```shell
objdump -D myfile.o > myfile.s
```

# 8. 硬件参数查询

## 查看 CPU 数、numa数、qemu 线程 pid

```shell
lscpu
numactl -H
```

qemu 进入monitor

```shell
info cpus
```

## 开关 SMT

SMT (Simultaneous Multithreading, 同时多线程) 

也就是假设你的单 P （单 socket 槽）机器上有 64 个物理核，如果**关 SMT**的话，同一时刻只能有 64 个逻辑核，同一时刻也只能有 64 个线程。

但是当**开 SMT**后，可以启用超线程，把逻辑核翻倍，每两个逻辑核公用一套物理核上的资源，但是此时每个物理核上同一时刻可以跑 2 个逻辑核，同时跑 2 个线程。
开 SMT 后重新用`lscpu`查看 cpu 数，可以看到显示的 `cpu online`数量翻倍了。

可以通过以下方式查看 CPU 是否支持 SMT 超线程、以及当前是否开启了 SMT 超线程：

```shell
cat /sys/devices/system/cpu/smt/active 
cat /sys/devices/system/cpu/smt/control 
```

```shell
akira@akira:~$ cat /sys/devices/system/cpu/smt/active 
0 # 说明当前没开，开了的话应该是 1
akira@akira:~$ cat /sys/devices/system/cpu/smt/control 
notimplemented # 说明 CPU 不支持 SMT 超线程，支持的话应该是 on 或者 off
```

# 9. tmux 使用

## 会话管理

**新建会话**

```shell
tmux new -s <session_name>
```

**进入会话**

```shell
tmux a -t <session_name>
tmux attach -t <session_name>
```

**查看会话**

```shell
tmux ls
```

**退出会话**

```shell
# 快捷键：Ctrl + b, 然后按 d # 会话跟窗口分离，可以退出当前会话，但会话还在后台继续运行
# tmux外部：tmux detach -t <session_name>

exits # 不会保留该会话（终止会话）
```

**切换会话**

```shell
tmux switch -t <session_name>
```

**重命名会话**

```shell
tmux rename-session -t <new_session_name>
```

**复制模式：解决鼠标没法上划的问题**

进入：按`ctrl+b`，然后按`[`进入复制模式后，就可以用方向键或者鼠标滚轮上划查看之前的输出了

退出：按`q`退出复制模式。

## 分屏

**分屏**

```shell
# 划分上下两个窗格
tmux split-window

# 划分左右两个窗格
tmux split-window -h
```

**切换窗口**

```shell
# 切换到下一个窗口
Ctrl + b, 然后按 o
# 切换到上一个窗口  
Ctrl + b, 然后按 ;
# 删除当前窗口
Ctrl + b, 然后按 x
```

**窗口快捷键**

```shell
Ctrl+b %：划分左右两个窗格。
Ctrl+b "：划分上下两个窗格。
Ctrl+b <arrow key>：光标切换到其他窗格。<arrow key>是指向要切换到的窗格的方向键，比如切换到下方窗格，就按方向键↓。
Ctrl+b ;：光标切换到上一个窗格。
Ctrl+b o：光标切换到下一个窗格。
Ctrl+b {：当前窗格与上一个窗格交换位置。
Ctrl+b }：当前窗格与下一个窗格交换位置。
Ctrl+b Ctrl+o：所有窗格向前移动一个位置，第一个窗格变成最后一个窗格。
Ctrl+b Alt+o：所有窗格向后移动一个位置，最后一个窗格变成第一个窗格。
Ctrl+b x：关闭当前窗格。
Ctrl+b !：将当前窗格拆分为一个独立窗口。
Ctrl+b z：当前窗格全屏显示，再使用一次会变回原来大小。
Ctrl+b Ctrl+<arrow key>：按箭头方向调整窗格大小。
Ctrl+b q：显示窗格编号。
```

**解决左右分屏后无法精准选中的问题**

```shell
vim ~/.tmux.conf
# 启用鼠标支持（包括选择窗格、调整大小等）
set -g mouse on
# 重新加载配置
tmux source-file ~/.tmux.conf
```

[Tmux 使用教程](https://www.ruanyifeng.com/blog/2019/10/tmux.html)