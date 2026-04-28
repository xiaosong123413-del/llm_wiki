---
title: 1. Android Studio开发环境搭建与汉化
summary: 在 Windows 系统上安装 Android Studio IDE，完成 SDK 配置，快速搭建安卓应用开发环境的完整流程。
sourceFile: 剪藏__1. Android Studio开发环境搭建与汉化__e7547c8a.md
sourceChannel: 剪藏
observedAt: "2026-04-19T17:20:38.593Z"
tags:
  - 情景记忆
---
# 1. Android Studio开发环境搭建与汉化
## 来源
- 渠道：剪藏
- 文件：剪藏__1. Android Studio开发环境搭建与汉化__e7547c8a.md
- 链接：https://www.kucoding.com/article/339.html
- 时间：2026-04-19T17:20:38.593Z
## 本篇观察摘要
在 Windows 系统上安装 Android Studio IDE，完成 SDK 配置，快速搭建安卓应用开发环境的完整流程。
## 候选 Claims
- Android Studio 已集成开发安卓 App 所需的全部组件，无需单独安装 JDK 或其他工具链。（active / confidence 0.55）
- Android Studio 不支持 ARM 系列 CPU 的 Windows 电脑，主流 Intel CPU 电脑均满足安装要求。（active / confidence 0.55）
- Android Studio 默认安装到 C 盘，C 盘空间不足时可在安装步骤中手动更改安装目录。（active / confidence 0.55）
- Android SDK 的安装位置可在首次启动时的向导页面中自定义更改，不必与 IDE 安装在同一目录。（active / confidence 0.55）
- Android Studio 汉化使用 JetBrains 插件市场提供的「Chinese (Simplified) Language Pack」插件，可从插件官网下载对应版本的 zip 包后离线安装。（active / confidence 0.55）
- 汉化插件需与 Android Studio 版本匹配，如 Android Studio 2024.2.x 需下载适配 2024.2 版本的汉化包。（active / confidence 0.55）
- 汉化插件安装后可能需要重启两次才能生效；若首次重启后未汉化，可新建项目后再次进入插件页面重新安装并重启。（active / confidence 0.55）
- 运行安卓 App 可选择虚拟机或实体机两种方式；实体机需开启开发者模式并通过 USB 连接到电脑。（active / confidence 0.55）
- 创建 AVD 时需选择系统镜像（如 x86_64 系列），无特殊需求可选择任意发行版，系统镜像需单独下载。（active / confidence 0.55）
- AVD 的硬件配置（内存、存储等）在创建向导最后一步可自定义，但通常保持默认配置即可满足日常开发调试需求。（active / confidence 0.55）
- 安卓项目初始化时默认从境外服务器下载 Gradle 包，国内网络环境下极易出现下载超时或报错。（active / confidence 0.55）
- 将 gradle-wrapper.properties 文件中的 distributionUrl 替换为腾讯云镜像地址 https://mirrors.cloud.tencent.com/gradle/ 可解决国内 Gradle 下载失败问题。（active / confidence 0.55）
- Gradle 下载地址配置文件位于项目的 Gradle Scripts 目录下的 gradle-wrapper.properties 文件中。（active / confidence 0.55）
- Android 是一个以 Linux 内核为基础的移动操作系统，其底层文件布局遵循 Linux 系统格式。（active / confidence 0.55）
- 安卓程序运行在沙盒环境中，无法直接访问底层 Linux 系统，因此开发安卓应用不需要具备 Linux 知识。（active / confidence 0.55）
- Android 是当前全球安装量最高的移动端操作系统，远超 iOS 和鸿蒙。（active / confidence 0.55）
## 与已有 Semantic Memory 的关系
- 涉及概念：[[android-studio-开发环境搭建]]、[[android-studio-汉化方法]]、[[android-虚拟机avd创建与使用]]、[[gradle-国内镜像代理配置]]、[[android-系统架构基础]]
## 是否触发新 Procedure
- 暂未触发新的程序记忆