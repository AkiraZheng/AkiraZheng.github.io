---
title: 从0开始实现线程池(C++)
date: 2024-02-07 12:36:20
tags:
categories:
  - WebServer项目（C++）
---

## 一、线程池概述

### 1. 线程池的设计初衷

线程池是一种**池式结构**(内存池、消息队列也属于池式结构)，主要解决**缓存问题**，起缓冲作用

C++在进行多线程的创建和销毁时，会有比较大的开销，特别是在进行比快的线程操作时，会把很大的时间消耗在线程的创建和销毁上

为了减少在程序中反复创建和销毁线程，就引入了线程池的概念

线程池是在程序启动时，就创建一定数量的线程，放入一个**线程队列**中，当需要使用线程时，就从线程队列中取出一个线程，使用完毕后，再放回线程队列中

### 2. 线程池的主要作用

线程池可以实现**异步解耦**，将任务分解为多个子任务，然后将子任务分配给线程池中的线程执行，从而提高程序的执行效率

线程池的使用举例：

**a. 服务器端处理客户端请求**

当有客户端请求时，服务器端就会创建一个线程来处理客户端的请求，但是如果客户端的请求量很大，服务器端就会创建很多线程，这样会导致服务器端的性能下降

因此可以使用线程池来解决这个问题，将客户端的请求放入线程池中，线程池中的线程来处理客户端的请求。具体实现如下：
1. 创建一个线程池，设置线程池的大小为n
2. 当有客户端请求时，就将客户端的请求放入线程池中
3. 线程池中的线程来处理客户端的请求
4. 处理完客户端的请求后，将线程归还给线程池

**b. 保存日志文件**

在日志保存时，需要进行文件的读写操作，性能会压在磁盘上，可以采用线程池实现异步解耦来解决这个问题


## 二、C++多线程基础学习

### 1. 互斥锁解决多线程数据共享问题

多线程操作中，经常会需要在多个线程任务中同时使用同一资源（变量、文件等），如果不加锁往往会出现**数据竞争**问题

数据竞争问题会导致**数据不一致性**，比如对于同一个变量`a`，线程1对`a`进行修改，但是还没结束单条指令的时候，线程2就开始对`a`进行修改，那么最终`a`的值就会出现混乱

下面举一个例子（Windows下），我们开启两个线程对同一个`a`变量分别进行5000次的自增操作，然后打印`a`的值，我们会发现`a`的值并不是10000，而是一个小于10000的值

```C++
#include <iostream>
#include <thread>

using namespace std;

int a = 0;
void func() {
	for (int i = 0; i < 5000; i++) {
		a++;
	}
}

//测试
void testMultiThread() {
	thread t1(func);
	thread t2(func);
	t1.join();
	t2.join();
	cout << "final a:" << a << endl;
}

int main()
{
    testMultiThread();
    return 0;
}
```

此时我们对两个线程共享的数据`a`进行加锁，就可以保证当一个线程拿到`a`变量的锁之后，另一个线程就无法对`a`进行修改，直到第一个线程释放锁unlock，下一个线程才可以执行对应的操作，保证了共享数据的安全性

```C++
#include <iostream>
#include <thread>
#include <mutex>

using namespace std;

int a = 0;
mutex mtx;//定义一个互斥锁
void func() {
	for (int i = 0; i < 5000; i++) {
		mtx.lock();//加锁
		a++;
		mtx.unlock();//解锁
	}
}

//测试
void testMultiThread() {
	thread t1(func);
	thread t2(func);
	t1.join();
	t2.join();
	cout << "final a:" << a << endl;
}

int main()
{
    testMultiThread();
    return 0;
}
```

可以看到，此时经过两个线程各自进行5000次的自增操作后，`a`的值变为了10000，也就是实现了多线程对共享变量`a`的安全操作

### 2. 死锁问题的出现

**1）造成死锁的条件**

造成死锁有四个必要条件：
- **互斥**：一个资源每次只能被一个进程使用
- **持有和等待**：一个进程因请求资源而阻塞时，对已获得的资源保持不放
- **不可剥夺**：进程已获得的资源，在未使用完之前，不能被其他进程强行剥夺**（用定时释放解决）**
- **循环等待**：若干进程之间形成头尾相接的循环等待资源关系**（通过顺序加锁减少出现概率）**

**2）造成死锁的情况及对应解决方法**

造成死锁的情况可能有：
- 忘记释放锁
- 重复加锁
- 循环等待：两个线程分别在等待对方释放锁

对应的解决方法：
- 检查锁的释放
- 多把锁按顺序加锁
- 引入死锁检查模块
- 通过定时释放资源解决不可剥夺问题

**3）死锁中循环等待问题的例子**

死锁问题是指两个或多个线程互相等待对方释放资源，导致程序无法继续执行的问题

