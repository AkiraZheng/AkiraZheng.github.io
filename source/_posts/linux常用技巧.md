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
  - `$`: 行尾

其他高级组合用法符号说明：

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
set number
```



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

stepi / si：按 CPU 指令单步执行

```gdb
stepi
```

nexti / ni：按指令单步，但不进入函数

```gdb
nexti
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

`ps aux | grep qemu`

# 5. Linux 中对工程代码的跳转、函数查找

## vim 中函数跳转

安装 ctags

在工程源目录下为所有文件生成 ctags：`ctags -R *`

在 vim 中使用 ctags 跳转：`:tag 函数名`

在 vim 中使用`ctrl+]` 跳转到**函数定义**

看完后使用`ctrl+t`返回到函数调用（跳回）

<!-- ## shell 中查找整个哪个文件包含某个函数名 -->

