---
orphaned: true
title: AI Agent 自动化网页剪藏
summary: 让 AI Agent 通过 MCP 协议调用浏览器剪藏插件，自动抓取网页内容并保存到指定笔记软件，替代手动剪藏操作。
sources:
  - inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md
createdAt: "2026-04-16T15:53:17.355Z"
updatedAt: "2026-04-16T15:53:17.355Z"
tags:
  - AI Agent
  - 网页剪藏
  - 自动化
  - 知识管理
aliases:
  - ai-agent-自动化网页剪藏
  - AA自
  - AI Agent 自动化网页剪藏
  - SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件
  - AI Agent
  - Agent剪藏
  - SmartClip MCP
---

```markdown
---
title: AI Agent 自动化网页剪藏
summary: 通过 SmartClip MCP 插件，让 AI Agent 自动完成网页内容的抓取与保存，替代手动剪藏流程。
tags:
  - AI Agent
  - 网页剪藏
  - MCP
  - SmartClip
  - 自动化
aliases:
  - Agent剪藏
  - SmartClip MCP
---

# AI Agent 自动化网页剪藏

AI Agent 自动化网页剪藏，是指通过将 [[SmartClip]] 插件接入 AI Agent 的 MCP（Model Context Protocol）服务，使 Agent 能够在无需人工干预的情况下，自动抓取指定网页内容并保存至笔记软件。这一方案由 SmartClip 插件的 MCP 服务与配套的 Agent Skills 共同实现。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 背景：现有网页抓取工具的局限

市面上常见的网页抓取工具包括 WebFetch、Playwright、Firecrawl、Scrapling、jina、Agent Reach 等。这些工具存在不同程度的问题：部分工具不支持某些网页，部分工具抓取数据不完整或含有干扰信息，还有部分工具按次数或 token 计费。SmartClip 专为剪藏场景设计，凡是浏览器中能手动剪藏的网页，均可通过该方案自动抓取，并直接保存至 Notion、Obsidian、思源笔记、flomo、飞书、Joplin 等笔记软件。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 适用的 AI Agent 客户端

该方案兼容 Claude Code、OpenCode、Gemini CLI、Cursor 等主流 AI Agent 工具。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

## 配置流程

### 一、开启 SmartClip MCP 服务

安装 SmartClip 插件（版本 >= v0.1.2，推荐 v0.2.1），进入插件设置页 →【通用配置】→【开启 MCP 服务】，并点击【复制 Token】备用。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

### 二、配置 MCP 连接

将复制的 token 填入 AI Agent 的 MCP 配置文件：

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

### 三、安装 SmartClip Skills

在终端执行全局安装：

```bash
npm install -g smartclip-agent-extension
smartclip-agent-extension
```

安装向导支持交互模式与非交互模式，可选择全局安装（推荐）或项目级安装，并可指定目标目录（`.agents/skills`、`.claude/skills`、`.gemini/skills`）。^[inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md]

安装完成后，技能目录中应出现以下四个 Skills：

| Skill | 功能 |
|---|---|
| `smartclip-read` | 抓取网页内容，注入当前 Agent 上下文 |
| `smartclip-save` | 抓取网页内容并保存至笔记库 |
| `smartclip-daily` | 批量处理任务池内容（配合 NotionMpClipper / ObClipper 使用） |
| `smartclip-troubleshooting` | 辅助排查配置与连接问题 |

### 四、验证可用性

在 Claude Code 中依次执行以下命令验证：

```
/mcp                                      # 验证 MCP 连接状态
/skills                                   # 验证 Skills 是否加载
/smartclip-read https://example.com       # 验证网页抓取
/smartclip-save https://example.com       # 验证剪藏保存
```

## 典型使用场景

- 单页抓取：通过 `smartclip-read` 将网页内容拉入 Agent 上下文，供后续分析、摘要、问答使用。
- 单页剪藏：通过 `smartclip-save` 将网页内容直接保存至 Obsidian 等笔记软件，替代手动操作。
- 批量剪藏：通过 `smartclip-daily` 处理任务池，适合移动端收藏后由 Agent 统一处理的工作流，后续计划扩展支持各类平台收藏夹。

## 注意事项与已知限制

- Agent 剪藏功能为会员功能（付费），基础剪藏功能免费。
- 当前处于 beta 阶段，可能存在连接不稳定的情况；遇到连接失败时，重启通常可解决问题。
- 每次调用会消耗 AI Agent 的 token，无包月套餐时成本相对较高，高频使用场景建议评估后再决定是否启用。
- MCP 服务为一对一连接，多个 Agent 客户端不能同时接入同一 SmartClip 实例。
- 问题反馈可发送至 `faq@smartclip.app`。

## 相关概念

- [[SmartClip]]
- [[MCP（Model Context Protocol）]]
- [[Agent集成工作流]]
- [[Obsidian]]
- [[网页剪藏]]

## 来源

- inbox（剪藏进来的）__notionmpclipper__SmartClip_系列教程之三_给你的_AI_Agent_也配上剪藏插件__4069a2f1.md
```
