---
title: Agent Context 管理与 Compact 机制
summary: 针对长任务中上下文膨胀、摘要压缩和细节遗失问题的说明框架，在当前知识库中主要用于解释为何单 agent 长跑会逐渐失真。
sources:
  - Thread by @Barret_China@Barret_China @Barret_China.md
createdAt: "2026-04-25T14:41:00.000Z"
updatedAt: "2026-04-25T14:41:00.000Z"
tags:
  - AI智能体
  - 上下文
  - Compact
aliases:
  - Agent Context 管理与 Compact 机制
  - Auto-Compact
---

# Agent Context 管理与 Compact 机制

## 概述

**Agent Context 管理与 Compact 机制** 用来描述长任务执行时的一个典型问题：随着上下文不断膨胀，系统会进入摘要压缩或 compact 阶段，随后细节开始丢失，执行质量逐步下降。

## 在当前知识库中的位置

当前知识库把它视为多 agent 调度方案的直接动因之一。正因为单 agent 会在长跑中逐渐遗忘已完成工作，才需要通过任务拆分、进度持久化和子 agent 独立上下文来绕开这个瓶颈。

## 相关页面

- [[Claude Code Coordinator Mode]]
- [[多 Agent 系统]]
- [[AgentTool]]
