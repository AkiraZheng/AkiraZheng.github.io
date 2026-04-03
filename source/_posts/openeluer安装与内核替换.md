---
title: openeluer安装与内核替换
date: 2025-08-17 20:15:29
tags:
---

> 前言
> 
> 主机系统：Sonoma 14.4.1（x86）
> 
> 虚拟软件：VMware Fusion
> 
> openeluer系统：openEuler-24.03-LTS-SP2-x86_64-dvd.iso
> 
> 内核选择：linux 5.x 内核 64G
> 

# 一、Mac工具准备

1. 虚拟软件：[VMware Fusion](https://mp.weixin.qq.com/s/Mg4byIT8W1ys-odz5Yk9Gw)
2. ssh远程控制软件：[Termius](https://www.mac78.com/911.html#J_DLIPPCont)

# 二、虚拟机安装openeluer系统

首先去欧拉官网下载openeluer系统镜像文件：[openEuler](https://www.openeuler.org/zh/download/)，下载LTS长期支持的版本

<img src="openeluer官网.png">

镜像文件下载完成后，在虚拟软件 `VMware Fusion` 中创建虚拟机，选择镜像文件并拖入到 `VMware` 中：

<img src="1. 新建.png">

然后选个linux内核和固件后直接安装：

<img src="3. 选个内核.png">

<img src="4. 选择固件.png">

然后选择自定义配置进行配置：

<img src="5. 自定义配置.png">

常选择的配置如下(可以通过**虚拟机->设置**打开配置界面)：

<img src="6. 选择需要修改的配置进行修改.png">

先分配一个较大的磁盘空间：

<img src="7. 分配一个较大的固态存储.png">

选择**显示全部**回到配置选择界面：

<img src="6_1. 返回去配置前面的选项.png">

然后继续配置内存，将内存配置为4G（一定要换，最低4G）：

<img src="8. 分配4GB的内存.png">

配置完硬件配置后，就可以直接开启虚拟机进行安装了：

<img src="9.配置完就可以直接开启虚机.png">

进行系统配置，经常修改的配置项：

<img src="11. 选择需要配置的内容.png">

首先语言选择中文和英文：

<img src="10. 选择语言.png">

然后开启root：

<img src="12. 启用root用户.png">

安装目的地可以不用改：

<img src="13. 安装目的地.png">

打开网络选项：

<img src="14. 打开网络.png">

因为我是学习虚拟化的，所以选择了虚拟机配置，否则的话可以选择服务器即可：

<img src="15. 虚拟化学习选择虚拟化主机_否则可以选服务器.png">

然后开始安装，等待一段时间后完成安装就能进入系统：

<img src="16. 然后开始安装.png">

<img src="17. 安装中.png">

安装完成后，进入系统：

<img src="18. 安装完成重启系统.png">

输入刚刚配置的root账号密码：

<img src="19. 输入刚刚配置的root账号密码.png">

# 三、Termius中添加虚拟机

首先查看虚拟机地址：

<img src="20. 找到虚拟机的ip_用远程连接工具连接.png">

然后在termius中添加虚拟机：

<img src="termius添加虚拟机.png">

# 四、进行内核替换

内核替换主要参考[openeluer的内核更新与替换](https://blog.csdn.net/m0_56602092/article/details/118604262)

首先查看当前安装了的linux内核版本：

<img src="openeluer初始内核_linux.png">

## 4.1 清理源代码树

进入解压好的源码文件夹执行命令，清理过去内核编译产生的文件，第一次编译时可不执行此命令

```shell
make mrproper
```
## 4.2 生成内核配置文件.config

可以先将将系统原配置文件拷贝过来，原配置文件在`/boot`目录下，输入`config-`后tab一下就出来了

```shell
mkdir ../cpConfig
cp -v /boot/config-$(uname -r) ../cpConfig
```

执行依赖安装

```shell
yum install ncurses-devel
```

进入配置界面，直接选择默认配置，然后选择Save，生成了一个.config文件：

<img src="23. 配置内核.png"> 

<img src="23_1. 配置内核.png">

<img src="23_2. 配置内核.png">

然后按`Exit`保存刚刚的config信息

最后需要禁用证书、BTF，否则后面编译会失败：

```shell
vim .config
```

<img src="23_3. 配置内核_禁用证书_vim查看.png">

<img src="23_4. 配置内核_禁用证书.png">

<img src="23_5.%20配置内核_BTF.png">

## 4.3 内核编译及安装

执行编译前先安装所需组件

```shell
yum install elfutils-libelf-devel
yum install openssl-devel
yum install bc
```


然后执行make开始编译，编译大概要一段时间，这个过程需要保证连接的稳定，中断了就要重新编译了

```shell
make -j$(nproc)
# make -j4
```

通常内核编译是一个 计算密集型任务，建议使用 -j 参数指定 CPU 核心数 来加速编译。

编译完成后，可以安装生成的 vmlinuz 文件：

```shell
make modules_install
make install
```

<img src="25. makeInstall安装内核结果.png">

生成的新内核可以在 /boot/ 目录下查看：

<img src="26. 生成的新内核.png">

## 4.4 更新引导

下面的命令会根据 /boot/ 目录下的内核文件自动更新启动引导文件。

```shell
grub2-mkconfig -o /boot/grub2/grub.cfg
```

然后重启系统就可以看到多个内核，其中一个就是我们新安装的内核，可自由选择一个内核启动系统。

```shell
reboot
```

<img src="27. 选择新的内核.png">

重启完后可以确认新的内核是否生效：

```shell
uname -a
```

<img src="28. 确认新内核.png">

# 五、支持远程ssh连接

编辑 SSH 配置文件：

```shell
vi /etc/ssh/sshd_config
```

找到并修改以下参数：

```shell
AllowTcpForwarding yes   # 取消注释或添加此行
```

保存文件并重启 SSH 服务：

```shell
systemctl restart sshd  # 大多数 Linux 系统
```

# 六、在 mac host 上通过 qemu 启动虚机

首先要安装 qemu：

```shell
brew install qemu
```

然后查找本地的 fd 固件：

```shell
# 查找固件文件
find /opt/homebrew/Cellar/qemu -name "edk2-aarch64-code.fd" 2>/dev/null
```

然后在[欧拉官网下载 qcow2 文件](https://repo.openeuler.org/openEuler-24.03-LTS/virtual_machine_img/aarch64/)：`openEuler-24.03-LTS-aarch64.qcow2.xz`，下载后解压：

```shell
xz -d openEuler-24.03-LTS-aarch64.qcow2.xz
```

启动虚机：

```shell
qemu-system-aarch64 \
  -machine virt,accel=hvf -cpu host \
  -smp 4 \
  -m 4G \
  -bios edk2-aarch64-code.fd \
  -drive file=openEuler-24.03-LTS-aarch64.qcow2,if=none,id=hd0,format=qcow2 \
  -device virtio-blk-pci,drive=hd0 \
  -netdev user,id=net0,hostfwd=tcp::2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -nographic
```

欧拉 qcow2 的默认账号密码（进入后密码通常修改成root就行）：

- 用户名: root
- 密码: openEuler12#$

之后就可以使用 ssh 登录虚机了：

## macos 中免密登录到虚机中

成功以root登录后，执行以下命令：

```bash
# 1. 编辑SSH配置文件
vi /etc/ssh/sshd_config
```

在文件中找到并修改以下配置（按 i 进入编辑模式）：

```bash
# 确保这些行没有被注释（行首没有#号）
PasswordAuthentication yes
PermitRootLogin yes
PubkeyAuthentication yes
ChallengeResponseAuthentication yes
```

如果找不到这些行，就手动添加。

保存退出：按 ESC，输入 :wq，回车。

```bash
# 2. 重启SSH服务
systemctl restart sshd

# 3. 验证SSH服务状态
systemctl status sshd
```

然后使用密钥认证实现免密登录，在host中查找公钥文件（如果没有的话就创建自己的公钥）：

```bash
cat ~/.ssh/id_rsa.pub
```

在虚拟机内执行：

```bash
# 创建.ssh目录
mkdir -p /root/.ssh

# 添加你的公钥
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC..." >> /root/.ssh/authorized_keys

# 设置正确的权限
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
```

注意：公钥内容就是 `~/.ssh/id_rsa.pub` 文件的内容。

从Mac端重新连接：

```bash
# 或者使用密钥登录
ssh -p 2222 root@127.0.0.1
```

## 自动挂载9P

```shell
qemu-system-aarch64 \
  -machine virt,accel=hvf -cpu host \
  -smp 4 \
  -m 4G \
  -bios edk2-aarch64-code.fd \
  -drive file=openEuler-24.03-LTS-aarch64.qcow2,if=none,id=hd0,format=qcow2 \
  -device virtio-blk-pci,drive=hd0 \
  -netdev user,id=net0,hostfwd=tcp::2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -virtfs local,path=../kernel,mount_tag=host-kernel,security_model=mapped \
  -nographic
```

从Mac host通过SSH执行以下命令，在虚拟机中配置自动挂载。

首先配置 /etc/fstab：

```bash
ssh -p 2222 root@127.0.0.1 "echo 'host-kernel /mnt/kernel 9p trans=virtio,version=9p2000.L 0 0' >> /etc/fstab"
```

创建挂载点目录并验证配置：

```bash
ssh -p 2222 root@127.0.0.1 "mkdir -p /mnt/kernel && cat /etc/fstab | grep kernel"
```

手动挂载测试：

```bash
# 创建挂载点并挂载
ssh -p 2222 root@127.0.0.1 "mkdir -p /mnt/kernel && mount -t 9p -o trans=virtio,version=9p2000.L host-kernel /mnt/kernel"

# 验证挂载
ssh -p 2222 root@127.0.0.1 "ls /mnt/kernel"
```

如果能看到文件就成功了。重启虚拟机后会自动挂载。


## qemu tcg 启动

<!-- numactl -N 0 -m 0 qemu-system-aarch64 -machine virt,kernel_irqchip=on,gic-version=3,virtualization=true -net none \
-cpu max -kernel Image -initrd minifs.cpio.gz -bios QEMU_EFI.fd \
-m 8G -smp 8,sockets=1,cores=8,threads=1 \
-nographic -append "rdinit=init console=ttyAMA0 earlycon=ttyAMA0 selinux=0" \
-fsdev local,security_model=passthrough,id=fsdev0,path=./qemu-shared \
-device virtio-9p-pci,id=fs0,fsdev=fsdev0,mount_tag=p9 \
-netdev tap,id=mynet1,ifname=tap1,script=./qemu-ifup-nat,downscript=./qemu-ifdown-nat \
-device virtio-net-pci,netdev=mynet1,id=net0 -->

```shell
qemu-system-aarch64 \
  -machine virt,virtualization=true -cpu max \
  -smp 8 \
  -m 6G \
  -bios edk2-aarch64-code.fd \
  -drive file=openEuler-24.03-LTS-aarch64.qcow2,if=none,id=hd0,format=qcow2 \
  -device virtio-blk-pci,drive=hd0 \
  -netdev user,id=net0,hostfwd=tcp::2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -virtfs local,path=../kernel,mount_tag=host-kernel,security_model=mapped \
  -nographic
```

关键点是要加上`virtualization=true`，然后`-cpu max`

## lkvm 编译

```shell
git clone https://git.kernel.org/pub/scm/linux/kernel/git/will/kvmtool.git
cd kvmtool
```

修改 Makefile，将 LDFLAGS 设为静态编译：

```shell
# 原来
LDFLAGS       :=
# 改为
LDFLAGS := -static
```

安装依赖：

```shell
dnf install -y dtc libfdt-devel glibc-static glib2-devel
```

执行静态编译：

```shell
make ARCH=arm64 CC="gcc -static"

file lkvm
```

> [lkvm编译运行](https://www.yuanguohuo.com/2024/07/22/virtualization-3-kvmtool-playaround/)

## 从qemu虚机中启动lkvm就可以实现代码调试

启动 lkvm 的时候还需要在 qcow2 起的虚机中编译好启动 lkvm 需要的最小根文件系统`initramfs.cpio.gz`，可以直接使用附件中的脚本【注意，用脚本中的方式启的lkvm是不能用的，这里是为了在作为 host 的 qemu 中验证 stage 2 页表是否能用而已，所以倒也不需要lkvm能用，只要它能起来就行】

启动 lkvm：

<!-- ./lkvm run -k Image -i minifs.cpio.gz -m 4G -smp 4 -net none -nographic -->

```shell
./lkvm run --name testvm \
    -k Image \
    --initrd initramfs.cpio.gz \
    --console serial \
    --params "console=ttyS0 rdinit=/init" \
    -m 512 \
    --nodefaults
```

## 给挂在的仓库添加虚机的git权限

在虚机中执行：

```bash
# 如果还是卡住，先移除可能存在的配置
git config --global --unset safe.directory /mnt/kernel

# 重新添加
git config --global --add safe.directory /mnt/kernel

# 验证配置
git config --global --get-all safe.directory
```

# 附件

**build-initramfs.sh**

```shell
#!/bin/sh
set -e

# Output directory (current working directory by default)
OUTPUT_DIR="${1:-$(pwd)}"
WORK_DIR="$OUTPUT_DIR/initramfs"

echo "Building initramfs in $OUTPUT_DIR..."

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)   LD_ARCH="ld-linux-x86-64.so.2" ;;
    i386|i686) LD_ARCH="ld-linux.so.2" ;;
    aarch64)  LD_ARCH="ld-linux-aarch64.so.1" ;;
    arm*)     LD_ARCH="ld-linux-arm" ;;
    *)        LD_ARCH="ld-linux" ;;
esac

# Find library path dynamically
find_lib() {
    local libname="$1"
    # Search in common library locations
    for dir in /lib /lib64 /usr/lib /usr/lib64 /lib32; do
        if [ -f "$dir/$libname" ]; then
            echo "$dir/$libname"
            return 0
        fi
    done
    # Use ldconfig to find library
    if command -v ldconfig >/dev/null 2>&1; then
        result=$(ldconfig -p 2>/dev/null | grep "$libname" | head -1 | awk '{print $NF}')
        if [ -n "$result" ]; then
            echo "$result"
            return 0
        fi
    fi
    return 1
}

# Copy a binary and all its required libraries
copy_binary() {
    local src="$1"
    local dest_dir="$2"
    local bin_name=$(basename "$src")

    # Resolve symlinks to get real binary
    if [ -L "$src" ]; then
        real_bin=$(readlink -f "$src" 2>/dev/null || echo "$src")
    else
        real_bin="$src"
    fi

    mkdir -p "$dest_dir"

    # Copy the binary
    cp "$real_bin" "$dest_dir/$bin_name"

    # Copy libraries needed by this binary using ldd
    if command -v ldd >/dev/null 2>&1; then
        ldd "$real_bin" 2>/dev/null | grep -E '=>' | awk '{print $3}' | while read -r lib; do
            # Handle virtual libraries
            [ -z "$lib" ] && continue
            [ ! -f "$lib" ] && continue

            lib_name=$(basename "$lib")

            # Determine destination based on path
            case "$lib" in
                */lib64/*)
                    mkdir -p "$dest_dir/lib64"
                    lib_dest="$dest_dir/lib64"
                    ;;
                */lib32/*)
                    mkdir -p "$dest_dir/lib"
                    lib_dest="$dest_dir/lib"
                    ;;
                *)
                    mkdir -p "$dest_dir/lib"
                    lib_dest="$dest_dir/lib"
                    ;;
            esac

            # Avoid duplicate copies
            if [ ! -f "$lib_dest/$lib_name" ]; then
                cp "$lib" "$lib_dest/$lib_name"
            fi
        done
    fi
}

# Resolve command path
resolve_cmd() {
    local cmd="$1"
    # Try command -v first, fall back to which
    if command -v "$cmd" >/dev/null 2>&1; then
        command -v "$cmd"
    elif command -v which >/dev/null 2>&1; then
        which "$cmd" 2>/dev/null
    fi
}

# 1. Create directory structure
mkdir -p "$WORK_DIR"/bin "$WORK_DIR"/sbin "$WORK_DIR"/etc "$WORK_DIR"/proc
mkdir -p "$WORK_DIR"/sys "$WORK_DIR"/dev "$WORK_DIR"/lib "$WORK_DIR"/lib64 "$WORK_DIR"/run

# 2. List of required binaries (name:path format, one per line)
# Format: name|path|destdir
BINARIES="
bash|/bin/bash|bin
sh|/bin/sh|bin
ls|/usr/bin/ls|bin
cat|/usr/bin/cat|bin
echo|/usr/bin/echo|bin
mkdir|/usr/bin/mkdir|bin
switch_root|/usr/sbin/switch_root|sbin
switch_root|/sbin/switch_root|sbin
mount|/usr/bin/mount|bin
umount|/usr/bin/umount|bin
sleep|/usr/bin/sleep|bin
"

# 3. Copy binaries
echo "$BINARIES" | while IFS='|' read -r name path destdir; do
    [ -z "$name" ] && continue
    resolved=$(resolve_cmd "$name")

    if [ -n "$resolved" ] && [ -f "$resolved" ]; then
        echo "Copying $name from $resolved"
        copy_binary "$resolved" "$WORK_DIR/$destdir"
    else
        echo "Warning: $name not found, skipping"
    fi
done

# 4. Copy the dynamic linker
copy_ld() {
    for pattern in /lib64/ld-linux*.so.* /lib/ld-linux*.so.* /lib/*/ld-linux*.so.*; do
        case "$pattern" in
            *\*) continue ;;
        esac
        if [ -f "$pattern" ]; then
            ld_name=$(basename "$pattern")
            mkdir -p "$WORK_DIR/lib64"
            cp "$pattern" "$WORK_DIR/lib64/$ld_name"
            # Create versioned symlink
            if [ -L "$pattern" ]; then
                target=$(readlink "$pattern")
                case "$target" in
                    ld-*.so.*)
                        ln -sf "$target" "$WORK_DIR/lib64/${target%.so.*}.so" 2>/dev/null || true
                        ;;
                esac
            fi
            return 0
        fi
    done
    return 1
}
copy_ld

# 5. Create init script
cat > "$WORK_DIR/init" << 'INITEOF'
#!/bin/sh
echo "initramfs booting..."
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
echo "Welcome to LKVM!"
exec /bin/sh
INITEOF
chmod +x "$WORK_DIR/init"

# 6. Package initramfs
cd "$WORK_DIR"
if command -v cpio >/dev/null 2>&1; then
    find . -print0 | cpio -o -H newc --null | gzip > "$OUTPUT_DIR/initramfs.cpio.gz"
else
    echo "Error: cpio not found"
    exit 1
fi

if [ -f "$OUTPUT_DIR/initramfs.cpio.gz" ]; then
    size=$(ls -lh "$OUTPUT_DIR/initramfs.cpio.gz" | awk '{print $5}')
    echo "Done! initramfs.cpio.gz created: $size"
else
    echo "Error: Failed to create initramfs.cpio.gz"
    exit 1
fi
```

# 参考

> 0. [Fusion 或 Vmware 安装 openEuler 20.03 最小镜像](https://segmentfault.com/a/1190000040810052)
> 
> 1. [VM虚拟机中安装openeluer](https://blog.csdn.net/2302_82189125/article/details/137759482)
> 
> 2. [macOS中vmware Fusion的虚拟机创建](https://blog.csdn.net/m0_61998604/article/details/145700767)
> 
> 3. [openeluer的内核更新与替换：主要参考](https://blog.csdn.net/m0_56602092/article/details/118604262)
> 
> 4. [探秘内核：openEuler的内核编译实战指南【华为根技术】](https://bbs.huaweicloud.com/blogs/452112)
> 
> 5. [OpenEuler内核编译及替换](https://blog.csdn.net/m0_56602092/article/details/118604262)
> 