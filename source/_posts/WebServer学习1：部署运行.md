---
title: WebServer学习1：部署运行
date: 2024-02-28 22:02:03
tags:
categories:
  - WebServer项目（C++）
---

## 前言

> 本项目是以Github上的开源项目[TinyWebServer](https://github.com/qinguoyi/TinyWebServer)作为学习基础

## 一、环境配置
### 1. 环境
- 服务器测试环境
    - Ubuntu版本22.04.1
    - MySQL版本8.0.36
- 浏览器测试环境
    - Windows、Linux均可
    - Chrome
    - FireFox（本文调试环境为Linux下自带的FireFox）
    - 其他浏览器暂无测试

### 2. 软件安装

- 安装VMware和Ubuntu
    - [（一）TinyWebServer的环境配置与运行](https://blog.csdn.net/weixin_46653651/article/details/133420059)
    - 这里Ubuntu可以在清华镜像中下载，否则很慢[清华大学开源软件镜像站](https://mirrors.tuna.tsinghua.edu.cn/)
    - 如果是`ARM`芯片的话，如 MAC 的 M1 芯片，参考这个文章下载镜像[如何在 ARM 设备上安装和使用 Ubuntu](https://blog.csdn.net/qq_30820239/article/details/144520798)，这里`desktop`版本从`25.04`开始才支持，当然不需要桌面版本的话可选项就很多了。
        - 下载完镜像就可以安装[VMware 虚拟机安装 Ubuntu 24.04 Server 系统](https://www.cnblogs.com/YangShengzhou/articles/19323323) 
        - 网络配置按默认的DHCP就行
        - 安装等待过程很久，安装成功会显示`Reboot Now`：

        <img src=2025-12-13-03-13-00.png>
        <!-- - 涉及到配置网络时，不要选DHCP，选Manual手动配，这样IP不会变
            - 在host终端输入`ifconfig`查看网卡配置，可以看到`bridgexxx`是VMware NAT / Host-only生成的，选择VMware NAT作为子网，比如我的host显示NAT 网关为`bridge100: 192.168.234.1`，那么我的配置如下图所示：

            <img src=2025-12-13-02-21-48.png> -->
    
    <img src="config_qinghua1.png">

    <img src="config_qinghua2.png">

    <img src="config_qinghua3.png">

- 安装MySQL（中间可能会缺少一些东西，按照提示安装即可）
    - 打开终端输入：
    
    ```shell    
    # 安装mysql
    sudo apt upgrade && sudo apt install mysql-server mysql-client libmysqlclient-dev


    # 进入mysql
    sudo mysql -u root
    
    # 退出mysql
    exit
    
    # 设置mysql远程连接
    sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf
    # 改成
    bind-address = 0.0.0.0
    # 重启mysql服务
    sudo service mysql restart
    ```

    - 在终端创建TinyWebServer需要的数据库
    ```shell
    # 进入mysql
    sudo mysql -u root
    # 创建数据库akiradb，可以改成自己想改的名字
    create database akiradb;
    # 使用数据库akiradb
    use akiradb;
    # 创建user表
    CREATE TABLE user(
        username char(50) NULL,
        passwd char(50) NULL
    )ENGINE=InnoDB;
    
    # 添加数据
    INSERT INTO user(username, passwd) VALUES('akira', 'akira');
    ```
    - 补充：一些常用的mysql命令（mysql语句一般都需要分号;作为结尾）
    ```shell
    # 查看所有数据库
    show databases;

    # 删除数据库akiradb
    drop database akiradb;

    # 查看所有表
    show tables;

    # 选择user表中的所有数据
    select * from user;

    # 删除表user
    drop table user;
    ```

    - 退出mysql后在终端查询数据库状态
    ```shell
    # 查看mysql状态
    sudo service mysql status
    ```
    <img src="mysql_status.png">

> 在centos安装mysql的时候可以参考https://blog.csdn.net/weixin_45031801/article/details/139429231，但是要注意出现` See "systemctl status mysqld.service" and "journalctl -xe" for details`报错时，要将连接里的增加`skip-grant-tables`代码先加完再启动

## 二、TinyWebServer代码
### 1. 代码下载
- 下载TinyWebServer代码
    - [TinyWebServer](https://github.com/qinguoyi/TinyWebServer)
- 使用git 克隆到本地
```shell
# 没有git的使用下面命令(有git忽略此步骤)
sudo apt install git -y
# 执行下面的命令吧项目克隆到本地
git clone https://github.com/qinguoyi/TinyWebServer.git
```

### 2. 代码编译

- git后项目就会出现在桌面上，进入项目文件夹，修改main.cpp文件配置

- 打开main.cpp修改对应配置（直接在TinyWebServer文件夹点击main.cpp修改即可）
    
    - 获得需要的mysql的用户名和密码（需要先按照vim）
    ```shell
    cd /etc/mysql
	sudo vim debian.cnf
    ```

    <img src="mysql_user.png">

    - 修改main.cpp文件
    
    <img src="main_cpp.png">

- 编译运行
```shell
# 进入项目文件夹
cd TinyWebServer
# 编译
make
# 运行
./server
```
注意：这里的`make`指令也可以换成`sh ./build.sh`

- 编译时出现错误：
    - `fatal error: mysql.h: No such file or directory`:安装链接库 `apt-get install libmysqlclient-dev`
    - g++编译时：`No such file or directory`:`sudo apt-get install g++`

- 运行并用浏览器访问
    - 终端中执行`./server`
    - 浏览器输入`http://localhost:9006`即可访问(也可输入回环IP地址，如`http://127.0.0.1:9006`)

## 三、Windows下使用ssh+VSCode远程连接Ubuntu

### 1. 部署Linux和Windows下的VScode环境

<!-- - 在Linux下安装VSCode
    - 打开应用商店搜索`VSCode`安装即可

    <img src="vscode_linux.png"> -->

- 按照[VSCode远程连接Ubuntu](https://www.bilibili.com/video/BV1MN411T71b/?spm_id_from=333.999.0.0)的步骤即可

<img src=2025-12-13-17-20-51.png>

<img src=2025-12-13-17-23-34.png>

### 2. 在Linux下运行本文代码 && 在Windows下运行本文代码

- 在Linux下运行本文代码
    - 在VSCode中打开`TinyWebServer`文件夹
    - 在VSCdoe中打开终端，输入`./server`运行(如果还没make要先执行`make`)
    - 浏览器输入`http://localhost:9006`即可访问

    <img src="vscode_linux_run.png">

- 在Linux中将TinyWebServer文件夹另存为一个工作区

<img src="vscode_linux_save.png">

- 在Windows下运行本文代码
    - 根据上面部署视频中打开我们刚才生成的工作区就行
    - 然后同样在Windows下的VSCode中打开终端，输入`./server`运行(如果还没make要先执行`make`)

    <img src="vscode_windows_run.png">

### 3. VMWare中Ubuntu出现内存不足需要扩容

首先关闭虚拟机，在VMWare中选择`编辑虚拟机设置`，然后选择`处理器和内存`，然后打开虚拟机，通过`gparted`扩容

具体扩容操作参考[vmware：ubuntu虚拟机如何扩容？](https://blog.csdn.net/qq_34160841/article/details/113058756)

如果遇到权限不足问题，可以参考[GParted给ubuntu系统磁盘resize大小时候出现cannot resize read-only file system解决办法](https://blog.csdn.net/ningmengzhihe/article/details/127295333)

## 四、总结

全部部署完就可以开启源代码的学习啦~
