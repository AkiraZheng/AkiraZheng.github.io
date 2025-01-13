---
title: Asyncflow项目3：FlowSvr的设计
date: 2024-07-15 20:55:39
tags:
categories:
- Asyncflow

password: ztyn
abstract: 需要填入密码才可访问阅读
message: 需要填入密码才可访问阅读
wrong_pass_message: 错误密码，请重试
---

# 一、flowSvr对外接口设计

flowSvr对外接口主要有对**user**的暴露接口和对**worker**暴露的接口，`content-type`均为`application/json`（通过序列化反序列化解析），有GET和POST两种请求方式：

- **GET**请求：**只能通过url传递参数**，参数在url中可见，不安全，常用于**向服务器请求数据（适合数据过滤检索的场景）**
- **POST**请求：**参数在请求体content中**，不会在url中显示，安全，常用于**向服务器提交数据（表单提交、创建任务）**

## 1. 5种POST接口说明（3user，2worker）

### 1.1 user创建任务接口

**1）接口说明**

- 接口：`/create_task`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/create_task`
- 说明：user向flowSvr提交任务，flowSvr将任务存入数据库，返回任务id

**2）请求体中json字段说明**

- JSON请求字段为`task_data`，结构体中包含以下多个字段：
    - `task_id`：创建时不填，可用于接口幂等保证
    - `task_type`：任务类型
    - `task_content`：任务内容
    - `task_priority`：任务优先级，默认为`0`
    - `user_id`：用户id

**3）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息
    - 成功：`SUCCESS`
    - 失败情况说明：`FAIL_REASON::ERROR_MSG`
- `task_id`：任务id（成功时返回，用于后续查询任务状态）

### 1.2 user创建任务接口

**1）接口说明**

- 接口：`/register_task`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/register_task`
- 说明：user向flowSvr注册任务类型，flowSvr将**任务配置信息**插入**任务配置表**，并插入**任务位置表**

**2）请求体中json字段说明**

- JSON请求字段为`task_config_data`，结构体中包含以下多个字段：
    - `task_type`：任务类型
    - `schedule_limit`：单次调度拉取数

**3）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息

### 1.3 user创建新任务类型接口

**1）接口说明**

- 接口：`/register_task_type`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/register_task_type`
- 说明：user向flowSvr注册新的任务类型，flowSvr将**任务配置信息**插入**任务配置表**，并插入**任务位置表**，新建**任务信息表1**

**2）请求体中json字段说明**

- JSON请求字段为`task_type_data`，结构体中包含以下多个字段：
    - `task_type`：任务类型
    - `schedule_limit`：单次调度拉取数（可选）
    - `schedule_interval`：每次拉取任务间隔（可选）
    - `max_retry_num`：最大重试次数（可选）
    - `max_retry_interval`：最大重试时间间隔（可选）

**3）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息


### 1.4 worker拉取占据一批任务的接口

**1）接口说明**

- 接口：`/hold_tasks`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/hold_tasks`
- 说明：worker向flowSvr拉取一批任务，flowSvr将**这批任务的status**置为**2执行中**，并**返回任务列表给worker**

**2）请求体中json字段说明**

- `task_type`：任务类型

**3）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息
- `task_list`：任务列表（成功时返回）
    - `user_id`：用户id
    - `task_id`：任务id
    - `task_type`：任务类型
    - ......（任务信息表其它所有字段）


### 1.5 worker提交任务执行结果（更新任务）

**1）接口说明**

- 接口：`/set_task`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/set_task`
- 说明：worker向flowSvr提交任务执行结果，主要为**更新status、schedule_log、crt_retry_num、stage、task_content**字段

**2）请求体中json字段说明**

- JSON请求字段为`task_data`，结构体中包含以下多个字段：
    - `task_id`：任务id
    - `task_type`：任务类型
    - `status`：任务状态
    - `schedule_log`：任务调度日志
    - `crt_retry_num`：当前已经重试次数
    - `task_stage`：任务阶段
    - `task_content`：任务内容

**3）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息

## 2. 5种GET接口说明

### 2.1 PING接口

**1）接口说明**

- 接口：`/ping`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/ping`
- 说明：用于测试flowSvr是否正常
- 无请求参数

