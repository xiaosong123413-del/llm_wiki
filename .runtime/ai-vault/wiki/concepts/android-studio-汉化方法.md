---
orphaned: true
title: Android Studio 汉化方法
summary: 通过安装 JetBrains 官方中文语言包插件，将默认英文界面的 Android Studio 汉化为简体中文界面。
sources: null
createdAt: "2026-04-19T17:21:01.941Z"
updatedAt: "2026-04-19T17:21:01.941Z"
tags:
  - 安卓开发
  - IDE
  - 汉化
  - 插件
aliases:
  - android-studio-汉化方法
  - AS汉
  - Android Studio 汉化方法
  - Android Studio
  - Android Studio 汉化
---

# Android Studio 汉化方法

## 概述

[[Android Studio]] 默认仅提供英文界面。为了方便中文用户使用，可以通过安装 JetBrains 官方提供的简体中文语言包插件来完成界面汉化。

---

## 前置条件

在进行汉化之前，请确认已完成以下步骤：

- 已在本机成功安装 [[Android Studio]]
- 已完成 [[Android SDK]] 的初始化配置
- 了解 Android Studio 当前的版本号（汉化插件需与版本对应）

---

## 汉化步骤

### 第一步：确认 Android Studio 版本

打开 Android Studio，查看当前安装的版本号。截至本文撰写时，最新版为 `2024.2.2.13`，对应的是 **2024.2 版本系列**。下载汉化插件时需选择与该版本系列匹配的插件版本。

### 第二步：下载汉化插件

前往 JetBrains 插件市场下载适用于 Android Studio 的简体中文语言包：

> 插件名称：**Chinese (Simplified) Language Pack**
> 插件地址：[https://plugins.jetbrains.com/plugin/13710-chinese-simplified-language-pack----/versions/stable](https://plugins.jetbrains.com/plugin/13710-chinese-simplified-language-pack----/versions/stable)

在插件页面中，根据前一步确认的版本号，选择适配对应版本的汉化包进行下载。下载完成后将得到一个 `.zip` 格式的压缩包，**无需解压**，直接保留备用。

### 第三步：从磁盘安装插件

回到 Android Studio 主界面，执行以下操作：

1. 进入插件管理页面（Plugins）
2. 选择「**从磁盘安装插件**」（Install Plugin from Disk）选项
3. 在文件选择对话框中，找到并选中刚才下载的 `.zip` 压缩包
4. 确认安装

### 第四步：重启 Android Studio

安装完成后，按照提示重启 Android Studio。重启完成后，界面应已切换为简体中文。

---

## 汉化未生效的处理方法

若完成上述步骤后界面仍显示为英文，可按以下流程排查和修复：

1. **新建一个空白项目**：随意选择一个项目模板，随意填写项目名称，进入项目。
2. **进入项目设置**：注意，Android Studio 的顶部菜单栏默认隐藏，需要点击左上角的菜单图标才会弹出菜单，随后进入 Settings（设置）页面。
3. **重新安装插件**：在插件管理页面中，找到已安装的汉化插件，执行重新安装操作。
4. **多次重启**：安装完成后按提示重启软件；若重启后右下角再次提示需要重启，则再次重启。经过**两次重启**后，汉化通常可以生效。

---

## 注意事项

| 注意点 | 说明 |
|---|---|
| 插件版本需匹配 | 汉化插件必须与 Android Studio 的大版本系列对应，否则可能无法正常汉化 |
| 压缩包无需解压 | 下载得到的 `.zip` 文件直接用于安装，不要手动解压 |
| 可能需要重启两次 | 部分情况下需要经历两次重启才能完全生效 |

---

## 相关页面

- [[Android Studio]]
- [[Android Studio 开发环境搭建]]
- [[Android SDK 配置]]
- [[Gradle 配置与代理设置]]
- [[安卓虚拟机创建]]

---

## 来源

- 剪藏__1. Android Studio开发环境搭建与汉化__e7547c8a.md（原文链接：https://www.kucoding.com/article/339.html）

## 置信度概览

- Android Studio 汉化使用 JetBrains 插件市场提供的「Chinese (Simplified) Language Pack」插件，可从插件官网下载对应版本的 zip 包后离线安装。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 汉化插件需与 Android Studio 版本匹配，如 Android Studio 2024.2.x 需下载适配 2024.2 版本的汉化包。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 汉化插件安装后可能需要重启两次才能生效；若首次重启后未汉化，可新建项目后再次进入插件页面重新安装并重启。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-c59826ccfc73 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-studio-汉化方法.md
- 处理动作：Deep Research
- 对象：汉化插件安装后可能需要重启两次才能生效；若首次重启后未汉化，可新建项目后再次进入插件页面重新安装并重启。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-studio-汉化方法.md Low-confidence claim: 汉化插件安装后可能需要重启两次才能生效；若首次重启后未汉化，可新建项目后再次进入插件页面重新安装并重启。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“汉化插件安装后可能需要重启两次才能生效；若首次重启后未汉化，可新建项目后再次进入插件页面重新安装并重启。”是否仍然成立。

<!-- deep-research:deep-research-check-e0c01cce167d -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-studio-汉化方法.md
- 处理动作：Deep Research
- 对象：汉化插件需与 Android Studio 版本匹配，如 Android Studio 2024.2.x 需下载适配 2024.2 版本的汉化包。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-studio-汉化方法.md Low-confidence claim: 汉化插件需与 Android Studio 版本匹配，如 Android Studio 2024.2.x 需下载适配 2024.2 版本的汉化包。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“汉化插件需与 Android Studio 版本匹配，如 Android Studio 2024.2.x 需下载适配 2024.2 版本的汉化包。”是否仍然成立。

<!-- deep-research:deep-research-check-d575033075e8 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/android-studio-汉化方法.md
- 处理动作：Deep Research
- 对象：Android Studio 汉化使用 JetBrains 插件市场提供的「Chinese (Simplified) Language Pack」插件，可从插件官网下载对应版本的 zip 包后离线安装。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\android-studio-汉化方法.md Low-confidence claim: Android Studio 汉化使用 JetBrains 插件市场提供的「Chinese (Simplified) Language Pack」插件，可从插件官网下载对应版本的 zip 包后离线安装。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Android Studio 汉化使用 JetBrains 插件市场提供的「Chinese (Simplified) Language Pack」插件，可从插件官网下载对应版本的 zip 包后离线安装。”是否仍然成立。
