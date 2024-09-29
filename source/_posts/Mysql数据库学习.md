---
title: Mysql数据库学习
date: 2024-04-12 21:48:23
tags:
categories:
- 数据库
---

## 一、Mysql数据库在Linux中的使用方法

### 1.1 修改密码

进入mysql前终端指令：

- 查看mysql服务状态：`systemctl status mysql.service`
- 查看mysql密码：`sudo cat /etc/mysql/debian.cnf`

根据查到的账号密码进入mysql：
- `mysql -u debian-sys-maint -p`
- 输入密码：（输入`debian-sys-maint`对应的密码即可）

进入mysql后终端指令（指令以`;`结尾）：
- 查看数据库：`show databases;`
- 选择数据库：`use 数据库名;`
- 查看表：`show tables;`
- 查询表：`select * from 表名;`
- 查看当前mysql用户：
    - 先进入mysql数据库：`use mysql;`
    - 查看用户：`select user,host from user;`
    - 修改密码：`ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';`后刷新权限：`flush privileges;`
    - 修改完密码后退出mysql：`exit;`

修改完密码后，可以用新密码进入mysql：`mysql -u root -p`

输入密码：`root`就可以进入

### 1.2 终端使用mysqlsh来操作数据库

- 下载mysql-shell：`sudo apt-get install mysql-shell`
- 启动mysql-shell：`mysqlsh`
- 连接数据库：`\connect root@localhost`
- 输入上面修改后的密码：`root`
- 查看数据库：`\sql show databases;`

### 1.3 vscode中使用mysqlsh

- 安装插件：`Mysql Shell for VS Code`

可能会出现错误：

<img src='err1.png'>

根据错误提示在终端安装即可：

<img src='install.png'>

然后`restart`即可

- 重启后点击`New Connection`，输入连接信息(用户名、密码、端口等)，点击`OK`即可

- 配置完成后就可以在vscode中使用mysqlsh了，需要注意的是输入语句后需要按`ctrl+enter`才能执行

## 二、Mysql数据库基础操作

### 2.1 数据库的数据库&表创建、表格增删改查

- 创建数据库：`create database 数据库名;`
- 删除数据库：`drop database 数据库名;`
- 选择数据库：`use 数据库名;`
- 创建表格：`create table 表名(字段名1 类型1, 字段名2 类型2, ...);`
- 删除表格：`drop table 表名;`
- 查看表格：`show tables;`
- 查看表格结构：`desc 表名;`
- 插入数据：`insert into 表名(字段1, 字段2, ...) values(值1, 值2, ...);`

```sql
CREATE DATABASE IF NOT EXISTS game;
USE game;


CREATE TABLE player (
	id INT,
	name VARCHAR(100),
	level INT,
	exp INT,
	gold DECIMAL(10,2)
)
SELECT * FROM player;


DESC player;

ALTER table player MODIFY COLUMN name VARCHAR(200);
ALTER TABLE player Add COLUMN last_login DATETIME;
DROP TABLE player;
SHOW TABLES;

INSERT INTO player (id, name, level, exp, gold) VALUES (1, "王五", 1, 1, 1);
INSERT INTO player (id, name) VALUES (2, "狂徒");
INSERT INTO player VALUES (3, "某某", 1, 1, 1);
ALTER TABLE player MODIFY level INT DEFAULT 1;
INSERT INTO player (id, name) VALUES (4, "张三"), (5, "李四");
UPDATE player set level = 1 WHERE name = "狂徒";
UPDATE player set exp = 1 WHERE exp IS NULL;
SELECT * FROM player;
```

### 2.2 数据库的导入导出

- 导出数据库：`mysqldump -u root -p 数据库名 > 导出文件名.sql`
    - eg：`mysqldump -u root -p game > game.sql`
- 导入数据库：`mysql -u root -p 数据库名 < 导入文件名.sql`
    - eg：`mysql -u root -p game < game.sql`
    - 然后按照提示输入密码，完成后刷新`navicate`的mysql数据库即可看到导入的数据库

b站一个up主提供的数据库练习资源文件：
百度网盘：
https://pan.baidu.com/s/1shKNzVv0KViftFx51KATnw?pwd=qgpv 提取码: qgpv

### 2.3 数据库的常用语句

#### 2.3.1 范围查询

```sql
SELECT * FROM player WHERE level > 1 AND level < 5;
SELECT * FROM player WHERE level > 1 AND exp < 5;
SELECT * FROM player WHERE level > 1 AND level < 5 OR exp > 1 AND exp < 5;
SELECT * FROM player WHERE level IN (1,3,5);
SELECT * FROM player WHERE level BETWEEN 1 AND 10;
SELECT * FROM player WHERE level NOT BETWEEN 1 AND 10;
```

#### 2.3.2 模糊查询

模糊查询通过通配符`LIKE`关键字实现，`%`表示任意多个字符，`_`表示一个字符（`_`的个数和字符个数相同）

```sql
SELECT * FROM player WHERE name LIKE '王%';
SELECT * FROM player WHERE name LIKE '%王%';
SELECT * FROM player WHERE name LIKE '王_';
SELECT * FROM player WHERE name LIKE '王__';
```

#### 2.3.3 通配符匹配正则表达式

这里的通配符是`REGEXP`，`^`表示开头，`$`表示结尾，`.`表示任意一个字符，`*`表示0个或多个，`+`表示1个或多个，`?`表示0个或1个，`[]`表示匹配其中任意一个字符，`[^]`表示不匹配其中任意一个字符

<img src="matchTips.png" width="50%" height="50%">

```sql
SELECT * FROM player WHERE name REGEXP '^王.$';
SELECT * FROM player WHERE name REGEXP '王';
SELECT * FROM player WHERE name REGEXP '[王张]';
SELECT * FROM player WHERE name REGEXP '王|张';
```

练习题：


#### 2.3.4 排序查询

使用`ORDER BY`关键字，默认或者`ASC`表示升序，`DESC`表示降序

```sql
SELECT * FROM player ORDER BY level;
SELECT * FROM player ORDER BY level DESC;
```

