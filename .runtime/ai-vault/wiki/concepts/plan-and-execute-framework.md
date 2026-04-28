---
orphaned: true
title: Plan-and-Execute Framework
summary: 一种AI智能体架构，先对任务进行分解和排序，再按需执行并动态重规划
sources:
createdAt: "2026-04-16T09:38:22.693Z"
updatedAt: "2026-04-16T09:38:22.693Z"
tags:
  - ai智能体
  - 任务规划
  - 执行策略
aliases:
  - plan-and-execute-framework
  - AI-Agent规划
---

# [[Plan-and-Execute]] Framework

[[Plan-and-Execute]] Framework 是一种AI智能体架构，通过将规划与执行分离来应对复杂多步骤任务的管理挑战。与更简单的方案不同，该框架明确处理任务分解、排序以及执行过程中的动态重规划 。

## 概述

[[Plan-and-Execute]] 代表 [[AI Agent Planning]] 能力的第三层级，建立在 [[Chain-of-Thought]]（CoT）和 [[ReAct]] 等早期方案之上。CoT 聚焦于"如何思考"，[[ReAct]] 解决"下一步做什么"，而 [[Plan-and-Execute]] 则专门处理"如何拆解并推进整个任务" 。

## 核心问题

该框架针对智能体规划中的三个基本挑战：

- **任务分解**：如何将复杂目标拆解为可管理的子任务
- **工具选择**：确定每个步骤应使用哪些工具
- **动态重规划**：在执行过程中，根据环境变化决定何时调整计划

## 关键区别

[[Plan-and-Execute]] 与其他智能体方案的重要差异：

- **超越思考**：具备推理能力并不自动等同于能够组织长期任务
- **超越工具调用**：知道如何调用工具并不保证能稳定推进复杂目标
- **应对失败模式**：长链任务失败往往源于缺乏全局规划，而非无法回答单个问题

## 适用场景

该框架的适用性取决于任务特征：

- **简单任务**：对于简单环境中的短任务，[[ReAct]] 通常已足够
- **复杂任务**：对于具有多重依赖、需要分阶段推进的长任务，显式规划则不可或缺
- **受限操作**：当需要对关键动作进行严格控制时，[[Plan-and-Execute]] 应与 [[Harness Engineering]] 结合使用

## 相关概念

- [[AI-Agent Planning Frameworks]]
- [[Harness Engineering]]
- [[Chain-of-Thought]]
- [[ReAct]]

## 来源