- 举个例子，线程1和线程2分别都有两把锁`mtx1`和`mtx2`，线程1先对`mtx1`加锁，线程2先对`mtx2`加锁
- 然后线程1下一条指令是对`mtx2`加锁，但是此时`mtx2`已经被线程2加锁了，线程1就会等待线程2释放`mtx2`的锁
- 同时线程2下一条指令是对`mtx1`加锁，但是此时`mtx1`已经被线程1加锁了，线程2就会等待线程1释放`mtx1`的锁
- 这样就会导致线程1和线程2互相等待对方释放锁，导致程序一直卡着无法继续执行

```C++
#include <iostream>
#include <thread>
#include <mutex>

using namespace std;

std::mutex mtx1, mtx2;//定义两把锁
void func1(){
    for(int i = 0; i < 10; i++){
        mtx1.lock();//step1
        mtx2.lock();//step3:等待不到mxt2被释放，卡死
        mtx2.unlock();
        mtx1.unlock();
    }
}

void func2(){
    for(int i = 0; i < 10; i++){
        mtx2.lock();//step2
        mtx1.lock();//step4:等待不到mxt1被释放，卡死
        mtx1.unlock();
        mtx2.unlock();
    }
}

//测试
void testMultiThread(){
    thread t1(func1);
    thread t2(func2);
    t1.join();
    t2.join();
}

int main()
{
    testMultiThread();
    return 0;
}
```

因此，我们在使用多线程的时候，需要注意避免死锁问题的出现：在多个线程中，尽量不要同时对多个锁进行加锁，如果需要同时对多个锁进行加锁，需要保持**多个线程中对锁的加锁顺序一致**

同样采用上面的例子，我们可以将`func1`和`func2`中对锁的加锁顺序保持一致：
- `func1`中先对`mtx1`加锁，此时由于`mtx1`被加锁了，第二个线程拿不到`mtx1`的锁，就会先等待`mtx1`被释放，此时`func1`就可以接着直接对`mtx2`加锁
- 等到`func1`释放`mtx1`的锁后，`func2`就可以开始对`mtx1`加锁，然后等待`func2`释放`mtx2`的锁
- 通过两个线程**对锁的加锁顺序保持一致**，就可以避免死锁问题的出现

```C++
#include <iostream>
#include <thread>
#include <mutex>

using namespace std;
std::mutex mtx1, mtx2;//定义两把锁

void func1(){
    for(int i = 0; i < 10; i++){
        mtx1.lock();//step1
        mtx2.lock();//step2
        mtx2.unlock();//step3
        mtx1.unlock();//maybe step5
    }
}

void func2(){
    for(int i = 0; i < 10; i++){
        mtx1.lock();//maybe step4
        mtx2.lock();//maybe step6
        mtx2.unlock();
        mtx1.unlock();
    }
}

//测试
void testMultiThread(){
    thread t1(func1);
    thread t2(func2);
    t1.join();
    t2.join();
}

int main()
{
    testMultiThread();
    return 0;
}
```


### 3. Linux下互斥锁和条件变量的使用

Linux下c++互斥锁和条件变量的使用，需要引入`<pthread.h>`头文件，使用`pthread_mutex_t`和`pthread_cond_t`来定义互斥锁和条件变量

- **互斥锁**是对多线程共享资源的保护
- **条件变量**是当多个线程需要**等待某个条件满足时**，就可以使用条件变量来**进行线程的等待（进入阻塞）和唤醒**。如果采用互车锁进行阻塞会造成死锁，所以加入条件变量来实现线程的等待和唤醒

#### pthread_mutex_t的简单使用

- `pthread_mutex_t`定义一个互斥锁
- `pthread_mutex_init`初始化互斥锁，传入两个参数：第一个参数是互斥锁的地址，第二个参数是互斥锁的属性，一般传入`NULL`
- `pthread_mutex_lock`实现加锁，传入一个参数：互斥锁的地址
- `pthread_mutex_unlock`实现解锁，传入一个参数：互斥锁的地址

```C++
#include <pthread.h>

pthread_mutex_t mutex;//定义一个互斥锁
pthread_mutex_init(&mutex, NULL);//初始化互斥锁

void func(){
    pthread_mutex_lock(&mutex);//加锁
    //do something
    pthread_mutex_unlock(&mutex);//解锁
}
```

#### pthread_cond_t的简单使用

- `pthread_cond_t`定义一个条件变量
- `pthread_cond_init`初始化条件变量，传入两个参数：第一个参数是条件变量的地址，第二个参数是条件变量的属性，一般传入`NULL`
- `pthread_cond_wait`实现线程的等待（阻塞），传入两个参数：第一个参数是条件变量的地址，第二个参数是互斥锁的地址
    - 该函数执行后，获得信号（signal函数）之前，将一直被阻塞。
    - 该函数会在**被阻塞之前**以原子方式**释放相关的互斥锁**
    - 并在**被唤醒时**以原子方式**再次获取该互斥锁**
    - 所以我们在下面的线程池中，虽然被阻塞的时候会被释放互斥锁，但是在被唤醒时会再次获取互斥锁，所以**唤醒后需要进行解锁**操作
