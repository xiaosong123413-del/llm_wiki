---
orphaned: true
title: Context DAG（上下文有向无环图）
summary: h5i 项目提出的 AI 上下文管理概念，将推理轨迹组织为有向无环图结构，配合 context pack 实现对 AI 推理过程的无损裁剪（lossless trimming），是对 rtk 输出层过滤的进一步延伸。
sources: null
createdAt: "2026-04-19T17:22:08.553Z"
updatedAt: "2026-04-19T17:22:08.553Z"
tags:
  - AI上下文管理
  - Token优化
  - 推理轨迹
  - 开发者工具
aliases:
  - context-dag上下文有向无环图
  - Context DAG（上下文有向无环图）
  - Context DAG
  - 有向无环图
---

# Context DAG（上下文有向无环图）

## 概述

**Context DAG**（上下文有向无环图，Context Directed Acyclic Graph）是一种用于管理和优化 AI 编码工具[[上下文窗口]]的数据结构概念。该概念由 h5i 项目提出，旨在对 AI 推理过程中产生的上下文信息进行结构化追踪与无损裁剪，从而在不损失关键信息的前提下降低[[token]] 消耗。

## 背景与动机

在使用 [[Claude Code]]、[[Codex]]、[[Cursor]] 等 AI 编码工具时，工具频繁执行 `git status`、`cargo test`、`npm install`、`docker ps` 等命令，其输出往往包含大量重复行、日志、进度条、路径等冗余信息。这些内容会被全部塞入 AI 的上下文窗口，造成 token 的大量浪费，同时可能降低模型对关键信息的注意力。

针对这一问题，业界出现了多种优化方案：

- **rtk（Rust Token Killer）**：通过拦截并过滤命令输出，去除噪音，仅将关键信息传递给 AI。
- **h5i**：在 rtk 的基础上更进一步，引入 Context DAG 与 context pack 机制，对推理轨迹执行**无损裁剪**。

## 核心概念

### Context DAG

Context DAG 是 h5i 项目的核心数据结构，被其开发者类比为"**AI 上下文的 Git**"。如同 Git 使用有向无环图来追踪文件变更历史，Context DAG 使用有向无环图结构来追踪 AI 推理过程中上下文的演化路径。

其核心特性包括：

- **结构化追踪**：以 DAG（有向无环图）形式记录推理轨迹中各上下文片段之间的依赖关系。
- **无损裁剪**：区别于 rtk 等工具对命令输出的"有损过滤"，Context DAG 旨在实现对推理轨迹的**lossless trimming**（无损裁剪），即在削减 token 的同时不丢失语义关键信息。

### Context Pack

**Context Pack** 是与 Context DAG 配合使用的打包机制，负责将经过裁剪的上下文片段进行组织和传递，以便 AI 模型能够高效利用压缩后的上下文信息。

## 与 rtk 的对比

| 维度 | rtk | h5i（Context DAG） |
|------|-----|--------------------|
| 作用对象 | 命令行输出 | AI 推理轨迹 |
| 裁剪方式 | 有损过滤（去重、截断） | 无损裁剪 |
| 实现语言 | Rust | — |
| 核心机制 | 拦截并压缩命令输出 | Context DAG + Context Pack |
| 类比 | 输出噪音过滤器 | AI 上下文的 Git |

## 效果与局限

有测试数据表明，使用 rtk 类工具可削减约 35% 的 token 消耗，但对模型回答存在一定损伤——在准确率要求较高的任务中，错误率有所上升。Context DAG 所主张的"无损裁剪"正是为了弥补这一局限，但其实际效果有待更多实践验证。

此外，在频繁进行容器操作的场景下，此类工具的错误率也相对较高。

## 相关概念

- [[上下文窗口]]（Context Window）
- [[Token 优化]]
- [[rtk]]
- [[h5i]]
- [[有向无环图]]（DAG）
- [[AI 编码工具]]

## 来源

- 剪藏__Thread by @laogui@laogui @laogui__08ff1fe6.md（原始链接：https://x.com/laogui/status/2045677115341934867）

## 置信度概览

- Context DAG 是 h5i 项目提出的概念，将 AI 的推理轨迹组织为有向无环图，通过 context pack 机制对推理过程进行无损裁剪，以降低上下文 token 消耗。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- rtk 在命令输出层过滤噪声，而 h5i 的 Context DAG 在推理轨迹层进行结构化无损裁剪，两者作用于不同层次的 token 优化。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-9ac52ad1e08c -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/context-dag上下文有向无环图.md
- 处理动作：Deep Research
- 对象：rtk 在命令输出层过滤噪声，而 h5i 的 Context DAG 在推理轨迹层进行结构化无损裁剪，两者作用于不同层次的 token 优化。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\context-dag上下文有向无环图.md Low-confidence claim: rtk 在命令输出层过滤噪声，而 h5i 的 Context DAG 在推理轨迹层进行结构化无损裁剪，两者作用于不同层次的 token 优化。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“rtk 在命令输出层过滤噪声，而 h5i 的 Context DAG 在推理轨迹层进行结构化无损裁剪，两者作用于不同层次的 token 优化。”是否仍然成立。

<!-- deep-research:deep-research-check-c33368d7bea1 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/context-dag上下文有向无环图.md
- 处理动作：Deep Research
- 对象：Context DAG 是 h5i 项目提出的概念，将 AI 的推理轨迹组织为有向无环图，通过 context pack 机制对推理过程进行无损裁剪，以降低上下文 token 消耗。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\context-dag上下文有向无环图.md Low-confidence claim: Context DAG 是 h5i 项目提出的概念，将 AI 的推理轨迹组织为有向无环图，通过 context pack 机制对推理过程进行无损裁剪，以降低上下文 token 消耗。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Context DAG 是 h5i 项目提出的概念，将 AI 的推理轨迹组织为有向无环图，通过 context pack 机制对推理过程进行无损裁剪，以降低上下文 token 消耗。”是否仍然成立。
