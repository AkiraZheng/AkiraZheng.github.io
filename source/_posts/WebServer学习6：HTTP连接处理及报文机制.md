---
title: WebServer学习6：HTTP连接处理及报文机制
date: 2024-03-11 20:11:10
tags:
categories:
- WebServer项目（C++）
---

## 一、从HTTP用户类在主线程epoll监听中的初始化说起

### 1.1 `WebServer.cpp`文件中的HTTP用户初始化

回到`WebServer.cpp`类中的`eventLoop`函数，我们可以看到在`epoll`监听的主线程中，当处理**新的客户端连接事件**时，会在处理新连接的`dealclientdata`函数中，通过`timer`函数同时**初始化一个http user**和一个定时器。

### 1.2 `http_conn.cpp`文件中的HTTP用户初始化函数的实现

在`http_conn.cpp`文件中对新用户连接的初始化
    - 包括类中一些如数据库信息、数据读取模式等变量、以及一些HTTP处理中间变量的初始化
    - 同时还包括对主函数中的`epoll`监听该客户端`socketfd的初始化`

#### 对http_conn类中的变量初始化

这里的初始化包括传参的`init`函数和无参重载的`init`函数，其中传参的`init`函数主要是对客户端连接信息的初始化，而无参重载的`init`函数主要是对类中功能实现的一些中间变量的初始化。

```cpp
//初始化客户端连接中http_conn的一些用户状态参数，这个函数是在主线程（epoll）中收到用户的连接处理accept时调用的
void http_conn::init(int sockfd, const sockaddr_in &addr, char *root, int TRIGMode,
                     int close_log, string user, string passwd, string sqlname)
{
    m_sockfd = sockfd;
    m_address = addr;

    addfd(m_epollfd, sockfd, true, m_TRIGMode);//将sockfd注册到epoll中
    m_user_count++;//客户端连接数+1

    //当浏览器出现连接重置时，可能是网站根目录出错或http响应格式出错或者访问的文件中内容完全为空
    doc_root = root;
    m_TRIGMode = TRTGMide;
    m_close_log = close_log;

    //更新数据库的用户名、密码、数据库名
    strcpy(sql_user, user.c_str());
    strcpy(sql_passwd, passwd.c_str());
    strcpy(sql_name, sqlname.c_str());

    //初始化http_conn类中剩下的一些参数为默认值
    init();
}
```

```cpp
//初始化http_conn类中剩下的一些参数为默认值
void http_conn::init()
{
    mysql = NULL;
    bytes_to_send = 0;
    bytes_have_send = 0;
    m_check_state = CHECK_STATE_REQUESTLINE;//根据报文的结构，主状态机初始状态应该是解析请求行，也就是CHECK_STATE_REQUESTLINE
    m_linger = false;
    m_method = GET;
    m_url = 0;
    m_version = 0;
    m_content_length = 0;
    m_host = 0;
    m_start_line = 0;
    m_checked_idx = 0;
    m_read_idx = 0;
    m_write_idx = 0;
    cgi = 0;
    m_state = 0;
    timer_flag = 0;
    improv = 0;

    //初始化清空缓冲区
    memset(m_read_buf, '\0', READ_BUFFER_SIZE);
    memset(m_write_buf, '\0', WRITE_BUFFER_SIZE);
    memset(m_real_file, '\0', FILENAME_LEN);
}
```

#### 对主函数中的`epoll`监听该客户端`socketfd的初始化`

我们看到传参的`init`函数还执行了`addfd`函数，这个函数就是处理主线程中`epoll`监听的`socketfd`的初始化

这里涉及的几个epoll相关函数其实跟之前在`timer`类中的几个相关函数是**一样的代码**，只是为了区分epoll中对serverfd的初始化监听和对clientfd的初始化监听，所以这里将这几个函数又单独封装在了`http_conn`类中。

```cpp
//注册事件到epool中进行监听，这里其实跟util.cpp中的addfd实现是一样的
void addfd(int epollfd, int fd, bool one_shot, int TRIGMode){
    //注册fd及其相关的events事件到epoll中

    //创建事件:注册fd文件描述符
    epoll_event event;
    event.data.fd = fd;

    //给fd注册对应的epoll监听事件
    if(TRIGMode == 1)
        //注册ET模式
        event.events = EPOLLIN | EPOLLET | EPOLLRDHUP;
    else
        //注册LT模式
        event.events = EPOLLIN | EPOLLRDHUP;

    //注册EPOLLONESHOT事件:设置fd是否只加内特一次
    if(one_shot)
        event.events |= EPOLLONESHOT;

    //注册fd到epoll中:epoll_ctl函数增fd
    epoll_ctl(epollfd, EPOLL_CTL_ADD, fd, &event);

    //设置fd为非阻塞(ET模式下必须设置非阻塞,包括listenfd和connfd)
    setnonblocking(fd);
}
```
```cpp
//设置客户端socketfd为非阻塞，这里也跟util.cpp中的setnonblocking实现是一样的
int setnonblocking(int fd){
    //使用 fcntl 函数来设置文件描述符的属性
    int old_option = fcntl(fd, F_GETFL);
    int new_option = old_option | O_NONBLOCK;
    fcntl(fd, F_SETFL, new_option);
    return old_option;
}
```

## 二、通过Reactor和Proactor两种事件处理模式理解HTTP的读事件处理

### 1. read_once()函数处理socketfd的读事件

根据上一节的学习，我们已经知道，Reactor模式会在**工作线程**`worker`中取出任务并执行`read_once()`

而Proactor模式会在**主线程**`epoll`监听到客户端socketfd读事件后，直接在主线程执行`read_once()`

那么这个`read_once()`函数到底为何方神圣？

`read_once()`函数封装在`http_conn`类中，实现了epoll两种触发模式的读事件。

**LT模式**

LT模式下不需要一次性读取完，会分多次读取，所以每次读的时候用`if`执行就行，不需要循环执行recv函数

**ET模式**

ET模式下需要一次性读取完，所以需要`while`执行recv函数，直到读完为止

最终读取的数据都会存放在当前用户实例化http_conn类的`m_read_buf`中，然后用`m_read_idx`变量标记读取的数据的长度（m_read_idx个bytes）。

```cpp
// epoll监测到客户端sockfd有读事件时，调用read_once循环读取数据到buffer中，直到无数据可读或者对方关闭连接
// 在reactor模式下，该函数是在工作线程中调用的，在proactor模式下，该函数是在主线程中调用的
// 非阻塞ET工作模式下，需要一次性将数据读完
bool http_conn::read_once()
{
    if (m_read_idx >= READ_BUFFER_SIZE)
    {
        return false;
    }
    int bytes_read = 0;

    //将数据读到m_read_buf + m_read_idx位置开始的内存中（存在读缓冲区m_read_buf中）
    //LT方式读取数据：epoll_wait会多次通知读数据，直到读完，所以这里不用while循环
    if(m_TRIGMode == 0){
        bytes_read = recv(m_sockfd, m_read_buf + m_read_idx, READ_BUFFER_SIZE - m_read_idx, 0);//bytes_read代表收到的字节数,char型的buff一位也代表一个字节
        m_read_idx += bytes_read;

        if(bytes_read <= 0){//读取失败
            return false;
        }

        return true;
    }
    //ET方式读取数据：epoll_wait只通知一次读数据，所以这里要用while循环读完
    else{
        while(true){
            bytes_read = recv(m_sockfd, m_read_buf + m_read_idx, READ_BUFFER_SIZE - m_read_idx, 0);
            if(bytes_read == -1){//接收失败
                if(errno == EAGAIN || errno == EWOULDBLOCK)
                    break;
                return false;//接收结束
            }else if(bytes_read == 0){//对方关闭连接
                return false;
            }
            m_read_idx += bytes_read;
        }
        return true;//ET读完所有数据返回
    }
}
```

