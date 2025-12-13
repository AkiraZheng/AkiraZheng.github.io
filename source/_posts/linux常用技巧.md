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
- `:n`: 跳转到第 N 行
- `gg`: 跳转到第一行, 相当于 `1G`
- `G`: 跳转到最后一行
- `w`: 光标跳到下一个单词的开头
- `e`: 光标跳到当前单词的结尾
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

vim 查看一个文件后，用`:vsp`来跟另一个文件进行比较（双屏）

```shell
vim ./file1.c
:vsp ./file2.c
```

然后如果要切到第二个屏进行查找的话，可以用快捷键`CTRL+ww`切过去

## vim 中显示当前文件的 路径&&文件名

在底部输入`:f`然后 Enter


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
sudo du -sh /* 2>/dev/null | sort -hr | head -n 10
# 2>/dev/null: 忽略没有权限访问的目录产生的错误信息
# du 指令按查询结果逐层筛查
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

## 修改默认内核选项

先查看你要改为默认选项的内核的编号

```shell
awk -F\' '/menuentry / { print i++ " : " $2 }' /boot/efi/EFI/openEuler/grub.cfg
```

然后修改grub配置文件，将`GRUB_DEFAULT`的值改为目标内核编号：

```shell
cp /etc/default/grub /etc/default/grub.bak
vim /etc/default/grub
# GRUB_DEFAULT=5
grub2-mkconfig -o /boot/efi/EFI/openEuler/grub.cfg
```

# 3. gdb 调试

## 常用指令

```shell
target remote localhost:1234
b _start
c
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

# 4. qemu 使用

## qemu 指令

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

# 查看分配的 DHCP 租约
virsh net-dhcp-leases default

# 检查默认网络状态
virsh net-list --all

# 销毁默认网络
virsh net-destroy default

# 启动默认网络
virsh net-start default
```

## 查看用qemu起的虚机 pid

`ps -ef | grep qemu`

`ps aux | grep qemu`

# 5. Linux 中对工程代码的跳转、函数查找

## vim 中函数跳转

### way1：使用 cscope 实现函数跳转

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

## 工程目录下查找某个函数名

`grep -r "函数名" path`

`grep -rn "函数名" path # n: 显示行号`

`grep -r "待查找内容" --include="*.c"`


# 6. 编译

## 反汇编

编译完二进制文件`.o`等二进制可执行文件后，可以使用 `objdump -d` 反汇编查看函数的汇编代码。

```shell
objdump -D myfile.o > myfile.s
```