练习题：
- 按照等级降序排列后，再根据经验升序排序：
    - `SELECT * FROM player ORDER BY level DESC, exp;`
- 按照第五列降序排列：
    - `SELECT * FROM player ORDER BY 5 DESC;`

#### 2.3.5 聚合函数

聚合函数是对一组**数据进行计算**的函数，常用的聚合函数有`COUNT`、`SUM`、`AVG`、`MAX`、`MIN`

<img src="aggregate.png" width="50%" height="50%">

```sql
SELECT COUNT(*) FROM player;
SELECT AVG(level) FROM player;
```

**count (*)、count(1)、count(字段名)的区别**：

在索引下count都不用回表

- `count(*)`：
  - count的值：相当于`count(0)`，会统计所有行数，包括`null`值
  - 性能：性能跟`count(1)`一样，都会优先len最短的二级索引，Ali要求尽量用`count(*)`
- `count(1)`：
  - count的值：会统计所有行数，包括`null`值
  - 性能：性能跟`count(*)`一样，都会优先len最短的二级索引，Ali要求尽量用`count(*)`
- `count(字段名)`：count的是该字段下非NULL的行数
  - `count (主键)`：由于主键都是非NULL的，所以`count(主键)`不用额外判断，性能比`count(其他字段)`好
  - `count(字段名)`：需要进行非NULL判断，性能最差


性能比较：**count(*) = count(1) > count(主键) > count(字段名)**

#### 2.3.6 分组查询

使用`GROUP BY`关键字对查询结果进行分组，`HAVING`关键字对分组后的结果进行过滤

```sql
SELECT sex, COUNT(*) FROM player GROUP BY sex;
SELECT level, COUNT(*) FROM player GROUP BY level;
SELECT level, COUNT(level) FROM player GROUP BY level HAVING COUNT(level)>4;
SELECT level, COUNT(level) FROM player GROUP BY level HAVING COUNT(level) > 4 ORDER BY level;
```

#### 2.3.7 去重查询

使用`DISTINCT`关键字对查询结果进行去重

```sql
SELECT DISTINCT sex FROM player;
```

#### 2.3.8 并集

使用`UNION`关键字对两个查询结果进行合并（UNION会默认去重，如果不想去重可以使用`UNION ALL`）

```sql
SELECT * FROM player WHERE exp BETWEEN 1 AND 3
UNION
SELECT * FROM player WHERE level BETWEEN 1 AND 3;

SELECT * FROM player WHERE exp BETWEEN 1 AND 3
UNION ALL
SELECT * FROM player WHERE level BETWEEN 1 AND 3;
```

#### 2.3.9 交集

使用`INTERSECT`关键字对两个查询结果进行交集运算

```sql
SELECT * FROM player WHERE exp BETWEEN 1 AND 3
INTERSECT
SELECT * FROM player WHERE level BETWEEN 1 AND 3;
```

#### 2.3.10 差集

使用`EXCEPT`关键字对两个查询结果进行差集运算

```sql
SELECT * FROM player WHERE exp BETWEEN 1 AND 3
EXCEPT
SELECT * FROM player WHERE level BETWEEN 1 AND 3;
```

### 2.4 子查询

子查询是指在**查询语句中嵌套查询语句**，子查询可以嵌套多层，子查询的结果可以是单行单列，也可以是多行多列

比如，我们需要查找表格中等级大于平均等级的玩家，那么我们可以根据下面的步骤进行：
- 先计算平均等级
    - `SELECT AVG(level) FROM player;`
- 然后再查询大于平均等级的玩家
    - `SELECT * FROM player WHERE level > (SELECT AVG(level) FROM player);`

接着，我们还想单独取出表格中`level`一列，并列出`每个玩家的等级-平均等级`的值作为单独一列，并给这一列取个别名为`diff`：

```sql
SELECT level, 
level-ROUND((SELECT AVG(level) FROM player)) AS diff
FROM player;
```

可以根据查询结果，将查询结果作为新表格（创建一个新表格或插入其它表格中）：

- 创建新表格：
    - `CREATE TABLE new_player (SELECT * FROM player WHERE level < 5);`
- 插入其它表格：
    - `INSERT INTO new_player (SELECT * FROM player WHERE level BETWEEN 7 AND 10); `

用`exists`关键字来判断**子查询结果**是否存在：

```sql
SELECT EXISTS (SELECT * FROM player WHERE level > 100);
SELECT EXISTS (SELECT * FROM player WHERE level > 20);
```

### 2.5 表关联

表关联是指**将多个表格的数据进行关联**，主要的关键词是`JOIN`，常用的关联方式有`INNER JOIN`、`LEFT JOIN`、`RIGHT JOIN`、`FULL JOIN`

#### 2.5.1 内连接

**内连接**（`INNER JOIN`）：只返回两个表格中满足条件的数据（只会显示匹配的数据）

```sql
SELECT * FROM player
INNER JOIN equip
ON player.id = equip.player_id;
```

<img src="innerJoin.png">

内连接方式可以用`WHERE`关键字来等同实现：

```sql
SELECT * FROM player p, equip e
WHERE p.id = e.player_id;
```

<img src="innerJoin2.png">

#### 2.5.2 左连接

**左连接**（`LEFT JOIN`）：返回**左表格**中**所有数据**+右表格中满足条件的数据（会返回左表所有的数据，右表中无匹配的数据则显示`NULL`）

```sql
SELECT * FROM player
LEFT JOIN equip
ON player.id = equip.player_id;
```

<img src="leftJoin.png">

#### 2.5.3 右连接

**右连接**（`RIGHT JOIN`）：返回**右表格**中**所有数据**，左表格中满足条件的数据（会返回右表所有的数据，左表中无匹配的数据则显示`NULL`）

```sql
SELECT * FROM player
RIGHT JOIN equip
ON player.id = equip.player_id;
```

<img src="rightJoin.png">

### 2.6 索引

索引是对数据库表格中**某列或多列的值进行排序**的一种结构，索引可以大大提高查询效率，如果没有索引，数据库会进行**全表扫描**，效率会很低（创建索引可以提高效率）

