---
orphaned: true
title: AI上下文限制问题
summary: 当前大语言模型存在上下文窗口有限、缺乏持久记忆机制的固有缺陷，是制约AI在复杂业务场景中稳定发挥的核心瓶颈。
sources:
  - inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md
createdAt: "2026-04-16T15:52:37.070Z"
updatedAt: "2026-04-16T15:52:37.070Z"
tags:
  - AI局限性
  - 上下文窗口
  - 记忆机制
  - 大语言模型
aliases:
  - ai上下文限制问题
  - AI上下文限制问题
  - Harness_Engineering的核心理念_-_小红书
  - AI
  - 上下文窗口
  - 上下文窗口限制
  - context window
---

---
title: AI上下文限制问题
summary: AI 模型在单次对话或推理中能处理的信息量存在硬性上限，这一限制直接影响长文档处理、持续对话和复杂任务执行的可靠性。
tags:
  - AI
  - 上下文窗口
  - 记忆机制
  - Agent
  - Harness Engineering
aliases:
  - 上下文窗口限制
  - context window
---

# AI上下文限制问题

AI 模型在单次推理中能够"看到"和处理的信息量存在硬性上限，这一特性通常被称为**上下文窗口**（context window）限制。当输入内容超出该窗口时，模型无法感知窗口之外的信息，导致长对话、长文档处理和复杂任务执行出现可靠性问题。^[inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md]

## 核心问题

当前 AI 存在两个相互关联的根本性限制：^[inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md]

- 上下文有限：模型单次能处理的 token 数量有上限，超出部分会被截断或遗忘
- 缺乏记忆机制：模型本身不具备跨会话的持久记忆，每次对话默认从零开始

这两个问题叠加，使得 AI 在处理需要长期上下文或多步骤推理的业务场景时表现不稳定。^[inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md]

## 应对思路：为 AI 搭建脚手架

针对上述限制，一种有效的工程化应对思路是为 AI 搭建外部"脚手架"（scaffold），让模型在结构化的约束和支撑下更稳定、可靠地发挥能力。这一思路与 [[Harness Engineering]] 和 [[Agent集成工作流]] 的核心理念高度重合——通过外部系统补偿模型自身的能力边界，而非单纯依赖模型本身。^[inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md]

常见的脚手架手段包括：

- 外部记忆存储：将历史对话、用户偏好、任务状态持久化到数据库，按需检索注入上下文
- 上下文压缩与摘要：对超长内容进行分段摘要，只将关键信息送入模型
- 工具调用（tool use）：让模型通过调用外部工具获取实时信息，减少对上下文内嵌知识的依赖
- 任务分解：将复杂任务拆解为多个子任务，每个子任务独立在上下文窗口内完成

## 与 Agent 的关系

上下文限制问题是推动 [[Agent集成工作流]] 发展的重要动因之一。Agent 架构通过引入规划、记忆、工具调用等模块，系统性地绕开了单次推理的上下文瓶颈。Harness Engineering 与 Agent 的概念存在一定重叠，均有被泛化使用的趋势，但其核心都指向同一目标：在 AI 能力边界之外构建工程化支撑，使其能够可靠地解决实际业务需求。^[inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md]

## 竞争壁垒的转移

随着脚手架工程化手段日趋成熟，单纯的模型能力差距正在收窄。真正的竞争壁垒将逐渐转移到：如何设计更有效的上下文管理策略、如何构建更完善的外部记忆与工具体系，以及组织层面对 AI 工作流的整合与运营能力。^[inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md]

## 相关概念

- [[Harness Engineering]]
- [[Agent集成工作流]]
- [[记忆机制]]
- [[工具调用]]

## 来源

- inbox（剪藏进来的）__notionmpclipper__Harness_Engineering的核心理念_-_小红书__10004d23.md
