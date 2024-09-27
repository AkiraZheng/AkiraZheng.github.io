---
title: 部署colab利用GPU资源训练深度学习模型
date: 2022-03-13 16:03:00
tags: 
- 环境配置
- 深度学习
---

# 前言

深度学习模型需要GPU加持提高训练速度，但是目前GPU和许多云端租借的GPU价格昂贵，因此本文将用谷歌团队的colab实现免费GPU的使用，满足深度学习的个人学习需求

# 以下链接为部署原文

参考网站： [Colab基本使用方法及配置](https://blog.csdn.net/u011119817/article/details/108519389)

# 目前所用到的代码功能

1、查看GPU资源
	
<font color=white>
	
	# 查看GPU资源
	!nvidia-smi

</font>

2、连接谷歌云端硬盘

<font color=white>
	
	# 连接谷歌云端硬盘
	from google.colab import drive
	drive.mount('/content/drive')

</font>

3、查看库版本

<font color=white>
	
	# 查看版本
	import scipy
	scipy.__version__

</font>

4、 pip安装库

<font color=white>
	
	# pip安装库
	!pip install scipy==1.2.1

</font>

5、运行代码-训练模型

<font color=white>
	
	# 运行代码
	import os
	path = "/content/drive/MyDrive/srcnn-tensorflow-image-master" 
	os.chdir(path)
	os.listdir(path)
	!python main.py

</font>

6、部署github项目到colab

> [参考链接](https://blog.csdn.net/weixin_47306605/article/details/123921943?utm_medium=distribute.pc_relevant.none-task-blog-2~default~baidujs_baidulandingword~default-0-123921943-blog-121534768.235^v43^control&spm=1001.2101.3001.4242.1&utm_relevant_index=3)

# 解决Colab每12h断连的问题

每60分钟自动运行代码刷新，解除90分钟断开限制.

使用方法：colab页面按下 **F12**或者 Ctrl+Shift+I (mac按 Option+Command+I) 在**console（控制台）**输入以下代码并回车.

**复制以下代码粘贴在浏览器console！！不要关闭浏览器以免失效**

	function ClickConnect(){
	  colab.config
	  console.log("Connnect Clicked - Start"); 
	  document.querySelector("#top-toolbar > colab-connect-button").shadowRoot.querySelector("#connect").click();
	  console.log("Connnect Clicked - End");
	};
	setInterval(ClickConnect, 60000)
