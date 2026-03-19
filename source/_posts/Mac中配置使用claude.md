---
title: Mac中配置使用claude
date: 2026-03-06 23:56:21
tags:
---

# 在 terminal 中配置

[安装Claude](https://zhuanlan.zhihu.com/p/2011763523731092738)

[配置glm智谱API（免费版）](https://zhuanlan.zhihu.com/p/1993323826382139976)

[魔塔免费API](https://modelscope.csdn.net/68e774a18867235e138f1912.html)

[灵芽API](https://api.lingyaai.cn/)

# claude code 接入 vscode

上面在terminal部署完且配置好claude code之后，直接在vscode中安装插件`claude code for vs code`，就可以直接用了

<img src=2026-03-19-23-59-25.png>

# Mac 中使用 Claude 的指令

## claude 中的三种模式

claude中有三种模式，用`shift + tab`可以切换，这三种模式如下所示：

<img src=2026-03-07-00-15-07.png>

如果想在其他编辑器中编辑输入内容，可以按`ctrl+g`，这个时候就可以自动跳转到vscode中了（默认编辑器）。

## claude 直接执行终端指令

在claude中输入`!<终端指令>`，就可以直接执行终端指令了。

## 其他常用指令

**启动**

```shell
# 自动读取当前目录代码
# 创建一个新的 session
claude
```

**会话管理**

```shell
claude
```

开启一个新会话后，在新会话中执行以下命令重命名当前会话：

```shell
/rename <新的会话名称>
# 例如：/rename linux常用技巧
```

查看所有会话：

```shell
claude --resume
```

rename 完之后可以通过以下方式启用这个会话：

```shell
claude --resume "linux内核"
```

或者先`claude`进入到 claude 的交互界面中，然后输入以下指令查看所有会话：

```shell
/resume
```

并通过以下指令启用某一个会话：

```shell
/resume <会话名称>
```

删除某一个会话：去`.claude/proects/`目录下物理删除

延续上次的会话：

```shell
claude -c
claude --continue
``` 

**退出**

连续按两次 `Ctrl + C`，或者直接输入以下指令：

```shell
claude exit
```

**claude命令代码回滚**

```claude
/rewind
```

或者按两次`esc`进入到回滚界面，可以看到我们可以回滚的节点

# .json配置

在`~/.claude/config.json`中可以配置一些claude的参数，以下是一些常用的参数：

**智谱配置**

```json
{
    "env": {
        "ANTHROPIC_AUTH_TOKEN": "<你的智谱API密钥>",
        "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
        "API_TIMEOUT_MS": "3000000",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
		"ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7"
    }
}
```

**deepseek配置**

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "<你的deepseek API密钥>",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-chat",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-chat"
  }
}
```