### 2. process()函数进行报文解析和处理

`process()`函数同样封装在`http_conn`类中

无论是Reactor模式还是Proactor模式，`process()`函数都是在工作线程中执行的，它的作用是对`read_once()`函数读取到的报文进行解析和处理。

Reactor模式下是**工作线程**中取出任务并执行socket读操作（`read_once()`）后再执行`process()`函数进行报文解析和处理。

而Proactor模式下**工作线程**直接执行`process()`函数进行报文解析和处理。（因为主线程已经完成了`read_once()`的操作）

- `process()`函数主要先处理客户端的**请求报文**，如果请求报文还没有读完，那么就继续将clientfd注册为**可读事件**，等待下一次读取。
- 成功解析处理完请求报文后，根据请求报文打包**响应报文**，然后将clientfd注册为**可写事件**，等待下一次写入。

所以`process()`函数除了涉及报文的处理外，还需要涉及到**epoll**的**重置事件监听模式**和**删除描述符**操作。

- `process()`函数

```cpp
//进行报文解析处理
void http_conn::process()
{
    //解析请求报文
    HTTP_CODE read_ret = process_read();//http客户端刚进来肯定是先读取解析请求报文
    if (read_ret == NO_REQUEST)
    {
        modfd(m_epollfd, m_sockfd, EPOLLIN, m_TRIGMode);//NO_REQUEST是数据没读完，还需要继续读取，重新注册读事件（EPOLLIN）
        return;
    }

    //生成响应报文
    bool write_ret = process_write(read_ret);
    if (!write_ret)
    {
        close_conn();//报文生成失败，关闭连接
    }
    modfd(m_epollfd, m_sockfd, EPOLLOUT, m_TRIGMode);//报文生成成功，注册写事件（EPOLLOUT），发送响应报文
}
```

- `epoll`重置事件监听模式和删除描述符与关闭客户端连接操作

```cpp
//将事件重置为EPOLLONESHOT（ONESHOT模式只监听一次事件就会从epoll中删除）
void modfd(int epollfd, int fd, int ev, int TRIGMode)
{
    epoll_event event;
    event.data.fd = fd;

    if (1 == TRIGMode)
        event.events = ev | EPOLLET | EPOLLONESHOT | EPOLLRDHUP;//ET模式下，EPOLLONESHOT是必须的
    else
        event.events = ev | EPOLLONESHOT | EPOLLRDHUP;

    epoll_ctl(epollfd, EPOLL_CTL_MOD, fd, &event);
}

//从epoll中删除fd（一般是close_conn中把对应的socketfd从epoll中删除）
void removefd(int epollfd, int fd){
    epoll_ctl(epollfd, EPOLL_CTL_DEL, fd, 0);//关闭socket前先从epoll中移除
    close(fd);
}


int http_conn::m_user_count = 0;
int http_conn::m_epollfd = -1;

//关闭连接
void http_conn::close_conn(bool real_close){
    if(real_close && (m_sockfd != -1)){
        printf("close %d\n", m_sockfd);
        removefd(m_epollfd, m_sockfd);
        m_sockfd = -1;
        m_user_count--;//关闭一个连接，将客户总量减一
    }
}
```

## 三、HTTP报文的主从状态机解析模式

### 3.1 主从状态机模式

**从状态机**主要是将`read_once`读取到的数据通过识别到的`\r\n`结束符进行分割，取出一行数据交给**主状态机**进行处理。

状态机的实现过程如下图所示：

<img src="State_machine.png">

<img src="State_machine2.png">

- **从状态机**有三种状态表示读取一行的状态
    - `LINE_OK`：读取到一个完整的行
    - `LINE_BAD`：行读取出错（缺少`\r`或`\n`）
    - `LINE_OPEN`：行数据尚且不完整，如LT模式下还需要继续不断读取
- **主状态机**有三种状态表示解析报文的状态
    - `CHECK_STATE_REQUESTLINE`：解析请求行（`init`初始化一个客户user时就会默认初始化为这个状态）
    - `CHECK_STATE_HEADER`：解析头部字段
    - `CHECK_STATE_CONTENT`：解析请求内容（POST有消息体，GET无）

### 3.2 HTTP报文格式

HTTP报文格式中的**请求行、请求头、请求数据（消息主体）**分别对应了**主状态机**中的**三种解析状态**。

<img src="HTTP_Frame.png">

### 3.3 从状态机的实现逻辑

从状态机的实现逻辑主要是通过`http_conn`类中的`parse_line`函数实现的，这个函数的作用是通过识别到的`\r\n`作为一行数据的结束符进行分割，取出一行数据交给**主状态机**进行处理。

多一个`LINE_OPEN`状态是因为在LT模式下，需要不断读取数据，直到读取到一个完整的行。（也就是当前处理的buffer有可能不是完整的，需要持续解析）

具体实现逻辑细节可以看代码注释

```cpp
//从状态机，用于一行一行解析出客户端发送请求的报文，并将解读行的状态作为返回值
//主状态机负责对该行数据进行解析，主状态机内部调用从状态机，从状态机驱动主状态机。
//注意，由于报文中的content没有固定的行结束标志，所以content的解析不在从状态机中进行，而是在主状态机中进行
//状态1：LINE_OK表示读完了完整的一行（读到了行结束符\r\n）
//状态2：LINE_BAD表示读取的行格式有误（结束符只读到了\r或\n，而不是\r + \n）
//状态3：LINE_OPEN表示LT模式下还没接收完完整的buffer，还需等待继续recv到buffer后再次触发解析数据包
http_conn::LINE_STATUS http_conn::parse_line()
{
    char temp;
    //循环当前buffer中已读取到的数据
    //如果是ET模式，则客户端发送的数据包是已经全部读完了的，buffer是完整的
    //如果是LT模式，则客户端发送的数据包是分批次读取的，buffer是不完整的，所以需要LINE_OPEN状态来等待下一次读取
    for(;m_checked_idx < m_read_idx; ++m_checked_idx){

        /*m_checked_idx:    当前已确认（取出）的字符位置
          temp:             当前读取到的m_checked_idx处的字符
          m_read_idx:       读缓冲区中的数据长度（已经接收的socket的数据总长度）
        */
        temp = m_read_buf[m_checked_idx];

        //1. 读到一个完整行的倒数第二个字符\r
        if(temp == '\r'){
            //如果已经把buffer中已经接收的数据读完了，但是此时buffer中的数据还不完整，那么就返回LINE_OPEN状态，等待下一次读取
            if((m_checked_idx + 1) == m_read_idx){//m_read_idx是个数，所以这里index得+1
                return LINE_OPEN;
            }

            //如果读到了完整的行，也几乎是判断出了下一个字符为'\n'就返回LINE_OK
            //LINE_OK状态在主状态机中是可以进行行解析的状态
            else if(m_read_buf[m_checked_idx + 1] == '\n'){
                m_read_buf[m_checked_idx++] = '\0';//'\r'换成'\0'
                m_read_buf[m_checked_idx++] = '\0';//'\n'换成'\0'，m_checked_idx更新为下一行的起始位置
                return LINE_OK;
            }

            //如果读到的行格式有误，即buffer明明还没结束，但是读不到'\n'了，则返回LINE_BAD状态
            return LINE_BAD;
        }

        //2. 读到一个完整行的最后一个字符\n
        //情况1：正常来说对于完整的数据而言，'\n'应该已经被上面的if语句处理了，但是还存在第一种情况是LT下数据是还没读完整的
        //      也就是对于上面的if中，已经读到了m_read_idx了，返回LINE_OPEN，等接着继续读到socket数据再触发当前函数时，就会从'\n'开始判断
        //情况2：当前数据是坏数据，没有配套的'\r'+ '\n'，所以返回LINE_BAD
        else if(temp == '\n'){
            if(m_checked_idx > 1 && m_read_buf[m_checked_idx - 1] == '\r'){
                m_read_buf[m_checked_idx - 1] = '\0';//'\r'换成'\0'
                m_read_buf[m_checked_idx++] = '\0';//'\n'换成'\0'，m_checked_idx更新为下一行的起始位置
                return LINE_OK;
            }

            //如果上一个字符不是'\r'，则说明数据包格式有误，返回LINE_BAD
            return LINE_BAD;
        }
    }
    return LINE_OPEN;//读完了buffer中的数据，但是数据包可能还没读完，需要等待下一次读取
}
```

