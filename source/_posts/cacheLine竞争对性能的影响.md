---
title: cacheLine竞争对性能的影响
date: 2025-11-22 01:53:19
tags:
categories: 
- Linux内核基础
---


# 1. 场景描述

代码中以 array 为例,创建两个 thread,分别对比以下两种情况的执行性能:

- situation 1:
	- 两个线程对同一数组中同一 cache line 的 index(0和1) 进行赋值操作
	- 结果猜测:cache line冲突频繁,完成任务的耗时长,即性能差
- situation 2:
	- 两个线程对同一数组中不同一 cache line 的 index(0和90) 进行赋值操作
	- 结果猜测:cache line没有冲突,完成任务的耗时短,即性能好

代码中以 struct 为例,创建两个 thread,分别对比以下两种情况的执行性能:

- situation 1:
	- struct 中的 x 和 y 变量在同一 cache line 中,
	  两个线程分别对同一 cache line 中的同变量进行赋值操作
	- 结果猜测:cache line冲突频繁,完成任务的耗时长,即性能差
- situation 2:
	- struct 中的 x 和 y 变量在不同 cache line 中,
	  两个线程分别对不同 cache line 中的同变量进行赋值操作
	- 结果猜测:cache line没有冲突,完成任务的耗时短,即性能好

# 2. 手动测试结果

```
  1 akira@ubuntu:~/false_sharing$ ./false_sharing_array
  2 access_data_array, 1
  3 access_data_array, 0
  4  cache false sharing: 729 ms
  5 access_data_array, 0
  6 access_data_array, 90
  7  cache without false sharing: 330 ms
  8 akira@ubuntu:~/false_sharing$ ./false_sharing_struct
  9  cache false sharing: 6428 ms
 10  cache without false sharing: 3411 ms
```

从运行结果可以看出,通过错开缓存行的方式,性能提升了大概两倍.

# 3. perf 工具分析原因 

## 执行 perf

用 perf 工具来跟踪和分析 cache 行为:

注意在执行 perf 命令前,需要将`false_sharing_struct.c`中的第 47~57 行,第 59~69 行分别注释掉,以此来分别测试两种 situation 的结果.

```shell
perf c2c record -F 10000 ./false_sharing_struct //采集数据
perf c2c report --stats //查看报告
```

其中存在缓存行冲突的 situation 1 测试结果如下：

```text
akira@ubuntu:~/false_sharing$ perf c2c record -F 10000 ./false_sharing_struct
 cache false sharing: 7394 ms
[ perf record: Woken up 55 times to write data ]
[ perf record: Captured and wrote 13.716 MB perf.data (177504 samples) ]
akira@ubuntu:~/false_sharing$ perf c2c report --stats
=================================================
            Trace Event Information
=================================================
  Total records                     :     177504
  Locked Load/Store Operations      :          1
  Load Operations                   :      76801
  Loads - uncacheable               :          0
  Loads - IO                        :          0
  Loads - Miss                      :          0
  Loads - no mapping                :          0
  Load Fill Buffer Hit              :      12598
  Load L1D hit                      :      64188
  Load L2D hit                      :          3
  Load LLC hit                      :         11
  Load Local HITM                   :          5
  Load Remote HITM                  :          0
  Load Remote HIT                   :          0
  Load Local DRAM                   :          1
  Load Remote DRAM                  :          0
  Load MESI State Exclusive         :          1
  Load MESI State Shared            :          0
  Load LLC Misses                   :          1
  LLC Misses to Local DRAM          :      100.0%
  LLC Misses to Remote DRAM         :        0.0%
  LLC Misses to Remote cache (HIT)  :        0.0%
  LLC Misses to Remote cache (HITM) :        0.0%
  Store Operations                  :     100703
  Store - uncacheable               :          0
  Store - no mapping                :          2
  Store L1D Hit                     :      94191
  Store L1D Miss                    :       6510
  No Page Map Rejects               :        182
  Unable to parse data source       :          0

=================================================
    Global Shared Cache Line Event Information
=================================================
  Total Shared Cache Lines          :          1
  Load HITs on shared lines         :      42461
  Fill Buffer Hits on shared lines  :      12591
  L1D hits on shared lines          :      29862
  L2D hits on shared lines          :          3
  LLC hits on shared lines          :          5
  Locked Access on shared lines     :          0
  Store HITs on shared lines        :      38640
  Store L1D hits on shared lines    :      32262
  Total Merged records              :      38645

=================================================
                 c2c details
=================================================
  Events                            : cpu/mem-loads,ldlat=30/P
                                    : cpu/mem-stores/P
  Cachelines sort on                : Total HITMs
  Cacheline data grouping           : offset,pid,iaddr
(END)
```