### 2.2 user通过task_id查询任务状态

**1）接口说明**

- 接口：`/get_task`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/get_task?task_id=xxx`
- 说明：user通过task_id查询任务状态

**2）请求参数**

- `task_id`：生成**task_id**的时候会**自带任务对应的表pos（如`...9ea_video_1`）**，所以只需要传task_id即可

**3）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息
- `task_data`：任务信息（成功时返回）
    - `user_id`：用户id
    - `task_id`：任务id
    - `status`：任务状态
    - `stage`：任务阶段
    - `schedule_log`：任务调度日志
    - `task_content`：任务内容

### 2.3 管理：查询所有任务配置信息

**1）接口说明**

- 接口：`/get_task_schedule_cfg_list`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/get_task_schedule_cfg_list`
- 说明：查询所有任务配置信息

**2）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息
- `task_schedule_cfg_list`：结构体，含任务配置信息列表所有字段

### 2.4 后台管理：过滤筛选某个条件下n条任务信息

**1）接口说明**

- 接口：`/get_task_list`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/get_task_list?task_type=xxx&status=xxx&limit=xxx`
- 说明：过滤筛选某个条件下n条任务信息

**2）请求参数**

以下可选的筛选条件：

- `task_type`：任务类型
- `status`：任务状态
- `limit`：限制返回的任务数
- `stage`：任务阶段

**3）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息
- `task_list`：符合条件的任务信息表所有字段

### 2.5 后台管理：获取某个任务count数

**1）接口说明**

- 接口：`/get_task_counts_by_type`
- 请求地址：`http://<flowSvr_ip>:<port>/v1/get_task_counts_by_type?task_type=xxx`
- 说明：获取某个任务有多少条任务

**2）响应体字段**

- `code`：返回码，**0表示成功**，非0表示失败
- `msg`：返回信息，成功或失败的提示信息
- `task_count`：任务数

# 二、flowSvr任务流程设计

## 1. 创建任务流程

- step1：user发起请求
- step2：nginx负载均衡到flowSvr
- step3：flowSvr接收请求，路由到`创建任务函数`
    - 3.1：`HandlerIput`检查入参是否合法及完整，不合法则返回错误
    - 3.2：`HandleProcess`处理插入任务逻辑
        - **任务位置表**找到插入的表号
        - **任务配置表**获取该任务的一些**默认配置信息**
        - 根据**入参和配置信息**插入任务表
    - 3.3：`HandlerOutput`回包

<img src="create_task.png" width="50%">

## 2. worker拉取占据任务流程

- step1：worker发起请求
- step2：nginx负载均衡到flowSvr
- step3：flowSvr接收请求，路由到`占据任务函数`
    - 3.1：`HandlerIput`检查入参是否合法及完整，不合法则返回错误
    - 3.2：`HandleProcess`处理拉取任务逻辑
        - **任务位置表**拿到当下要调度的表号
        - **任务配置表**拿到该任务的**单次拉取数**
        - 在调度的表中根据`order_time`排序拉取一批任务
        - 将这批任务的**status**置为**2执行中**
    - 3.3：`HandlerOutput`回包

<img src="hold_tasks.png" width="50%">


# 三、具体设计细节

## 1. 最大重试时间设计

框架允许选用两种重试策略：**均匀重试**和**渐进重试**，由**任务配置表**中的`max_retry_interval`字段控制

- 当`max_retry_interval`为**负数**时，表示采用**均匀重试**策略
- 当`max_retry_interval`为**正数**时，表示采用**渐进重试**策略

重试次数策略

