---
title: Asyncflow项目6：worker开发
date: 2024-09-16 16:09:18
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
// TomlConfig 配置
type TomlConfig struct {
FlowsvrAddr       string `toml:"flowsvr_addr"`        // flowsvr的地址
RedisLockAddr     string `toml:"redis_lock_addr"`     // redis分布式锁的地址
RedisLockPassword string `toml:"redis_lock_password"` // redis分布式锁的密码
}
```

# 2. 分布式锁：go-redis框架

本项目中使用`go-redis`库来实现分布式锁，通过`SetNX`命令结合**看门狗机制**手动实现一个**分布式锁**的，`SetNX`命令是一个原子性的操作，只有在key不存在时才会设置key的值。

其中使用的key为`taskType`，value为用uuid生成的`token`，过期时间为`expireTimeSecond`。

> 参考
> 
> 1. [Github go-redis](https://github.com/redis/go-redis)
> 
> 2. [Go Redis 快速入门](https://redis.uptrace.dev/zh/guide/go-redis.html)


# 3. Task处理

Task处理完的返包用的是`http.Client`，通过`http.NewRequest`实现对服务端接口的调用

```go
req, err := http.NewRequest(method, reqUrl, reader)
```


## 3.1 注册Task

将Task注册到worker的`map`数据结构中，以`taskType`为键，`task`为值。

```go
type TaskHandler struct {
    TaskType string
    NewProc  func() TaskIntf
}

// RegisterHandler func RegisterHandler
func RegisterHandler(handler *TaskHandler) {
	taskHandlerMap[handler.TaskType] = handler
}
```

## 3.2 Task任务需要实现的公用接口

task需要实现几个公用接口，封装在上述`TaskHandler`结构体中。主要实现：

- `ContextLoad`：加载上下文
- `HandleProcess`：处理、执行任务
- `SetTask`：当前阶段任务完成，调用flowSvr接口更新当前任务状态
- `HandleFinish`：当前阶段任务完成执行的操作（更新任务状态）
- `HandleFinishError`：任务失败后执行后续的任务失败处理操作
- `Base`：反序列化任务信息到`TaskBase`结构体
- `CreateTask`：创建任务（创建
- `HandleFailedMust`：处理失败的任务，**任务状态重置为失败**，结束任务

```go
// TaskIntf Task interface
type TaskIntf interface {
	ContextLoad() error
	HandleProcess() error
	SetTask() error
	HandleFinish()
	HandleFinishError() error
	Base() *TaskBase
	CreateTask() (string, error)
	HandleFailedMust() error
}
```

## 3.3 Task序列化反序列化处理：json

使用go中自带的`"encoding/json"`库来实现Task的序列化和反序列化。

### 3.3.1 Task序列化

序列化是将结构体转换为json字符串的过程，使用`json.Marshal`函数实现。

```go
b, err := json.Marshal(body)
```
### 3.3.2 Task反序列化

反序列化是将json字符串转换为结构体的过程，使用`json.Unmarshal`函数实现。当向接口发送请求获得`response`后，需要将`response`的`body`部分反序列化为结构体。

```go
err = json.Unmarshal(respStr, respData)
```

> 参考
> 
> 1. [golang解析json数据（Encoding/Json）](https://zhuanlan.zhihu.com/p/115066986)
> 
> 2. [golang json解析](https://www.cnblogs.com/niuben/p/15666154.html)


# 4. 任务调度

## 4.1 任务调度：load任务配置

在worker启动时，先通过`get_task_schedule_cfg_list`接口获取任务调度配置，然后根据配置的调度时间，定时执行任务。

开启一个goroutine，每隔`20s`请求更新一次任务调度配置。

```go
once.Do(func() {
	// 初始化加载任务配置信息表
	if err := LoadCfg(); err != nil {
		msg := "load task cfg schedule err" + err.Error()
		martlog.Errorf(msg)
		fmt.Println(msg)
		os.Exit(1)
	}
	go func() {
		CycleReloadCfg()
	}()
})
```

## 4.2 任务调度：定时拉取任务

在worker的主线程中阻塞，执行任务调度。根据任务配置表中的`cfg.ScheduleInterval`时间开启定时器定时拉取一批任务

```go
cfg, ok := scheduleCfgDic[p.TaskType]
if !ok {
	martlog.Errorf("scheduleCfgDic %s, not have taskType %s", tools.GetFmtStr(scheduleCfgDic), p.TaskType)
	return
}
intervalTime := time.Second * time.Duration(cfg.ScheduleInterval)
if cfg.ScheduleInterval == 0 {
	intervalTime = time.Second * DEFAULT_TIME_INTERVAL
}
// 前后波动500ms[0,501)
step := RandNum(501)
// 加上波动的时间
intervalTime += time.Duration(step) * time.Millisecond
t := time.NewTimer(intervalTime)
<-t.C
```

每到定时时间拉取一批任务时开启一个新的goroutine，并在新开启的goroutine中，假设拿到一批数量为`n`的任务，遍历这`n`个任务，每个任务开启一个goroutine执行。

## 4.3 任务调度：分布式锁

其中，在每次拉取一批新任务时先通过**阻塞模式redis抢锁**，通过 Redis 的**LUA原子操作**实现跨进程/跨机器的互斥访问。5s内抢不到锁则返回等待下一次拉取任务。持有锁的过期时间为3s。

其中redis的分布式锁连接地址在配置文件中配置。

```go
// 阻塞模式，如果没有抢到锁，就会阻塞直到抢锁成功（默认阻塞最长时间为5秒）
mutex := redislock.NewRedisLock(p.TaskType, lockClient, redislock.WithBlock(), redislock.WithWatchDogMode(), redislock.WithExpireSeconds(3))
if err := mutex.Lock(context.Background()); err != nil {
	martlog.Errorf("RedisLock lock err %s", err.Error())
	return // 没有抢到锁，直接返回
}
```

在`redislock.NewRedisLock`处理完创建锁的操作后，会在`redislock.Lock`中调用`redislock.WatchDog`函数通过延时函数在抢占到分布式锁后开启**看门狗**机制，启动一个后台 goroutine 来定期续期锁的有效期。

redis加锁是通过`SETNX`命令结合**看门狗机制**手动实现一个**分布式锁**的，`SETNX`命令是一个原子性的操作，只有在key不存在时才会设置key的值，如果key已经存在，则不做任何操作。

```go
// Lock 加锁
func (r *RedisLock) Lock(ctx context.Context) (err error) {
	defer func() {
		if err != nil {
			return
		}
		// 加锁成功的情况下，会启动看门狗
		// 关于该锁本身是不可重入的，所以不会出现同一把锁下看门狗重复启动的情况
		r.watchDog(ctx)
	}()

	// 不管是不是阻塞模式，都要先获取一次锁
	err = r.tryLock(ctx)
	if err == nil {
		// 加锁成功
		return nil
	}

	// 非阻塞模式加锁失败直接返回错误
	if !r.isBlock {
		return err
	}

	// 判断错误是否可以允许重试，不可允许的类型则直接返回错误
	if !IsRetryableErr(err) {
		return err
	}

	// 基于阻塞模式持续轮询取锁
	err = r.blockingLock(ctx)
	return
}

