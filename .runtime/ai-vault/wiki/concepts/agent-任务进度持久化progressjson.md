---
orphaned: true
title: Agent 任务进度持久化（progress.json）
summary: 在项目根目录维护 progress.json 记录 completed / failed / pending 三个列表，主 Agent 每轮调度前读取该文件，子 Agent 完成后更新，实现即使主 Agent 被 compact 也能通过重读文件恢复全部状态。
sources: null
createdAt: "2026-04-19T20:03:00.894Z"
updatedAt: "2026-04-19T20:03:00.894Z"
tags:
  - AI编码工具
  - 任务管理
  - 状态持久化
  - 多Agent架构
aliases:
  - agent-任务进度持久化progressjson
  - Agent 任务进度持久化
  - Agent
  - 进度持久化
  - 进度持久化与 progress.json
---

# Agent 任务进度持久化（progress.json）

## 概述

在使用 [[Claude Code]] 或类似 AI Agent 工具执行长程复杂任务时，单一 Agent 的 context 膨胀问题是阻碍任务顺利完成的核心瓶颈。**任务进度持久化**通过在文件系统中维护一份结构化的进度文件（通常命名为 `progress.json`），将 Agent 的执行状态外部化，从而使整个任务编排系统能够在 context 被压缩或 Agent 退出后依然恢复并继续执行。

---

## 背景：为什么需要进度持久化

### 单 Agent 的执行瓶颈

当向 Agent 布置一项超大任务（如将项目中全部 1000 个单元测试补全）时，单 Agent 的执行流程通常会经历以下几个阶段：

1. **高效模式**：任务初期，指令遵循效果极佳；
2. **Context 逼近阈值**：跑了约 80k tokens 后，对话历史开始接近 compact 阈值；
3. **信息压缩与丢失**：对话历史被压缩为摘要，模型开始遗忘刚才处理的细节；
4. **重复检查与退出**：经过一两轮 auto-compact 后，Agent 甚至会重复检查已完成的内容，最终触发 `maxTurns` 后退出，询问用户是否继续。

任何试图在单一 Agent session 内完成海量工作的方案，最终都会遭遇「context 膨胀 → compact → 信息丢失 → 效率下降」的恶性循环。

---

## progress.json 的核心设计

### 文件结构

`progress.json` 存放于项目根目录，记录三个核心列表：

```json
{
  "completed": [...],
  "failed": [...],
  "pending": [...]
}
```

| 字段 | 含义 |
|------|------|
| `completed` | 已成功完成的子任务列表 |
| `failed` | 执行失败的子任务列表 |
| `pending` | 尚未开始或等待调度的子任务列表 |

### 读写时机

- **主 Agent 每轮调度前**读取 `progress.json`，根据文件内容决定下一批需要派发的子任务；
- **子 Agent 完成或失败后**更新对应条目，将任务从 `pending` 移入 `completed` 或 `failed`。

这样即使主 Agent 自身被 compact，只需重读文件即可恢复全部执行状态，无需依赖任何 context 内的历史记忆。

---

## 与主-子 Agent 架构的协同

进度持久化并非孤立存在，它是**主-子 Agent 调度模式**的重要组成部分。在该架构中：

- **主 Agent（Coordinator）**：不执行具体工具调用，只负责读取 `progress.json`、理解子 Agent 的返回结果、合成下一步指令并并行派发任务；
- **子 Agent（Worker）**：通过 `AgentTool` 启动，拥有独立的 context 和独立的退出逻辑，完成任务后将结果写回 `progress.json`。

相关内容见 [[主-子 Agent 调度模式]] 与 [[Claude Code Coordinator Mode]]。

---

## 配套的三要素设计

进度持久化方案需要与以下两个要素配合使用，才能形成完整的长程任务执行框架：

### 1. 任务分解

不要给 Agent 一个无边界的指令。应当先扫描出所有待处理项，按目录或模块分组，每组 15–30 个，作为独立子任务。

**关键原则**：每个子任务的 prompt 必须**自包含**——写清楚文件路径、错误现象、期望行为，不能写"根据之前的分析来修复"，因为子 Agent 看不到父 Agent 的历史。

