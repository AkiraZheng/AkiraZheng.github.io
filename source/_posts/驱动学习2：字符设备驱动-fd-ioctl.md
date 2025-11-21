---
title: '驱动学习2：字符设备驱动(fd,ioctl)'
date: 2025-10-27 15:16:40
tags:
categories:
- Linux内核驱动
---

# 1. ioctl

`ioctl`是用于设备控制的公共接口，可以实现用户态**系统调用**、**设备驱动程序**进行通信。`ioctl`在**字符设备、块设备、网络设备**等设备驱动程序中广泛使用。


```

     +---------------+          +---------------+       +---------------+       +---------------------------+
     |  用户态ioctl   +--------->| 陷入内核传递   +------>| 内核查找       +------>| sys_ioctl()根据文件操作集 |
     |               |          | 系统调用号54   |       | 系统调用号54   |       | 找到驱动程序mydev_ioctl   |
     +---------------+          +---------------+       +---------------+       +------------+--------------+
             ^                                                                               |
             |                                                                               |
             |                                                                               |
             |                                                                               v
             |                                                                  +---------------------------+
             +------------------------------------------------------------------+                           |
                                                                                | 执行驱动程序mydev_ioctl    |
                                                                                +---------------------------+
```

> 参考：[一文搞懂内核块设备操作之ioctl系统调用过程](https://blog.csdn.net/weixin_71478434/article/details/126551082 )

## 1.1 用户态ioctl和驱动ioctl

系统调用过程中，实际上就是**处于用户空间的用户态ioctl**对应上特定**内核空间中ioctl**的过程

但是用户态没有访问内核空间的权限，因此需要系统先通过`SWI(Software Interrupt)`的方式从用户态陷入内核态，并利用`sys_ioctl`通过**文件操作集**找到对应的驱动ioctl，三者共同构成了Linux I/O控制的核心机制。

### 1）用户态ioctl

在Linux中，glibc/标准库中（`/usr/include/sys`）封装着为用户程序提供的统一`ioctl`接口，在<sys/ioctl.h>中定义了ioctl函数：

```c
extern int ioctl (int __fd, unsigned long int __request, ...) __THROW;
```

- `fd`：设备文件描述符。表示要操作的设备对象。
- `request`：也常将该参数写作`cmd`，表示对设备进行控制的命令，设备驱动将根据cmd参数执行对应的操作
  - 该参数定义了**用户与驱动的“协议”**，虽然可以是任意值，但是Linux中还是提供了统一格式，将32位的int型数据划分成4个位段，来保证参数的唯一性。
- `...`：可选参数，表示对设备进行控制的命令参数，可以是整数、指针等类型，用于传递给驱动程序。

下面讲解一下 `request`/`cmd`参数中的4个位段信息：

- `dir`-2bit：表示数据传输方向（四种）
  - `_IOC_NONE`：无数据传输
  - `_IOC_READ`：数据从内核空间（设备）读取到用户空间
  - `_IOC_WRITE`：数据从用户空间写入到内核空间（设备）
  - `_IOC_READ|_IOC_WRITE`：数据在用户空间和内核空间之间双向传输

- `type`-8bit：设备类型标识符，用于区分不同设备。也成为**幻数/魔数**

- `nr(number)`-8bit：命令序号，用于区分同一设备的不同命令，可以从0~255之间进行编号

- `size`-14bit：表示用户传入的用户数据`...`部分参数的数据类型和长度，单位是字节
  - 系统并不强制使用这个位字段，因此内核不会检查该字段。

```
 31             30           16 15            8 7             0
+---------------+--------------+---------------+---------------+
|     dir       |     size     |    type       |    nr         |
+---------------+--------------+---------------+---------------+
```

假设按照这4个字段来划分`cmd`参数，在宏定义时会定义`_IOC_DIRSHIFT `、`_IOC_TYPESHIFT`、`_IOC_NRSHIFT `、`_IOC_SIZESHIFT`这4个移位值，然后通过移位操作来获取这4个字段的值。

通常，我们不直接使用`ioctl`函数，而是使用一些宏定义，如`_IOC`：

```c
#define _IOC(dir,type,nr,size) \
    (((dir)  << _IOC_DIRSHIFT) | \
     ((type) << _IOC_TYPESHIFT) | \
     ((nr)   << _IOC_NRSHIFT) | \
     ((size) << _IOC_SIZESHIFT))
```

并利用`_IOC`衍生的接口`_IO` `_IOR` `_IOW` `_IOWR` 等来生成指定的ioctl命令：

```c
#define _IO(type,nr)        _IOC(_IOC_NONE,(type),(nr),0)	//定义不带参数的 ioctl 命令
#define _IOR(type,nr,size)  _IOC(_IOC_READ,(type),(nr),(_IOC_TYPECHECK(size)))	//定义											带写参数的 ioctl 命令（copy_from_user）
#define _IOW(type,nr,size)  _IOC(_IOC_WRITE,(type),(nr),(_IOC_TYPECHECK(size)))	//定义											带读参数的ioctl命令（copy_to_user）
#define _IOWR(type,nr,size) _IOC(_IOC_READ|_IOC_WRITE,(type),(nr),(_IOC_TYPECHECK(size)))		//定义带读写参数的 ioctl 命令
```

### 2）sys_ioctl

`ioctl`会让用户态触发中断陷入内核，所以`ioctl`本身也有一个**系统调用号**`__NR_ioctl`，在<arch/arm64/include/asm/unistd32.h>中定义：

中断陷入内核态之后，会根据寄存器传递过来的系统调用号(ARM64中是29)，执行系统调用表中的(29)操作，也就是就是调用`sys_ioctl()`函数。

<!-- <img src="./picture/ioctl的系统调用号.png"> -->

```c
#define __NR_ioctl 29       //ioctl 的系统调用号
```

并在`arch/arm64/kernel/sys.c`中构建系统调用表（也就是**构建系统调用号所映射的系统调用函数**）：

```c
/* 第一步：定义系统调用函数原型 */
#undef __SYSCALL
#define __SYSCALL(nr, sym)	asmlinkage long __arm64_##sym(const struct pt_regs *);
#include <asm/syscall_table_64.h>
/* 第二步：构建系统调用表 */
#undef __SYSCALL
#define __SYSCALL(nr, sym)	[nr] = __arm64_##sym,

const syscall_fn_t sys_call_table[__NR_syscalls] = {
	[0 ... __NR_syscalls - 1] = __arm64_sys_ni_syscall,
#include <asm/syscall_table_64.h>
```

上述系统调用表是基于`syscall_table_64.h`中定义的`__SYSCALL`映射关系来构建的，ioctl 在`syscall_table_64.h`中定义的映射关系为：

```c
__SYSCALL_WITH_COMPAT(29, sys_ioctl, compat_sys_ioctl)
```

也就是系统调用会调用以下函数来处理：

```c
static __attribute__((unused))
long sys_ioctl(unsigned int fd, unsigned int cmd, unsigned long arg)
{
	return my_syscall3(__NR_ioctl, fd, cmd, arg);
}
```

这里`sys_ioctl`函数的为：

```c
asmlinkage long sys_ioctl(unsigned int fd, unsigned int cmd, unsigned long arg);
```

<!-- todo：打个点，这里怎么从sys_ioctl到SYSCALL_DEFINE3的过程还没理清楚 -->

直接通过系统调用表跳转到`SYSCALL_DEFINE3`

```c
SYSCALL_DEFINE3(ioctl, unsigned int, fd, unsigned int, cmd, unsigned long, arg)
{
	CLASS(fd, f)(fd);
	int error;

    // 1. 根据fd找到对应的file结构体
	if (fd_empty(f))
		return -EBADF;
    
    // 2. 检查权限和参数有效性
	error = security_file_ioctl(fd_file(f), cmd, arg);
	if (error)
		return error;
    
    // 3. 调用具体设备的ioctl操作方法：do_vfs_ioctl
	error = do_vfs_ioctl(fd_file(f), fd, cmd, arg);
	if (error == -ENOIOCTLCMD)
		error = vfs_ioctl(fd_file(f), cmd, arg);

	return error;
}
```

在`SYSCALL_DEFINE3`中执行`fd_file(f)`，深挖到该接口里面会发现它将**对应的驱动程序的ioctl加入到了文件操作集**中，由此路由到对应的**驱动ioctl**函数中执行对应的操作。

> [【Linux内核|系统调用】深度分析系统调用从用户程序到内核的流程](https://zhuanlan.zhihu.com/p/694376875 )

### 3）驱动ioctl

内核通过前面的`fd_file(f)`以及所带的命令号`cmd`路由到指定的驱动程序中。根据文件描述符 `fd` 找到对应的文件对象 `struct file *filp`，然后通过这个文件对象的操作集 `file_operations` 中的 `unlocked_ioctl` 成员，最终调用设备驱动中你自己实现的 `mydev_ioctl()` 函数。

假设我们某个中断的目标是路由到`led_ioctl`驱动程序中，该`fd`注册的


```c
// 在file_operations中注册(注册到文件操作集中，供给sys_ioctl路由到这（通过`unlocked_ioctl`）)
static const struct file_operations mydev_fops = {
    .owner = THIS_MODULE,
    .unlocked_ioctl = mydev_ioctl, //mydev_ioctl()为目标驱动函数
    // 其他操作方法...
};
```

在驱动程序中用switch对该设备的`cmd`号进行解析，并执行对应的操作

```c
// 字符设备驱动示例
static long mydev_ioctl(struct file *filp, unsigned int cmd, unsigned long arg)
{
    switch (cmd) {
    case MYDEV_CMD_READ:
        // 处理读取请求
        break;
    case MYDEV_CMD_WRITE:
        // 处理写入请求
        break;
    default:
        return -ENOTTY; // 不支持的命令
    }
    return 0;
}
```

执行里面的驱动函数就能实现完整的系统调用，最后再将结果返回给用户态。

## 1.2 完整调用链


从用户态到驱动层的完整调用链为：

```c
ioctl(fd, cmd, arg)                 // 用户空间调用 ioctl()
    ↓
svc #0                              // 触发系统调用陷入内核态（ARM64架构）
    ↓
x8 = 29                             // 系统调用号 __NR_ioctl
    ↓
sys_call_table[29]                  // 查表，找到 __arm64_sys_ioctl
    ↓
__arm64_sys_ioctl(pt_regs *)        // 架构包装函数，从寄存器提取参数
    ↓
sys_ioctl(fd, cmd, arg)             // SYSCALL_DEFINE3(ioctl, ...) 展开的函数
    ↓
fdget(fd)                           // 获取内核文件描述符结构 struct fd
    ↓
fd_file(f)                          // 提取 struct file *file
    ↓
file->f_op                          // 获取文件操作集 struct file_operations
    ↓
f_op->unlocked_ioctl                // 获取驱动注册的 ioctl 函数指针
    ↓
mydev_ioctl(file, cmd, arg)         // 驱动程序中实现的 ioctl 处理函数
    switch(cmd)                     // 根据cmd处理具体操作（cmd由类似_IO(type,nr)的格式生成）
```

# 2. 驱动ioctl实现例子：KVM

## 用户态：qemu

以 KVM 中的 migration 热迁移中需要确定虚机中 KVM 的扩展能力为例子，在用户态 qemu 中会通过下面的函数来发起**系统调用请求**：

```c
// 用户态：qemu 中
bool kvm_dirty_ring_supported(void)
{
#if defined(__linux__) && defined(HOST_X86_64)
    int ret, kvm_fd = open("/dev/kvm", O_RDONLY);

    if (kvm_fd < 0) {
        return false;
    }

    ret = ioctl(kvm_fd, KVM_CHECK_EXTENSION, KVM_CAP_DIRTY_LOG_RING); //发起系统调用
    close(kvm_fd);

    /* We test with 4096 slots */
    if (ret < 4096) {
        return false;
    }

    return true;
#else
    return false;
#endif
}
```

其中用户态通过句柄`kvm_fd`，也就是 `"/dev/kvm"`来让内核识别出当前是要链路到 kvm 的系统调用中。

通过执行`ioctl(kvm_fd, KVM_CHECK_EXTENSION, KVM_CAP_DIRTY_LOG_RING)`发起系统调用，其中我们关注的 KVM 的扩展能力的`cmd`就是`KVM_CHECK_EXTENSION`。

- `kvm_fd` 是 /dev/kvm 的文件描述符。

- `cmd` = KVM_CHECK_EXTENSION → 实际值是 _IO(KVMIO, 0x03)。

- `arg` = KVM_CAP_DIRTY_LOG_RING → 查询的扩展能力编号。

在 qemu 中`KVM_CHECK_EXTENSION`定义为：

```c
/*
 * Check if a kvm extension is available.  Argument is extension number,
 * return is 1 (yes) or 0 (no, sorry).
 */
#define KVM_CHECK_EXTENSION       _IO(KVMIO,   0x03)
```

## 内核驱动层：kvm 的驱动代码

KVM 驱动在初始化时注册了 `/dev/kvm` 的 `file_operations`：

```c
static struct file_operations kvm_chardev_ops = {
	.unlocked_ioctl = kvm_dev_ioctl,
	.llseek		= noop_llseek,
	KVM_COMPAT(kvm_dev_ioctl),
};
```

意味着该系统调用最终在内核中会调用`kvm_dev_ioctl`函数来处理指令：

```c
static long kvm_dev_ioctl(struct file *filp,
			  unsigned int ioctl, unsigned long arg)
{
    //...
    switch (ioctl) {
    //...
    case KVM_CHECK_EXTENSION:
		r = kvm_vm_ioctl_check_extension_generic(NULL, arg);
		break;
    //...
    }
    //...
}
```

此时：

- ioctl = KVM_CHECK_EXTENSION

- arg = KVM_CAP_DIRTY_LOG_RING

在`kvm_vm_ioctl_check_extension_generic`中我们就可以看到所有可以查询的 KVM 扩展功能，当前我们要查的是 KVM 是否支持`KVM_CAP_DIRTY_LOG_RING`：

```c
static int kvm_vm_ioctl_check_extension_generic(struct kvm *kvm, long arg)
{
    switch (arg) {
    //...
    case KVM_CAP_DIRTY_LOG_RING:
#ifdef CONFIG_HAVE_KVM_DIRTY_RING_TSO
		return KVM_DIRTY_RING_MAX_ENTRIES * sizeof(struct kvm_dirty_gfn);
#else
		return 0;
#endif
    //...
    }
    //...
}
```

KVM 中某些扩展能力的使能和关闭也是按照上面的路径来的，根据不同的`ioctl`来选择干不同的事。

其中，关于设备`/dev/kvm`与`file_operations kvm_chardev_ops`的映射关系是通过 `misc device`（杂项设备）机制注册给内核的：

```c
kvm_init
    +->misc_register(&kvm_dev);

static struct miscdevice kvm_dev = {
	KVM_MINOR,
	"kvm",
	&kvm_chardev_ops,
};
```

执行`misc_register(&kvm_dev)` 时，内核会自动在 `/dev/` 目录下创建一个设备节点，根据`kvm_dev`的定义，这里的设备名就是 `"kvm"`。所以最终 qemu 中需要使用的句柄路径就是：`/dev/kvm`。
