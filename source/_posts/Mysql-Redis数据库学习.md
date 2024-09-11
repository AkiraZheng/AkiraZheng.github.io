---
title: Mysql-Redis数据库学习
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