- `max_retry_num`：最大重试次数
- `crt_retry_num`：当前已经重试次数
- `max_retry_interval`：最大重试时间间隔

渐进重试公式：`order_time += min(1<<crt_retry_num, max_retry_interval)`

举例：`max_retry_interval=10`，重试时会从1开始，翻倍递增，直到10后一直不变，直到达到最大重试次数。[1, 2, 4, 8, 10, 10, 10, 10, 10, 10]

## 2. 拉取任务的优先级

排序的目的：用于**拉取任务时优先选择拉取哪些任务**

拉取任务的先后排序跟以下三个因素相关：

- **任务创建时间modify_time**
- **任务优先级priority**
- **任务重试时间retry_interval**

### 2.1 任务创建时间

任务创建时间是任务的**基础排序**，即**先创建的任务先执行**，但是由于该调度算法存在多阶段任务，所以如果按照**创建时间**排序，会导致某些后来的处于低阶段的任务被饿死

解决：摈弃**创建时间**，改成用**修改时间modify_time**做为排序的依据

### 2.2 任务优先级

任务优先级是任务的**第二排序**，即**优先级高的任务先执行**，优先级高的任务会被提前调度

一般的任务，都是采用**绝对优先级**，但是在该调度框架中要考虑**重试**的情况，所以不能单一考虑**绝对优先级**

因此框架中将**优先级**抽象成**提前priority时间**

### 2.3 任务重试时间

任务重试阶段要保证任务在**重试时间间隔retry_interval内**不会被调度

### 2.4 order_time排序

**1）order_time的设计原理**

在上述三种影响因素下，如果我们拉取任务时需要同时将**priority**和**modify_time**都加上联合索引，且大多数时候priority是一样的，增加一个索引很浪费资源，而且priority作为最高优先级其实不合理，比如一个高优先级任务失败后又马上被选中执行了

```sql
SELECT * FROM t_lark_task_1 WHERE (status = 1) ORDER BY priority desc, modify_time LIMIT 100;
```

解决方法：

- 抽象出一个中间字段`order_time`耦合上面的三个排序相关字段

排序原理：

- order_time的相对时间戳越小，越早被拉取

优点：

- **解耦**，只需要给`order_time`与`status`加上**联合索引**，不用给几个相关字段都加入联合索引
- 让低优先级任务也有可能有更早被调用的可能

```sql
SELECT * FROM t_lark_task_1 WHERE (status = 1) ORDER BY order_time LIMIT 100;
```

**2）order_time的更新**

在设计更新规则时需要同时考虑三个因素的规则：

| 字段 | 说明 | 更新规则约束 |
| --- | --- | --- |
| modify_time | 先进先出 | 保证多阶段下，新阶段扔回去时排到队尾 |
| priority | 考虑任务优先级 | 解耦，将priority由级别抽象成优先priority秒，级别更高的提前的秒数更多 |
| retry_interval | 防止被异常任务阻塞住 | 添加重试时间，异常失败的任务需要的重试时间肯定长，也就是排得后面点 |

根据以上约束，`order_time`在三个阶段需要更新：

- **任务创建**：`order_time = create_time - priority`
    - 说明：根据优先级**提前任务调度时间**
- **任务执行成功**：`order_time = modify_time - priority`
    - 说明：根据优先级**提前任务调度时间**
- **任务执行失败&&治理模块发现超时任务**：`order_time = modify_time + retry_interval`
    - 说明：根据**重试时间**延迟任务被调度时间
    - 这里不能加上priority，否则无法保证**重试时间间隔retry_interval内**不会被调度

## 3. 分表设计

### 3.1 分表策略

这里对多种分表策略进行对比：

