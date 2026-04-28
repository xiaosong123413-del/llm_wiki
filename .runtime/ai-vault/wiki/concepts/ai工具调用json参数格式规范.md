---
orphaned: true
title: AI工具调用JSON参数格式规范
summary: 在调用接受数组或对象参数的AI工具时，需使用JSON结构化格式传递参数，以确保工具正确解析输入。
sources:
  - 闪念日记__2026-04-20__5d790f0f.md
createdAt: "2026-04-19T17:24:50.942Z"
updatedAt: "2026-04-19T17:24:50.942Z"
tags:
  - AI工具
  - 参数格式
  - JSON
  - 工具调用
aliases:
  - ai工具调用json参数格式规范
  - AI工具调用JSON参数格式规范
  - AI
  - Function Calling
  - 大语言模型工具使用
---

# AI工具调用JSON参数格式规范

> 本页面介绍在 AI 系统中调用工具（Tool Calling）时所使用的 JSON 参数格式规范，适用于构建、维护和对接 AI 工具调用接口的开发者与知识库维护者。

---

## 概述

AI 工具调用（Tool Calling）是指 AI 模型在推理过程中，识别到需要借助外部工具完成任务时，生成结构化的调用指令，由执行层解析并调用对应工具的机制。JSON 格式因其结构清晰、语言无关、易于解析的特点，成为工具调用参数传递的主流格式。

规范统一的 JSON 参数格式有助于：
- 提升工具调用的可靠性与可维护性
- 降低不同 AI 系统与工具之间的集成成本
- 方便调试、日志记录与错误追溯

---

## 基本结构

一个标准的 AI 工具调用 JSON 消息通常包含以下顶层字段：

```json
{
  "tool_name": "工具名称",
  "parameters": {
    "参数名": "参数值"
  }
}
```

| 字段 | 类型 | 是否必填 | 说明 |
|------|------|----------|------|
| `tool_name` | string | 必填 | 要调用的工具唯一标识符 |
| `parameters` | object | 必填 | 传入工具的参数键值对 |

---

## 工具定义格式

在 AI 系统初始化或配置阶段，需要向模型声明可用工具的定义，通常采用如下格式：

```json
{
  "tools": [
    {
      "name": "search_web",
      "description": "搜索互联网上的信息",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "搜索关键词"
          },
          "max_results": {
            "type": "integer",
            "description": "最大返回结果数",
            "default": 5
          }
        },
        "required": ["query"]
      }
    }
  ]
}
```

### 工具定义字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 工具唯一名称，建议使用小写字母与下划线 |
| `description` | string | 工具功能描述，供模型理解何时调用 |
| `parameters` | object | 遵循 JSON Schema 规范的参数定义 |
| `parameters.type` | string | 固定值 `"object"` |
| `parameters.properties` | object | 各参数的详细定义 |
| `parameters.required` | array | 必填参数名称列表 |

---

## 参数类型规范

工具参数的类型定义遵循 [[JSON Schema]] 标准，常用类型如下：

| 类型关键字 | 对应含义 | 示例值 |
|-----------|----------|--------|
| `string` | 字符串 | `"hello"` |
| `integer` | 整数 | `42` |
| `number` | 浮点数 | `3.14` |
| `boolean` | 布尔值 | `true` / `false` |
| `array` | 数组 | `["a", "b"]` |
| `object` | 嵌套对象 | `{"key": "value"}` |
| `null` | 空值 | `null` |

### 枚举类型

当参数值限定在特定范围内时，使用 `enum` 字段约束：

```json
{
  "format": {
    "type": "string",
    "enum": ["json", "markdown", "plain"],
    "description": "输出格式"
  }
}
```

---

## 调用请求格式

AI 模型生成工具调用请求时，输出格式示例如下（以 OpenAI Function Calling 风格为参考）：

```json
{
  "id": "call_abc123",
  "type": "function",
  "function": {
    "name": "search_web",
    "arguments": "{\"query\": \"AI工具调用规范\", \"max_results\": 3}"
  }
}
```

