---
title: WebServer学习9：WebBench压力测试
date: 2024-03-27 18:03:26
tags:
categories:
- WebServer项目（C++）
---

## 一、WebBench简介

WebBench是一个在Linux下使用的网站压力测试工具，它使用`fork()`实现多进程并发，每个进程都是一个客户端，可以模拟多个客户端访问Web服务器，可以用来测试Web服务器的性能，测试Web服务器能够支持多少用户同时访问。

WebBench是由[Lionbridge](https://www.lionbridge.com/)开发的开源网站压测工具，除了能测试静态页面外，还可以测试动态页面，如PHP、JSP、ASP等。同时还支持SSL安全网站的测试。

**webbench压测原理**

- ⾸先在主进程中 fork 出多个⼦进程，每个**子进程**在用户要求的时间内对目标网站(Web)**循环发出实际访问请求**
- 子进程通过**管道(pipe)写端**向父进程传递请求访问完毕后记录到的总信息，⽗进程做最终的统计结果
- 待时间到后所有子进程结束，**父进程统计**并给用户显示**最后的测试结果**，然后退出
- webbench 最多可以模拟**3万**个并发连接去测试⽹站的负载能⼒。

## 二、WebBench使用

WebBench的标准测试可以向我们展示服务器的两项内容：**每秒钟的请求数**和**每秒钟的传输速度**。

### 1. WebBench下载安装

[WebBench的官方主页](http://home.tiscali.cz/~cz210552/webbench)

[WebBench工具的下载地址](http://www.ha97.com/webbench-1.5.tar.gz)

Linux下的下载安装步骤

```shell
wget http://www.ha97.com/webbench-1.5.tar.gz
tar -zxvf webbench-1.5.tar.gz
cd webbench-1.5
make
make install
```

在本人的WebServer项目中已经将WebBench的源码放在了`/MyWebServer/WebBench_test/webbench-1.5`目录下，已经编译过了，可以直接使用，不需要重新在官网下载安装。

### 2. WebBench使用

#### 2.1 启动WebServer服务器

首先确保webserver项目已经通过`make`编译成可执行文件了，然后在`/MyWebServer`项目的根目录下以关闭日志的形式启动WebServer服务器

```shell
./server -c 0
```

<img src="webBench_runserver.png">

#### 2.2 使用WebBench进行压力测试

启动了服务器后，在`/MyWebServer/WebBench_test/webbench-1.5`的目录下查看`webbench`的使用方式和版本

```shell
./webbench -h
./webbench -V
```

<img src="webBench_help.png">

<img src="webBench_version.png">

使用WebBench进行压力测试，例如对本项目中，WebServer服务器的IP地址为`http://127.0.0.1:9006/`进行压力测试，测试时间为`5`秒，模拟`4000`个客户端并发访问。

**注意：**根据webBench的源码，输入的URL地址必须以`http://`开头，且要以`/`结尾，否则会报错。

> -t 5：表示测试时间为5秒
> -c 4000：表示模拟4000个客户端并发访问

```shell
./webbench -c 4000 -t 5 http://127.0.0.1:9006/
```

<img src="webBench_test4000.png">


**结果分析：**

从结果上来看，每秒钟响应请求数：24525 pages/min，每秒钟传输数据量20794612 bytes/sec.

> 并发连接总数：4000
> 服务器压测访问时间：5s
> 响应请求：24525 pages/min
> 传输速度：20794612 bytes/sec
> 共发送82965个请求，所有访问请求都成功了，说明未超负荷
> 测试结果QPS计算：QPS=N/T=82965/5=16593（请求数量/压测时间），QPS大概为**1.66万**

由于服务器配置只有`4核4G`，所以在`4000`个并发连接下，服务器的QPS大概为**1.66万**，破了**万级QPS**，如果服务器配置更高，那么QPS会更高。

#### 2.3 WebBench受限原因分析

然而，当我尝试将并发连接数增加到10000时，webBench会报错，提示`problems forking worker no.4552`，所以我尝试将并发连接数减少到`4552`是可以正常测试的，但是并发连接数超过`4552`就会报错。说明肯定有某个地方收到了数量限制。那么我们继续来看一下到底是什么原因导致的。

<img src="webBench_test10000.png">

根据报错提醒可以初步断定是`fork()`函数的问题，也就是进程数量受Linux系统资源限制，因此测试不到上万的并发连接，最多只能测试到`4552`个并发连接。

`fork()`函数的限制是由`ulimit -a`命令查看的，其中`max user processes`表示用户最大进程数，`open files`表示用户最大打开文件数。

```shell
ulimit -a
```

<img src="webBench_testlimit1.png">

可以看到`max user processes`的值是`15183`，`open files`的值是`1024`，既然`max user processes`可以达到`15183`，那么为什么会失败呢？

使用`ps -ef | grep server`命令查看当前进程数，发现`server`进程数已经达到了`15183`，也就是说`server`进程数已经达到了系统的最大进程数限制，所以无法再创建新的进程了。

使用`ulimit -u 2048`和`ulimit -n 2048`修改系统配置后依然无法解决问题，暂时先不深究了，后续有时间再研究。


## 三、总结

实现服务器压测后，可以看到在`4000`个并发连接下，硬件配置为`4核4G`的服务器，本项目HTTP服务器的QPS大概为**1.66万**，如果服务器配置更高，那么QPS会更高。但是由于`fork()`函数的限制，最多只能测试到`4552`个并发连接，无法测试到上万的并发连接。

完成了WebBench的压力测试后，WebServer项目的学习也就告一段落了，后续会继续准备学习**基于raft的并发KV存储系统**，敬请期待。