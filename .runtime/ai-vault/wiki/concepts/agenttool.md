---
title: AgentTool
summary: 在当前知识库语境里，AgentTool 指主 agent 用来启动子 agent 的工具接口，使不同子任务拥有各自独立的上下文与退出边界。
sources:
  - Thread by @Barret_China@Barret_China @Barret_China.md
createdAt: "2026-04-25T14:08:00.000Z"
updatedAt: "2026-04-25T14:08:00.000Z"
tags:
  - AI编程
  - 工具调用
  - 多智能体
aliases:
  - AgentTool
---

# AgentTool

## 概述

在当前知识库里，**AgentTool** 被描述为主 agent 启动子 agent 的工具接口。它的关键价值不是“再开一个对话”，而是为每个子任务分配独立上下文，使任务不会互相污染。

## 在任务调度中的作用

现有材料把 AgentTool 视为 Coordinator Mode 能成立的基础部件之一。主 agent 负责任务理解和调度，子 agent 则通过 AgentTool 被唤起，并在清晰的任务边界内执行具体工作。

## 相关页面

- [[Claude Code Coordinator Mode]]
- [[主-子 Agent 调度模式]]
- [[Agent集成工作流]]

