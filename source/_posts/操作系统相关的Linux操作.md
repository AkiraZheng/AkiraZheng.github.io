---
title: 操作系统相关的Linux操作
date: 2024-05-18 22:39:56
tags:
categories:
- 操作系统
---


# 一、Linux基础知识

## 1.1 Linux下的目录结构

Linux中可以用命令`df -h`查看磁盘的使用情况以及挂载点

<img src="disk_df.png" width="90%">

可以看到根节点`/`挂载在了虚拟机的磁盘`/dev/sda3`上，`/boot`挂载在了`/dev/sda1`上，然后通过命令`df -T`可以查看挂载点的文件系统类型

<img src="disk_df_T.png" width="90%">

`/`的文件系统类型是`ext4`。这是一种常用的日志文件系统。

在根目录下，可以扩展出Linux的目录树状结构，如下：

<img src="linux_dir.png" width="90%">

<img src="linux_dir2.png" width="90%">

## 1.2 Linux下的用户权限

在Linux中可以有很多用户，但是只有`root`用户是**超级用户**，拥有最高权限，其它用户在各自的环境下文件放进自己的**家目录**下，其它用户不能访问，这样大大提高了Linux使用的安全性

<img src="userPrival.png" width="90%">

`root`用户进入后，在`/home`目录下存放了所有用户的**家目录**信息

<img src="home_dir.png" width="90%">

### sudo：切换用户

`sudo`指令是Linux下的一个非常重要的指令，可以让普通用户在执行某些需要超级用户权限的指令时，临时提升权限，而不用切换到`root`用户

系统管理员可以在`/etc/sudoers`文件中配置哪些用户可以使用`sudo`指令

<img src="sudoUser.png" width="90%">

`root`用户可以直接使用`sudo username`切换到其它用户，而不用输入密码

### su：切换用户

`su`指令是切换用户的指令，可以切换到其它用户，但是需要输入密码

`su -`可以切换到`root`用户

<img src="su.png" width="90%">


# 三、Linux下的指令集合

Linux可以通过**shell终端**来执行操作指令

对于终端指令解析：

- `root`：用户名
- `AkiraEdu01`：主机名
- `~`：当前目录
    - `root`用户的`~`目录是`/root`
    - 普通用户的`~`目录是`/home`
- `$`：代表当前是普通用户
- `#`：代表当前是`root`用户

<img src="shell.png" width="90%">

## 3.1 软件安装、压缩和解压

### Linux中的软件安装：

- **CentOS**：`yum`指令
    - `sudo yum install 软件名`
- **Ubuntu**：`apt-get`指令
    - `sudo apt-get install 软件名`

通过HTTP或FTP地址直接从终端控制台下载文件，`wget` 非常稳定，如果是由于网络原因下载失败， `wget` 会不断尝试，直到整个文件下载完毕。：

- `wget http://www.xxx.com/xxx.tar.gz`：下载文件
    - `-c`：继续中断了的文件的下载


### tar：压缩和解压

压缩和解压都是用`tar`指令

- `tar -cvf test.tar test`：将`test`目录压缩为`test.tar`
    - `-c`：创建压缩文件
    - `-v`：显示详细信息
    - `-f`：指定压缩文件名
- `tar -czvf test.tar.gz test`：将`test`目录压缩为`test.tar.gz`
    - `-z`：使用`gzip`压缩
- `tar -xvf test.tar`：解压`test.tar`文件
    - `-x`：解压文件


## 3.2 文件和目录增删改查

### pwd：查看当前目录

<img src="pwd.png" width="90%">

### ls：列出当前目录下的文件

**常用参数：**

- `-a`：列出所有文件，包括隐藏文件
- `-l`：列出详细信息（包括文件权限、文件所有者、文件大小、文件创建时间等）
- `-h`：人性化显示文件大小
- `-t`：按照文件修改时间排序

### cd：切换目录

**常用指令：**

