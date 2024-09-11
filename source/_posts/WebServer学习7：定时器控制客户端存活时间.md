---
title: WebServer学习7：定时器控制客户端存活时间
date: 2024-03-26 22:37:07
tags:
categories:
- WebServer项目（C++）
---


## 一、概述本项目中定时器的使用

### 1.1 定时器的作用

本项目定时器主要用于控制客户端的存活时间，定时删除不活跃的文件描述符。（不活跃的文件描述符指的是，客户端在一定时间内**没有发送请求报文给服务器**，**服务器也没有发送响应报文**，则服务器认为客户端已经断开连接，需要将其从epoll内核事件表中删除和关闭文件描述符，并删除对应的定时器）

### 1.2 定时器处理非活跃连接

本项目中定时器处理非活跃连接的实现原理是：

**每次有客户端连接到服务器，服务器就为其创建一个定时器，并将其加入到定时器容器中。** 但是实际上，本项目只在主线程中**开启一个真实的定时器**，其他的定时器都是通过**定时器容器**来模拟的。

具体来说，定时器容器是一个**升序链表**，链表中的每个节点对应一个客户端的定时器，每个定时器都有一个超时时间变量（绝对时间），主线程中真实的定时器每隔一段时间（倒计时结束）就会**遍历定时器容器**，检查每个定时器的**超时时间是否小于当前时间**，如果小于当前时间，说明该客户端节点过期了，就会执行定时器节点的回调函数，回调函数中会关闭对应的文件描述符，并将其从epoll内核事件表中删除。

遍历容器的过程如下所示：

<img src="timerContainer.png">

## 二、定时器容器的实现

定时器容器其实是一种**数据结构**，不是真实的定时器，它的作用是用于管理所有的定时器节点（处理非活跃连接）。常用的数据结构有**双向升序链表**、**时间轮**、**时间堆（二叉树）**等，本项目中使用的是**双向升序链表**。

**函数指针**

在定时器的实现中会大量用到函数指针，所以需要先复习一下函数指针的用法。

函数指针：C++中每个函数的**函数名**就是一个**指针**，可以通过函数名获取函数的地址，然后将函数地址赋值给函数指针，通过函数指针调用函数。

函数指针的定义如下：

```markdown
返回数据类型 (* 函数指针名)(函数参数列表);
```

举个例子，定义一个`int test(int a)`函数，然后定义一个函数指针`int (*p)(int)`，将`test`函数的地址赋值给`p`，然后通过`p`调用`test`函数。

```cpp

int test(int a){
    return a;
}

int main(){
    int (*p)(int);//定义函数指针
    p = test;//将test函数的地址赋值给p
    int b = p(10);//通过p调用test函数
    cout << b << endl;
    return 0;
}
```

### 2.1 用户节点的定义client_data

项目中将**客户端连接资源信息**封装在一个**结构体（client_data）**中，包括**客户端socket地址**、**文件描述符**、**定时器类**等信息。然后将所有的**定时器节点**放入一个**双向升序链表**中。

```cpp
//前向声明util_timer定时器类
class util_timer;
//定时器节点中的用户数据结构
struct client_data{
    sockaddr_in address;
    int sockfd;
    util_timer *timer;
};
```

用户结构与定时器容器之间的关系：

<img src="timerContainerStruct.png">

### 2.2 节点中的定时器节点类util_timer

在用户结构体中，有一个**util_timer**类的指针，这个类是**定时器类**，作为定时器容器中的一个节点，用于**管理定时器**。由于定时器容器是双向升序链表，所以定时器类中还有**前向和后向指针**。

定时器类的定义如下：

```cpp
//定时器节点：双向升序链表的节点
class util_timer{
public:
    util_timer():prev(nullptr), next(nullptr){}

    time_t expire;//任务的超时时间，这里使用绝对时间（定时器超时时间）
    void (*cb_func)(client_data *);//任务回调函数：timeout后实现socket和定时器的移除
    client_data *user_data;//回调函数处理的客户数据，由定时器的执行者传递给回调函数
    util_timer *prev, *next;//前向和后向指针
};
```

由于节点到期后处理的操作是**fd移出epoll**并关闭**socket连接**，所以定时器类中的回调函数`cb_func`是一个**函数指针**，指向一个**处理函数**，用于处理到期后的操作。

