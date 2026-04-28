---
orphaned: true
title: Web Clipper配置问题诊断
summary: Web Clipper工具在配置过程中常见的vault路径和笔记位置设置错误的诊断与解决方法
sources: null
createdAt: "2026-04-16T14:17:58.640Z"
updatedAt: "2026-04-16T14:17:58.640Z"
tags:
  - 工具配置
  - 问题诊断
  - Obsidian
aliases:
  - web-clipper配置问题诊断
  - Web Clipper配置问题诊断
  - Web Clipper
  - web clipper
  - 剪藏配置
  - vault not found
---

```markdown
---
title: Web Clipper配置问题诊断
summary: Obsidian Web Clipper 常见配置错误的原因分析与解决方法，涵盖保管库识别失败和笔记路径定位问题
tags:
  - obsidian
  - web-clipper
  - 剪藏
  - 配置
aliases:
  - web clipper
  - 剪藏配置
  - vault not found
---

# Web Clipper配置问题诊断

Obsidian Web Clipper 是一款用于将网页内容剪藏至 Obsidian 知识库的浏览器插件。配置过程中容易出现两类典型问题：保管库（vault）无法识别，以及剪藏内容无法落入预期目录。本页记录这两类问题的原因与解决方式。

## 功能边界说明

Web Clipper 目前只能剪藏网页内容，不支持剪藏视频。使用前需明确这一限制。

## 常见问题

### 问题一：`vault not found`

配置插件时，保管库（vault）字段填写错误会导致此报错。

原因：vault 即"保管箱"，该字段要求填写的是 Obsidian 知识库的名称，而非路径或其他标识符。填写时需与 Obsidian 中实际显示的库名完全一致。

解决方法：打开 Obsidian，确认左下角或库切换界面中显示的库名，将该名称原样填入 Web Clipper 的 vault 配置字段。

### 问题二：剪藏内容无法落入指定目录

剪藏后笔记出现在错误位置，或无法写入预期文件夹。

原因：笔记位置字段要求填写的是相对于知识库根目录的相对路径，而非绝对路径或文件夹名称片段。

解决方法：在笔记位置字段中填写从库根目录出发的完整相对路径，例如 `02_领域/obsidian/剪藏`，确保路径层级与库内实际目录结构一致。

## 配置参考流程

原始配置流程参考来源：https://zhuanlan.zhihu.com/p/2014269698569707638

## 相关概念

- [[Obsidian生产力系统]]
- [[Agent集成工作流]]

## 来源

```
