---
orphaned: true
title: AI Agent Planning Hierarchy
summary: 一个三层框架（CoT → ReAct → Plan-and-Execute），按复杂性、交互性和任务范围对智能体推理策略进行分类。
sources:
createdAt: "2026-04-16T09:39:27.628Z"
updatedAt: "2026-04-16T09:39:27.628Z"
tags:
  - ai智能体
  - 架构
  - 规划
  - 框架
aliases:
  - ai-agent-planning-hierarchy
  - AAPH
  - AI-Agent规划框架
  - AI-Agent Planning Frameworks
---

```markdown
# AI [[Agent Planning Hierarchy]]

AI [[Agent Planning Hierarchy]] 描述了 AI 智能体规划能力的三个递进层级：[[Chain-of-Thought]]（CoT）、[[ReAct]] 和 [[Plan-and-Execute]]。每个层级解决问题的不同层面——从局部推理质量，到反应式工具使用，再到完整的任务分解和执行管理。

## 三个层级

### 第一层级 — 思维链（CoT）

[[Chain-of-Thought]] 提示 AI 模型在产生答案之前展现中间推理步骤。它解决"如何思考"的问题——在不协调多步骤任务或与外部工具交互的情况下提高局部推理质量。它最适合单步决策，如数学问题、逻辑推理和文本分析，在三个层级中具有最低的令牌成本。

### 第二层级 — [[ReAct]]

[[ReAct Pattern]] 在紧密的反馈循环中将思考与工具调用交替进行：智能体生成一个想法，调用工具，观察结果，然后重复。它解决"下一步做什么"的问题，使其非常适合简单环境中的短任务——网络搜索、API 调用、信息检索——其中反应式的逐步进展就足够了。其双向循环支持自我纠正，但它不会预先承诺全局计划。

### 第三层级 — [[Plan-and-Execute]]

[[Plan-and-Execute Framework]] 解决"如何分解和推进整个任务"的问题。它分两个阶段运作：规划阶段分解任务并排序其步骤，随后是执行阶段，在环境变化时动态重新规划的同时推进这些步骤。这个层级对于具有多重依赖关系的长任务是必需的——项目管理、复杂工程、多步骤决策工作流——以更高的令牌使用成本提供最高的全局优化。

## 为什么区分很重要

这些层级不可互换。能够推理并不会自动转化为组织长期任务的能力。知道如何调用工具并不能保证朝着复杂目标稳定前进。长链任务中的失败往往源于缺乏全局计划，而不是无法回答个别问题。

## 选择合适的层级

任务特征决定了哪个层级是合适的：

| 任务特征 | 推荐层级 |
|---|---|
| 单步逻辑或推理 | [[Chain-of-Thought]] |
| 需要工具/搜索使用的短任务 | [[ReAct Pattern]] |
| 具有依赖关系的多步骤任务 | [[Plan-and-Execute Framework]] |
| 具有严格约束的关键行动 | [[Plan-and-Execute Framework]] + [[Harness Engineering]] |

## 与 [[Harness Engineering]] 的关系

当关键行动需要硬约束时——法律、安全或代码安全场景——[[Plan-and-Execute Framework]] 应该与 [[Harness Engineering]] 结合使用。[[Harness Engineering]] 提供了一个结构约束层，强制执行行为而不仅仅是建议，通过确保执行保持在定义的边界内来补充规划层次结构。

## 相关概念

- [[Chain-of-Thought]]
- [[ReAct Pattern]]
- [[Plan-and-Execute Framework]]
- [[Harness Engineering]]

## 来源