- `pthread_cond_signal`实现线程的唤醒，传入一个参数：条件变量的地址
- `pthread_cond_destroy`销毁条件变量，传入一个参数：条件变量的地址
- `pthread_cond_broadcast`唤醒所有等待在条件变量上的线程


**线程A等待条件的伪代码**

```C++
pthread_mutex_lock(&mutex); // 拿到互斥锁，进入临界区
while( **条件为假**)
//如果不满足条件 就让线程A进入休眠 释放互斥锁，当有信号触发时，该线程重新获得锁 并继续往下执行。
	pthread_cond_wait(cond, mutex); // 令进程等待在条件变量上
**修改条件**
pthread_mutex_unlock(&mutex); // 释放互斥锁
```

**线程B通知线程A的伪代码**

```C++
pthread_mutex_lock(&mutex); // 拿到互斥锁，进入临界区
设置条件为真
pthread_cond_signal(cond); // 通知等待在条件变量上的消费者
pthread_mutex_unlock(&mutex); // 释放互斥锁
```

至于条件变量的实际应用将在后面线程池的实现中进行详细讲解

## 三、线程池的实现源码及解析(C++)

### 1. 明确目标：剖析线程池需要实现的模块(框架)
- 工作队列：控制线程池中的线程状态
- 任务队列：线程中的任务函数（任务对应的执行函数）
- 线程池控制管理：两把锁（一把控制操作的**互斥锁**，一把用于新任务加入时唤醒线程的**条件锁**）
- 管理者线程：用于自动管理线程池中线程数量
- pthread_create的回调函数：回调函数是每个线程创建之后就开始执行的函数，该函数作为**pthread_create的第三个参数传入**
```C++
//pthread_create函数原型：
int pthread_create(pthread_t *tidp,const pthread_attr_t *attr,
                    void *(*start_rtn)(void*),void *arg);
```

`pthread_create`函数的陷阱：函数原型中第三个参数为函数指针，指向处理线程函数的地址，该函数要求为静态函数，所以如果回调函数(worker)是类成员函数时，需要将**worker函数设置为静态成员函数**

第四个参数`this`指针的陷阱：静态成员函数中没有`this`指针，所以如果需要在静态成员函数中调用类的成员函数，需要**将代表当前实例化类对象的`this`指针作为参数传入**

<img src='structure_threadPooling.png' width='80%' height='80%'>

线程池中的**生产者和消费者模型**：

<img src="thread_poll_model.png" width='80%' height='80%'>

线程池中关于线程创建、销毁等的操作：

- `pthread_create(pthread_t *thread, const pthread_attr_t *attr, void *(*start_routine) (void *), void *arg);`：创建线程
    - thread：指向线程标识符的指针
    - attr：指向线程属性的指针,一般为传递NULL作为默认属性
    - start_routine：线程运行函数的起始地址。线程函数的返回类型必须为void*，且接受一个void*类型的参数。
    - arg：传递给线程函数的参数，通过void*进行传递
- `pthread_join(pthread_t thread, void **retval);`：等待线程结束
    - thread：线程标识符
    - retval：用户定义的指针，用来存储被等待线程的返回值
- `pthread_exit(void *retval);`：终止线程
    - retval：线程的返回值
- `pthread_detach(pthread_t thread);`：分离线程
    - thread：线程标识符
    - 该函数的作用是将参数thread标识的线程的状态设置为分离状态，这样线程在终止时会自动释放所有资源，而不用在其他线程中对其进行回收

下面进行线程池的实现讲解，其中在Linux下编译运行使用`Makefile`自动化脚本进行编译

