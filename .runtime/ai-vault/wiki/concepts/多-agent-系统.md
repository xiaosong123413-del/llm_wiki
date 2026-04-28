---
title: 多 Agent 系统
summary: 由多个职责分离的智能体协同完成任务的执行模式，在当前知识库中主要用于解决长任务中的上下文膨胀与执行退化问题。
sources:
  - Thread by @Barret_China@Barret_China @Barret_China.md
createdAt: "2026-04-25T14:39:00.000Z"
updatedAt: "2026-04-25T14:39:00.000Z"
tags:
  - AI智能体
  - 调度
  - 协作
aliases:
  - 多 Agent 系统
  - 多智能体协作
  - 多 Agent 编排
---

# 多 Agent 系统

## 概述

**多 Agent 系统** 指把一个复杂任务拆给多个职责不同的智能体共同完成，而不是让单个 agent 从头跑到尾。当前知识库里，这个模式主要用于缓解长任务中的 compact、遗忘和重复劳动。

## 在当前知识库中的位置

相关页面通常把它与调度器模式、进度持久化和失败重试策略放在一起讨论。重点不在“同时开更多窗口”，而在让每个子任务拥有清晰边界与独立上下文。

## 相关页面

- [[Claude Code Coordinator Mode]]
- [[AgentTool]]
- [[任务分解策略]]
