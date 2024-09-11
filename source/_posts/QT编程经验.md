---
title: QT编程经验
date: 2023-03-18 11:04:37
tags: 杂货铺-休闲
---

# 一、小经验

## 1.1 组件复制

- 在进行组件复制时，需要先把准备复制到的地方取消布局才能进行复制

## 1.2  tableview

- 在设计table内容时，为了方便后续修改表格，需要设计表格的model为`QStandardItemModel*`，后面对表格的修改都在model中进行，而不直接对table进行操作（QComBobox页也同理）

## 1.3 stacked的布局以及自适应缩放

- stack中各个界面整体不能单独布局，需要对stack进行统一布局
- 要实现自适应缩放需要把控件进行布局，同时如果缩放效果不符合预想可以通过修改Layout里面的layoutstretch的比值就可以实现

## 1.4 sql

### 1.4.1 QT驱动sql

- QT操作的前提：使用者能自己通过SQL语句实现数据库表数据的增删改查
	- 本地MySql的配置参考文章：https://subingwen.cn/qt/sql-driver/ & https://www.cnblogs.com/ShineLeBlog/p/14908927.html
		- 在根据教程配置时需要注意.pro文件中添加INCLUDE等三个路径时，如果有路径中有空格需要在路径中添加双引号
		- 还需要注意如果出现文件缺失错误，大概率是配置路径有问题，在添加双引号后先执行qmake然后在构建，参考https://blog.csdn.net/hhhuang1991/article/details/84060977
		- LIBS += "D:\Project\Wireless_communication_software\mysql_v8.0.32\MySQL Server 8.0\lib\libmysql.lib"
		- INCLUDEPATH += "D:\Project\Wireless_communication_software\mysql_v8.0.32\MySQL Server 8.0\include"
		- DEPENDPATH += "D:\Project\Wireless_communication_software\mysql_v8.0.32\MySQL Server 8.0\include"

- 需要先将sql添加到.pro文件中：`QT += sql`

- qt提供的数据库类：
	- * QSqlDatabase：通过这个类增/删/复制/关闭数据库，配置数据库信息
	- * QSqlQuery：提供增删查改功能
	- QSqlRecord：数据库记录
	- QSqlField：数据类型、列名等
	- QSqlQueryModel：遍历结果集的高级接口（模型视图结构，一般大型才需要）
	- * QSqlError：数据操作失败可以通过这个类获取错误信息