> ⚠️ **注意**：`arguments` 字段的值是一个 **JSON 字符串**（即经过序列化的字符串），而非直接嵌套的 JSON 对象。解析时需对其进行二次反序列化。

---

## 工具返回值格式

工具执行完毕后，应将结果以统一格式返回给 AI 模型：

```json
{
  "tool_call_id": "call_abc123",
  "role": "tool",
  "content": "工具执行结果的文本描述或结构化数据"
}
```

| 字段 | 说明 |
|------|------|
| `tool_call_id` | 与调用请求中的 `id` 字段对应，用于匹配调用与结果 |
| `role` | 固定为 `"tool"` |
| `content` | 工具返回内容，可为纯文本或 JSON 序列化字符串 |

---

## 常见规范要点

### 命名规范
- 工具名称（`name`）建议使用 **小写字母 + 下划线** 风格，如 `get_weather`、`send_email`
- 参数名称同样建议使用小写下划线，避免使用驼峰或连字符

### 必填与可选参数
- 将业务上必须提供的参数列入 `required` 数组
- 可选参数应在 `description` 中说明默认行为

### 参数描述的质量
- `description` 字段对模型正确理解并调用工具至关重要
- 应明确说明：参数的含义、格式要求、取值示例

### 错误处理
- 工具调用失败时，`content` 字段应包含结构化的错误信息，建议格式：

```json
{
  "error": true,
  "error_code": "TIMEOUT",
  "message": "请求超时，请稍后重试"
}
```

---

## 相关概念

- [[Function Calling]]
- [[JSON Schema]]
- [[大语言模型工具使用]]
- [[AI Agent 架构]]
- [[Prompt 工程]]

---

## 来源

- 闪念日记__2026-04-20__5d790f0f.md ^[闪念日记__2026-04-20__5d790f0f.md]

## 置信度概览

- 当工具参数类型为数组或对象时，调用方必须以合法JSON格式传入，不可使用纯文本或非结构化字符串。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 多个互不依赖的工具调用应在同一代码块中并行发出，以提升执行效率；存在依赖关系时则必须串行等待前一调用结果。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- AI在调用工具时不应猜测或编造可选参数的值；若必填参数缺失，应向用户确认而非自行填充。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

- ^[闪念日记__2026-04-20__5d790f0f.md]

<!-- deep-research:deep-research-check-d8a9dfff0627 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai工具调用json参数格式规范.md
- 处理动作：Deep Research
- 对象：AI在调用工具时不应猜测或编造可选参数的值；若必填参数缺失，应向用户确认而非自行填充。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai工具调用json参数格式规范.md Low-confidence claim: AI在调用工具时不应猜测或编造可选参数的值；若必填参数缺失，应向用户确认而非自行填充。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“AI在调用工具时不应猜测或编造可选参数的值；若必填参数缺失，应向用户确认而非自行填充。”是否仍然成立。

<!-- deep-research:deep-research-check-3ead557948a5 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai工具调用json参数格式规范.md
- 处理动作：Deep Research
- 对象：多个互不依赖的工具调用应在同一代码块中并行发出，以提升执行效率；存在依赖关系时则必须串行等待前一调用结果。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai工具调用json参数格式规范.md Low-confidence claim: 多个互不依赖的工具调用应在同一代码块中并行发出，以提升执行效率；存在依赖关系时则必须串行等待前一调用结果。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“多个互不依赖的工具调用应在同一代码块中并行发出，以提升执行效率；存在依赖关系时则必须串行等待前一调用结果。”是否仍然成立。

<!-- deep-research:deep-research-check-61bea2a317ff -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai工具调用json参数格式规范.md
- 处理动作：Deep Research
- 对象：当工具参数类型为数组或对象时，调用方必须以合法JSON格式传入，不可使用纯文本或非结构化字符串。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai工具调用json参数格式规范.md Low-confidence claim: 当工具参数类型为数组或对象时，调用方必须以合法JSON格式传入，不可使用纯文本或非结构化字符串。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“当工具参数类型为数组或对象时，调用方必须以合法JSON格式传入，不可使用纯文本或非结构化字符串。”是否仍然成立。