```cpp
//删除epoll中非活动连接的客户端socket、关闭连接
int *Utils::u_pipefd = 0;
int Utils::u_epollfd = 0;
class Utils;//前向声明
void cb_func(client_data *user_data){
    //删除主程序epoll中对应客户端的fdSchufa
    epoll_ctl(Utils::u_epollfd, EPOLL_CTL_DEL, user_data->sockfd, 0);
    assert(user_data);//断言，确保user_data不为空，否则直接返回

    //关闭客户端socket连接
    close(user_data->sockfd);

}
```

### 2.3 定时器容器（双向升序链表）

项目中为每个用户连接创建一个`util_timer`类的定时器节点，并在主程序的`Utils`实例中维护一个**双向升序链表**（`sort_timer_lst`），用于管理所有的定时器节点。

跟普通的数据结构一样，双向升序链表也有**插入节点**、**删除节点**、**调整节点**等操作。

- **插入节点**：`add_timer`函数将新节点插入到链表中，保持链表的升序性
    - 如果链表为空，直接作为头-尾节点插入
    - 如果链表不为空，遍历链表，找到合适的位置插入
- **删除节点**：`del_timer`函数将指定节点从链表中删除
- **调整节点**：`adjust_timer`函数将指定节点调整到合适的位置
    - 当客户端与服务器有数据交互时，需要重启定时器，这时候对应节点的定时器时间会**往后延迟过期时间**，所以节点在链表中的位置也需要往后调整
    - 当被调整的目标节点在**链表尾部**，或者定时时间仍然**小于下一个节点**的定时时间时，**不用调整**
    - 否则，将目标节点从链表中删除，**重新插入**到链表中(`add_timer`函数)

```cpp
//定时器容器：双向升序链表
class sort_timer_lst{
public:
    sort_timer_lst();
    ~sort_timer_lst();

    void add_timer(util_timer *timer);//添加定时器
    void adjust_timer(util_timer *timer);//通过递归调整定时器节点位置
    void del_timer(util_timer *timer);//删除定时器节点
    void tick();//SIGALRM信号每次被触发就在信号处理函数中执行一次tick函数，以处理链表上到期的任务
private:
    void add_timer(util_timer *timer, util_timer *lst_head);//添加新用户的定时器节点timer（while找到合适的位置插入）

    util_timer *head;
    util_timer *tail;
};
```

```cpp
//添加定时器
void sort_timer_lst::add_timer(util_timer *timer){
    //空定时器不加入容器中
    if(!timer) return;

    //head为空，当前定时器设为头节点(当前定时器为唯一节点)
    if(!head){
        head = tail = timer;
    }

    //当前定时器的超时时间 < 头节点的超时时间，插入头节点（实现升序）
    if(timer->expire < head->expire){
        timer->next = head;
        head->prev = timer;
        head = timer;
        return;
    }

    //其它情况需要遍历链表（add_timer函数实现while搜索，找到合适的位置插入）
    add_timer(timer, head);
}
void sort_timer_lst::add_timer(util_timer *timer, util_timer *lst_head){
    util_timer *prev = lst_head;
    util_timer *tmp = prev->next;//头节点已经被判断过了，所以从头节点的下一个节点开始判断

    //找到链表中第一个比timer大的节点位置，插入到该节点之前
    while(tmp){
        //1. 找到了
        if(timer->expire < tmp->expire){
            // 插入节点
            prev->next = timer;
            timer->next = tmp;
            tmp->prev = timer;
            timer->prev = prev;
            break;//插入完成，退出循环
        }
        //2. 没找到，更新当前节点和prev节点
        prev = tmp;
        tmp = tmp->next;
    }

    //遍历后没找到，说明timer的超时时间最大，插入到链表尾部
    if(!tmp){//tmp为nullptr
        prev->next = timer;
        timer->prev = prev;
        timer->next = nullptr;
        tail = timer;
    }

}

//删除定时器
void sort_timer_lst::del_timer(util_timer *timer){
    //空节点直接返回
    if(!timer) return;

    //链表中只有一个定时器节点
    if((timer == head) && (timer == tail)){
        head = nullptr;
        tail = nullptr;
        delete timer;
        return;
    }

    //被删除的定时器是头节点
    if(timer == head){
        head = head->next;//头节点后移
        head->prev = nullptr;//新头节点的前向指针置空
        delete timer;
        return;
    }

    //被删除的定时器是尾节点
    if(timer == tail){
        tail = tail->prev;//尾节点前移
        tail->next = nullptr;//新尾节点的后向指针置空
        delete timer;
        return;
    }

    //其它情况正常移除节点即可
    timer->prev->next = timer->next;
    timer->next->prev = timer->prev;
    delete timer;
}

//调整定时器：当定时器的超时时间延长时(socket有新的收发消息行为)，调整定时器在链表中的位置
void sort_timer_lst::adjust_timer(util_timer *timer){
    //ps: 调整时间只会延长，所以只需要向后调整（向前调整不会发生）;且timer已经在链表中

    util_timer *tmp = timer->next;//当前节点只会往后调or原地不动

    //1. 空节点直接返回
    if(!timer) return;

    //2. 已经是尾节点 or 超时时间仍然小于下一个节点的超时时间，不需要调整
    if(!tmp || (timer->expire < tmp->expire)) return;

    //3. 被调整的节点是头节点：将timer从链表中取出，重新插入
    if(timer == head){
        //将timer从链表中取出并更新头节点
        head = head->next;
        head->prev = nullptr;
        timer->next = nullptr;

        //重新插入：只能往后调整，所以从新头节点开始找
        add_timer(timer, head);
    }

    //4. 其它情况：将timer从链表中取出，从timer的下一个节点开始找合适的位置插入
    else{
        //将timer从链表中取出
        timer->prev->next = timer->next;
        timer->next->prev = timer->prev;

        //重新插入：只能往后调整，所以从timer的下一个节点开始找
        add_timer(timer, timer->next);
    }
}
```

