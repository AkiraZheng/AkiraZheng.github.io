---
title: KMP算法
date: 2024-04-29 20:22:31
tags:
categories:
- 数据结构与算法
---

# 前言

> 最主要是掌握KMP算法的**next数组**的构建过程，具体的解法看参考的文章，讲得很好

# 一、KMP算法Next构建

<img src="createNext.png" width="70%">

# 二、代码实现（C++）

```c++
void getNext(vector<int> &next, string templateStr) {
	int i = 0;//后缀结尾
	int j = 0;//前缀结尾

	int str_size = templateStr.size();
	next = vector<int>(str_size);
	next[0] = 0;

	for (i = 1; i < str_size; ++i) {
		//前缀跟后缀不相等的话，说明得往前查找
		while (j > 0 && templateStr[j] != templateStr[i]) {
			j = next[j-1];
		}

		//前缀跟后缀相等的话，说明可以往后移一位了
		if (templateStr[j] == templateStr[i]) {
			++j;
		}

		//构建当前后缀的最长前缀
		next[i] = j;
	}
}
```

```c++
int KMP(vector<int>& next, string templateStr, string searchStr) {
	int i = 0;//searchStr的
	int j = 0;//templateStr的

	for (; i < searchStr.size(); ++i) {
		//跟模板不相等则跳转到模板对应的位置
		while (j > 0 && templateStr[j] != searchStr[i]) {
			j = next[j-1];
		}

		//跟模板相等则模板指针加一，说明可以对下一个字符进行判断
		if (templateStr[j] == searchStr[i]) {
			++j;
		}

		//已经找全了（模板指针指向末尾）
		if (j == templateStr.size()) return i-templateStr.size()+1;
	}

	//没找到
	return -1;
}
```

# 三、测试

```c++

int main() {

	vector<int> next;
	string s = "ababaca";

	myKMP kmp;
	kmp.getNext(next, s);
	for (int i = 0; i < s.size(); ++i) {
		cout << next[i] << " ";
	}
	cout << endl;

	cout << kmp.KMP(next, s, "bacbababadababacambabacaddababacasdsd");

	return 0;
}
```

# 四、相关leetcode题目

- [28. 实现 strStr()](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/description/)
- [459. 重复的子字符串](https://leetcode-cn.com/problems/repeated-substring-pattern/)

# 总结

> 参考：[字符串匹配KMP算法的讲解C++](https://www.cnblogs.com/lijingran/p/8619711.html)