- **不分表**：不分表**全表扫描性能会很差**，同时**影响查询和任务拉取接口**的效率
- **hash切分user_id**：如果按user分表是更**有利于数据过滤查询**这种**后台管理业务**的实现，比如购物车心愿单添加这种场景
- **按大小阈值滚表**：通常调度框架的目的是做任务调度，按照user的话表内会存在很多冷数据，影响拉取任务时的检索速度
- **分库+分表**：只有分表的话会存在**任务提交单超过MySQL处理能力时的性能瓶颈问题**，单MySQL实例库的话无法进行水平扩展（由于受单MySQL库的性能瓶颈影响，水平扩展多个flowSvr或worker后也难以提升性能）

策略选择：

- **hash还是滚表**：如mycat等中间件实现分表的策略一般是**hash切分user_id**，而在该调度框架中，由于任务是不断推进的，冷表属于过去式，对任务拉取性能会有影响，我们更关注的是热表数据，因此在次特点上采用**range**按大小阈值滚表策略保证**pos区间外的冷数据在拉取任务时不会加入检索中**（pos区间内的冷数据还是无法避免，但已经一定程度上提高性能了）
- **分表还是分库+分表**：本项目场景下，**异步执行任务最大的瓶颈**出现在**worker执行的具体耗时任务**上，也就是worker调用的下游接口的性能，所以就算flowSvr性能提升允许接收更多任务，下游接口也处理不了（如北斗解算场景），同时引入分库会增加开发及维护成本，所以本项目采用**分表**策略

前瞻设计-**分库+分表**：

如果实在是要**提高flowsvr的接收能力**的话，也是可以通过引入中间件通过hash切片将用户分到不同数据库实例中隔离开来执行（tdsql天然支持切片，或者使用中间件mycat）

-  分库依据：根据user_id字段进行将数据分布到不同的数据库中
-  主从同步：配置 MySQL 的主从复制功能，使得主库（写）的数据变化可以实时同步到从库（读、负载均衡）。采用异步复制或半同步复制的方式，确保数据一致性和读写分离。
-  配置文件
    - **mycat**中间件中配置**读写分离配置**
    - 结合**数据库本身**的**主从复制**功能能实现主从数据库

<img src="mycat_master_slave.png" width="50%">

