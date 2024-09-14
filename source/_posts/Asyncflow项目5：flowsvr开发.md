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

## 2. 项目资源

### 2.1. mysql数据库资源

- 数据库连接池：选择gorm库

### 2.3 高性能Web框架：gin

#### 2.3.1. gin框架的初始化

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

#### 2.3.2. gin框架的请求接收

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
  
### 2.3 redis缓存资源


> 参考
> 1. [gorm库](https://gorm.io/zh_CN/docs/index.html)
> 3. [gin框架](https://gin-gonic.com/zh-cn/docs/)

## 3. 路由对应的任务调度方法：task

### 3.1. 创建任务`create_task`



### 3.2. 注册任务`register_task`

- 创建对应的**任务信息表**t_taskType_1
- 在**位置信息表**插入一条(beginPos, endPos)为(1, 1)的记录



## GO学习笔记

### 1. Goland全局搜索

- `Ctrl+Shift+F`：全局搜索

### 2. 依赖包含关系

- 在调用其他包的方法时，要保证该方法是公开的，即**首字母大写**
- go的`init`函数是在包被导入时自动执行的函数，可以用来初始化包