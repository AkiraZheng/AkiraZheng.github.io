---
title: VScode+Anaconda+Pycharm+JDK的Python和Java环境配置
date: 2022-02-03 15:55:09
tags: 环境配置
categories:
- 重装-环境配置-计算机
---

# 一、Python部分

## 1.1 首先安装Anaconda

Anaconda包含Python环境，可以建立管理多个不同版本的Python环境，安装它后就默认安装了python、IPython、集成开发环境Spyder和众多的包和模块，让你在管理环境和包时更加方便。

- 从官网中下载Anaconda的exe文件

- 安装过程中注意勾选**Alls Users**和**Add Anaconda to the system PATH environment variable**，便于以后不用再配置路径

## 1.2 安装VScode

我这里直接用Anaconda进行VScode下载

- 运行Anaconda Navigator后，点击VS Code位置下方的Install直接进行下载（由于我已经下载过了，因此按钮变成了Launch，没下载过的话按钮显示的是Install）
	
	<img src="1.png" width="80%" height="80%">

## 1.3 VScode中配置Python环境

- 安装Python插件

	<img src="2.png" width="80%" height="80%">

- 安装Code Runner插件

	<img src="3.png" width="80%" height="80%">

- 安装中文插件

	<img src="4.png" width="80%" height="80%">

- 安装python函数快速注释插件`autoDocstring`

	- 使用方法：输入`"""`后回车

此时运行.py代码可以正常运行了，VScode中Pyhon环境搭建完毕

VScode中Pyhon环境搭建参考文章：[Anaconda + VSCode 最详细教程](https://zoyi14.smartapps.cn/pages/note/index?origin=share&slug=ef1ae10ba950&_swebfr=1&_swebFromHost=baiduboxapp)

## 1.4 Pycharm中配置Python环境

- Pycahrm需要在**settings**中跟conda的解析器关联起来

	<img src="5.png" width="60%" height="60%">

- 点击**Project Interpreter**，点击右方的锯齿轮后点击**Add**,点击**Conda Environment**和右边的**Existing environment**，一路点OK即可

	<img src="6.png" width="100%" height="100%">

	<img src="7.png" width="100%" height="100%">



# 二、Java部分

## 2.1 安装JDK

- 若有安装过Java，则首先在控制面板中卸载以前版本的Java

- 到[甲骨文的官网中下载JDK](https://www.oracle.com/java/technologies/downloads/#java11)，我这里选择的是JDK11，直接下载exe文件

	<img src="8.png" width="80%" height="80%">

- 双击下载的exe文件一路无脑安转(只需要更改并记住安装路径)

## 2.2 配置Java环境

- 我的电脑处右键点击属性，找到并点击高级系统设置，点击环境变量
	
	<img src="9.png" width="50%" height="50%">
	
	<img src="10.png" width="60%" height="60%">
	
	<img src="11.png" width="60%" height="60%">

- 在系统变量(S)中点击新建

	- 设置JAVA_HOME：Name: `JAVA_HOME`，Value: `你java的安装路径,bin文件夹所在的那个文件夹的路径`

	<img src="12.png" width="80%" height="80%">

	- 双击系统变量(S)中的Path，添加两个变量`%JAVA_HOME%\bin`和`%JAVA_HOME%\jre\bin`

	<img src="13.png" width="80%" height="80%">

	- 一路点确定即可

## 2.3 VScode中配置Java

- 打开VScode安转Java插件`Extension Pack for Java`
	
	<img src="14.png" width="80%" height="80%">

- 在设置中找到并打开settings.json文件，添加语句`"java.home": "你java的安装路径,bin文件夹所在的那个文件夹的路径",`

	<img src="15.png" width="40%" height="40%">

	<img src="16.png" width="50%" height="50%">
	
	<img src="17.png" width="100%" height="100%">

此时运行.java代码可以正常运行了，VScode中Java环境搭建完毕

VScode中Java环境搭建参考视频：[保姆级Java环境配置与VSCode配置](https://www.bilibili.com/video/BV16y4y177b9?from=search&seid=14977310378351523965&spm_id_from=333.337.0.0)