其中`HITM`大概率是发生了`false sharing`

`Load HITs on shared lines`和`Store HITs on shared lines`是共享的`cacheline`发生读写的操作，这种情况下会大大增加 MESI 总线的传输，对性能影响比较大。

下面再来看一下 situation 2 的结果：

```text
akira@ubuntu:~/false_sharing$ perf c2c record -F 10000 ./false_sharing_struct
 cache without false sharing: 2284 ms
[ perf record: Woken up 27 times to write data ]
[ perf record: Captured and wrote 6.766 MB perf.data (88391 samples) ]
akira@ubuntu:~/false_sharing$ perf c2c report --stats
=================================================
            Trace Event Information
=================================================
  Total records                     :      88391
  Locked Load/Store Operations      :          1
  Load Operations                   :      43362
  Loads - uncacheable               :          0
  Loads - IO                        :          0
  Loads - Miss                      :          0
  Loads - no mapping                :          0
  Load Fill Buffer Hit              :          5
  Load L1D hit                      :      43356
  Load L2D hit                      :          0
  Load LLC hit                      :          0
  Load Local HITM                   :          0
  Load Remote HITM                  :          0
  Load Remote HIT                   :          0
  Load Local DRAM                   :          1
  Load Remote DRAM                  :          0
  Load MESI State Exclusive         :          1
  Load MESI State Shared            :          0
  Load LLC Misses                   :          1
  LLC Misses to Local DRAM          :      100.0%
  LLC Misses to Remote DRAM         :        0.0%
  LLC Misses to Remote cache (HIT)  :        0.0%
  LLC Misses to Remote cache (HITM) :        0.0%
  Store Operations                  :      45029
  Store - uncacheable               :          0
  Store - no mapping                :          0
  Store L1D Hit                     :      45006
  Store L1D Miss                    :         23
  No Page Map Rejects               :         39
  Unable to parse data source       :          0

=================================================
    Global Shared Cache Line Event Information
=================================================
  Total Shared Cache Lines          :          0
  Load HITs on shared lines         :          0
  Fill Buffer Hits on shared lines  :          0
  L1D hits on shared lines          :          0
  L2D hits on shared lines          :          0
  LLC hits on shared lines          :          0
  Locked Access on shared lines     :          0
  Store HITs on shared lines        :          0
  Store L1D hits on shared lines    :          0
  Total Merged records              :          0

=================================================
                 c2c details
=================================================
  Events                            : cpu/mem-loads,ldlat=30/P
                                    : cpu/mem-stores/P
  Cachelines sort on                : Total HITMs
  Cacheline data grouping           : offset,pid,iaddr
```