## 三、定时实现与信号通信流程

项目中实现定时器到时中断后跟主程序的通信是通过**信号**和**管道**实现的。

### 3.1 管道的创建

管道（pipe）是一种**半双工通信方式**，传输方式固定只能从**写端**传到**读端**，可以实现**父子进程之间**的通信。在本项目中，**主线程**（`epoll`监听）和**信号处理函数**（`sig_handler`）之间的通信是通过管道实现的。

管道也是一种文件描述符，所以本项目创建一个长度为2的`int`型数组，用于存放管道的读写文件描述符。在C++中通过`socketpair`函数创建管道。

其中，`pipefd[0]`是**读端**，`pipefd[1]`是**写端**。**读端**加入到主线程的`epoll`监听中，**写端**在信号处理函数中写入数据。当程序中唯一的定时器到时后，会触发`SIGALRM`信号并自动触发信号处理函数`sig_handler`，信号处理函数中向管道的**写端**写入数据，主线程中的`epoll`监听到**读端**有数据，就会对定时器容器进行遍历，处理到期的定时器。

<img src="timerSignalProcess.png">

#### 3.1.1 socketpair函数创建管道

在Linux中，使用`socketpair`函数创建一对**无名套接字**，并将套接字的文件描述符存放在`int`型数组中。函数原型如下：

```cpp
#include <sys/socket.h>
int socketpair(int domain, int type, int protocol, int sv[2]);
//ret = socketpair(PF_UNIX, SOCK_STREAM, 0, m_pipefd);
```

- `domain`：协议族，可以是`PF_UNIX`（UNIX域协议族）或`PF_INET`（IPv4协议族）
- `type`：套接字类型，可以是`SOCK_STREAM`（字节流TCP套接字）或`SOCK_DGRAM`（数据报UDP套接字）
- `protocol`：协议类型，只能为0
- `sv[2]`：存放套接字文件描述符的数组（`sv[0]`是读端，`sv[1]`是写端；对应本项目中的`pipefd[2]`）
- 返回值`ret`：成功返回0，失败返回-1

本项目中前面学过的`epoll`实现中，已经在`Utils`工具类中封装了关于`epoll`添加文件描述符的函数`addfd`以及设置文件描述符阻塞方式的函数`setnonblocking`，所以通过`socketpair`创建管道后，将**读端**加入到`epoll`监听中直接调用该函数即可。

将管道文件描述符设置为**非阻塞**，是为了避免管道套接字缓冲区写满了，阻塞导致**异步**执行的信号处理函数`sig_handler`执行时间过长影响主线程的正常工作。

在`webserver.cpp`中创建管道的代码如下(`eventListen`函数)：