### 3.4 主状态机的实现逻辑

主状态机的实现逻辑主要是通过`http_conn`类中的`process_read`函数实现的，这个函数的作用是对`parse_line`函数读取到的一行数据进行下一步处理，处理是根据**从状态机的读取状态**配合**主状态机的解析状态**进行的。

其中如果是单纯的GET请求，那么只需要解析请求行和请求头，而不需要解析请求内容，我们使用从状态机的`((line_status = parse_line()) == LINE_OK)`进行判断就行，每读完完整一行就主状态机进行一次解析（请求行or请求头）。

但是为了保证客户用户名和密码的安全，我们还需要对POST请求的请求内容进行解析，这时候我们就需要使用主状态机的`m_check_state == CHECK_STATE_CONTENT`进行判断，这个状态是在解析请求头的时候就已经确定了的。当主状态机状态转为`CHECK_STATE_CONTENT`时，此时就不需要再进入从状态机的`parse_line`函数进行读取了，因为消息体没有固定的行结束标志(`\r\n`)，所以我们直接在主状态机中进行解析，根据`m_read_idx`读完剩下的数据就行。

同时为了主状态机处理完完整的HTTP报文后能退出`while`循环，我们在解析完content后将`line_status`重置为`LINE_OPEN`代表结束。（这里由于进入content解析状态前，`line_status`还会保持上一个状态的`LINE_OK`，所以不会影响主状态机进入content的解析）

```cpp
//主状态机，用于处理解析读取到的报文
//状态1：CHECK_STATE_REQUESTLINE（进行请求行的解析--从状态机中获取数据位置）
//状态2：CHECK_STATE_HEADER（进行请求头的解析--从状态机中获取数据位置）
//状态3：CHECK_STATE_CONTENT（进行请求内容的解析--主状态机中读取buffer剩下的所有数据）
http_conn::HTTP_CODE http_conn::process_read()
{
    LINE_STATUS line_status = LINE_OK;  //初始化当前从状态机的行处理状态
    HTTP_CODE ret = NO_REQUEST;         //初始化当前HTTP请求的处理结果
    char *text = 0;                     //存储主状态机当前正在解析的行数据（字符串）

    //主状态机解析状态通过从状态机来驱动：LINE_OK说明主状态机可以开始解析了
    //1. 如果是GET请求，那么其实只需要parse_line()函数就能保证解析完整个请求报文
    //2. 但是由于POST请求的content没有固定的行结束标志，所以content的解析不在从状态机中进行，而是在主状态机中进行
    //   当主状态机由CHECK_STATE_HEADER转移到CHECK_STATE_CONTENT时，我们将主状态机继续循环的判断改为m_check_state == CHECK_STATE_CONTENT，表示content部分不进入从状态机解析
    //   同时为了保证解析完content后能退出循环，我们在解析完content后将line_status = LINE_OPEN
    //   这里由于进入content解析状态前，line_status还会保持上一个状态的LINE_OK，所以不会影响主状态机进入content的解析
    while((m_check_state == CHECK_STATE_CONTENT && line_status == LINE_OK) || ((line_status = parse_line()) == LINE_OK)){
        text = get_line();
        m_start_line = m_checked_idx;//更新为下一行的起始位置，方便下次调用get_line获取当前行的字符串

        // LOG_INFO("%s", text);

        //主状态机根据当前状态机状态进行报文解析
        switch(m_check_state){
        //1. 解析请求行
        case CHECK_STATE_REQUESTLINE:
        {
            ret = parse_request_line(text);
            if(ret == BAD_REQUEST){
                return BAD_REQUEST;
            }
            break;
        }
        //2. 解析请求头
        case CHECK_STATE_HEADER:
        {
            ret = parse_headers(text);
            if(ret == BAD_REQUEST){
                return BAD_REQUEST;
            }
            //------------------------------
            else if(ret == GET_REQUEST){
                return do_request();
            }
            break;
        }
        //3. 解析请求内容
        case CHECK_STATE_CONTENT:
        {
            ret = parse_content(text);
            //------------------------------
            if(ret == GET_REQUEST){
                return do_request();
            }
            line_status = LINE_OPEN;//从状态机状态转为允许继续读取数据
            break;
        }
        default:
            return INTERNAL_ERROR;
        }
    }

    return NO_REQUEST;//表示socket还需要继续读取数据
}
```

## 四、主状态机三部分的解析逻辑

### 4.1 解析请求行

解析请求行的逻辑主要是通过`http_conn`类中的`parse_request_line`函数实现的，这个函数的作用是对请求行进行解析，解析出请求方法、请求URL、HTTP版本号。其中请求行的格式举例如下所示：

<img src="request_line.jpg">

由于请求头只有一行，所以我们只需要解析一次结束后，就将主状态机的状态从`CHECK_STATE_REQUESTLINE`转为`CHECK_STATE_HEADER`。

其中获取的`URL`在本项目中共有8种情况，分别是：
- `/`：主页，即`judge.html`，**（GET）**
- `/0`：注册页面，即`register.html`，**（POST）**
- `/1`：登录页面，即`log.html`，**（POST）**
- `/2CGISQL.cgi`：登录检验，**（POST）**
    - 成功：跳转到`welcome.html`
    - 失败：跳转到`logError.html`(action跟`log.html`相同，都为`2CGISQL.cgi`)
- `/3CGISQL.cgi`：注册检验，**（POST）**
    - 成功：跳转到`log.html`
    - 失败：跳转到`registerError.html`(action跟`register.html`相同，都为`3CGISQL.cgi`)
- `/5`：跳转到`picture.html`图片请求页面，**（POST）**
- `/6`：跳转到`video.html`视频请求页面，**（POST）**
- `/7`：跳转到`fans.html`关注页面，**（POST）**

在请求头我们只对`/`进行处理，剩下的交给`do_request`函数统一进行处理和响应。(也就是只处理最开始的主界面)

