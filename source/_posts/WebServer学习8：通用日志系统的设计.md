---
title: WebServer学习8：通用日志系统的设计
date: 2024-03-27 15:36:39
tags:
categories:
- WebServer项目（C++）
---

## 一、两种日志系统类型

### 1.1 同步日志系统

同步日志系统是指日志写入和日志输出是同步的，即写入日志后，立即输出到日志文件中。（本项目中配置文件默认为同步日志）

由于同步日志中日志写入函数跟工作函数是串行的，所以涉及到文件IO操作，如果单条日志内容较大时，会导致工作函数阻塞，影响工作效率。

### 1.2 异步日志系统

异步日志系统是指日志写入和日志输出是异步的，即写入日志后，不立即输出到日志文件中，而是先写入到一个**队列**中，然后由另一个线程（日志线程）负责将缓冲区中的日志内容输出到日志文件中。也就是说工作线程和日志线程是并行的，工作线程作为**生产者**只负责将日志信息传到**队列**中就结束了，剩下的操作交由日志线程作为**消费者**全权处理。

由于异步日志中单独开辟了一个线程来处理日志输出，所以这里需要有一些关于线程的基础知识，比如线程的创建、线程的同步（互斥锁&条件变量）、线程的销毁等。具体这部分基础知识可以先学习本人的另一篇博客：[从0开始实现线程池(C++)](https://akirazheng.github.io/2024/02/07/%E7%BA%BF%E7%A8%8B%E6%B1%A0%EF%BC%88C++%EF%BC%89/)。

在上面推荐的博客中，我们了解到生产者-消费者模型，异步日志系统就是一个典型的生产者-消费者模型。

- **生产者**：主线程 && 线程池中的工作线程，将日志信息写入到队列中
- **消费者**：日志线程，从队列中取出日志信息，输出到日志文件中

<img src="producter-consumer.png">

## 二、单例模式

单例模式是一种常见的设计模式，它保证单例类**只有一个实例**，并提供一个全局访问点。

实现思路：

- **私有化**它的**构造函数**，以防止外界创建单例类的对象；
- 使用**类的私有静态指针变量**指向类的唯一实例，并用一个公有的静态方法获取该实例。

实现单例模式有两种方式：

- **饿汉模式**：迫不及待地，在程序启动或单例类被加载的时候就创建单例对象；
    - 由于在程序启动时就创建单例对象，所以是线程安全的
- **懒汉模式**：懒得理你，只有在第一次调用获取单例对象的方法时才创建单例对象；
    - 由于多线程中可能会有多个线程同时**第一次**调用获取单例对象的方法，所以在首次调用中需要确保线程安全
    - 实现线程安全：**加锁**、**双重检查锁**。

关于单例模式的详细内容，可以参考本人的另一篇博客：[设计模式1：单例模式(C++)](https://akirazheng.github.io/2024/01/26/%E8%AE%BE%E8%AE%A1%E6%A8%A1%E5%BC%8F1%EF%BC%9A%E5%8D%95%E4%BE%8B%E6%A8%A1%E5%BC%8F/)。

在单例模式的博客中，我们需要重点关注C++11后，局部静态变量可以实现无锁保证线性安全，所以在实现日志系统时，我们可以使用局部静态变量来实现单例模式。

```cpp
class Log{
public:
    //日志采用单例模式-懒汉模式，需要考虑线程安全
    //C++11之后，静态局部变量的初始化是线程安全的，所以可以直接使用静态局部变量，不需要加锁
    static Log *get_instance(){
        static Log instance;//局部静态变量，只会初始化一次
        return &instance;
    }
private:
    //单例模式-私有构造函数
    Log();
    virtual ~Log();
};
```

## 三、阻塞队列

如果选择**异步日志系统**，那么就需要使用**阻塞队列**来实现生产者-消费者模型。

- 对于**生产者**来说，写日志到队列中如果队列已经满了，那么直接返回写入失败，不会阻塞（因为生产者是主线程和线程池中的工作线程，不能阻塞，队列满时写入日志就会丢失一条日志，所以队列尽可能设置大一点）
- 但是对于**消费者**来说，如果队列为空，那么消费者线程就会阻塞，直到队列中有新的数据再继续消费（也就是说队列执行`pop`操作时，如果队列为空，日志线程就会一直阻塞在`pop`操作）

所以我们实现阻塞队列的思想就是：

- **消费者**读取队列`pop`操作：如果队列为空，就一直阻塞，直到队列中有新的数据再继续消费
- **生产者**写入队列`push`操作（失败）：如果队列满了，直接返回写入失败
- **生产者**写入队列`push`操作（成功）：如果队列不为空，就唤醒消费者线程（日志线程），日志线程会结束`pop`阻塞，从队列中取出日志信息，输出到日志文件中

在实现阻塞队列时，我们需要考虑线程安全问题，所以需要使用**互斥锁**和**条件变量**来保证线程安全。

我们前面已经在**线程池**的设计中封装了**互斥锁**和**条件变量**，所以可以直接使用封装后的`locker`。

在C++中，阻塞队列可以很方便地使用`std::queue`来实现，在本项目中，我们尝试通过**循环数组**来模拟实现一个**阻塞队列**（先进先出）。

```cpp
m_back = (m_back + 1) % m_max_size; //循环数组
m_front = (m_front + 1) % m_max_size; //循环数组
```

循环数组的概念使我们在`push`时其实是向右循环移动**队尾指针**并覆盖这个位置上原有的数据；在`pop`时其实是向右循环移动**队首指针**并覆盖这个位置上原有的数据。（先进先出）

阻塞队列的实现主要包含**入队push**、**出队pop**、**清空clear**三个操作，以及**队列是否为空**和**队列是否已满**的判断。

```cpp
/*
* 利用循环数组实现队列效果（也可以直接用std::queue）：m_back = (m_back + 1) % m_max_size; 
* 为了线程安全，进行队列操作时需要加互斥锁
* 为了实现队列的阻塞功能，需要使用条件变量：
*   阻塞队列中，各个线程生产者负责往阻塞队列中`push`日志消息，消费者线程（日志线程）负责从阻塞队列中`pop`日志消息并写入日志文件
*   因此日志线程的`worker`函数中需要不断地从阻塞队列中取出日志消息并写入日志文件。
*       也就是`worker`函数作为消费者`pop`队列中的数据时，遇到队列为空时需要通过条件变量阻塞等待，
*       直到生产者线程往队列中`push`数据后唤醒日志线程，继续`pop`队列中的数据写进日志文件缓冲区中。
*/

#ifndef BLOCK_QUEUE_H
#define BLOCK_QUEUE_H

#include <iostream>
#include <stdlib.h>
#include <pthread.h>
#include <sys/time.h>
#include "../lock/locker.h"

using namespace std;

template <class T>
class block_queue{
public:
    //构造函数：初始化创建队列
    block_queue(int max_size = 1000){
        if(max_size <= 0)exit(-1);

        m_max_size = max_size;
        m_array = new T[m_max_size];
        m_size = 0;
        m_front = -1;
        m_back = -1;
    }

    //清空队列：数组数据内容是可以覆盖的，所以循环数组的清空只需要将队头和队尾指针置为-1即可
    void clear(){
        m_mutex.lock();//队列操作需要加锁
        m_size = 0;
        m_front = -1;
        m_back = -1;
        m_mutex.unlock();
    }

    //析构函数：释放队列资源
    ~block_queue(){
        m_mutex.lock();
        if(m_array != nullptr){
            delete[] m_array;
        }
        m_mutex.unlock();
    }

    //判断队列是否满
    bool full(){
        m_mutex.lock();
        if(m_size >= m_max_size){
            m_mutex.unlock();
            return true;
        }
        m_mutex.unlock();
        return false;
    }

    //判断队列是否为空
    bool empty(){
        m_mutex.lock();
        if(m_size == 0){
            m_mutex.unlock();
            return true;
        }
        m_mutex.unlock();
        return false;
    }

    //返回队首
    bool front(T &value){
        m_mutex.lock();
        if(m_size == 0){
            m_mutex.unlock();
            return false;
        }
        value = m_array[m_front];
        m_mutex.unlock();
        return true;
    }

    //返回队尾
    bool back(T &value){
        m_mutex.lock();
        if(m_size == 0){
            m_mutex.unlock();
            return false;
        }
        value = m_array[m_back];
        m_mutex.unlock();
        return true;
    }

    //返回队列当前大小
    int size(){
        int tmpSize = 0;

        m_mutex.lock();
        tmpSize = m_size;
        m_mutex.unlock();

        return tmpSize;
    }

    //返回队列最大容量
    int max_size(){
        int tmpMaxSize = 0;

        m_mutex.lock();
        tmpMaxSize = m_max_size;
        m_mutex.unlock();
        
        return tmpMaxSize;
    }

    //往队列中添加元素：生产者
    //需要唤醒阻塞的消费者线程（日志线程）
    bool push(const T &item){
        m_mutex.lock();

        //1. 队列满时，写入日志失败，返回false
        if(m_size >= m_max_size){
            m_cond.broadcast();//唤醒日志线程，使其尽快将队列中的日志写入缓冲区，腾出队列空间
            m_mutex.unlock();
            return false;
        }

        //2. 队列不满时，将日志写入队列，写入成功，返回true
        m_back = (m_back + 1) % m_max_size;//循环数组实现队列
        m_array[m_back] = item;

        m_size++;

        m_cond.broadcast();//唤醒日志线程，通知其队列中有日志需要写入缓冲区
        m_mutex.unlock();

        return true;
    }

    //从队列中取出元素：消费者
    //为了实现阻塞日志队列，消费者线程在队列为空时需要阻塞等待
    bool pop(T &item){
        m_mutex.lock();

        //1. 队列为空时，阻塞消费线程（日志线程），等待生产者往队列中push数据从而唤醒消费者线程
        while (m_size <= 0){
            if(!m_cond.wait(m_mutex.get())){
                m_mutex.unlock();
                return false;//阻塞等待失败，返回false
            }
        }

        //2. 队列不为空或阻塞结束时，从队列中取出日志，取出成功，返回true
        m_front = (m_front + 1) % m_max_size;//循环数组实现队列
        item = m_array[m_front];
        m_size--;
        m_mutex.unlock();
        return true;
    }

    //从队列中取出元素：消费者(增加阻塞超时处理-虽然本项目中未使用)
    bool pop(T &item, int ms_timeout){
        struct timespec t = {0,0};//超时时间{秒，纳秒}
        struct timeval now = {0,0};//当前时间
        gettimeofday(&now, NULL);//获取当前时间

        m_mutex.lock();
        //1. 队列为空时，阻塞消费线程（日志线程）一定时间
        if(m_size <= 0){
            //绝对超时时间：当前时间+超时时间
            t.tv_sec = now.tv_sec + ms_timeout / 1000;
            t.tv_nsec = (ms_timeout % 1000) * 1000;

            //等待条件变量：阻塞等待一定时间
            if(!(m_cond.timewait(m_mutex.get(), t))){
                m_mutex.unlock();
                return false;//阻塞等待失败，返回false
            }
        }

        //2. 阻塞一段时间后队列任为空，返回false
        if (m_size <= 0){
            m_mutex.unlock();
            return false;
        }

        //3. 队列不为空或阻塞结束时，从队列中取出日志，取出成功，返回true
        m_front = (m_front + 1) % m_max_size;//循环数组实现队列
        item = m_array[m_front];
        m_size--;
        m_mutex.unlock();
        return true;
    }
private:
    locker m_mutex; //互斥锁：线程安全
    cond m_cond;    //条件变量：实现阻塞队列

    T *m_array;     //循环数组实现队列
    int m_size;     //队列当前容量
    int m_max_size; //队列最大容量
    int m_front;    //队头
    int m_back;     //队尾
};

#endif
```

其中重点关注`pop`操作，当判断队列满时，在`pop()`函数中会调用`m_cond.wait(m_mutex.get())`函数使日志线程阻塞在当前的`pop`函数中，等待生产者线程往队列中成功`push`数据从而唤醒消费者线程（生产者添加数据后，通过`m_cond.broadcast()`唤醒消费者线程）。


## 四、日志读写的基础API

### 4.1 fputs函数

fputs函数是C/C++的一个标准库函数，用于将字符串写入到指定的文件流中。对于打开的文件流，fputs函数会将字符串写入到文件流的当前位置，然后将文件流的当前位置后移，以便下次写入。

<img src="fputs_fflush.png">

```cpp
int fputs(const char *str, FILE *stream);
```

- str：要写入的字符串（经过自定义格式化处理的日志信息）
- stream：文件流指针（日志文件指针）

### 4.2 fflush函数

fflush函数是C/C++的一个标准库函数，用于刷新流的缓冲区。对于输出流，fflush函数会将缓冲区的内容立即写入到文件中。

fputs函数写入文件时，会先写入到缓冲区，当缓冲区满了或者调用fflush函数时，才会将缓冲区的内容写入到文件中。所以为了避免日志信息丢失，需要在每次写入日志后调用fflush函数，强制将缓冲区的内容写入到文件中。

```cpp
int fflush(FILE *stream);
```

## 五、日志类实现（同步+异步）

### 5.1 日志类的初始化

日志类的初始化可以分为同步初始化和异步初始化，同步和异步的判断由传入的**阻塞队列大小**决定。

- **同步初始化**：阻塞队列大小**为0**
- **异步初始化**：阻塞队列大小**大于0**

日志初始化的内容为：

- 初始化日志方式（同步/异步），异步初始化需要创建**日志线程**以及**阻塞队列**
- 初始化日志文件路径、日志文件名、日志最大行数、日志缓冲区大小
- 根据解析的日志文件路径和日志文件名，**创建/打开**日志文件

```cpp
//根据同步和异步的不同初始化日志（异步需要初始化阻塞队列、初始化互斥锁、初始化阻塞队列）
//实现参数初始化、根据当前时间创建or打开日志文件
bool Log::init(const char *file_name, int close_log, int log_buf_size, int split_lines, int max_queue_size)
{
    //1. 如果max_queue_size>0，则表示选择的方式是异步写日志，需要初始化阻塞队列、初始化互斥锁、初始化阻塞队列
    if(max_queue_size >= 1){
        m_is_async = true;//异步
        m_log_queue = new block_queue<string>(max_queue_size);//初始化阻塞队列

        //异步写日志需要创建单独的日志线程，回调函数为flush_log_thread实现pop阻塞队列中的日志消息并写入日志文件
        pthread_t tid;
        pthread_create(&tid, NULL, flush_log_thread, NULL);
    }

    //2. 初始化参数，包括缓冲区大小、日志文件行数上限、关闭日志、日志文件名
    m_close_log = close_log;
    m_log_buf_size = log_buf_size;
    m_buf = new char[m_log_buf_size];
    memset(m_buf, '\0', m_log_buf_size);
    m_split_lines = split_lines;

    //3. 根据当前时间创建or打开日志文件
    //3.1 解析文件路径
    //获取当前时间
    time_t t = time(NULL);
    struct tm *sys_tm = localtime(&t);//获取当前时间
    struct tm my_tm = *sys_tm;
    //解析路径
    const char *p = strrchr(file_name, '/');//为了判断文件名是否传入了路径
    //格式化解析的  路径_时间_文件名 通过fopen打开或创建文件
    char log_full_name[256] = {0};//路径+时间+文件名(存储完整的路径名)
    if(p==NULL){
        //a. 未传入路径，直接将 时间+文件名 拼接
        //eg文件名: ServerLog
        snprintf(log_full_name, 255, "%d_%02d_%02d_%s", my_tm.tm_year+1900, my_tm.tm_mon+1, my_tm.tm_mday, file_name);
    }else
    {
        //b. 传入了路径，解析路径，将路径+时间+文件名拼接
        //eg文件名: /MyWebServer/ServerLog
        strcpy(log_name, p + 1);//p + 1取出文件名
        strncpy(dir_name, file_name, p - file_name + 1);//将dir路径与文件名包含的路径进行拼接
        snprintf(log_full_name, 255, "%s%d_%02d_%02d_%s", dir_name, my_tm.tm_year + 1900, my_tm.tm_mon + 1, my_tm.tm_mday, log_name);
    }
    m_today = my_tm.tm_mday;//记录当前日期
    //3.2 打开or创建文件
    m_fp = fopen(log_full_name, "a");
    if(m_fp == NULL){//打开失败
        return false;
    }

    return true;
}
```

### 5.2 日志的等级

日志的等级分为**INFO**、**DEBUG**、**WARN**、**ERROR**四个等级。

- **INFO**：普通信息，报告系统正常工作的信息，当前执行的流程和收发信息等
- **DEBUG**：调试信息，报告系统调试信息，用于调试程序，在开发和测试阶段使用
- **WARN**：警告信息，报告系统警告信息，表明一个可能的问题，不影响程序的正常运行，同样是调试开发时使用
- **ERROR**和**Fatal**：错误信息，报告系统错误信息，表明一个严重的问题，程序可能无法继续运行

日志等级的设置可以通过**宏定义**来实现

```cpp
#define LOG_DEBUG(format, ...) if(0 == m_close_log) {Log::get_instance()->write_log(0, format, ##__VA_ARGS__); Log::get_instance()->flush();}
#define LOG_INFO(format, ...) if(0 == m_close_log) {Log::get_instance()->write_log(1, format, ##__VA_ARGS__); Log::get_instance()->flush();}
#define LOG_WARN(format, ...) if(0 == m_close_log) {Log::get_instance()->write_log(2, format, ##__VA_ARGS__); Log::get_instance()->flush();}
#define LOG_ERROR(format, ...) if(0 == m_close_log) {Log::get_instance()->write_log(3, format, ##__VA_ARGS__); Log::get_instance()->flush();}
```

在生产者通过宏定义调用日志写入函数时，需要传入**日志等级**、**日志内容format**、**可变参数**。调用宏定义日志函数后，依此执行`write_log`函数实现写入（同步直接`fputs`写入，异步`push`进阻塞队列）和`flush`函数。

其中**日志内容format**和**可变参数**使用`vsnprintf`函数实现格式化解析输出

### 5.3 日志的写入write_log函数

日志类中通过`write_log`函数实现对生产者传入的**日志等级、日志内容**进行格式化解析和封装。

#### 5.3.1 可变参数的格式化解析`vsnprintf`函数

c++中的可变参数格式化解析可以使用`vsnprintf`函数实现

`vsnprintf`函数原型：

```cpp
int vsnprintf(char *str, size_t size, const char *format, va_list ap);
```

- str：存储格式化后的字符串（日志主体内容）
- size：存储格式化后的字符串的大小（手动分配的）
- format：格式化字符串（日志内容），类似printf函数的格式化字符串
- ap：可变参数列表

如`LOG_INFO("%s%d", "listen the port ", m_port);`中的`"%s%d"`代表`format`，`"listen the port "`和`m_port`是可变参数

#### 5.3.2 日志内容格式化输出

本项目中的日志按照**日期 时间 日志等级 日志内容**的格式输出，同时日志文件具有**行数限制**和**按天分文件**的特性。因此在写入日志前：

- 需要判断**当前日期是否改变**
    - 如果日期改变，需要关闭当前日志文件，重新根据当前日期创建新的日志文件
- 需要判断**当前日志行数是否达到上限**
    - 如果日志行数达到上限，需要关闭当前日志文件，在**当前日期的文件名基础上加上行数后缀，重新创建新的日志文件**

完成格式化内容处理后，再根据**同步/异步**的不同，进行日志内容的写入操作。从这里也可以看出，**异步日志**中，添加到**阻塞队列**中的日志内容是**格式化后的字符串**，所以在日志线程中取出后直接调用`fputs()`写入到日志文件中即可。

```cpp
//write_log由define宏定义的宏函数自动调用的
//生产者向阻塞队列中写入日志消息，解析日志消息类型，并将缓冲区强制刷新到日志文件
//传入可变参数列表
void Log::write_log(int level, const char *format, ...)
{
    //解析选择的日志级别（level）
    char s[16] = {0};//存储日志级别
    switch (level){
    case 0:
        strcpy(s, "[debug]:");
        break;
    case 1:
        strcpy(s, "[info]:");
        break;
    case 2:
        strcpy(s, "[warn]:");
        break;
    case 3:
        strcpy(s, "[erro]:");
        break;
    default:
        strcpy(s, "[info]:");
        break;
    }
    //获取当前时间，用于判断是否到第二天了，需要创建新的日志文件
    struct timeval now = {0, 0};
    gettimeofday(&now, NULL);
    time_t t = now.tv_sec;
    struct tm *sys_tm = localtime(&t);
    struct tm my_tm = *sys_tm;

    //1. 写入日志前的处理：更新日志文件名
    //1.1 判断当前行数是否达到最大行数，或者是否到了第二天
    m_mutex.lock();
    m_count++;//行数+1
    if (m_today != my_tm.tm_mday || m_count % m_split_lines == 0) //everyday log
    {
        
        char new_log[256] = {0};
        fflush(m_fp);//先强制将缓冲区的内容写入文件，避免日志丢失
        fclose(m_fp);
        char tail[16] = {0};//时间戳
       
        snprintf(tail, 16, "%d_%02d_%02d_", my_tm.tm_year + 1900, my_tm.tm_mon + 1, my_tm.tm_mday);

        //a. 到第二天了，需要创建新的日志文件
        if (m_today != my_tm.tm_mday)
        {
            snprintf(new_log, 255, "%s%s%s", dir_name, tail, log_name);
            m_today = my_tm.tm_mday;
            m_count = 0;
        }
        //b. 行数达到最大行数，需要创建新的日志文件
        else
        {
            snprintf(new_log, 255, "%s%s%s.%lld", dir_name, tail, log_name, m_count / m_split_lines);
        }

        //创建打开新的日志文件
        m_fp = fopen(new_log, "a");
    }
    m_mutex.unlock();

    //2. 解析日志消息内容
    //2.1 格式化解析可变参数列表
    va_list valst;
    va_start(valst, format);

    string log_str;
    m_mutex.lock();
    //写入的具体时间内容格式
    //eg: 2024-03-11 17:46:21.755040 [info]:
    int n = snprintf(m_buf, 48, "%d-%02d-%02d %02d:%02d:%02d.%06ld %s ",
                     my_tm.tm_year + 1900, my_tm.tm_mon + 1, my_tm.tm_mday,
                     my_tm.tm_hour, my_tm.tm_min, my_tm.tm_sec, now.tv_usec, s);
    //写入的具体内容：可变参数列表的内容
    //eg: 2024-03-11 17:46:21.755040 [info]: hello world
    int m = vsnprintf(m_buf + n, m_log_buf_size - n - 1, format, valst);
    m_buf[n + m] = '\n';
    m_buf[n + m + 1] = '\0';
    log_str = m_buf;

    m_mutex.unlock();

    //3. 将日志消息写入阻塞队列（异步）or直接写入日志文件（同步）
    if (m_is_async && !m_log_queue->full())
    {
        //异步写日志，将日志消息写入阻塞队列
        m_log_queue->push(log_str);
    }
    else
    {
        //同步写日志，直接将日志消息写入文件
        m_mutex.lock();
        fputs(log_str.c_str(), m_fp);
        m_mutex.unlock();
    }

    va_end(valst);
}
```

### 5.4 日志的刷新flush函数

日志类中通过`flush`函数实现对日志文件的刷新操作，即将缓冲区的内容强制写入到文件中。保证有新的日志到达后，先将当前缓冲区的内容写入到文件中，避免日志丢失。

### 5.5 异步日志中线程的实现

异步日志在初始化时创建了一个**日志线程**，该线程的工作函数是`flush_log_thread`，主要负责从阻塞队列中取出日志消息并写入到日志文件中。

```cpp
//异步写日志需要创建单独的日志线程，回调函数为flush_log_thread实现pop阻塞队列中的日志消息并写入日志文件
pthread_t tid;
pthread_create(&tid, NULL, flush_log_thread, NULL);
```

**关于`flush_log_thread`函数的实现**

异步日志的工作线程函数`flush_log_thread`是一个静态函数，会调用日志类的`async_write_log`函数，实现从阻塞队列中取出日志消息并写入到日志文件中。

```cpp
//异步方式中 日志线程的工作函数
static void *flush_log_thread(void *args)
{
    Log::get_instance()->async_write_log();
}
```

**关于`async_write_log`函数的实现**

异步日志的工作线程函数中，`async_write_log`会不断地从阻塞队列中取出日志消息并写入到日志文件中。根据前面实现的**阻塞队列**的特性，如果队列为空，那么日志线程会阻塞在`pop`操作中

所以日志工作线程的`while`循环执行`pop`操作时，如果队列为空，会一直阻塞在`while`语句中，直到队列中生产者添加新的日志消息，唤醒日志线程，继续`pop`操作，并进入`while`循环里面的执行语句中

此时获得的日志字符串已经是格式化过的了（阻塞队列中的消息全是格式化后再由生产者`push`进去的），所以直接调用`fputs`函数写入到日志文件中即可。

当阻塞队列中的日志消息全部写入到日志文件中后，日志线程会继续阻塞在`pop`操作中，等待生产者线程继续往队列中`push`新的日志消息。

```cpp
//异步日志写入(从阻塞队列中取出日志消息并写入日志文件)
void *async_write_log(){
    string single_log;//存储从pop中取出的单条日志
    while (m_log_queue->pop(single_log)){
        //结束消费者阻塞后，将日志写入文件缓冲区（还需要配合fflush将缓冲区内容写入文件）
        m_mutex.lock();
        fputs(single_log.c_str(), m_fp);
        m_mutex.unlock();
    }
}
```

## 六、总结

至此我们已经完成了一个通用的日志系统的设计和实现，包含了**同步日志**和**异步日志**两种方式。相当于造了个轮子，以后可以直接拿来使用。

本文关键的知识点为**线程安全**、**生产者-消费者模型**、**单例模式**、**阻塞队列**、**日志格式化解析和封装**等。

到目前为止，WebServer的功能基本实现了，通过`Makefile`文件执行`make`命令编译生成可执行文件`server`，通过`./server`命令运行服务器，即可在浏览器中访问`http://localhost:9006`查看效果。同时完整项目在[GitHub](https://github.com/AkiraZheng/MyWebServer)上。

在WebServer项目的实现中，我们最后还需要通过Web性能压测工具`WebBench`对服务器进行压力测试，以验证服务器的性能和稳定性。具体压测的内容和结果可以参考本人的另一篇博客：[WebServer项目实战9：WebBench压力测试](https://akirazheng.github.io/2024/03/27/WebServer%E5%AD%A6%E4%B9%A09%EF%BC%9AWebBench%E5%8E%8B%E5%8A%9B%E6%B5%8B%E8%AF%95/)。