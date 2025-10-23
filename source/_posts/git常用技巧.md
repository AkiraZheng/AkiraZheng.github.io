---
title: git常用技巧
date: 2025-09-03 15:13:31
tags:
---

# 状态类指令
- `git branch`: 查看当前本地所处的 branch、本地中拉的所有的branch
- `git branch -r`: 查看远程所有的分支
- `git status` or `git st`: 当前所处 branch、是否有需要 commit 的
- `git log`: 查看当前 branch 的所有提交记录
- `git log --oneline`: 查看当前 branch 的所有提交记录，每行只显示 commit id 和 commit message
  - 先 cd 到某一个子目录下查看该目录的提交记录，如`cd kernel/drivers/`再执行`git log --oneline`
  - 也可以 cd 到某个目录下查看某个具体文件的提交记录，如`cd kernel/drivers/`再执行`git log -p -- ./pci/pci-acpi.c`
- `git show -1`: 查看当前 branch 的最新一次提交记录
- `git show <commit id>`
- `git log --pretty=format:"%cd %h %s" --date=short`: 显示当前 branch 的所有提交记录，每行只显示 commit id、commit message、提交时间

git mm 特有的指令：

- `git mm sync -j64`: 64线程同步远程代码

# 代码提交、合并、push到远程仓库

## 1）代码提交：暂时不推到远程仓中

```shell
git add . # 添加所有文件
git commit -m "xxx" # 本地提交
```
## 2）拉取代码

# 切换分支

切换前最好先暂存一下当前的代码修改内容：

```shell
# 暂存当前修改，需要切到修改的子仓库下
git stash -m "message"

# 此时会显示clean
git status

# 查看缓存的东西
git stash list
```

然后再切换到分支中：

```shell
git checkout old_branch # 切换到旧分支old_branch中
#git checkout -b new_branch # 创建并切换到新分支
# git checkout -b <new-branch-name> <commit-hash> # 创建并切换到新分支并切换到指定commit
    # 如：git checkout -b my_lab 3262911
    # 这种方式类似于 git reset --hard 3262911
```

切换到某次提交中（注意，切换到后面的提交后就看不到最新的commit id了，所以最好是创建一个分支，或者先把最新的commit id记下）

`git reset --hard <commit id>`

后面有需要的话还要恢复到暂存状态（恢复暂存代码）：

```shell
# 恢复特定的 stash （例如：stash@{2}）
git stash apply stash@{2}
# git stash pop # 恢复并删除栈顶的 stash
# 恢复所有 stash
#git stash apply
# git stash drop # 删除栈顶的 stash
# git stash drop stash@{2} # 删除特定的 stash
#git stash clear # 清空所有 stash
```

修改完代码也可以取消修改：

```shell
git restore ./* # 取消当前目录下所有修改
#git restore ./<path>
```

# 查看分支领先/落后提交数

`git branch -v --abbrev=0`

# 删除分支

删除分支前需查看分支是否已经合并：

`git branch --merged`

删除分支前先切换到其他分支中：

`git checkout master`

删除某个已经被合并的分支：

`git branch -d <branch_name>`

删除未合并的分支（强制删除）：

`git branch -D <branch_name>`

# diff 查看修改内容

- `git diff <filrname.c>`
- `git status`
- `git diff <old_commit_id> <new_commit_id>`：顺序很重要，git diff A B 表示从 A 提交到 B 的修改，B 一般是比较新的提交，A 一般是比比较旧的提交

# 制作.patch文件存储当前工作夹的修改

## 针对某个文件

`git diff > xxx.patch`，可以指定文件名 `xxx.patch`

`git format-patch -1`

记事本打开这个文件就能看到你的修改内容

## 通过.patch文件恢复代码

`git apply xxx.patch`

# 撤销修改

- `git stash -m "message"`: 会暂存修改并恢复到未修改状态
- `git restore .`: 取消当前目录下所有修改，且不会暂存

# 在一个已有内容的文件夹下将该内容同步到新的仓库中

```shell
git init # 初始化一个git仓库
git remote -v # 验证当前仓库是否已经关联了远程仓库
# 逐个尝试下面的指令添加远程仓库
# git remote set-url origin <url> # 在当前已经关联了一个其他仓库的情况下，更改远程仓库
# git remote add origin <url> # 添加远程仓库
add .
commit -m "xxx"
```

如果原先没有关联过其他仓库，那么还得进行一些分支的操作，如果之前已经有分支，那么可以直接`push`到新仓库中

```shell
git branch --set-upstream-to=origin/master  master # 设置当前分支的远程分支
git pull origin master --allow-unrelated-histories # 拉取远程仓库的分支, 允许不相关的历史
git push origin master # 推送到远程仓库
# git push -u origin master # 推到远程仓库的同时，设置当前分支的远程分支
# git push -u origin my_lab # 把本地 my_lab 直接推到远程（远程没有会自动创建）
```
然后就可以观察远程仓库上是不是已经被 push 上去了

# git am 拉取邮件补丁

## 下载并添加补丁（能丝滑成功的话）