> 参考：
> [学会使用Mycat实现分库分表](https://www.cnblogs.com/joylee/p/7513038.html)
> [MySQL主从复制](https://juejin.cn/post/7082719286518612005)
> [Redis主从复制](https://www.jianshu.com/p/05df9ed24c97)

### 3.2 分表设计

由于是范围滚表，所以在**任务位置表**中需要有**开始位置begin_pos**和**结束位置end_pos**两个字段，用于标记**worker下次调度在哪个表拉取任务**和**user下次在哪个表插入任务**

**1）位置更新**

对`end_pos`的更新途径：

- **任务治理模块**：定时全表扫描，当前表`status`都为终态`3执行成功`或`4执行失败`时，更新**end_pos++**

`begin_pos`的更新也意味着将进行分表，对`begin_pos`的更新途径：

- **任务治理模块**：count>500w时，更新**begin_pos++**，分表中对阈值的判断是>=500w，允许**分表的延时**（也就是有可能是大于500w再分表的）


分表模块划分：

<img src="table_pos.png" width="50%">

分表流程：

<img src="table_pos_flow.png" width="40%">

### 3.3 分表参数

- **滚表阈值**选择：**500w**，属于经验值&&阿里巴巴推荐值

## 4. 数据库设计

### 4.1 数据库选择

**1）持久化数据库选择**

这里考虑选择**MongoDB**或**MySQL**两种数据库，MongoDB也是比较接近关系型数据库的非关系数据库了，刚开始是考虑**MongoDB不支持事务也不支持join联表查询**，其次是之前我一直接触的是MySQL，所以也存在一定的学习成本，最终选择了**MySQL**

当然也会想到Redis的处理能力更强，也具备持久能力，但是Redis基于内存，成本高且存储能力有限，也有一定概率会丢失数据，因此不考虑用Redis

- redis用RDB持久化：快照有延迟，只适合做备份，宕机容易导致数据丢失
- redis用AOF持久化：**每次写操作都会记录日志**，性能较差，且数据量大时会导致磁盘IO压力过大，主从同步也可能导致数据丢失

前瞻设计-**MongoDB**：

- 当然其实还有考虑一种场景就是**上下文存的是大数据**，也就是文件类型的话，后续可能就会引入MongoDB，但是目前还不需要

**2）缓存数据库选择**



### 4.2 数据库连接池设计

#### 4.2.1 连接池的作用

设计数据库连接池的作用：

-  维护池中的长连接，**减少**接收请求时的频繁连接造成的**创建成本**
-  避免高峰期大量连接进来导致的地址不够分配的问题，实现**资源复用**

#### 4.2.2 连接池参数

GO语言开发下，选用**GORM库**实现数据库连接池，简化 Go 应用与数据库的交互

**GORM库**连接池的特点：除了最大池内连接数（长连接）限制外，还做了**最大连接数（长连接+短连接）兜底**，也就是允许峰值时期的短连接，

**GORM库**的连接池参数主要有以下几个：

| 参数 | 说明 | 默认值 | 选用值 |
| --- | --- | --- |
| maxIdleConn | 连接池中最大长连接个数，是影响连接池性能的最关键因素，**调优空间大** | 10 | 1000 |
| maxLifetime | 最大空闲时间，在空闲连接检查中，**超过该值的连接空闲会被释放连接资源** | 0 | 10s |
| maxOpenConn | 连接池最大连接数，**兜底用的**，由**长连接**maxIdleConn和**短连接**决定 | 0 | 5000 |
| timeBetweenEvictionRunsMillis | 配置一定时间**检查要关闭的空闲连接** | 0 | 10s |


## 5. 任务治理模块

在分表场景下，刚开始使用每次创建任务时都会**全表扫描**，但是随着任务量的增加，全表扫描的性能会越来越差，导致**create_task**接口的性能下降，因此引入**任务治理模块**，定时执行一些任务，在分表时也允许**分表的延时**，所以问题不大

任务治理模块主要执行以下两个任务：

<img src="task_governance.png" width="50%">

分表的sql逻辑：

```sql
SELECT COUNT(*) FROM t_lark_task_1;
```

超时任务判断逻辑：

```sql
select * from A where status=2 and now()>modify_time+max_processing_time;
```

# 四、flowSvr性能

异步调度框架中最大的性能瓶颈是worker**耗时任务**，而flowSvr的瓶颈一般都是在**数据库读写**上，也就是MySQL

## 4.1 数据库性能优化两个关键点

- **sql语句优化**
    - **添加task_id索引**和**status-order_time联合索引**，提高任务查询和拉取效率
    - **分表**通过任务治理模块定时处理，减少全表扫描
    - 在处理竞争时放弃`for update`的方式，转成使用分布式锁
- **数据库连接池优化**
    - 主要是对**GORM库**的连接池参数`maxIdleConn`和`maxOpenConn`进行调优，提高连接池性能

## 4.2 数据库连接池调优

调优原因：一开始压测时查看**netstat发现出现了很多TIME_WAIT**，应该是端口被耗尽了，根据常识定位到消耗端口最大的可能性就是连接池的问题，因此将连接池的参数调大

测试工具：wrk这个轻量级工具进行压测，只需要进行一些配置就行

几个接口在2核4g下调优结果

| 接口 | maxIdleConn初始值：QPS | maxIdleConn调优值：QPS | 分析 |
| --- | --- | --- | --- |
| create_task | 10：350 | 1000：3000 | 正常 |
| get_task | 10：400 | 1000：3300 | 查询有redis缓存，QPS会高点也正常 |
| hold_tasks | 10：180 | 1000：2000 | 由于拉取任务既有业务逻辑又有数据库读写操作，较为复杂，QPS低点但是也有提升 |

