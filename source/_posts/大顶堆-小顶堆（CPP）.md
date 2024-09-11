---
title: 大顶堆/小顶堆（CPP）
date: 2024-05-15 18:30:22
tags:
categories:
- 数据结构与算法
---

# 一、priority_queue

C++中实现大/小顶堆的数据结构是`priority_queue`，其**默认是大顶堆**，如果要实现小顶堆，需要传入第三个参数`greater<int>`。

`priority_queue`结构有三个传参：
- 第一个参数**type**：进行排序的数据类型
- 第二个参数**container**：底层存储根堆的容器类型，默认是`vector`，且只能是**数组类型**，所以不能是`list`等
- 第三个参数**compare**：比较函数，用于实现大顶堆或小顶堆

函数原型：
```cpp
#include <queue>

// priority_queue<type, container, container>;
priority_queue<int, vector<int>, greater<int>> q;//小顶堆
```

# 二、比较函数的设计

`priority_queue`如果要自定义比较逻辑，也是通过传入第三个参数(比较函数)来实现的。

`sort`的比较函数中
- 如果要实现**升序**，比较函数`return a < b`
- 如果要实现**降序**，比较函数`return a > b`

而`priority_queue`中
- 如果要实现**大根堆（类似升序）**，比较函数`return a[0] < b[0]`
- 如果要实现**小根堆（类似降序）**，比较函数`return a[0] > b[0]`

## 2.1 大根堆less与小根堆greater

通过两个比较函数`less`和`greater`实现大/小根堆，分别用于实现大根堆和小根堆。

```cpp

int main(){
    vector<vector<int>> vec = { {11, 13}, {12, 14}, {11, 12}, {15, 16} };

    //大根堆less：先按照第一个元素排序，再按照第二个元素排序
    priority_queue<vector<int>, vector<vector<int>>, less<vector<int>>> big_heap;
    for (auto x : vec) {
        big_heap.push(x);
    }

    //小根堆greater：先按照第一个元素排序，再按照第二个元素排序
    priority_queue<vector<int>, vector<vector<int>>, greater<vector<int>>> small_heap;
    for (auto x : vec) {
        small_heap.push(x);
    }

    //打印
    cout << "大根堆：" << endl;
    while (!big_heap.empty()) {
        auto x = big_heap.top();
        big_heap.pop();
        cout << x[0] << " - " << x[1] << endl;
    }

    cout << "-----------------" << endl;
    cout << "小根堆：" << endl;
    while (!small_heap.empty()) {
        auto x = small_heap.top();
        small_heap.pop();
        cout << x[0] << " - " << x[1] << endl;
    }

    return 0;
}
```

## 2.2 自定义比较函数

如果要实现自定义比较函数，可以通过**重写仿函数**来实现。

- 大根堆：`return a[0] < b[0]`
- 小根堆：`return a[0] > b[0]`

```cpp
//大根堆
struct cmpBig {
    bool operator()(const vector<int>& a, const vector<int>& b) {
        if (a[0] == b[0]) {
            return a[1] < b[1];
        }
        else {
            return a[0] < b[0];
        }
    }
};

//小根堆
struct cmpSmall {
    bool operator()(const vector<int>& a, const vector<int>& b) {
        if (a[0] == b[0]) {
            return a[1] > b[1];
        }
        else {
            return a[0] > b[0];
        }
    }
};

int main() {
    vector<vector<int>> vec = { {11, 13}, {12, 14}, {11, 12}, {15, 16} };

    //大根堆
    priority_queue<vector<int>, vector<vector<int>>, cmpBig> big_heap;
    for (auto x : vec) {
        big_heap.push(x);
    }

    //小根堆
    priority_queue<vector<int>, vector<vector<int>>, cmpSmall> small_heap;
    for (auto x : vec) {
        small_heap.push(x);
    }

    //打印
    cout << "大根堆：" << endl;
    while (!big_heap.empty()) {
        auto x = big_heap.top();
        big_heap.pop();
        cout << x[0] << " - " << x[1] << endl;
    }
    cout << "-----------------" << endl;
    cout << "小根堆：" << endl;
    while (!small_heap.empty()) {
        auto x = small_heap.top();
        small_heap.pop();
        cout << x[0] << " - " << x[1] << endl;
    }

    return 0;
}
```

# 三、真题

leetcode 347 [前 K 个高频元素](https://programmercarl.com/0347.%E5%89%8DK%E4%B8%AA%E9%AB%98%E9%A2%91%E5%85%83%E7%B4%A0.html#%E7%AE%97%E6%B3%95%E5%85%AC%E5%BC%80%E8%AF%BE)


```cpp
class Solution {
public:
    // vector<int> topKFrequent(vector<int>& nums, int k) {
    //     unordered_map<int, int> m_map;
    //     map<int, vector<int>> topK_map;//模拟单调递减栈

    //     //构建频率map
    //     for(int i:nums){
    //         m_map[i]++;
    //     }

    //     //构建以频率为key的map
    //     for(auto it = m_map.begin(); it != m_map.end(); it++){
    //         auto kv = *it;
    //         topK_map[kv.second].push_back(kv.first);
    //     }

    //     //输出topk:从低到高入队列的
    //     queue<int> topK_que;
    //     for(auto it = topK_map.begin(); it != topK_map.end(); ++it){
    //         auto kv = *it;
    //         vector<int> vec = kv.second;
    //         for(int tmp:vec){
    //             if(topK_que.size() < k) topK_que.push(tmp);
    //             else{//放不下了，需要弹出数据
    //                 topK_que.pop();
    //                 topK_que.push(tmp);
    //             }
    //         }
    //     }

    //     //存入vec中
    //     vector<int> res;
    //     while(!topK_que.empty()){
    //         res.push_back(topK_que.front());
    //         topK_que.pop();
    //     }

    //     return res;
    // }

    /*解法2：通过小根堆的方式实现*/
    struct cmp{
        bool operator()(const pair<int, int> &a, const pair<int, int> &b){
            return a.second > b.second;
        }
    };
    vector<int> topKFrequent(vector<int>& nums, int k) {
        unordered_map<int, int> m_map;
        priority_queue<pair<int, int>, vector<pair<int, int>>, cmp> small_heap;

        //构建频率map
        for(int i:nums){
            m_map[i]++;
        }

        for(auto it = m_map.begin(); it != m_map.end(); ++it){
            small_heap.push(*it);
            if(small_heap.size() > k){
                small_heap.pop();
            }
        }

        //存入vec中
        vector<int> res;
        while(!small_heap.empty()){
            auto kv = small_heap.top();
            res.push_back(kv.first);
            small_heap.pop();
        }

        return res;
    }
};
```
