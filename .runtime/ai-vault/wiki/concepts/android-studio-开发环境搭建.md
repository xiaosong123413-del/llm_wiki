---
orphaned: true
title: Android Studio 开发环境搭建
summary: 在 Windows 系统上安装 Android Studio IDE，完成 SDK 配置，快速搭建安卓应用开发环境的完整流程。
sources: null
createdAt: "2026-04-19T17:21:15.487Z"
updatedAt: "2026-04-19T17:21:15.487Z"
tags:
  - 安卓开发
  - 开发环境
  - IDE
  - Windows
aliases:
  - android-studio-开发环境搭建
  - AS开
  - Android Studio 开发环境搭建
  - Android Studio
  - Android 开发环境搭建
  - Android Studio 安装与配置
  - Android 开发入门
---

# Android Studio 开发环境搭建

## 概述

[[Android Studio]] 是 Google 官方提供的安卓应用开发 IDE，内部已集成开发安卓 App 所需的一切工具，包括 [[Android SDK]]、模拟器等组件。[[Android]] 是一个以 [[Linux]] 内核为基础的移动操作系统，目前是全球安装量最高的移动端系统。由于安卓程序运行在沙盒环境中，开发者无需深入了解 Linux 系统即可进行安卓开发。

---

## 系统要求

在安装 Android Studio 之前，需确认本机满足以下基本条件：

- 操作系统：Windows（需注意 **不支持 ARM 系列 CPU**）
- 目前市面上大部分 Windows 电脑采用 Intel 系列 CPU，一般均可满足要求
- C 盘需有足够的剩余空间（也可在安装时手动更改安装路径）

---

## 安装流程

### 1. 下载 Android Studio

前往官方下载页面获取安装包：

