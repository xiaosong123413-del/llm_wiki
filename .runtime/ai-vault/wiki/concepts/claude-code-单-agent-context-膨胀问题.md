---
orphaned: true
title: Claude Code 单 Agent Context 膨胀问题
summary: Claude Code 在执行超大任务时，随着 context token 逼近 compact 阈值，对话历史被压缩为摘要，导致模型遗忘细节、重复劳动并最终提前退出任务。
sources: null
createdAt: "2026-04-19T20:03:01.003Z"
updatedAt: "2026-04-19T20:03:01.003Z"
tags:
  - AI编码工具
  - Claude Code
  - 上下文管理
  - 长程任务
aliases:
  - claude-code-单-agent-context-膨胀问题
  - CC单AC膨
  - Claude Code 单 Agent Context 膨胀问题
  - Claude Code
---

# Claude Code 单 Agent Context 膨胀问题

## 概述

在使用 [[Claude Code]]（简称 cc）执行大规模、长程任务时，用户常常会发现 Agent 无法一口气完成任务，而是在运行几十分钟后自动停下来，询问是否继续。这一现象的根本原因在于**单 Agent 的 Context 膨胀问题**：随着任务推进，对话历史不断积累，导致 Context 触碰压缩阈值，进而引发信息丢失、效率下降，最终使 Agent 提前退出任务。

---

## 单 Agent 执行流程与崩溃机制

在执行超大任务时，单 Agent 的执行流程会经历以下几个阶段：

1. **高效阶段**：任务刚开始，Context 较短，指令遵循效果极佳，Agent 高效执行。
2. **逼近阈值**：运行约 80k tokens 后，Context 开始逼近 auto-compact（自动压缩）阈值。
3. **首次压缩**：对话历史被压缩为摘要，模型开始忘记此前处理任务的细节（例如已修复了哪些单测）。
4. **反复压缩与性能退化**：经过一两轮 auto-compact 后，Agent 甚至会开始重复检查已处理过的内容。
5. **任务退出**：当触发 `maxTurns` 且 response 中不含 `ToolUse` 指令时，Agent 退出任务，向用户询问是否继续。

> 典型案例：让 Claude Code 补全项目中约 1k 个单元测试，Agent 仅完成约 200 个便停下，询问用户是否继续。

**关键警示**：在同一 session 中回复"继续"后，后续工作会更加不符合预期，且退出得更快。这是因为此时 Context 已经严重受损，压缩摘要无法还原完整的任务状态。

---

## 核心问题链

单 Agent 执行海量任务时，必然触发以下恶性循环：

```
Context 膨胀 → auto-compact 压缩 → 信息丢失 → 效率下降 → 提前退出
```

任何试图在一个 Agent Session 内完成海量工作的方案，最终都会陷入这一困境。

---

## 解决方案：主-子 Agent 架构

### 核心思路

优化方向是设计**主-子 Agent 运行模式**（任务调度器），并将任务进度持久化到文件系统。每个子 Agent 拥有独立的 Context 和独立的退出逻辑，主 Agent 只负责调度和进度追踪，从而绕过单一 Agent 的所有瓶颈。

核心原则：**设计多个 Agents，各司其职、快进快出，把进度交给文件系统来记忆。**

---

### 三大关键实践

#### 1. 任务分解

- 不要给无边界的指令（如"修复所有单测"）。
- 先扫描出所有失败测试，按目录或模块分组，**每组 15–30 个**，作为一个独立子任务。
- **每个子任务的 Prompt 必须自包含**：写清楚文件路径、错误现象、期望行为。
- 严禁写"根据之前的分析来修复"——子 Agent 看不到父 Agent 的历史上下文。

#### 2. 进度持久化

- 在项目根目录维护一个 `progress.json`，记录三个列表：
  - `completed`（已完成）
  - `failed`（失败）
  - `pending`（待处理）
- 主 Agent 每轮调度前读取该文件，决定下一批任务；子 Agent 完成后更新对应条目。
- 即使主 Agent 自身被 compact，重读文件即可恢复全部状态。

#### 3. 失败策略

| 情形 | 处理方式 |
|------|----------|
| 错误可修复 | 用 `SendMessage` 继续同一子 Agent（保留错误上下文更高效） |
| 方向完全错误 | 启动新的子 Agent，避免锚定在错误路径上 |
| 多次失败 | 上报用户，不要无限重试消耗 Token |

