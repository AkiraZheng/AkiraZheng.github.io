---
title: 'WebServer学习2：从Config文件了解Makefile编译'
date: 2024-03-03 21:31:40
tags:
categories:
  - WebServer项目（C++）
---

## 一、C++终端编译的命令行解析

### 1. int main(int argc, char *argv[])

- argc：命令行参数的个数
- argv：命令行参数的数组
    - argv[0]：程序名
    - argv[1]：第一个参数

### 2. getopt()函数

- 作用：自动从命令行参数中获取选项
- 头文件：#include <unistd.h>
- 函数原型：int getopt(int argc, char * const argv[], const char *optstring);
    - argc：命令行参数的个数
    - argv：命令行参数的数组
    - optstring：选项字符串
        - 选项字符串说明: "p:l:m:o:s:t:ca::"
            - p: 表示选项p后面必须跟一个参数
            - c  表示选项c后面不可以跟参数
            - a::表示选项a后面可以跟一个参数，也可以不跟参数
    - optarg：是一个全局变量，指向`当前选项的参数值`
        - 例如：-p 8080，optarg指向`当前选项p`的参数值，即`8080`

### 3. 代码示例
- config.h文件
```cpp
#ifndef CONFIG_H
#define CONFIG_H

#include <stdio.h>
#include <string>
#include <iostream>
#include <unistd.h> //getopt

using namespace std;

class Config{
public:
    Config();
    ~Config(){};

    void parse_arg(int argc, char *argv[]);//实现命令行参数解析

    //端口号
    int PORT;

    //日志写入方式:0同步 1异步
    int LOGWrite;

    //触发组合模式listenfd LT：0 ET：1
    int TRIGMode;

    //listenfd触发模式
    int LISTENTrigmode;

    //connfd触发模式
    int CONNTrigmode;

    //优雅关闭连接
    int OPT_LINGER;

    //数据库连接池数量
    int sql_num;

    //线程池内的线程数量
    int thread_num;

    //是否关闭日志
    int close_log;

    //并发模型选择:Reactor/Proactor
    int actor_model;
};

#endif
```
- config.cpp文件
```cpp
#include "config.h"

Config::Config(){
    //构造函数,初始化默认参数

    //端口号,默认6666
    PORT = 6666;

    //日志写入方式,默认同步
    LOGWrite = 0;

    //server listen和conn的I/O复用组合触发模式
    //默认listenfd LT + connfd LT(LT是水平触发)
    TRIGMode = 0;

    //listenfd触发模式,默认LT
    LISTENTrigmode = 0;

    //connfd触发模式,默认LT
    CONNTrigmode = 0;

    //优雅关闭连接,默认不使用
    OPT_LINGER = 0;

    //数据库连接池数量(数据库线程池),默认8
    sql_num = 8;

    //线程池内的线程数量,默认8,这个参数可以根据服务器的负载情况进行调整
    thread_num = 8;

    //是否关闭日志,默认不关闭
    close_log = 0;

    //并发模型选择,默认proactor
    actor_model = 0;
}

void Config::parse_arg(int argc, char* argv[]){
    //argc是参数个数(至少为1);argv是参数数组,argv[0]是程序名
    int opt;//用于保存getopt的返回值
    const char*str = "p:l:m:o:s:t:c:a:";//选项字符串,每个选项后面的冒号表示该选项后面需要接一个参数
    while ((opt=getopt(argc, argv, str)) != -1){
        //getopt是个迭代器,每次取出一个选项,并将选项对应的参数赋值给全局变量optarg
        switch (opt){
        case 'p':{
            PORT = atoi(optarg);
            // cout << "PORT = " << PORT << endl;
            break;
        }
        case 'l':{
            LOGWrite = atoi(optarg);
            break;
        }
        case 'm':{
            TRIGMode = atoi(optarg);
            break;
        }
        case 'o':{
            OPT_LINGER = atoi(optarg);
            break;
        }
        case 's':{
            sql_num = atoi(optarg);
            break;
        }
        case 't':{
            thread_num = atoi(optarg);
            break;
        }
        case 'c':{
            close_log = atoi(optarg);
            break;
        }
        case 'a':{
            actor_model = atoi(optarg);
            break;
        }
        default:
            break;
        }
    }
}
```
- main.cpp文件
```cpp
#include "config.h"
int main(int argc, char *argv[]){
    //mySql配置
    string user = "debian-sys-maint";
    string password = "AwGW2dQW8v5oJQk0";
    string database = "akiradb";

    // //命令行解析
    Config config;//配置参数只在程序启动时使用一次
    config.parse_arg(argc, argv);

    return 0;
}
```

