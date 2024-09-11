---
title: WebServer学习3：socket编程与epoll实现I/O复用
date: 2024-03-04 15:57:59
tags:
categories:
    - WebServer项目（C++）
---

## 一、socket编程

socket是一种文件描述符，也是一种通信机制的实现，可选地实现TCP或者UDP通信

以TCP实现socket通信为例，C/S模型中，服务器端和客户端分别创建一个socket，然后通过socket的 **(bind、listen、accept)(服务端）**、**connect（客户端）**等函数来实现通信

客户端通过bind绑定本地端口和IP，然后启动listen监听端口，当有客户端connect发起连接请求时，accept函数接受连接请求，server获得一个新的client socket，然后通过这个新的socket来进行通信

如果我们要判定服务器中一个网络程序有没有启动，可以通过 `netstat` 命令查看对应的端口号是否有被监听。

C/S模式下的TCP服务器与TCP客户端的工作流程如下(B/S模式也类似)：

<img src="connect_TCP.png" width="60%">

## 二、I/O复用

I/O复用是在单个进程中**同时跟踪监控（记录）多个文件描述符（Socket I/O流）的状态**，来达到不必为每个fd都创建一个监控线程的目的。（通过I/O多路复用，可以将监听的fd设置成非阻塞的，这样就不会阻塞整个进程）

当多个文件描述符中的任意一个准备好进行I/O操作时，询问线程再通知处理数据的线程发起recvfrom请求去读取数据

通过**请求队列来处理多客户端连接问题**，提高服务器的并发性能

Linux下，实现socket I/O复用的技术有**select、poll、epoll**等，进程可以通过这些技术发起I/O多路复用的系统调用，其中epoll在处理高并发场景下是性能最高的，Nginx、Redis等都是基于epoll实现的

而且常见的**select、poll、epoll**都是同步阻塞的（socket可以是非阻塞的），因此本项目最后会通过**线程池**来实现并发处理，**为每个就绪的文件描述符分配一个逻辑单元（线程）**来处理

### 1. select

select是最古老的I/O复用技术，使用**线性结构**来表示fd集合，它的缺点是**最大文件描述符数量受限**，32位系统的fd限制为1024，64位系统的fd限制为2048，文件描述符的限制是由操作系统决定的(可以通过修改配置来改变)

且**每次调用select都需要将fd集合从用户态拷贝到内核态**，效率较低

select是采用**轮询**方式来监测就绪事件的，每次调用select都会遍历所有的fd，时间复杂夫为O(n)

<img src="select.png" width="60%">

### 2. poll

poll是对select的改进，原理相似，都需要来回拷贝全部监听的文件描述符，它采用**链表**代替select的fd_set结构，**理论上可以支持无限个fd**

poll的效率比select高，但是**当文件描述符数量较大时，效率依然不高**，因为poll也是采用轮询的方式来监测就绪事件，但是事实上同一时间内，大量的**客户端只有少量处于活跃的就绪状态**，因此随着fd的增长，不断轮询所有fd的方法会导致效率线性下降

### 3. epoll

epoll是Linux内核2.6版本引入的，是**Linux系统特有的**（select和poll不是）

epoll底层是通过**红黑树**实现的，并且维护一个**就绪链表 Ready List**。**所有 FD 集合采用红黑树存储，就绪 FD 集合使用链表存储**,**理论上可以支持无限个fd**。使用高效的数据结构使插入和删除查询等性能较好（时间复杂度为`O(logN)`)

epoll一开始就**在内核态分配了一段空间，来存放管理的 fd**，所以在每次连接建立后，交给 epoll 管理时，需要将其添加到原先分配的空间中，后面再管理时就**不需要频繁的从用户态拷贝管理的 fd 集合**。通通过这种方式大大的提升了性能。

<img src="epoll.gif" width="60%">

epoll属于**事件驱动型**，当有活动的fd时，会**自动触发回调函数**，将活动的fd放入就绪链表中等待epoll_wait调用处理

而select和poll在内核判断是否有就绪的fd时开销最大

- epoll的两种工作模式：

    - **LT（水平触发）**：只要fd状态是就绪的，就会触发事件(默认方式)
    - **ET（边缘触发）**：只有当fd状态发生变化时才会触发事件
        - ET 是一种高速工作方式，很大程度上减少了 epoll 事件被重复触发的次数
        - ET 模式下，**必须使用非阻塞的套接字(socket)**，以避免由于一个文件句柄的**阻塞读/阻塞写**操作**把处理多个文件描述符的任务饿死**

## 三、epoll实现I/O复用

Linux下，epoll其实很简单，只要三个函数就可以了：