常用的索引有`UNIQUE`（唯一索引）、`FULLTEXT`（全文索引）、`SPATIAL`（空间索引）

创建索引的通用语法：

```sql
CREATE [UNIQUE|FULLTEXT|SPATIAL] INDEX 索引名 ON 表名(列名);
```

一般会对**主键字段**或者**常用于查询的字段**创建索引

- 查看表格当前含有的索引：`SHOW INDEX FROM 表名;`
    - `SHOW INDEX FROM npc;`
    - 可以看到主键`id`已经有了一个索引
- 创建索引：`CREATE INDEX 索引名 ON 表名(字段名);`
    - `CREATE INDEX name_index ON npc(name);`
    - 此时再查看索引，可以多了一个`name`字段的索引

比较有查询和无查询的效率：

将`npc`表格copy一份到`npc_slow`表格中：
- `CREATE TABLE npc_slow (SELECT * FROM npc);`
- 查询`npc_slow`表格中是没有任何索引的

此时对`npc`表格和`npc_slow`表格中的`id`字段进行查询观察区别

删除索引：`DROP INDEX 索引名 ON 表名;`

### 2.7 视图

视图是**虚拟的表格**，是一个**查询结果**的存储，包含了**行和列**。（视图不包含数据，只包含查询语句）。由于视图只包含查询语句，因此视图是**动态的**，会随着数据的改变而改变查询结果，每次查询视图时都会执行查询语句。

创建视图的通用语法：

```sql
CREATE VIEW 视图名 AS 查询语句;
```

比如我们想存一个`level`为top10的玩家视图：

```sql
CREATE VIEW top10
AS
SELECT * FROM player ORDER BY level DESC LIMIT 10;
```

然后就可以使用正常的查询语句来查询视图：

```sql
SELECT * FROM top10;
```

修改视图：`ALTER VIEW 视图名 AS 查询语句;`

```sql
ALTER VIEW top10
AS
SELECT * FROM player ORDER BY level LIMIT 10;
```

查看已有的视图：`SHOW TABLES;`

删除视图：`DROP VIEW 视图名;`

## 三、MySQL原理

### 3.1 事务

#### 3.1.1 事务的基础概念

事务是指**一组SQL语句**组成的**操作序列**，这组操作要么全部成功，要么全部失败，事务是数据库管理系统执行的**最小工作单位**。
- 如在银行操作中，A转账给B，要经过两个步骤：1. A账户减少金额；2. B账户增加金额。这两个步骤要么同时成功(commit)，要么同时失败(rollback全部回滚)。

事务的四个特性是ACID：**原子性**、**一致性**、**隔离性**、**持久性**

**1）原子性（atomicity）-基础**：事务是一个不可分割的工作单位（整体性），要么全部成功，要么全部失败，用**commit**来结束一个事务，由**事务回滚undo日志**来实现

**2）一致性（consistency）-约束条件**：事务执行前后，数据会从一个**语义合法状态**转换到另一个**语义合法状态**，即事务执行前后数据的**完整性约束**没有被破坏（满足现实中的约束）
  - 如：A有200元（合法），转帐300元出去变成-100元（不合法），这就是不一致的状态，所以必须定义约束就是余额大于等于0
  - 如：表中把name设置成唯一约束，但是由于事务提交或者回滚导致了重复的name，破坏了约束
  - 如：A转账100w给B，A扣除100w成功后，服务器宕机了，B没有收到100w，也破坏了完整性约束

**3）隔离性（isolation）-手段**：多个事务之间是相互隔离的，一个事务的执行不会影响其它事务，能够处理并发情况

隔离性四个级别：**读未提交**、**读已提交**、**可重复读（InnoDB默认的）**、**串行化**
- **脏读**：一个事务读取到另一个事务未提交的数据
  - 解决：通过**读已提交**级别来解决，保证一个事务内读到的数据起码是已经提交的数据
    <img src="dirty_read.png" width="50%">

- **不可重复读**：一个事务多次读取同一数据，得到两次读取的数据不一致（其他事务更改了该数据）

  <img src="non-repeating0.png" width="50%">  

  - 解决：通过**可重复读**级别来解决，保证一个事务内多次读的数据都是初始读的数据的**快照**
    <img src="non-repeating.png" width="50%">
- **幻读**：幻读是一个事务内多次查询某个符合查询条件的**记录数量**时会出现前后不一样的情况
  - 解决：通过**串行化**级别来解决，保证事务执行时不会有其他事务的干扰，但是并行能力会降低
    <img src="phantom-reads.png" width="50%">
- **串行化**：最高级别，事务串行执行，通过**锁**来实现
  - 如：当事务A对某一行数据进行操作且未提交时，事务B想查询该行数据时会**被阻塞**，直到事务A提交或回滚

**4）持久性**：事务一旦提交，对数据库的改变是永久性的，通过**日志（redo重做日志-系统崩溃后重做提交的事务，undo回滚日志）**来实现

四个特性的总结：

| 特性 |    特性得以保证的技术     |
| :---: |:----------------:|
| 原子性 |      undo回滚日志      |
| 一致性 |     原子+隔离+持久     |
| 隔离性 | MVCC多版本并发控制、加锁机制 |
| 持久性 |     redo重做日志     |

四个事务隔离级别的总结：

| 隔离级别 | 无脏读 | 无不可重复读 | 无幻读 |
|:-----|:---:|:------:|:---:|
| 读未提交 |     |        |     |
| 读已提交 |  √  |        |     |
| 可重复读 |  √  |    √   |     |
| 串行化  |  √  |    √   |  √  |

#### 3.1.2 事务的隔离级别

上面提到，事务在并发时有**脏读**、**不可重复读**、**幻读**的问题：

| 并发问题 |          说明          |                                 解决方法                                  |
| :---: |:--------------------:|:---------------------------------------------------------------------:|
| 脏读 |   读到其他事务**未提交的数据**   |                         读已提交：每条语句前创建一个**快照**                          |
| 不可重复读 | 一个事务内前后读的**数据**内容不一样 |                  可重复读：每个事务读到的数据都是初始读的数据的**快照**（MVCC）                  |
| 幻读 | 一个事务内前后读的**记录数量**不一样 | 串行化：事务串行执行，通过**select for update的next-key lock（行级锁+间隙锁）**来实现（读写冲突时锁住） |