- task.json文件
```json
{
    "tasks": [
        {
            "type": "cppbuild",
            "label": "C/C++: g++ 生成活动文件",
            "command": "/usr/bin/g++",
            "args": [
                "-fdiagnostics-color=always",
                "-g",
                "${file}",
                "${fileDirname}/config.cpp",//需要某个文件的路径，可以直接写路径，也可以用${fileDirname}来获取当前文件的路径
                // "${fileDirname}/*.cpp",//写c++把 *.c 换成 *.cpp；linux中使用 / 来分割，windows中使用 \ 来分割。试过了没用
                "-o",
                "${fileDirname}/${fileBasenameNoExtension}"
            ],
            "options": {
                "cwd": "${fileDirname}"
            },
            "problemMatcher": [
                "$gcc"
            ],
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "detail": "调试器生成的任务。"
        }
    ],
    "version": "2.0.0"
}
```

- launch.json文件
```json
{
    // 使用 IntelliSense 了解相关属性。 
    // 悬停以查看现有属性的描述。
    // 欲了解更多信息，请访问: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "name": "(gdb) 启动",
            "type": "cppdbg",
            "request": "launch",
            "program": "${fileDirname}/${fileBasenameNoExtension}",
            "args": ["arg1", "arg2", "arg3"],
            "stopAtEntry": false,
            "cwd": "${fileDirname}",
            "environment": [],
            "externalConsole": false,
            "MIMode": "gdb",
            "setupCommands": [
                {
                    "description": "为 gdb 启用整齐打印",
                    "text": "-enable-pretty-printing",
                    "ignoreFailures": true
                },
                {
                    "description": "将反汇编风格设置为 Intel",
                    "text": "-gdb-set disassembly-flavor intel",
                    "ignoreFailures": true
                }
            ]
        }

    ]
}
```

## 二、在Linux+VSCode环境下编译C++程序
### 1. 通过配置.json文件实现编译(多文件编译)

由于当前是多文件编译,所以如果使用系统默认的`tasks.json`文件,直接编译运行会报错

<img src="run_error.png">

从报错中我们可以看到,显示的是没有定义构造函数`Config::Config()`,也没有定义`Config::parse_arg`函数,但是我们明明已经在.cpp中实现了

所以可以初步判断是编译的时候没有链接到.cpp文件.所以肯定是`tasks.json`文件的问题,需要实现多文件编译的配置

- 修改tasks.json文件

<img src="change_task_json.png">

此时修改完就发现可以正常编译了,我们先运行生成可执行文件,然后在终端输入解析参数来测试

<img src="json_test.png">

但是我们会发现每写一个.cpp文件都需要在`tasks.json`文件中添加一次,这样非常麻烦,所以我们可以使用`Makefile`文件来实现多文件编译

### 2. 通过Makefile文件实现编译(多文件编译)

### 2.1 从终端g++编译`.o`文件开始
- 一次性编译所有的.cpp文件

```shell
# 生成可执行文件
g++ main.cpp config.cpp -o main

# 运行
./main -p 100

# 查看当前目录下的文件
ls
```

<img src="makefile_shell1.png">

这种编译方式有个缺点,就是每次修改了一个.cpp文件,就需要重新编译所有的.cpp文件,而且随着项目体量增大,需要在终端写的.cpp文件也越来越多

- 优化一下,通过单独编译每个.cpp文件,然后再链接成可执行文件

```shell
# 生成单个.o文件
g++ config.cpp -c
g++ main.cpp -c

# 链接所有.o文件成可执行文件
g++ *.o -o main

# 查看当前目录下的文件
ll

# 删除所有.o文件
rm *.o
```

