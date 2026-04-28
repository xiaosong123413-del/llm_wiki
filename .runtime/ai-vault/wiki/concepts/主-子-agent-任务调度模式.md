---
orphaned: true
title: 主-子 Agent 任务调度模式
summary: 将超大任务拆分给多个子 Agent 独立执行，主 Agent 仅负责调度与进度追踪，每个子 Agent 拥有独立 context 和退出逻辑，从而绕过单一 Agent 的 context 瓶颈。
sources: null
createdAt: "2026-04-19T20:03:05.434Z"
updatedAt: "2026-04-19T20:03:05.434Z"
tags:
  - 多Agent架构
  - AI编码工具
  - 任务调度
  - Claude Code
aliases:
  - 主-子-agent-任务调度模式
  - 主A任
  - 主-子 Agent 调度模式
  - 主-子 Agent 架构
  - 多 Agent 架构
  - 主-子 Agent 任务调度模式
---

# 主-子 Agent 任务调度模式

## 概述

主-子 Agent 任务调度模式（Master-Sub Agent Task Scheduling Pattern）是一种为解决单一 [[Agent]] 在执行超大规模任务时遭遇 [[上下文窗口]] 瓶颈而设计的多智能体协作架构。其核心思路是：由一个主 Agent 专职负责任务调度与进度追踪，将具体执行工作分发给多个独立的子 Agent，并通过文件系统持久化进度状态，从而突破单一 Agent 的所有限制。

---

## 问题背景：单 Agent 的瓶颈

### 单 Agent 执行超大任务的典型退化过程

在尝试用单个 [[Claude Code]] Agent 完成海量任务（如补全项目中 1000 个单元测试）时，往往会观察到如下退化流程：

1. **初始高效阶段**：刚开始运行时，指令遵循效果非常好。
2. **Context 逼近阈值**：运行约 80k tokens 后，对话上下文开始接近 compact（压缩）阈值。
3. **历史压缩与信息丢失**：对话历史被压缩为摘要，模型开始遗忘之前的执行细节（如刚修复的测试内容）。
4. **重复劳动**：经过一两轮 auto-compact 后，Agent 甚至会重复检查已修复的任务。
5. **主动退出**：当触发 `maxTurns` 且响应中不含 `ToolUse` 指令时，Agent 停止执行，向用户询问是否继续。

> 如果此时在同一个 session 中回复"继续"，后续的工作会更加不符合预期，并且退出得更快。

这一循环可以总结为：**context 膨胀 → compact → 信息丢失 → 效率下降**。

---

## 模式设计

主-子 Agent 任务调度模式通过以下三个关键机制解决上述问题：

### 1. 任务分解

不要给 Agent 一个无边界的指令（如"修复所有单测"），而应先扫描出所有失败测试，**按目录或模块分组，每组 15–30 个**，作为一个独立子任务。

**关键约束**：每个子任务的 prompt 必须**自包含**——写清楚文件路径、错误现象、期望行为。不能写"根据之前的分析来修复"，因为**子 Agent 看不到父 Agent 的历史**。

### 2. 进度持久化

在项目根目录维护一个 `progress.json`，记录三个列表：

| 字段 | 说明 |
|------|------|
| `completed` | 已完成的子任务 |
| `failed` | 执行失败的子任务 |
| `pending` | 尚未执行的子任务 |

- **主 Agent** 每轮调度前读取此文件，决定下一批要执行的任务。
- **子 Agent** 完成后更新对应条目。
- 即使主 Agent 自身被 compact，重读文件即可恢复全部状态。

这一机制将任务状态的"记忆"从 Agent 的 context 转移到了**持久化的文件系统**中。

### 3. 失败策略

子 Agent 报错时，根据错误性质采取不同的处理方式：

| 情况 | 处理策略 |
|------|----------|
| 错误可修复 | 用 `SendMessage` 继续同一个子 Agent（保留错误上下文，效率更高） |
| 方向完全错误 | 启动新的子 Agent，避免锚定在错误路径上 |
| 多次失败 | 上报用户，不无限重试，避免浪费 token |

---

## 角色分工

```
主 Agent（Coordinator）
│
├── 职责：调度、进度追踪、合成指令、并行派发
│   不执行任何实际工具调用
│
├── 读写 progress.json
│
└── 派发 ──► 子 Agent 1（独立 context）
            ├──► 子 Agent 2（独立 context）
            └──► 子 Agent N（独立 context）
                 各自执行具体任务，完成后更新 progress.json
```

- **主 Agent**：纯调度者，理解子 Agent 的返回结果，合成下一步的具体指令，并行派发独立任务。
- **子 Agent**：通过 `AgentTool` 启动，拥有独立 context 和独立退出逻辑，执行具体任务后快速退出。

---

## 在 Claude Code 中的实现

[[Claude Code]] 已内建了这套能力。最直接的方式是启用 **Coordinator Mode**：

```
/coordinator
```

启用后，主 Agent 自动变成纯调度者，不再执行实际工具调用，只负责：
- 理解子 Agent 的返回结果
- 合成下一步的具体指令
- 并行派发独立任务

