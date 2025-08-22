---
title: 进制转换CPP版
date: 2025-08-22 23:47:25
tags:
categories:
  - 数据结构与算法
---

# 一、十进制 <-> 二进制

## 1.1 十进制 -> 二进制

在做笔试时，最好还是用现有的转换函数，方便点：

- `bitset<多少位的二进制> b(decNum);`

```c++
string dec2Bin(int n) {
    bitset<32> b(n);
    return b.to_string();
}
```

最后是最原始的方法，纯C++实现：
```c++
int dec2Bin(int n) {
    int bin = 0;
    int i = 0;
    while (n != 0) {
        bin += (n % 2) * pow(10, i);
        n /= 2;
        i++;
    }
    
    return bin;
}
```

## 1.2 二进制 -> 十进制

做笔试时，最好还是用现有的转换函数，方便点：

- `stoi(binNum, 指针, 进制基数);`

```c++
uint32_t bin2Dec(string binStr) {
    uint32_t decNum = stoi(binStr, 0, 2);
    return decNum;
}
```

最原始的方法：

```c++
int bin2Dec(int n) {
    int dec = 0;
    int i = 0;
    while (n != 0) {
        dec += (n % 10) * pow(2, i);
        n /= 10;
        i++;
    }
    return dec;
}
```

# 二、十进制 <-> 十六进制

## 2.1 十进制 -> 十六进制

```c++
string dec2Hex(uint32_t decNum) {
    stringstream ss;
    ss << hex << decNum;
    return ss.str();
}
```

## 2.2 十六进制 -> 十进制

```C++
uint32_t hex2Dec(string hexStr) {
    uint32_t decNum = stoi(hexStr, 0, 16);
    return decNum;
}
```

# 三、二进制 <-> 十六进制

二进制跟十六进制的转换需要借助十进制作为介质

## 3.1 二进制 -> 十六进制


```c++
string bin2Hex(string binStr) {
    stringstream ss;
    ss << hex << stoi(binStr, 0, 2);
    return ss.str();
}
```

## 3.2 十六进制 -> 二进制

```c++
string hex2Bin(string hexStr) {
    uint32_t decNum = stoi(hexStr, 0, 16);
    bitset<32> b(decNum);
    return b.to_string();
}
```

# 四、大小写转换

其实可以不需要函数，直接通过`'a' - 'A'`的差值进行转换，然后逐个转换就行
- 小写字母转大写字母：`char c = c0 - ('a' - 'A');`
- 大写字母转小写字母：`char c = c0 + ('a' - 'A');`

# 参考

> [C++中二进制、字符串、十六进制、十进制之间的转换](https://blog.csdn.net/MOU_IT/article/details/89060249)