### 1.4.2 安装navicat
参考：(NavicatPremium16破解)[https://www.cnblogs.com/kkdaj/p/16260681.html]

### 1.4.3 sql事务操作-数据回滚

- 在进行增、删、更新操作时需要添加事务操作来保护数据

### 1.4.4 sqlite使用
- [SQLite数据库的创建和使用](https://blog.csdn.net/weixin_42380257/article/details/81360237), [Navicat怎么连接Sqlite数据库](https://blog.csdn.net/java_xiaoo/article/details/120868412)

### 1.4.5 QT驱动sql出现问题
- 参考https://www.jianshu.com/p/6efaf46fec75 & https://subingwen.cn/qt/sql-driver
- `D:\Project\Wireless_communication_software\QT_v5.12.6\Qt\Qt5.12.6\5.12.6\mingw73_64\plugins\sqldrivers`路径中找不到`qsqlmysql.dll`和`qsqlmysql.dll`文件，因此需要想办法编译
- 在`D:\Project\Wireless_communication_software\QT_v5.12.6\Qt\Qt5.12.6\5.12.6\Src\qtbase\src\plugins\sqldrivers\mysql`目录下找到`mysql.pro`双击打开

## 1.5 QT实现web界面交互
- 参考[Qt嵌入百度地图API的详细流程与常见问题](https://blog.csdn.net/qq_34578785/article/details/106671018), [QT加载百度在线地图](https://blog.csdn.net/qq_39295354/article/details/124655026?)
- 待参考[qt使用高德地图并与之简单交互](https://blog.csdn.net/qq_41961619/article/details/107104622), [Qt编写百度地图综合应用（在线+离线+区域）](https://www.cnblogs.com/feiyangqingyun/p/12150216.html), [QT QWebEngineView加载百度地图](https://blog.csdn.net/Sakuya__/article/details/106031095), 

## 1.6 QT利用sql的用户登录界面

- 参考：[QT连接SQLite数据库（实现登陆注册）](https://blog.csdn.net/qq_42179526/article/details/105845303), [Qt 手把手教你实现漂亮的登录界面](https://blog.csdn.net/qq_16488989/article/details/108884580), [基于QT开发项目管理系统（附源码）-视频](https://www.bilibili.com/video/BV1ov4y1P7Vb/?), [Qt设计精美的登录注册界面（包含SQLite数据库应用）](https://blog.csdn.net/weixin_45739654/article/details/125702849)

## 1.7 QT利用生成pri文件

参考：https://zhuanlan.zhihu.com/p/489685702

- 先在工程的文件夹中创建一个新的文件夹
- 在新的文件夹中创建一个txt文件，并将名字后缀改成`pri`
- 在工程的`.pro`文件下添加pri对应的文件夹地址信息
	
	<img url="addPri.png" width="%50" height="%50">

- 在`.pri`文件中添加需要加入的自定义类文件的地址信息

	<img url="pri.png" width="%50" height="%50">

# 二、QT配置

## 2.1 QT中配置MSVC环境

- 先到`MaintenanceTool.exe`中添加对应MSVC版本的组件

- 参考：https://blog.csdn.net/Copperxcx/article/details/122540629 和 https://blog.csdn.net/zujiasheng/article/details/125302904 	
	- QT5.12.6是可以配置MSVC的，但是只有在安装了VS后添加里面才会显示MSVC选项
	- 大坑：VS中需要同时安装MSVC 2015版本的才能被QT自动识别
- 完成后编译可能还会出错，因此需要将以下环境添加进环境变量中
	- C:\Program Files (x86)\Windows Kits\10\bin\x86
	- C:\Program Files (x86)\Windows Kits\10\bin\x86
	- 问题解决：http://t.csdn.cn/LkidD https://bbs.csdn.net/topics/396205896 和 https://blog.csdn.net/dsn3S/article/details/121042651 
	- 出现：无法打开包括文件type_traits错误的话可以尝试在cmd这执行`"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64`
	- 出现缺少shell32.dll问题
		- 需要加入自己的Windows Kits下lib下的的um文件路径到系统环境变量中:
		- 比如我的路径:`C:\Program Files (x86)\Windows Kits\10\Lib\10.0.18362.0\um\x64`，如果没有um文件夹则重新下载windows kits
	- 出现头文件缺失：https://blog.csdn.net/skye_95/article/details/81076456 和 https://blog.csdn.net/hhhuang1991/article/details/84060977

- 解决MSVC中文出错问题

	- 在所有头文件`.h`中添加下面的语句
		- `//解决MSVC中文乱码
#if _MSC_VER >= 1600	// MSVC2015 > 1899,	MSVC_VER = 14.0
#pragma execution_character_set("utf-8")
#endif`
	

## 2.2 QT组件添加

- 参考：https://blog.csdn.net/Arcofcosmos/article/details/122413626
- 参考：https://blog.csdn.net/qq_36170958/article/details/108679509 用到`MaintenanceTool.exe`
	- 清华镜像：https://mirrors.tuna.tsinghua.edu.cn/qt/online/qtsdkrepository/windows_x86/root/qt/

# 三、QT打包EXE可执行文件

参考：https://blog.csdn.net/ColinFhz/article/details/107879769

- 1.打开`Qt5.12.6（MinGW...）`，如我的电脑是在搜索栏中点击`Qt5.12.6（MinGW 7.3.0 64-bit）`
- 2.将QT Creator运行得到的`.exe`文件复制到一个空文件夹中
- 3.在`Qt5.12.6（MinGW...）`打开的cmd控制台中cd到第2步中的文件夹处
- 4.输入`windeployqt text.exe`自动打包，其中`text`自己改成对应的文件名称就行


# 四、QT云服务器中部署websocket通信
## 1. 云服务器配置-选用阿里云

- 注意：新用户有[三个月免费使用的优惠](https://help.aliyun.com/zh/ecs/3-month-free-trial)
- 注意：学生用完三个月优惠后可以申请[一个月学生免费试用优惠](https://developer.aliyun.com/plan/student?userCode=r3yteowb)

- 参考[阿里云服务器建立公网物联网服务器](https://blog.csdn.net/qq21497936/article/details/115409124?)
	- 其中`添加端口`步骤是给公网映射一个端口，这样就可以通过公网IP+端口号访问到服务器了，除了安全组里面的端口号外，其它PC是无法通过公网IP访问到服务器的。这里可以测试，在服务器上监听服务器内网的安全组端口号，此时其它PC可以通过`公网IP+端口号`与服务器通信；若服务器监听的是非安全组的端口号，则其它PC无法通过`公网IP+端口号`与服务器通信。
- 云服务器上部署服务端，实际上就是在云本机的内网IP上开放端口号，通过地址映射关系将公网IP与内网IP对应起来，这样就可以通过公网IP访问到云服务器了。

<img src='port_mapping.png' width='%50' height='%50'>

## 2. sqlite加密设置

将下面四个文件拷贝到QT下载路径下对于编译器的sql驱动文件夹中，比如我的是`\QT\Qt5.12.6\5.12.6\mingw73_64\plugins\sqldrivers`，然后在QT的.pro文件中添加`sqlcipher`库。
- `libsqlcipher.a`
- `libsqlcipher.a`
- `sqlcipher.dll`
- `sqlcipherd.dll`

<img url="sqlitecipher.png" width='%50' height='%50'>

## 3. openssl配置
参考：https://blog.csdn.net/byzzw/article/details/118390933