每个子 Agent 通过 `AgentTool` 启动，拥有独立的 context。

### 相关工具与生态

- **Ralph 插件**（`github.com/snarktank/ralph`）：可配合 Codex 使用，设置好 PRD 文档后，自动将项目拆分为多个小的 Story，通过监工对话框不断唤起 worker 来完成每个 Story，是该模式的一种实践实现。
- **AgentInbox**：可订阅 GitHub PR 等事件，PR 合并后自动触发消息给 Codex/Claude，驱动 Agent 自动进行下一个 issue，实现基于事件的任务调度链路。

---

## 核心设计原则

> **设计多个 Agents，各司其职、快进快出，把进度交给文件系统来记忆。**

| 原则 | 说明 |
|------|------|
| 职责单一 | 主 Agent 只调度，子 Agent 只执行 |
| 自包含 Prompt | 每个子任务 prompt 包含全部所需上下文 |
| 状态外置 | 进度状态写入文件系统，而非依赖 context |
| 快进快出 | 子 Agent 完成任务后立即退出，保持 context 干净 |
| 失败隔离 | 单个子任务失败不污染整体流程 |

---

## 对比：单 Agent vs 主-子 Agent

| 维度 | 单 Agent | 主-子 Agent |
|------|----------|-------------|
| Context 膨胀 | 必然发生，导致性能退化 | 每个子 Agent 独立 context，不相互污染 |
| 信息丢失 | auto-compact 后丢失细节 | 进度持久化于文件系统，不依赖 context |
| 任务中断恢复 | 需重新说明上下文 | 读取 progress.json 即可恢复 |
| 并行能力 | 串行执行 | 可并行派发多个子 Agent |
| 错误隔离 | 单点错误影响整体 | 子任务失败独立处理，不影响其他任务 |

---

## 相关概念

- [[Claude Code]]
- [[上下文窗口]]
- [[Auto-Compact]]
- [[AgentTool]]
- [[Coordinator Mode]]
- [[进度持久化]]
- [[多智能体协作]]

---

## 来源

- 剪藏__Thread by @Barret_China@Barret_China @Barret_China__f49fa0c9.md（原文链接：https://x.com/Barret_China/status/2045787288618299542，发布于 2026-04-19）

## 置信度概览

- 每个子 Agent 的 prompt 必须自包含，需写明文件路径、错误现象和期望行为，不能引用父 Agent 的历史，因为子 Agent 无法访问父 Agent 的上下文。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 在主-子 Agent 架构中，主 Agent 不执行任何实际工具调用，只负责理解子 Agent 的返回结果、合成下一步指令并并行派发独立任务。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- Claude Code 内建 Coordinator Mode，输入 /coordinator 即可将主 Agent 切换为纯调度者，子 Agent 通过 AgentTool 启动并拥有独立 context。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-a96753fa520a -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/主-子-agent-任务调度模式.md
- 处理动作：Deep Research
- 对象：每个子 Agent 的 prompt 必须自包含，需写明文件路径、错误现象和期望行为，不能引用父 Agent 的历史，因为子 Agent 无法访问父 Agent 的上下文。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\主-子-agent-任务调度模式.md Low-confidence claim: 每个子 Agent 的 prompt 必须自包含，需写明文件路径、错误现象和期望行为，不能引用父 Agent 的历史，因为子 Agent 无法访问父 Agent 的上下文。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“每个子 Agent 的 prompt 必须自包含，需写明文件路径、错误现象和期望行为，不能引用父 Agent 的历史，因为子 Agent 无法访问父 Agent 的上下文。”是否仍然成立。

<!-- deep-research:deep-research-check-291d47e926a9 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/主-子-agent-任务调度模式.md
- 处理动作：Deep Research
- 对象：Claude Code 内建 Coordinator Mode，输入 /coordinator 即可将主 Agent 切换为纯调度者，子 Agent 通过 AgentTool 启动并拥有独立 context。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\主-子-agent-任务调度模式.md Low-confidence claim: Claude Code 内建 Coordinator Mode，输入 /coordinator 即可将主 Agent 切换为纯调度者，子 Agent 通过 AgentTool 启动并拥有独立 context。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Claude Code 内建 Coordinator Mode，输入 /coordinator 即可将主 Agent 切换为纯调度者，子 Agent 通过 AgentTool 启动并拥有独立 context。”是否仍然成立。

<!-- deep-research:deep-research-check-b9f1a694b4ef -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/主-子-agent-任务调度模式.md
- 处理动作：Deep Research
- 对象：在主-子 Agent 架构中，主 Agent 不执行任何实际工具调用，只负责理解子 Agent 的返回结果、合成下一步指令并并行派发独立任务。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\主-子-agent-任务调度模式.md Low-confidence claim: 在主-子 Agent 架构中，主 Agent 不执行任何实际工具调用，只负责理解子 Agent 的返回结果、合成下一步指令并并行派发独立任务。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“在主-子 Agent 架构中，主 Agent 不执行任何实际工具调用，只负责理解子 Agent 的返回结果、合成下一步指令并并行派发独立任务。”是否仍然成立。
