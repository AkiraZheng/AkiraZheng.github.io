---
title: C++基础知识学习
date: 2024-03-09 13:58:04
tags:
categories:
- C++知识点
---

## 一、指针

### 1.1 C++的双指针

C++的双指针是指一个指针**指向另一个指针的指针**，如`int **p`，其指向的是一个指针的地址，也就是说，`p=某个指针的地址`，`*p=这个指针指向的地址`，而`p`本身也是一个int类型的数据

简单的例子如下：

`int a = 10;`

`int *p = &a;`   //`p`指向a的地址`&a`, `*p`指向`a的值`，这是一级指针，它的值是内存中存放变量a的地址

`int **pp = &p;` //`pp`指向`p`的地址`&p`，`*pp`指向`p`的值，即`&a`，这是二级指针，它的值是内存中**存放变量p的地址**

```cpp
#include <iostream>
using namespace std;

int aa = 4;
void singlePointer(int *p1){
	cout << "-----singlePointer-----" << endl;
	cout << "&p1=" << &p1 << "  函数中的p是重新创建的指针" << endl;
	cout << "p1=" << p1  << "     传进来的是原先a的地址" << endl;
	*p1 = 5;
	cout << "-----singlePointer END-----" << endl;
}


void doublePointer(int **p2){
	cout << "-----doublePointer-----" << endl;
	cout << "&p2=" << &p2 << "  函数中的p是重新创建的指针"  << endl;
	cout << "p2=" << p2 << "     传进来的是原先p的地址" << endl;
	*p2 = &aa;
	cout << "-----doublePointer-----END" << endl;
}

int main()
{
	int a = 100;
   	int *p = &a;
	cout << "&a=" << &a <<  " | "<< "&p="<< &p << " | " << endl;
	cout <<  "p=" << p << " | " << "*p=" << *p << endl;
	
	singlePointer(p);
	cout << "&a=" << &a << endl;
	cout << "a=" << a << endl;
	doublePointer(&p);
	cout << "p=" << p << endl;
	cout << "*p=" << *p << endl;
	
   	return 0;
}
```

- 运行结果：

<img src="doublePointer.png" width="60%">

- 原因：
	- p本身也是一个int型变量，只是存的值是地址；对所存地址进行*p解引用就可以实现取值；
	- 单指针函数的话传的是p，所以其实传进去的是a的地址，然后该地址赋值给新的指针p1，所以已经没有原先p指针的信息了，无法实现修改原先p指针的指向对象，只能改变a的值；
	- 双指针传的是&p，也就是p的地址，所以该地址赋值给新的指针p2，可以实现修改原先p的指向对象

### 1.2 指针和引用的区别

- **指针**是一个**变量**，它存储的是一个**地址**；而**引用**是一个**别名**，它是一个**常量**，它本质上跟被引用的变量是同一个东西。
- 指针有多级而引用只有一级；指针可以指向空，而引用不行；通过指针传参时会重新拷贝到另一个指针中，而引用会直接传实参
- sizeof时，指针占用的空间是固定的(8bytes)，而引用占用的空间是被引用变量的大小；

指针和引用的使用方式不同：

- **指针**：`int *p = &a;`
    - 通过赋值变量`a`的地址给指针`p`
    - 通过`*p`来**解引用**访问`a`的值
    - 非**指针常量**的话，指针变量可以**重新赋值**改变指向的地址，即`p = &b;`
- **引用**：`int &r = a;`
    - 通过`&`符号来**取地址**，然后赋值给引用`r`
    - 直接通过`r`来访问`a`的值
    - 引用**不可以重新赋值**，即`r = b;`是不允许的，所以**引用必须在定义时初始化**

什么时候用指针，什么时候用引用？

- 使用引用：当需要减少拷贝时；当传递类对象时标准方式是使用引用
- 使用指针：当需要在函数中改变指向的对象时；当需要返回函数内局部变量的内存地址时

代码举例：

```cpp
class Test {
public:
	void printTest(string s) {
		cout << "This is : " << s << endl;
	}
};

int main() {
	
	Test m_test;

	//指针
	Test* m_ptr   = &m_test;
	m_ptr->printTest("指针");
	//引用
	Test& m_quote = m_test;
	m_quote.printTest("引用");
	

	cout << "调试用" << endl;
	return 0;
}
```

### 1.3 野指针和悬空指针

**野指针**

指尚未初始化的指针，既不指向合法的内存空间，也没有使用 NULL/nullptr 初始化指针。

出现野指针举例：

```cpp
int *p;//未初始化,野指针
int *p = NULL;//初始化为NULL,不是野指针
int *p = nullptr;//初始化为nullptr,p不再是不是野指针
```

**悬空指针**

指向**已经释放**的内存地址的指针（释放前是合法的指针）

出现悬空指针的原因主要有三种：
- 指针释放资源后**没有被重新赋值** OR 指针释放后**没有置为**`nullptr`
    ```cpp
    int *p = new int(10);
    delete p;
    //p没有被重新赋值或者置为nullptr
    ```
- 超出变量作用域
    ```cpp
    int *p;
    {
        int a = 10;
        p = &a;
    }
    //a是局部变量，超出作用域，p成为悬空指针
    ```
- 指向函数返回的**局部变量的指针**或者**引用**
    ```cpp
    int* fun() {
        int a = 10;
        return &a;
    }
    int *p = fun();
    ```
    ```cpp
    int& fun() {
        int a = 10;
        return a;
    }
    int &p = fun();
    ```

上述提到的**野指针**和**悬空指针**都是**危险**的，因为它们可能会**访问到非法内存**，导致程序崩溃。

### 1.4 智能指针

#### 1.4.1 内存溢出 Out of Memory

内存溢出是指**程序申请的内存超过了系统能提供的内存**，导致**程序崩溃**。

内存溢出的原因主要是因为**申请内存过大**：程序申请的内存超过了系统能提供的内存