- `cd`：切换到当前用户的家目录
- `cd ~`：切换到当前用户的家目录
- `cd /`：切换到根目录
- `cd ..`：切换到上一级目录
- `cd ./test`：切换到当前目录下的`test`目录

`cd`指令可以使用补全功能，按`Tab`键可以自动补全路径：

<img src="cd_tab.png" width="90%">

### mkdir：创建目录

`mkdir test`：在当前目录下创建`test`目录

### rmdir：删除目录

`rmdir test`：删除当前目录下的`test`目录

### touch：创建文件

`touch test.txt`：在当前目录下创建`test.txt`文件

### rm：删除文件或目录

该指令是一个非常危险的指令，删除后无法恢复

`rm test.txt`：删除当前目录下的`test.txt`文件

`rm -rf test`：删除`test`目录(`-r`表示递归删除，`-f`表示强制删除)

<img src="make-remove.png" width="90%">

### cp：复制文件或目录

`cp test.txt test2.txt`：复制`test.txt`文件为`test2.txt`

`cp -r test test2`：复制`test`目录为`test2`目录

<img src="cp.png" width="90%">

### mv：移动文件或目录

`mv test.txt ./test`：将`test.txt`文件移动到`./test`目录下

`mv test test2`：将`test`目录重命名为`test2`

`mv ./test ./test2`：将`./test`目录移动到`./test2`目录下

<img src="mv.png" width="90%">

### find：查找文件（完全符合）

```shell
find <何处> <何物> <做什么>
```

- `<何处>`：查找的目录
- `<何物>`：查找的什么？（文件名`-name test.txt`、文件类型`-type`、文件大小`-size`）
- `<做什么>`：查找到后做什么？默认不写的话只会显示找到的文件（打印`-print`、删除`-delete`）

`find / -name test.txt`：在根目录下查找`test.txt`文件（这里就没有指定做什么）

`find / -name test.txt -delete`：在根目录下查找`test.txt`文件并删除

`find ./ -name *.txt`：在当前目录下查找所有的`.txt`文件

### locate：查找文件（模糊匹配）

按照文件数据库去匹配查找而不是全盘查找，因此数据库还未更新的话是找不到的

所以一般先执行`updatedb`命令更新数据库

`locate test.txt`：查找文件名中包含`test.txt`的文件

`locate *.txt`：查找所有的`.txt`文件

<img src="search.png" width="90%">

## 3.3 文本操作

### cat：查看小文件内容

`cat`指令会一次性显示文件的**全部内容**，所以对于大文件不适用

`cat test.txt`：查看`test.txt`文件的内容

<img src="cat.png" width="90%">

### less：分页查看文件内容

`less test.txt`：查看`test.txt`文件的内容，按`空格`键翻页，按`q`键退出

- 回车键：向下翻一行
- `y`：向上翻一行
- 空格键：向下翻页
- `b`：向上翻页
- `q`：退出
- `=`：显示当前行号
- `/`：搜索(输入关键字后按`Enter`键)
    - `/^the`：搜索以 "the" 开头的行
    - `/pattern1|pattern2`：搜索包含 pattern1 或 pattern2 的行

### vim编辑器：编辑文件

# 四、Linux下的操作系统和网络操作

## 4.1 系统操作

### 查看进程：ps、top、kill

- `ps`：**静态查看**当前系统运行的进程（快照，不会实时更新）
    <img src="ps.png" width="90%">

    - `ps -ef`：查看所有进程
    - `ps -aux | less`：按CPU和内存使用率排序
- `top`：**动态**查看当前系统运行的进程（每5s实时更新）
    <img src="top.png" width="90%">

    展示的这些进程是按照使用处理器 **CPU** 的使用率来排序的

    `q`：退出
    
    **结果解析：**
    - `PID`：进程ID
    - `USER`：进程所有者
    - `PR`：进程优先级
    - `VIRT`：使用的虚拟内存
    - `RES`：使用的物理内存
    - `SHR`：使用的共享内存
    - `S`：进程状态(S=睡眠，R=运行，Z=僵尸进程)
    - `%CPU`：CPU使用率
    - `%MEM`：RAM使用率
    - `TIME+`：进程运行时间
    - `COMMAND`：进程名称