- **epoll_create**：

    创建一个epoll句柄,一个epoll会占用一个fd,所以epollfd在程序结束时也有close

    epoll_create的参数size已经不起作用了，只要大于0就行（因为红黑树的大小是动态的）

- **epoll_ctl**：

    注册要监听的事件类型（首先是server的listenfd，然后是连接server的client的connfd）

    通过`epoll_ctl`函数将socket加入到内核中的`红黑树`

    epoll_ctl由三个宏定义来控制对fd的操作：
    - **EPOLL_CTL_ADD**：**注册**新的fd到epoll中，一旦该fd就绪，就会自动触发回调函数
    - **EPOLL_CTL_MOD**：**修改**已经注册的fd的监听事件
    - **EPOLL_CTL_DEL**：从epoll中**删除**一个fd(删除后一般还要手动close该fd)

    注册的fd会有以下的event**事件类型**：
    - **EPOLLIN**：表示对应的文件描述符**可以读**（包括对端SOCKET正常关闭）
    - **EPOLLOUT**：表示对应的文件描述符**可以写**
    - **EPOLLPRI**：表示对应的文件描述符**有紧急的数据可读**
    - **EPOLLERR**：表示对应的文件描述符发生**错误**
    - **EPOLLHUP**：表示对应的文件描述符被**挂断**
    - **EPOLLET**：表示将epoll中的fd设为**ET边缘触发模式**
    - **EPOLLONESHOT**：表示将epoll中的fd设为**ONESHOT模式**只监听一次事件，epoll处理完该fd后，**fd就会被从epoll中删除**，如果需要再监听这个socket的话，除非再次调用epoll_ctl注册该fd

    通过epoll_ctl添加进来的**fd都会被放在红黑树某个节点**内，所以重复添加是无效的

    当有相应的事件（如EPOLLIN、EPOLLOUT等）发生时，就会**调用回调函数将该fd放入就绪链表（双向链表rdllist）中**，当调用epoll_wait时，只需要检查双向链表中是否有存在注册的事件（在红黑树中）即可

    <img src="red-black-tree.png">

- **epoll_wait**：等待事件的产生

    epoll_wait在EventLoop中属于一个阻塞过程，当rdlist为空（无就绪fd）时挂起当前进程，直到rdlist不空时进程才被唤醒

    文件fd状态改变（buffer由不可读变为**可读EPOLLIN**或由不可写变为**可写EPOLLOUT**），导致相应fd上的回调函数ep_poll_callback()被调用

    epoll_wait的参数解析（C++）：
    
    - **epollfd**：当前线程的epoll句柄
    - **events**：用来从内核得到事件的集合，**events**中保存了就绪的fd的**事件类型**，如`EPOLLIN`、`EPOLLOUT`等，用于epoll进行事件处理时可以判断对应的类型并执行相应的操作
    - **maxevents**：每次epoll_wait最多返回的就绪事件数目
    - **timeout**：epoll_wait的超时时间，单位为毫秒，`-1`表示`一直阻塞`，`0`表示`立即返回`，`>0`表示`等待指定时间后返回`

epoll接口的作用为:

<img src="epoll_concept.png">

## 四、代码示例

实现简单的eopll客户端和服务端（C++）