- 比如，程序申请了一个很大的数组，但是系统内存不足，导致内存溢出
- 再比如，申请了一个`int`变量，但是实际给它赋值了一个很大的数（如long才能存下的数），导致内存溢出
- **内存泄漏最终会导致内存溢出**

#### 1.4.2 内存泄漏 Memory Leak

内存泄漏是指**程序分配了一块内存空间**，但**由于某种原因**，**程序没有释放**或者**无法释放**这块内存空间，导致**这块内存空间永远无法被使用**，这就是内存泄漏。

内存泄漏的原因主要有两种：
- **堆内存泄漏**：程序在堆上分配了内存，但是**没有释放**，导致内存泄漏。通常是因为**程序员使用`new`或者`malloc`分配内存，但是忘记使用`delete`或者`free`释放内存**。
- **资源泄漏**：程序在使用资源时，**没有释放**，导致资源泄漏。比如**打开文件**、**打开数据库连接**等，但是**没有关闭**，久而久之会导致其它程序无法使用它。

**如何避免内存泄漏**：

- 首先是记得及时释放，一般会在**析构函数**中释放内存类的资源（但是如果类的对象也是用`new`分配的内存，那么还是要手动释放对象才能调用析构函数）
- 其次是使用**智能指针**，实现自动管理内存。（智能指针过期后会自动调用析构函数，释放内存）
- 可以使用**RAII**（资源获取即初始化）技术，即在**构造函数**中申请资源，在**析构函数**中释放资源，这样可以保证资源的及时释放。
- 用工具检查内存泄漏，如`BoundsChecker`

题外话说一下**缓冲区**溢出：缓冲区溢出是指如`vector`、`string`等这种带索引的容器，当**索引超出容器的范围**时，会导致**程序崩溃**。

#### 1.4.3 智能指针

智能指针是C++11引入的一种**内存管理**方式，它是一个**类模板**，可以自动管理内存，**避免内存泄漏**。

智能指针的主要作用是解放程序员，实现**自动释放内存**，当智能指针**超出作用域**时，会自动调用析构函数，释放内存。

常用的智能指针有`unique_ptr`、`shared_ptr`和`weak_ptr`是C++11标准，而`auto_ptr`是C++98标准，已经被C++17废弃。

##### 1.4.3.1 unique_ptr

通常一块内存可以被多个普通指针指向，但是`unique_ptr`是**独占**的，即**一块内存只能有一个`unique_ptr`指向它**。

首先来产生用`unique_ptr`管理普通的指针，实现没有`delete`也能自动释放普通指针

```cpp
class TestSmartPtr {
public:
	TestSmartPtr(string m_name) :m_name(m_name) {
		cout << "调用了" << m_name << "的构造函数" << endl;
	}
	~TestSmartPtr() {
		cout << "调用了" << m_name << "的析构函数" << endl;
	}
	TestSmartPtr(const TestSmartPtr& other):m_name(other.m_name){
		cout << "调用了" << m_name << "的拷贝构造函数" << endl;
	}
private:
	string m_name;
};

int main() {
	
	//使用智能指针管理普通指针：实现程序结束自动调用析构函数
	TestSmartPtr* p = new TestSmartPtr("Test");
	unique_ptr<TestSmartPtr> uni_ptr(p);
	
	return 0;
}
```

结果：

```
调用了Test的构造函数
调用了Test的析构函数
```

但实际上，有了智能指针之后，我们很少再使用普通指针了，所以我们一般是直接在构造函数中`new`一个对象，或者使用`make_unique`函数来创建对象。因此初始化时主要有三种方法：
- `unique_ptr<TestSmartPtr> uni_ptr(new TestSmartPtr("Test"));`
- `unique_ptr<TestSmartPtr> uni_ptr = make_unique<TestSmartPtr>("Test");`
    - `auto uni_ptr = make_unique<TestSmartPtr>("Test");`
- `unique_ptr<TestSmartPtr> uni_ptr(p);`不建议使用这种方式，会暴露原始指针

**`unique_ptr`怎么保证独占？**

`unique_ptr`是通过在其模板类的定义中**禁止拷贝构造函数**和**赋值运算符**来保证独占的。

- 禁止拷贝构造函数：`unique_ptr(const unique_ptr&) = delete;`
    
    ```cpp
    unique_ptr<TestSmartPtr> uni_ptr1(new TestSmartPtr("Test1"));
    unique_ptr<TestSmartPtr> uni_ptr2 = uni_ptr1; //赋值，编译报错
    unique_ptr<TestSmartPtr> uni_ptr3(uni_ptr1); //拷贝，编译报错
    ```
- 禁止赋值运算符：`unique_ptr& operator=(const unique_ptr&) = delete;`

    ```cpp
    unique_ptr<TestSmartPtr> uni_ptr1(new TestSmartPtr("Test1"));
    unique_ptr<TestSmartPtr> uni_ptr2(new TestSmartPtr("Test2"));
    uni_ptr2 = uni_ptr1; //编译报错
    ```

**为什么需要保证`unique_ptr`的独占？**

如果不独占的话，当我们用多个智能指针指向同一个对象时，当多个智能指针过期时会**调用多次析构函数**，这样除了第一次调用析构函数是正常的，其它的调用都是对**野指针**的操作，会导致程序崩溃。

##### 1.4.3.2 shared_ptr

`shared_ptr`是**共享**的智能指针，它可以**多个`shared_ptr`指向（关联）同一个对象**，在内部采用**引用计数**来实现共享管理：
- 当有一个`shared_ptr`与对象关联时，引用计数加1
- 当最后一个`shared_ptr`超出作用域时，表示没有任何与其关联的对象了，才会调用析构函数（其它情况的超出作用域只会将引用计数值减1）。此时`shared_ptr`自动变为`nullptr`，防止出现悬空指针。

相比于`unique_ptr`，`shared_ptr`的**拷贝构造函数**和**赋值运算符**是**允许**的，同时还多了一个`use_count`函数，用来获取当前引用计数的值。