**Read View在MVCC中的工作原理**

Read View快照中有四个字段：
- `creator_trx_id`：创建该快照的事务ID
- `m_ids`：创建快照时，所有**活跃且未提交的事务**ID
- `min_trx_id`：创建快照时，**活跃且未提交事务中的最小`m_ids`**，`trx_id<=min_trx_id`的事务都是当前快照可见的
- `max_trx_id`：创建快照时，当前数据库应该**给下一个事**务的ID

当对某种表进行操作时，会有两个隐藏列，字段为`trx_id`和`roll_pointer`
- `trx_id`是执行当前事务的事务ID
- `roll_pointer`是当前事务的回滚指针，指向一个**undo日志中的旧版本**

<img src="two-hidden-columns.png" width="50%">

结合上面快照的几个字段，可以将事务id区分为如下图所示：

<img src="trx-id.png" width="50%">

这种就是通过`trx_id`构成**版本链**控制并发事务对同一个记录的行为，这种叫做**多版本并发控制（MVCC）**


#### 3.1.3 事务的sql举例

- 开始事务：`START TRANSACTION;` 或 `BEGIN;`
- 提交事务：`COMMIT;`

```
USE sqlTest;

CREATE TABLE user(
name VARCHAR(15) PRIMARY KEY,
age INT
);

BEGIN;

SELECT COUNT(*) FROM user;

INSERT INTO user VALUES('akira', 19);
INSERT INTO user VALUES('yangnan', 18);

SELECT * FROM user WHERE name='akira';# 同一事务内可以查询到更改

SELECT COUNT(*)FROM user;

COMMIT;
```


### 3.2 锁

#### 3.2.1 锁的基础概念

并发情况下的加锁方案：
- 方案一：**读用MVCC，写用加锁**，读的可能是旧版本，但是性能更高
- 方案二：**读写都用加锁**，读写都是最新版本

##### 1）全局锁`READ LOCK`

整个数据库处于**只读**状态，适用于做**全库备份**

- 失效的操作：`INSERT`、`UPDATE`、`DELETE`、`ALTER`、`DROP`等(数据增删改、表结构变更)
- 加锁：`FLUSH TABLES WITH READ LOCK;`
- 解锁：`UNLOCK TABLES;`

##### 2）表级锁

读写锁：

- **表级读锁-读共享锁-S锁**：`LOCK TABLES table_name READ;`
  - 加读锁的作用是**防止其他事务对表进行写操作**，但是不阻止其他事务对表进行读操作
- **表级写锁-写独占锁-X锁**：`LOCK TABLES table_name WRITE;`
  - 加写锁的作用是防止其他事务对表进行**读写操作**

意向锁：意向锁与**行级锁**不冲突，表示有意向对表中的某些行加锁。正因为如此，意向锁并**不会影响到多个事务对不同数据行加排他锁时的并发性**

作用：意向锁的目的是为了快速判断表里是否有记录被加锁，从而避免了直接对表加锁，提高了并发性
- **意向共享锁-IS**：`select ... lock in share mode;`
  - 用于**表级锁**，表示**准备对表进行读操作**，但是不会立即加锁，只是表示**准备加锁**，如果有**写锁**则会等待
- **意向独占锁-IX**：`select ... for update;`
  - 用于**表级锁**，表示**准备对表进行写操作**，但是不会立即加锁，只是表示**准备加锁**

##### 3）行级锁

普通的`select`语句属于快照读，不会加锁，因此需要在查询语句中手动进行加锁

行级锁的实现语句也是`select ... for update;`，表示**对查询到的行加锁**，加完锁后其他事务就无法对加锁的行进行**更新/删除/插入**操作了

行级锁一般有三种，行级锁的加锁对象一般是**索引**：

- `Record Lock`：记录锁，锁住某一行（一条）数据
  - `select * from user where id=1 for update;`，其中id为主键
- `Gap Lock`：间隙锁，锁住某一行数据之间的间隙，区间是**前开后开**
  - 假设有一个范围为(3,5)的间隙锁区间，其他事务无法插入id=4的记录，可以有效**防止幻读**
- `Next-Key Lock`：行锁+间隙锁，锁住某一行数据和其之间的间隙，区间是**前开后闭**，在一些情况下会退化成**记录锁/间隙锁**
  - 假设有一个范围为(3,5]的间隙锁区间，其他事务无法插入id=4的记录，也无法修改id=5的记录
  - 假设`select * from user where id >= 15`则会锁住(15,+∞]的区间

#### 3.2.2 死锁的出现与解决

出现死锁的四个条件：**互斥、占有并等待、不可抢占、循环等待**

死锁的出现：事务1和事务2都在等对方释放锁

死锁的排查：`SHOW ENGINE INNODB STATUS;`，查看死锁日志

死锁的解决：
- **超时机制**：设置一个超时时间，如果超过这个时间还没有解锁，则自动解锁
- **死锁检测**：检测到死锁后，自动回滚一方的事务
- **尽量不要逆序加锁**

下面举一个逆序加锁的例子：

<img src="deadlock.png" width="80%">

### 3.3 约束

#### 1）主键约束：`PRIMARY KEY`
- 可以有一列或者多列组合但是必须是唯一组合，主键是表格中的**唯一标识**
- 一个表格只能有**一个主键**
- 主键**不能为`NULL`**

单一主键可以在创建该列时添加，也可以在`CREATE TABLE`的末尾添加：

```sql
CREATE TABLE users(
   user_id INT AUTO_INCREMENT PRIMARY KEY,
   username VARCHAR(40),
   password VARCHAR(255),
   email VARCHAR(255)
); 

CREATE TABLE users(
   user_id INT AUTO_INCREMENT,
   username VARCHAR(40),
   password VARCHAR(255),
   email VARCHAR(255),
   PRIMARY KEY(user_id)
); 
```

而多列主键只能在`CREATE TABLE`的末尾添加：

