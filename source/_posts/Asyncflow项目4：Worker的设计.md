---
title: Asyncflow项目4：Worker的设计
date: 2024-08-18 17:32:49
tags:
categories:
- Asyncflow
---

# 一、Worker调度任务设计

worker最主要的任务就是进行任务的调度，获取到任务后，通过`stage`字段来判断任务的执行阶段，并通过`task_content`字段来获取上下文信息并执行任务。

worker其实只有三个主要任务：
1. **任务治理**定时去拉取任务（拉取任务时多个worker需要抢锁）
    - worker开启一个单独线程，timer定时去拉取任务
2. webserver服务实现并发处理任务
    - worker任务由线程池处理，线程池容量为2000（根据任务最大堆积量1000来设置的）
3. **框架使用者需要自定义编写worker的业务处理逻辑部分的代码**

- 根据`schedule_interval`字段，定时拉取任务
    - 当worker中任务队列积压到一定阈值定时到了也不拉取任务
- 调用post的`/hold_task`接口，请求占据拉取一批任务
- 执行任务
    - 根据`stage`字段，判断任务的执行阶段
        - worker每次只执行一个阶段后就扔回给flowSvr
        - 原因：是为了保证**不被一个任务占据太久时间**，实现异步调度
    - 载入`task_content`字段，获取上下文信息
    - 线程池并发执行任务
    - 更新任务执行信息
    - 调用post的`/set_task`接口提交任务执行状态

这是对于单worker的情况，抽离出了worker的调度流程，实际上部署的时候是多worker的，会存在竞争问题

所以在发送请求后，在flowSvr端需要加锁解决竞争问题

# 二、分布式下的worker流程

- 根据`schedule_interval`字段，定时拉取任务
    - 当worker中任务队列积压到一定阈值定时到了也不拉取任务
- 调用post的`/hold_task`接口，请求占据拉取一批任务
- 获取分布式锁
- **占据任务**
    - **flowSvr更新一批任务状态**
    - **flowSvr返回一批任务列表**
- **释放锁**
- 执行任务
    - 根据`stage`字段，判断任务的执行阶段
        - worker每次只执行一个阶段后就扔回给flowSvr
        - 原因：是为了保证**不被一个任务占据太久时间**，实现异步调度
    - 载入`task_content`字段，获取上下文信息
    - 线程池并发执行任务
    - 更新任务执行信息
    - 调用post的`/set_task`接口提交任务执行状态

<img src="worker_flow.png" width="50%">

# 三、具体设计细节

## 1. 多worker的竞争问题

<img src="worker_competition.png" width="50%">


### 1.1 解决竞争的方案类型

解决竞争的方法主要有三种：

#### 1.1.1 MySQL悲观锁

通过`select ... for update`语句，产生**间隙锁**

- 优点：**简单**，**易于理解**
- 缺点：**性能差**，当并发量大时，容易造成**死锁**

悲观锁阻塞说明：

<img src="for_update_lock.png" width="50%">

- 当第一个sql执行时，会对`status=1`的所有记录加锁（status是索引）
- 当第二个sql执行时，属于任务更新，会将该条`status=2`记录的索引先删掉，在新增`status=1`的记录
    - 索引的B+树叶子节点是有序的
    - 但是由于第一个sql的锁还没有释放，所以第二个sql在新增`status=1`的记录时，会插入sql1的间隙中，所以会阻塞等待sql1的锁释放再执行