代码仓库为[WebServer相关的一些轮子和Demo](https://github.com/AkiraZheng/MyWebServer/tree/Demos_of_Webserver)

- 服务端

    服务端设置server socket时,通过`setsockopt`设置SO_REUSEADDR，允许端口复用。端口复用最常用的用途应该是**防止**服务器重启时之前绑定的端口还未释放或者程序突然退出而**系统没有释放端口**。这种情况下如果设定了端口复用，则新启动的服务器进程可以直接绑定端口。如果没有设定端口复用，绑定会失败，提示ADDR已经在使用中

    服务端通过epoll就绪队列中的`events[i].data.fd`是否等于server fd来区分是**新的连接**还是**已有连接的fd有数据**到达

    同时epoll设置为-1表示阻塞等待就绪事件到来(I/O复用epoll本身是阻塞的)，而epoll中的client socket fd是非阻塞的，因为采用ET方式，需要防止饿死

    ```cpp
    #include <iostream>
    #include <sys/epoll.h>
    #include <unistd.h>// close
    #include <fcntl.h>// set non-blocking
    #include <sys/socket.h>//create socket
    #include <netinet/in.h>//sockaddr_in

    using namespace std;

    #define MAX_EVENTS 20

    int main(){
        //buffer for read socket message
        char buff[1024];

        //create a tcp socket
        //socket参数解析
        //AF_INET: ipv4,也可以是AF_INET6
        //SOCK_STREAM: 代表流式套接字
        //IPPROTO_TCP: tcp协议，也可以是IPPROTO_UDP，表示选择的传输层协议
        int socketFd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);

        //设置socket监听的地址和端口
        //sockaddr_in是netinet/in.h中的结构体，用于表示socket地址
        sockaddr_in sockAddr{};
        sockAddr.sin_family = AF_INET;//ipv4
        sockAddr.sin_port = htons(8080);//端口号
        sockAddr.sin_addr.s_addr = htonl(INADDR_ANY);//监听主机所有地址

        //绑定服务端监听的socket套接字
        //通过bind函数将socketFd和sockAddr绑定，绑定不成功将返回-1
        //bind参数解析:
        //socketFd: socket文件描述符,也就是
        //sockAddr: socket需要绑定的地址和端口
        int flags = 1;
        setsockopt(socketFd, SOL_SOCKET, SO_REUSEADDR, &flags, sizeof(flags));//bind前使用setsockopt设置允许端口复用
        if(bind(socketFd, (sockaddr*)&sockAddr, sizeof(sockAddr)) == -1){
            cout << "bind error" << endl;
            return -1;//结束主程序
        }

        //绑定后，开始监听socket，客户端连接时通过accept函数接收连接，内部实现三次握手
        //第二个参数是backlog：指定在连接队列中允许等待的最大连接数
        //                    但是并不意味着只能连10个，只是同时在等待连接的队列中只能有10个
        if(listen(socketFd, 10) == -1){
            cout << "listen error" << endl;
            return -1;
        }
        cout << "server start, listen on 8080...";

        //创建epoll实例
        //epoll_create的size限定没啥用了，epoll实例的大小是动态调整的，基本上允许不断接入socket客户端
        int epollFd = epoll_create(1);

        //将socketFd包装成一个epoll_event对象，加入到epoll监听中
        //epoll_event是<sys/epoll.h>中定义的一个结构体，用于注册事件
        //描述在使用 epoll 监听文件描述符时发生的事件
        epoll_event epev{};
        epev.events = EPOLLIN;//监听server的读事件
        epev.data.fd = socketFd;//监听的文件描述符:相当于监听的小区楼（server socket)，里面每一个房间都是连接的客户端文件描述符
        epoll_ctl(epollFd, EPOLL_CTL_ADD, socketFd, &epev);//将监听的socket对象加入到epoll监听中

        //回调事件数组：用于存放epoll_wait返回的事件，也就是最多有MAX_EVENTS个socket事件同时发生进入epoll（蜂巢的大小）
        epoll_event events[MAX_EVENTS];

        //在event loop中，不断的通过死循环监听和响应事件发生（执行epoll_wait等待事件发生）
        while(true){
            //epoll_wait函数用于等待事件发生，函数会阻塞，直到超时或有响应的事件发生，返回发生的事件数量
            //epollFd: epoll实例(相当于小区的蜂巢快递点，当有事件进来时，会通知蜂巢快递点epoll，然后蜂巢快递点再通知小区楼socketFd)
            //events: 用于存放发生的事件
            //MAX_EVENTS: 最多发生的事件数量
            //timeout: 超时时间，-1表示一直等待，0表示立即返回，>0表示等待指定时间
            int eventCount = epoll_wait(epollFd, events, MAX_EVENTS, -1);//timeout为-1就是阻塞等待

            if(eventCount == -1){
                cout << "epoll_wait error" << endl;
                break;
            }

            //wait到事件后，遍历所有收到的events并进行处理
            for(int i=0; i<eventCount; i++){
                //判断是不是新的socket客户端连接
                if(events[i].data.fd == socketFd){
                    if(events[i].events & EPOLLIN){
                        //接收新的socket客户端连接，clientAddr存放连接进来的客户端的地址信息
                        sockaddr_in clientAddr{};
                        socklen_t clientAddrLen = sizeof(clientAddr);
                        int clientFd = accept(socketFd, (sockaddr*)&clientAddr, &clientAddrLen);

                        //将新的socket客户端连接加入到epoll监听中
                        epev.events = EPOLLIN | EPOLLET;//监听读事件并设置边缘触发模式
                        epev.data.fd = clientFd;//监听的文件描述符
                        //设置连接的客户端为非阻塞模式，fcntl函数F_GETFL获取客户端fd的状态标志
                        int flags = fcntl(clientFd, F_GETFL, 0);
                        if(flags == -1){
                            cout << "fcntl error" << endl;
                            return -1;
                        }
                        //F_SETFL设置客户端fd为非阻塞模式O_NONBLOCK
                        if(fcntl(clientFd, F_SETFL, flags | O_NONBLOCK) < 0){
                            cout << "set no block error, fd:" << clientFd << endl;
                            continue;
                        }
                        //将新客户端连接加入到epoll监听中
                        epoll_ctl(epollFd, EPOLL_CTL_ADD, clientFd, &epev);
                        cout << "new client connected, fd:" << clientFd << endl;
                    }
                }else{//不是server socket的事件响应，而是客户端socket的事件响应
                    //判断是不是断开连接和出错EPOLLERR EPOLLHUP
                    if(events[i].events & EPOLLERR  || events[i].events & EPOLLHUP){
                        //出现客户端连接错误或断开连接时需要从epoll中移除
                        epoll_ctl(epollFd, EPOLL_CTL_DEL, events[i].data.fd, nullptr);
                        cout << "client disconnected, fd:" << events[i].data.fd << endl;
                        close(events[i].data.fd);
                    }else if(events[i].events & EPOLLIN){//客户端可读事件
                        int len = read(events[i].data.fd, buff, sizeof(buff));//用buff接收客户端发送的消息
                        //如果数据读取错误，关闭对应的客户端连接并从epoll监听中移除
                        if(len == -1){
                            epoll_ctl(epollFd, EPOLL_CTL_DEL, events[i].data.fd, nullptr);
                            close(events[i].data.fd);
                            cout << "read error, close fd:" << events[i].data.fd << endl;
                        }else{
                            //打印客户端发送的消息
                            cout << "recv msg from client, fd:" << events[i].data.fd << ", msg:" << buff << endl;

                            //将接收到的消息再发送给客户端
                            char sendMess[] = "hello, client";
                            write(events[i].data.fd, sendMess, sizeof(sendMess));
                        }
                    }
                }
            }
        }
    }
    ```

    终端中编译运行效果：
    
    <img src="epollDemo_server_run.png">

- 客户端

    客户端通过socket连接到服务端，然后通过write发送消息，通过read接收消息，Demo设计中for循环模拟10个客户端

    ```cpp
    //实现一个客户端程序，连接到服务器，发送数据，接收数据
    #include <iostream>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>

    using namespace std;

    int clientsFd[10];

    int main(){
        for(int i = 0; i < 10; i++){
            //创建socket
            int clientSocketFd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);

            //设置连接的服务器地址和端口
            sockaddr_in sockAddr{};
            sockAddr.sin_family = AF_INET;
            sockAddr.sin_port = htons(8080);
            sockAddr.sin_addr.s_addr = htonl(INADDR_ANY);

            //连接服务器
            if(connect(clientSocketFd, (sockaddr*)&sockAddr, sizeof(sockAddr)) == -1){
                cout << "connect error" << endl;
                return -1;
            }
            clientsFd[i] = clientSocketFd;
            cout << "client fd:" << clientsFd[i] <<"connect to server success" << endl;

            //延迟
            usleep(100);
        }
        
        for (int i = 0; i < 10; i++){
            //发送数据
            char buff[] = "hello, epoll";
            send(clientsFd[i], buff, sizeof(buff), 0);

            //接收数据
            char recvBuff[1024];
            recv(clientsFd[i], recvBuff, sizeof(recvBuff), 0);
            cout << "recv: " << recvBuff << endl;

            //关闭socket
            close(clientsFd[i]);
        }
        return 0;
    }
    ```

    终端中编译运行效果：

    <img src="epollDemo_client_run.png">

- 比较

    通过比较客户端和服务端的fd，我们可以很清晰的看到，当服务端接收到新的客户端fd后，会在服务端中将其记成服务端对应可识别的fd，而不是客户端进程中出现的fd，这样保证了服务端和客户端的通信不会出现混乱

## 五、总结

- 本文学习了socket普通编程
- 扩展了I/O复用的概念，以及select、poll、epoll的区别，并具体实现和讲解了epoll的I/O复用
- 通过简单的epoll服务端和客户端的代码示例，加深了对epoll的理解

有了I/O复用和epoll编程基础后，将可以开始着手实现WebServer的event_loop和epoll模块，通过学习两种事件驱动模型（Reactor和Proactor）来实现WebServer的高并发处理。[WebServer学习4：并发事件驱动模式Reactor和Proactor](https://akirazheng.github.io/2024/03/05/WebServer%E5%AD%A6%E4%B9%A04%EF%BC%9A%E5%B9%B6%E5%8F%91%E4%BA%8B%E4%BB%B6%E9%A9%B1%E5%8A%A8%E6%A8%A1%E5%BC%8FReactor%E5%92%8CProactor/)

[详解IO多路复用机制——select、poll、epoll的原理和区别](https://blog.csdn.net/adminpd/article/details/124553590)
