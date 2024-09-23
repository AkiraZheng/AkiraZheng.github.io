---
title: WebServer学习4：并发事件驱动模式Reactor和Proactor
date: 2024-03-05 19:40:58
tags:
categories:
  - WebServer项目（C++）
---

## 一、并发模式

当处理并发客户端的请求时，最直接的想法就是使用多线程来解决，但是线程完成业务逻辑后就销毁，不断地创建销毁会造成很大的性能开销，因此选择优化为采用**线程池来处理业务**，那么线程池该如何高效地处理业务呢?我们需要选择适合地并发模式来实现

我们知道，epoll中监听的是多个fd，epoll_wait等待到的事件可能是读/写/accept客户端/信号/定时等，这些事件都是并发的，我们需要对这些事件进行并发处理

而事件并发处理模式有两种:Reactor和Proactor，下面对这两种并发模式进行介绍

## 二、Reactor模式

Reactor又称为**反应堆**，是一种**事件驱动机制**。Reactor通常使用**同步I/O**(如`epoll_wait`)实现。

- 同步(阻塞)I/O：当一个I/O操作发生时，程序会阻塞在这个I/O操作上，直到这个I/O操作完成，程序才会继续执行
- Reactor将所有要处理的**I/O事件注册到I/O多路复用器上(如epoll)**
- 而主线程/进程阻塞在多路复用器上，也就是同步阻塞在epoll_wait上
- I/O多路复用器监听到I/O事件发生后，**根据事件类型将事件分发给工作线程(逻辑单元)处理**

Reator模式要求**主线程只负责监听是否有事件发生**，当有事件发生时，主线程将事件分发给工作线程(逻辑单元)处理(包括读和写)，也就是将socket可读可写事件放入工作线程的请求队列中等待处理

### 模式一：单Reactor单线程

这种模型下，通常只有**1个epoll对象**，所有的**客户端连接、读写事件**都在**主线程**中实现（redis这种中间件就是采用这种模式）

<img src="singleReactor.png" width="80%" heigh="80">

而实际上非I/O的业务型操作不应该也放在主线程中，（如图中的decode、compute、encode）应该从Reactor中卸载，放入工作线程中（这种就是模式二采用的方法）

### 模式二: 单Reactor + 线程池(Thread Pool)（多线程）

这种模式的特定是，client的accept和read/send都在主线程`MainReactor`中完成，然后读取客户端数据后，将计算和请求处理等工作交给线程池执行，可以充分利用多核CPU的优势

采用此模式时有可能存在多个线程同时计算同一个连接上的多个请求，算出的结果的次序是不确定的， 所以需要网络框架在设计协议时**带一个id标示**，以便让客户端区分response对应的是哪个request。

<img src="reactor_thread_pool.png" width="80%" heigh="80">

### 模式三: muduo ⽹络库中所提出的 Multi-Reactor 并发框架 + 线程池实现

Multi-Reactor模式的特点是one loop per thread， 有一个**main Reactor**负责`accept`连接， 然后把该连接挂在某个**sub Reactor**中(可以采用**round-robin**、**随机方法**、**一致性哈希**等实现**负载均衡**)，这样该连接的所有操作都在哪个sub Reactor所处的线程中完成，每个sub Reactor都处于线程池中的某个线程中

通过**Multi-Reactor + Pools**的模式结合epoll实现多路复用也要**遵循每个fd的操作只有一个线程完成（一致性哈希可以实现）**，防止出现数据收发顺序问题以及多个线程同时操作一个fd的问题

<img src="multipleReactors+Pools.png">

## 三、Proactor模式

proactor模式中

- **主线程**和内核**负责处理读写数据、接受新连接等I/O操作**，主线程读写完后，主线程向工作线程通知并直接发送读取后的结果给工作线程进行处理

- **工作线程**仅负责**业务逻辑**，如处理**客户请求**。通常由异步I/O实现

**同步I/O模拟Proactor模式**

异步I/O一般采用如`aio_read`和`aio_write`等函数来处理读写数据，但本项目中使用同步I/O模拟Proactor事件处理模式

以epoll_wait实现同步I/O模型为例:

- 主线程往**epoll内核事件表注册**socket上的读就绪事件。

- 主线程调用**epoll_wait等待**socket上有数据可读

- 当socket上有数据可读，epoll_wait通知主线程，**主线程从socket循环读取数据，直到没有更多数据可读**，然后将读取到的数据封装成一个请求对象并插入请求队列。

- 睡眠在请求队列上**某个工作线程被唤醒**，它获得请求对象并**处理客户请求**，然后往epoll内核事件表中**注册**该socket上的**写就绪事件**

- 主线程调用**epoll_wait等待socket可写**。

- 当socket上有数据可写，epoll_wait通知主线程。**主线程**往socket上**写入服务器处理客户请求的结果**。

<img src="proactor.png" width="80%" heigh="80">

**Reactor与Proactor的区别**

- Reactor模式中，主线程负责监听是否有事件发生，并将事件分发给工作线程处理
  - 操作是同步的，严格按照时序执行（因为要严格按照时序，所以数据读写都是在工作线程内跟解析和打包同步执行）
- Proactor模式中，主线程负责处理读写数据、接受新连接等I/O操作，等**处理完事件后**再直接发送读取后的结果给工作线程进行业务处理
  - 在I/O操作时是异步的，当I/O操作执行时，线程可以处理其他事情

> 参考：[Reactor和Proactor的区别](https://mbd.baidu.com/ma/s/xTShUzFr)

> 举个实际生活中的例子，Reactor 模式就是快递员在楼下，给你打电话告诉你快递到你家小区了，你需要自己下楼来拿快递。而在 Proactor 模式下，快递员直接将快递送到你家门口，然后通知你。

## 四、总结

- **reactor**是一种基于**待完成事件**的**同步I/O**模型
- **proactor**是一种基于**已完成事件**的**异步I/O**模型

学完并发模式，我们就可以了解了WebServer项目中，主线程创建epoll监听后，分别对I/O事件如信号、定时、socket接受客户端连接、客户端socket读写事件等的多线程处理模式

接下来就可以完成**半同步半反应堆线程池**的代码和理论学习，因为线程池是实现并发模式的基础，也是项目中进行事件处理的基础：[WebServer学习5：线程池与数据库连接池设计](https://akirazheng.github.io/2024/03/09/WebServer%E5%AD%A6%E4%B9%A05%EF%BC%9A%E7%BA%BF%E7%A8%8B%E6%B1%A0%E4%B8%8E%E6%95%B0%E6%8D%AE%E5%BA%93%E8%BF%9E%E6%8E%A5%E6%B1%A0%E8%AE%BE%E8%AE%A1/)

> 参考：[​网络 IO 演变发展过程和模型介绍](https://mp.weixin.qq.com/s/EDzFOo3gcivOe_RgipkTkQ)