```cpp
class TestSmartPtr {
public:
	TestSmartPtr(string m_name) :m_name(m_name) {
		cout << "调用了" << m_name << "的构造函数" << endl;
	}
	~TestSmartPtr() {
		cout << "调用了" << m_name << "的析构函数" << endl;
	}
	TestSmartPtr(const TestSmartPtr& other):m_name(other.m_name){
		cout << "调用了" << m_name << "的拷贝构造函数" << endl;
	}
	string getName() {
		return m_name;
	}
private:
	string m_name;
};

int main() {
	
	shared_ptr<TestSmartPtr> p0 = make_shared<TestSmartPtr>("Test");
	cout << "p0初始引用计数值：" << p0.use_count() << endl;

	//采用拷贝构造函数增加p1对对象的引用
	shared_ptr<TestSmartPtr> p1(p0);

	cout << "p0当前的引用计数值：" << p0.use_count() << endl;
	cout << "p0的user_name：" << p0->getName() << endl;
	cout << "p1初始引用计数值：" << p0.use_count() << endl;
	cout << "p1的user_name：" << p1->getName() << endl;

	return 0;
}
```

运行结果：

```
调用了Test的构造函数
p0初始引用计数值：1
p0当前的引用计数值：2
p0的user_name：Test
p1初始引用计数值：2
p1的user_name：Test
调用了Test的析构函数
```

在使用左右值引用时，**左值**的引用计数会**减1**，**右值**的引用计数会加1。

```cpp
int main() {
	
	shared_ptr<TestSmartPtr> p0 = make_shared<TestSmartPtr>("Test");
	shared_ptr<TestSmartPtr> p1 = make_shared<TestSmartPtr>("Test2");

	//采用赋值方法
	shared_ptr<TestSmartPtr> p2 = p0;
	cout << "p0当前的引用计数值：" << p0.use_count() << endl;
	cout << "p1当前的引用计数值：" << p1.use_count() << endl;

	cout << "---修改p3的引用赋值对象---" << endl;
	p2 = p1;//左值：原始p2指向的p0计数值减一；右值：当前指向的p1引用计数值加一
	cout << "p0当前的引用计数值：" << p0.use_count() << endl;
	cout << "p1初始引用计数值：" << p1.use_count() << endl;

	return 0;
}
```

运行结果：

```
调用了Test的构造函数
调用了Test2的构造函数
p0当前的引用计数值：2
p1当前的引用计数值：1
---修改p3的引用赋值对象---
p0当前的引用计数值：1
p1初始引用计数值：2
调用了Test2的析构函数
调用了Test的析构函数
```

**用unique_ptr好，还是shared_ptr好？**

一般情况下，能用`unique_ptr`就用`unique_ptr`，因为`unique_ptr`的**效率更高**，而且**更安全**。

而如果有需要**共享**的情况，那么就用`shared_ptr`。

**给unique_ptr和shared_ptr自定义删除器**

三种自定义删除器的方式：普通函数、仿函数、lambda表达式

- **普通函数**

    ```cpp
    void deleteFunc(TestSmartPtr* t) {
        cout << "使用普通函数方式自定义删除器（全局函数）\n";
        delete t;
    };
    ```
- **仿函数**

    ```cpp
    struct deleteClass {
        void operator()(TestSmartPtr* t) {
            cout << "使用仿函数的方式自定义删除器\n";
            delete t;
        }
    };
    ```
- **lambda表达式**

    ```cpp
    auto deleteLamb = [](TestSmartPtr* t) {
        cout << "使用Lambda表达式的方式自定义删除器\n";
        delete t;
    };
    ```

给`unique_ptr`和`shared_ptr`添加自定义删除器并进行测试：

```cpp
int main() {
	
	//给shared_ptr自定义删除器
	cout << "------------给shared_ptr自定义删除器---------------" << endl;
	shared_ptr<TestSmartPtr> p0(new TestSmartPtr("Test"), deleteFunc);
	shared_ptr<TestSmartPtr> p1(new TestSmartPtr("Test2"), deleteClass());
	shared_ptr<TestSmartPtr> p3(new TestSmartPtr("Test3"), deleteLamb);

	////给unique_ptr自定义删除器
	//cout << "------------给unique_ptr自定义删除器---------------" << endl;
	//unique_ptr<TestSmartPtr, decltype(deleteFunc)*> p4(new TestSmartPtr("Test decltype"), deleteFunc);
	//unique_ptr<TestSmartPtr, void(*)(TestSmartPtr *)> p5(new TestSmartPtr("Test 函数指针"), deleteFunc);
	//unique_ptr<TestSmartPtr, deleteClass> p6(new TestSmartPtr("Test 仿函数"), deleteClass());
	//unique_ptr<TestSmartPtr, decltype(deleteLamb)> p7(new TestSmartPtr("Test Lambda"), deleteLamb);

	return 0;
}
```

##### 1.4.3.3 weak_ptr

`weak_ptr`是`shared_ptr`的**弱引用**，是为了解决`shared_ptr`的**循环引用**问题。它不控制对象的生命周期，但是可以判断对象是否存在。

当两个`shared_ptr`相互引用时，会导致**引用计数永远不为0**。如下所示：

```cpp
class TestSmartPtr2;
class TestSmartPtr {
public:
	TestSmartPtr() {
		cout << "调用了" << "第一个类" << "的构造函数" << endl;
	}
	~TestSmartPtr() {
		cout << "调用了" << "第一个类" << "的析构函数" << endl;
	}
    //weak_ptr<TestSmartPtr2> m_p;//引用TestSmartPtr2
	shared_ptr<TestSmartPtr2> m_p;//引用TestSmartPtr2
};

class TestSmartPtr2 {
public:
	TestSmartPtr2() {
		cout << "调用了" << "第二个类" << "的构造函数" << endl;
	}
	~TestSmartPtr2() {
		cout << "调用了" << "第二个类" << "的析构函数" << endl;
	}
    //weak_ptr<TestSmartPtr> m_p;//引用TestSmartPtr
	shared_ptr<TestSmartPtr> m_p;//引用TestSmartPtr
};

int main() {
	
	shared_ptr<TestSmartPtr> p1(new TestSmartPtr());
	shared_ptr<TestSmartPtr2> p2(new TestSmartPtr2());

	//进行循环引用
	p1->m_p = p2;
	p2->m_p = p1;

	return 0;
}
```

