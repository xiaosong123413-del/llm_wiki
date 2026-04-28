---
title: Claude Code Coordinator Mode
summary: Claude Code 中的一种调度模式，主 agent 负责拆分任务与整合结果，子 agent 通过 AgentTool 执行具体工作，以降低长上下文任务的失真风险。
sources:
  - Thread by @Barret_China@Barret_China @Barret_China.md
createdAt: "2026-04-25T14:07:00.000Z"
updatedAt: "2026-04-25T14:07:00.000Z"
tags:
  - AI编程
  - 多智能体
  - 调度
aliases:
  - Claude Code Coordinator Mode
  - Coordinator Mode
---

# Claude Code Coordinator Mode

## 概述

**Claude Code Coordinator Mode** 是当前知识库里反复出现的一种任务调度模式。它把主 agent 从直接执行工具调用的角色中抽离出来，转为负责任务拆分、结果整合和后续派发。

## 解决的问题

它主要用于处理长程任务中的上下文膨胀问题。现有材料指出，当单个 agent 连续运行过久时，compact 与摘要压缩会导致细节遗失、重复劳动和退出变快，而 Coordinator Mode 通过把执行拆给独立子 agent 来缓解这个问题。

## 相关页面

- [[AgentTool]]
- [[AI 编码工具]]
- [[主-子 Agent 调度模式]]