---

## Coordinator Mode

[[Claude Code]] 已内建上述多 Agent 能力。最直接的方式是启用 **Coordinator Mode**：

```
/coordinator
```

启用后：

- **主 Agent** 自动变为纯调度者，不执行任何实际工具调用，只负责：
  - 理解子 Agent 的返回结果
  - 合成下一步的具体指令
  - 并行派发独立任务
- **子 Agent** 通过 `AgentTool` 启动，拥有各自独立的 Context。

---

## 社区相关工具与实践

社区中也出现了若干类似思路的工具和实践方式：

- **Ralph 插件**（[github.com/snarktank/ralph](https://github.com/snarktank/ralph)）：设置好 PRD 文档后，可将项目拆分为多个小 Story，通过 CLI 不断唤起 Worker 依次完成每个 Story，适合代码新手使用，目前也被用于 Codex 等工具中。
- **AgentInbox**：通过订阅 GitHub PR 事件，在 PR 合并后自动触发消息给 Codex/Claude，驱动 Agent 自动推进下一个 Issue，实现事件驱动的任务链调度。

---

## 总结

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Agent 中途停止 | Context 触碰 compact 阈值 | 拆分为多个独立子任务 |
| 重复检查已完成工作 | auto-compact 导致信息丢失 | 进度持久化到 `progress.json` |
| 继续后效果更差 | 已压缩的 Context 无法还原状态 | 启动新子 Agent，而非在同一 session 中继续 |
| 大任务整体失控 | 单 Agent 无法维持全局状态 | 主-子 Agent 架构 + Coordinator Mode |

---

## 来源

## 置信度概览

- Claude Code 单 Agent 在执行约 80k tokens 后，context 开始逼近 compact 阈值，对话历史被自动压缩为摘要，模型随之丢失任务细节。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 当 Claude Code 触发 maxTurns 且 response 中不含 ToolUse 指令时，模型会退出当前任务并向用户询问是否继续。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 在同一个已经发生过 auto-compact 的 session 中回复「继续」，后续工作效果会更差且退出更快，因为 context 已被多次压缩。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-9f25bff5a3f0 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/claude-code-单-agent-context-膨胀问题.md
- 处理动作：Deep Research
- 对象：在同一个已经发生过 auto-compact 的 session 中回复「继续」，后续工作效果会更差且退出更快，因为 context 已被多次压缩。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\claude-code-单-agent-context-膨胀问题.md Low-confidence claim: 在同一个已经发生过 auto-compact 的 session 中回复「继续」，后续工作效果会更差且退出更快，因为 context 已被多次压缩。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“在同一个已经发生过 auto-compact 的 session 中回复「继续」，后续工作效果会更差且退出更快，因为 context 已被多次压缩。”是否仍然成立。

<!-- deep-research:deep-research-check-d07e21d6bf4e -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/claude-code-单-agent-context-膨胀问题.md
- 处理动作：Deep Research
- 对象：当 Claude Code 触发 maxTurns 且 response 中不含 ToolUse 指令时，模型会退出当前任务并向用户询问是否继续。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\claude-code-单-agent-context-膨胀问题.md Low-confidence claim: 当 Claude Code 触发 maxTurns 且 response 中不含 ToolUse 指令时，模型会退出当前任务并向用户询问是否继续。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“当 Claude Code 触发 maxTurns 且 response 中不含 ToolUse 指令时，模型会退出当前任务并向用户询问是否继续。”是否仍然成立。

<!-- deep-research:deep-research-check-a01ce595c45c -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/claude-code-单-agent-context-膨胀问题.md
- 处理动作：Deep Research
- 对象：Claude Code 单 Agent 在执行约 80k tokens 后，context 开始逼近 compact 阈值，对话历史被自动压缩为摘要，模型随之丢失任务细节。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\claude-code-单-agent-context-膨胀问题.md Low-confidence claim: Claude Code 单 Agent 在执行约 80k tokens 后，context 开始逼近 compact 阈值，对话历史被自动压缩为摘要，模型随之丢失任务细节。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Claude Code 单 Agent 在执行约 80k tokens 后，context 开始逼近 compact 阈值，对话历史被自动压缩为摘要，模型随之丢失任务细节。”是否仍然成立。
