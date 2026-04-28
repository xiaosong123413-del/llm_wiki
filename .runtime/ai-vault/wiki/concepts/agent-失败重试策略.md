---
orphaned: true
title: Agent 失败重试策略
summary: 子 Agent 报错时，依据错误是否可修复采用差异化策略：可修复则用 SendMessage 继续同一子 Agent；方向错误则启动新子 Agent；多次失败则上报用户，避免无限重试消耗 token。
sources: null
createdAt: "2026-04-19T20:03:01.303Z"
updatedAt: "2026-04-19T20:03:01.303Z"
tags:
  - AI编码工具
  - 错误处理
  - 多Agent架构
  - Claude Code
aliases:
  - agent-失败重试策略
  - Agent 失败重试策略
  - Agent
---

# Agent 失败重试策略

## 概述

在 [[多 Agent 系统]] 设计中，失败重试策略是保障长程任务稳定运行的核心机制之一。当子 Agent 在执行过程中遭遇错误时，如何决定"继续同一个 Agent"、"启动新 Agent"还是"上报用户"，直接决定了整个任务流水线的健壮性与 token 利用效率。本页面围绕在 [[Claude Code]] 等工具中实践 Agent 失败重试策略的原则与方法进行梳理。

---

## 为什么需要失败重试策略

在单 Agent 模式下执行超大任务时，会经历以下典型的退化路径：

1. **高效阶段**：任务初期指令遵循效果良好；
2. **Context 膨胀**：随着对话历史累积，约跑到 80k tokens 时逼近 compact 阈值；
3. **信息丢失**：对话历史被压缩为摘要，模型忘记前期处理细节；
4. **重复与退出**：多轮 auto-compact 后，Agent 开始重复检查已完成的工作，最终触发 `maxTurns` 后退出并询问用户是否继续。

这种 **context 膨胀 → compact → 信息丢失 → 效率下降** 的循环，使得任何试图在单一 Agent session 内完成海量工作的方案都难以奏效。在当前 session 中回复"继续"反而会让后续工作更加不符合预期，并且退出得更快。

---

## 核心失败重试策略

### 1. 错误可修复：继续同一个子 Agent

当子 Agent 报错，但错误属于可修复范围时，推荐使用 `SendMessage` 继续与**同一个子 Agent** 通信，而非立即重开。

- **原因**：同一个子 Agent 保留了当前的错误上下文，修复效率更高；
- **适用场景**：语法错误、边界条件未覆盖、单次工具调用失败等局部性问题。

### 2. 方向性错误：启动新的子 Agent

如果子 Agent 的执行方向完全走偏（例如对问题的理解出现根本性偏差），则应**终止当前子 Agent，启动新的子 Agent**。

- **原因**：继续在错误路径上追加对话，会让 Agent "锚定"在错误思路上，导致更多无效 token 消耗；
- **关键做法**：新子 Agent 的 prompt 必须**自包含**，写清楚文件路径、错误现象、期望行为，不能依赖"根据之前的分析"等引用，因为新子 Agent 看不到父 Agent 的历史。

### 3. 多次失败：上报用户，不无限重试

当同一任务经过多次重试仍然失败时，应**主动上报用户**，终止自动重试循环。

- **原因**：无限重试会持续消耗 token，且对于超出 Agent 能力范围的问题，重试本身没有意义；
- **原则**：多次失败则上报用户，不要无限重试烧 token。

---

## 配套机制：让失败重试策略真正有效

失败重试策略需要与以下机制配合，才能在实际工程中落地：

### 任务分解

不要给出无边界的指令（如"修复所有单测"），而是先扫描出所有失败任务，按目录或模块分组，**每组 15–30 个**作为一个独立子任务。每个子任务的 prompt 必须自包含，写清楚文件路径、错误现象与期望行为。

### 进度持久化

在项目根目录维护一个 `progress.json`，记录三个列表：

| 字段 | 含义 |
|---|---|
| `completed` | 已完成的子任务 |
| `failed` | 失败的子任务 |
| `pending` | 待处理的子任务 |