### 2. 进度持久化（本页重点）

即本页所描述的 `progress.json` 机制，是整个系统的"外部记忆"。

### 3. 失败策略

| 场景 | 应对方式 |
|------|----------|
| 错误可修复 | 用 `SendMessage` 继续同一子 Agent，保留错误 context 更高效 |
| 方向完全错误 | 启动新的子 Agent，避免锚定在错误路径上 |
| 多次失败 | 上报用户，不要无限重试以节省 token |

---

## 核心优势

- **抗 compact 能力**：状态存于文件系统，不依赖模型 context，任何时间点重启都能从断点恢复；
- **支持并行调度**：主 Agent 可基于 `pending` 列表同时派发多个独立子任务；
- **可审计、可追溯**：`progress.json` 是人类可读的结构化文件，方便开发者随时检查任务执行状态；
- **绕过单 Agent 瓶颈**：将"记忆"责任从模型 context 转移到文件系统，从根本上解决长程任务的退化问题。

---

## 实践建议

1. **尽早初始化 `progress.json`**：在任务开始时由主 Agent 或外部脚本一次性生成所有 `pending` 条目；
2. **原子写入**：子 Agent 更新文件时应避免并发写冲突，可采用追加后合并或加锁写入的方式；
3. **附加元数据**：可在每个条目中记录时间戳、错误信息、重试次数等，为失败策略提供更丰富的决策依据；
4. **启用 Coordinator Mode**：在 [[Claude Code]] 中输入 `/coordinator` 可直接启用内建的主-子 Agent 调度能力，与 `progress.json` 机制配合使用效果更佳。

---

## 总结

> 设计多个 agents，各司其职、快进快出，**把进度交给文件系统来记忆**。

`progress.json` 是这一理念的直接落地：它让 Agent 的状态从易失的模型 context 中解耦出来，存入持久、可读、可恢复的文件系统，从而使整个多 Agent 编排体系具备真正的长程执行能力。

---

## 来源

- 剪藏__Thread by @Barret_China@Barret_China @Barret_China__f49fa0c9.md（原文链接：https://x.com/Barret_China/status/2045787288618299542，发布于 2026-04-19）

## 置信度概览

- 将任务进度写入文件系统而非依赖 context 记忆，即使主 Agent 自身被 compact，重读 progress.json 即可恢复全部状态，彻底解耦记忆与执行。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 进度持久化文件 progress.json 记录 completed、failed、pending 三个列表，主 Agent 在每轮调度前读取以决定下一批任务，子 Agent 完成后更新对应条目。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-20ef818236bd -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agent-任务进度持久化progressjson.md
- 处理动作：Deep Research
- 对象：将任务进度写入文件系统而非依赖 context 记忆，即使主 Agent 自身被 compact，重读 progress.json 即可恢复全部状态，彻底解耦记忆与执行。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agent-任务进度持久化progressjson.md Low-confidence claim: 将任务进度写入文件系统而非依赖 context 记忆，即使主 Agent 自身被 compact，重读 progress.json 即可恢复全部状态，彻底解耦记忆与执行。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“将任务进度写入文件系统而非依赖 context 记忆，即使主 Agent 自身被 compact，重读 progress.json 即可恢复全部状态，彻底解耦记忆与执行。”是否仍然成立。

<!-- deep-research:deep-research-check-d6f6f5f34968 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agent-任务进度持久化progressjson.md
- 处理动作：Deep Research
- 对象：进度持久化文件 progress.json 记录 completed、failed、pending 三个列表，主 Agent 在每轮调度前读取以决定下一批任务，子 Agent 完成后更新对应条目。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agent-任务进度持久化progressjson.md Low-confidence claim: 进度持久化文件 progress.json 记录 completed、failed、pending 三个列表，主 Agent 在每轮调度前读取以决定下一批任务，子 Agent 完成后更新对应条目。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“进度持久化文件 progress.json 记录 completed、failed、pending 三个列表，主 Agent 在每轮调度前读取以决定下一批任务，子 Agent 完成后更新对应条目。”是否仍然成立。
