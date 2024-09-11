---
title: 搭建Conda虚拟环境
date: 2022-04-12 15:58:04
tags: 环境配置
categories:
- 重装-环境配置-计算机
---

# 前言

> 编写这篇博客的目的是在学习李沐老师的《动手学深度学习》课程、或者自学其它python编程内容时，需要用到的python环境各不相同

> 为了方便学习，还是需要创建多个不同的Conda环境进行区分

> 本文的命令内容是基于Windows10系统的，Linux系统的后续有机会继续更新



# Conda中的常用指令

一般有**Conda前缀**的指令都是针对**所有环境**进行操作的，或者说是在主环境中操作的

如果需要在当前的**自定义Conda虚拟环境**中执行安装或者查看指令时，**不需要加Conda前缀**


## Conda前缀的指令

- 查看安装包

	`conda list`

- 查看当前存在的Conda虚拟环境

	`conda env list `

	`conda info -e`

- 更新当前Conda

	`conda update conda`

- 创建Python虚拟环境
	
	`conda create -n your_env_name python=x.x`

	其中**your_env_name**为所起的环境名，**x.x**为python版本号，创建的环境可以在Anaconda安装目录的envs文件中找到。

	如在创建Pytorch深度学习环境时可以输入：

	`conda create -n d2l_Pytorch python=3.8`

- 激活、关闭、删除虚拟环境

	激活或者切换虚拟环境：

	`activate your_env_name`

	关闭虚拟环境切回Root环境:

	`activate root`

	删除虚拟环境：

	`conda remove -n your_env_name --all`

## 自定义虚拟环境内的指令

**以下指令均在已经切换到对应环境的情况下**进行输入，如下所示表示已经切换到**d2l_Pytorch**环境：

<img src='Conda-envs.png'>

- 检查Python版本（CMD中输入）

	`python --version`

- 查看环境中已有的安装包

	`pip list`

- 安装虚拟环境中对于版本的包

	`pip install package_name==x.x`	

	其中**x.x**代表包对应的版本号，如下所示：

<img src='pip-install-package.png'>

- 删除环境中的某个包

	`pip uninstall  package_name`




