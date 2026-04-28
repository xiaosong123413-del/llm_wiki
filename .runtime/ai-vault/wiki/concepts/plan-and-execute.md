---
orphaned: true
title: Plan-and-Execute
summary: 一种两阶段AI智能体策略，先制定全局计划，然后逐步执行，在执行过程中进行动态调整。
sources:
  - ai知识库（第二大脑）__概念__CoT__60ca95e7.md
createdAt: "2026-04-16T09:38:45.895Z"
updatedAt: "2026-04-16T09:38:45.895Z"
tags:
  - ai智能体
  - 规划
  - 多步骤
  - 大语言模型
aliases:
  - plan-and-execute
  - AI-Agent规划框架
---

# Plan-and-Execute

Plan-and-Execute是一种[[AI Agent]]规划架构，将任务规划与任务执行分离。它代表了智能体推理三级层次结构中最强大的层级，在复杂性和范围方面位于[[Chain of Thought (CoT)]]和[[ReAct Pattern]]之上。

## 在规划层次中的位置

智能体规划能力通常分为三个层级：

1. [[Chain of Thought (CoT)]] — 扩展中间推理步骤；适用于单步决策
2. [[ReAct Pattern]] — 在反馈循环中交替进行推理和工具使用；适用于交互式任务
3. Plan-and-Execute — 预先制定全局计划，然后通过动态调整执行；适用于复杂的多步骤任务

虽然CoT解决"如何思考"的问题，[[ReAct]]解决"下一步做什么"的问题，Plan-and-Execute解决"如何分解和推进整个任务"的问题。关键洞察是推理能力和工具调用能力并不会自动转化为在长期、依赖性强的目标上的可靠进展——这需要明确的全局规划。

## 工作原理

Plan-and-Execute在两个不同的阶段运行：

1. 规划阶段 — 智能体在开始任何执行之前，将整体目标分解为有序的子任务序列
2. 执行阶段 — 智能体逐步完成子任务，能够在条件变化时动态调整计划

这种分离使智能体从一开始就具有任务的全局视图，能够更好地进行工具选择、依赖管理和从意外结果中恢复。

## 解决的核心问题

Plan-and-Execute专门设计来处理简单方法无法解决的三个挑战：

- 任务分解 — 将复杂目标分解为可管理的、有序的子任务
- 工具选择 — 确定在每个阶段哪些工具是合适的
- 动态重新规划 — 识别环境变化何时需要在执行过程中修订计划

长链任务失败通常不是由于局部推理不佳造成的；它们源于缺乏全局计划。Plan-and-Execute直接针对这种失败模式。

## 权衡

| 属性 | CoT | [[ReAct]] | Plan-and-Execute |
|---|---|---|---|
| Token成本 | 低 | 中等 | 高 |
| 可解释性 | 高 | 中等 | 高 |
| 处理动态信息 | 否 | 是 | 是 |
| 多步骤工程 | 否 | 部分 | 是 |

Plan-and-Execute的主要成本是token消耗——前期规划阶段比反应式方法需要更多上下文。初始计划也可能不完美，需要在执行过程中进行修订。

## 何时使用

- 对于在简单环境中工具依赖较少的短任务，使用[[ReAct Pattern]]
- 对于具有多个依赖关系、需要分阶段推进的长任务，使用Plan-and-Execute
- 当关键操作需要硬结构约束而不是软提示指导时，将Plan-and-Execute与[[Harness Engineering]]结合使用

## 与其他概念的关系

[[Harness Engineering]]提供了Plan-and-Execute可以在其中运行的约束层。虽然Plan-and-Execute管理做什么以及按什么顺序做，[[Harness Engineering]]强制某些操作不能被跳过或绕过——两者是互补的而不是竞争的。[[Chain of Thought (CoT)]]在Plan-and-Execute工作流的各个步骤中仍然有用，可以提高局部推理质量。

## 来源