> 官方下载地址：[https://developer.android.google.cn/studio](https://developer.android.google.cn/studio)

点击下载后会弹出条款确认对话框，勾选后点击下载即可。

### 2. 安装软件

下载完成后双击可执行文件，一路点击「Next」即可完成安装。需注意默认安装路径为 C 盘，若 C 盘空间不足，可在对应步骤中手动更改安装目录。

### 3. 初次启动与数据采集选项

安装完成并打开软件后，会弹出是否允许 Google 采集使用数据的对话框，可直接选择「不发送」。

### 4. 安装 Android SDK

初次启动后，软件会引导安装开发所需的 [[Android SDK]] 组件：

- 在国内网络环境下，SDK 获取可能失败并弹出弹框，直接点击「Cancel」后点击「Next」继续
- 此步骤可更改 SDK 的安装位置，建议选择空间充裕的目录
- 在协议页面点击「接受」后点击「Finish」，软件将开始自动下载 SDK
- 下载完成后即进入 Android Studio 主页

---

## 汉化配置

Android Studio 默认界面为英文，可通过安装 JetBrains 官方汉化插件实现中文界面。

### 插件下载

前往以下地址下载与当前 Android Studio 版本匹配的汉化包（下载后为 `.zip` 压缩包，无需解压）：

> 插件地址：[Chinese (Simplified) Language Pack](https://plugins.jetbrains.com/plugin/13710-chinese-simplified-language-pack----/versions/stable)

例如，Android Studio 2024.2.2.13 对应下载适配 2024.2 版本的汉化包。

### 安装步骤

1. 在 Android Studio 中选择「从磁盘安装插件」
2. 选择下载好的压缩包文件
3. 安装完成后重启 Android Studio，界面即切换为中文

### 汉化未生效的处理方法

若安装插件后汉化未生效，可按以下步骤操作：

1. 新建一个空项目（随意选择模板和项目名）
2. 进入项目设置中的插件页面，重新安装汉化插件
3. 按提示重启软件；若右下角再次提示重启，则再重启一次
4. 经过两次重启后汉化通常可生效

---

## 安卓虚拟机（AVD）创建

为了在本机运行和调试 App，可选择连接实体设备或创建安卓虚拟机（[[AVD]]）。

### 使用实体设备

打开手机的开发者模式，用 USB 连接电脑后，在工具栏的设备管理页面添加设备即可。

### 创建虚拟机

1. 在设备管理页面选择「创建新的安卓虚拟机」
2. 选择想要模拟的手机机型（右侧可预览屏幕样式）
3. 选择系统镜像版本（无特殊要求可选 x86\_64 系列的任意发行版），点击下载箭头并接受协议后等待下载完成
4. 配置虚拟机参数（一般保持默认），点击「完成」
5. 在工具栏上方选择新建的虚拟机，点击绿色运行按钮即可启动

---

## 常见问题：Gradle 下载报错

### 问题描述

新建安卓项目时，系统会自动下载对应版本的 [[Gradle]] 构建工具。由于 Gradle 服务器位于境外，国内网络环境下极易出现下载失败或超时报错。

### 解决方法

将 Gradle 下载地址替换为国内镜像源：

1. 打开项目目录下 `Gradle Scripts` 中的 `gradle-wrapper.properties` 文件
2. 将 `distributionUrl` 字段中的下载地址替换为腾讯云代理地址：

```
https://mirrors.cloud.tencent.com/gradle/
```

3. 保存文件后重新点击运行，即可正常下载 Gradle

---

## 相关页面

- [[Android SDK]]
- [[Android 虚拟机（AVD）]]
- [[Gradle 配置]]
- [[Android 开发入门]]

---

## 来源

- 剪藏__1. Android Studio开发环境搭建与汉化__e7547c8a.md（原文链接：https://www.kucoding.com/article/339.html）

## 置信度概览

- Android Studio 已集成开发安卓 App 所需的全部组件，无需单独安装 JDK 或其他工具链。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- Android Studio 不支持 ARM 系列 CPU 的 Windows 电脑，主流 Intel CPU 电脑均满足安装要求。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- Android Studio 默认安装到 C 盘，C 盘空间不足时可在安装步骤中手动更改安装目录。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- Android SDK 的安装位置可在首次启动时的向导页面中自定义更改，不必与 IDE 安装在同一目录。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-da55bc8b7484 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-studio-开发环境搭建.md
- 处理动作：Deep Research
- 对象：Android SDK 的安装位置可在首次启动时的向导页面中自定义更改，不必与 IDE 安装在同一目录。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-studio-开发环境搭建.md Low-confidence claim: Android SDK 的安装位置可在首次启动时的向导页面中自定义更改，不必与 IDE 安装在同一目录。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Android SDK 的安装位置可在首次启动时的向导页面中自定义更改，不必与 IDE 安装在同一目录。”是否仍然成立。

<!-- deep-research:deep-research-check-808c52984849 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-studio-开发环境搭建.md
- 处理动作：Deep Research
- 对象：Android Studio 默认安装到 C 盘，C 盘空间不足时可在安装步骤中手动更改安装目录。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-studio-开发环境搭建.md Low-confidence claim: Android Studio 默认安装到 C 盘，C 盘空间不足时可在安装步骤中手动更改安装目录。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Android Studio 默认安装到 C 盘，C 盘空间不足时可在安装步骤中手动更改安装目录。”是否仍然成立。

<!-- deep-research:deep-research-check-03a68ea36041 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-studio-开发环境搭建.md
- 处理动作：Deep Research
- 对象：Android Studio 不支持 ARM 系列 CPU 的 Windows 电脑，主流 Intel CPU 电脑均满足安装要求。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-studio-开发环境搭建.md Low-confidence claim: Android Studio 不支持 ARM 系列 CPU 的 Windows 电脑，主流 Intel CPU 电脑均满足安装要求。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Android Studio 不支持 ARM 系列 CPU 的 Windows 电脑，主流 Intel CPU 电脑均满足安装要求。”是否仍然成立。

<!-- deep-research:deep-research-check-371a01ed541f -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-studio-开发环境搭建.md
- 处理动作：Deep Research
- 对象：Android Studio 已集成开发安卓 App 所需的全部组件，无需单独安装 JDK 或其他工具链。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-studio-开发环境搭建.md Low-confidence claim: Android Studio 已集成开发安卓 App 所需的全部组件，无需单独安装 JDK 或其他工具链。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Android Studio 已集成开发安卓 App 所需的全部组件，无需单独安装 JDK 或其他工具链。”是否仍然成立。
