---
title: 爬虫实现QQ群作业的批量下载
date: 2024-12-18 20:50:22
tags:
categories:
  - 重装-环境配置-计算机
---

> 前提：使用者需要有该群聊的管理者权利，才可以下所有人的作业

> 下载结果：该博文可以实现将群内所有作业全部下载下来放在`downloaded`，并按照每个实验单独一个文件夹、每个实验内按照n个群成员生成n个对应文件夹（作业放在该文件夹中）

# 一、qq群抓包

由于批量下载的爬虫代码中需要获取QQ群聊相关的`QQ群号`、`cookie`、`bkn`信息，因此需要从网页中获取相关值

> 参考：[解密之QQ的bkn值，获取QQ群成员信息，获取QQ好友列表信息](https://blog.csdn.net/qq_35834501/article/details/106539199)

- 先进入*https://qun.qq.com/member.html* ，其中的`cookie`和`bkn`都可以在打开`fn+12`后切换群聊可以在控制台的网络中获取该值

<img src="cookie.png" width="80%" height="80%">

<img src="bkn.png" width="80%" height="80%">

- 拿到后再运行**二**中的代码，即可实现批量下载

# 二、批量下载

```python
import requests
import sqlite3
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import wait as pool_wait
from tqdm import tqdm  # 进度条库
from urllib.parse import urlparse
import uuid
import os


group = input("Group: ")
cookie = input("Cookie: ")
bkn = input("bkn: ")


all_homework = []

for i in range(1, 9999):
    print("get homework list... page " + str(i))
    r = requests.post("https://qun.qq.com/cgi-bin/homework/hw/get_hw_list.fcg", data={
        "num": i,
        "group_id": group,
        "cmd": 21,
        "page_size": 20,
        "client_type": 1,
        "bkn": bkn
    }, headers={
        "Referer": "https://qun.qq.com/homework/p/features/index.html",
        "Origin": "https://qun.qq.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) QQ/9.2.3.26683 Chrome/43.0.2357.134 Safari/537.36 QBCore/3.43.1297.400 QQBrowser/9.0.2524.400",
        "Cookie": cookie
    }, verify=False)
    r = r.json()
    print(r)
    if r['data']['end_flag'] == 1:
        break
    for entry in r['data']['homework']:
        all_homework.append(entry)

print("total: " + str(len(all_homework)))
print(all_homework)

# get all students' homework status
details_notyet = dict()
details_finish = dict()

for entry in all_homework:
    while True:
        try:
            print("get detail..." + str(entry['hw_id']))
            r = requests.post("https://qun.qq.com/cgi-bin/homework/fb/get_hw_feedback.fcg",
                              data={
                                  "group_id": group,
                                  "hw_id": entry['hw_id'],
                                  "status": "[0,1]",
                                  "page": 1,
                                  "page_size": 2000,
                                  "need_userinfo": 1,
                                  "type": "notyet",
                                  "client_type": 1,
                                  "bkn": bkn
                              },
                              headers={
                                  "Referer": "https://qun.qq.com/homework/p/features/index.html",
                                  "Origin": "https://qun.qq.com",
                                  "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) QQ/9.2.3.26683 Chrome/43.0.2357.134 Safari/537.36 QBCore/3.43.1297.400 QQBrowser/9.0.2524.400",
                                  "Cookie": cookie
                              }, verify=False)
            r = r.json()
            print(r)
            details_notyet[entry['hw_id']] = r

            r = requests.post("https://qun.qq.com/cgi-bin/homework/fb/get_hw_feedback.fcg",
                              data={
                                  "group_id": group,
                                  "hw_id": entry['hw_id'],
                                  "status": "[2,3]",
                                  "page": 1,
                                  "page_size": 2000,
                                  "need_userinfo": 1,
                                  "type": "finish",
                                  "client_type": 1,
                                  "bkn": bkn
                              },
                              headers={
                                  "Referer": "https://qun.qq.com/homework/p/features/index.html",
                                  "Origin": "https://qun.qq.com",
                                  "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) QQ/9.2.3.26683 Chrome/43.0.2357.134 Safari/537.36 QBCore/3.43.1297.400 QQBrowser/9.0.2524.400",
                                  "Cookie": cookie
                              }, verify=False)
            r = r.json()
            print(r)
            details_finish[entry['hw_id']] = r
            break
        except Exception as e:
            print(e)

# write to db
print("write to db...")

db = sqlite3.connect("homework.db")
c = db.cursor()

for homework_id in details_notyet:
    c.execute("""
    CREATE TABLE HOMEWORK_""" + str(homework_id) + """(
       NAME VARCHAR(30) PRIMARY KEY NOT NULL,
       FINISHED INTEGER,
       CONTENT VARCHAR NOT NULL
    );
    """)
    db.commit()

for homework_id in details_notyet:
    try:
        for stu in details_notyet[homework_id]['data']['feedback']:
            c.execute("""
            INSERT INTO HOMEWORK_""" + str(homework_id) + """ VALUES (?, 0, ?);
            """, (stu['nick'], str(stu)))
        db.commit()
    except Exception as e:
        print("no notyet " + str(e))

    try:
        for stu in details_finish[homework_id]['data']['feedback']:
            c.execute("""
            INSERT INTO HOMEWORK_""" + str(homework_id) + """ VALUES (?, 1, ?);
            """, (stu['nick'], str(stu)))
        db.commit()
    except Exception as e:
        print("no finish " + str(e))


# find urls
all_urls = set()
regex = re.compile(r'(https?|ftp|file)://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]')
for i in details_notyet:

    for i2 in regex.finditer(str(details_notyet[i])):
        all_urls.add(i2.group())
    for i2 in regex.finditer(str(details_finish[i])):
        all_urls.add(i2.group())

print("total urls: " + str(len(all_urls)))


## download files

def download_and_save(homework_id, student_folder, file_info, max_retries=3):
    file_name = file_info['name']
    target_url = file_info['url']

    # 创建学生文件夹
    student_path = os.path.join("downloaded", homework_id, student_folder)
    os.makedirs(student_path, exist_ok=True)

    file_path = os.path.join(student_path, file_name)

    # 如果文件已经存在，则跳过下载
    if os.path.exists(file_path):
        print(f"{file_name} already exists, skipping.")
        return True

    for attempt in range(max_retries + 1):
        try:
            with requests.get(target_url, stream=True, verify=False, timeout=(5, None)) as r:  # 增加连接和读取超时
                r.raise_for_status()  # 检查请求是否成功

                total_size = int(r.headers.get('content-length', 0))
                progress_bar = tqdm(total=total_size, unit='iB', unit_scale=True, desc=file_name)

                with open(file_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):  # 使用合适的块大小进行迭代
                        if chunk:  # 过滤掉保持活动的空chunk
                            f.write(chunk)
                            progress_bar.update(len(chunk))
                progress_bar.close()

                if total_size != 0 and progress_bar.n != total_size:
                    print(f"Download of {file_name} did not complete.")
                    continue
                
                print(f"saved to {file_path}")
                return True
        except Exception as e:
            print(f"Attempt {attempt + 1}/{max_retries} failed to download {file_name}: {e}")
            if attempt == max_retries:
                print(f"Failed to download {file_name} after {max_retries} attempts.")
                return False

# 创建线程池执行器
pool = ThreadPoolExecutor(max_workers=20)

# 修改数据库内容以适应新的下载逻辑
all_tasks = []

for homework_id in details_finish:
    for stu in details_finish[homework_id]['data']['feedback']:
        if 'content' in stu and 'main' in stu['content']:
            for item in stu['content']['main']:
                if 'text' in item and 'c' in item['text'] and isinstance(item['text']['c'], list):
                    for file_info in item['text']['c']:
                        if 'type' in file_info and file_info['type'] == 'file':
                            student_folder = f"{stu['nick']}_{stu['uin']}"
                            all_tasks.append(
                                pool.submit(download_and_save, str(homework_id), student_folder, file_info)
                            )

# 等待所有下载任务完成
pool_wait(all_tasks)
print("All downloads completed.")

# 关闭线程池执行器
pool.shutdown(wait=True)
print("Thread pool executor has been shut down.")
db.close()
print("All done!")
```

 > 代码仓库：https://github.com/AkiraZheng/QQHomeworkBatchTool.git

> 参考：[Time Machine - QQ作业爬虫](https://blog.lyc8503.net/post/qq-homework-crawler/)