<img src="makefile_shell2.png">

然后修改了某个文件后,单独编译修改的那个文件后直接链接就行,不需要重新编译所有的.cpp文件,但是这样还是不够优雅,每次编译都要自己手动写重复的命令,所以我们可以使用`Makefile`文件来实现多文件编译

### 2.2 通过Makefile文件实现多文件编译

参考[Makefile教程](https://www.bilibili.com/video/BV188411L7d2/?spm_id_from=333.788.recommend_more_video.0&vd_source=fa61c94b4d0a0af186e3cb794e46eea9)

- 第一个版本:简单将刚刚终端的命令写入Makefile文件

```makefile
## Version 1
test: main.cpp config.cpp
	g++ -o test main.cpp config.cpp
```

在终端输入`make`命令,就会自动编译了

<img src="makefile_shell3.png">

- 第二个版本:优化一下,通过变量来定义文件名和编译器

```makefile
## Version 2
CXX = g++
TARGET = test
OBJS = main.o config.o

$(TARGET): $(OBJS)
	$(CXX) -o $(TARGET) $(OBJS)

main.o: main.cpp
	$(CXX) -c main.cpp

config.o: config.cpp
	$(CXX) -c config.cpp
```

在终端输入`make`命令,就会自动编译了

<img src="makefile_shell4.png">

- 第三个版本:简化生成规则

```makefile
## Version 3
CXX = g++
TARGET = test
OBJS = main.o config.o

## 编译选项 -c 表示编译链接分开进行 -Wall 表示显示所有警告信息
CXXFLAGS = -c -Wall

$(TARGET): $(OBJS)
	$(CXX) -o $@ $^

# 简化所有的.o文件的生成规则
%.o: %.cpp
	$(CXX) $(CXXFLAGS) $< -o $@

.PHONY: clean
clean:
	rm -f *.o $(TARGET)
```

在终端输入`make`命令,就会自动编译了,执行`make clean`命令,就会自动删除所有的.o文件和可执行文件

<img src="makefile_shell5.png">

第三个版本在有新的文件需要编译时,直接在`OBJS`处添加新的文件名就行,不需要再添加新的生成规则,非常方便

- 第四个版本:

```makefile
## Version 4
CXX = g++
TARGET = test
# 自动实现把当前目录下的所有.cpp文件转换成.o文件
SRC = $(wildcard *.cpp)
# 当目录下还有timer文件夹,取消注释下面的代码,可以将timer文件夹下的所有.cpp文件加入到SRC中
#SRC += $(wildcard timer/*.cpp)
OBJS = $(patsubst %.cpp, %.o, $(SRC))

# 编译选项 -c 表示编译链接分开进行 -Wall 表示显示所有警告信息
CXXFLAGS = -c -Wall

$(TARGET): $(OBJS)
	$(CXX) -o $@ $^

# 简化所有的.o文件的生成规则
%.o: %.cpp
	$(CXX) $(CXXFLAGS) $< -o $@

.PHONY: clean
clean:
	rm -f *.o $(TARGET)
```

<img src="makefile_shell6.png">

第四个版本就可以实现自动编译当前目录下的所有.cpp文件,当有新的文件时都不用重新修改Makefile文件

## 三、在Linux下使用gdb调试C++程序

未完待续......

## 四、总结

本文主要是讲解了C++终端编译的命令行解析

然后通过配置.json文件实现编译(多文件编译)

最后通过Makefile文件实现编译(多文件编译)

并且通过四个版本的Makefile文件来由浅入深实现编译(多文件编译)

所有编译问题都解决了,接下来我们就开始从socket和epool实现I/O复用通信开始学习WebServer项目的代码：[WebServer学习3：socket编程与epoll实现I/O复用](https://akirazheng.github.io/2024/03/04/WebServer%E5%AD%A6%E4%B9%A03%EF%BC%9Asocket%E7%BC%96%E7%A8%8B%E4%B8%8Eepoll%E5%AE%9E%E7%8E%B0I-O%E5%A4%8D%E7%94%A8/)