```sql
CREATE TABLE user_roles(
   user_id INT NOT NULL,
   role_id INT NOT NULL,
   PRIMARY KEY(user_id,role_id),
   FOREIGN KEY(user_id) REFERENCES users(user_id),
   FOREIGN KEY(role_id) REFERENCES roles(role_id)
); 
```

#### 2）外键约束：`FOREIGN KEY`

MySQL的外键约束用来在两个表数据之间建立链接，其中一张表的一个字段被另一张表中对应的字段约束。也就是说，设置外键约束至少要有两种表，被约束的表叫做从表（子表），另一张叫做主表（父表），属于主从关系。

关于保证表的完整性可以用以下例子说明：

假如有两种表，一张用户账户表（用于存储用户账户），一张是账户信息表（用于存储账户中的信息）。

1）我不小心将用户账户表中的某个用户删除了，那么账户信息表中与这个用户有关的数据就变成无源数据了，找不到其属于哪个用户账户，导致用户信息不完整。

2）我在账户信息表中随便添加了一条数据，而其在用户账户表中没有对应的用户，这样用户信息也是不完整的。

为了解决这个问题，我们可以在账户信息表中添加一个外键约束，这个外键约束指向用户账户表中的用户ID，这样就可以保证账户信息表中的数据是完整的。

```sql
CREATE TABLE users(
   user_id INT AUTO_INCREMENT PRIMARY KEY,
   username VARCHAR(40),
   password VARCHAR(255),
   email VARCHAR(255)
);

CREATE TABLE user_roles(
   user_id INT NOT NULL,
   role_id INT NOT NULL,
   PRIMARY KEY(user_id,role_id),
   FOREIGN KEY(user_id) REFERENCES users(user_id),
   FOREIGN KEY(role_id) REFERENCES roles(role_id)
); 
```

#### 3）唯一约束：`UNIQUE`

唯一约束保证了列中的所有数据是唯一的，但是可以有`NULL`值

唯一性约束同样可以对单列或者多列进行约束：

```sql
CREATE TABLE table_1(
   ...
   column_name_1 data_type,
   ...
   UNIQUE(column_name_1)
); 

CREATE TABLE table_1(
   ...
   column_name_1 data_type,
   column_name_2 data_type,
   ...
   UNIQUE(column_name_1,column_name_2)
); 
```

### 3.4 三大范式

**1）第一范式**：每一列都是不可再分的最小单元，即每一列都是原子的，不可再分

比如，我们在课程表中有一个`tags`字段，但是tags是多个标签组成的，不符合第一范式

解决：我们可以将`tags`字段拆分成多个字段，比如`tag1`、`tag2`、`tag3`等存在一个`tags`表中

这里就涉及表之间的**链接表**来实现，链接表通常是一个**多对多**的关系，包含两个表的`id`字段，比如`course_id`和`tag_id`

**2）第二范式**：表中的每一列都与主键相关，即表中的每一列都是完全依赖于主键的，而不是依赖于主键的一部分

第二范式要求如果某一列数据表示的内容不属于这个表的实体，那么这个列就应该独立出来，成为一个新的表，然后通过关联来连接这两个表

以下面的例子为例，如果name不单独作为一张表记录，那么当用户名更改时，所有name的记录都需要更改；且重复存储char会浪费空间

<img src="2NF.png" width="80%">

**3）第三范式**：表中的每一列都与主键直接相关，而不是间接相关

如一个表中有`invoice_total`、`payment_total`、`balance`三个字段

其中`balance`字段是通过`invoice_total`和`payment_total`计算得到的

那么`balance`字段就不符合第三范式，如果修改了`invoice_total`或者`payment_total`，那么`balance`字段忘记修改就会出现问题

解决：删掉`balance`字段

<img src="3NF.png" width="80%">

<img src="3NF_2.png" width="80%">

### 3.5 索引：O(logn)

```sql
ADD INDEX index_name (`age`);# 单一索引
ADD INDEX index_name (`age`, `name`);# 联合索引
```

**为什么要建立索引？**

如果没建立索引，那么查询数据时聚簇索引只有主键，因此其他字段的查询是**全表扫描**，时间复杂度是`O(n)`

而建立索引后，可以通过索引进行**二分查找**，时间复杂度是`O(logn)`

#### 3.5.1 B+树索引

**1）比较使用其他数据结构**

- 二叉查找树：解决了**插入和查找**问题，但是当所有插入的值都是最大值时会退化成**链表**，查询效率又退化成`O(n)`而非`O(logn)`;树的高度高，磁盘I/O次数多
- 平衡二叉树（如红黑树）：控制**左子树和右子树的高度差不能超过1**，解决链表退化问题，但是依然是二叉树（二叉树每个节点只能有左右两个子节点），高度依然很高
- B树：**每个子节点可以有M个节点**，降低了树的高度，但是每个节点**都会存所有数据**（不仅存索引值），浪费空间（B树查询时间比B+树短一些）
- B+树：**非叶子节点只存索引**，**叶子节点存所有数据，以有序链表的形式构成（InnoDB用双向链表）**，**叶子节点之间有指针相连**，降低了树的高度，减少了磁盘I/O次数；且相比B树，B+树有很多冗余节点，**插入、删除和范围查询（因为有有序的叶子节点链表）**更简单

**2）B+树的特点**

MySQL的数据（索引+记录）的存储是持久化在磁盘的，所以如果单纯靠磁盘读取查询的话速度很慢，通常需要将磁盘中的数据先读取到内存中，所以要求数据结构的树高度尽量低，这样可以减少磁盘I/O次数

索引通过**B+树**作为数据结构存储数据，能够快速定位到数据，**提高查询效率**。索引的原理是在**插入和更新**时会先对数据进行排序，因此会影响插入和更新的效率

B+树的特点：B+树比红黑树的排序效率高，他是**基于磁盘（磁盘页16K）的平衡树**，具有**通过增加宽度减少高度**的特点，减少磁盘I/O次数。且排序后的数据全部放在**叶子节点**上，非叶子节点只存储索引。

<img src="B+tree.png" width="80%">