运行结果：没有调用两个类的析构函数

```
调用了第一个类的构造函数
调用了第二个类的构造函数
```

**解决方法**：
- 将两个类中的`shared_ptr`改为`weak_ptr`
- 在需要使用时通过`expired`函数判断是否过期（线程不安全）
- `weak_ptr`不能直接访问资源，但是可以通过`lock`函数提升为`shared_ptr`，该函数同时也可以判断是否过期。（线程安全的）

```cpp
int main() {
	
	shared_ptr<TestSmartPtr> p1(new TestSmartPtr());
	shared_ptr<TestSmartPtr2> p2(new TestSmartPtr2());

	//进行循环引用
	p1->m_p = p2;
	p2->m_p = p1;

    //.lock()将weak_ptr提升为shared_ptr
	if (p1->m_p.lock()) {
		cout << "对象1还存在，use_count：" << p1.use_count() << endl;
	}
	else {
		cout << "对象1已经过期" << endl;
	}

	if (p2->m_p.lock()) {
		cout << "对象2还存在，use_count：" << p2.use_count() << endl;
	}
	else {
		cout << "对象2已经过期" << endl;
	}
	
	return 0;
}
```

运行结果：

```
调用了第一个类的构造函数
调用了第二个类的构造函数
对象1还存在，use_count：1
对象2还存在，use_count：1
调用了第二个类的析构函数
调用了第一个类的析构函数
```