主 Agent 每轮调度前读取该文件决定下一批任务，子 Agent 完成后更新对应条目。即使主 Agent 自身被 compact，重读文件也能恢复全部状态。这是失败重试得以"有记忆地"执行的基础。

### 主-子 Agent 架构（任务调度器）

采用**主 Agent 只负责调度与进度追踪，子 Agent 负责具体执行**的分工模式：

- 每个子 Agent 拥有**独立 context** 与**独立退出逻辑**，避免单一 session context 膨胀；
- 主 Agent 理解子 Agent 的返回结果，合成下一步具体指令，并行派发独立任务；
- 在 Claude Code 中，可通过启用 **Coordinator Mode**（输入 `/coordinator`）激活此模式，每个子 Agent 通过 `AgentTool` 启动。

---

## 决策流程总览

```
子 Agent 执行失败
       │
       ▼
  错误是否可修复？
  ┌────┴────┐
  是        否
  │         │
  ▼         ▼
SendMessage  方向完全错误？
继续同一     ┌────┴────┐
子 Agent     是        否
             │         │
             ▼         ▼
          启动新     是否已
          子 Agent   多次失败？
                    ┌────┴────┐
                    是        否
                    │         │
                    ▼         ▼
                 上报用户   继续重试
                 终止循环
```

---

## 实践建议

1. **设计多个 Agents，各司其职、快进快出**，把进度交给文件系统来记忆；
2. 每个子任务的 prompt 必须**自包含**，不依赖历史 context；
3. 在重试前先判断失败类型，避免在错误路径上浪费 token；
4. 多次失败时果断上报，保留人工介入的空间；
5. 利用社区工具（如 Ralph 插件）可以进一步简化主-子 Agent 的调度流程，它能将 PRD 拆分为若干 story，通过 CLI 不断唤起 worker 来逐一完成。

---

## 相关页面

- [[多 Agent 系统]]
- [[Context 窗口管理]]
- [[进度持久化]]
- [[Claude Code]]
- [[任务分解策略]]
- [[Coordinator Mode]]

---

## 来源

## 置信度概览

- 子 Agent 遇到可修复错误时，应用 SendMessage 继续同一个子 Agent，保留错误上下文比重启更高效。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 当子 Agent 方向完全错误时，应启动新的子 Agent，避免在错误路径上产生锚定效应。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 多次失败后应上报用户而非无限重试，防止持续消耗 token 而无实际进展。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-2712959fc88b -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agent-失败重试策略.md
- 处理动作：Deep Research
- 对象：多次失败后应上报用户而非无限重试，防止持续消耗 token 而无实际进展。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agent-失败重试策略.md Low-confidence claim: 多次失败后应上报用户而非无限重试，防止持续消耗 token 而无实际进展。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“多次失败后应上报用户而非无限重试，防止持续消耗 token 而无实际进展。”是否仍然成立。

<!-- deep-research:deep-research-check-614c9cbab3eb -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agent-失败重试策略.md
- 处理动作：Deep Research
- 对象：当子 Agent 方向完全错误时，应启动新的子 Agent，避免在错误路径上产生锚定效应。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agent-失败重试策略.md Low-confidence claim: 当子 Agent 方向完全错误时，应启动新的子 Agent，避免在错误路径上产生锚定效应。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“当子 Agent 方向完全错误时，应启动新的子 Agent，避免在错误路径上产生锚定效应。”是否仍然成立。

<!-- deep-research:deep-research-check-23164b645678 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agent-失败重试策略.md
- 处理动作：Deep Research
- 对象：子 Agent 遇到可修复错误时，应用 SendMessage 继续同一个子 Agent，保留错误上下文比重启更高效。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agent-失败重试策略.md Low-confidence claim: 子 Agent 遇到可修复错误时，应用 SendMessage 继续同一个子 Agent，保留错误上下文比重启更高效。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“子 Agent 遇到可修复错误时，应用 SendMessage 继续同一个子 Agent，保留错误上下文比重启更高效。”是否仍然成立。