这里可以看出，在没有 cacheline 冲突的情况下，`HITM`和``Load HITs on shared lines`和`Store HITs on shared`的值都为0。

## 分析

因此也可以看出，多个线程频繁读写同一缓存行对性能的影响很大。

同时可以看出这里的代码都是没有加锁的情况下测试的（因为本身就不是对同一全局变量进行修改，所以不加锁也可以保证数据正确），因此没有软件上锁竞争的情况，所以这里最大的影响因素是：

给两个线程的 x 和 y 分别独占一行（64 B padding），只能消除伪共享，并不能减少 load+store 指令条数，也不会减少总内存流量。
它唯一、但非常显著地减少的是：

> CPU 之间因缓存一致性协议产生的“跨核作废/重载”流量与等待时间
（英文常叫 coherency traffic, snooping traffic, HITM latency）

| 事件                             | situation1（同一行） | situation2（两行） | 差额          |
| ------------------------------ | --------------- | -------------- | ----------- |
| **Total Shared Cache Lines**   | 1               | 0              | **-1**      |
| **Load HITs on shared lines**  | 42 461          | 0              | **-42 461** |
| **Store HITs on shared lines** | 38 640          | 0              | **-38 640** |
| **Remote/Local HITM**          | 5 / 0           | 0 / 0          | **-5**      |


- 同一行时，每写一次就要让对端 CPU 作废该行 → 触发 HITM 和 shared lines 计数。
- 两行后，硬件视角里再也没有“被多核同时缓存”的行 → 所有事件直接归零。

代码只是把两个 hot 变量从 “同一 64 B 行” 改成 “各独占一行”，就砍掉了 4 万次级的跨核作废/重载，

→ 让每次写操作从 “上百周期等待” 变成 “本地缓存几周期”，

→ 最终 10 亿次循环省下 5 秒，宏观加速 3.2×。

这就是伪共享优化的典型收益：不省指令、不省流量，只省“一致性等待时间”。

## MESI 举例说明

下面通过一个简化的 MESI 流程举例，说明同一 cache line 被多核读写时会如何产生跨核作废/重载（coherency traffic / HITM），以及为什么通过 64B 对齐/填充能显著提升性能。

### 代码 & 地址布局

```c
struct data {
  unsigned long x;      // offset 0
  unsigned long y;      // offset 8
} __attribute__((aligned(64)));
/* 整个结构占 16 B，但对齐到 64 B → 行 A：[0x00-0x3F] */
```

### 过程说明（简化 MESI 步骤）

**1. 初始状态**

CPU 核 | 行 A 状态 | 说明
:---|:---:|---
CPU-0 | I | 未缓存
CPU-1 | I | 未缓存


**2. 第 1 步：CPU-0 读 data.x → load miss**
```text
CPU-0 cache          L3 / DRAM
-------------------------------
I  → Read ----------→ 返回干净副本
←-------------------
```
状态变为 E (Exclusive)
因无其他副本，直接给 E（干净，独占）

**3. 第 2 步：CPU-1 读 data.y → load miss**

```text
CPU-0 cache   CPU-1 cache      L3
----------------------------------
E             I
              Read --------→ 转发干净副本
              ←------------
S             S
```

两份副本都变成 S (Shared)，内容干净，可读不可写

**4. 第 3 步：CPU-0 写 data.x → Store Miss / Write-Invalidate**

```text
CPU-0 cache   CPU-1 cache      L3
----------------------------------
S             S
要写 → 发 Invalidate ----→ 收到作废
              状态变 I
              回 ACK
←----------------------
E → M (Modified, 脏，独占)
```

MESI 核心规则：写前必须先独占

作废消息广播 → 对端副本立即失效；行变为 M

**5. 第 4 步：CPU-1 写 data.y → 再次 Store Miss / Read-Invalidate**

```text
CPU-0 cache   CPU-1 cache      L3
----------------------------------
M (脏)        I
收到 Inv ----→ 发 Read-Invalidate
必须把脏数据 **写回 L3 / 内存**
回送脏副本 ──────> 转发最新副本
状态变 I     ←------------
              E → M
```

因行在远端 Modified，需三步：

脏数据 Write-Back 到 L3/内存

本地副本 作废

把最新数据 转发 给请求者

此次往返 ≈ 60–200 ns，即 perf 报告的 HITM 延迟

**6. 放大效应：循环 10 亿次 → 10 亿次作废/重载**

- 若两个线程在同一 cache line 上交替写，每次写都会触发 Invalidate、脏数据写回与远端等待，导致显著的延迟累积。

**7. 通过 64 B padding 消除伪共享**

- 若把 `x`、`y` 各自对齐/填充到独立的 cache line，两个写操作就不会互相触发 Invalidate；每次写都可以在本地缓存完成（本地 M），访问延迟变为本地缓存访问级别（个位纳秒）。
- 这可以把示例中的 7394 ms 降到 2284 ms（约 3.2× 加速），原因是消除了成千上万次的跨核一致性等待，而非减少指令或总体内存流量。

### 小结

- 伪共享（false sharing）并不改变指令数或总体内存流量，但会使缓存一致性协议产生大量跨核流量与等待时间。
- 通过让热写变量各自占用独立 cache line（64 B），可以显著降低 coherency traffic / HITM，从而获得明显的性能提升。



# 附件

```c
// false_sharing_array.c

