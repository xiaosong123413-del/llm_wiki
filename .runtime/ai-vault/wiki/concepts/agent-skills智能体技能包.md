---
orphaned: true
title: Agent Skills（智能体技能包）
summary: 以文件形式安装到 AI Agent 工作目录的预定义技能集合，使 Agent 能够调用特定工具完成剪藏、读取、批量处理等任务。
sources:
  - inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md
createdAt: "2026-04-16T15:53:12.605Z"
updatedAt: "2026-04-16T15:53:12.605Z"
tags:
  - AI Agent
  - 技能扩展
  - Claude Code
  - 工具链
aliases:
  - agent-skills智能体技能包
  - Agent Skills（智能体技能包）
  - SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件
  - Agent Skills
  - Agent技能包
  - 智能体技能
---

```markdown
---
title: Agent Skills（智能体技能包）
summary: 一种可安装到 AI Agent 工作目录的技能文件集合，使 Agent 能够通过预定义指令调用外部工具或服务，实现自动化任务执行。
tags:
  - AI Agent
  - MCP
  - 自动化
  - SmartClip
  - 工作流
aliases:
  - Agent技能包
  - 智能体技能
---

# Agent Skills（智能体技能包）

Agent Skills 是一组可安装到 AI Agent 工作目录的技能文件，允许 Agent 通过预定义的斜杠指令（slash command）调用外部工具或服务，从而在对话中直接触发自动化操作。以 SmartClip 为例，其提供的 `smartclip-agent-extension` 技能包可让 Agent 完成网页剪藏、内容读取等任务，无需用户手动介入。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 安装方式

技能包通过 npm 全局安装后，在终端执行交互式向导完成部署。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

```bash
npm install -g smartclip-agent-extension
smartclip-agent-extension
```

安装时需选择两个维度：

- 安装范围：全局安装（推荐，写入用户主目录）或项目安装（写入当前工作目录）
- 目标目录：支持 `.agents/skills`（通用标准）、`.claude/skills`（Claude Code）、`.gemini/skills`（Gemini CLI）

也支持非交互的命令行参数模式，例如 `--global --default` 或 `--project --all`。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

### 安装路径参考

| 平台 | 全局路径 |
|------|---------|
| Mac/Linux | `~/.agents/skills`、`~/.claude/skills`、`~/.gemini/skills` |
| Windows | `%USERPROFILE%\.agents\skills`、`%USERPROFILE%\.claude\skills`、`%USERPROFILE%\.gemini\skills` |

项目安装则写入当前目录下对应的子路径。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## SmartClip 技能包内容

以 `smartclip-agent-extension` 为例，安装完成后技能目录中会出现以下四个技能：^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

- `smartclip-read` — 抓取指定网页内容，注入当前 Agent 上下文
- `smartclip-save` — 抓取网页内容并保存到笔记库（如 Obsidian、Notion 等）
- `smartclip-daily` — 批量处理任务池内容，配合 NotionMpClipper 或 ObClipper 使用
- `smartclip-troubleshooting` — 辅助排查 MCP 连接配置问题

## 与 MCP 的关系

Agent Skills 的运行依赖 [[MCP]]（Model Context Protocol）服务。以 SmartClip 为例，需先在插件设置中开启 MCP 服务并获取 Token，再将其写入 Agent 的 MCP 配置文件，技能包才能与浏览器插件建立通信。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

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

注意：`smartclip-mcp` 绑定 `18365` 端口，且仅支持一对一连接，同一时间只能有一个 Agent 客户端接入。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 验证可用性

在支持的 Agent 客户端（如 Claude Code）中，可通过以下指令验证：^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

- `/mcp` — 检查 MCP 连接状态
- `/skills` — 列出当前可用技能
- `/smartclip-read <url>` — 测试网页内容抓取
- `/smartclip-save <url>` — 测试网页剪藏保存

## 适用客户端

技能包的配置方式适用于多种主流 AI Agent 客户端，包括 Claude Code、OpenCode、Gemini CLI、Cursor 等。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 相关概念

- [[MCP]]
- [[SmartClip]]
- [[Agent集成工作流]]
- [[321 备份原则]]

## 来源

- inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md
```