> 参考：[我打赌！这个 SQL 题，大部分人答不出来](https://mp.weixin.qq.com/s?__biz=MzUxODAzNDg4NQ==&mid=2247524580&idx=1&sn=8032d1de9a45304f91dbb2e6f5a12e0e&chksm=f98d244ecefaad58a21f730cd9f0646b41e20cd16d20e76c97b6de3b081d3554637366746fd3&token=1905900309&lang=zh_CN#rd)

#### 1.1.2 MySQL乐观锁

通过`owner`字段，实现**CAS**操作，即**比较并交换**

- 缺点：增加多余的sql操作数、worker多的话冲突更多（CPU负担）

乐观锁拉取任务举例：

```sql 
select * from t_video_task_1 where status=1 order by order_time limit 10;
update t_video_task_1 set owner=a and status=2 where task_id in (第一条sql的task_id);
select * from t_video_task_1 where owner=a;
```

<img src="optimistic_lock.png" width="50%">

#### 1.1.3 Redis分布式锁

分布式锁设计：

- 用redis去实现分布式锁（redis的setnx）
- 只有worker拿到锁后才能去调用MySQL
- worker挂了：如果竞争到锁的worker挂了会**有过期时间自动释放锁**的
- worker没挂-任务没执行完但锁到期：用**看门狗自动续期**

存在问题：锁释放不及时，其他worker就闲置了

原因：拉取同步数据任务时需要排队等待拉取完一批任务（**拉取和执行耦合了**）

解决方案：**队列化**，加入消息队列Kafka中间件，将拉取和执行解耦，缩短锁的时间
- 提前同步一批任务放在消息队列中，worker拉取的时候就可以直接拿到一批数据，不需要再等待同步操作的执行，缩短了释放锁的时间
- 缺点：增加了维护成本

**最终选型：redis分布式锁（非队列化）。**因为虽然拉取任务需要排队，但是项目中最耗时的在拉到任务后执行任务，所以拉取任务时短时间的排队是允许的，因此不考虑过度设计加入Kafka增加维护成本

前瞻设计-无任务时减少flowSvr空转查询数据库：
- way1：**redis setnx**
    - 当没任务的时候setnx，有worker进来时，都通过setnx失败来拒绝worker进入
    - 有任务的时候再把键删除掉，以此来允许用户进去flowSvr拉取任务
- way2：加入一个**消息订阅发布**机制，有/无消息时通知worker


#### 1.2 分情况选择加锁方案

**1）单flowSvr多worker的情况**

用flowSvr内部**本地锁**控制一段时间只有一个线程操作MySQL

**2）多flowSvr多worker的情况**

多机下共享MySQL，所以肯定要加**redis分布式锁**

## 2. 任务推拉模式选择

- **推模式**：worker主动拉取任务
    - 缺点：会造成竞争
- **拉模式**：flowSvr推送任务，无竞争
    - 缺点：推的方式缺乏个性化，对所有节点都要发送相同信息，所以**需要保持长连接**，且**频繁的实时推送会造成订阅者worker的负担**

最终选型：**推模式**，因为worker拉取任务时短时间的排队是允许的，而且拉取任务时的竞争问题可以通过加锁解决

## 3. 多阶段任务设计

### 3.1 多阶段任务调度流程

调度框架中的多阶段是在**stage**字段中体现的，**stage**字段的改变也是在**worker**中实现的，**flowSvr**对任务阶段是无感的

其中多阶段的调度流程如下图所示：

<img src="multi_stage.png" width="40%">

### 3.2 多阶段中的上下文

多阶段中需要存储上一阶段的**上下文信息**，以便下一阶段的任务能够继续上一阶段的任务

这里由**task_content**字段来存储上下文信息，**task_content**字段的设计是为了**worker执行任务**，所以**flower不需要理解上下文，只需要存储和传递**，所以可以实现对各种类型任务的快速注册（只需要插入一条新配置）

**上下文类型**：
- **json**、url、文本...

**task_content**字段大小限制：
- **4096字节**的限制

前瞻设计-当超过这个限制时：
- way1：需要开辟额外的空间用于存储上下文，而**task_content**字段只存储上下文的**索引**
    - 如：将mp3、mp4等存在云盘中，只存储云盘的地址
- way2：使用文档型数据库如**MongoDB**来替换MySQL

### 3.2 上下文举例

数据量较少的上下文，最常用的是**json格式**的上下文，通过**存储时的序列化**和**读取时的反序列化成数据结构**

如一类上下文由**SourceUrl**、**CheckTaskID**、**SourceId**组成：

序列化：

```json
{
    "SourceUrl": "http://www.video1.com",
    "CheckTaskID": 1234,
    "SourceId": 22
}

```

反序列化：

```cpp
struct Context {
    std::string SourceUrl;
    int CheckTaskID;
    int SourceId;
};
```