---
title: WebServer学习5：线程池与数据库连接池设计
date: 2024-03-09 13:17:58
tags:
categories:
  - WebServer项目（C++）
---

## 一、线程池设计基础

### 1.1 线程池基础

关于通用线程池的设计轮子，可以参考本人的博客：[从0开始实现线程池(C++)](https://akirazheng.github.io/2024/02/07/%E7%BA%BF%E7%A8%8B%E6%B1%A0%EF%BC%88C++%EF%BC%89/)

相比上面造的轮子，本文进一步将Task类型设置成**模板类**，以适应不同类型的任务。同时将worker的阻塞环节中**条件变量替换为信号量**，以实现对线程池的互斥访问。

### 1.2 半同步/半反应堆线程池

并发模式中的同步和异步

- **同步**：指的是**发起一个调用**后，**调用者需要等待结果**，才能继续后续的操作；这种程序完全按照代码的顺序执行
- **异步**：指的是**发起一个调用**后，**调用者不需要等待结果**，就可以继续后续的操作；异步指的是程序的执行需要由系统事件驱动

半同步/半反应堆线程池是一种**同步I/O模拟Proactor事件处理模式**，主线程负责处理读写数据、接受新连接等I/O操作，等**处理完事件后**再直接发送读取后的结果给工作线程进行业务处理。以proactor模式为例，半同步/半反应堆线程池的工作流程如下：

- 主线程中**epoll**充当**异步线程**，负责**处理socket**上读写数据、接受新连接等I/O操作
- 若有新连接发生，主线程获取该新连接，然后往**epoll**内核事件表注册该socket上的读就绪事件
- 如果连接socket上**有数据可读**，**主线程从socket循环读取数据**，直到没有更多数据可读，然后**将读取到的数据封装**成一个**请求对象**并插入请求队列
- 睡眠的工作线程接收到请求对象后，通过竞争获取任务接管权

本项目除了采取半同步/半反应堆线程池，还对worker中处理任务允许使用**Reator模式**或**Proactor模式**，Reactor模式需要输入一个state参数，用于判断任务的类型，而Proactor模式则不需要，因此这里Reactor和Proactor模式封装的**添加任务**的函数不同，一个需要输入state参数，一个不需要。(但是任务都是模板类型，也就是`http_conn`具体类)

本项目的线程池设计和实现流程如下：

<img src="worker_of_threadpool.png">

### 1.3 主要函数代码实现

主要函数包括生产者向任务队列中添加任务`append`函数、消费者从任务队列中取出任务并执行任务`worker`工作线程回调函数。

- `append`函数：生产者向任务队列中添加任务

```cpp
//向请求队列中添加任务(Reactor模式)
template <typename T>
bool threadpool<T>::append(T *request, int state){
    //操作工作队列时一定要加锁，因为它被所有线程共享
    m_queuelocker.lock();
    
    if(m_workqueue.size() >= m_max_requests){
        //请求队列满了
        m_queuelocker.unlock();
        return false;
    }

    request->m_state = state;//state 0代表读事件，state 1代表写事件
    m_workqueue.push_back(request);

    m_queuelocker.unlock();

    //信号量+1，唤醒一个线程
    m_queuestat.post();

    return true;
}

//向请求队列中添加任务(Proactor模式)
//由于Proactor模式下，socketfd上的读写事件都是由主线程来处理的，所以这里只需要将任务添加到请求队列中即可，不需要state参数来判断是什么事件
template <typename T>
bool threadpool<T>::append_p(T *request)
{
    m_queuelocker.lock();
    if (m_workqueue.size() >= m_max_requests)
    {
        m_queuelocker.unlock();
        return false;
    }
    m_workqueue.push_back(request);
    m_queuelocker.unlock();

    m_queuestat.post();

    return true;
}
```

- `worker`函数：消费者从任务队列中取出任务并执行任务

```cpp
//工作线程运行函数:worker
template <typename T>
void *threadpool<T>::worker(void *arg){
    threadpool *pool = static_cast<threadpool *>(arg);
    pool->run();
    return pool;
}
//线程池的主线程运行函数:保证线程池中的线程一直处于等待任务的状态 && 从请求队列中取出任务并执行之
template <typename T>
void threadpool<T>::run(){
    while(true){
        //等待线程池的信号量，即是否有任务需要处理（阻塞等待）
        m_queuestat.wait();

        //再查看确认是否有任务需要处理，如果没有的话就continue继续while循环
        m_queuelocker.lock();
        if(m_workqueue.empty()){
            m_queuelocker.unlock();
            continue;
        }

        //有任务则取出任务并处理
        T *request = m_workqueue.front();
        m_workqueue.pop_front();
        m_queuelocker.unlock();

        if(!request){//任务为空任务
            continue;
        }

        //根据事件处理模型切换：Reactor/Proactor（m_actor_model）
        if(m_actor_model == 1){//Reactor模式
            if(request->m_state == 0){//读事件
                if(request->read_once()){//读取数据成功
                    request->improv = 1;//通知主线程中的dealwithread，表示该任务已交由工作线程处理
                    connectionRAII mysqlcon(&request->mysql, m_connPool);//自动获取数据库连接
                    request->process();//处理请求:解析请求报文，处理业务逻辑，生成响应报文
                }
                else {//读取数据失败
                    request->improv = 1;
                    request->timer_flag = 1;
                }
            }
            else{//写事件
                if (request->write()){//写数据成功
                    request->improv = 1;
                }
                else {//写数据失败
                    request->improv = 1;
                    request->timer_flag = 1;
                }
            }
        }
        else {//Proactor模式，直接处理请求，不需要判断事件类型
            connectionRAII mysqlcon(&request->mysql, m_connPool);//自动获取数据库连接
            request->process();//处理请求:解析请求报文，处理业务逻辑，生成响应报文

        }
    }
}
```

## 二、封装线程同步需要的信号量和各种锁

### 2.1 信号量

信号量的封装主要是对`sem_init`、`sem_wait`、`sem_post`和`sem_destroy`函数的封装，以实现对信号量的操作。同时维护一个`sem_t`信号量变量，用于实现对信号量的操作。

```cpp
/*封装信号量的类
* 信号量是一个计数器，用于多线程之间的同步
* 每次从连接池获取连接时，需要获取一个信号量许可证(sem_wait)，如果没有可用的许可证，线程将被阻塞，直到有可用的连接。
* 当线程释放连接时，将增加一个信号量许可证(sem_post)，使得其他线程可以获取连接。
*/
class sem{
public:
    sem(){

        //初始化信号量m_sem为进程内线程共享-信号量初始值为0
        if(sem_init(&m_sem, 0, 0) != 0){
            throw std::exception();//信号量初始化失败，抛出异常
        }
    }

    sem(int num){
        //初始化信号量m_sem为进程内线程共享-信号量初始值为num
        if(sem_init(&m_sem, 0, num) != 0){
            throw std::exception();//信号量初始化失败，抛出异常
        }
    }
    ~sem(){
        sem_destroy(&m_sem);//销毁信号量
    
    }
    bool wait(){
        return sem_wait(&m_sem) == 0;//等待获取信号量许可证
    }
    bool post(){
        return sem_post(&m_sem) == 0;//释放信号量许可证
    }
private:
    sem_t m_sem;//信号量
};
```

### 2.2 互斥锁

互斥锁的封装主要是对`pthread_mutex_init`、`pthread_mutex_lock`、`pthread_mutex_unlock`和`pthread_mutex_destroy`函数的封装，以实现对互斥锁的操作。同时维护一个`pthread_mutex_t`互斥锁变量，用于实现对互斥锁的操作。

```cpp
/*封装互斥锁的类*/
class locker{
public:
    locker(){
        if(pthread_mutex_init(&m_mutex, NULL)!=0){
            throw std::exception();//互斥锁初始化失败，抛出异常
        }
    }
    ~locker(){
        pthread_mutex_destroy(&m_mutex);//销毁互斥锁
    }
    bool lock(){
        return pthread_mutex_lock(&m_mutex)==0;//加锁
    }
    bool unlock(){
        return pthread_mutex_unlock(&m_mutex)==0;//解锁
    }
    pthread_mutex_t *get(){
        return &m_mutex;//获得当前类对象中的互斥锁
    }
private:
    pthread_mutex_t m_mutex;//互斥锁
};
```

### 2.3 条件变量

条件变量的封装主要是对`pthread_cond_init`、`pthread_cond_wait`、`pthread_cond_timedwait`、`pthread_cond_signal`和`pthread_cond_broadcast`函数的封装，以实现对条件变量的操作。同时维护一个`pthread_cond_t`条件变量变量，用于实现对条件变量的操作。

```cpp
/*封装条件变量的类*/
class cond{
public:
    cond(){
        if(pthread_cond_init(&m_cond, NULL)!=0){
            throw std::exception();//条件变量初始化失败，抛出异常
        }
    }
    ~cond(){
        pthread_cond_destroy(&m_cond);//销毁条件变量
    }
    bool wait(pthread_mutex_t *m_mutex){
        int ret = 0;
        ret = pthread_cond_wait(&m_cond, m_mutex);//等待条件变量:阻塞线程
        return ret == 0;
    }
    bool timewait(pthread_mutex_t *m_mutex, struct timespec t){
        int ret = 0;
        ret = pthread_cond_timedwait(&m_cond, m_mutex, &t);//等待条件变量:阻塞线程一定时间t
        return ret == 0;
    }
bool signal(){
    return pthread_cond_signal(&m_cond)==0;//唤醒一个等待条件变量的线程
}
bool broadcast(){
    return pthread_cond_broadcast(&m_cond)==0;//唤醒所有阻塞等待条件变量的线程
}
private:
    pthread_cond_t m_cond;//条件变量
};
```

## 三、数据库连接池设计

数据库连接池实际上也是线程池中维护的一个共享资源，每接收一个http请求时**除了分配线程资源外**，当获得线程资源后，线程池的worker中还**需要分配数据库连接资源**。

连接池的功能主要有：**初始化**，**获取连接**、**释放连接**，**销毁连接池**。

### 3.1 连接池中信号量的使用

为了维护数据库连接池，这里将条件变量替换为**信号量**，以实现对连接池的互斥访问。（条件变量是用于线程间的同步，而信号量可以用于进程间或线程间的同步）

在数据库连接池中，**信号量（Semaphore）通常用于控制对连接资源的并发访问**。连接池是一种重复使用数据库连接的技术，通过维护一组预先创建的连接对象，在需要访问数据库时从池中获取连接，使用完毕后将连接放回池中，以提高数据库访问的性能和效率。

在C++中，信号量可以使用`sem_init`、`sem_wait`、`sem_post`和`sem_destroy`等函数进行操作：

- `int sem_init(sem_t *sem, int pshared, unsigned int value)`：初始化信号量
    - sem：指向要初始化的信号量的指针。
    - pshared：指定信号量的**共享类型**。如果为`0`，信号量将被**进程内的线程共享**；如果为非零，信号量可以在不同进程间共享。
    - value：指定信号量的初始值。

- `int sem_wait(sem_t *sem)`：等待信号量，用于**获取一个信号量的许可证**，没有可用许可证时，线程将阻塞。
    - sem：指向要等待的信号量的指针。

- `int sem_post(sem_t *sem)`：释放信号量，用于**释放一个信号量的许可证**。
    - sem：指向要释放的信号量的指针。
    - 如果有其他线程在等待这个信号量，那么其中的一个线程将被唤醒。
    - 释放信号量的许可证后，信号量的值将增加1。

- `int sem_destroy(sem_t *sem)`：销毁信号量。
    - sem：指向要销毁的信号量的指针。

使用信号量**实现多线程争夺连接的同步机制**，这里将信号量初始化为数据库的连接总数。当线程需要获取连接时，**取出连接**它会调用`sem_wait`函数，如果有可用的连接，线程将获得一个连接并将**信号量的值减1**；如果**没有可用的连接，线程将阻塞等待**，直到有连接被释放。当线程使用完连接后，**释放连接**会调用`sem_post`函数将信**号量的值加1**。

另外，由于多线程操作连接池，会造成竞争，这里使用**互斥锁**完成同步，具体的同步机制均使用`lock.h`中封装好的类。这里互斥锁的使用在**一、**中已有说明，不再赘述。

### 3.2 数据库连接池的单例模式

数据库连接池是一个全局的资源，因此需要使用**单例模式**来保证程序中只有一个数据库连接池的实例。这里采用**懒汉模式**实现单例模式，由于项目中在程序启动（`main.cpp`）时就会初始化数据库连接池，因此不需要考虑多线程安全问题，采用最简单的懒汉模式实现单例模式。（24.4.11更正：这里其实是线程安全的，C++11后局部静态变量的初始化是线程安全的）

```cpp
class connection_pool
{
public:
    //局部静态变量单例模式
    static connection_pool *GetInstance();//数据库连接需要采用单例模式

private:
    connection_pool();
    ~connection_pool();
}

connection_pool *connection_pool::GetInstance()
{
    //懒汉模式创建，由于只在程序开始时创建一次，所以不需要加锁
    static connection_pool connPool;
    return &connPool;
}
```

### 3.3 RAII机制封装数据库的连接与释放

RAII（Resource Acquisition Is Initialization）是C++的一种资源管理方式，即**资源获取就是初始化**。RAII的核心思想是**将资源的生命周期与对象的生命周期绑定**，通过对象的生命周期来管理资源的生命周期。

在获取连接时，通过**实例化**一个`connectionRAII`对象会自动调用`mysql_real_connect`中的`GetConnection`函数从而获取一个mysql连接；

在释放连接时，通过销毁上面的`connectionRAII`实例化对象，自动调用**析构函数**执行`RealeaseConnection`函数对连接进行释放。

```cpp
/*RAII机制，用于自动释放和获取数据库连接（从连接池中获取和释放连接）
* 将数据库连接的获取与释放通过RAII机制封装，避免手动释放。
* RAII机制在HTTP连接处理中使用
*/
class connectionRAII{

public:
    //双指针接收一个指针的地址，*con指向接收的指针指向的地址
	connectionRAII(MYSQL **con, connection_pool *connPool);
	~connectionRAII();
	
private:
	MYSQL *conRAII;
	connection_pool *poolRAII;
};
```

```cpp
/*RAII机制，用于自动释放和获取数据库连接*/
connectionRAII::connectionRAII(MYSQL **SQL, connection_pool *connPool){
    *SQL = connPool->GetConnection();//获取数据库连接

    conRAII = *SQL;
    poolRAII = connPool;
}

connectionRAII::~connectionRAII(){
    poolRAII->RealeaseConnection(conRAII);//释放数据库连接
}
```

- 从本项目中举例说明**RAII机制**的使用

在`http_conn.cpp`中，我们通过一个`initmysql_result`函数在整个程序初始化时就先取出当前所有注册过的用户名和密码到一个map中存起来

我们可以看到在这个函数中我们**并没有显示地连接和释放数据库连接**，那么它是怎么实现数据库资源的获取和释放的呢？就是用的我们封装好的**RAII机制函数**。

此时函数中就是通过实例化一个`connectionRAII`对象，这个对象是函数内的局部变量，所以当这个函数结束时，这个对象就会被销毁，从而调用析构函数，自动释放本次的数据库连接（归还给数据库连接池）。

```cpp
//main中初始化WebServer类中的m_connPool时会同时在HTTP类中取出一个数据库连接用于提前将所有注册过的用户信息取出存在map中
void http_conn::initmysql_result(connection_pool *connPool)
{
    //先从连接池中取一个连接（RAII机制）
    MYSQL *mysql = NULL;
    connectionRAII mysqlcon(&mysql, connPool);

    //在user表中检索username，passwd数据，浏览器端输入
    if (mysql_query(mysql, "SELECT username,passwd FROM user"))
    {
        // LOG_ERROR("SELECT error:%s\n", mysql_error(mysql));
    }

    //从表中检索完整的结果集
    MYSQL_RES *result = mysql_store_result(mysql);

    //返回结果集中的列数
    int num_fields = mysql_num_fields(result);

    //返回所有字段结构的数组
    MYSQL_FIELD *fields = mysql_fetch_fields(result);

    //从结果集中获取下一行，将对应的用户名和密码，存入map中
    while (MYSQL_ROW row = mysql_fetch_row(result))
    {
        string temp1(row[0]);//key：用户名
        string temp2(row[1]);//value：密码
        users[temp1] = temp2;//存入map中
    }
}
```

## 四、总结

本文主要介绍了线程池的设计和数据库连接池的设计，其中线程池的设计主要是对通用线程池的进一步封装，将Task类型设置成模板类，以适应不同类型的任务。同时将worker的阻塞环节中条件变量替换为信号量，以实现对线程池的互斥访问。

数据库连接池的设计主要是对连接池中信号量的使用和数据库连接池的单例模式的设计。同时，使用RAII机制封装数据库的连接与释放，避免手动释放。

通过本文的学习，对线程池和数据库连接池的设计有了更深入的了解，同时也对C++的RAII机制有了更深入的认识。有了本文的基础，我们可以开始学习**HTTP类**。关于**HTTP类**的实现，可以参考本人的下一篇博客：[WebServer学习6：HTTP连接处理及报文机制](https://akirazheng.github.io/2024/03/11/WebServer%E5%AD%A6%E4%B9%A06%EF%BC%9AHTTP%E8%BF%9E%E6%8E%A5%E5%A4%84%E7%90%86%E5%8F%8A%E6%8A%A5%E6%96%87%E6%9C%BA%E5%88%B6/)