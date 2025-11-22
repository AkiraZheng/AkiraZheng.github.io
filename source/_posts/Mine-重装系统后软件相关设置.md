---
title: Mine-重装系统后软件相关设置
date: 2022-12-04 21:18:14
tags: 环境配置
categories:
- 重装-环境配置-计算机
---

# 一、Zotero设置

## 1.1 恢复文献数据

- 首先拷贝Zotero中**存放Data的路径**中的所有内容到新电脑中（如果是重装系统可忽略），如本人存放于`E:\zotero files`，需要将该目录下的所有文件拷贝一份

	<img src="papers_local_zotero.png" width="50%" heigh="50%">

- 然后打开新下载的zotero软件，依次点击：`编辑(E)`->`首选项(N)`->`高级`->`文件和文件夹`

- 点击`数据存储位置`的`自定义`选项，填入第一步Data的路径后点击`OK`，如本人存放于`E:\zotero files`

	<img src='optional.png' width='50%' heigh='50%'>

- 最后重启zotero软件

## 1.2 安装插件

- 插件安装方式

	- 1. 先下载相关插件的`.spi`文件
	- 2. 在zotero软件中点击`工具(T)`->`插件`->`小齿轮`->`Install Add-on from file...`->`选择对应.spi文件`->`Install now`->`重启`

	<img src='zotero_extensions1.png' width='50%' heigh='50%'>
	<img src='zotero_extensions_installnow.png' width='50%' heigh='50%'>

- [zotero](https://zotero-chinese.gitee.io/zotero-plugins/#/)插件镜像网站

- [jasminum](https://github.com/l0o0/jasminum/releases)插件用于中文文献条目的自动抓取

	- 可通过github链接或搜索：https://github.com/l0o0/jasminum/releases

- [pdf-translate](https://github.com/windingwind/zotero-pdf-translate/releases/tag/v0.9.4)插件用于pdf便捷翻译

	- 可通过github链接或搜索：https://github.com/windingwind/zotero-pdf-translate/releases/tag/v2.0.3

# 二、浏览器设置

## 2.1 开启实时字幕翻译功能

- 谷歌：`设置`->`无障碍`->`实时字幕`
- Edge：`设置`->`辅助功能`->`实时字幕`（Edge102有该功能，Edge103没有）

## 2.2 安装插件

# 三、遇到软件无法被搜索到的情况

如`everything`软件无法搜索到

- 先在桌面对软件建立桌面快捷键

- 将快捷方式复制到`C:\ProgramData\Microsoft\Windows\Start Menu\Programs`

参考自：https://blog.csdn.net/qq_40579464/article/details/105342847

# 四、QT安装

## 4.1 配置MSVC（参考“QT编程经验”文章的配置方法）

## 4.2 安装QT Creator5.12.6版本
参考：https://blog.csdn.net/qq_41453285/article/details/89853671

## 4.3 配置MySQL
参考：https://subingwen.cn/qt/sql-driver/ & https://zhuanlan.zhihu.com/p/188416607

	- LIBS += "D:\Project\Wireless_communication_software\mysql_v8.0.32\MySQL Server 8.0\lib\libmysql.lib"
	- INCLUDEPATH += "D:\Project\Wireless_communication_software\mysql_v8.0.32\MySQL Server 8.0\include"
	- DEPENDPATH += "D:\Project\Wireless_communication_software\mysql_v8.0.32\MySQL Server 8.0\include"

## 4.4 Nivicate破解版安装

- [NavicatPremium16破解](https://www.cnblogs.com/kkdaj/p/16260681.html)

# 五、Vscode相关编译器配置

<img src=2025-11-23-00-36-18.png>

<img src=2025-11-23-00-36-40.png>

<img src=2025-11-23-00-36-59.png>



## 5.1 C/C++配置

- 参考：[用vscode优雅配置c/c++环境！](https://zhuanlan.zhihu.com/p/610895870)
	- 下载好vscode后从`3`部分下载MinGW开始进行配置
	- [MinGW下载安装](https://blog.csdn.net/woxingzou/article/details/113746142）：https://pan.baidu.com/s/1ylj4YG7CBtv4C_RtVEtZ9Q) 验证码：ftk5
- 下载完MinGW后，配置VScode的部分参考[VSCode配置C/C++环境](https://zhuanlan.zhihu.com/p/87864677)的第`3`部分
- C++在vscode中运行是否每次都需要配置环境：https://www.zhihu.com/question/456362523

## 5.2 Vscode中配置Keil

- 参考：(VS Code编写Keil uVison 5工程)[https://blog.csdn.net/weixin_43576926/article/details/107736692]

## 5.3 配置 paste image 插件

# 六、JetBrains全家桶
## 6.1 CLion配置C++

> [MacOS 配置Clion的C/C++环境的详细步骤及mac终端报错问题解决](https://blog.csdn.net/weixin_45571585/article/details/126977413)