#include <sys/times.h>
#include <time.h>
#include <stdio.h> 
#include <pthread.h>

#define MAX_LOOP 100000000

unsigned long data[100];

void *access_data_array(void *param)
{
	int index = *((int *)param);
	printf("%s, %u\n", __func__, index);

	unsigned long i;

	for (i = 0; i < MAX_LOOP; i++)
		data[index] += 1;
}

int main(void)
{
	pthread_t thread_1;
	pthread_t thread_2;
	unsigned long total_time;

	struct timespec time_start, time_end;

	int start = 0, end = 1;

	clock_gettime(CLOCK_REALTIME,&time_start);
	pthread_create(&thread_1, NULL, &access_data_array, (void*)&start);
	pthread_create(&thread_2, NULL, &access_data_array, (void*)&end);
	pthread_join(thread_1, NULL);
	pthread_join(thread_2, NULL);
	clock_gettime(CLOCK_REALTIME,&time_end);

	total_time = (time_end.tv_sec - time_start.tv_sec)*1000 +
		(time_end.tv_nsec - time_start.tv_nsec)/1000000;

	printf(" cache false sharing: %lu ms \n", total_time);

	end = 90;

	clock_gettime(CLOCK_REALTIME,&time_start);
	pthread_create(&thread_1, NULL, &access_data_array, (void*)&start);
	pthread_create(&thread_2, NULL, &access_data_array, (void*)&end);
	pthread_join(thread_1, NULL);
	pthread_join(thread_2, NULL);
	clock_gettime(CLOCK_REALTIME,&time_end);

	total_time = (time_end.tv_sec - time_start.tv_sec)*1000 +
		(time_end.tv_nsec - time_start.tv_nsec)/1000000;

	printf(" cache without false sharing: %lu ms \n", total_time);

	return 0;

}
```

```c
// false_sharing_struct.c

#include <sys/times.h>
#include <time.h>
#include <stdio.h> 
#include <pthread.h>

struct data_with_false_sharing {
	unsigned long x;
	unsigned long y;
} cacheline_aligned;

#define cacheline_aligned __attribute__((__aligned__(64)))

struct padding {
	char x[0];
} cacheline_aligned;

struct data_wo_false_sharing {
	unsigned long x;
	struct padding _pad;
	unsigned long y;
} cacheline_aligned;

#define MAX_LOOP 1000000000

void *access_data(void *param)
{
	unsigned long *data = (unsigned long *)param;
	unsigned long i;
	unsigned long var;

	for (i = 0; i < MAX_LOOP; i++) {
		var = *data;
		*data += i;
	}
}

int main(void)
{
	struct data_with_false_sharing data0;
	struct data_wo_false_sharing data1;
	pthread_t thread_1;
	pthread_t thread_2;
	unsigned long total_time;

	struct timespec time_start, time_end;

	clock_gettime(CLOCK_REALTIME,&time_start);
	pthread_create(&thread_1, NULL, &access_data, (void*)&data0.x);
	pthread_create(&thread_2, NULL, &access_data, (void*)&data0.y);
	pthread_join(thread_1, NULL);
	pthread_join(thread_2, NULL);
	clock_gettime(CLOCK_REALTIME,&time_end);

	total_time = (time_end.tv_sec - time_start.tv_sec)*1000 +
		(time_end.tv_nsec - time_start.tv_nsec)/1000000;

	printf(" cache false sharing: %lu ms \n", total_time);

	clock_gettime(CLOCK_REALTIME,&time_start);
	pthread_create(&thread_1, NULL, &access_data, (void*)&data1.x);
	pthread_create(&thread_2, NULL, &access_data, (void*)&data1.y);
	pthread_join(thread_1, NULL);
	pthread_join(thread_2, NULL);
	clock_gettime(CLOCK_REALTIME,&time_end);

	total_time = (time_end.tv_sec - time_start.tv_sec)*1000 +
		(time_end.tv_nsec - time_start.tv_nsec)/1000000;

	printf(" cache without false sharing: %lu ms \n", total_time);

	return 0;
}
```