---
orphaned: true
title: Obsidian iframe 视频嵌入
summary: 借助第三方插件 Convert URL to Preview (iframe)，在 Obsidian 笔记中将视频链接转换为内嵌预览，并可选择显示比例。
sources: null
createdAt: "2026-04-16T14:17:37.953Z"
updatedAt: "2026-04-16T14:17:37.953Z"
tags:
  - Obsidian
  - 笔记工具
  - 视频嵌入
  - 插件
aliases:
  - obsidian-iframe-视频嵌入
  - OI视
  - Obsidian iframe 视频嵌入
  - Obsidian iframe
---

# Obsidian iframe 视频嵌入

Obsidian iframe 视频嵌入是通过 iframe 标签将在线视频内容直接嵌入到 Obsidian 笔记中的功能。这一功能需要借助第三方插件 "Convert url to preview (iframe)" 来实现，能够将视频链接转换为可在笔记内直接播放的嵌入式视频窗口。

## 前置条件

使用 iframe 视频嵌入功能需要先安装第三方插件 "Convert url to preview (iframe)"。该插件是实现视频嵌入的核心工具，提供了将普通视频链接转换为 iframe 预览的能力。

## 操作步骤

### 基本嵌入流程

1. **获取视频链接**：登录需要嵌入视频的网站，复制目标视频的链接地址
2. **粘贴链接**：将复制的视频链接粘贴到 Obsidian 笔记的指定位置
3. **选择链接**：用光标全选刚粘贴的视频链接文本
4. **调用转换功能**：按下 `Ctrl+P` 召唤命令面板
5. **输入转换命令**：在命令面板中输入 `iframe`
6. **选择转换选项**：选择 "Convert url to preview (iframe): URL to Preview/Iframe"
7. **设置显示参数**：在弹出的设置界面中选择视频尺寸，Aspect Ratio 可以选择默认尺寸
8. **完成嵌入**：点击 OK 按钮，按回车键完成视频嵌入

### 尺寸调整

iframe 视频嵌入支持自定义显示尺寸。在转换过程中，可以通过 Aspect Ratio 选项调整视频窗口的宽高比例，以适应不同的笔记布局需求。

## 技术原理

iframe 视频嵌入本质上是将外部视频内容通过 HTML iframe 标签嵌入到 Obsidian 的 Markdown 渲染环境中。这种方式保持了视频的原始播放功能，同时将其整合到笔记的阅读流程中，实现了内容的无缝集成。

## 应用场景

iframe 视频嵌入特别适用于：
- 教学笔记中嵌入相关视频教程
- 项目文档中集成演示视频
- 研究笔记中引用参考视频资料
- 会议记录中嵌入录制内容

## 相关功能

除了视频嵌入，Obsidian 还支持其他多媒体内容的插入，包括图片拖拽、网址链接转换等功能，共同构成了完整的多媒体笔记体验。

## 来源
