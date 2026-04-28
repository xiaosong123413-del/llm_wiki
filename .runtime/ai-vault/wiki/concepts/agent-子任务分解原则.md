---
orphaned: true
title: Agent 子任务分解原则
summary: 将无边界大任务按目录或模块分组为每组 15-30 个的独立子任务，每个子任务 prompt 自包含，是保障长程 AI 编码任务稳定执行的核心设计原则。
sources: null
createdAt: "2026-04-19T20:02:54.642Z"
updatedAt: "2026-04-19T20:02:54.642Z"
tags:
  - AI编码工具
  - 任务分解
  - 多Agent架构
  - 提示词工程
aliases:
  - agent-子任务分解原则
  - Agent 子任务分解原则
  - Agent
---

# Agent 子任务分解原则

## 概述

在使用 [[Claude Code]] 等 AI Agent 执行超大规模任务时，单 Agent 会因为 context 膨胀而出现信息丢失、效率下降的问题。**子任务分解原则**是应对这一瓶颈的核心设计思路：将一个无边界的大任务，拆分为多个结构清晰、自包含的子任务，由主-子 Agent 协作完成。

---

## 背景：单 Agent 的 Context 瓶颈

当单个 Agent 尝试在一个 session 内完成海量工作时，其执行流程通常呈现如下退化模式：

1. **高效阶段**：刚开始时指令遵循效果优秀；
2. **接近阈值**：运行约 80k tokens 后，context 逼近 compact 阈值；
3. **信息压缩**：对话历史被压缩为摘要，模型开始遗忘任务细节；
4. **效率崩溃**：经过多轮 auto-compact 后，Agent 会重复检查已完成的工作，直到触发 `maxTurns` 后退出，向用户询问是否继续。

这一过程可以概括为：**context 膨胀 → compact → 信息丢失 → 效率下降**。在当前 session 中继续回复"继续"，只会让后续工作更加偏离预期，并且退出得更快。

---

## 核心解决方案：主-子 Agent 架构

优化方向是设计一个**主-子 Agent 运行模式**（任务调度器）：

- **主 Agent**：只负责调度和进度追踪，不执行实际工具调用；
- **子 Agent**：拥有独立 context 和独立退出逻辑，负责执行具体任务；
- **文件系统**：承担进度持久化的职责，替代 Agent 的"记忆"。

设计原则可以浓缩为一句话：**设计多个 agents，各司其职、快进快出，把进度交给文件系统来记忆。**

---

## 三大核心原则

### 1. 任务分解

不要给 Agent 一个无边界的指令（如"修复所有单测"），而应按以下步骤操作：

- 先扫描出所有需要处理的目标（如失败的测试用例）；
- 按**目录或模块**分组，每组 **15–30 个**，作为一个独立子任务；
- **每个子任务的 prompt 必须自包含**，写清楚：
  - 文件路径
  - 错误现象
  - 期望行为

> ⚠️ 不能写"根据之前的分析来修复"，因为子 Agent 看不到父 Agent 的历史。

### 2. 进度持久化

在项目根目录维护一个 `progress.json`，记录三个列表：

| 字段        | 含义         |
|-----------|------------|
| `completed` | 已完成的子任务   |
| `failed`    | 执行失败的子任务  |
| `pending`   | 待执行的子任务   |

- **主 Agent** 每轮调度前读取该文件，决定下一批任务；
- **子 Agent** 完成后更新对应条目；
- 即使主 Agent 自身被 compact，重读文件即可恢复全部状态。

### 3. 失败策略

子 Agent 报错时，按以下逻辑处理，避免无限重试消耗 token：

```
错误可修复？
  ├── 是 → 用 SendMessage 继续同一个子 Agent（保留错误上下文更高效）
  ├── 否（方向完全错误）→ 启动新的子 Agent，避免锚定在错误路径
  └── 多次失败 → 上报用户，停止重试
```

---

## 工具支持

### Claude Code 内建能力

[[Claude Code]] 已内建上述调度架构。启用 **Coordinator Mode**（输入 `/coordinator`）后：

- 主 Agent 自动变为纯调度者，不执行任何实际工具调用；
- 主 Agent 负责理解子 Agent 的返回结果、合成下一步的具体指令、并行派发独立任务；
- 每个子 Agent 通过 `AgentTool` 启动，拥有独立 context。

### 第三方工具

- **Ralph 插件**（[github.com/snarktank/ralph](https://github.com/snarktank/ralph)）：设置好 PRD 文档后，自动将项目拆分为多个 story，通过 CLI 不断唤起 worker 来逐一完成每个 story，适合在 Codex 等环境中使用。

- **AgentInbox**：可订阅 PR 事件，合并后自动触发消息给下一个 Agent，实现任务的事件驱动式衔接。

---

## 关键要点汇总

| 原则 | 错误做法 | 正确做法 |
|------|----------|----------|
| 任务粒度 | 下达无边界指令 | 按模块分组，每批 15–30 个 |
| Prompt 设计 | 引用父 Agent 上下文 | 每个子任务 prompt 自包含 |
| 状态管理 | 依赖 Agent 记忆 | 写入 `progress.json` 持久化 |
| 失败处理 | 无限重试 | 分级处理，多次失败则上报 |
| 架构设计 | 单 Agent 跑全程 | 主-子 Agent 各司其职 |

---

## 相关页面

- [[Claude Code]]
- [[多 Agent 架构]]
- [[Context 管理]]
- [[进度持久化]]

---

## 来源

## 置信度概览

- 建议将大任务按目录或模块分组，每组 15-30 个工作单元作为一个独立子任务，避免给出无边界的全量指令。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 子任务 prompt 中不应写「根据之前的分析来修复」之类的跨 Agent 引用，因为子 Agent 看不到父 Agent 的历史，跨 session 引用会导致任务失败。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-c4fc87299981 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agent-子任务分解原则.md
- 处理动作：Deep Research
- 对象：子任务 prompt 中不应写「根据之前的分析来修复」之类的跨 Agent 引用，因为子 Agent 看不到父 Agent 的历史，跨 session 引用会导致任务失败。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agent-子任务分解原则.md Low-confidence claim: 子任务 prompt 中不应写「根据之前的分析来修复」之类的跨 Agent 引用，因为子 Agent 看不到父 Agent 的历史，跨 session 引用会导致任务失败。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“子任务 prompt 中不应写「根据之前的分析来修复」之类的跨 Agent 引用，因为子 Agent 看不到父 Agent 的历史，跨 session 引用会导致任务失败。”是否仍然成立。

<!-- deep-research:deep-research-check-06dd7e774e93 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agent-子任务分解原则.md
- 处理动作：Deep Research
- 对象：建议将大任务按目录或模块分组，每组 15-30 个工作单元作为一个独立子任务，避免给出无边界的全量指令。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agent-子任务分解原则.md Low-confidence claim: 建议将大任务按目录或模块分组，每组 15-30 个工作单元作为一个独立子任务，避免给出无边界的全量指令。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“建议将大任务按目录或模块分组，每组 15-30 个工作单元作为一个独立子任务，避免给出无边界的全量指令。”是否仍然成立。