```cpp
//处理主状态机状态1：解析请求行，获得GET/POST方法、url、http版本号
http_conn::HTTP_CODE http_conn::parse_request_line(char *text)
{
    /*请求行格式举例：GET / HTTP/1.1
      请求行的格式：| 请求方法 | \t | URL | \t | HTTP版本号 | \r | \n |
      经过parse_line()函数处理后\r\n被替换成\0\0，所以这里可以直接用字符串函数来处理
    */

    //1. 获取URL：资源在服务端中的路径
    m_url = strpbrk(text, " \t");//m_url:指向请求报文中的URL的index
    if (!m_url)
    {
        return BAD_REQUEST;
    }
    *m_url++ = '\0';

    //2. 获取method：请求方法，本项目中只支持GET和POST
    char *method = text;
    if (strcasecmp(method, "GET") == 0)
        m_method = GET;
    else if (strcasecmp(method, "POST") == 0)
    {
        m_method = POST;
        cgi = 1;
    }
    else
        return BAD_REQUEST;

    //3. 获取http版本号：http版本号只支持HTTP/1.1
    m_url += strspn(m_url, " \t");
    m_version = strpbrk(m_url, " \t");
    if (!m_version)
        return BAD_REQUEST;
    *m_version++ = '\0';
    m_version += strspn(m_version, " \t");
    if (strcasecmp(m_version, "HTTP/1.1") != 0)
        return BAD_REQUEST;
    if (strncasecmp(m_url, "http://", 7) == 0)
    {
        m_url += 7;
        m_url = strchr(m_url, '/');
    }

    if (strncasecmp(m_url, "https://", 8) == 0)
    {
        m_url += 8;
        m_url = strchr(m_url, '/');
    }

    //4. 解析URL资源
    // 当URL为/时，显示初始欢迎界面"judge.html"
    // 剩下的其它URL资源的解析在do_request()函数中进行同一实现
    if (!m_url || m_url[0] != '/')
        return BAD_REQUEST;
    if (strlen(m_url) == 1)
        strcat(m_url, "judge.html");//将url追加到字符串中

    //5. 请求行解析完毕，主状态机由CHECK_STATE_REQUESTLINE转移到CHECK_STATE_HEADER，解析请求头
    m_check_state = CHECK_STATE_HEADER;
    return NO_REQUEST;//当前只解析完了请求行，还没解析完完整HTTP报文，所以返回NO_REQUEST
}
```

下面我们再来讲一下HTTP是怎么实现将URL封装在报文中的。

我们知道，静态http页面实际上是通过`.html`文件来实现的，浏览器可以解析显示对应的html文件。我们在设计`.html`文件时，会通过html的`form`标签来实现用户表单的提交，这个表单提交的`action`属性就是**请求行**的`URL`，`method`属性就是请求行的`method`（GET/POST）。

<img src="url_action.png">

<img src="judge.png">

### 4.2 解析请求头

解析请求头的逻辑是通过`http_conn`类中的`parse_headers`函数实现的，这个函数的作用是对请求头进行解析，解析出**请求头的字段和值**。其中请求头的格式举例如下所示：

<img src="headers.jpg">

其中本项目只对`Connection`、`Content-Length`、`Host`三个字段进行处理，剩下的字段直接跳过

- `Connection`：判断是长连接还是短连接，有两个可能值`keep-alive`或`close`
    - HTTP/1.1默认是长连接，所以一般收到的都是`keep-alive`
- `Content-Length`：请求内容的长度，用于判断主状态机是否需要转移到**消息主体解析状态**
    - 如果是**GET请求**，那么**请求内容长度为0**，主状态机不需要转移到`CHECK_STATE_CONTENT`状态，直接执行`do_request`响应报文就行
    - 如果是**POST请求**，那么**请求内容长度不为0**，主状态机需要被触发转移到`CHECK_STATE_CONTENT`状态，**结束主状态机中请求头的解析状态**，转为解析请求内容获取请求内容中的数据（用户名和密码）
- `Host`：请求的主机名，用于判断请求的资源是哪个主机的
    - 本项目中只有一个主机（采用回环IP`127.0.0.1`），所以不需要判断

其中代码中要注意`m_linger`变量是用于**返回响应报文时**添加对应的`Connection`字段的值的。

```cpp
//处理主状态机状态2：解析请求头，获取Connection字段、Content-Length字段、Host字段
http_conn::HTTP_CODE http_conn::parse_headers(char *text)
{
    /*请求行格式举例：Connection:keep-alive
      请求行的格式：| 头部字段名 | : |   | \t | \r | \n |
      经过parse_line()函数处理后\r\n被替换成\0\0，所以这里可以直接用字符串函数来处理
    */

    //1. 遇到空行| \r | \n |，表示头部字段解析完毕
    if(text[0] == '\0'){
        //空行后通过头部字段中的Content-Length字段判断请求报文是否包含消息体（GET命令中Content-Length为0，POST非0）
        if(m_content_length != 0){
            m_check_state = CHECK_STATE_CONTENT;//消息体不为空，POST请求，主状态机还需要转移到CHECK_STATE_CONTENT，解析请求内容
            return NO_REQUEST;
        }
        return GET_REQUEST;//GET请求，主状态机解析完毕，返回GET_REQUEST
    }
    //2. 解析Connection字段，判断是keep-alive还是close
    //  HTTP/1.1默认是持久连接(keep-alive)
    else if (strncasecmp(text, "Connection:", 11) == 0)
    {
        text += 11;
        text += strspn(text, " \t");
        if (strcasecmp(text, "keep-alive") == 0)
        {
            m_linger = true;//用于返回响应报文时添加对应的Connection字段的值
        }
    }
    //3. 解析Content-Length字段，获取消息体的长度（主要是用于判断主状态机是否需要转为CHECK_STATE_CONTENT状态）
    else if (strncasecmp(text, "Content-length:", 15) == 0)
    {
        text += 15;
        text += strspn(text, " \t");
        m_content_length = atol(text);
    }
    //4. 解析Host字段，获取请求的主机名
    else if (strncasecmp(text, "Host:", 5) == 0)
    {
        text += 5;
        text += strspn(text, " \t");
        m_host = text;
    }
    else
    {
        //其它字段本项目不解析，直接跳过
        // LOG_INFO("oop!unknow header: %s", text);
    }
    return NO_REQUEST;
}
```

### 4.3 解析请求内容

请求内容的解析比较简单，只要根据`Content-Length`字段的值判断是否已经读完了完整的HTTP消息体，然后将消息体内容存放在`m_string`中用于后面`do_request`的账号密码处理即可。

```cpp
//处理主状态机状态3：解析请求内容，获取POST请求中的消息体
http_conn::HTTP_CODE http_conn::parse_content(char *text)
{
    //判断http请求的消息体是否被完整读入
    if (m_read_idx >= (m_content_length + m_checked_idx))
    {
        text[m_content_length] = '\0';
        //POST请求中最后为输入的用户名和密码
        m_string = text;//m_string用于存储POST请求中的消息体
        return GET_REQUEST;
    }

    //消息体还没读完，继续读
    return NO_REQUEST;
}
```

## 五、报文响应

### 5.1 `do_request`函数解析请求资源路径

由于`do_request`需要对用户名和密码进行处理，本项目为了减少对数据库的频繁访问，在`main.cpp`初始化程序时就将数据库中的所有用户名和密码都读取出来，存放在`users`map表中，若需要比对则直接跳过`users.find()`匹配查询即可

在`do_request`中需要将`WebServer`类中初始化的`root`路径和`http_conn`类中解析的`URL`路径拼接起来，形成完整的`m_real_file`资源路径，然后根据资源路径的不同进行不同的处理。

