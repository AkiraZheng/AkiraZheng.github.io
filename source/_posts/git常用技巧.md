---
title: git常用技巧
date: 2025-09-03 15:13:31
tags:
---

# 1. 状态类指令
- `git branch`: 查看当前本地所处的 branch、本地中拉的所有的branch
- `git branch -r`: 查看远程所有的分支
- `git status` or `git st`: 当前所处 branch、是否有需要 commit 的
- `git log`: 查看当前 branch 的所有提交记录
- `git log --oneline`: 查看当前 branch 的所有提交记录，每行只显示 commit id 和 commit message
  - 先 cd 到某一个子目录下查看该目录的提交记录，如`cd kernel/drivers/`再执行`git log --oneline`
  - 也可以 cd 到某个目录下查看某个具体文件的提交记录，如`cd kernel/drivers/`再执行`git log -p -- ./pci/pci-acpi.c`
- `git show -1`: 查看当前 branch 的最新一次提交记录

git mm 特有的指令：

- `git mm sync -j64`: 64线程同步远程代码

# 2. 代码提交、合并、push到远程仓库

## 1）代码提交：暂时不推到远程仓中

```shell
git add . # 添加所有文件
git commit -m "xxx" # 本地提交
```
## 2）拉取代码

# 3. 切换分支

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
```

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

# 4. diff 查看修改内容

- `git diff <filrname.c>`
- `git status`

# 5. 撤销修改

- `git stash -m "message"`: 会暂存修改并恢复到未修改状态
- `git restore .`: 取消当前目录下所有修改，且不会暂存

# 6. 在一个已有内容的文件夹下将该内容同步到新的仓库中

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

