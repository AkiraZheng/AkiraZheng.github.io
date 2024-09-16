---
title: Asyncflow项目5：flowsvr开发
date: 2024-09-14 15:17:25
tags:
categories:
- Asyncflow
---

# 1. 配置文件

使用`TOML`作为配置管理

----

导入配置文件

通过`DecodeFile`读取某路径下的配置文件并解析到结构体实例`Conf`中

----

定义结构体解析配置文件

对于

```go
type commonConfig struct {
    Port    int  `toml:"port"`
    OpenTLS bool `toml:"open_tls"`
}
```
-  toml:"port"：是结构体字段的标签（tag），它告诉 Go 中的TOML库应该将文件中的 `port` 字段映射到该结构体中的 `Port`变量中。


----

将`TOML`库添加到`go.mod`文件中

- 使用`go mod init`初始化生成go.mod 文件

    ```shell
    set GO111MODULE=on
    export GOPROXY=https://goproxy.cn
    go mod init [name]//在项目目录下执行，其中name为项目文件夹名
    eg: go mod init Asyncflow-dev-raw
    ```

- 使用`go get`下载`TOML`库

    ```shell
    go get github.com/BurntSushi/toml
    ```

> 参考
> 1. [Golang toml完全解析示例](https://blog.csdn.net/Gusand/article/details/106094535)
> 2. [toml-go客户端](https://github.com/BurntSushi/toml)
> 3. [3分钟教你go语言如何使用go module下载指定版本的golang库依赖管理](https://b23.tv/CqBtVlV)

# 2. 项目资源

## 2.1. mysql数据库资源

- 数据库连接池：选择gorm库

### 2.1.1.gorm框架的字段映射

`gorm`中映射字段有**显式映射**和**隐式映射**两种，**隐式映射**是通过字段名和类型自动映射，**显式映射**是通过`tag`标签映射，如：

```go
type TaskPos struct {
    Id               uint64 `gorm:"column:id"`
    TaskType         string `gorm:"column:task_type"`
    ScheduleBeginPos int    `gorm:"column:schedule_begin_pos"`
    ScheduleEndPos   int    `gorm:"column:schedule_end_pos"`
    CreateTime       *time.Time
    ModifyTime       *time.Time
}
```

> 参考
> 1. [GORM 指南:中文官方文档-数据库操作](https://gorm.io/zh_CN/docs/index.html)

## 2.3 高性能Web框架：gin

### 2.3.1. gin框架的初始化

- 创建Web服务
  
- 路由：定义路由组`/v1`
- 路由中的`POST`请求：
  - 注册任务`/register_task`
  - 创建任务`/create_task`
  - 占据任务`/hold_task`
  - 执行完更新任务`/set_task`
- 路由中的`GET`请求：
  - 查询任务`/get_task`
  - 过滤获取一批任务`/get_task_list`
  - 获取任务配置表`/get_task_schedule_cfg_list`
  - 获取某个type任务的数量`/get_task_counts_by_type`
  - Ping测试`/ping`
    ```go
    // RegisterRouter 注册路由
    func RegisterRouter(router *gin.Engine) {
        v1 := router.Group("/v1")
        {
            // 注册任务
            v1.POST("/register_task", task.RegisterTask)
            // 创建任务接口，前面是路径，后面是执行的函数，跳进去
            v1.POST("/create_task", task.CreateTask)
            // 占据任务
            v1.POST("/hold_tasks", task.HoldTasks)
            // 更新任务
            v1.POST("/set_task", task.SetTask)
            // 查询任务（请求参数是 TaskId）
            v1.GET("/get_task", task.GetTask)
            // 获取任务列表（请求参数是 taskType Limit Status）
            v1.GET("/get_task_list", task.GetTaskList)
            // 获取任务配置信息列表
            v1.GET("/get_task_schedule_cfg_list", task.GetTaskScheduleCfgList)
            // 通过taskType获取任务所有记录数量
            v1.GET("/get_task_counts_by_type", task.GetTaskCountsByType)
            v1.GET("ping", func(c *gin.Context) {
                c.JSON(200, gin.H{
                    "message": "pong",
                })
            })
        }
    }
    ```
- 启动web server：`router.Run(Port)`
  - 启动后主协程会阻塞在这里，等待接收请求

### 2.3.2. gin框架的请求接收

- `c *gin.Context`：请求上下文

- `c.ShouldBind(&task)`：将请求的json数据自动绑定到结构体`task`中
  - 其中结构体`task`需要定义`json`标签，如：
    ```go
    // TaskData 任务调度数据
    type TaskData struct {
      UserId           string    `json:"user_id"`
      TaskId           string    `json:"task_id"`
      TaskType         string    `json:"task_type"`
      TaskStage        string    `json:"task_stage"`
      Status           int       `json:"status"`
      Priority         *int      `json:"priority"`
      CrtRetryNum      int       `json:"crt_retry_num"`
      MaxRetryNum      int       `json:"max_retry_num"`
      MaxRetryInterval int       `json:"max_retry_interval"`
      ScheduleLog      string    `json:"schedule_log"`
      TaskContext      string    `json:"context"`
      OrderTime        int64     `json:"order_time"`
      CreateTime       time.Time `json:"create_time"`
      ModifyTime       time.Time `json:"modify_time"`
    }
    ```
  
## 2.3 redis缓存资源

使用`goredis`库中的**redis连接池**，用在**创建任务时**增加缓存任务信息、以及使用`redission`库实现**分布式锁**

### 2.3.1. redis缓存

redis缓存设置的过期时间以天为单位，在config.toml中设置具体的过期天数

redis缓存主要用于客户端轮询查询**任务信息表**中某个`TaskId`对应的任务信息，以及**任务配置表**中的任务配置信息

### 2.3.2. 分布式锁

使用`setnx`还是`redission`库实现分布式锁？

如果使用`setnx`，当锁过期无法续期，这样可能导致锁被释放，但是任务还没有执行完，从而导致任务重复执行

因此使用`redission`库实现分布式锁，通过**看门狗机制**实现锁的自动续期


## 2.4 pprof性能分析

项目中使用`pprof`进行性能分析，可以通过`localhost:26688/debug/pprof/`查看性能分析结果

<img src="pprof_analyse.png" width="60%">

- 在`main`函数中添加`pprof`的启动代码
  ```go
  go func() {
		http.ListenAndServe("0.0.0.0:26688", nil)
	}()
    ```
- `net/http/pprof`包中提供了`pprof`的几种路由
  - `goroutine`：查看当前程序中的goroutine数
  - `heap`：查看堆内存的分配情况
  - `threadcreate`：查看线程的创建情况
  - `block`：查看阻塞事件的记录
  - `cmdline`：查看当前程序的命令行参数
  - `profile`：查看CPU的profile信息
  - `trace`：查看当前程序的trace信息

  ```go
  // ppfof包中提供了几种路由
  func init() {
      prefix := ""
      if godebug.New("httpmuxgo121").Value() != "1" {
          prefix = "GET "
      }
      http.HandleFunc(prefix+"/debug/pprof/", Index)
      http.HandleFunc(prefix+"/debug/pprof/cmdline", Cmdline)
      http.HandleFunc(prefix+"/debug/pprof/profile", Profile)
      http.HandleFunc(prefix+"/debug/pprof/symbol", Symbol)
      http.HandleFunc(prefix+"/debug/pprof/trace", Trace)
  }
  ```

> 参考
> 1. [gorm库](https://gorm.io/zh_CN/docs/index.html)
> 2. [gin框架](https://gin-gonic.com/zh-cn/docs/)
> 3. [golang框架-web框架之gin](https://juejin.cn/post/6844903938093744142)
> 4. [一文搞懂gin框架httprouter路由实现原理](https://juejin.cn/post/7121614553649004575)
> 5. [超全的Go Http路由框架性能比较](https://colobu.com/2016/03/23/Go-HTTP-request-router-and-web-framework-benchmark/)
> 6. [Github go-redis](https://github.com/redis/go-redis)
> 7. [Go Redis 快速入门](https://redis.uptrace.dev/zh/guide/go-redis.html)

# 3. 路由对应的任务调度方法：task

接入`Handler`库，定义所有接口均需处理的两个接口方法：

- `HandleInput`：检查输入参数是否合法
- `HandleProcess`：参数合法后，HandleProcess处理业务逻辑

```go
// HandlerIntf handler接口
type HandlerIntf interface {
	HandleInput() error
	HandleProcess() error
}
```

## 3.1. 创建任务`create_task`

`CreateTaskHandler`实现`HandlerIntf`的两个接口，并作为`Run`方法的参数传入，其中`Run`方法统一执行自定义的`HandleInput`和`HandleProcess`

```go
// Package handler 用于接口逻辑处理
package handler

//Run 执行函数
func Run(handler HandlerIntf) error {
	err := handler.HandleInput()
	if err != nil {
		return err
	}
	err = handler.HandleProcess()
	return err
}

// HandlerIntf handler接口
type HandlerIntf interface {
	HandleInput() error
	HandleProcess() error
}
```

### 1）HandleInput

`c.ShouldBind(&hd.Req)`：将请求的json数据自动绑定到结构体`task`中，然后检查请求参数是否合法
- 检查`hd.Req`中的`TaskType`是否为空
- 检查`hd.Req`中的`Priority`是否为空
- 检查`hd.Req`中的`Priority`值在`[0, db.MAX_PRIORIT]`之间

### 2）HandleProcess

其中数据库操作使用`gorm`库，`db.Create`方法创建新纪录、`db.Save`方法更新某一条记录（其中根据表的主键更新）

`gorm`库的数据库操作方法通过`struct`中的各个字段**隐式映射**按顺序对应数据库表中的字段，实现了自动映射，如位置配置表的：

```go
type TaskPos struct {
	Id               uint64
	TaskType         string
	ScheduleBeginPos int
	ScheduleEndPos   int
	CreateTime       *time.Time
	ModifyTime       *time.Time
}
```

- 获取分表中**位置信息表的信息**：找到插入的位置`endPos`
- 获取**任务配置表**中的该任务的配置信息：用于填充插入的一条新任务的**基础配置信息**
- 创建**任务信息表**：插入一条新任务的信息
- 填充`p.Resp`的回包信息（含唯一的`TaskId`）
- 增加该条任务完整信息的**redis缓存**：string类型，设置过期时间24小时


## 3.2. 注册任务`register_task`

### 1）HandleInput

- 检查`hd.Req`中的`TaskType`是否为空

### 2）HandleProcess

- 创建对应的**任务信息表**：`t_taskType_1`
- 在**位置信息表**插入一条(beginPos, endPos)为(1, 1)的记录
- 在**任务配置表**插入一条任务配置信息

## 3.3. 占据任务`hold_task`

### 1）HandleInput

- 检查`hd.Req`中的`TaskType`是否为空：根据任务类型拉取一批任务

### 2）HandleProcess

- 修正batch的limit值
- 从**位置信息表**中获取当前任务类型的`beginPos`
- 获取一批**任务类型为待执行**的任务
  - 任务拉取约束为：`order_time < NOW`和`status`，并按照`order_time`升序排列
- 将拉取到的一批任务的`status`更新为`TASK_STATUS_PROCESSING`并逐个装进`hd.Resp`中
- 更新数据库
  - 更新当前一批任务的`status`为`TASK_STATUS_PROCESSING`
  - 并更新`modify_time`

## 3.4. 执行完更新任务`set_task`

### 1）HandleInput

- 检查`hd.Req`中的`TaskId`是否为空：更新一条`TaskId`对应的任务
- 检查`hd.Req`中的`Priority`的数值

### 2）HandleProcess

- 更新**任务信息表**中的`TaskId`对应的任务的`status`为`TASK_STATUS_FINISHED`
  ```go
  //只对id为p.TaskId 且 该任务状态不为成功和失败的任务进行更新，更新内容为p中的内容
  err := db.Table(tableName).Where("task_id = ?", p.TaskId).
		Where("status <> ? and status <> ?", TASK_STATUS_SUCCESS, TASK_STATUS_FAILED).Updates(p).Error
    ```
- 清除**redis缓存**中的该条任务信息

## 3.5. 查询任务`get_task`

`GET`方法需要从`Request`中获取请求参数，这里同样通过`c.ShouldBind(&hd.Req)`将请求的json数据自动绑定到结构体`task`中

### 1）HandleInput

- 检查`hd.Req`中的`TaskId`是否为空：查询一条`TaskId`对应的任务

### 2）HandleProcess

- 从**redis缓存**中查询是否含该`TaskId`的任务信息
- 若有则直接返回，否则从**任务信息表**查找**数据库**
- 若数据库中有该任务信息，则将该任务信息重新写入**redis缓存**中，方便下一次查询
- 装包：将查询到的任务信息装进`hd.Resp`的响应信息中

# 4. 任务治理模块设计

任务治理模块主要进行**分表处理**和**卡死任务处理**两个功能

任务管理通过`go routine`开启三个**协程**，协程在`for`死循环中不断执行，每个协程维护一个**定时器**定时处理一项特定任务：

## 4.1. 卡死任务处理

开启定时器：定为10s检查一次，当任务过期时，相当于用掉一次**超时重试**机会，所以重置任务状态时还需要更新**超时重试次数**

```go
t := time.NewTimer(time.Duration(config.Conf.Task.LongProcessInterval) * time.Second)
        // <-t.C：阻塞等待定时器到期
		<-t.C
```

## 4.2. 分表处理：新增表end_pos

开启定时器：定为30s检查一次是否需要分表，每次统计**任务位置表**中`endPos`表的记录数，若超过**分表阈值**，则进行分表操作

```go
t := time.NewTimer(time.Duration(config.Conf.Task.SplitInterval) * time.Second)
		<-t.C
```

## 4.3. 分表处理：更新拉取任务的表begin_pos

开启定时器：定为10s检查一次表任务是否已经全部执行完（通过比较`begin_pos`表中所有状态为`成功`和`失败`的任务数和`end_pos`表中的总任务数，如果相等则滚表到下一张表）

```go
t := time.NewTimer(time.Duration(config.Conf.Task.MoveInterval) * time.Second)
		<-t.C
```

# GO学习笔记

## 1. Goland全局搜索

- 按两次`Shift`：全局搜索
- `Ctrl+Shift+F`：全局搜索

## 2. 依赖包含关系

- 在调用其他包的方法时，要保证该方法是公开的，即**首字母大写**
- go的`init`函数是在包被导入时自动执行的函数，可以用来初始化包