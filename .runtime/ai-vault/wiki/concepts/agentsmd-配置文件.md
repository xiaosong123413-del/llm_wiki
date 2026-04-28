---
orphaned: true
title: AGENTS.md 配置文件
summary: AI 编码 Agent（如 OpenAI Codex）用于读取任务规则与行为约束的配置文件，开发者可在其中添加自定义指令来影响 Agent 的行为，例如强制所有 shell 命令前缀使用特定工具。
sources: null
createdAt: "2026-04-19T17:22:09.788Z"
updatedAt: "2026-04-19T17:22:09.788Z"
tags:
  - AI编码工具
  - Agent配置
  - Codex
  - 工作流
aliases:
  - agentsmd-配置文件
  - AGENTS.md 配置文件
  - AGENTS
  - AI Agent 配置
---

# AGENTS.md 配置文件

## 概述

`AGENTS.md` 是在 [[AI 编码工具]]（如 [[OpenAI Codex]]、[[Claude Code]]、[[Cursor]] 等）中用于配置 AI Agent 行为规则的配置文件。通过在该文件中写入特定指令，开发者可以控制 AI Agent 在执行任务时遵循的规范与约束，从而影响其工作方式与输出质量。

---

## 文件作用

`AGENTS.md` 文件的核心作用是向 AI Agent 提供额外的行为指令。以 [[OpenAI Codex]] 为例，当工具执行任务时会读取该文件，并将其中的规则纳入 Agent 的决策依据。这意味着开发者可以通过修改此文件，定制 Agent 的命令执行方式，而无需每次手动在对话中重复说明要求。

---

## 典型配置示例

### 配合 rtk 使用

[[rtk]]（Rust Token Killer）是一款专为 AI 编码场景设计的 [[token]] 节省工具。使用 `rtk init` 命令时，针对 Codex 的初始化方式是在 `AGENTS.md` 中添加指令，额外读取 `RTK.md` 配置文件。

有用户发现，直接在 `AGENTS.md` 中加入一行规则更为简洁高效：

```markdown
## RTK Rule

- Always prefix shell commands with `rtk`.
```

上述规则要求 AI Agent 在执行所有 Shell 命令时，统一在命令前加上 `rtk` 前缀，从而让 rtk 自动拦截并过滤命令输出，减少传入上下文的冗余信息，达到节省 token 的目的。

---

## 与 rtk 工具的关系

[[rtk]] 工具会对 `git status`、`cargo test`、`npm install`、`docker ps` 等 100+ 常见开发者命令的输出进行智能过滤、压缩、去重与截断，只将"关键信息"传递给 AI，避免冗余日志、进度条、重复路径等内容占用上下文窗口。

`AGENTS.md` 在其中扮演的角色是"规则传递桥梁"——通过文件中的指令，确保 AI Agent 在每次执行命令时都自动调用 rtk，而非依赖用户在对话中临时提醒。相比 `rtk init` 的默认方式（附加独立的 `RTK.md`），直接修改 `AGENTS.md` 添加单行规则被部分用户认为更加简洁。

---

## 注意事项

- **配置不一定自动生效**：使用 `rtk init` 进行初始化时，其针对 Codex 设置的功能不一定完全有效，建议手动检查并修改 `AGENTS.md` 的内容以确保规则被正确应用。
- **对回答质量的潜在影响**：通过 `AGENTS.md` 启用命令输出过滤后，确实可能节省约 35% 左右的 token，但也存在对回答质量产生一定损耗的情况，尤其在准确率要求较高的任务中，错误率可能有所提升。
- **特定场景下的局限性**：如果任务中频繁涉及容器操作（如 Docker），启用相关过滤规则后错误率会相对较高，需谨慎评估是否适用。
- **配置复杂度**：部分场景下（如读取 TypeScript 类型定义文件时），过度过滤可能导致关键定义被省略，影响 AI 的理解与输出，需根据实际情况调整规则粒度。

---

## 相关概念

- [[OpenAI Codex]]
- [[Claude Code]]
- [[Cursor]]
- [[rtk]]
- [[token 优化]]
- [[AI Agent 配置]]

---

## 来源

## 置信度概览

- AGENTS.md 是 AI 编码 Agent（如 Codex）读取的配置文件，开发者可在其中声明规则和约束，Agent 会在执行任务时遵循这些自定义指令。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 在 AGENTS.md 中添加 'Always prefix shell commands with rtk.' 是将 rtk 集成到 Codex 工作流的推荐配置模式，比 rtk init 自动初始化更稳定可靠。（confidence 0.55 / retention 0.99 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-68a755a28932 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agentsmd-配置文件.md
- 处理动作：Deep Research
- 对象：在 AGENTS.md 中添加 'Always prefix shell commands with rtk.' 是将 rtk 集成到 Codex 工作流的推荐配置模式，比 rtk init 自动初始化更稳定可靠。
- 触发依据：当前结论置信度只有 0.54，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agentsmd-配置文件.md Low-confidence claim: 在 AGENTS.md 中添加 'Always prefix shell commands with rtk.' 是将 rtk 集成到 Codex 工作流的推荐配置模式，比 rtk init 自动初始化更稳定可靠。 (confidence 0.54, status active)
- 建议写入：补齐外部来源后，再确认“在 AGENTS.md 中添加 'Always prefix shell commands with rtk.' 是将 rtk 集成到 Codex 工作流的推荐配置模式，比 rtk init 自动初始化更稳定可靠。”是否仍然成立。

<!-- deep-research:deep-research-check-020eff73e631 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/agentsmd-配置文件.md
- 处理动作：Deep Research
- 对象：AGENTS.md 是 AI 编码 Agent（如 Codex）读取的配置文件，开发者可在其中声明规则和约束，Agent 会在执行任务时遵循这些自定义指令。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\agentsmd-配置文件.md Low-confidence claim: AGENTS.md 是 AI 编码 Agent（如 Codex）读取的配置文件，开发者可在其中声明规则和约束，Agent 会在执行任务时遵循这些自定义指令。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“AGENTS.md 是 AI 编码 Agent（如 Codex）读取的配置文件，开发者可在其中声明规则和约束，Agent 会在执行任务时遵循这些自定义指令。”是否仍然成立。
