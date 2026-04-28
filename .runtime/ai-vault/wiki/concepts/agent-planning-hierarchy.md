---
orphaned: true
title: Agent Planning Hierarchy
summary: 本地推理（CoT）、反应式执行（ReAct）与策略规划（Plan-and-Execute）三层架构的区别
sources:
  - ai知识库（第二大脑）__概念__AI-Agent规划__1e0b10dd.md
createdAt: "2026-04-16T09:38:33.326Z"
updatedAt: "2026-04-16T09:38:33.326Z"
tags:
  - AI架构
  - 规划层级
  - 认知层次
aliases:
  - agent-planning-hierarchy
  - APH
  - AI-Agent规划
---

# Agent Planning Hierarchy

Agent Planning Hierarchy 描述了 AI 智能体规划能力的三个递进层级：[[Chain-of-Thought]]（CoT）、[[ReAct]] 和 [[Plan-and-Execute]]。每个层级针对问题的不同维度——从本地推理质量，到反应式工具调用，再到完整的任务分解与执行管理。

## 三个层级

### 第一层 — Chain-of-Thought（CoT）

CoT 通过展开中间推理步骤来提升本地思考的质量。它回答的是"如何思考"的问题——让模型在给出答案之前能够更仔细地推敲问题。CoT 本身不协调多步骤任务，也不与外部工具交互。

### 第二层 — [[ReAct]]

[[ReAct]] 将思考与工具调用交织进行，利用环境反馈决定下一步行动。它回答的是"下一步做什么"的问题——非常适合简单环境中的短任务，在这类场景下反应式的逐步推进已经足够。

### 第三层 — [[Plan-and-Execute]]

[[Plan-and-Execute Framework]] 回答的是"如何分解并推进整个任务"的问题。它先对任务进行分解并排列步骤，然后在执行过程中根据环境变化按需重新规划。对于具有多个依赖关系、需要分阶段推进的长任务，这一层级是必要的。

## 为什么这种区分很重要

三个层级并不可以互相替代。具备推理能力并不自动等同于能够组织长周期任务。知道如何调用工具也不能保证朝着复杂目标稳定推进。长链任务的失败往往源于缺乏全局规划，而非无法回答单个问题。

## 工程选型指南

选择合适的层级取决于任务特征：

- 简单环境中的短任务——[[ReAct]] 通常已经足够
- 具有多个依赖关系、需要分阶段推进的长任务——需要通过 [[Plan-and-Execute Framework]] 进行显式规划
- 需要严格约束的关键操作——[[Plan-and-Execute Framework]] 应与 [[Harness Engineering]] 结合使用

## 相关概念

- [[Plan-and-Execute Framework]]
- [[Chain-of-Thought]]
- [[ReAct]]
- [[Harness Engineering]]
- [[AI-Agent Planning Frameworks]]

## 来源