```cpp
//通过socketpair创建全双工管道,管道也是一种文件描述符
//管道作用:可以通过管道在程序中实现进程间通信
ret = socketpair(PF_UNIX, SOCK_STREAM, 0, m_pipefd);//创建全双工管道读端m_pipefd[0]和写端m_pipefd[1]：写端是定时器向epoll通知事件的，epoll监听读端
assert(ret != -1);
utils.setnonblocking(m_pipefd[1]);//设置写端非阻塞
utils.addfd(m_epollfd, m_pipefd[0], false, 0);//将读端加入主线程epoll监听
```

#### 3.1.2 管道中传递的信号值

项目中管道中传递的数据是**信号值**，即`SIGALRM`和`SIGTERM`信号的值。其中，`SIGALRM`信号代表定时器到时，`SIGTERM`信号代表服务器关闭（用户在终端执行了`Ctrl+C`）。

这两个信号在库函数中有定义，可以直接使用。`SIGALRM`的值是14，`SIGTERM`的值是15。

```cpp
#define SIGALRM 14  //由alarm系统调用产生timer时钟信号
#define SIGTERM 15  //终端发送的终止信号
```

### 3.2 信号通信流程

在Linux中，信号是一种**异步通知机制**，用于通知进程发生了某种事件。信号是由**内核**或其他进程发送给目标进程的，目标进程在接收到信号后会**中断当前的正常流程**，执行信号处理函数。

需要先将本项目中关注的两种信号`SIGALRM`和`SIGTERM`的**信号处理函数**`sig_handler`注册到系统中，然后在信号处理函数中实现对应的功能。

注册函数：项目中在`lst_timer.cpp`中定义了信号处理函数`sig_handler`的实现，其中信号处理函数`sig_handler`只简单地向管道的**写端**写入信号值。后续的操作交由主线程去处理，这样能保证异步处理不耗时的工作，防止影响主线程。

#### 3.2.1 addsig函数：注册绑定信号-信号处理函数

C++中信号注册主要通过`sigaction`结构体对信号属性进行封装设置，然后通过`sigaction()`函数注册信号处理函数。

`sigaction`结构体定义如下：

```cpp
struct sigaction {
    void (*sa_handler)(int); //信号处理函数，当收到信号时，执行sa_handler函数
    void (*sa_sigaction)(int, siginfo_t *, void *); //信号处理函数，与 sa_handler 互斥
    sigset_t sa_mask; //在信号处理函数执行期间需要阻塞的信号集合
    int sa_flags; //指定信号处理的行为，触发sa_handler信号处理函数时会被自动传入sa_handler函数中
    void (*sa_restorer)(void); //已经废弃
};
```

其中，结构体中的信号处理函数`sa_handler`就是后面还会讲到的`sig_handler`函数。

`sa_mask`是一个信号集合，用于在信号处理函数执行期间**阻塞**的信号，防止信号处理函数执行过程中被其他信号打断。

`sigaction`函数原型如下：

```cpp
#include <signal.h>
int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);
```

- `signum`：注册的信号值，即`SIGALRM`和`SIGTERM`
- `act`：新的信号处理方式（属性），即`sigaction`结构体
- `oldact`：旧的信号处理方式（属性），用于保存之前的信号处理方式，如果不关心可以传入`nullptr`

因此本项目实现的`addsig`信号注册函数如下：

```cpp
//添加绑定信号函数
void Utils::addsig(int sig, void(handle)(int), bool restart){
    //sigaction结构体：用于设置和处理信号处理程序的结构体
    /*struct sigaction {
        void (*sa_handler)(int); //信号处理函数，当收到信号时，执行sa_handler函数
        void (*sa_sigaction)(int, siginfo_t *, void *); //信号处理函数，与 sa_handler 互斥
        sigset_t sa_mask; //在信号处理函数执行期间需要阻塞的信号集合
        int sa_flags; //指定信号处理的行为，触发sa_handler信号处理函数时会被自动传入sa_handler函数中
        void (*sa_restorer)(void); //已经废弃
    }*/

    //创建sigaction结构体
    struct sigaction sa;
    memset(&sa, '\0', sizeof(sa));
    sa.sa_handler = handle;//设置信号处理函数
    if(restart){
        //SA_RESTART：如果信号中断了进程的某个系统调用，系统调用就会自动重启
        sa.sa_flags |= SA_RESTART;
    }
    sigfillset(&sa.sa_mask);//添加到默认信号集sa_mask中，处理当前默认信号集sa_mask时阻塞其它信号集，以确保信号处理程序的执行不会被其他信号中断
    assert(sigaction(sig, &sa, nullptr) != -1);//注册信号处理函数
}
```