<img src="url_page_source.png">

从[4.1 解析请求行](###4.1-解析请求行)中可知，本项目请求资源路径的响应共有8种情况。

其中对于**注册**，需要先判断用户名是否已存在，之后再申请从**数据库池**中获取一个**新的数据库连接**执行**插入**操作实现注册

对于**登录**，需要**验证用户名和密码**，直接`users.find()`匹配查询即可

对于**其它资源请求**，直接根据报文的`m_url`将资源路径存入`m_real_file`中即可

简化的`do_request`代码执行流程图如下所示：

<img src="do_request.png">

```cpp
//解析完整的HTTP请求后，解析请求的URL进行处理并返回响应报文
//m_real_file:完成处理后拼接的响应资源在服务端中的完整路径
//m_string   :POST请求中在parse_content()中解析出的消息体（包含用户名和密码）
http_conn::HTTP_CODE http_conn::do_request()
{
    //1. 将m_real_file初始化为项目的根目录（WebServer类中初始化过的root）
    strcpy(m_real_file, doc_root);
    int len = strlen(doc_root);
    //printf("m_url:%s\n", m_url);
    const char *p = strrchr(m_url, '/');

    //2. 处理登录/注册请求（消息体中都会有用户名和密码）
    //处理cgi：POST请求会将cgi置为1
    if (cgi == 1 && (*(p + 1) == '2' || *(p + 1) == '3'))
    {

        //根据标志判断是登录检测还是注册检测（flag为"2"是登录，为"3"是注册）
        char flag = m_url[1];

        char *m_url_real = (char *)malloc(sizeof(char) * 200);
        strcpy(m_url_real, "/");
        strcat(m_url_real, m_url + 2);
        strncpy(m_real_file + len, m_url_real, FILENAME_LEN - len - 1);
        free(m_url_real);

        //2.1 将用户名和密码提取出来
        //存于报文的消息体中：user=akira&password=akira
        char name[100], password[100];
        //a. 通过识别连接符 & 确定用户名
        int i;
        for (i = 5; m_string[i] != '&'; ++i)
            name[i - 5] = m_string[i];
        name[i - 5] = '\0';
        //b. 确定密码
        int j = 0;
        for (i = i + 10; m_string[i] != '\0'; ++i, ++j)
            password[j] = m_string[i];
        password[j] = '\0';

        //2.2 处理注册请求
        if (*(p + 1) == '3')
        {
            //构造sql INSERT语句（插入）
            char *sql_insert = (char *)malloc(sizeof(char) * 200);
            strcpy(sql_insert, "INSERT INTO user(username, passwd) VALUES(");
            strcat(sql_insert, "'");
            strcat(sql_insert, name);
            strcat(sql_insert, "', '");
            strcat(sql_insert, password);
            strcat(sql_insert, "')");

            //首先查看数据库中是否已有重复的用户名：map中查找
            //没有重名的，进行增加数据
            if (users.find(name) == users.end())
            {
                m_lock.lock();
                int res = mysql_query(mysql, sql_insert);
                users.insert(pair<string, string>(name, password));
                m_lock.unlock();

                if (!res)
                    //注册成功，跳转到登录页面
                    strcpy(m_url, "/log.html");
                else
                    //注册失败，跳转到错误页面
                    strcpy(m_url, "/registerError.html");
            }
            else
                //注册失败，跳转到错误页面(用户名重复)
                strcpy(m_url, "/registerError.html");
        }

        //2.2 处理登录请求
        //若浏览器端输入的用户名和密码在map表中可以查找到，返回1，否则返回0
        else if (*(p + 1) == '2')
        {
            if (users.find(name) != users.end() && users[name] == password)
                strcpy(m_url, "/welcome.html");
            else
                strcpy(m_url, "/logError.html");
        }
    }

    //3. 处理跳转到注册界面的请求
    if (*(p + 1) == '0')
    {
        char *m_url_real = (char *)malloc(sizeof(char) * 200);
        strcpy(m_url_real, "/register.html");
        strncpy(m_real_file + len, m_url_real, strlen(m_url_real));

        free(m_url_real);
    }

    //4. 处理跳转到登录界面的请求
    else if (*(p + 1) == '1')
    {
        char *m_url_real = (char *)malloc(sizeof(char) * 200);
        strcpy(m_url_real, "/log.html");
        strncpy(m_real_file + len, m_url_real, strlen(m_url_real));

        free(m_url_real);
    }

    //5. 处理图片资源请求
    else if (*(p + 1) == '5')
    {
        char *m_url_real = (char *)malloc(sizeof(char) * 200);
        strcpy(m_url_real, "/picture.html");
        strncpy(m_real_file + len, m_url_real, strlen(m_url_real));

        free(m_url_real);
    }

    //6. 处理视频资源请求
    else if (*(p + 1) == '6')
    {
        char *m_url_real = (char *)malloc(sizeof(char) * 200);
        strcpy(m_url_real, "/video.html");
        strncpy(m_real_file + len, m_url_real, strlen(m_url_real));

        free(m_url_real);
    }

    //7. 处理关注界面的请求
    else if (*(p + 1) == '7')
    {
        char *m_url_real = (char *)malloc(sizeof(char) * 200);
        strcpy(m_url_real, "/fans.html");
        strncpy(m_real_file + len, m_url_real, strlen(m_url_real));

        free(m_url_real);
    }
    else
        strncpy(m_real_file + len, m_url, FILENAME_LEN - len - 1);

    //判断该路径的文件是否存在
    if (stat(m_real_file, &m_file_stat) < 0)
        return NO_RESOURCE;

    //判断文件的权限是否可读
    if (!(m_file_stat.st_mode & S_IROTH))
        return FORBIDDEN_REQUEST;

    //判断请求的资源是文件夹还是文件（文件夹返回BAD_REQUEST，不可响应）
    if (S_ISDIR(m_file_stat.st_mode))
        return BAD_REQUEST;

    //通过mmap将资源文件映射到内存中，提高文件的访问速度
    int fd = open(m_real_file, O_RDONLY);
    m_file_address = (char *)mmap(0, m_file_stat.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
    close(fd);
    return FILE_REQUEST;
}
```

其中`do_request`函数中的`mmap`函数是将资源文件映射到内存中，提高文件的访问速度，这样就不需要每次请求都去读取文件，而是直接从内存中读取，提高了文件的访问速度。关于mmap的介绍将在下面进行报文响应打包时详细说明

### 5.2 打包响应报文

#### 5.2.1 请求报文处理的8种结果

- NO_REQUEST
    - 请求不完整，需要继续读取请求报文数据
    - 跳转主线程继续监测读事件

- GET_REQUEST
    - 获得了完整的HTTP请求
    - 调用do_request完成请求资源映射

- NO_RESOURCE
    - 请求资源不存在
    - 跳转process_write完成响应报文

- BAD_REQUEST
    - HTTP请求报文有语法错误或请求资源为目录
    - 跳转process_write完成响应报文

- FORBIDDEN_REQUEST
    - 请求资源禁止访问，没有读取权限
    - 跳转process_write完成响应报文

- FILE_REQUEST
    - 请求资源可以正常访问
    - 跳转process_write完成响应报文

- INTERNAL_ERROR
    - 服务器内部错误，该结果在主状态机逻辑switch的default下，一般不会触发

使用`process_write`函数进行响应报文打包时，将会根据这8种结果封装**不同的格式化字符串到报文**中

#### 5.2.2 `http_conn`类中的`process_write`函数

工作线程中`process_write`根据`do_request`的请求解析结果（8种状态），通过**5个相关函数**逐个进行响应报文的打包，最后在工作线程中将http_conn用户对应的socketfd注册到epoll中，监听写事件，等待下一次写事件触发，完成响应报文的发送。

通过`iovec`结构体将多个非连续的内存区域组合在一起（以便在epoll写事件触发时，一次性的I/O操作将内存数据writev写入socketfd中发送给客户端）。
- `iovec`结构体中的`iov_base`指向内存区域的起始地址
- `iov_len`指明内存区域的长度

本项目中，`iovec`结构体的`m_iv`数组中存放了两个`iovec`结构体，分别指向`m_write_buf`和`m_file_address`
- 如果请求报文处理结果是`FILE_REQUEST`状态，代表请求的文件资源是可以正常访问的，所以会把响应资源`m_file_address`也添加到`m_iv`数组中作为响应报文的**响应体**
- 如果请求报文处理结果是`GET_REQUEST`状态，代表请求的文件资源是空的，生成一个空的html文件（ok_string）返回
- 如果请求报文处理结果是其它状态，只申请一个buff的iovec，将`m_write_buf`添加到`m_iv`数组中，报文**响应体**调用`add_content`函数直接添加**格式化的字符串**到`m_write_buf`中，不需要第二个`iovec`

```cpp
//报文打包状态机：根据服务器处理HTTP请求的结果和状态ret，打包相应的HTTP响应报文
bool http_conn::process_write(HTTP_CODE ret)
{
    switch (ret)
    {
    //1. 服务器内部错误：500
    //在主状态机switch-case出现的错误，一般不会触发
    case INTERNAL_ERROR:
    {
        add_status_line(500, error_500_title);
        add_headers(strlen(error_500_form));
        if (!add_content(error_500_form))
            return false;
        break;
    }
    //2. 请求报文语法有错/请求的资源不是文件，是文件夹：404
    case BAD_REQUEST:
    {
        add_status_line(404, error_404_title);
        add_headers(strlen(error_404_form));
        if (!add_content(error_404_form))
            return false;
        break;
    }
    //3. 请求资源没有访问权限：403
    case FORBIDDEN_REQUEST:
    {
        add_status_line(403, error_403_title);
        add_headers(strlen(error_403_form));
        if (!add_content(error_403_form))
            return false;
        break;
    }
    //4. 请求资源可以正常访问：200
    case FILE_REQUEST:
    {
        add_status_line(200, ok_200_title);
        if (m_file_stat.st_size != 0)
        {
            add_headers(m_file_stat.st_size);//文件字节数，用于Content-Length字段
            // iovec 结构体将多个非连续的内存区域组合在一起，进行一次性的 I/O 操作
            //FILE_REQUEST状态代表请求的文件资源是可以正常访问的，所以需要多申请一个文件资源的iovec
            m_iv[0].iov_base = m_write_buf;
            m_iv[0].iov_len = m_write_idx;
            m_iv[1].iov_base = m_file_address;
            m_iv[1].iov_len = m_file_stat.st_size;
            m_iv_count = 2;
            bytes_to_send = m_write_idx + m_file_stat.st_size;
            return true;
        }
        else
        {
            //请求的文件资源是空的，生成一个空的html文件（ok_string）返回
            const char *ok_string = "<html><body></body></html>";
            add_headers(strlen(ok_string));
            if (!add_content(ok_string))
                return false;
        }
    }
    default:
        return false;
    }

    //请求资源异常的，只申请一个buff的iovec
    m_iv[0].iov_base = m_write_buf;
    m_iv[0].iov_len = m_write_idx;
    m_iv_count = 1;
    bytes_to_send = m_write_idx;
    return true;
}
```

#### 5.2.3 实现`process_write`的各行报文打包函数

- `add_response`：更新`m_write_idx`指针和缓冲区`m_write_buf`中的内容，将字符串写入缓冲区
    - 采用**可变参函数**，向缓冲区写入格式化字符串
    - 用`va_list` `va_start` `va_end`来实现变参的列表处理
    - 用`vsprintf`将格式化的字符串写入缓冲区（`m_write_buf`）中
- `add_status_line`：添加**状态行**，即HTTP版本号、状态码、状态码描述
    - 举例：`HTTP/1.1 200 OK\r\n`
- `add_headers`：添加**消息报头和空行**
    - `Content-Length`字段：Content-Length: 78443
    - `Connection`字段：Connection: keep-alive
    - 空行：\r\n
- `add_content`：添加**响应体**
    - 将`content`中的内容添加到`m_write_buf`中

其中，**状态行**下的**状态码**有以下几种：
- 200：请求成功
- 400：请求报文语法有错
- 403：禁止访问
- 404：请求资源不存在
- 500：服务器内部错误

```cpp
const char *ok_200_title = "OK";//状态码200表示请求成功，只有这个状态码才是正常状态
const char *error_400_title = "Bad Request";
const char *error_403_title = "Forbidden";
const char *error_404_title = "Not Found";
const char *error_500_title = "Internal Error";
```

**响应体**的内容有以下几种（只针对请求处理错误的情况，请求资源可访问的情况会返回对应的文件资源而不是这种格式化字符串）：
- error_400_form：请求报文语法有错
- error_403_form：禁止访问
- error_404_form：请求资源不存在
- error_500_form：服务器内部错误

```cpp
const char *error_400_form = "Your request has bad syntax or is inherently impossible to staisfy.\n";
const char *error_403_form = "You do not have permission to get file form this server.\n";
const char *error_404_form = "The requested file was not found on this server.\n";
const char *error_500_form = "There was an unusual problem serving the request file.\n";
```

**1. add_response**

```cpp
//更新m_write_idx指针和缓冲区m_write_buf中的内容：将数据写入缓冲区
//采用可变参函数，向缓冲区写入格式化字符串
//用va_list va_start va_end来实现变参的列表处理
//用vsprintf将格式化的字符串写入缓冲区
bool http_conn::add_response(const char *format, ...)
{
    //已些入的数据m_write_idx指针越界，缓冲区m_write_buf不允许再写入了
    if (m_write_idx >= WRITE_BUFFER_SIZE)
        return false;

    //可变参数列表接收，通过vsnprintf函数格式化写入缓冲区
    va_list arg_list;
    va_start(arg_list, format);
    int len = vsnprintf(m_write_buf + m_write_idx, WRITE_BUFFER_SIZE - 1 - m_write_idx, format, arg_list);
    //格式化的字符串长度超过缓冲区剩余长度，写入失败
    if (len >= (WRITE_BUFFER_SIZE - 1 - m_write_idx))
    {
        va_end(arg_list);
        return false;
    }

    //格式化字符串写入缓冲区成功，更新m_write_idx指针
    m_write_idx += len;
    va_end(arg_list);

    // LOG_INFO("request:%s", m_write_buf);

    return true;
}
```

**2. add_status_line**

```cpp

//1. 添加状态行：HTTP/1.1 200 OK
bool http_conn::add_status_line(int status, const char *title)
{
    return add_response("%s %d %s\r\n", "HTTP/1.1", status, title);
}
```

**3. add_headers**

```cpp
//2. 添加消息报头和空行
// Content-Length字段：Content-Length: 78443
// Connection字段：Connection: keep-alive
bool http_conn::add_headers(int content_len)
{
    return add_content_length(content_len) && add_linger() &&
           add_blank_line();
}
bool http_conn::add_content_length(int content_len)
{
    return add_response("Content-Length:%d\r\n", content_len);
}
// bool http_conn::add_content_type()
// {
//     return add_response("Content-Type:%s\r\n", "text/html");
// }
bool http_conn::add_linger()
{
    return add_response("Connection:%s\r\n", (m_linger == true) ? "keep-alive" : "close");
}
bool http_conn::add_blank_line()
{
    return add_response("%s", "\r\n");
}
```

**4. add_content**
    
```cpp
//3. 添加响应体：文件资源无法访问的才需要调用这个函数，其他情况都是通过mmap映射到内存中的
bool http_conn::add_content(const char *content)
{
    return add_response("%s", content);
}
```

### 5.3 注册epoll写事件发送响应报文

服务器工作线程在`process_write`函数中完成**解析请求报文process_read**、**生成响应报文process_write**一系列操作后，在`process`函数中将http_conn用户对应的socketfd注册到epoll中，监听写事件，等待下一次写事件触发，写事件触发后，调用`http_conn`类中的`write`函数，最终将报文发送给客户端。（**Reactor模式**下`write`函数在工作线程中执行的,**Proactor模式**下`write`函数在主线程中执行的）

在发送完报文后，如果HTTP的连接属于长连接，那么就继续监听读事件，等待下一次读事件触发；如果HTTP的连接属于短连接，在webserver类或者工作线程中结束write后会调用deal_timer中timer的cb_func函数关闭客户端连接

**`write`函数：将缓冲区中的数据通过epoll事件监听发送给客户端**

该函数具体逻辑如下：

在生成响应报文时初始化`byte_to_send`，包括头部信息和文件数据大小。通过**`writev`函数循环发送响应报文数据**，根据返回值更新byte_have_send和iovec结构体的指针和长度，并判断响应报文整体是否发送成功。

- 若writev单次发送成功，更新byte_to_send和byte_have_send的大小，若响应报文整体发送成功,则取消mmap映射,并判断是否是长连接.
    - 长连接重置http类实例，注册读事件，不关闭连接，
    - 短连接直接关闭连接

- 若writev单次发送不成功，判断是否是写缓冲区满了。
    - 若不是因为缓冲区满了而失败，**取消mmap映射**
    - 若eagain则满了，更新iovec结构体的指针和长度，并注册写事件，等待下一次写事件触发（当写缓冲区从不可写变为可写，触发epollout），因此在此期间无法立即接收到同一用户的下一请求，但可以保证连接的完整性。

```cpp
//向socketfd写数据：
// Reactor模式下，工作线程调用users[sockfd].write函数向客户端发送响应报文
// Proactor模式下，主线程调用users[sockfd].write函数向客户端发送响应报文，不经过工作线程处理
bool http_conn::write()
{
    int temp = 0;

    //没有数据需要发送，将sockfd从epoll中注册写事件（EPOLLOUT）改为读事件（EPOLLIN）继续监听
    if (bytes_to_send == 0)
    {
        modfd(m_epollfd, m_sockfd, EPOLLIN, m_TRIGMode);
        init();
        return true;
    }

    //将响应报文发送给客户端
    while (1)
    {
        temp = writev(m_sockfd, m_iv, m_iv_count);//将多个缓冲区iovec的数据一次性写入（发送）I/O描述符（m_sockfd）

        //发送失败：eagain满了暂时不可用 or 其他情况（取消映射）
        if (temp < 0)
        {
            //I/O缓冲区暂时满了，将sockfd再次注册写事件（EPOLLOUT）继续等待下一次写事件继续发送
            if (errno == EAGAIN)
            {
                modfd(m_epollfd, m_sockfd, EPOLLOUT, m_TRIGMode);
                return true;
            }

            //未知原因发送失败，取消响应资源文件的映射
            unmap();
            return false;
        }

        //writev负责将缓冲区iovec数据写入I/O描述符，但是不会对已发送的数据进行删除，所以需要更新缓冲区iovec已发送的数据长度
        bytes_have_send += temp;
        bytes_to_send -= temp;

        //第一个缓冲区m_write_buf已全部发送完
        if (bytes_have_send >= m_iv[0].iov_len)
        {
            m_iv[0].iov_len = 0;
            m_iv[1].iov_base = m_file_address + (bytes_have_send - m_write_idx);
            m_iv[1].iov_len = bytes_to_send;
        }
        //第一个缓冲区m_write_buf还没发送完，更新m_iv[0]后继续发送
        else
        {
            m_iv[0].iov_base = m_write_buf + bytes_have_send;
            m_iv[0].iov_len = m_iv[0].iov_len - bytes_have_send;
        }

        //缓冲区全部发送完毕，取消响应资源文件的映射并重新将sockfd注册为读事件（EPOLLIN）
        if (bytes_to_send <= 0)
        {
            unmap();
            modfd(m_epollfd, m_sockfd, EPOLLIN, m_TRIGMode);

            //保持长连接，重新初始化http_conn类中的一些参数
            if (m_linger)
            {
                init();
                return true;
            }
            //短连接return false，在webserver类或者工作线程中结束write后会调用deal_timer中timer的cb_func函数关闭连接
            else
            {
                return false;
            }
        }
    }
    return false;
}
```

## 六、浅聊一下mmap延申的内存映射问题

经过最后epoll监听写事件，我们的完整客户端请求-响应流程就结束了。但是在响应报文生成的过程中，我们提到了`mmap`，这里我们简单聊一下`mmap`。

`mmap`是一种内存映射文件的方法，它可以将一个文件或者其它对象映射到进程的地址空间，实现文件磁盘地址和进程虚拟地址空间中的一段地址的一一对应关系。这样，进程就可以采用指针的方式读写文件，而且可以实现进程间的文件共享。说到这，我们就先得来了解一下什么是**虚拟内存**，什么是**物理内存和驻留内存**。

`mmap`的操作流程如下所示：

<img src="PageTableProcess.png" width="70%">

如图所示，使用`mmap`与普通的通过**中断+系统调用**进行I/O文件阻塞读写的区别在于，`mmap`是通过**内存映射**的方式将文件通过**映射到虚拟内存**中，然后通过**页表**将虚拟内存**映射到物理内存**中，这样可以不经过**用户态和内核态的切换**，直接通过**指针**访问文件，提高了I/O的效率。

### 6.1 虚拟内存vs物理内存和驻留内存

**虚拟内存**

虚拟内存是操作系统为了对进程地址进行管理而设计的**逻辑上的内存空间**，比如我们编写一个C++程序，采用g++**编译**的时候编译器处理各种指针、变量等采用的就是**虚拟内存**，因为此时程序还未运行，不可能直接访问物理内存。虚拟内存是**连续的**，是**逻辑上的**，是**抽象的**，是**不受物理内存大小限制**的。

所以程序运行过程中用到的指令、代码、数据都必须存在于虚拟内存中。虚拟内存的存在解放了物理内存的大小限制。

**物理内存**

物理内存是指实实在在的**RAM内存上的空间**，虚拟内存中的程序在物理机器上运行时，通过**页映射表**将虚拟内存中的地址映射到物理内存中的地址，从而真正实现程序运行。

虚拟内存向物理内存的映射是**按需映射**的，因为虚拟内存很大，可能有一部分程序在运行中根本不需要访问到，所以映射时只会讲访问到的部分映射到物理内存中。当需要访问另一部分程序时再将其映射到物理内存中（在**触发缺页中断**时利用**分页技术**将实际的物理内存分配给虚拟内存），所以一个程序运行时在虚拟内存中是**碎片化**存在的（不连续）。

**驻留内存**

驻留内存是指**已经映射到物理内存中的虚拟内存**，是实实在在**存在于物理内存**中的。


### 6.2 图解三种内存的关联

以下面的图为例，**灰色**代表运行程序中未被访问的部分（没被映射到物理内存中）；**彩色**代表运行程序中被访问的部分在虚拟内存和物理内存中的映射关系。

<img src="mmap_virtual_physical_space.png">

通过上图可以直观感受到一个程序在**虚拟内存**上是**连续**的，运行时在物理内存是**按需映射**后**碎片化**存在的。也可以得到**虚拟内空间大只能表示程序运行过程中可访问的空间比较大，不代表物理内存空间占用也大**的结果。

但是我们可以发现一个很奇怪的现象，为什么程序A中的A4和程序B中的B4**映射到了同一块物理内存中**呢？其实这就涉及**内存共享**的概念，也就是说程序A和程序B中的一部分数据或代码是共享的，这样可以节省物理内存的使用。

### 6.3 内存共享

程序共享内存主要存在于以下几种情况

- **共享库**：多个程序使用相同的库，操作系统可以把这些库加载到内存中的一块区域，这样只用维护一块内存空间

- **父子进程**：父子进程之间可以通过**共享内存**进行通信，这样可以减少进程间通信的开销，使他们共同读写一块内存区域

- **内存映射文件**：操作系统可以将文件映射到进程的虚拟内存中，本项目中使用的`mmap`就是这种方式，将文件映射到进程的虚拟内存中，这样可以减少文件拷贝到内存的开销，提高I/O读取效率
    - 进程A和进程B都映射了区域C，当A第一次读取C时通过缺页从磁盘复制文件页到内存中；但当B再读C的相同页面时，虽然也会产生缺页异常，但是不再需要从磁盘中复制文件过来，而可直接使用已经保存在内存中的文件数据。

### 6.4 从C++的角度深入理解内存映射

#### 6.4.1 C++内存分区

C++的代码存于虚拟内存中，C++内存主要分为**栈区**、**堆区**、**全局/静态区**、**常量区**和**代码区**五个区。

- **栈区**：由编译器自动分配释放，存放**函数的实参值**、**局部变量**的值等，栈上的变量⽣命周期与其所在函数的执⾏周期相同。由编译器负责自动分配和释放。（先进后出）
- **堆区**：由**程序员分配释放**，若程序员不释放，程序结束时由操作系统回收，堆上的变量⽣命周期由程序员显式控制。在C++中可以分配（使⽤ new 或 malloc ）和释放（使⽤ delete 或 free ）。（先进先出）
- **全局/静态区**：存放**全局变量、静态变量**，程序**一经编译**这些变量就会存在，程序结束后由操作系统释放。
- **常量区**：存放**常量字符串**，程序结束后由操作系统释放。
- **代码区**：存放**函数体的二进制代码**。

其中栈(stack)的内存地址是向下增长的，堆(heap)的内存地址是向上增长的

<img src="mmap_virtual_memory.png">

所以我们平时所说的代码的**运行，分配，操作**等，都是指的**虚拟内存**！！！！！！！！

程序**申请和操作**的内存都是在**虚拟内存**上的，包括**堆(heap)**、**栈(stack)**等。

#### 6.4.2 内存的延迟分配

前面提到虚拟内存中，其实就属于**延迟分配**，Linux内核在用户申请内存时（比如`malloc`和`new`），只是先给它分配在**虚拟内存**中，并不分配实际的物理内存。

只有当用户**使用这块内存**时（比如赋值、读取等），才会触发**缺页中断**，内核才会分配**具体的物理页面**给用户，此时才占用宝贵的物理内存。

内核释放物理页面是**通过虚拟内存找到对应的物理页面**，然后释放物理页面，但是虚拟内存中的映射关系不会立即释放，只有当用户再次访问这块内存时，才会触发**缺页中断**，重新分配物理页面。

```cpp
char *p=malloc(2048);//这里只是分配了虚拟内存2048，并不占用实际内存。 
strcpy(p,"123");     //分配物理页面，虽只使用了3个字节，但内存还是为它分配了2048字节的物理内存。
free(p);             //通过虚拟地址，找到其所对应的物理页面，释放物理页面，释放虚拟内存。
```

#### 6.4.3 内存空洞问题

一个场景，我们知道C++中堆是从下往上的，而堆又是先进先出的，所以当**堆顶申请的物理内存还在使用时中**，如果底下有些内存块被释放了，那么**这些释放的物理内存就不会返回到系统中**，形成了**内存空洞**。

```cpp
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
int main()
{
    //申请11个2K的内存
    char *p[11];
    int i;
    for(i=0;i<10;i++)
    {
        p[i]=(char *)malloc(1024*2);
        strcpy(p[i],"123");
    }
    p[10]=(char *)malloc(1024*2);
    strcpy(p[10],"123");

    //释放前10个2k内存
    for(i=0;i<10;i++)
    {
        free(p[i]);
    }
    pid_t pid=getpid();
    printf("pid:%d\n",pid);
    pause();
    return 0;
}
```

经过上面的代码，如果没有内存空洞，那么此时进程应该只是占用了一个物理页面，剩下堆顶一个2k

但是通过查看`memmap`命令，我们可以看到`1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0`，说明堆顶的2k内存还在使用，但是底下的10个2k内存已经被释放，但是并没有返回给系统，这就是**内存空洞**。

#### 6.4.4 mmap的内存映射

最后经过前面基础知识的铺垫，我们再来聊一下`mmap`的优点：

- **减少I/O操作**：`mmap`将文件映射到内存中，提高了文件的访问速度，不需要每次请求都去读取文件，而是直接从内存中读取

- **减少内存拷贝**：`mmap`将文件映射到内存中，减少了内存拷贝的次数，提高了文件的访问速度

- **内存共享**：`mmap`可以实现内存共享，多个进程可以映射同一个文件，实现进程间的文件共享

- **延迟分配**：`mmap`是按需映射的，只有在访问到文件时才会映射到内存中，减少了内存的占用


### 6.5 参考

[详解进程的虚拟内存，物理内存，共享内存](https://blog.csdn.net/qq_41687938/article/details/120479067)
[一文理解虚拟内存、物理内存、内存分配、内存管理](https://zhuanlan.zhihu.com/p/393403828)

## 七、总结

这篇博客应该是本项目最长的一篇了，而HTTP报文的实现也确实是这个项目的主体部分，所以花了比较长的篇幅，还是要好好理解一下

这里需要结合前面**线程池**的相关实现以及**Reactor和Proactor模式**的相关知识，才能更好地理解HTTP类实现的整个流程。还是需要好好消化一下

最后，到这里我们已经实现了HTTP服务器的基础功能了，接下来我们将会实现**日志系统**、**定时器**两个功能，最后再进行**压力测试**，最终完成整个项目的实现。

关于后续的学习，我们先从**定时器**入手，具体内容请看下一篇博客[WebServer学习7：定时器控制客户端存活时间](https://akirazheng.github.io/2024/03/26/WebServer%E5%AD%A6%E4%B9%A07%EF%BC%9A%E5%AE%9A%E6%97%B6%E5%99%A8%E6%8E%A7%E5%88%B6%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%AD%98%E6%B4%BB%E6%97%B6%E9%97%B4/)