**3）优化B+树的插入速度**

如果插入是**顺序插入**的话，B+树的插入速度会很高，因为顺序插入不会导致树的平衡性被破坏，只需要在叶子节点上插入即可（如果非顺序需要经历**分裂**、**旋转**等操作）

所以一般会用**自增id**等有顺序的值作为主键。

#### 3.5.2 索引的类型

##### 1）聚簇索引：只有一个

聚簇索引是一种**数据存储方式，是针对主键搭建的B+树**，中间节点存**主键值和页码**，叶子节点存**主键值+所有完整数据本身**，在InnoDB中不需要显示用`INDEX`创建索引，天然在创建含主键的表时就会生成，要求尽量用**自增id**作为主键

由于聚餐索引也是数据物理存储的方式，因此**一个表只有一个聚簇索引（这里也对应了一个表只能有一个主键）**，如果没有主键也没有唯一索引，Innodb会自动隐式定义一个

<img src="clustered-index.png" width="80%">

##### 2）二级索引（非聚簇索引）：可以有多个

二级索引的叶子节点存数据时只存储**索引值和主键值，而不是表中的所有数据，并按照索引值作为排序**，因此在查询时需要先通过二级索引找到主键值，再通过主键值找到数据（也就是**回表**），所以二级索引的查询效率比聚簇索引低

聚簇索引与二级索引的比较：聚簇索引查询速度更快（不用回表），但是插入、更新、删除速度慢（因为任何字段的更改都会影响到聚簇索引）

<img src="secondary-index.png" width="80%">

##### 3）联合索引：多个字段组合，可以有多个

联合索引根据从左到右的顺序建立，左边字段的排序优先于右边字段，联合索引的叶子节点存储的是**联合索引字段的值+主键值**，依然需要回表

<img src="union-index.png" width="80%">

**索引覆盖：**

如果**查询的字段在全部在联合索引叶子结点**中，那么可以直接通过索引找到数据，不需要回表，这种情况叫做**索引覆盖**

```sql
# 假设表中有字段：name、age、sex，联合索引为(age,sex)

# 1. 回表索引：选择的列联合索引不能完全包含，需要回表
SELECT * FROM player WHERE age = 12;
SELECT name FROM player WHERE age = 12;

# 2. 索引覆盖：选择的列联合索引完全包含，不需要回表
SELECT age FROM player WHERE age = 12;
SELECT age FROM player WHERE age = 12 AND sex = '男';
```

**最左匹配原则：**

如果查询条件中包含了**联合索引的前缀**，那么可以使用联合索引，否则无法使用

联合索引启用的时机：比如有字段`(name,age,sex)`组成的联合索引，最左的原则就是`name->age->sex`，当查询条件中包含`name`和`age`时（允许`name`和`age`的顺序可以颠倒），可以使用联合索引，但是如果只包含`age`和`sex`时，因为缺少最左的`name`字段，无法使用联合索引

<img src="left-match.png" width="80%">

##### 4）三种索引总结

| 索引类型 | 叶子节点存数据 | 查询效率 | 插删改效率 | 回表 |
| :---: |:---:|:----:|:-----:|:-:|
| 聚簇索引 | 主键值+所有数据 |  高   |  较低   | 无 |
| 二级索引 | 索引值+主键值 |  较低  |  高   | 覆盖查询无，否则有 |
| 联合索引 | 索引值+主键值 |  较低  |  高   | 覆盖查询无，否则有 |

#### 3.5.3 索引失效

当索引失效时会采用全表扫描，效率会降低

**1）模糊查询**

当使用模糊查询模糊查找后面的字符，如`like %xx`或者`like %xx%`而不是从开头第一个字符开始查询时，索引会失效

**2）表达式计算**

当查询条件中有表达式计算时，如`where age+1=12`，索引会失效

**3）数据类型隐式转换**

如`phoneNum`在表中用`varchar`存储，但是查询时用`int`类型，会导致索引失效

**4）联合索引非最左匹配**

#### 3.5.4 索引设计原则：用还是不用？

**1）什么情况下适合加索引**

- **主键**：主键是表的唯一标识，必须加索引
- **唯一性约束（区分度高的列）**：如学号具有唯一性，必须加索引来加快查询
- **频繁用于WHERE查询（特别是update、delete的WHERE查询）**：如果某个字段经常用于查询，可以加索引
- **经常用DISTINCT（去重）、GROUP BY**：相同的组成一组（相同的自然就排序会排一起）
- **经常用ORDER BY**：索引天生适合order排序
- **经常用于多表JOIN连接查询**：如外键`ON a.id=b.id`，可以对`id`加索引，这里跟`WHERE`的原因类似
- **字符串前缀创建索引**：如使用模糊查询`like 'xx%'`时，可以截取前面一段`xx`作为索引，加快查询
  - `ALTER table shop ADD INDEX address_index (address(10));`
  - 区分度原则：`select count(distinct a)/count(*) from shop;`计算区分度，一般超过30%就算比较高效的索引

**2）什么情况下不适合加索引**

- **在WHERE中使用不到的不用创造索引**
- **数据量小的表不需要加索引**：少于1000行的表不需要加索引（回表、索引占用磁盘等问题都会影响性能）
- **有大量数据重复的列，区分度不高的列不适合加索引**：如性别、是否等等
- **频繁更新的字段不适合加索引**：因为每次更新都会更新索引，影响性能(如用户余额不适合加索引)
- **经常更新的表不适合加索引**：因为每次更新都会更新索引，影响更新速度
- **不建议用无序的值作为索引**：因为B+树更适合升序排列，插入无序的值会破坏平衡，需要经常进行**分裂**、**旋转**等操作

#### 3.5.5 两千万数据需要多高的树

记：MySQL中，**1页=16KB；主键为bigint类型一般占8Bytes；页号一般为4Bytes**

**1）计算索引层两层存多少个索引**

- 第一层：
  - 每个索引包括：**索引值+页号**，即8+4=12Bytes
  - 一页可以存储：16KB/12Bytes=1333个索引