#### 3.2.2 sig_handler函数：信号处理函数

当**内核**检测到**信号发生**时，检测**signal位图信息**（也就是前面注册过的），然后通知**用户态**调用对应的**信号处理函数**。

具体流程如下：

<img src="signalProcess.png">

由上图可知，Linux下信号采用异步机制，信号处理函数和当前进程是两条不同的执行路线。

在注册时我们选择了屏蔽方式，所以为了确保信号不会被屏蔽太久，本项目中信号处理函数仅仅通过管道发送信号值，不处理信号对应的逻辑（由主程序处理），缩短异步执行时间，减少对主程序的影响。

- 内核的工作
    - 内核**检测和接收**信号，同时向**用户进程**发送一个中断，使其进入内核态
    - 当信号处理函数执行完毕后，还会**返回内核态**，检查是否还有其它信号未处理
- 用户态的工作
    - 用户进程**接收**内核的中断
    - 进入**信号处理函数**，执行信号处理函数的逻辑
    - 所有的信号处理完毕后，**返回用户态**，继续执行用户进程的正常流程（恢复到中断前运行的位置）

```cpp
//信号处理函数：处理信号SIGALRM-SIGTERM
//通过管道通知主循环有SIGALRM or SIGTERM信号需要处理
void Utils::sig_handler(int sig){
    //保留原来的errno，在函数最后恢复，以保证函数的可重入性
    int save_errno = errno;
    int msg = sig;
    send(u_pipefd[1], (char *)&msg, 1, 0);//通过管道的写端来通知主循环，有信号需要处理（传给主循环epoll监听的管道读端）
    errno = save_errno;//恢复原来的errno
}
```

#### 3.2.3 主程序中注册信号

在`webserver.cpp`中的`eventListen`函数中，注册了两个信号`SIGALRM`和`SIGTERM`，并绑定了信号处理函数`sig_handler`。

另外，我们除了`SIGALRM`和`SIGTERM`信号外，还注册了`SIGPIPE`信号，将其处理方式设置为`SIG_IGN`，即忽略`SIGPIPE`信号。`SIGPIPE`信号是在**读取已关闭的管道**时产生的，如果不处理`SIGPIPE`信号，当读取已关闭的管道时会导致程序退出。

```cpp
//绑定不同信号（SIGPIPE-SIGALRM-SIGTERM）的信号处理函数（忽略 or sig_handler发送sig标识）
utils.addsig(SIGPIPE, SIG_IGN);
utils.addsig(SIGALRM, utils.sig_handler, false);
utils.addsig(SIGTERM, utils.sig_handler, false);
```

同时在`eventListen`函数中开启唯一的定时器，通过`alarm`函数设置定时器的超时时间，当定时器到时后会发送注册过的`SIGALRM`信号后，触发信号处理函数`sig_handler`。

```cpp
//启动定时器，每TIMESLOT秒发送SIGALRM信号（整个程序中只有一个真实的定时器，定时器容器中的是存储超时的绝对时间来与这个唯一的timeout处理进行比较）
alarm(TIMESLOT);
```

## 四、完整的定时器使用流程（主循环中）

首先，服务端开启时，创建一个定时器容器，并创建一个全双工管道，将管道的读端加入到`epoll`监听中。注册两个信号`SIGALRM`和`SIGTERM`，并绑定信号处理函数`sig_handler`。

然后，开启唯一的定时器，通过`alarm`函数设置唯一真实定时器的超时时间，当定时器到时后会发送注册过的`SIGALRM`信号后，触发信号处理函数`sig_handler`将信号值写入管道发送给主线程，由主线程决定执行什么操作。

之后，主线程epoll管道读端监听到有管道数据，会调用`dealwithsignal`函数解析信号值，根据信号值的不同重置`timeout`or`stop_server`标识符（处理定时器操作or关闭服务器）。

最后，根据用户的连接请求具体地实现定时器使用：

- 当客户端与服务器连接时（连接事件），为其创建一个用户结构（结构体中包含定时器节点，并将定时器节点加入到定时器容器中）
- 当客户端与服务器有数据交互时(读/写事件)，需要重置该定时器节点，调整定时器在链表中的位置
- 当定时器到时后，处理定时信号，将`timeout`标志设置为`true`，在主线程中遍历定时器容器，处理删除到期的定时器节点