> [循环引用产生的原因和解决方法](https://blog.csdn.net/adam2021/article/details/129849022)

### 1.5 this指针

`this`指针是一个**隐式**的指向**当前对象**的**指针**。**this指针只有在对象中的成员函数中才有定义**，因此，你获得一个对象后，也不能通过对象使用此指针。（只能在类内部使用，且**静态成员函数**不能使用）

**静态成员函数**与一般成员函数的唯一区别就是**没有this指针**，因此**不能访问非静态数据成员**。

要注意，`this`指针是**常量指针**，不能被赋值，也不能被删除。
- 它会在**构造函数**和**析构函数**中**自动**被**创建**和**销毁**。
- 如果在**析构函数**中**显式**删除`this`指针，由于`delete this`的操作本身就会**调用析构函数**，所以会导致**无限递归调用析构**，最终**堆栈溢出**从而导致**程序崩溃**。

### 1.6 new和delete

#### 1.6.1 实现机制

new和delete是C++中用来**动态分配**和**释放**内存的运算符。

- new：首先执行标准库函数`operator new`分配内存 -> 然后调用**构造函数**初始化对象 -> 最后返回对象的指针（如果内存分配失败，会抛出`std::bad_alloc`异常）
- delete：首先调用**析构函数** -> 然后执行标准库函数`operator delete`释放内存

#### 1.6.2 new和malloc的区别

new底层是通过malloc实现的，所以理论上是可以直接free掉new出来的实例化对象，但是这样的话不会调用实例化对象的析构函数

- new是C++运算符，malloc是C标准库函数
- 内存分配：new是自动计算大小的，malloc是需要手动输入分配的内存大小；new使用`operator new`分配内存
- 内存分配失败：new分配失败时会抛出异常报错，而malloc会直接返回空指针
- 初始化和释放：new初始化会调用构造函数、delete时会调用析构函数再释放，而malloc会直接释放内存
- 数据类型检查：new会有数据类型检查，而malloc直接申请一块内存，需要做类型强制转换，也不进行类型安全性检查

### 1.7 辨别几种指针的区别

```cpp
int *p[10];
int (*p)[10];
int * p(int);
int (*p)(int);
```

- **指针数组**：存放多个指针的数组`int *p[10]`
- **数组指针**：某个普通数组的指针，如`int (*p)[10]`表示一个int型数组的地址
- **函数返回指针**：`int * p(int)`表示函数返回一个int型的指针，传参为int
- **函数指针**：`int (*p)(int)`其中`p`表示某个函数的指针，返回值是int，传参是int

## 二、多态

C++的多态有两种：**静态多态**和**动态多态**。

其中，**静态多态**是通过**函数重载**和**运算符重载**实现的，而**动态多态**是通过**虚函数**实现的。

除此以外，C++还有**模板多态**，即通过**模板**实现的多态。（CRTP）

### 2.1 动态多态：

C++的动态多态是通过父类定义**虚函数**实现和子类**重写**来实现。

- 基类定义至少一个虚函数，此时该基类就会在**编译**时确定一个静态数组（也就是虚函数表），里面存放了所有虚函数的地址，每个类的所有类对象共享这个虚函数表。
    - 其中，对于**普通虚函数**，父类可以选择声明实现or不实现虚函数
    - 但是如果是**纯虚函数**，那么**父类不能实现**具体函数，只能由子类实现，且此时父类为抽象类，**不能实例化**。如果子类没有实现纯虚函数，那么子类也是抽象类，不能实例化。

接下来来具体从**虚函数**、**虚函数表**、**虚函数指针**这几个方面来进行讲解。

#### 2.1.1 虚函数

虚函数是在**基类**中使用`virtual`关键字声明的函数。在基类中声明虚函数后，派生类可以**覆盖（重写）**该函数，实现**多态**。**虚函数**在内存中存储于**代码区**，而**虚函数表**存储于**常量区**

- **虚函数表**：每个带有虚函数的**类**都有一个虚函数表
- **虚函数指针**：每个**实例化对象**都有一个虚函数8bytes的指针，指向虚函数表

```cpp
class Base {
public:
    virtual void fun1(){
        cout << "Base fun1" << endl;
    };
    virtual void fun2(){
        cout << "Base fun2" << endl;
    };
    virtual ~Base() {}
};
```

如上述代码，`fun`用`virtual`关键字声明，那么`fun`就是一个虚函数。结合下文将说到的**虚函数指针**，**没有声明虚函数**的类根本**不会有虚表指针**，也不支持多态（动态）。

#### 2.1.2 虚函数表vtbl

虚函数表中存储了该类所有的**虚函数**的地址。一个类的所有对象共享一个虚函数表，这个表是在**编译**时就已经生成的。

如果有一个`Base`类，其中有一个虚函数`fun`，那么它的虚函数表中就会存储`fun`的地址。


| Base中的函数 | 虚函数表地址 |
| :---: | :---: |
| fun1 | 0x00f21569 |
| fun2 | 0x00f21596 |
| 虚析构 | 0x00f21573 |

虚函数表是在**编译**时确定的，且每个类的所有对象共享一个虚函数表。

#### 2.1.3 虚函数指针vptr

虚函数指针是实例化对象中**指向虚函数表的地址**的指针。**含有虚函数**的类的对象或者**继承了含有虚函数的类**的对象都会有一个虚函数指针。

<img src="vptr.jpg">

- 普通类：无虚函数，无虚函数表

    ```cpp
    class Base {
    public:
        void fun();
    };
    ```
    
    如上面的代码，`Base`类中没有虚函数，所以`Base`类是一个普通类，在编译时不会有虚函数表。
    
    也因此，当我们创建一个`Base`类的对象时，该对象自然没有虚函数指针这个变量存在
    
    所以当我们用`sizeof`函数查看对象的大小，得到的结果是`1`（因为对象的大小是由**成员变量**决定的，而`Base`类中没有虚函数也没有成员变量，所以对象的大小是`1`byte，因为对象的大小至少要为`1`）。

    这也说明了普通函数的地址不存储在类对象中，而是存储在代码段中。

    ```cpp
    int main() {
        Base b;
        cout << sizeof(b) << endl; // 1
        return 0;
    }
    ```
- 虚函数类：有虚函数，有虚函数表

    ```cpp
    class Base {
    public:
        virtual void fun();
    };
    ```

    如上面的代码，`Base`类中有虚函数，所以`Base`类是一个虚函数类，在编译时会有虚函数表。当我们创建一个`Base`类的对象时，用`sizeof`函数查看对象的大小，得到的结果是`4`（因为对象的大小是由**成员变量**决定的，而`Base`类中有虚函数，所以对象的大小是`4`byte，因为对象的大小至少要为`1`）。

    这也说明了虚函数的地址存储在类对象中，而不是存储在代码段中。

    ```cpp
    int main() {
        Base b;
        cout << sizeof(b) << endl; // 8(64位系统)
        return 0;
    }
    ```

#### 2.1.4 虚函数的工作原理和多态体现

多态原理：

- 常规的多态是指在**基类**中定义一个**虚函数**，然后在**派生类**中**重写**这个虚函数
- 这样在**基类**指针或者引用绑定**派生类**对象时，调用这个虚函数时，会调用**派生类**的虚函数。

```cpp
class Base {
public:
    virtual void myvirfunc() {
        cout << "Base myvirfunc" << endl;
    }
};

class Derived : public Base {
public:
    void myvirfunc() {
        cout << "Derived myvirfunc" << endl;
    }
};

int main() {
    Base *p = new Base();
    p->myvirfunc(); // 使用指针调用虚函数，属于多态

    Base b;
    b.myvirfunc(); // 使用普通对象调用虚函数，不属于多态

    Base* ybase = &b;
    ybase->myvirfunc(); // 使用指针调用虚函数，属于多态
    return 0;
}

//下面的情况都属于多态
int main(){
    //父类的指针指向子类对象
    Base * p = new Derived();
    p->myvirfunc();
    //or
    Derived d;
    Base * p2 = &d;
    p2->myvirfunc();

    //父类引用绑定子类对象
    Base & r = d;
    r.myvirfunc();
}
```

**内存布局**

拥有虚函数的基类会在内存中共享一个**虚函数表**，而这个虚函数表中存储了所有虚函数的地址。

当我们创建一个基类的对象时，这个对象会有一个**虚函数指针**，指向这个虚函数表。

而**虚函数表**和**虚函数指针**都是在**编译**时就已经生成的。

**存在继承关系时的内存布局**

假设基类`Base`有三个虚函数`f`、`g`、`h`，那么在编译时，`Base`类的虚函数表中会存储这三个虚函数的地址。

当派生类`Derived`继承`Base`类时，由于`Derived`类重写了其中的`f`函数，所以`Derived`类的虚函数表中会存储`f`函数的地址，而`g`和`h`函数在虚函数表中的值跟`Base`类一样。

<img src="vptr2.jpg">

当用`Base`类的指针指向`Derived`类的对象时，构造函数会先调用`Base`类的构造函数，然后调用`Derived`类的构造函数。由于虚函数指针是跟对象绑定的，所以此时其实用的还是`Derived`对象的内存空间，所以虚函数指针指向的是**子类Derived类的虚函数表**。

#### 2.1.5 为什么说继承属于动态的多态？

动态多态之所以被称为**动态**的原因在于，它是在**程序运行**时（而非编译时）确定对象的类型和应该调用的函数的。

虽然**虚函数表**和**虚函数指针**都是在**编译**时确定的（但是并没有分配内存，运行时才会分配内存），但是**编译期间虚函数指针是没有具体指向的**。

只有当构造函数调用时，虚函数指针才会指向具体的虚函数表，而构造函数的调用是在**程序运行**时才会发生的，这也是继承属于**动态绑定**的原因。

继承下构造函数的调用顺序：**自上而下：自基类到派生类**

虚析构函数的调用顺序：**自下而上：自派生类到基类**

总结：**编译**时查看的是 `Shape` 类有没有这个接口, 而在**运行**时会查虚函数表, **才决定具体调用哪个**(动态多态)


### 2.2 静态多态

静态多态是通过**函数重载**和**运算符重载**实现的。具体不多说了

### 2.3 模板多态（CRTP）

模板多态是通过**模板**实现的多态，即**CRTP**（Curiously Recurring Template Pattern）。(也称为**奇异递归模板模式**)

`CRTP`将**模板**和**继承**相结合，形成一种新的设计模式。

（1）通过**继承**实现的多态是**绑定的和动态的**：
- 绑定的含义是：对于参与多态行为的类型，它们（具有多态行为）的接口是在公共基类的设计中就预先确定的（有时候也把绑定这个概念称为入侵的或者插入的）。
- 多态的含义是：接口的绑定是在运行期（动态）完成的。

（2）通过**模板**实现的多态是**非绑定的和静态的**：
- 非绑定的含义是：对于参与多态行为的类型，它们的接口是没有预先确定的（有时也称这个概念为非入侵的或者非插入的）。
-  静态的含义是：接口的绑定是在编译期（静态）完成的。

#### 2.3.1 模板

模板是C++中的一种**泛型编程**技术，通过模板可以实现**类型参数化**，即可以将类型作为参数传递给类或者函数。我们常用的`vector <int>` 或 `vector <string>`等都是通过模板实现的。C++中**编译器**会从函数模板通过具体类型**产生不同的函数**

- 模板在**函数**中的使用

    ```cpp
    template <typename T>
    T getMax(T a, T b) {
        return a >= b ? a : b;
    }

    int main() {
        int a = 2;
        int b = 10;
        cout << "getMax(2, 10):" << getMax(a, b) << endl;//getMax(2, 10):10

        double a1 = 44.2;
        double b1 = 10.2;
        cout << "getMax(44.2, 10.2):" << getMax(a1, b1) << endl;//Max(44.2, 10.2):44.2

        return 0;
    }
    ```

    从上面的代码例子可以看出，通过模板类的实现使`getMax`可以接受任意类型的输入参数。

- 模板在**类**中的使用

    ```cpp
    template <typename T>
    class testTemp {
    public:
        testTemp(T a1, T b1) :a(a1), b(b1) {}
        T a;
        T b;
        void printMax() {
            cout << "printMax:" << getMax() << endl;
        }

        T getMax();
    };

    template <typename T>
    T testTemp<T>::getMax() {
        return (a >= b ? a : b);
    }

    int main() {
        testTemp<int> m_test(12, 22);
        m_test.printMax();//printMax:22

        testTemp<double> m_test2(12.23, 22.45);
        m_test2.printMax();//printMax:22.45

        return 0;
    }
    ```
#### 2.3.2 CRTP的实现

CRTP是通过**模板**实现的多态，它的实现原理是通过**模板**实现**继承**。也就是创建一个**模板类**，然后其它类通过**继承**这个**模板类**来实现多态。

- 首先创建一个模板基类

```cpp
template <typename T>
class Base {
public:
	void foo() {
		static_cast<T*>(this)->printWord("Hello");
	}
};
```

- 然后创建两个继承这个模板基类的类

```cpp
//通过模板多态的方式基础模板类Base，此时模板传入的参数为类Child1
//Child1类需要有打印的函数printWord
class Child1 : public Base<Child1> {
public:
	void printWord(string s) {
		cout << "Child1: " << s << endl;
	}
};

class Child2 : public Base<Child2> {
public:
	void printWord(string s) {
		cout << "Child2: " << s << endl;
	}
};
```

- 接着再提供一个函数，用来调用基类中的`foo`函数(委托函数printTest作为中间代理)

```cpp
template <typename T>
void printTest(Base<T>& obj) {
	obj.foo();
}
```

- 最后在`main`函数中调用

```cpp
int main() {
	
	Child1 c1;
	Child2 c2;
	printTest(c1);
	printTest(c2);

	return 0;
}
```
- 运行结果

```
Child1: Hello
Child2: Hello
```

### 2.4 C++面向对象三大特性：封装、继承、多态

#### 2.4.1 封装

封装是指将**数据**和**操作数据的函数**封装在一起，形成一个**类**。封装可以**隐藏**类的**实现细节**，只提供**公共接口**给外部使用。

#### 2.4.2 继承

继承是让子类**继承**父类的**属性和方法**，修饰符`public`、`protected`、`private`用来控制继承的访问权限。

- `public`：公有继承，子类可以访问父类的`public`成员
- `protected`：保护继承，子类可以访问父类的`protected+public`成员
  - 但是再次继承该子类的类不能访问父类的`protected`成员
  - 其实例化对象也不能访问父类的`protected`成员
- `private`：私有继承，子类可以访问父类的`private+protected+public`成员

#### 2.4.3 多态

多态如上面说的分为**静态多态**和**动态多态**，其中**动态多态**是通过**虚函数**实现的。
- **静态多态**是通过**函数重载**和**运算符重载**实现的，是**编译**时的多态
- **动态多态**是通过**虚函数**实现的，是**运行**时的多态
  - 将**基类指针或者引用**绑定**派生类**对象时，调用虚函数时，会调用**派生类**的虚函数


## 三、虚基类

虚基类是指在**多重继承**中，子类采用`: virtual public Base`的方式继承父类，是为了解决**二义性**问题而引入的

**二义性**是指在菱形继承中，**子类继承了两个父类**，而这**两个父类又继承了同一个父类**，那么子类就会继承两份相同的父类，这就会导致二义性问题。

<img src="virtualBaseClass.png">

虚基类的使用可以有效防止菱形继承下调用两次（或多次）父类的构造函数。

> 参考：[C++ 虚基类](https://blog.csdn.net/chlele0105/article/details/22654869)

## 四、深拷贝和浅拷贝

### 4.1 浅拷贝

浅拷贝是指**拷贝对象时，只是拷贝对象的值**，而对于指针类型变量，不会重新分配内存，而是**拷贝指针的地址**。

### 4.2 深拷贝

深拷贝相比浅拷贝，对于指针类型变量，会**重新分配内存**，并将**指针指向的地址拷贝到新的内存空间**，然后使用`memcpy`函数将原对象的值拷贝到新的内存空间。

深拷贝可以通过**拷贝构造函数**和**赋值运算符重载**实现。下面将展示这两种实现方法


```cpp
class testCopy {
public:
	//构造函数创建数组
	testCopy(int size, int start) :size_(size) {
		data_ = new int[size_];
		for (int i = 0; i < size_; i++) {
			data_[i] = start + i;
		}
	}

	~testCopy() {
		delete[] data_;
	}

	//拷贝构造函数实现深拷贝
	testCopy(const testCopy& copy) {
		delete[] data_;
		this->size_ = copy.size_;
		this->data_ = new int[this->size_];//创建内存空间
		memcpy(data_, copy.data_, sizeof(int) * size_);//复制所有数据
	}

	//运算符重载实现深拷贝
	testCopy& operator = (const testCopy & copy){
		if (this != &copy) {
			delete[] data_;
			this->size_ = copy.size_;
			this->data_ = new int[this->size_];
			memcpy(data_, copy.data_, sizeof(int) * size_);
		}
		return *this;
	}

	void printData() {
		for (int i = 0; i < size_; i++) {
			cout << data_[i] << " ";
		}
		cout << endl;
	}

private:
	int size_;
	int* data_;
};

int main() {
	testCopy t1(4, 7);
	testCopy t2(6, 2);
	cout << "t1 data:" << endl;
	t1.printData();
	cout << "t2 data:" << endl;
	t2.printData();

	//使用拷贝构造函数
	cout << "t3 data:" << endl;
	testCopy t3(t1);
	t3.printData();
	//使用运算符重载实现深拷贝
	cout << "t3 data:" << endl;
	t3 = t2;
	t3.printData();

	return 0;
}
```

最终输出结果如下：

```
t1 data:
7 8 9 10
t2 data:
2 3 4 5 6 7
t3 data:
7 8 9 10
t3 data:
2 3 4 5 6 7
```

## 五、常用的string、vector、map、set

### 5.1 string VS char*

- `char*`是C语言中的字符串，指向一个字符数组，以`\0`结尾，其内存是由程序员分配和释放的，所以可能会有空间不足的问题。通过`const char *str = "hello";`的方式创建的字符串是**只读的**，不能修改。

	```cpp
	const char* str = "hello";
	str[0] = 'H'; //编译报错
	```

	但是通过`char str[] = "hello";`的方式创建的字符串是**可读写**的，可以修改。

	```cpp
	char str[] = "hello";
	str[0] = 'H'; //编译通过
	```
- `string`是C++中的字符串，是**标准库类型STL**中的一个类，内部**封装了很多字符串操作的方法**（比如查找、替换、删除等），而且内存是由系统自动分配和释放的，所以除非内存不足，否则不会出现空间不足的问题。通过`string str = "hello";`的方式创建的字符串是**可读写**的，可以修改。

	```cpp
	string str = "hello";
	str[0] = 'H'; //编译通过
	```

**1）string和char*的关系**

string底层是通过`char*`实现的，所以string和`char*`之间可以相互转换。

**2）string和char*的相互转换**

- `string`转`char*`：`string`的`c_str()`函数可以将`string`转换为`char*`。通过转换可以在`printf`等函数中使用`string`。

	```cpp
	string str = "hello";
	printf("%s\n", str.c_str());
	char* cstr = const_cast<char*>(str.c_str());//str.c_str()返回的是const char*，所以需要转换为char*
	```

- `char*`转`string`：`string`的**构造函数**可以将`char*`转换为`string`。以及通过赋值运算符`=`也可以将`char*`转换为`string`。

	```cpp
	const char* cstr = "hello";
	string str(cstr);//构造函数
	string str2 = cstr;//赋值运算符
	```

### 5.2 vector VS 数组

#### 5.2.1 vector的初始化

`vector`的初始化可以通过**构造函数**、**赋值运算符**、**列表初始化**的方式进行。
	
- 通过构造函数初始化

	```cpp
	vector<int> v0(5);//初始化5个元素，每个元素的值为0
	vector<int> v1(5, 1);//初始化5个元素，每个元素的值为1
	```
- 通过赋值运算符初始化

	```cpp
	vector<int> v2 = {1, 2, 3, 4, 5};//初始化5个元素，每个元素的值为1, 2, 3, 4, 5
	vector<int> v3 = v2;//将v2的值赋给v3
	```

- 通过列表初始化初始化

	```cpp
	vector<int> v4{1, 2, 3, 4, 5};//初始化5个元素，每个元素的值为1, 2, 3, 4, 5
	vector<int> v5 = {1, 2, 3, 4, 5};//初始化5个元素，每个元素的值为1, 2, 3, 4, 5
	```

- 二维vector的初始化

	```cpp
	vector<vector<int>> v6(3, vector<int>(4, 1));//初始化3行4列，每个元素的值为1
	```

#### 5.2.2 vector的迭代器遍历

`vector`的迭代器遍历可以通过**迭代器**、**auto关键字**、**范围for循环**的方式进行。

- 通过迭代器遍历：迭代器是一种**指针**，可以通过`begin()`和`end()`函数获取`vector`的**首地址**和**尾地址**。

	```cpp
	vector<int> v = {1, 2, 3, 4, 5};
	for (vector<int>::iterator it = v.begin(); it != v.end(); it++) {
		cout << *it << " ";//通过*解引用
	}
	for (auto it = v.begin(); it!=v.end(); i++){
		cout << *it << " ";
	}
	cout << endl;
	```
- 通过范围for循环遍历

	```cpp
	for (auto i : v) {
		cout << i << " ";
	}
	cout << endl;
	```

#### 5.2.3 vector与数组的区别

- 相同点
	- `vector`和数组都是**线性结构**，都是**连续的内存空间（这里的连续空间是指虚拟内存，在物理内存中不保证连续）**。
	- `vector`和数组都是**有序的**，都可以通过**下标**访问元素。
- 不同点
	- `vector`是**动态数组**，可以**动态增加**和**删除**元素，而数组是**静态数组**，长度是**固定**的。
	- `vector`是**STL**中的**容器**，提供了很多**成员函数**，可以方便的进行**插入**、**删除**、**查找**等操作，而数组没有这些功能。
	- `vector`是**类**，而数组是**基本数据类型**，所以`vector`可以**继承**，而数组不能继承。
	- `vector`是可以通过`v1=v2`的方式进行**赋值**的，而数组不能直接通过这种方式进行赋值。

### 5.3 set 和 map容器

#### 5.3.1 set

`set`是**集合**，是一种**关联式容器**，它的主要特点如下：

- `set`底层是**红黑树RBTree**，是一种**平衡二叉树**，所以**查找**、**插入**、**删除**的时间复杂度都是**O(logn)**。
- 其元素只有**key**，没有**value**（或者说value就是key）
- `set`中的元素是**唯一**的，不允许重复。
- `set`中的元素是**有序**的，是按照**key**的**升序**排列的。
- `set`中的元素是**不可修改**的，如果要修改元素，需要先删除再插入。（否则的话修改会破坏红黑树的平衡性）

`set`的基本函数操作有：
- `insert`：插入元素
- `erase`：删除元素
- `find`：查找元素
- `count`：统计元素个数（因为元素是唯一的，所以相当于判断元素是否存在）
- `begin`：返回指向第一个元素的迭代器
- `end`：返回指向最后一个元素的迭代器
- `size`：返回元素个数
- `empty`：判断是否为空

操作举例:

```cpp
set<int> s;
s.insert(1);
s.insert(2);
if(s.find(1) != s.end()){
	s.erase(1);
}
if(s.count(2)){//返回1
	cout << "2存在" << endl;
}
```

#### 5.3.2 map

`map`跟`set`类似，也是一种**关联式容器**，底层也是由**红黑树RBTree**实现的，`key`具有**唯一性**和**有序性**。但是`map`中的元素是**pair键值对的形式存在的**，`key`是**唯一**的，而`value`可以重复。

`map`的基本函数操作有：

- `insert`：插入元素
- `erase`：删除元素
- `find`：查找元素
- `count`：统计元素个数（因为元素是唯一的，所以相当于判断元素是否存在）
- `begin`：返回指向第一个元素的迭代器
- `end`：返回指向最后一个元素的迭代器
- `size`：返回元素个数
- `empty`：判断是否为空

操作举例：

```cpp
#include <ulitity>
#include <map>

int main() {
	
	map<int, string> m_map;
	//三种插入数据的方式：make_pair、pair、类似数组的方式
	m_map.insert(make_pair<int, string>(1, "Hello1"));
	m_map.insert(pair<int, string>(2, "Hello2"));
	m_map[3] = "Hello3";

	if (m_map.find(1) != m_map.end()) {
		cout << m_map[1] << endl;
	}

	m_map.erase(2);
	if (m_map.count(2) == 0) {
		cout << "无2这个key" << endl;
	}

	return 0;
}
```

#### 5.3.3 multiset和multimap

扩展讲一下`multiset`和`multimap`，`multiset`和`multimap`是`set`和`map`的**多重集合**版本，特点是允许`key`重复。底层也是由**红黑树RBTree**实现的。

## 六、自动类型推导

自动类型推导有两种方式：`auto`和`decltype`。

### 6.1 auto

`auto`是C++11新特性，可以**自动推导变量的类型**，可以用于**变量声明**、**函数返回值**、**模板参数**等。

### 6.2 decltype

`decltype`是C++11新特性，可以**获取表达式的类型**，可以用于**变量声明**、**函数返回值**、**模板参数**等。

使用`decltype`有两种方式：**decltype(表达式)**和**decltype(变量)**。

- 变量方法

	```cpp
	int main() {
		int a = 10;
		decltype(a) b = 20;//b的类型和a的类型相同
		auto c = a;//c的类型和a的类型相同
		return 0;
	}
	```

- 表达式方法

	```cpp
	int main() {
		int a = 10;
		decltype(a) b = 20;//b的类型和a的类型相同
		auto c = a;//c的类型和a的类型相同
		decltype(a + 1) d = 30;//d的类型和a+1的类型相同
		auto e = a + 1;//e的类型和a+1的类型相同
		return 0;
	}
	```

## 七、C++11新特性

- `auto`：自动类型推导
- `decltype`：获取表达式的类型
- `lambda`：匿名函数
- `nullptr`：用来代替`NULL`，`NULL`在C++中是一个宏定义，跟0是一样的，所以在重载函数时会出现**二义性问题**，而`nullptr`是一个关键字
- `智能指针`：`shared_ptr`、`unique_ptr`、`weak_ptr`
- `初始化列表`：`{}`，用来初始化数组、结构体、类等
- `基于范围的for循环`：for(auto i : v)
- `右值引用`：`&&`，用来实现移动语义
  - 左值引用就是普通的引用
  ```cpp
  int a = 10;//左值是a，右值是10
  int &b = a;
  //int &c = 10;//编译报错，10是右值
  int &&c = 10;
  c = 20;//修改右值
  ```

## 八、C++、C、Python的区别

### 1. C++和C的区别

- 编译链接不同：C++因为有**重载**，所以函数名会在C++编译器中进行**名称改编**，而C语言不会。C++编译后会生成`.obj`文件，C语言编译后会生成`.o`文件
- C++支持**面向对象**，而C语言不支持
- C++中内存分配和释放是通过`new`和`delete`，而C语言只能通过`malloc`和`free`
- C++中有**引用**，而C语言没有
- C++中有**try/catch/throw的异常处理**
- C++中有**模板**，而C语言没有
- C++新增了关键字：namespace、bool、true、false、new等

### 2. C++和Python的区别

- C++是**编译型语言**，Python是**解释型语言**
- Python支持的库很多，但是运行速度比C++慢
- Python有严格的**缩进规则，用缩进代表代码块**，而C++用**花括号{}**代表代码块
- C++变量需要**声明**，而Python不需要
	