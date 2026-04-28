---
orphaned: true
title: AI Manager 核查职责
summary: 在 AI 生成调研报告的工作流中，人类需履行「AI Manager」角色，对重要细节点击原始链接核查，确保关键信息的准确性。
sources: null
createdAt: "2026-04-19T17:24:37.182Z"
updatedAt: "2026-04-19T17:24:37.182Z"
tags:
  - AI工作流
  - 信息核查
  - 人机协作
aliases:
  - ai-manager-核查职责
  - AM核
  - AI Manager 核查职责
  - AI Manager
---

# AI Manager 核查职责

## 概述

在人机协作的调研与决策流程中，人类扮演着 **AI Manager** 的角色，负责对 [[AI]] 生成的内容进行核查与把关。这一职责是整个"人类与 AI 打配合"模式中不可或缺的环节，确保 AI 输出的信息准确可靠，最终服务于高质量的决策。

---

## 核查职责的背景与必要性

在使用 [[OpenAI Deep Research]]、[[Perplexity Deep Research]]、[[Gemini with Deep Research]] 等 AI 调研工具时，AI 能够在极短时间内完成大量数据搜集、整理与报告生成工作。然而，正因为 AI 产出速度快、内容量大，人类必须保留对关键细节的核查能力，而不能完全依赖 AI 的输出结果。

> "在整个过程中我们还是要履行一个 AI Manager 的职责，对重要的细节要点到网页里去核查。"

---

## 核查的具体方式

### 点击溯源
AI Manager 的核查操作通常十分简便：对于 AI 调研报告中涉及的重要细节，直接**点击报告中的引用链接**，进入原始网页进行核实。

### 高亮辅助
以 [[Deep Research]] 为例，该工具会**自动将相关语句在原始页面中高亮标注**，使核查者能够迅速定位到具体证据，大幅降低核查的时间成本。

---

## 核查职责在人机协作分工中的位置

AI Manager 的核查职责嵌套在以下人机协作分工模型中：

| 角色 | 负责内容 |
|---|---|
| **AI** | 数据挖掘：搜集、清洗并整理原始信息，生成调研报告 |
| **人类（AI Manager）** | 认知炼金：从信息中提炼洞见（insight），决策下一步方向，并对重要细节进行核查 |

人类的核查行为处于"认知炼金"环节的前置步骤，确保用于提炼洞见的原始信息具有可信度。

---

## 核查的重点对象

根据实际使用场景，以下类型的信息尤其需要核查：

- **数据与数字**：如库存数量、价格折扣比例等关键数值（例如某车型在 Edmunds 上有 100 余台在售，或有人在 Reddit 上声称砍价 23%）
- **来源网站的具体内容**：AI 所引用的第三方平台（如 Edmunds、Reddit）的原文表述
- **影响决策的重要细节**：任何可能对最终判断产生实质性影响的事实性陈述

---

## 核查结果的参考意义

在以购车决策为场景的实测中，研究者在完整走完调研流程后，**未发现 AI 的输出存在明显差错**。但作者仍然强调，核查这一步骤是必须执行的，不可因为工具表现良好就省略。这体现了 AI Manager 职责的常态化要求：**核查是流程规范，而非仅在怀疑时才触发的纠错行为**。

---

## 相关概念

- [[Deep Research]]
- [[OpenAI Deep Research]]
- [[人机协作]]
- [[认知炼金]]
- [[数据挖掘]]

---

## 来源

## 置信度概览

- 使用 Deep Research 等 AI 调研工具时，用户应对重要结论点进原始链接核查，Deep Research 会自动高亮相关语句以简化这一步骤。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 在人机协作调研流程中，人类扮演「AI Manager」角色：负责设定调研方向、判断信息质量、提炼决策 insight，而非亲自执行信息搜集。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-cee50fc0933c -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai-manager-核查职责.md
- 处理动作：Deep Research
- 对象：在人机协作调研流程中，人类扮演「AI Manager」角色：负责设定调研方向、判断信息质量、提炼决策 insight，而非亲自执行信息搜集。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai-manager-核查职责.md Low-confidence claim: 在人机协作调研流程中，人类扮演「AI Manager」角色：负责设定调研方向、判断信息质量、提炼决策 insight，而非亲自执行信息搜集。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“在人机协作调研流程中，人类扮演「AI Manager」角色：负责设定调研方向、判断信息质量、提炼决策 insight，而非亲自执行信息搜集。”是否仍然成立。

<!-- deep-research:deep-research-check-8d7aaa8243eb -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai-manager-核查职责.md
- 处理动作：Deep Research
- 对象：使用 Deep Research 等 AI 调研工具时，用户应对重要结论点进原始链接核查，Deep Research 会自动高亮相关语句以简化这一步骤。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai-manager-核查职责.md Low-confidence claim: 使用 Deep Research 等 AI 调研工具时，用户应对重要结论点进原始链接核查，Deep Research 会自动高亮相关语句以简化这一步骤。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“使用 Deep Research 等 AI 调研工具时，用户应对重要结论点进原始链接核查，Deep Research 会自动高亮相关语句以简化这一步骤。”是否仍然成立。