除了`SIGALRM`信号外，我们还注册了`SIGTERM`信号，这里顺便讲一下，当管道读端接收到`SIGTERM`信号时，主线程会将`stop_server`标志设置为`true`，退出`eventLoop`的`while`循环，关闭服务器。

<img src="dealwithsignal.png">

**主线程循环中epoll监听到管道读端有数据**

```cpp
//主循环:epoll_wait阻塞监听事件
void WebServer::eventLoop(){
    bool timeout = false;
    bool stop_server = false;

    while(!stop_server){
        //epoll_wait设置为-1,也就是阻塞监听事件
        //当有事件发生时,epoll_wait返回事件个数number,且事件存在events数组中
        int number = epoll_wait(m_epollfd, events, MAX_EVENT_NUMBER, -1);

        //遍历events数组,处理就绪事件
        if(number < 0 && errno != EINTR){
            LOG_ERROR("%s", "epoll failure");
            break;
        }
        for (int i = 0; i < number; i++){
            int sockfd = events[i].data.fd;

            //管道读端有事件发生:信号处理，通过dealwithsignal从epoll管道读端读取信号，并解析对应的信号（SIGALRM-SIGTERM）
            else if((sockfd == m_pipefd[0]) && (events[i].events & EPOLLIN)){
                bool flag = dealwithsignal(timeout, stop_server);
                if (false == flag)
                    LOG_ERROR("%s", "dealclientdata failure");
            }
        }

        // 处理定时器事件:timer tick定时中断,执行timer_handler处理链表上到期的节点
        if (timeout)
        {
            utils.timer_handler();

            LOG_INFO("%s", "timer tick");

            timeout = false;
        }
    }
}
```

**针对timeout标志的处理**

定时器到时后，调用`timer_handler`函数处理链表上到期的节点，处理完后重开定时器。

具体实现如下：

```cpp
//主函数发现定时器超时，调用该函数查找超时定时器并处理
void Utils::timer_handler()
{
    m_timer_lst.tick();//定时器容器中查找并处理超时定时器
    alarm(m_TIMESLOT);//重新定时，以不断触发SIGALRM信号
}
```

其中`tick`函数是定时器容器中的一个函数，用于处理链表上到期的节点。由于容器是升序的，所以当找到第一个未到期的节点时，就可以结束遍历。

```cpp
//SIGALRM信号每次被触发，主循环管道读端监测出对应的超时信号后就会调用timer_handler进而调用定时器容器中通过tick函数查找并处理超时定时器
// 处理链表上到期的任务(定时器timeout回调函数删除socket和定时器)
void sort_timer_lst::tick()
{
    if (!head)
    {
        return;
    }
    
    time_t cur = time(NULL);//当前定时器到时的绝对时间

    //循环定时器容器，比较定时器的超时时间和当前时间（都是绝对时间）
    util_timer *tmp = head;
    while (tmp)
    {
        if (cur < tmp->expire)
        {
            break;
        }

        //由于定时器是升序链表，所以未找到cur < tmp->expire前，前面的节点都是超时的，得删除节点并关闭连接
        // （通过回调函数cb_func处理，cb_func不删除定时器节点）
        tmp->cb_func(tmp->user_data);

        //删除超时节点并更新tmp和head
        head = tmp->next;
        if (head)
        {
            head->prev = NULL;
        }
        delete tmp;
        tmp = head;
    }
}
```

对于需要删除的非活跃连接，执行定时器节点中的回调函数`cb_func`，在回调函数中关闭对应的文件描述符，并将其从epoll内核事件表中删除。执行完回调函数后就可以 在容器中`delete`删除该定时器节点了。

## 五、总结

本文完成了Webserver项目中通过定时器实现了对**非活跃连接的客户端**的处理，主要知识点有**管道**、**信号机制**、**定时器容器**等。

完成了定时器，项目基本已经完善了，但是为了**对服务器运行状态进行监控维护**，最后还需要添加**日志系统**，下一篇文章将会讲解日志系统的实现。具体内容请看下一篇博客[WebServer学习8：通用日志系统的设计](https://akirazheng.github.io/2024/03/27/WebServer%E5%AD%A6%E4%B9%A08%EF%BC%9A%E9%80%9A%E7%94%A8%E6%97%A5%E5%BF%97%E7%B3%BB%E7%BB%9F%E7%9A%84%E8%AE%BE%E8%AE%A1/)