从所订阅的 Linux 模块中拼凑下面的链接，并找到相应的补丁进行下载：

1. 从[Linux KVM - Patchwork](https://patchwork.kernel.org/project/kvm/list/?state= *&archive=both&series=&submitter=&delegate=)中找到对应的patch，逐个点击保存所有的子patch
    
    - 下载后得到的文件为：`v1-1-5-arm64-sysreg-add-HDBSS-related-register-information.patch`

2. 在 Linux 源码仓库根目录下应用（推荐）：

    ```bash
    cd ~/linux   # 这里是你 clone 下来的主线源码目录
    git checkout -b feat-hdbss  # 建议新建一个分支，避免污染主线代码
    git am /path/to/*.patch
    ```
    
    这样就会把整个 patch 系列应用到当前分支。

当然 patch 有可能是很久以前写的，跟当前最新 master 分支的代码不兼容，导致 `git am` 命令失败。此时需要更换为`git am --3way`命令，并手动解决冲突rebase。

## patch合入失败时rebase
### 方法：从主线上一个一个patch进行rebase

如果`git am`直接报error的话，是不给我们 merge 的机会的，此时先`git am --abort`然后`git am --3way`，用这种方式来添加patch，然后手动 rebase

`git am --3way xxx.patch`：添加patch

`git am --3way --keep-no-patch`：添加patch，并保留没有冲突的文件

此时`git status`后就能看到需要我们手动 rebase 的文件：

<!-- ![](picture/2025-10-15-17-49-27.png) -->

`git status`查看`Umerged`的文件，然后手动修改`Unmerged`的文件

修改完后执行以下语句:

```bash
git add <修改的文件名>
git status #查看冲突是不是全部解决了，确保没有unmerged的文件
git add .
# git add arch/arm64/include/asm/sysreg.h tools/arch/arm64/include/asm/sysreg.h
git am --continue
```

<!-- 冲突全部解决的情况如下： -->

<!-- ![](picture/2025-10-16-09-11-06.png) -->

然后重复上面所有步骤，直到所有patch全部被添加进来

### 对于 git am --3way 依然解决不了的问题，通过 .rej 手动解决

```shell
[shell]git am --3way v1-4-5-arm64-kvm-support-to-handle-the-HDBSSF-event.patch
Applying: arm64/kvm: support to handle the HDBSSF event
error: sha1 information is lacking or useless (arch/arm64/kvm/arm.c).
error: could not build fake ancestor
Patch failed at 0001 arm64/kvm: support to handle the HDBSSF event
hint: Use 'git am --show-current-patch=diff' to see the failed patch
When you have resolved this problem, run "git am --continue".
If you prefer to skip this patch, run "git am --skip" instead.
To restore the original branch and stop patching, run "git am --abort".
```

用git bash强制应用补丁，再手动处理问题文件。具体步骤如下：

1） 执行`git am --3way --ignore-space-change --keep-cr --reject xxx.patch`。其中--reject指示工具将patch不可应用的部分保存为*.rej文件。
    
- 如果补丁缺少 index 信息用`git apply --reject --ignore-space-change`，但是这种方式需要自己重新commit，不推荐

2）打开*.rej会有没添加的patch相关代码内容，手动修改相应未生效patch的文件。然后删除.rej文件。

3）执行git add。将所有需要提交的文件添加到缓存区。因为应用失败，所以应用patch过程停在了修改文件的流程，需要我们手动修改和提交，完成工具无法自动完成的流程。

4）执行git am --continue。继续完成补丁的应用，成功即表示应用patch生效。

步骤 1） 执行后的结果：

```shell
[zhengtian@localhost linux]$ git am --3way --ignore-space-change --keep-cr --reject v1-4-5-arm64-kvm-support-to-handle-the-HDBSSF-event.patch
Applying: arm64/kvm: support to handle the HDBSSF event
error: sha1 information is lacking or useless (arch/arm64/kvm/arm.c).
error: could not build fake ancestor
Patch failed at 0001 arm64/kvm: support to handle the HDBSSF event
hint: Use 'git am --show-current-patch=diff' to see the failed patch
When you have resolved this problem, run "git am --continue".
If you prefer to skip this patch, run "git am --skip" instead.
To restore the original branch and stop patching, run "git am --abort".
[zhengtian@localhost linux]$ git status
On branch feat-hdbss
You are in the middle of an am session.
  (fix conflicts and then run "git am --continue")
  (use "git am --skip" to skip this patch)
  (use "git am --abort" to restore the original branch)

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   arch/arm64/kvm/arm.c
        modified:   arch/arm64/kvm/handle_exit.c

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        arch/arm64/kvm/mmu.c.rej

no changes added to commit (use "git add" and/or "git commit -a")
```

添加进来patch后，可以删除.rej文件，然后将当前的修改合入到仓库中：

```shell
git log --oneline
# 记下添加进来的patch的commit id
git checkout master
git cherry-pick <patch-commit-id>
# 确保你不在要删除的分支中
git branch -d <branch-name>
# git branch -D <branch-name> # 强制删除分支
```