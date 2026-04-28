---
title: Thread by @Barret_China@Barret_China @Barret_China
summary: Claude Code 在执行超大任务时，随着 context token 逼近 compact 阈值，对话历史被压缩为摘要，导致模型遗忘细节、重复劳动并最终提前退出任务。
sourceFile: 剪藏__Thread by @Barret_China@Barret_China @Barret_China__f49fa0c9.md
sourceChannel: 剪藏
observedAt: "2026-04-19T20:02:14.421Z"
tags:
  - 情景记忆
---
# Thread by @Barret_China@Barret_China @Barret_China
## 来源
- 渠道：剪藏
- 文件：剪藏__Thread by @Barret_China@Barret_China @Barret_China__f49fa0c9.md
- 链接：https://x.com/Barret_China/status/2045787288618299542
- 时间：2026-04-19T20:02:14.421Z
## 本篇观察摘要
Claude Code 在执行超大任务时，随着 context token 逼近 compact 阈值，对话历史被压缩为摘要，导致模型遗忘细节、重复劳动并最终提前退出任务。
## 候选 Claims
- Claude Code 单 Agent 在执行约 80k tokens 后，context 开始逼近 compact 阈值，对话历史被自动压缩为摘要，模型随之丢失任务细节。（active / confidence 0.55）
- 当 Claude Code 触发 maxTurns 且 response 中不含 ToolUse 指令时，模型会退出当前任务并向用户询问是否继续。（active / confidence 0.55）
- 在同一个已经发生过 auto-compact 的 session 中回复「继续」，后续工作效果会更差且退出更快，因为 context 已被多次压缩。（active / confidence 0.55）
- 在主-子 Agent 架构中，主 Agent 不执行任何实际工具调用，只负责理解子 Agent 的返回结果、合成下一步指令并并行派发独立任务。（active / confidence 0.55）
- Claude Code 内建 Coordinator Mode，输入 /coordinator 即可将主 Agent 切换为纯调度者，子 Agent 通过 AgentTool 启动并拥有独立 context。（active / confidence 0.55）
- 每个子 Agent 的 prompt 必须自包含，需写明文件路径、错误现象和期望行为，不能引用父 Agent 的历史，因为子 Agent 无法访问父 Agent 的上下文。（active / confidence 0.55）
- 进度持久化文件 progress.json 记录 completed、failed、pending 三个列表，主 Agent 在每轮调度前读取以决定下一批任务，子 Agent 完成后更新对应条目。（active / confidence 0.55）
- 将任务进度写入文件系统而非依赖 context 记忆，即使主 Agent 自身被 compact，重读 progress.json 即可恢复全部状态，彻底解耦记忆与执行。（active / confidence 0.55）
- 建议将大任务按目录或模块分组，每组 15-30 个工作单元作为一个独立子任务，避免给出无边界的全量指令。（active / confidence 0.55）
- 子任务 prompt 中不应写「根据之前的分析来修复」之类的跨 Agent 引用，因为子 Agent 看不到父 Agent 的历史，跨 session 引用会导致任务失败。（active / confidence 0.55）
- 子 Agent 遇到可修复错误时，应用 SendMessage 继续同一个子 Agent，保留错误上下文比重启更高效。（active / confidence 0.55）
- 当子 Agent 方向完全错误时，应启动新的子 Agent，避免在错误路径上产生锚定效应。（active / confidence 0.55）
- 多次失败后应上报用户而非无限重试，防止持续消耗 token 而无实际进展。（active / confidence 0.55）
- Ralph 工具可读取项目 PRD 文档，自动将项目拆分为多个独立 story，再通过 CLI 持续唤起 worker Agent 逐一完成。（active / confidence 0.55）
- Ralph 会唤起一个监工对话框，充当调度者角色，通过 CLI 不断驱动 worker 执行，适合代码小白配合 Codex 使用。（active / confidence 0.55）
- AgentInbox 可订阅 GitHub PR 合并事件，合并后自动向 Codex/Claude 发送消息，驱动 Agent 自动开始处理下一个 issue。（active / confidence 0.55）
- AgentInbox 的订阅生命周期与关联资源绑定，例如 GitHub PR 关闭后与其相关的所有订阅会自动取消，避免僵尸订阅。（active / confidence 0.55）
## 与已有 Semantic Memory 的关系
- 涉及概念：[[claude-code-单-agent-context-膨胀问题]]、[[主-子-agent-任务调度模式]]、[[agent-任务进度持久化progressjson]]、[[agent-子任务分解原则]]、[[agent-失败重试策略]]、[[ralph-插件ai-编码任务编排工具]]、[[agentinbox-事件驱动-agent-触发机制]]
## 是否触发新 Procedure
- 暂未触发新的程序记忆