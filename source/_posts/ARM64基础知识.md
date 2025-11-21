---
title: ARM64基础知识
date: 2025-11-04 10:31:15
tags:
---

>[ARM64内存虚拟化](https://www.cnblogs.com/LoyenWang/p/13584020.html)

> [ARM内存屏障 DMB\DSB\ISB](https://zhuanlan.zhihu.com/p/601037646)

DSB SY：数据屏障指令，多核数据同步问题，主要解决内存数据还未写入，就被乱序的指令读取的问题。
- dsb(sy) 会等待其他核的广播应答后，才算完成

ISB：指令屏障，清空 ISB 后面的指令，并把还没执行的指令丢掉，重新取值（比如让CPU重新读取寄存器状态）。ISB 不会管TLB缓存是否一致，只管指令状态，所以只用 ISB 会存在缓存一致性问题。
- ISB不会等广播应答


