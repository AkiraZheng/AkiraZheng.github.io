---
title: Redis数据库学习
date: 2024-09-21 17:06:47
tags:

categories:
  - 数据库
---

# 一、Redis数据结构

## 1. string

### 1.1 基本操作：增删改查

创建：

- `set key value`
- `setnx key value`：如果key不存在则设置，否则失败

查询
- `get key`
- `mget key1 key2`：一次获取多个key的值

更新
- `set key value`

删除
- `del key`

### 1.2 底层实现

编码格式：
- `int`：存储整数
- `embstr`：小于等于44字节的字符串（浮点型会被转换为字符串存储）
- `raw`：大于44字节的字符串

## 2. list

list就是一个列表

```
[
"a", 
"1234", 
"@!=#"
]
```

### 2.1 基本操作

list是允许双端操作的，不是完全的先入先出，也不是完全的后入先出

创建
- `lpush key value1 value2`：从左边插入
- `rpush key value1 value2`：从右边插入

查询
- `llen key`：获取列表长度
- `lrange key start end`：获取指定范围的元素

更新
- `lpush key value1 value2`：从左边插入
- `rpush key value1 value2`：从右边插入
- `lpop key`：从左边弹出
- `rpop key`：从右边弹出

删除
- `del key`
- `lrem key count value`：删除指定数量的元素，时间复杂度O(n)
- `ltrim key start end`：删除指定范围的元素，时间复杂度O(n)

### 2.2 底层实现

- `ziplist`：压缩列表，用类似数组的结构存储数据，修改效率低
- `linkedlist`：双向链表，修改效率高
- `quicklist`：ziplist和linkedlist的结合体

## 3. set

set适用于**去重**场景和**交集场景**，可以在**点赞**和**共同关注**等场景中使用

### 3.1 基本操作

创建
- `sadd key value1 value2`：添加元素

查询
- `sismember key value`：判断元素是否存在
- `smembers key`：获取所有元素的列表
- `SUNION key1 key2`：求并集，如用于共同关注的人

更新
- `sadd key value1 value2`：添加元素
- `srem key value1 value2`：删除元素

删除
- `del key`

### 3.2 底层实现

- `intset`：整数集合，元素都是整数（有序的，整体来看不依赖set的顺序）
- `hashtable`：哈希表，元素都是字符串（无序的）

存在元素个数阈值，当元素个数小于512个时会用`intset`，否则会用`hashtable`

## 4. hash

### 4.1 基本操作

创建
- `hset key field1 value1 field2 value2`：添加元素
- `hsetnx key field value`：如果field不存在则设置，否则失败

查询
- `hget key field`：获取元素
- `hgetall key`：获取所有元素

更新

- `hset key field value`：添加元素
- `hdel key field`：删除元素

删除
- `del key`

### 4.2 底层实现

都是无序的

- `ziplist`：压缩列表，用类似数组的结构存储数据，修改效率低
- `hashtable`：哈希表，元素都是字符串（无序的）

## 5. zset

### 5.1 基本操作

### 5.2 底层实现

- `ziplist`：压缩列表，用类似数组的结构存储数据，修改效率低，查找速度为`O(n)`
- `skiplist`：**跳表**，类似于二分法，查找速度为`O(logn)`

**为什么用跳表而不用红黑树？**

跳表跟红黑树的查询时间复杂度都是`O(logn)`，但是跳表的**实现更简单**，而且跳表的**范围查询效率更高**；而**平衡树插入和删除**涉及**旋转**等操作，较为复杂

但是跳表的**层数比较高**

**跳表插入一个数的层高是随机的，一开始默认1层，然后每增加一层的概率都是25%，最高为32层**

# 二、Redis基础知识

redis常用在**热点词、排行榜、分布式锁`setnx`**等场景中

## 1. redis的优点

- 读写性能高：redis是基于**内存**的，读写性能高
- 数据结构类型多：支持多种数据结构，如string、list、set、hash等
  - 功能：支持**事务、哨兵模式、主从复制、集群**等功能来保证数据的**安全性和高可用性**

## 2. 缓存穿透、缓存击穿、缓存雪崩

- 缓存穿透：**Redis和MySQL都没有**
- 缓击穿穿：**某个热点key失效**
- 缓存雪崩：**大量key同时失效**