// 尝试通过 SETNX 命令获取锁
func (r *RedisLock) tryLock(ctx context.Context) error {
	// 首先查询锁是否属于自己
	result, err := r.client.pool.SetNX(ctx, r.key, r.token, time.Duration(r.expireTimeSecond)*time.Second).Result()
	if err != nil {
		return err
	}

	// 加锁失败，已经有锁
	if !result {
		return ErrLockAcquiredByOthers
	}

	return nil
}

// 启动看门狗
func (r *RedisLock) watchDog(ctx context.Context) {
	// 1. 非看门狗模式，不处理
	if !r.watchDogMode {
		return
	}

	// 2. 确保之前启动的看门狗已经正常回收
	for !atomic.CompareAndSwapInt32(&r.runningDog, 0, 1) {
	}

	// 3. 启动看门狗
	ctx, r.stopDog = context.WithCancel(ctx)
	go func() {
		defer func() {
			atomic.StoreInt32(&r.runningDog, 0)
		}()
		r.runWatchDog(ctx)
	}()
}

// runWatchDog 看门狗运作
func (r *RedisLock) runWatchDog(ctx context.Context) {
	ticker := time.NewTicker(r.watchDogWorkStepTime)
	defer ticker.Stop()

	for range ticker.C {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// 看门狗负责在用户未显式解锁时，持续为分布式锁进行续期
		// 通过 lua 脚本，延期之前会确保保证锁仍然属于自己
		_ = r.DelayExpire(ctx, r.expireTimeSecond)
	}
}

// 更新锁的过期时间，基于 lua 脚本实现操作原子性
func (r *RedisLock) DelayExpire(ctx context.Context, expireSeconds int64) error {
	result, err := r.client.pool.Eval(ctx, LuaCheckAndExpireDistributionLock, []string{r.key}, []interface{}{r.token, expireSeconds}).Bool()
	if err != nil {
		return nil
	}

	if !result {
		return ErrDelayExpire
	}

	return nil
}
```

## 4.3 任务调度：任务执行

在每个任务的goroutine中，执行任务的过程中，需要**先加载上下文`ContextLoad`，然后执行任务`HandleProcess`，任务执行完后，根据任务执行结果调用`SetTask`接口更新任务状态**。

当任务执行完`HandleProcess`后需要重置**任务阶段和任务状态**，并更新task结构体中的`schedule_log`(这里包括记录track-uuid时间戳、ErrMsg和cost任务执行时间)

最后再更新当前任务的排序时间`order_time`:

- **任务执行成功**：`order_time = modify_time - priority`
    - 说明：根据优先级**提前任务调度时间**
- **任务执行失败**：`order_time = modify_time + retry_interval`
    - 说明：根据**重试时间**延迟任务被调度时间
    - 这里不能加上priority，否则无法保证**重试时间间隔retry_interval内**不会被调度