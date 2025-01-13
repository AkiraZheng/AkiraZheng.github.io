---
title: Asyncflow项目1：环境部署
date: 2024-06-14 20:33:20

tags:
categories:
- Asyncflow

password: ztyn
abstract: 需要填入密码才可访问阅读
message: 需要填入密码才可访问阅读
wrong_pass_message: 错误密码，请重试
---

## 1. Docker

> [Docker 安装教程参考](https://cloud.tencent.com/developer/article/1701451)

如果pull时出现 `missing signing key`，应该是因为版本过低，需要更新到最新版本：

卸载旧版本：

```bash
yum erase docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-selinux \
                  docker-engine-selinux \
                  docker-engine \
                  docker-ce
```

安装最新版本：

```bash
yum install docker-ce -y
```

## 2. Docker 安装完整过程

添加软件仓库：

```bash

yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

```

自动安装Docker社区版：

```bash
yum install docker-ce docker-ce-cli containerd.io
```

启动Docker：

```bash
systemctl start docker
```

查看Docker状态：

```bash
systemctl status docker
```

配置阿里云国内镜像：

- 获取自己的阿里云镜像加速地址：https://cr.console.aliyun.com/cn-hangzhou/instances/mirrors

<img src="AliSource.png">

- 编辑Docker配置文件：

```bash
mkdir -p /etc/dockr

tee /etc/docker/daemon.json <<-'EOF'
{
"registry-mirrors":["https://填入刚刚的镜像源.mirror.aliyuncs.com"]
}
EOF

systemctl daemon-reload

systemctl restart docker

```

- 查看是否配置正确：

```bash
docker info
```

配置完docker后pull代码即可

## 3. 框架接入和部署方案

**1）框架接入**

step1：依赖中间件需要用户部署，并在flowSvr的config文件中配置对应的信息：

- MySQL
- Redis

step2：启动flowSvr

step3：worker由业务方import进来后实现三个接口的业务逻辑：

- ContentLoad：解析上下文
- HandleProcess：业务处理逻辑
- HandleFinish：处理业务日志等信息

step4：启动worker

注：worker和flowSvr之间的通信是通过HTTP协议，且双方之间独立的，其中只有flowSvr会对数据库中**任务信息表**、**任务配置表**及**任务位置表**进行操作

**2）框架部署参数**

| 参数 | 值 |
| --- | --- |
| flowSvr | 单机上3个（北斗解算1个，传感数据查询与存储2个） |
| worker | 单机上每个flowSvr各1个 |
| MySQL | 单机上1个 |
| Redis | 单机上1个 |
| 代码量 | 约8000行 |
| 硬件 | 阿里云服务器（2核4G） |
| 压测 | 3000QPS |

## 4. 使用wrk进行接口压测

mac环节下通过`docker`安装`wrk`：

```bash
docker pull williamyeh/wrk
```

注：如果docker镜像拉取失败可能是配置的镜像源有问题，可以选择更换镜像源或者通过[本地镜像源（使用x86）](https://github.com/AkiraZheng/DockerPull/actions)获取并下载本地镜像，然后通过`docker load -i xxx.tar`将镜像导入到docker中

运行Asyncflow server端，并测试`/get_task`接口（测试某个task_id就行）：

**1）QPS-接口耗时测试**

```bash
docker run -it --rm williamyeh/wrk -t12 -c400 -d15s "http://172.18.18.26:41555/v1/get_task?task_id=ca4e59ab-f661-462b-842a-bc6e27936754_lark_1"
```

<img src="wrk.png">

<img src="wrk_stroage.png">

**2）Asyncflow server端CPU、内存监控**

先查看对应端口的进程PID和进程名，可以通过进程名在活动监视器中查看CPU、内存占用情况：

```bash
lsof -i:41555
```

然后在启动`wrk`后，动态查看对应进程的CPU、内存占用情况：

```bash
top -pid PID
```

<img src="top-pid.png">


## 附录
### 运行代码
1. 从akira用户进入后切换到root用户：`sudo su`
2. 启动docker：`systemctl start docker`
    <img src="startDocker.png">
3. 启动db
    - 遇到remove container时，表示尝试启动的Docker容器名字“async-flow-db”已经被另一个正在运行或已经存在的容器所占用，需要先删除container再启动db就可以看到db启动成功的结果
        <img src="runDB_error.png">
        
        <img src="runDB_error_removeDB.png">
4. 进入容器环境
    <img src="intodocker.png">
5. 进入dist目录
    <img src="intoDist.png">
6. 从后台启动flowSvr：`./flowsvr &`
    <img src="runFlowSvr.png">
7. 启动worker：`./worker`
    <img src="runWorker.png">

从windows中查看代码（windows+vscode打开centos的文件夹）

### vscode+docker远程调试

在vscode中远程连接centos，然后在远程打开的centos中安装`dev container`插件和`docker`插件

自然就能通过attach visual studio code to container打开新的容器的vscode窗口来调试代码

参考视频：[VsCode轻松使用docker容器-Remote Containers](https://b23.tv/hl3aHnK)

### 接口调试

接口调试网站中创建自己的api测试案例：[Apipost](https://www.apipost.cn/)

- 发送请求时出现报错：

<img src="apipost_error.png" width="70%">

- 解决方法：在设置-代理中添加代理（测试接口需要关掉vpn）

<img src="apipost_proxy.png" width="70%">