对`Makefile`基础使用的讲解可参考我的博客：[WebServer学习2：从Config文件了解Makefile编译](https://akirazheng.github.io/2024/03/03/WebServer%E5%AD%A6%E4%B9%A02%EF%BC%9A%E4%BB%8EConfig%E6%96%87%E4%BB%B6%E4%BA%86%E8%A7%A3Makefile%E7%BC%96%E8%AF%91/#/1-int-main-int-argc-char-argv4)

```Makefile
CXX = g++
TARGET = test
# 自动实现把当前目录下的所有.cpp文件转换成.o文件
SRC = $(wildcard *.cpp)
# SRC += $(wildcard timer/*.cpp)# 添加timer文件夹里的文件
OBJS = $(patsubst %.cpp, %.o, $(SRC))

# 编译选项 -c 表示编译链接分开进行 -Wall 表示显示所有警告信息
CXXFLAGS = -c -Wall

$(TARGET): $(OBJS)
	$(CXX) -o $@ $^

# 简化所有的.o文件的生成规则
%.o: %.cpp
	$(CXX) $(CXXFLAGS) $< -o $@

.PHONY: clean
clean:
	rm -f *.o $(TARGET)
```

### 2. 线程池中任务队列类的实现

#### 2.1 单任务结构体的设计

首先设计一个单任务结构体，用于封装任务的回调（执行）函数指针和回调函数对应的参数

在C++中，函数指针的声明方式为：`返回类型(*函数指针名)(参数类型1, 参数类型2, ...);`

- 这里我们的线程池任务结构体中，函数指针类型声明：`void(*)(void*)`
    - void: 表示函数的返回类型为 void，即不返回任何值。
    - (*): 表示这是一个指针。
    - (void*): 表示指针所指向的函数将接受一个 void* 类型的参数。

采用`using`的方式创建函数指针类型别名，方便后续使用（这里我们将别名定位`callback`代表回调函数）

采用别名后使用函数的方式：`callback func = &func_name;`，`func(*args)`实现函数的调用

- TaskQueue.h

```C++
/*定义任务队列中单个任务的结构体:
* 包含回调函数指针和回调函数所要传递的参数
*/
using callback = void(*)(void*);
struct Task{
    callback function;//回调函数指针
    void *arg;//回调函数所要传递的参数

    //默认构造函数
    Task(){
        function = nullptr;
        arg = nullptr;
    }

    //传参构造函数
    Task(callback f, void *a){
        function = f;
        arg = a;
    }
};
```

#### 2.2 任务队列类的设计

设计一个任务队列类，用于存储任务队列中的任务

**任务队列**是一种需要**先进先出**的数据结构，C++中有标准库中的`queue`容器可以方便地实现队列的功能

其中任务队列对于线程池来说一般只有一个，所以我们需要在多线程消费者使用任务队列的时候，对共享的数据进行加锁保护

这里共享的数据就是TaskQueue类中的`queue`容器，所以我们需要对`queue`容器进行加锁保护，以保证多线程对`queue`容器的安全操作

- TaskQueue.h

```C++
#include <queue>
#include <pthread.h>

//定义任务队列类
class TaskQueue{
//共有接口
public:
    TaskQueue();
    ~TaskQueue();

    //生产者（主程序中的用户）添加新任务到队列
    void addTask(Task &task);
    void addTask(callback function, void *arg);//重载，不使用封装好的Task结构体

    //消费者（线程池中的线程）从队列中取任务
    Task takeTask();

    //获取当前队列中的总等待任务数
    int getTaskCount(){
        return m_queue.size();
    }
    
//私有变量
private:
    std::queue<Task> m_queue;//任务队列
    pthread_mutex_t m_mutex;//互斥锁保护共享数据（任务队列）
};
```

- TaskQueue.cpp

```C++
#include "TaskQueue.h"

TaskQueue::TaskQueue()
{
    //初始化互斥锁为NULL
    pthread_mutex_init(&m_mutex, NULL);
}

TaskQueue::~TaskQueue()
{
    //销毁互斥锁
    pthread_mutex_destroy(&m_mutex);
}

void TaskQueue::addTask(Task &task)
{
    //加锁
    pthread_mutex_lock(&m_mutex);
    //将生产者给的任务加入就绪队列中
    m_queue.push(task);
    //释放锁
    pthread_mutex_unlock(&m_mutex);
}

void TaskQueue::addTask(callback function, void *arg)
{
    pthread_mutex_lock(&m_mutex);
    //封装成Task结构再传入队列中
    m_queue.push(Task(function, arg));
    pthread_mutex_unlock(&m_mutex);
}

Task TaskQueue::takeTask()
{
    //任务队列中不为空才可以返回任务
    Task task;
    pthread_mutex_lock(&m_mutex);
    if(getTaskCount() > 0){
        task = m_queue.front();
        m_queue.pop();
    }
    pthread_mutex_unlock(&m_mutex);
    return task;
}
```

#### 2.3 对当前的任务队列类进行测试

- test.cpp

```C++
#include "TaskQueue.h"
#include <iostream>

void taskFunc(void *arg){
    int num = *(int*)arg;
    std::cout << "thread " << pthread_self() << " is working, num = " << num << std::endl;
}

void testTaskQueue(){
    TaskQueue taskQ;
    for (int i = 0; i < 10; i++){
        int *num = new int(i);
        Task task(taskFunc, num);
        taskQ.addTask(task);
    }
    for (int i = 0; i < 10; i++)
    {
        Task task = taskQ.takeTask();
        task.function(task.arg);
    }
}

int main(){
    
    testTaskQueue();
    return 0;
}
```

测试结果：

<img src="TaskQueueTest.png">

### 3. 线程池的实现

首先需要设计线程池类的`.h`声明文件，具体包括
- 线程池的基本参数(私有变量)
    - **唯一的任务队列对象**
    - 线程池中的线程对象（工作线程和管理者线程）、以及关于线程安全的**共享互斥锁和条件变量**
    - 线程池中的参数：线程池的大小、线程池中**忙线程**与**存活线程**的数量、管理者**每次控制线程销毁/创建**的数量、线程池是否关闭
- 线程池的私有接口
    - 静态函数：包括所有**工作线程的回调函数worker**、唯一**管理者线程的回调函数manager**
    - 成员函数:**线程销毁**
- 线程池的公有接口
    - 类构造函数和析构函数
    - 功能函数：添加任务、获取忙线程数、获取存活线程数

- ThreadPool.h

```C++
#pragma once

#include <pthread.h>
#include <iostream>
#include <cstring>//memset
#include <unistd.h>//sleep

#include "TaskQueue.h"

class ThreadPool{
public:
    ThreadPool(int min, int max);
    ~ThreadPool();

    //线程池提供共用接口
    //1. 添加任务
    void addTask(Task task);
    //2. 获取线程池中忙线程数
    int getBusyNum();
    //3. 获取线程池中存活线程数
    int getAliveNum();

private:
    //工作线程函数：从任务队列中取任务（回调函数）并执行
    static void* worker(void *arg);
    //管理者线程函数：管理线程数量
    static void* manger(void *arg);
    //销毁线程函数：销毁线程
    void threadExit();

private:
    pthread_mutex_t m_mutex;//互斥锁
    pthread_cond_t m_cond;//条件变量锁
    pthread_t *m_threadIds;//线程池数组：如果线程是存活的，那么数组中对应的位置就是对应线程的ID，否则应为0
    pthread_t m_mangerID;//管理者线程ID
    TaskQueue *m_taskQ;//任务队列

    //线程池参数设置：
    //线程池中线程数量、任务队列大小、管理者可控制的最大和最少线程数、线程池是否销毁、线程池中忙线程数以及存活线程数
    int m_minThreads;
    int m_maxThreads;
    int m_busyThreads;//在工作线程中更新的
    int m_aliveThreads;//在管理者线程中更新的
    int m_exitThreads;//管理者通知需要销毁的线程数
    bool m_shutDown;
    static const int MangerCtlThreadNum = 2;//管理者线程每次销毁或创建的线程数
};
```

#### 3.1 线程池的构造函数和析构函数

- 构造函数负责初始化线程池`.h`中的基础参数，包括任务队列、锁、创建线程等
- 析构函数对应地`delete`线程池中的资源、并销毁线程（设置`m_shutDown`参数为1，使线程启动自杀销毁）

- ThreadPool.cpp

```C++
#include "ThreadPool.h"

ThreadPool::ThreadPool(int min, int max)
{
    do{
        /*初始化&实例化线程池参数*/

        //实例化当前线程池的唯一任务队列
        m_taskQ = new TaskQueue;

        //初始化线程池中的线程管理参数
        m_minThreads = min;
        m_maxThreads = max;
        m_busyThreads = 0;
        m_aliveThreads = m_minThreads;
        m_shutDown = false;

        //初始化线程池中的线程数组:按照最大线程数创建数组（只是创建数组，并不创建线程）
        m_threadIds = new pthread_t[m_maxThreads];
        if(m_threadIds == nullptr){
            //创建线程数组失败
            std::cout << "new pthread_t[] failed" << std::endl;
            break;//创建失败，直接跳出并销毁资源
        }
        memset(m_threadIds, 0, sizeof(pthread_t)*m_maxThreads);//数组内的线程ID初始化为0

        //初始化互斥锁和条件变量
        if(pthread_mutex_init(&m_mutex, NULL) != 0 ||
        pthread_cond_init(&m_cond, NULL) != 0){
            //初始化失败
            std::cout << "init mutex or cond failed" << std::endl;
            break;//初始化失败，直接跳出并销毁资源
        }

        //创建线程池中的线程：只创建最小线程数m_minThreads个alive线程
        for(int i = 0; i < m_minThreads; i++){
            //线程的回调函数为worker，参数为当前线程池对象
            //由于回调函数是静态函数，所以如果回调函数想取任务队列中的任务，必须将当前线程池对象传入才能访问任务队列
            pthread_create(&m_threadIds[i], NULL, worker, this);
            std::cout << "create thread ID: " << m_threadIds[i] << std::endl;
        }

        //创建管理者线程：1个
        pthread_create(&m_mangerID, NULL, manger, this);
        std::cout << "create manger thread ID: " << m_mangerID << std::endl;

    }while(0);

    //初始化失败，释放资源
    if(m_taskQ) delete m_taskQ;
    if(m_threadIds) delete[] m_threadIds;
}

ThreadPool::~ThreadPool()
{
    
    //关掉线程池工作
    m_shutDown = true;

    //销毁管理者线程
    std::cout << "manger thread ID: " << m_mangerID << " is exiting" << std::endl;
    pthread_join(m_mangerID, NULL);
    //唤醒被阻塞的线程
    for(int i = 0; i < m_aliveThreads; i++){
        pthread_cond_signal(&m_cond);
    }

    //释放new的堆内存
    // if(m_taskQ) delete m_taskQ;
    // std::cout << "delete m_taskQ" << std::endl;
    // if(m_threadIds) delete[] m_threadIds;
    // std::cout << "delete m_threadIds" << std::endl;

    //销毁互斥锁和条件变量
    pthread_mutex_destroy(&m_mutex);
    // std::cout << "destroy m_mutex" << std::endl;
    pthread_cond_destroy(&m_cond);
    // std::cout << "destroy m_cond" << std::endl;

}
```

#### 3.2 线程池的添加任务以及获取忙线程数和存活线程数

注意这三个函数中涉及的关键参数都是pool中多线程的**共享数据**，所以记得进行**加锁保护**

记得在添加任务后需要**唤醒线程**，让线程去取任务

- ThreadPool.cpp

```C++
void ThreadPool::addTask(Task task)
{
    if(m_shutDown){
        return;
    }

    //任务加入队列中
    m_taskQ->addTask(task);

    //唤醒线程，让线程去取任务
    pthread_cond_signal(&m_cond);
}

int ThreadPool::getBusyNum()
{
    int busyNum = 0;
    pthread_mutex_lock(&m_mutex);
    busyNum = m_busyThreads;
    pthread_mutex_unlock(&m_mutex);
    return busyNum;
}

int ThreadPool::getAliveNum()
{
    int aliveNum = 0;
    pthread_mutex_lock(&m_mutex);
    aliveNum = m_aliveThreads;
    pthread_mutex_unlock(&m_mutex);
    return aliveNum;
}
```

#### 3.3 线程池中线程自我销毁的实现

线程自我销毁函数`threadExit`，是在某个具体工作线程`worker`中被调用的。

- 当`threadExit`函数被调用时**获取当前worker线程的ID**

- 然后***找到线程池数组中对应的位置*置为0**，表示线程处于被销毁（不存活）状态

- 最后再调用`pthread_exit(NULL)`函数实现**执行当前程序的线程的自杀销毁**

- ThreadPool.cpp

```C++
//线程自杀
void ThreadPool::threadExit()
{
    //获取当前线程ID
    pthread_t tid = pthread_self();

    //从线程池数组中找到当前线程的ID，将其置为0，表示线程处于被销毁（不存活）状态
    for (int i = 0; i < m_maxThreads; i++){
        if(m_threadIds[i] == tid){
            m_threadIds[i] = 0;
            break;
        }
    }

    //线程退出
    pthread_exit(NULL);
}
```

#### 3.4 线程池的工作线程

线程池中所有工作线程的工作机制都是一样的，所以我们直接将工作线程的回调函数同一为`worker`，并在`worker`中实现工作线程的工作机制：

- `worker`接受的参数是当前线程池对象，因为`worker`本身是静态函数，又需要访问线程池类中的共享参数，所以需要将线程池对象传入
- 当当前线程中，判断出任务队列中没有任务时，就会**阻塞等待**，直到有新任务加入队列，就会被唤醒
    - 其中阻塞的时候会**释放互斥锁**，唤醒后会**再次获取互斥锁**，所以唤醒后记得需要进行**解锁操作**
- 一般有两种情况会唤醒线程：1. 有新任务加入队列 2. 线程池销毁，需要唤醒线程自杀（包括管理者控制）
    - 当出现第1种情况时，`worker`被唤醒后会**获取任务**并**执行任务**，然后再次**阻塞等待**
    - 当出现第2种情况时，`worker`被唤醒后会**判断标志销毁线程的参数是否被设置了**，如果是就会**自杀销毁**（通过`threadExit`函数自杀）

- ThreadPool.cpp
    
```C++
//所有工作线程的工作模式都一致
void *ThreadPool::worker(void *arg)
{
    ThreadPool* pool = static_cast<ThreadPool*>(arg);//传进来的是一个this指针

    //工作队列的循环：空队列时阻塞线程，非空队列时执行任务
    while(true){
        pthread_mutex_lock(&pool->m_mutex);

        /*1. 任务队列为空且线程池没被关闭：阻塞工作线程*/
        while(pool->m_taskQ->getTaskCount() == 0 && !pool->m_shutDown){
            std::cout << "thread " << pthread_self() << " is waiting" << std::endl;
            pthread_cond_wait(&pool->m_cond, &pool->m_mutex);//阻塞的时候当前线程的锁会被释放，等待被唤醒后会重新获得锁

            //解除阻塞后，判断是否销毁当前线程（由管理者线程控制的，因为如果是管理者唤醒线程而不是Task唤醒的话，说明管理者选中销毁当前空闲线程）
            if(pool->m_exitThreads > 0){
                //管理者选中销毁当前线程，会通知需要销毁m_exitThreads个线程
                pool->m_exitThreads--;//需要销毁的线程数减一
                if(pool->m_aliveThreads > pool->m_minThreads){
                    //自杀
                    pool->m_aliveThreads--;//存活线程数减一
                    std::cout << "manger kills thread ID: " << pthread_self() << std::endl;
                    pthread_mutex_unlock(&pool->m_mutex);//线程被唤醒重新获得阻塞前的锁，所以需要先解锁再销毁
                    pool->threadExit();//销毁当前线程
                }
            }
        }

        /*2. 任务队列不为空：运行到当前位置的某个工作线程作为被选中的线程执行任务*/
        //这里是析构函数执行时，将m_shutDown设为true后唤醒线程，所有线程池的线程都会执行到这里实现自杀销毁
        if(pool->m_shutDown){
            pthread_mutex_unlock(&pool->m_mutex);
            pool->threadExit();//销毁当前线程
            //当线程调用 pthread_cond_wait 函数时，它会将自身置于条件变量的等待队列中，并释放之前持有的互斥锁。
            //当满足某个条件时，其他线程可以通过 pthread_cond_signal 或 pthread_cond_broadcast 函数唤醒等待的线程。
            // 一旦线程被唤醒，它会重新获得之前释放的互斥锁，并继续执行后续的操
        }

        //线程还活着，取&分配任务
        Task task = pool->m_taskQ->takeTask();
        //忙线程加一
        pool->m_busyThreads++;
        //线程池解锁
        pthread_mutex_unlock(&pool->m_mutex);

        //执行Task：每个Task都是独立的，所以对task的操作不需要加锁
        std::cout << "thread " << pthread_self() << " is working" << std::endl;
        task.function(task.arg);//回调函数执行任务
        //任务执行完毕
        delete task.arg;//释放任务参数内存
        task.arg = nullptr;//指针置空

        //任务处理结束，更新线程池参数：线程池里的共享数据需要加锁
        pthread_mutex_lock(&pool->m_mutex);
        std::cout << "thread " << pthread_self() << " is idle" << std::endl;//需要放在锁中，否则会出现多个线程同时打印，导致乱序输出
        pool->m_busyThreads--;
        pthread_mutex_unlock(&pool->m_mutex);

    }

    return nullptr;
}
```

#### 3.5 线程池的管理者线程

管理者线程的工作机制是：**根据线程池中的忙线程数和存活线程数，动态地管理线程池中的线程数量**，manger只要在保证线程数不小于最小值，也不大于最大值的范围内，动态地控制线程数量就行

一个pool中**只需要有唯一的一个管理者线程**，管理者线程的回调函数设为`manger`，并在`manger`中实现管理者线程的工作机制：

- `manger`接受的参数同样是当前线程池对象，因为`manger`本身是静态函数，所以需要将线程池对象传入
- 管理者线程根据一定的间隔时间`t`（代码中设为3s）来轮询线程池的线程情况（每3s判断一次是否进行**新增/销毁线程**）
- **扩增线程**：当任务数过多，线程池中的**alive线程**较小**不够用**时，创建线程
    - 创建线程的条件：任务数task > 存活线程数(表示线程池不够用，需要扩大线程池），且存活线程数 < 最大线程数(表示线程池还能扩大)
    - 管理者线程每次创建线程数量为2（本代码中）
    - 创建线程直接从**线程池数组**中找到一个**空闲的位置**（值为0），直接调用`pthread_create`创建线程，并更新存活线程数
- **销毁线程**：当线程池中**忙的线程数过小**（线程池过于清闲了），且存活线程数大于最小线程数时（说明还没到最小线程数），销毁线程
    - 销毁线程的条件：忙线程数*2 < 存活线程数(表示线程池冗余过大)，且存活线程数 > 最小线程数(表示线程池还能缩小)
    - 管理者线程每次销毁线程数量为2（本代码中），需要共享数据`m_exitThreads`来通知工作线程销毁线程
    - 销毁的方式是再管理者线程中唤醒空闲的线程，此时空闲线程的`worker`会发现`m_exitThreads`不为0，就会自杀销毁（也就是上述唤醒`worker`线程的**第2种情况**）

- ThreadPool.cpp

```C++
//管理者线程：动态管理线程数量
void *ThreadPool::manger(void *arg)
{
    ThreadPool* pool = static_cast<ThreadPool*>(arg);
    while(!pool->m_shutDown){
        //管理者线程每次管理的时间间隔
        sleep(3);

        //取出线程池中的相关共享参数，需要加锁
        pthread_mutex_lock(&pool->m_mutex);
        int taskSize = pool->m_taskQ->getTaskCount();//获取任务队列中的任务数
        int aliveNum = pool->m_aliveThreads;//获取存活线程数(包含阻塞中和工作中的)：创建线程需要
        int busyNum = pool->m_busyThreads;//获取忙线程数(工作中的线程)：销毁线程需要
        pthread_mutex_unlock(&pool->m_mutex);

        //1. 当任务数过多，线程池中的alive线程较小不够用时，创建线程
        //创建线程的条件：任务数task > 存活线程数(表示线程池不够用，需要扩大线程池），且存活线程数 < 最大线程数(表示线程池还能扩大)
        if(taskSize > aliveNum && aliveNum < pool->m_maxThreads){
            // 由于销毁创建线程需要对pool里的线程数组进行操作，所以需要加锁
            pthread_mutex_lock(&pool->m_mutex);
            int count = 0;//记录本次已扩充的线程数
            for(int i = 0; i < pool->m_maxThreads && count < MangerCtlThreadNum; i++){//最多每次只允许扩充MangerCtlThreadNum个线程
                //开始创建线程
                if(pool->m_threadIds[i] == 0){//说明当前数组中的线程还没有被创建（没有存活）
                    pthread_create(&pool->m_threadIds[i], NULL, worker, pool);//在i处创建线程
                    std::cout << "manger creates thread ID: " << pool->m_threadIds[i] << std::endl;
                    count++;//创建成功，计数器加一
                    pool->m_aliveThreads++;//存活线程数加一
                }
            }
            pthread_mutex_unlock(&pool->m_mutex);
        }

        //2. 当线程池中忙的线程数过小（线程池冗余过大了），且存活线程数大于最小线程数时（说明还没到最小线程数），销毁线程
        //销毁线程的条件：忙线程数*2 < 存活线程数(表示线程池冗余过大)，且存活线程数 > 最小线程数(表示线程池还能缩小)
        if(busyNum*2 < aliveNum && aliveNum > pool->m_minThreads){
            // 由于销毁创建线程需要对pool里的线程数组进行操作，所以需要加锁
            pthread_mutex_lock(&pool->m_mutex);
            pool->m_exitThreads = MangerCtlThreadNum;//告知pool对象要销毁多少个线程
            pthread_mutex_unlock(&pool->m_mutex);

            //唤醒空闲被阻塞的MangerCtlThreadNum个线程，让这些线程自杀（也就是唤醒线程后让线程worker进入自杀状态）
            for (int i = 0; i < MangerCtlThreadNum; i++){
                pthread_cond_signal(&pool->m_cond);//唤醒线程
            }
        }
    }

    // pool->threadExit();//销毁管理者线程

    return nullptr;
}
```

### 4. 线程池的测试

通过创建`10`个Task的任务队列来测试线程池的工作情况（重点关注管理者的工作模式）

其中对于`10`个Task的任务，在每次执行Task任务后都会sleep `2s`，所以如果在单线程模式下最少需要`20s`才能执行完毕

因此我们将`main`中创建完线程后的sleep时间也设为`20s`，主要是为了观察采用线程池后的工作效率，同时也能保证`main`函数不会提前结束，导致线程池资源被提前销毁

根据测试结果我们是可以看到采用线程池后，很快就会执行完所有Task，然后等待一段时间（等到`main`中的20s延迟完后）整个程序才会结束，线程池的资源才会被销毁，说明**通过线程池确实会节省时间，提高效率**

- test.cpp

```C++

#include <iostream>
#include "TaskQueue.h"
#include "ThreadPool.h"

//线程池中线程的回调函数
void taskFunc(void *arg){
    int num = *(int*)arg;
    std::cout << "thread " << pthread_self() << " is working, num = " << num << std::endl;

    sleep(2);
}

//测试任务队列
void testTaskQueue(){
    TaskQueue taskQ;
    for (int i = 0; i < 10; i++){
        int *num = new int(i);
        Task task(taskFunc, num);
        taskQ.addTask(task);
    }
    for (int i = 0; i < 10; i++)
    {
        Task task = taskQ.takeTask();
        task.function(task.arg);
    }
}

//测试线程池
void testThreadPool(){
    // 创建线程池
    ThreadPool pool(3, 12);

    // 往线程池中添加100个任务，观察线程池的动态增长（管理者模式的工作）
    for(int i = 0; i < 10; i++){
        pool.addTask(Task(taskFunc, new int(i)));
    }

    sleep(20);//睡眠40秒,防止主线程结束后线程池执行销毁，尚未完成任务（等待线程池处理完Task）
}

int main(){
    
    // testTaskQueue();//测试任务队列
    testThreadPool();//测试线程池
    return 0;
}
```

编译运行：

<img src="make_threadPool.png">

测试结果：

<img src="run_threadPool.png">

### 5. 本文线程池代码仓库

- [C++线程池ThreadPool](https://github.com/AkiraZheng/MyWebServer/tree/Demos_of_Webserver)

## 四、阻塞队列的实现

以**异步日志**的实现为例，阻塞队列中，各个线程**生产者**负责往阻塞队列中`push`日志消息，**消费者**线程负责从阻塞队列中`pop`日志消息并写入日志文件

**异步日志**中的**消费者**为**日志线程**，因此**日志线程**的`worker`函数中需要不断地从阻塞队列中取出日志消息并写入日志文件。也就是`worker`函数作为**消费者**`pop`队列中的数据时，遇到队列为空时需要通过**条件变量阻塞等待**，直到**生产者**线程往队列中`push`数据后唤醒**日志线程**，继续`pop`队列中的数据写进日志文件缓冲区中。

具体以**异步日志**为例的**阻塞队列**的实现细节参考本人的另一篇关于WebServer的博客：[]()

## 五、线程池work stealing优化

## **未完待续...**

## 六、Reference

- [C/C++手撕线程池（线程池的封装和实现）](https://blog.csdn.net/ACMer_L/article/details/107578636)
- [基于C++11实现线程池](https://zhuanlan.zhihu.com/p/367309864)
- [当我谈线程池时我谈些什么——线程池学习笔记](https://zhuanlan.zhihu.com/p/444375447)
