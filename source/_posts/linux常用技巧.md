---
title: linux常用技巧
date: 2025-09-03 15:50:10
tags:
---

# 1. vim

- `.`:小数点，重复上一次的命令

## vim 中进行查找

1）基本查找命令

查找下一个匹配项：

```
/<搜索内容>
```
- 按下 / 键，输入要查找的内容，然后按下回车键 Enter。
- 例如：`/hello`表示查找  hello

2）跳转到另一个查找结果

`/hello`查找后，要先按 enter 键，然后按 `n` 键才能跳转到下一个匹配项。

- 跳转到下一个匹配项：按`n`键
- 跳转到上一个匹配项：按`N`键

3）[vim-drawit操作指南](https://www.cnblogs.com/imzhi/p/vim-drawit.html)

## vim 中复制粘贴

复制：

- `yy`: 复制当前行
- `nyy`: 复制从当前行开始的 n 行（例如：`3yy` 复制当前行及其下两行，共三行）

粘贴：

- `p`: 在光标后粘贴

## 光标移动

- `NG`: 跳转到第 N 行
- `:n`: 跳转到第 N 行（好用！）
- `gg`: 跳转到第一行, 相当于 `1G`
- `G`: 跳转到最后一行
- `w`: 光标跳到下一个单词的开头
- `e`: 光标跳到当前单词的结尾
- `$`: 跳转到这一行的末尾
- `%`: 跳转到匹配的括号处（大括号、中括号）
- `*`: 高亮显示所有与当前光标所在单词**相同的单词处**
  - 按 `n` 跳转到下一个匹配处
  - 按 `N` 跳转到上一个匹配处

组合命令：

<start position> <end position> <command>

example:

- `0y$`: 复制从行首到行尾的内容
  - `0`: 行首
  - `y`: 复制
  - `+y`：复制选中的内容到系统剪贴板。(需要安装 xclip,通过`:version`查看当前是否支持与系统剪贴板交互，`-clipboard`为不支持)
  - `$`: 行尾

其他高级组合用法符号说明：

- `viw`：选择当前单词（包括单词的前后空格）
- `0`: 行首
- `^`: 到本行**第一个**非空字符
- `$`: 行尾
- `g`: 到本行**最后一个**非空字符
- `fa`: 到下一个匹配的字符 a 处（可以改变 a 为其他字符）
- `t,`: 到逗号前的第一个字符（逗号可以改变为其他字符）

## 配置vim显示行号

```shell
# 打开vimrc配置文件
vim ~/.vimrc
```

在vimrc配置文件中添加如下内容：

```vim
set number "行号显示
syntax on " 打开语法高亮
set background=dark " 如果背景是黑色，最好加上这句
```

## vim 双屏

### 方法一：vsp

vim 查看一个文件后，用`:vsp`来跟另一个文件进行比较（双屏）

```shell
vim ./file1.c
:vsp ./file2.c
```

如果要打开另一个文件：

```shell
:e ./file3.c
```

然后如果要切到第二个屏进行查找的话，可以用快捷键`CTRL+ww`或者`CTRL+h/j/k/l`通过方向键切过去

### 方法二：-O

加上`-O`参数直接多屏打开多个文件，通过垂直屏幕的方式。

```shell
vim -O file1.c file2.c
```

## vim 中显示当前文件的 路径&&文件名

在底部输入`:f`然后 Enter

## vim 中多个文件选择和切换

```shell
:buffers
```

<img src=2026-01-10-12-05-43.png>

然后找到要跳转的文件的编号，比如上图中的`irqchip.c`的编号是`1`，然后输入：

```shell
:buffer 1
```

# 2. terminal 操作

## `find`

查找并忽略没有权限的文件的报错信息：

```shell
find / -name "文件名.c" 2>/dev/null
```

## 查找内核的路径

`uname -a`: 显示当前内核信息

`ls -l /usr/src`: 找到 uname -r 显示的版本的内核路径

## 查看bios版本

`sudo dmidecode -t bios`

## 查看操作系统版本

`cat /etc/os-release`

## 查看磁盘哪个占用最高

```shell
df -h
sudo du -sh /* 2>/dev/null | sort -hr | head -n 10
# 2>/dev/null: 忽略没有权限访问的目录产生的错误信息
# du 指令按查询结果逐层筛查
```

```
18G     /home
7.5G    /usr
348M    /root
277M    /boot
166M    /var
35M     /etc
12M     /run
40K     /opt
16K     /lost+found
4.0K    /srv
```

假设逐层检查发现是 `/var/crash` 占用最高，如果确认占用最高的目录删除后没有影响，那么就删除该目录：

```shell
rm -rf /var/crash/*
```

## 查看 CPU 使用率

通常用`top`就能查看，但是如果要指定查看某个`CPU`的使用率可以用`mpstat -P 1 1`，这个还可以查看中断率

## 设置环境变量

用 `export` 命令设置环境变量，例如：

配置路径：

```shell
export PATH=$PATH:/usr/local/bin
```

配置变量：

```shell
export $VAR=value
echo $VAR # 验证环境变量是否正确设置到系统中
```

## 开关内核打印

有时候我们在应用层调试程序的时候想暂时屏蔽掉内核的无用打印，可以在 host 用以下方法暂时关闭，这样开启 guest 虚机的时候就不会将内核信息打印到主机中，影响性能：

```shell
echo 0 > /proc/sys/kernel/printk
```

打开内核打印：

```shell
echo 7 > /proc/sys/kernel/printk
```

## 内核编译选项

### 查看已经启动的内核是否包含哪个编译项

内核的编译选项一般存在`/boot/config-$(uname -r)`中，所以可以结合`grep`查看当前内核有没有编进去你想找的编译选项

```shell
# 查看当前包含的所有编译选项
cat /boot/config-$(uname -r)
zcat /proc/config.gz | grep CONFIG_XXX

# 查找有没有 KUT kvm 单元测试的编译选项
grep -r CONFIG_KUT /boot/config-$(uname -r)
```

### 查看编好的 rpm 包是否包含某个编译选项

如果是编了 rpm 包，还没有 rpm 添加进服务器内核，且没有更新内核的话：

```shell
rpm2cpio kernel-xxx.rpm | cpio -idmv # 这样会把内核解压到当前目录下，生成一个`boot`和`lib`目录
grep -r "CONFIG_XXX" .
```

对于已经`rpm -qa`安装的内核包，可以用以下命令查看内核编译选项：

```shell
rpm -q --configfiles kernel-<version>.rpm
```

### linux rpm 包添加 tracing

如果内核没有编译 tracing，可以重新编译内核，添加 tracing 编译选项：

```shell
CONFIG_FTRACE=y
CONFIG_TRACING=y
CONFIG_KPROBES=y
CONFIG_KPROBE_EVENTS=y # /sys/kernel/debug/tracing/kprobe_events
CONFIG_DYNAMIC_FTRACE=y
CONFIG_DYNAMIC_EVENTS=y
CONFIG_FUNCTION_TRACER=y
CONFIG_EVENT_TRACING=y
CONFIG_KPROBE_EVENTS=y
CONFIG_UPROBE_EVENTS=y
# 辅助调试
CONFIG_KALLSYMS=y
CONFIG_KALLSYMS_ALL=y
CONFIG_DEBUG_INFO=y
```

## 修改 linux-root 密码

```shell
sudo passwd root
# 验证sudo的密码后，输入新密码
```

## 设置维持 ssh 连接不断连

```shell
# sudo vim /etc/ssh/sshd_config
sudo vim ~/.ssh/config
```

然后在文件中写入如下内容：
```shell
Host *
    ServerAliveInterval 60
```

最后，记得重启sshd服务：`service sshd restart`

## scp，cp

服务器与服务器之间进行文件传输用scp

`scp user1@ip1:/home/user1/file1.txt user2@ip2:/home/user2/file2.txt`

> [设置维持 ssh 连接不断连](https://ngwind.github.io/2019/01/25/%E4%BF%9D%E6%8C%81ssh%E6%9C%8D%E5%8A%A1%E8%BF%9E%E6%8E%A5%E4%B8%8D%E6%96%AD%E5%BC%80%E7%9A%84%E6%96%B9%E6%B3%95/)

单个服务器内进行文件复制粘贴用cp

`cp file1.txt file2.txt`

`cp -r /home/dir1 /home/dir2` 在源目录下有子目录时，用-r参数，表示递归复制

## ll 文件字节数

```shell
akira@akira:~/linux-code$ ll tags
-rw-rw-r-- 1 akira akira 1005478272 Dec 24 14:00 tags
```

`1005478272`单位是字节，以**3位**为间隔，可以展开成`1,005,478,272`

- 1005478.272 **KB**
- 1005.478272 **MB**
- 1.005478272 **GB**

## 修改默认内核选项

### 方法一（推荐）

这个方法不会把其他内核的 cmdline 刷掉，配完就可以直接重启了

```shell
grubby --default-kernel #查看默认启动内核
grubby --set-default /boot/vmlinuz-xxx # 可以先 ls /boot/ 查看有哪些内核，然后把想要的内核设置为默认内核
```

### 方法二

先查看你要改为默认选项的内核的编号

```shell
awk -F\' '/menuentry / { print i++ " : " $2 }' /boot/efi/EFI/openEuler/grub.cfg
```

然后修改grub配置文件，将`GRUB_DEFAULT`的值改为目标内核编号：

```shell
cp /etc/default/grub /etc/default/grub.bak
vim /etc/default/grub
# GRUB_DEFAULT=5
grub2-mkconfig -o /boot/efi/EFI/openEuler/grub.cfg  # 每次都会刷新 grub 文件，把生成的 grub 中其他内核新增的 cmdline 也刷掉
```

# 3. gdb 调试

## 常用指令

```shell
target remote localhost:1234
b _start
c
layout regs # 查看寄存器
s # 运行下一条指令
# n # 跳过当前函数
x/x $pc # 查看当前pc地址的值
q # 退出
```

## 查看某个地址处内存的值：

按当前寄存器值查看

看 x1 指向的同一块目的地址`x/4xg 0x200000`

> [gdb查看内存的值](https://blog.csdn.net/u014470361/article/details/102230583)

## 查看变量值

2. 查看变量值

你可以在调试过程中查看变量的值。例如，要查看 index 的值：

```shell
(gdb) print index
```

查看 data 数组的某个元素：

```shell
(gdb) print data[0]
```

print / p

```gdb
p var        # 打印变量值
p i          # 打印整数 i 的值
p/x i        # 以十六进制打印 i
p/d i        # 以十进制打印 i
p/t i        # 以二进制打印 i
p/f fval     # 打印浮点数
```


print string 指针

```gdb
p s
$1 = 0x555555559260 "hello world"
p *s
$2 = 104 'h'       # 打印第一个字符
```


print 数组

```gdb
p arr        # 打印数组指针
p *arr@10    # 打印 arr 数组的前10个元素
p arr[0]     # 打印数组第一个元素
```

## 设置断点

函数断点

```gdb
break main          # 在 main 函数处断点
break my_func       # 在 my_func 函数入口断点
c
```

行号断点

```gdb
break main.cpp:25    # 在 main.cpp 第25行设置断点
c
```

条件断点

```gdb
break main.cpp:30 if i==5  # 仅当 i==5 时停下
```

## 运行与继续执行

```gdb
run                 # 从头开始运行
continue / c        # 继续执行到下一个断点
finish              # 执行当前函数并返回
```

## 单步调试


step / s：进入函数内部执行

```gdb
step
```

next / n：执行下一行，但不进入函数内部

```gdb
next
```

你已经在 print_el 里了，那就直接跳出去：

```gdb
(gdb) finish
```

跳到下一个断点：

```gdb
# 设置多个断点后，连续执行到下一个断点
(gdb) break function1
(gdb) break function2
(gdb) run # 运行程序
(gdb) continue  # 从当前位置执行到function1
(gdb) continue  # 从function1执行到function2
```

stepi / si：按 CPU 指令单步执行

```gdb
stepi
```

nexti / ni：按指令单步，但不进入函数

```gdb
nexti
```

## 调试线程

如果你的程序使用了多线程，gdb 会处理每个线程。你可以使用以下命令查看线程：

```shell
(gdb) info threads
```

这个命令会列出所有线程及其状态。你可以使用以下命令切换到某个特定线程：

```shell
(gdb) thread <thread_number>
```

例如，如果你想切换到线程 2：

```shell
(gdb) thread 2
(gdb) continue
```

## 普通可执行文件调试

**1. 添加编译参数**

首先确保编译可执行文件的`Makefile`中添加了`-g`参数：

```Makefile
gcc -g ......
```

**2. 启动调试器**

在编译完成后，启动 gdb 调试器：

```shell
gdb ./my_program
```

这将启动 gdb 并加载你的程序 my_program

**3. 设置断点**

你可以在你想要的地方设置断点。例如，要在 access_data_array 函数的开头设置断点，可以使用以下命令：

```shell
(gdb) break access_data_array
```

或者，你也可以在特定的行号处设置断点。例如，设置在第 18 行 处：

```shell
(gdb) break 18
```

**4. 运行程序**

```shell
(gdb) run
```

# 4. qemu 使用

## qemu 指令

## qemu 主线编译运行


### 克隆QEMU工程

克隆工程时必须加入`g--recurse-submodules`把子工程一并克隆下来

```shell
git clone --recurse-submodules https://github.com/qemu/qemu.git
```

**注意：克隆工程时一定要加上`--recurse-submodules`，否则很容易出现版本问题**

### QEMU编译

编译arm64架构下的qemu虚拟机：

```shell
mkdir build
cd build

# 执行前先创建QEMU的Python环境
# 执行 ../configure 时，不加`--target-list`参数的话会使后面 make 时编译所有x86、ARM、RISC-V架构的代码，时间很久

../configure --target-list=aarch64-softmmu

make -j64

ll qemu-system-aarch64 # 确认是否编译成可执行文件
```

编译完确认没报错后，需要打包生成的`qemu-system-aarch64`，然后由于选择的是动态编译，所以需要把所有的动态库打包进去：

```shell
mkdir qemu_build
cp qemu-system-aarch64 qemu_build/
mkdir qemu_build/libs
ldd qemu-system-aarch64 | awk '{print $3}' | grep '^/' | xargs -I {} cp -v {} qemu_build/libs/	#拷贝动态库
tar czf qemu_build.tar.gz qemu_build/
```

### 测试验证

将编译的qemu放到开发板中进行测试验证

```shell
scp qemu_build.tar.gz <user>@<server>:</path/>
tar -xzvf qemu_build.tar.gz
```

启动虚机：

```shell
./qemu_build/qemu_build/qemu-system-aarch64 -machine virt,gic-version=3 \
-enable-kvm -cpu host -m 4G -smp 4 -net none -nographic \
-kernel Image -initrd minifs.cpio.gz \
-bios QEMU_EFI.fd \
-append "rdinit=init root=init console=ttyAMA0 earlycon=pl011,0x9000000"
```

如果编译中出现库找不到的问题，可能是因为编译机跟开发机环境不一样，可以尝试下面的方法：

```shell
patchelf --set-rpath '$ORIGIN/libs' ./qemu_build/qemu-system-aarch64
ldd ./qemu-system-aarch64 | grep '=> /' | awk '{print $3}' | xargs -I {} cp -v {} libs/
```

## virsh 指令

```shell
# 安装相关依赖和启动服务
yum install -y libvirt sshpass
systemctl start libvirtd

# 创建共享目录
mkdir -p /tmp/shared_host

# virsh 启动虚机

virsh define file_name.xml
virsh start file_name --console

# 重新进入虚机
virsh console file_name

# 退出虚机
# ctrl+] 退出

# 查看虚机绑核状态
virsh vcpupin file_name

# 查看全局虚机数量状态
virsh list

# 删除销毁虚机
virsh destroy file_name
virsh undefine file_name

# 查看分配的 DHCP 租约（virsh自动分配给vm的网络IP）
virsh net-dhcp-leases default

# 检查默认网络状态
virsh net-list --all

# 销毁默认网络
virsh net-destroy default

# 启动默认网络
virsh net-start default

# 查看虚机的详细信息（qemu monitor）
virsh qemu-monitor-command <虚机名称> --hmp "<指令>"
# 例如查看虚机的 CPU 信息
virsh qemu-monitor-command vm1 --hmp "info cpus"

```

## 查看用qemu起的虚机 pid

`ps -ef | grep qemu`

`ps aux | grep qemu`

# 5. Linux 中对工程代码的跳转、函数查找

## vim 中函数跳转

### way1：使用 cscope 实现函数跳转（功能更齐全）

如果你的 Vim 配置了 `+cscope` 支持（可以通过 `:version` 命令查看），你可以使用 cscope 来进行函数跳转。

<!-- 安装 ctags

在工程源目录下为所有文件生成 ctags：`ctags -R *`

在 vim 中使用 ctags 跳转：`:tag 函数名` -->

**1.** 生成 cscope 数据库：

在你的项目目录中，生成 cscope 数据库文件。打开终端，进入项目目录，执行：
```shell
cscope -Rbq
```
- R：递归查找源代码。

- b：生成数据库文件。

- q：启用快速查询。

**2.** 在 Vim 中启动 cscope：

启动 Vim 后，使用以下命令打开 cscope 数据库：

```shell
:cs add cscope.out
```

这将加载刚才生成的 cscope 数据库。

**3.** 进行函数跳转：

- 使用 `:cs find c <function_name>` 查找并跳转到某个函数的定义位置。

- 使用 `Ctrl-]` 跳转到光标所在函数的**定义**。

  - `:f` 查看当前跳转到了哪个文件中

- 使用`:tjump/函数名`

- 使用 `Ctrl-T` 返回到跳转之前的位置。

### way2：使用 tag 文件实现函数跳转（基于 ctags）【推荐】

另一个常用的跳转方式是使用 ctags 来生成标签文件，这可以在 Vim 中实现函数的跳转。

**1.** 安装 ctags：

如果你没有安装 ctags，可以通过包管理器安装：

```shell
sudo apt-get install exuberant-ctags
```

**2.** 生成标签文件：

在项目根目录下运行以下命令来生成标签文件：

```shell
ctags -R .
ls
```

- R：递归生成所有源代码文件的标签。

**3.** 在 Vim 中启用 tag 文件：

打开项目后，Vim 会自动加载当前目录下的 tags 文件。你可以使用以下命令手动加载：

在项目根目录启动 Vim：

```shell
vim
```

```shell
:set tags=./tags;
```

**4.** 跳转到函数定义：

将光标移动到你想跳转的函数名上，然后按 `Ctrl-]` 跳转到该函数的定义。

如果要返回到之前的位置，按 `Ctrl-T`。

你还可以使用 `:tag <function_name>` 跳转到函数定义。

<!-- ## shell 中查找整个哪个文件包含某个函数名 -->

## 更新 tag

第一种方法是使用 vim 插件 `vim-gutentags`，它会在保存文件时，自动在后台增量更新 tags 文件。

第二种方法是手动增量更新 tags 文件：

```shell
ctags -R -a .
ctags -R -a <filename>
```

`-a` 参数表示追加模式，这样可以避免每次都重新生成整个 tags 文件。

## 工程目录下查找某个函数名

`grep -r "函数名" path`

`grep -rn "函数名" path # n: 显示行号`

`grep -r "待查找内容" --include="*.c"`

# 6. 打造最强vim ide

安装工具 vim 插件管理工具：

```shell
git clone https://github.com/VundleVim/Vundle.vim.git ~/.vim/bundle/Vundle.vim
```

然后把事先准备好的 `.vimrc` 文件放到 home 目录下，获取链接：[https://pan.quark.cn/s/84d039d2ffc2](https://pan.quark.cn/s/84d039d2ffc2)

```shell
cp /path/to/your/.vimrc ~/.vimrc
```

打开 vim，执行以下命令安装和查看插件：

```shell
vim
:PluginInstall
:PluginList
```

## ctags

安装 ctags：

```shell
sudo apt-get install exuberant-ctags
ctags --version
```

每个工程目录下生成 tags 文件：

```shell
ctags -R .
vim
:set tags=./tags;
```

常用的快捷键有两个：

- `Ctrl-]`：跳转到光标所在函数的定义。
- `Ctrl-T`：返回到跳转之前的位置。

## cscope

ctags 只能跳转到函数定义，无法跳转到函数调用处，而 cscope 可以实现这两个功能。

安装 cscope：

```shell
sudo apt-get install cscope
cscope --version
```

每个工程目录下生成 cscope 数据库文件：

```shell
# 下面的命令会生成 3 个文件： cscope.out、cscope.in.out、cscope.po.out
# 其中 cscope.out 是主要的数据库文件，另外两个是加速索引
cscope -Rbq
```

为了方便使用，我们已经在`.vimrc`中配置好了 cscope 的快捷键：

```vim
"nmap <C-_>s :cs find s <C-R>=expand("<cword>")<CR><CR>
"F5 查找c符号； F6 查找字符串；   F7 查找函数定义； F8 查找函数谁调用了，
nmap <silent> <F5> :cs find s <C-R>=expand("<cword>")<CR><CR> :botright copen<CR><CR>
nmap <silent> <F6> :cs find t <C-R>=expand("<cword>")<CR><CR> :botright copen<CR><CR>
"nmap <silent> <F7> :cs find g <C-R>=expand("<cword>")<CR><CR> 
nmap <silent> <F7> :cs find c <C-R>=expand("<cword>")<CR><CR> :botright copen<CR><CR>
```

常用快捷键说明：`fn + Fx`

- `F5`：查找符号（变量、宏等）
- `F6`：全工程查找光标下的字符串（其中就包含了函数调用处）
- `F7`：全工程查找函数调用处

找到后，会自动打开底部窗口显示查找结果，输入下面的命令后就可以通过`hjkl`键在结果中进行上下选择：

```vim
:copen
```

找到想去的地方后，按回车键 Enter 就可以跳转过去。

<img src=2026-01-10-12-11-45.png>

输入下面的命令关闭窗口：

```vim
:cclose
```

## tagbar

`.vmrc`中已经配置好了 tagbar 插件

- 打开 tagbar 窗口：

```vim
:TagbarToggle
```

- 关闭 tagbar 窗口：

```vim
:TagbarClose
```

## nerdtree

用于左侧显示目录树

`.vmrc`中已经配置好了 nerdtree 插件

## 动态语法检测

`.vmrc`中已经配置好了 Ale 插件，左侧显示语法错误，其中`x`表示错误，`w`表示警告，

`:ALEFix`可以自动修复一些简单的语法错误。

## YCM 代码自动补全

`.vmrc`中已经配置好了 YouCompleteMe 插件，该插件对 vim 的版本号有要求。

同时还需要安装一些依赖：

```shell
sudo apt-get install build-essential cmake vim-nox python3-dev
```

检查 python 版本是否为 Python3：

```shell 
python
```

接下来编译 YouCompleteMe：

```shell
cd ~/.vim/bundle/YouCompleteMe
python3 install.py --clangd-completer
# 如果需要支持 C++11 及以上标准，可以加上 --clang-completer 标志
```

编译完之后，还要把`~/.vim/bundle/YouCompleteMe/third_party/ycmd/examples/.ycm_extra_conf.py`文件复制到`./.vim`目录下：

```shell
cp ~/.vim/bundle/YouCompleteMe/third_party/ycmd/examples/.ycm_extra_conf.py ~/.vim/
```

以及在`.vimrc`中添加了相关配置就行了。

## LSP 自动补全

但是由于 YCM 需要各种 vim 版本要求、python 要求，没达到要求的还要重新编译，非常麻烦，所以推荐使用 LSP 方式来实现代码自动补全。

先安装`clangd`：

```shell
sudo apt-get install clangd
clangd --background-index # 启动后台索引功能
```

`.vimrc`中已经配置相关插件，`:PluginInstall`安装完插件后，在你的 linux 工程目录下创建一个`compile_commands.json`文件：

**linux 内核工程下生成 compile_commands.json：**

linux 的话推荐用`scripts/clang-tools/gen_compile_commands.py`

```shell
make defconfig
scripts/clang-tools/gen_compile_commands.py
```

然后打开`c`文件，可以查看是否启用了 LSP 补全：

```vim
:LspStatus
:LspLog # 遇到问题可以查看日志
```

<img src=2026-01-10-12-36-58.png>

**其他C/C++ 项目生成 compile_commands.json：**

可以使用`cmake`生成：

```shell
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ..
```

这会在项目根目录下生成一个 compile_commands.json 文件，clangd 使用该文件来获取编译选项。

如果你的项目不是用 cmake 构建的，一般 clang 会自动生成`gen_compile_commands.py`，可以利用该工具来生成 compile_commands.json：

```shell
cp /path/scripts/gen_compile_commands.py
python3 gen_compile_commands.py
```

> 参考：[vim安装LSP语法补全插件](https://www.kawabangga.com/posts/3745)

# 7. 编译

## 反汇编

编译完二进制文件`.o`等二进制可执行文件后，可以使用 `objdump -d` 反汇编查看函数的汇编代码。

```shell
objdump -D myfile.o > myfile.s
```

# 8. 硬件参数查询

## 查看 CPU 数、numa数、qemu 线程 pid

```shell
lscpu
numactl -H
```

qemu 进入monitor

```shell
info cpus
```

## 开关 SMT

SMT (Simultaneous Multithreading, 同时多线程) 

也就是假设你的单 P （单 socket 槽）机器上有 64 个物理核，如果**关 SMT**的话，同一时刻只能有 64 个逻辑核，同一时刻也只能有 64 个线程。

但是当**开 SMT**后，可以启用超线程，把逻辑核翻倍，每两个逻辑核公用一套物理核上的资源，但是此时每个物理核上同一时刻可以跑 2 个逻辑核，同时跑 2 个线程。
开 SMT 后重新用`lscpu`查看 cpu 数，可以看到显示的 `cpu online`数量翻倍了。

可以通过以下方式查看 CPU 是否支持 SMT 超线程、以及当前是否开启了 SMT 超线程：

```shell
cat /sys/devices/system/cpu/smt/active 
cat /sys/devices/system/cpu/smt/control 
```

```shell
akira@akira:~$ cat /sys/devices/system/cpu/smt/active 
0 # 说明当前没开，开了的话应该是 1
akira@akira:~$ cat /sys/devices/system/cpu/smt/control 
notimplemented # 说明 CPU 不支持 SMT 超线程，支持的话应该是 on 或者 off
```