---
orphaned: true
title: MCP（模型上下文协议）集成配置
summary: 通过 MCP（Model Context Protocol）将浏览器插件等工具暴露为 AI Agent 可调用的服务，需配置 token、端口和 npx 启动命令。
sources:
  - inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md
createdAt: "2026-04-16T15:53:12.838Z"
updatedAt: "2026-04-16T15:53:12.838Z"
tags:
  - AI Agent
  - MCP
  - 工具集成
  - 配置
aliases:
  - mcp模型上下文协议集成配置
  - MCP（模型上下文协议）集成配置
  - SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件
  - MCP
  - MCP集成
  - 模型上下文协议配置
  - MCP协议
---

```markdown
---
title: MCP（模型上下文协议）集成配置
summary: 以 SmartClip 为例，介绍如何为 AI Agent 配置 MCP 服务，实现自动化网页剪藏与笔记保存。
tags:
  - MCP
  - AI Agent
  - SmartClip
  - 自动化
  - 剪藏
aliases:
  - MCP集成
  - 模型上下文协议配置
---

# MCP（模型上下文协议）集成配置

MCP（Model Context Protocol，模型上下文协议）是一种让 AI Agent 与外部工具或服务进行标准化通信的协议。通过为 AI Agent 配置 MCP，可以将浏览器插件、笔记工具等外部能力直接接入 Agent 工作流，实现自动化操作。本页以 SmartClip 插件为例，记录完整的配置流程。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 适用场景

SmartClip 的 MCP 集成功能属于会员功能，适合需要让 AI Agent 自动抓取网页内容并保存至 Obsidian、Notion、思源笔记、flomo、飞书、Joplin 等笔记软件的用户。相比 WebFetch、Playwright、Firecrawl、jina 等通用网页抓取工具，SmartClip 专为剪藏场景设计，能够处理这些工具可能无法完整抓取的页面，且不按次数或 token 额外计费。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 配置步骤

### 一、开启 SmartClip MCP 服务

安装 SmartClip 插件（版本需 >= v0.1.2，推荐使用 v0.2.1 及以上），进入插件设置页 →【通用配置】→【开启 MCP 服务】，点击【复制 Token】，后续配置需要用到该 token。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

### 二、写入 MCP 配置文件

将复制的 token 填入 AI Agent 的 MCP 配置文件。以下配置适用于 Claude Code、OpenCode、Gemini CLI、Cursor 等工具：

```json
{
  "mcpServers": {
    "smartclip": {
      "command": "npx",
      "args": ["-y", "smartclip-mcp"],
      "env": {
        "SMARTCLIP_MCP_SESSION_TOKEN": "your-secret-token"
      }
    }
  }
}
```

> 注意：`smartclip-mcp` 会绑定 `18365` 端口，且仅支持一对一连接。若 Claude Code 已连接该 MCP，其他客户端（如 OpenClaw）将无法同时连接，需关闭其中一个。

^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

### 三、安装 SmartClip Skills

在终端全局安装扩展包：

```bash
npm install -g smartclip-agent-extension
```

切换到项目工作目录后，运行以下命令进入交互式安装引导：

```bash
smartclip-agent-extension
```

交互式安装会依次提示选择安装范围（全局 / 项目）和目标目录：

- Standard（`.agents/skills`）— 标准通用目录
- Claude Code（`.claude/skills`）
- Gemini CLI（`.gemini/skills`）

也可使用非交互模式直接指定参数，例如：

```bash
# 全局安装到默认目录
smartclip-agent-extension --global --default

# 项目安装到所有目录
smartclip-agent-extension --project --all

# 指定范围和目录
smartclip-agent-extension --global --targets .agents/skills,.claude/skills
```

安装完成后，各平台的路径如下：

| 平台 | 全局路径 | 项目路径 |
|---|---|---|
| Mac / Linux | `~/.agents/skills`、`~/.claude/skills`、`~/.gemini/skills` | 当前目录下对应子目录 |
| Windows | `%USERPROFILE%\.agents\skills` 等 | 当前目录下对应子目录 |

^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

### 四、验证可用性

配置完成后，在 Claude Code 中依次验证：

- 输入 `/mcp` 确认 MCP 连接状态
- 输入 `/skills` 确认技能是否已加载
- 输入 `/smartclip-read <URL>` 测试网页内容抓取
- 输入 `/smartclip-save <URL>` 测试剪藏并保存至笔记库

^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 可用技能（Skills）

安装完成后，技能目录中应出现以下四个技能：

| 技能名 | 功能说明 |
|---|---|
| `smartclip-read` | 抓取网页内容，注入当前 Agent 上下文 |
| `smartclip-save` | 抓取网页内容并保存至笔记库 |
| `smartclip-daily` | 批量处理任务池内容，配合 NotionMpClipper 或 ObClipper 使用 |
| `smartclip-troubleshooting` | 辅助排查 MCP 连接与配置问题 |

^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 常见问题

**Q：使用 Agent 剪藏会消耗较多 token 吗？**
会有一定消耗。若没有包月套餐，手动剪藏在成本上更划算。

**Q：连接失败如何处理？**
首次连接成功后若后续出现失败，重启客户端通常可以解决。也可运行 `/smartclip-troubleshooting` 辅助排查，或通过 `faq@smartclip.app` 反馈问题。

**Q：国产 AI 客户端（如 OpenClaw）如何配置？**
将配置教程链接提供给对应 AI，让其协助完成配置即可。

^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 相关概念

- [[Agent集成工作流]]
- [[SmartClip]]
- [[Obsidian]]
- [[文件管理]]

## 来源

- inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md
```
