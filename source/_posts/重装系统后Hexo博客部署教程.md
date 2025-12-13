---
title: 重装系统后Hexo博客部署教程
date: 2022-02-03 17:16:21
tags: 环境配置
categories:
- 重装-环境配置-计算机
---


# 前言


本文针对已经在别的电脑或系统上搭建过Hexo博客，准备重新在新电脑或系统上搭建回之前的博客，也就是说，之前已经在gthub账号上有建立过博客仓库了。

在重新搭建前保证自己以前的blog文件夹中以下文件有被拷贝备份下来：

| 文件夹/文件 | 拷贝内容 |
| :---- | :----- |
| /blog目录下的文件 		| 除landscape外的.yml文件 |
| /blog目录下的文件 		| package.json文件   |
| /blog目录下的文件夹 	| scaffolds、source、themes三个文件夹    |

零基础建立、搭载博客可以参考b站视频：
	
[手把手教你搭建属于自己的hexo+github博客](https://www.bilibili.com/video/BV1cW411A7Jx?spm_id_from=333.1007.top_right_bar_window_custom_collection.content.click)

[手把手教你从0开始搭建自己的个人博客 |无坑版视频教程| hexo](https://www.bilibili.com/video/BV1Yb411a7ty?spm_id_from=333.1007.top_right_bar_window_custom_collection.content.click)

[Hexo博客搭建与部署](https://blog.csdn.net/muzihuaner/article/details/113880520)

[hexo&github 搭建博客（保姆级）](https://zhuanlan.zhihu.com/p/606083588)

> 注意：若是在**Git Bash here**中输入hexo执行指令，则不需要输入**hexo -s**，直接输入**hexo s**即可 

# way1: 从已有的github仓库中重搭博客

如果还没将自己的博客源码 push 到自己的`dev`分支，请跳转到**博客重新搭载操作**中。

如果在之前搭建完自己的博客，且已经将博客源码push到自己的`dev`分支，那么在新电脑上重新搭建博客的步骤就很简单了。直接按下面进行操作就行。

## 一、软件下载

- 对于 Mac 用户，先安装 `Homebrew`

	```shell
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	
	# 安装完成后，根据提示将Homebrew添加到环境变量
	echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
	source ~/.zshrc
	```

-  到[nodejs官网](https://nodejs.org/en/)下载**nodejs**软件并安装

	cmd中输入`node -v`确认版本及确认已安装完毕

	对于 Mac 用户而言，进入官网后选择`macOS->Brew->npm`的方式，执行官方在该方式下的所有命令即可（注意要加上`sudo`，且前提是先安装了 `brew`）。

-  下载[**Git**](https://gitforwindows.org/)软件并安装

	cmd中输入`git`确认版本及确认已安装完毕

	Mac 用户用 `brew` 安装git：

	```shell
	brew install git
	git --version
	```

## 二、建立本机与github的联系

-  Git下载完后，双击安装Git目录下的**git-bash.exe**，输入`ssh-keygen -t rsa -C "github对应的邮箱账号"`，然后直接回车3次（无脑回车即可），将会生产本机对应的SSH号存于C盘Users上的**id_rsa.pub**文件中（如果找不到该文件，可以下载Everything软件直接搜索文件名，可以快速找到文件的位置）

-  用记事本打开id_rsa.pub文件，Ctrl+A全选复制文件的全部内容

-  重新建立github与本机的联系

	- 打开github的**settings**，点击**SSH and GPG keys**，点击**New SSH key**创建github与新系统的联系

	- 其中**title**填写github的用户名即可，**key**填写在id_rsa.pub中复制的文件内容，也就是SSH号，完成后点击**Add SSH key**即可

-  打开cmd输入`npm install hexo-cli -g`安装hexo
	- mac先通过sudo su进入root用户，再全局安装hexo
	- mac用sudo指令，否则会有权限问题`sudo npm install -g hexo-cli`安装hexo
	- [npm安装hexo时更换镜像源](https://blog.csdn.net/laosao_66/article/details/135880270)
      - `npm config set registry http://registry.npm.taobao.org`

- 创建全局 git config
	- `git config --global user.email "github对应的邮箱账号"`
	- `git config --global user.name "github用户名"`

## 三、通过 git clone 的方式重建博客

先将远程仓库拉到本地，然后切换到 dev 分支：

```shell
git clone -b dev git@github.com:AkiraZheng/AkiraZheng.github.io.git # 这里的分支名要跟远程的一样，git 会自动给你切到远程的 dev 分支
cd ./AkiraZheng.github.io
git remote -v···········
```

然后就可以在`AkiraZheng.github.io`下通过`npm`重建起新电脑的本地博客：

```shell
# 在 AkiraZheng.github.io 下（Mac 用户要加上 sudo）（记得，这种不需要hexo init这条指令）
npm install hexo
npm install
```

然后一般来说，博客源码根目录下的`./AkiraZheng.github.io/_config.yml`存着我们的github token，出于安全考虑是不能 push 到 github 的public 仓库的。

由于这个文件并不经常更新，因此我将这个文件单独存在 github 的 private 仓库 `blog_config_yml_file` 中，可以先用`sourcetree`将这个仓库的代码拉到本地中，然后将里面的`_config.yml`文件复制粘贴到`AkiraZheng.github.io`路径下。

此时就可以先用`hexo clean && hexo g && hexo s`本地预览一下看网页是否正常。

如果不正常的话，比如缺少加密插件、缺少公式插件、缺少algolia搜索插件等的话，单独`sudo npm`安装一下。

## 四、需要的 npm 插件

```shell
npm install hexo-deployer-git --save
npm install hexo-generator-json-content # 生成侧边栏索引
npm install hexo-blog-encrypt # 文章加密插件

# 统计words
npm uninstall hexo-renderer-marked --save
pandoc -v
# brew install pandoc  # MacOS
# sudo apt install pandoc  # Linux
npm install hexo-renderer-pandoc --save

# algolia搜索插件
npm install hexo-algolia --save
export HEXO_ALGOLIA_INDEXING_KEY='您的AdminAPIKey'
hexo g
hexo algolia
```

由于 algolia 需要经常`hexo algolia`更新远程的 index 数据库，所以本地是需要安装的

- 启用全局搜索功能-Algolia 搜索（在Archer官方文档中有）

	- hexo目录下安装`hexo-algolia`插件（注意，不要跟着官网安装hexo-algolia，因为安装这个的话只支持标题搜索，不支持文章内容搜索）更正：目前archer不支持algoliasearch，只支持algolia，所以只能搜索标题了

		`npm install hexo-algolia --save`

	上传数据
	```shell
	export HEXO_ALGOLIA_INDEXING_KEY='您的AdminAPIKey'
	# 生成并上传
	hexo g
	hexo algolia
	```

	> [algolia搜索功能配置1](https://github.com/fi3ework/hexo-theme-archer/wiki/%E5%90%AF%E7%94%A8-Algolia-%E6%90%9C%E7%B4%A2)
	>
	> [algolia搜索功能配置2](https://www.chipmunk.top/posts/algolia%E6%90%9C%E7%B4%A2%E5%8A%9F%E8%83%BD%E9%85%8D%E7%BD%AE/)

## 五、部署博客到github上

-  记得操作时用`hexo clean`清理环境，如果出现问题也可以重新打开cmd

	- cmd中进入对应的盘(如`D:`)，进而进入新建的blog文件夹（如`cd AkiraZheng.github.io`）

	- 输入`hexo g`生成博客

	- 输入`hexo d`提交博客部署到github中

		- `hexo d`这个过程可能会出现各种错误，如果git config类型的提示则在博客路径的cmd中输入`git config --global user.email "github对应的邮箱账号"`、回车后继续输入`git config --global user.name "github用户名"`，之后再次`hexo d`部署博客，在弹窗中输入github账号密码搭建联系即可（注意，密码不能填入github的密码，而是填入Token，否则会报错）
			- Token的位置：`Setting`->`Devloper Settting`->`Personal access tokens`
			- 创建Token的方式：
				
				<img src='creat_token.png' width='%50' height='%50'>

				<img src='creat_token2.png' width='%50' height='%50'>
			- 在博客的`_config.yml`文件中修改`repo`项为`https://AkiraZheng:拿到的token@github.com/AkiraZheng/AkiraZheng.github.io.git`

		- `hexo d`这个过程可能会出现各种错误，FATAL中如果出现code: 128错误，很可能是网络问题无法打开github仓库，这是可以关闭cmd挂个梯子后再进行部署
	- 提交后若出现"Please tell me who you are"，则根据提示输入`git config --global user.email "you@example.com"`和`git config --global user.name "Your Name"`(如"1428384878@qq.com"和"AkiraZheng")

至此，博客已经重搭好了，可以将博客放到`sourcetree`中，方便管理仓库。

# way 2: 博客重新搭载操作

## 一、软件下载

-  到[nodejs官网](https://nodejs.org/en/)下载**nodejs**软件并安装

	cmd中输入`node -v`确认版本及确认已安装完毕

-  下载[**Git**](https://gitforwindows.org/)软件并安装

	cmd中输入`git`确认版本及确认已安装完毕

## 二、建立本机与github的联系
	
-  Git下载完后，双击安装Git目录下的**git-bash.exe**，输入`ssh-keygen -t rsa -C "github对应的邮箱账号"`，然后直接回车3次（无脑回车即可），将会生产本机对应的SSH号存于C盘Users上的**id_rsa.pub**文件中（如果找不到该文件，可以下载Everything软件直接搜索文件名，可以快速找到文件的位置）

-  用记事本打开id_rsa.pub文件，Ctrl+A全选复制文件的全部内容

-  重新建立github与本机的联系

	- 打开github的**settings**，点击**SSH and GPG keys**，点击**New SSH key**创建github与新系统的联系

	- 其中**title**填写github的用户名即可，**key**填写在id_rsa.pub中复制的文件内容，也就是SSH号，完成后点击**Add SSH key**即可

-  打开cmd输入`npm install hexo-cli -g`安装hexo
	- mac先通过sudo su进入root用户，再全局安装hexo
	- mac用sudo指令，否则会有权限问题`sudo npm install -g hexo-cli`安装hexo
	- [npm安装hexo时更换镜像源](https://blog.csdn.net/laosao_66/article/details/135880270)
      - `npm config set registry http://registry.npm.taobao.org`

-  新建blog文件夹，之后的博客搭载将全部在该文件夹中进行，如果出现什么错误不要慌，把这个文件夹干掉重新建立再次进行下面的步骤即可

	- cmd中进入对应的盘(如`D:`)，进而进入新建的blog文件夹（如`cd MyBlog\blog`）

	- 输入`hexo init`(若是将以前可正常运行的完整blog路径拷贝下来，里面已有环境在，则不需要进行此步骤)

	- 输入`npm install`

	- 最后输入`hexo s`，复制链接（我这里cmd给的链接是`http://localhost:4000`），到浏览器浏览该链接可以看到最简单的hexo博客界面

	- 将**前言**中备份的旧博客文件及文件夹全部复制到新的**blog文件夹**中，替换新blog文件夹的内容

	- 继续在blog路径的cmd下输入`npm install hexo-deployer-git --save`安装环境

	- 按需添加博客加密`npm install hexo-blog-encrypt`
		- 参考：[【Hexo】静态博客设置文章加密访问](https://blog.csdn.net/qq_42951560/article/details/122552109)

  - 之后便可以继续用`hexo s`查看hexo博客，此时的博客已经恢复成旧博客的内容了

## 三、部署博客到github上

-  记得操作时用`hexo clean`清理环境，如果出现问题也可以重新打开cmd

	- cmd中进入对应的盘(如`D:`)，进而进入新建的blog文件夹（如`cd MyBlog\blog`）

	- 输入`hexo g`生成博客

	- 输入`hexo d`提交博客部署到github中

		- `hexo d`这个过程可能会出现各种错误，如果git config类型的提示则在博客路径的cmd中输入`git config --global user.email "github对应的邮箱账号"`、回车后继续输入`git config --global user.name "github用户名"`，之后再次`hexo d`部署博客，在弹窗中输入github账号密码搭建联系即可（注意，密码不能填入github的密码，而是填入Token，否则会报错）
			- Token的位置：`Setting`->`Devloper Settting`->`Personal access tokens`
			- 创建Token的方式：
				
				<img src='creat_token.png' width='%50' height='%50'>

				<img src='creat_token2.png' width='%50' height='%50'>
			- 在博客的`_config.yml`文件中修改`repo`项为`https://AkiraZheng:拿到的token@github.com/AkiraZheng/AkiraZheng.github.io.git`

		- `hexo d`这个过程可能会出现各种错误，FATAL中如果出现code: 128错误，很可能是网络问题无法打开github仓库，这是可以关闭cmd挂个梯子后再进行部署
	- 提交后若出现"Please tell me who you are"，则根据提示输入`git config --global user.email "you@example.com"`和`git config --global user.name "Your Name"`(如"1428384878@qq.com"和"AkiraZheng")

-  至此，hexo博客的重新建立联系已经完成了，此时可以浏览自己的博客网站，新的博客网站将与新系统相关联

- 注意：如果多端从git上拉项目的话，需要先建立空文件夹完成`hexo init`等操作建立好环境，然后再根据下面链接中的`二：(推荐)在搭建完成博客之后将多端同步加入`拉取git上的项目

  - [hexo多端同步管理](https://zomfice.github.io/2018/02/25/Hexo%E5%8D%9A%E5%AE%A2%E6%90%AD%E5%BB%BA-%E4%B8%89-%E5%A4%9A%E8%AE%BE%E5%A4%87%E5%90%8C%E6%AD%A5/)
	```shell
	// git初始化
	git init
	// 添加仓库地址
	git remote add origin https://github.com/用户名/仓库名.git
	// 新建分支并切换到新建的分支
	git checkout -b 分支名
	```
    - 执行完命令后，在sourceTree中拉取本地这个文件夹，就能更方便地进行更换分支等操作了

## 四、引入mathjax公式

**首先，如果blog源码还没开启过mathjax**:

由于`archer`主题中已经配置了mathjax，但是默认是`false`，因此需要先在`_config.yml`同目录下的`_config.archer.yml`中将`mathjax: false`改为`mathjax: true`：

```Yaml
math:
  mathjax:
    enable: true
    version: 3.2.0
```

如果已经修改完`_config.archer.yml`文件，那么就需要开始配置`npm`环境了：

1. 卸载默认渲染引擎

```bash
npm uninstall hexo-renderer-marked --save
```

2. 系统上安装 `pandoc` 和渲染引擎插件

- 检查 Pandoc 是否已安装

	```bash
	   pandoc -v
	```
 
   如果未安装 `Pandoc`，可以使用以下命令安装：
   
  ```bash
   brew install pandoc  # MacOS
   sudo apt install pandoc  # Linux
  ```
   
- blog目录下配置npm环境：安装 `hexo-renderer-pandoc`

   ```bash
   npm install hexo-renderer-pandoc --save
  ```

> 参考：[启用 LaTeX 数学公式](https://github.com/fi3ework/hexo-theme-archer?tab=readme-ov-file#%E5%90%AF%E7%94%A8-latex-%E6%95%B0%E5%AD%A6%E5%85%AC%E5%BC%8F)

## 五、实现在vscode的Terminal中使用hexo指令

当通过上述步骤搭载完博客后，包括在blog中也**配置好npm环境和hexo环境后**，可以通过下述步骤实现**在vscode的Terminal中使用hexo指令**，这样就不需要每次都通过在文件夹中打开cmd或者Git Bash中输入hexo指令了

- 首先将blog文件夹拖入VSCode中（如本文中的`MyBlog\blog`文件夹）
- 然后在VSCode中点击`Terminal`->`New Terminal`
<img src='vscode_newTerminal.jpg' width='80%' height='80%'>
- 在新打开的Terminal中输入hexo指令，如`hexo s`，这时可能会出现报错
<img src='vscode_error.png' width='80%' height='80%'>
- 不要慌，这里是因为在此系统中禁止执行脚本，那么我们就应该先**把脚本执行权限打开**
	- Win10下以**管理员身份**运行**PowerShell**
	<img src='vscode_powershell.png' width='50%' height='50%'>
	- 输入`Set-ExecutionPolicy`，回车，检查脚本执行权限是否被打开了，如果是`Restricted`则说明脚本执行权限没有被打开
	<img src='vscode_powershell2.png' width='100%' height='100%'>
	- 执行：`set-ExecutionPolicy RemoteSigned` 需要开启，所以选择`Y`，回车
	<img src='vscode_powershell3.png' width='100%' height='100%'>
	- 以上打开权限的方法参考[hexo运行报无法加载文件](https://www.cnblogs.com/hdlan/p/14452703.html)
- 至此，我们已经完成了配置，可以重启VSCode，然后打开Terminal，输入`hexo s`或其它指令，这时就可以正常运行hexo指令了
- **Point：**当在Terminal中启动`hexo s`后，在浏览器中输入`http://localhost:4000`即可查看博客网站，这时在VSCode中进行博客的编写、修改、部署等操作,保存更改后回到**浏览器刷新即可看到更改后的效果**

## 六、关于Archer主题的相关配置

[Archer主题配置](https://github.com/fi3ework/hexo-theme-archer/wiki/)指南在github网站中

修改主题时修改`./blog`文件夹中的`_config.archer.yml`而不是thems中的

- 启用字数统计及阅读时间

	hexo目录下执行

	`npm i --save hexo-wordcount`

- 启用全局搜索功能-Algolia 搜索（在Archer官方文档中有）

	- hexo目录下安装`hexo-algolia`插件（注意，不要跟着官网安装hexo-algolia，因为安装这个的话只支持标题搜索，不支持文章内容搜索）更正：目前archer不支持algoliasearch，只支持algolia，所以只能搜索标题了

		`npm install hexo-algolia --save`

	> [algolia搜索功能配置1](https://github.com/fi3ework/hexo-theme-archer/wiki/%E5%90%AF%E7%94%A8-Algolia-%E6%90%9C%E7%B4%A2)
	>
	> [algolia搜索功能配置2](https://www.chipmunk.top/posts/algolia%E6%90%9C%E7%B4%A2%E5%8A%9F%E8%83%BD%E9%85%8D%E7%BD%AE/)

	上传数据
	```shell
	export HEXO_ALGOLIA_INDEXING_KEY='您的AdminAPIKey'
	# 生成并上传
	hexo g
	hexo algolia
	```

- 关闭目录自动编号

	- 打开Archer主题文件夹中的`/layout/layout.ejs`

	- 将

		`<%- toc(page.content, {class: 'toc', list_number: true}) %>`

	- 替换成

		`<%- toc(page.content, {class: 'toc', list_number: false}) %>`



# 后记-hexo博客编写相关问题合集

## 1. 解决部署到github仓库时出现连接仓库超时问题

所有hexo指令操作都在hexo博客目录下右键点击Git bush下进行指令操作成功率会高很多！！

还有记得部署到github前进行`hexo clean`操作，降低出现bug的几率

- 解决方法

	- 在执行`hexo d`前先在默认浏览器中打开github网站

	- 在Git bush中输入`git config --global https.proxy`设置代理

	- 在Git bush中输入`git config --global --unset https.proxy`取消代理

	- 在Git bush中正常输入`hexo clean && hexo g && hexo d`提交代码即可

## 2. 解决部署到github仓库时FATAL出现code: 128错误

所有hexo指令操作都在hexo博客目录下右键点击Git bush下进行指令操作成功率会高很多！！

还有记得部署到github前进行`hexo clean`操作，降低出现bug的几率

- 解决方法一

	- 删掉blog中的.deploy_git文件夹，`rm -rf .deploy_git/`

	- cmd中输入`git config --global core.autocrlf false`

	- cmd中输入`hexo clean && hexo g && hexo d`

- 解决方法二
	
	- 删掉blog中的.deploy_git文件夹，`rm -rf .deploy_git/`

	- cmd中输入`npm install hexo-deployer-git`

	- cmd中输入`hexo clean && hexo g && hexo d`
- 解决办法三

	- 太久没使用hexo可能会导致hexo与本地电脑的连接失效，此时转到[二、建立本机与github的联系](#二、建立本机与github的联系)

## 3. 用Sublime Text3软件实现Markdown文件在浏览器中实时更新显示

MarkdownPreview + LiveReload

- Sublime中安装插件的办法

	- 组合键`Ctrl+Shift+P` 调出命令面板

	- 输入`Package Control: Install Package`，回车

	- 在搜索框中输入要安装的包名（一个一个，不能同时安多个）

- MarkdownPreview

	- 根据插件安装方法安装MarkdownPreview插件

	- 设置浏览器浏览快捷键为`alt+m`，在Preferences -> Key Bindings打开的文件的右侧栏的中括号中添加一行代码：

	`{ "keys": ["alt+m"], "command": "markdown_preview", "args": {"target": "browser", "parser":"markdown"}  }`

- LiveReload实现实时更新

	- 根据插件安装方法安装LiveReload插件

	- 组合键`Ctrl+Shift+P` 输入`LiveReload: Enable/disable plug-ins`, 回车, 选择 `Simple Reload with delay (400ms)或者Simple Reload`，两者的区别仅仅在于后者没有延迟。

Sublime实现Markdown实时更新参考文章：[Sublime Text3 的 Markdown 实时预览全面总结](https://blog.csdn.net/qq_20011607/article/details/81370236)

## 4. 解决本地图片上传问题

- 在_config.yml配置文件中配置项**post_asset_folder**设为true

	之后再用`hexo new post_name`命令都会自动在**source/_post**文件夹中会生成对应的图片文件夹，此时图片文件夹中的图片资源可以用相对路径来引用

- 在hexo文件夹打开Git bush输入

	`npm install https://github.com/7ym0n/hexo-asset-image --save`

- 保证图片都保存在同名的文件夹中

- 文章的.md文件可以采用两种方式引用、插入图片

	- 第一种为`![图片描述](图片的文件名)`，比如`![test](1.png)`

	- 第二种为`<img src="图片的文件名">`，比如`<img src="1.png" width="80%" height="80%">`

解决hexo本地图片插入问题参考文章：[Hexo+Github博客：网站内图片不能正常显示，但本地文件可以显示](https://blog.csdn.net/qq_36408085/article/details/104117319)

## 5. Hexo新建文章

`hexo n text1`，注：text1可以改为文章名称

## 6. 是否开代理问题

- 参考文章[解决 Github port 443 : Timed out](https://zhuanlan.zhihu.com/p/636418854)

## 7. themes是clone的导致push时文件夹出现箭头（丢失）

- 参考文章[Git 解决github文件夹有向右的白色箭头并且不能打开](https://www.jianshu.com/p/28e61a24d847)

## 8. 在`vscode`中配置`paste image`

在 vscode 中配置 paste image，实现用`Ctrl+Alt+V`(win)、`opt+cmd+V`(mac)粘贴图片

首先安装`paste image`插件

然后`ctrl+shift+p`打开命令面板，输入`settings`，选择`paste image: path`

配置内容：

对于`paste image: path`，配置为`${currentFileNameWithoutExt}`，hexo中new一个md文件时，会自动生成同名文件夹存放图片，因此这里设置将图片存放在md文件同目录下

<img src=2025-09-17-14-05-32.png>

对于`Paste Image: Insert Pattern`，配置为`<img src=${imageFileName}>`

<img src=2025-09-17-14-07-17.png>