- 第二层：
  - 第一层中每个索引可以对应第二层的一页数据，即1333个索引对应1333个页
  - 1333个页可以存储：1333*1333=1776889个索引

**2）计算叶子节点层可以存储多少个实际数据**

叶子节点中，每个节点存储的数据为**一行数据**，假设一行数据为**1KB**，则一页可以存储**16KB/1KB=16行数据**

在第二层中的1776889个索引对应1776889个页，而每个索引对应一页叶子结点，也就是每个索引对应16行数据

所以总共可以存储**1776889*16=28430224行数据**

**3）总结**

因此两千万级别的数据需要树的高度为**3层**

#### 3.5.6 索引优化

**1）索引覆盖**

尽量通过**联合索引**覆盖所有要查询的字段，减少回表

**2）主键自增**

主键索引采用自增字段可以减少**页分裂，提高插入效率**

**3）删除不常用的索引**

通过`show index from table_name;`查看索引，删除不常用的索引

**4）减少索引失效**

在MySQL中，如果遇到字符串跟数字比较，**会把字符串自动转换成数字**再比较

- 情况一：索引的字段是字符串，查询条件误写成数字
  - 分析：由于触发**字符串自动转换成数字**，在该案例上**索引的值正好是字符串**，所以相当于该字段进行函数操作了，导致**索引失效**
- 情况二：索引的字段是数字，查询条件误写成字符串
  - 分析：由于触发**字符串自动转换成数字**，也就是将查询条件转换成数字，不影响索引字段，因此**索引有效**

### 3.6 日志

MySQL的操作是先写**日志**，再写**磁盘**，这样可以保证数据的**持久性**，即使数据库崩溃，也可以通过日志来恢复数据

- `undo log`记录的是**此次事务执行前**的数据状态
- `redo log`记录的是**此次事务执行后**的数据状态，用于重启后的回滚

#### 3.6.1 慢查询日志：用于优化

可以用于SQL语句优化的

**定位慢查询语句**

用于找到执行较慢的sql语句，在调优时手动打开慢查询日志（平时默认关闭，可以减少存慢查询日志的操作）

查看是否开启慢查询日志：`show variables like '%long_query_time%';`

开启慢查询日志：`set global long_query_time=1;`

查看慢查询日志的路径：`show variables like '%Slow_queries%';`

慢查询分析工具：`mysqldumpslow -a -s t -t 10 /var/log/mysql/mysql-slow.log`定位具体的查询语句，然后用`explain`和`show profile`查看执行计划并优化

**1）SQL语句优化**

- **减少磁盘I/O**：
  - 尽量**使用索引**，减少全表扫描
  - 通过二级索引查询时尽量使用**索引覆盖，也就是只查询索引包含的字段**，也可以给经常查询的字段添加**联合索引**增加字段，减少回表
- **减少内存消耗**：
  - **减少排序、分组等操作**，尽量**使用索引排序**
  - **减少事务持有锁的时间**（如先执行不加锁的查询语句，再执行加锁的更新语句）
- **分批处理、增加redis热词缓存、主从复制从库负责读（分担主库压力）**

**2）多表关联查询的优化：小表驱动大表**

左连接：

- 在`SELECT * FROM a LEFT JOIN b ON a.id=b.id`中的**被驱动表**`b`上的字段`id`加索引，可以加快查询速度
  - `CREATE INDEX idx_b_id ON b(id);`
- 设计多表连接时**ON**连接的两个**字段类型需要设计成相同**，否则会导致**索引失效**

内连接：只会返回两个表中**交集**的数据，随便哪个字段做索引都可以，有索引的表会自动成为**被驱动表**

**3）子查询优化：避免子查询**

子查询会建立**临时表**，而临时表**无法建立索引**，且**创建和销毁**临时表会消耗资源(CPU、IO)，所以尽量**避免子查询**

- 用**JOIN**代替子查询

```sql
# 任务：查询所有班长
# 子查询
SELECT * FORM student stu1
WHERE stu1.stuID IN (
    SELECT monitorID FROM class
    WHERE monitorID IS NOT NULL
);

# JOIN
SELECT stu.* FROM student stu LEFT JOIN class c
ON stu.stuID = c.monitorID
WHERE c.monitorID IS NOT NULL;
```

**4）排序优化：加索引(分组也类似)**

- 在**ORDER BY**的字段上加**索引**，索引本身就是有序的
- 尽量增加**limit**限制，减少排序的数据量
- `ORDER BY`的顺序满足**联合索引的最左匹配原则**，否则联合索引会失效

GROUP BY的优化：where效率高于having，所以尽量在where中过滤数据不用分组语句

**5）分页优化**

在执行`SELECT * FROM student LIMIT 2000000,10`时，会先查询出2000010条数据，然后再取出10条，这样会消耗大量的资源

解决思路：尽量往主键索引靠，减少回表浪费前面查询的资源

- `student`表中的`id`字段作为自增主键，然后`SELECT * FROM student WHERE id > 2000000 LIMIT 10`就不用再回表

#### 3.6.2 undolog回滚日志

undolog存在**Buffer Pool**中，也就是内存中，属于脏页数据，它的持久化是通过**redo log**来保证的

回滚日志是用于当**服务器崩溃或者事务回滚**时，通过执行**相反的操作**来恢复数据的日志。

比如事务中**删除一条数据**，那么回滚日志就会记录一条**插入**操作

同时通过回滚版本链可以在MVCC中用于创建某个旧版本的**快照**

`undo-log`中记录的是旧版本的数据并形成**数据版本链**：

<img src="undo-log.png" width="50%">

#### 3.6.3 redolog重做日志

不同于undolog，redo log是**磁盘**上的**物理日志**，用于**系统崩溃后重做提交的事务**，但是也是先写进**redo-log buffer**，再写进**磁盘**的

`redo log` 也是为了防止 `Buffer Pool` 中的脏页丢失而设计的(只记录未被刷盘的数据的物理日志)

由于`redo log`是顺序写，所以写的速度比实际数据随机落盘快，同时由于其对数据恢复很重要，所以他的刷盘时机也有讲究：

**1）内存中的redo log buffer刷盘时机**