- `kill`：杀死进程
    - `kill 进程号PID`：杀死进程
    - `kill -9 进程号PID`：强制杀死进程

### 管理进程：systemctl

### reboot：重启系统

需要`root`权限

### shutdown：关机

需要`root`权限

- `shutdown -h now`：立即关机
- `shutdown -h 10`：10分钟后关机

<img src="shutdown.png" width="90%">

<img src="shutdown2.png" width="90%">

### poweroff：关机

不需要`root`权限

## 4.2 网络操作

### 查看网络状态：ifconfig

Windows下的`ipconfig`在Linux下是`ifconfig`，可以查看网络接口的信息，包括IP地址、MAC地址等

<img src="ifconfig.png" width="90%">

其中`lo`是本地回环接口，IP地址是`127。0.0.1`，每台电脑都应该有这个接口，它对应着`localhost`，用于本地测试，在某些需求下，我们要连接自己的服务器进行测试，而又不想让局域网或者外网的用户访问，就可以使用这个接口（比如对某个本地运行的项目，我们可以通过`localhost`或者`127.0.0.1:port`来访问自己的网站，且只能自己看到）

### 连接远程服务器：ssh

我们其实在使用**github**或者**gitee**的时候，经常通过配置`ssh`来连接远程服务器，这样就不用每次都输入密码了，那么它的原理是什么呢？

我们发现`Github`项目都会提供两个网址，一个是`https`的，一个是`ssh`的，所以可以联想到，`ssh`是一种类似于HTTPS的**安全网络协议**，它可以在不安全的网络中为网络服务提供安全的传输环境

我们之前在配置**hexo**的时候，通过`ssh`连接到`github`，这样每次部署到`github`的时候就不用输入密码了，在实现时，我们在本机客户端会生成两个密钥文件：
- `id_rsa`：私钥
- `id_rsa.pub`：公钥

其中**公钥**会被传到服务器配置中，也就是我们在实际操作时将**公钥**添加到`github`的`SSH and GPG keys`中

# 五、Linux下的进阶问题

## 5.1 如何在Linux中找到CPU占用高的进程

前面讲到Linux中的`top`和`ps`指令都可以查看进程列表中的CPU占用率，但是更倾向于用**动态实时更新的top指令**

而用`ps`的话，虽然只能看静态信息，但是可以很方便地过滤掉一些不需要的列信息，比如只看PID、CPU占用率、运行时间和进程名称：

```shell
ps -eo pid,pcpu,time,comm | sort -k 2 -nr | head -n 10
```

这个指令的意思是：
- `-e`：显示所有进程
- `-o`：指定输出的列
- 只显示指定的列：`pid`、`pcpu`、`time`、`comm`
- `sort -k 2 -nr`：按照第二列`pcpu`排序，`-n`表示按照数字排序，`-r`表示降序
- `head -n 10`：只显示前10行（top10）

<img src="ps_sort.png" width="90%">

## 5.2 如何在Linux中排查占用率100%的问题

**1）top指令查看当前CPU占用率最高的进程PID**

```shell
top
```

**2）top查看该进程下各线程的CPU占用率**

```shell
top -H -p 进程号PID
```

**3）执行`pstack`脚本查看当前线程的堆栈信息**

```shell
pstack 进程号PID
```

**4）分析原因**

一般从**死锁**、**自旋(锁)时间过长**、**死循环**、**内存泄漏**、**I/O日志操作过于频繁（少打印DEBUG的信息）**等方面排查

>参考：[Linux下C/C++程序CPU问题分析及优化心得](https://www.cnblogs.com/carsonzhu/p/17109893.html)
>参考：[c++程序 cpu占用过高排查方法](https://blog.csdn.net/weixin_38416696/article/details/125083718)