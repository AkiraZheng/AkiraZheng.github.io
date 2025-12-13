---
title: openeluer安装与内核替换
date: 2025-08-17 20:15:29
tags:
---

> 前言
> 
> 主机系统：Sonoma 14.4.1（x86）
> 
> 虚拟软件：VMware Fusion
> 
> openeluer系统：openEuler-24.03-LTS-SP2-x86_64-dvd.iso
> 
> 内核选择：linux 5.x 内核 64G
> 

# 一、Mac工具准备

1. 虚拟软件：[VMware Fusion](https://mp.weixin.qq.com/s/Mg4byIT8W1ys-odz5Yk9Gw)
2. ssh远程控制软件：[Termius](https://www.mac78.com/911.html#J_DLIPPCont)

# 二、虚拟机安装openeluer系统

首先去欧拉官网下载openeluer系统镜像文件：[openEuler](https://www.openeuler.org/zh/download/)，下载LTS长期支持的版本

<img src="openeluer官网.png">

镜像文件下载完成后，在虚拟软件 `VMware Fusion` 中创建虚拟机，选择镜像文件并拖入到 `VMware` 中：

<img src="1. 新建.png">

然后选个linux内核和固件后直接安装：

<img src="3. 选个内核.png">

<img src="4. 选择固件.png">

然后选择自定义配置进行配置：

<img src="5. 自定义配置.png">

常选择的配置如下(可以通过**虚拟机->设置**打开配置界面)：

<img src="6. 选择需要修改的配置进行修改.png">

先分配一个较大的磁盘空间：

<img src="7. 分配一个较大的固态存储.png">

选择**显示全部**回到配置选择界面：

<img src="6_1. 返回去配置前面的选项.png">

然后继续配置内存，将内存配置为4G（一定要换，最低4G）：

<img src="8. 分配4GB的内存.png">

配置完硬件配置后，就可以直接开启虚拟机进行安装了：

<img src="9.配置完就可以直接开启虚机.png">

进行系统配置，经常修改的配置项：

<img src="11. 选择需要配置的内容.png">

首先语言选择中文和英文：

<img src="10. 选择语言.png">

然后开启root：

<img src="12. 启用root用户.png">

安装目的地可以不用改：

<img src="13. 安装目的地.png">

打开网络选项：

<img src="14. 打开网络.png">

因为我是学习虚拟化的，所以选择了虚拟机配置，否则的话可以选择服务器即可：

<img src="15. 虚拟化学习选择虚拟化主机_否则可以选服务器.png">

然后开始安装，等待一段时间后完成安装就能进入系统：

<img src="16. 然后开始安装.png">

<img src="17. 安装中.png">

安装完成后，进入系统：

<img src="18. 安装完成重启系统.png">

输入刚刚配置的root账号密码：

<img src="19. 输入刚刚配置的root账号密码.png">

# 三、Termius中添加虚拟机

首先查看虚拟机地址：

<img src="20. 找到虚拟机的ip_用远程连接工具连接.png">

然后在termius中添加虚拟机：

<img src="termius添加虚拟机.png">

# 四、进行内核替换

内核替换主要参考[openeluer的内核更新与替换](https://blog.csdn.net/m0_56602092/article/details/118604262)

首先查看当前安装了的linux内核版本：

<img src="openeluer初始内核_linux.png">

## 4.1 清理源代码树

进入解压好的源码文件夹执行命令，清理过去内核编译产生的文件，第一次编译时可不执行此命令

```shell
make mrproper
```
## 4.2 生成内核配置文件.config

可以先将将系统原配置文件拷贝过来，原配置文件在`/boot`目录下，输入`config-`后tab一下就出来了

```shell
mkdir ../cpConfig
cp -v /boot/config-$(uname -r) ../cpConfig
```

执行依赖安装

```shell
yum install ncurses-devel
```

进入配置界面，直接选择默认配置，然后选择Save，生成了一个.config文件：

<img src="23. 配置内核.png"> 

<img src="23_1. 配置内核.png">

<img src="23_2. 配置内核.png">

然后按`Exit`保存刚刚的config信息

最后需要禁用证书、BTF，否则后面编译会失败：

```shell
vim .config
```

<img src="23_3. 配置内核_禁用证书_vim查看.png">

<img src="23_4. 配置内核_禁用证书.png">

<img src="23_5.%20配置内核_BTF.png">

## 4.3 内核编译及安装

执行编译前先安装所需组件

```shell
yum install elfutils-libelf-devel
yum install openssl-devel
yum install bc
```


然后执行make开始编译，编译大概要一段时间，这个过程需要保证连接的稳定，中断了就要重新编译了

```shell
make -j$(nproc)
# make -j4
```

通常内核编译是一个 计算密集型任务，建议使用 -j 参数指定 CPU 核心数 来加速编译。

编译完成后，可以安装生成的 vmlinuz 文件：

```shell
make modules_install
make install
```

<img src="25. makeInstall安装内核结果.png">

生成的新内核可以在 /boot/ 目录下查看：

<img src="26. 生成的新内核.png">

## 4.4 更新引导

下面的命令会根据 /boot/ 目录下的内核文件自动更新启动引导文件。

```shell
grub2-mkconfig -o /boot/grub2/grub.cfg
```

然后重启系统就可以看到多个内核，其中一个就是我们新安装的内核，可自由选择一个内核启动系统。

```shell
reboot
```

<img src="27. 选择新的内核.png">

重启完后可以确认新的内核是否生效：

```shell
uname -a
```

<img src="28. 确认新内核.png">

# 五、支持远程ssh连接

编辑 SSH 配置文件：

```shell
vi /etc/ssh/sshd_config
```

找到并修改以下参数：

```shell
AllowTcpForwarding yes   # 取消注释或添加此行
```

保存文件并重启 SSH 服务：

```shell
systemctl restart sshd  # 大多数 Linux 系统
```

# 参考

> 0. [Fusion 或 Vmware 安装 openEuler 20.03 最小镜像](https://segmentfault.com/a/1190000040810052)
> 
> 1. [VM虚拟机中安装openeluer](https://blog.csdn.net/2302_82189125/article/details/137759482)
> 
> 2. [macOS中vmware Fusion的虚拟机创建](https://blog.csdn.net/m0_61998604/article/details/145700767)
> 
> 3. [openeluer的内核更新与替换：主要参考](https://blog.csdn.net/m0_56602092/article/details/118604262)
> 
> 4. [探秘内核：openEuler的内核编译实战指南【华为根技术】](https://bbs.huaweicloud.com/blogs/452112)
> 
> 5. [OpenEuler内核编译及替换](https://blog.csdn.net/m0_56602092/article/details/118604262)
> 