- redo log内存buffer满了，会刷盘
- MySQL正常关闭
- 定时每`1s`刷盘一次
- 每次**事务提交**时刷盘

**2）磁盘中的redo log循环写**

`redo log`是**循环写进本地磁盘**的，写满会覆盖，所以`redo log`的大小是固定的，可以通过`innodb_log_file_size`来设置

循环写时`write pos`顺时针移动，当`write pos`追上`checkpoint`时就是满了，此时MySQL的所有操作都会被阻塞，通过`checkpoint`顺时针移动来实现擦除
- <img src="redo-log.png" width="50%">

其中**蓝色区域**代表数据还**未写进本地表数据文件**中，**红色区域**代表数据**已经落盘**

#### 3.6.4 binlog二进制日志

binlog是在事务提交后记录**表结构更新**和**数据更新**的日志，不记录**查询**的日志

相比`redo log`，`binlog`是**全量日志，写满会追加写**，而`redo log`是**循环写**，写满会覆盖

**1）binlog实现主从复制：实现读写分离**

实际中考虑I/O限制，一般会有**1主2~3从**的架构，并采用**异步复制**，即主库提交事务后不等待从库的返回，直接返回给客户端

- step1：MySQL提交事务请求给主库后，主库会先写`binlog`后再更新本地存储数据
- step2：然后`binlog`会发送复制给所有从库上写到`relay log`中继日志
- step3：从库读取`relay log`，然后写入本地`binlog`，再更新本地存储数据

<img src="binlog.png" width="70%">

**2）事务提交的两阶段提交**

原因：`redo log`和`binlog`的刷盘不能出现半成功，比如`redo log`刷盘更新了数据，`binlog`没刷盘，这样会导致数据不一致

解决：为了防止两份日志不一致，MySQL采用了两阶段提交**准备pre阶段**和**提交commit阶段**，由**协调者**和**参与者**共同完成

<img src="two-phase-commit.png" width="70%">

#### 3.6.5 三种日志的区别和关联

服务器宕机了怎么办？

- 在 redo log 刷新到磁盘之前，都是回滚（通过 undo log）
- 如果 redo log 刷新到了磁盘，那么就是重做 redo log

| 日志 |                  作用                  | 存储位置 |         是否持久化         | 是否可以恢复数据 |     层级     |
| :---: |:------------------------------------:|:----:|:---------------------:|:-:|:----------:|
| undo日志 |         实现**原子性**，用于MVCC和回滚          | 内存 | 否（持久化也是通过redo log保证的） | 是 | Innodb存储引擎 |
| redo日志 |    实现**持久性**，用于系统崩溃后重做提交的事务（循环写）     | 磁盘 |           是           | 是 | Innodb存储引擎 |
| binlog日志 | 用于**主从复制和数据备份**，记录所有的DDL和DML操作（全量日志） | 磁盘 |           是           | 是 |  server层   |

<img src="log.png" width="70%">


### 3.7 分库分表：路由和切片

MySQL的高可用性体现在：
- 主从复制下的读写分离
- 分库分表下的路由和切片
- 分布式事务下的分布式ID保证全局唯一

#### 3.7.1 使用MySQL分库分表中间件：适用于小业务

**TDSQL**：腾讯开源的分库分表中间件，支持**读写分离**、**分库分表**、**分布式事务**等功能，路由过程由中间件完成


#### 3.7.2 自定义分库分表的路由策略：切片

一般分库分表的路由策略有**取模**、**范围**、**一致性哈希**等方式实现切片

<img src="sharding.png" width="70%">

#### 3.7.3 分布式ID

**1）分布式ID具有的特点**

- **全局唯一**：必须保证生成的 ID 是全局性唯一的，这是分布式 ID 的基本要求；
- **有序性**：生成的 ID 需要按照某种规则有序，便于数据库的写入和排序操作；
- **可用性**：需要保证高并发下的可用性。除了对 ID 号码自身的要求，业务还对 ID 生成系统的可用性要求极高；如在asyncflow中拼接了表明，增加了task_id的可用性
- **自主性**：分布式环境下不依赖中心认证即可自行生成 ID；
- **安全性**：不暴露系统和业务的信息。在一些业务场景下，会需要 ID 无规则或者不规则。

**2）分布式ID生成方案**

分布式ID的生成一般都由**时间、机器ID、序列号**等组成，其中高位的时间戳保证和放在低位的自增序列号保证有序性，机器ID保证唯一性

- **UUID**
  - 优点：全局唯一、本地生成没有网络消耗
  - 缺点：无序、且占用空间大、有可能会暴露mac地址
- **雪花算法**：Twitter开源的分布式ID生成算法
  - 优点：可以保证高并发下的**唯一性**和**单机的有序递增性**
  - 缺点：强依赖于**机器时钟**，如果机器时钟回拨会导致ID重复


> 参考：
> 1. [事务隔离级别是怎么实现的？](https://xiaolincoding.com/mysql/transaction/mvcc.html)
> 2. [08 索引：排序的艺术](https://learn.lianglianglee.com/%E4%B8%93%E6%A0%8F/MySQL%E5%AE%9E%E6%88%98%E5%AE%9D%E5%85%B8/08%20%20%E7%B4%A2%E5%BC%95%EF%BC%9A%E6%8E%92%E5%BA%8F%E7%9A%84%E8%89%BA%E6%9C%AF.md)
> 3. [为什么 MySQL 采用 B+ 树作为索引？](https://xiaolincoding.com/mysql/index/why_index_chose_bpuls_tree.html#%E6%80%8E%E6%A0%B7%E7%9A%84%E7%B4%A2%E5%BC%95%E7%9A%84%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E6%98%AF%E5%A5%BD%E7%9A%84)
> 4. [MySQL 日志：undo log、redo log、binlog 有什么用？](https://xiaolincoding.com/mysql/log/how_update.html#%E4%B8%BA%E4%BB%80%E4%B9%88%E9%9C%80%E8%A6%81-undo-log)
> 5. [分布式唯一 ID 生成方案浅谈](https://zhuanlan.zhihu.com/p/534893180)