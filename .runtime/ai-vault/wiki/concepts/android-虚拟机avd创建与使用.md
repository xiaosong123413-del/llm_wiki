---
orphaned: true
title: Android 虚拟机（AVD）创建与使用
summary: 在 Android Studio 中创建安卓虚拟设备（AVD），用于在无实体机时运行和调试 App 的标准操作流程。
sources: null
createdAt: "2026-04-19T17:21:04.007Z"
updatedAt: "2026-04-19T17:21:04.007Z"
tags:
  - 安卓开发
  - 虚拟机
  - AVD
  - 调试
aliases:
  - android-虚拟机avd创建与使用
  - Android 虚拟机（AVD）创建与使用
  - Android
  - Android 虚拟机
  - Android 虚拟机（AVD）
  - Android Virtual Device
  - AVD
  - 安卓虚拟机
  - 安卓虚拟机创建
---

# Android 虚拟机（AVD）创建与使用

## 概述

Android 虚拟机（Android Virtual Device，简称 AVD）是 [[Android Studio]] 提供的仿真器功能，允许开发者在没有实体手机的情况下，在电脑上运行和调试 Android 应用程序。通过创建 AVD，开发者可以模拟不同机型、不同屏幕尺寸和不同系统版本的 Android 设备环境。

---

## 前置条件

在创建并使用 AVD 之前，需要确保已经完成以下准备工作：

- 已安装 [[Android Studio]]（当前最新版为 2024.2.2.13）。
- 已在安装过程中下载并配置好 [[Android SDK]]。
- 电脑 CPU 需为 Intel 系列，因为 Android Studio 目前不支持 ARM 系列 CPU 的 Windows 环境。

---

## 替代方案：使用实体机

如果开发者拥有 Android 实体手机，可以不使用虚拟机，而是直接通过以下步骤连接真机进行调试：

1. 在 Android 手机上开启**开发者模式**。
2. 使用 USB 数据线将手机连接至电脑。
3. 在 Android Studio 下方工具栏打开**设备管理**页面，即可识别并使用实体设备。

---

## AVD 创建步骤

### 第一步：打开设备管理器

在 Android Studio 界面底部工具栏，点击**设备管理**页面入口，进入设备管理界面。

### 第二步：新建虚拟机

在设备管理页面中，选择**创建一个新的 Android 虚拟机**选项，进入虚拟机配置向导。

### 第三步：选择设备机型

在机型列表中选择希望模拟的手机型号。界面右侧会实时预览所选机型的屏幕样式和尺寸比例，开发者可以根据目标用户的设备情况进行选择。

### 第四步：选择系统镜像

选择要安装在虚拟机上的 Android 系统镜像。没有特殊要求时，可随意选择一个版本。以下为注意事项：

- 若目标镜像尚未下载，需点击镜像旁的**下载按钮**进行下载。
- 点击下载后会弹出协议框，选择**接受**后继续下一步。
- 等待镜像下载完毕。

> 示例：可选择 x86\_64 系列中最早的一个发行版作为测试环境。

### 第五步：配置虚拟机参数

下载完成后点击**下一步**，进入虚拟机配置页面。可配置项目包括内存大小、存储空间等，一般情况下保持默认配置即可，直接点击**完成**。

---

## 启动虚拟机并运行应用

AVD 创建完成后，在 Android Studio 上方工具栏的设备选择下拉菜单中，会自动选中刚创建的虚拟机。点击绿色的**运行按钮**，即可将当前项目编译并部署到虚拟机中运行。

---

## 常见问题

### Gradle 下载报错

Android 项目初始化时会自动下载对应版本的 [[Gradle]] 构建工具包，但由于该资源托管在境外服务器，国内网络环境下容易出现下载失败的问题。

**解决方法：**

1. 打开项目中 `Gradle Scripts` 目录下的 `gradle-wrapper.properties` 文件。
2. 将 `distributionUrl` 字段的值替换为腾讯提供的国内镜像代理地址：

```
https://mirrors.cloud.tencent.com/gradle/
```

3. 保存文件后，重新点击运行，即可正常下载并构建项目。

---

## 相关页面

- [[Android Studio]]
- [[Android SDK]]
- [[Gradle]]
- [[Android 开发环境搭建]]
- [[Android Studio 汉化]]

---

## 来源

- 剪藏__1. Android Studio开发环境搭建与汉化__e7547c8a.md（原文链接：https://www.kucoding.com/article/339.html）

## 置信度概览

- 创建 AVD 时需选择系统镜像（如 x86_64 系列），无特殊需求可选择任意发行版，系统镜像需单独下载。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 运行安卓 App 可选择虚拟机或实体机两种方式；实体机需开启开发者模式并通过 USB 连接到电脑。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- AVD 的硬件配置（内存、存储等）在创建向导最后一步可自定义，但通常保持默认配置即可满足日常开发调试需求。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-1766a78e0329 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-虚拟机avd创建与使用.md
- 处理动作：Deep Research
- 对象：AVD 的硬件配置（内存、存储等）在创建向导最后一步可自定义，但通常保持默认配置即可满足日常开发调试需求。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-虚拟机avd创建与使用.md Low-confidence claim: AVD 的硬件配置（内存、存储等）在创建向导最后一步可自定义，但通常保持默认配置即可满足日常开发调试需求。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“AVD 的硬件配置（内存、存储等）在创建向导最后一步可自定义，但通常保持默认配置即可满足日常开发调试需求。”是否仍然成立。

<!-- deep-research:deep-research-check-26e8267b7b96 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-虚拟机avd创建与使用.md
- 处理动作：Deep Research
- 对象：创建 AVD 时需选择系统镜像（如 x86_64 系列），无特殊需求可选择任意发行版，系统镜像需单独下载。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-虚拟机avd创建与使用.md Low-confidence claim: 创建 AVD 时需选择系统镜像（如 x86_64 系列），无特殊需求可选择任意发行版，系统镜像需单独下载。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“创建 AVD 时需选择系统镜像（如 x86_64 系列），无特殊需求可选择任意发行版，系统镜像需单独下载。”是否仍然成立。

<!-- deep-research:deep-research-check-d8cc2ab34c5b -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-虚拟机avd创建与使用.md
- 处理动作：Deep Research
- 对象：运行安卓 App 可选择虚拟机或实体机两种方式；实体机需开启开发者模式并通过 USB 连接到电脑。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-虚拟机avd创建与使用.md Low-confidence claim: 运行安卓 App 可选择虚拟机或实体机两种方式；实体机需开启开发者模式并通过 USB 连接到电脑。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“运行安卓 App 可选择虚拟机或实体机两种方式；实体机需开启开发者模式并通过 USB 连接到电脑。”是否仍然成立。
