---
title: SolveProgramLearningProblem
date: 2022-12-08 16:26:26
tags: 杂货铺-休闲
---

# 一、Python

## 1.1 In VScode

根据python的文件路径问题，其相对路径是从当前文件夹开始的，而不是从.py文件对应的文件夹开始的

- 若有文件如下所示

<img src='python_vscode_setpath1.png' width='%50' height='%50'>

- 想在`q_learning_agent.py`代码中调用`rectangle.png`文件

- 在`q_learning_agent.py`代码中相对路径应从最外层的文件夹开始写，也就是写成当前文件夹`./`而不是上一层文件夹`../`

	- 正确写法：`imgpath="./img/rectangle.png"`，该写法的相对路径是从最外层文件夹开始的

		<img src='python_vscode_setpath3.png' width='%50' height='%50'>

	- 错误写法：`imgpath="../img/rectangle.png"`，该写法认为相对路径是从`Q-learning`文件夹开始的

		<img src='python_vscode_setpath4.png' width='%50' height='%50'>


# 二、Git使用

## 2.1 git指令下载开源项目到本地

- 先下载`Git for windows`软件

- 在本地盘中右键点击`Git Bash Here`

- 进行基础配置，告诉git你是谁

	- git config --global user.name "你的名字或昵称"
		- 如：AkiraZheng
	- git config --global user.email "你的邮箱"
		- 如：1428384878@qq.com

- 克隆项目

	- git clone 项目地址
		- 其中项目地址是github项目`code`中的`http`链接, 项目地址形式为:https://gitee.com/xxx/xxx.git或者 git@gitee.com:xxx/xxx.git
	- 在弹出的窗口输入你的github账号密码信息
		- 如果没弹出窗口则先输入`git config --system --unset credential.helper`再重新执行`git clone`指令

## 2.2 在Linux下使用git上传项目

- [参考](https://blog.csdn.net/qq_32348883/article/details/123035279)

### 2.2.1 将本地项目push到远程仓库的main分支中

- 1.进入项目文件夹

	- `cd 项目文件夹`
- 2.将项目上传到服务器

```shell
cd existing_repo
git remote add origin git@github.com:AkiraZheng/MyWebServer.git
git branch -M main
git push -uf origin main
```

- 3. 添加readme文件

```shell
touch README.md
git add README.md
git commit -m "添加 README"
git push -u origin main
```

### 2.2.2 常用指令

- 查看当前远程仓库地址

	- `git remote -v`

- 删除远程仓库地址

	- `git remote rm origin`
	- `git remote -v`

- 添加远程仓库地址

	- `git remote add origin git@github.com:AkiraZheng/MyWebServer.git`

- 将当前文件夹添加到新分支

	- `git branch -M master`

- 将当前文件夹上传到远程仓库的master分支

	- `git push -u origin master`

- 删除某个分支

	- `git branch -d 分支名`

### 2.2.3 举例更新项目到远程仓库

```shell
git add *
git commit -m "更新项目"
git push -u origin main
```


# 三、云服务器远程连接

## 1 阿里云
## 1.1 windows系统

- 创建用于部署的端口号

	- 进入[阿里云服务器控制台](https://ecs.console.aliyun.com/server/)选择对应的服务器点击进入
	- 点击上方Tab的`安全组`->`管理规则`->`手动添加`
		
		<img src='aliyun_add_port.png' width='%50' height='%50'>

- 修改系统登录密码

	- 进入[阿里云服务器控制台](https://ecs.console.aliyun.com/server/)选择对应的服务器点击进入
	- 点击上方Tab的`实例详情`->`基本信息`->`重置密码`
		
		<img src='aliyun_change_password.png' width='%50' height='%50'>

	- 注意：不能修改登录名`administrator`，只能修改密码，否则会修改失败

- 远程登录

	- 在自己的电脑主机中点击`开始`->`运行`->输入`mstsc`->`确定`->输入服务器的公网IP地址->`连接`->输入用户名`administrator`->输入密码->`确定`

	- 或者在电脑的搜索栏中搜索`远程桌面连接`，然后输入服务器的公网IP地址->`连接`->输入用户名`administrator`->输入密码->`确定`

- 远程文件传输
	- [阿里云提供的上传文件功能](https://help.aliyun.com/zh/ecs/use-cases/use-mstsc-exe-to-upload-a-file-to-a-windows-instance)
		- 1.在远程桌面连接前点击`显示选项`->`常规`Tab中`本地资源`
		- 2.直接在本机中通过复制粘贴传递文件
		
# 四、使用Visual Studio与Github进行代码管理出现的问题

## 1.1 突然出现“未能推送到远程仓库”的问题
- 问题如下：

	<img src='vs_pushError_code.png' width='%50' height='%50'>

- [解决方案](https://blog.csdn.net/harry_yaya/article/details/107484793)
	- 1）首先先使用魔法科学上网
	- 2）接着在cmd中测试能不能ping通github.com。`ping github.com`，针对ping不通的情况，需要修改hosts文件。
	- 3）打开`C:\Windows\System32\drivers\etc`目录下的hosts文件

	<img src='vs_pushError_fixHosts.png' width='%50' height='%50'>

	- 4）在hosts文件中添加如下内容并保存
		```markdown
		192.30.255.112  github.com git 
		185.31.16.184 github.global.ssl.fastly.net
		```  
	- 5）再次在cmd中测试能不能ping通github.com。`ping github.com`，如果能ping通，就可以在vscode中进行push操作了。

## 1.2 右侧工具栏消失

- 问题如下：

	<img src='vs_no_rightTool.png' width='%50' height='%50'>

- 解决方案
	
	在VS软件的顶部点击`视图`,在试图下方点击`解决方案资源管理器`

	<img src='vs_no_rightTool_fix.jpg' width='%50' height='%50'>

- 解决效果

	<img src='vs_no_rightTool_result.png' width='%50' height='%50'>

- 参考链接：[Visual Studio 2019解决右侧工具栏消失](https://blog.csdn.net/weixin_44143600/article/details/118654089#)
		


