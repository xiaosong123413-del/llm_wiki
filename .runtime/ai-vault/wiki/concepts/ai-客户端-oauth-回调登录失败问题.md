---
orphaned: true
title: AI 客户端 OAuth 回调登录失败问题
summary: 部分 AI 桌面客户端在通过浏览器完成 Google OAuth 授权后，因本地验证流量未走代理，导致 Token 无法回传至客户端，造成登录「假死」的典型故障模式。
sources: null
createdAt: "2026-04-19T17:23:03.443Z"
updatedAt: "2026-04-19T17:23:03.443Z"
tags:
  - AI工具
  - 登录问题
  - OAuth
  - 网络代理
aliases:
  - ai-客户端-oauth-回调登录失败问题
  - A客O回
  - AI 客户端 OAuth 回调登录失败问题
  - AI
  - OAuth 登录排查
  - OAuth 授权流程
---

# AI 客户端 OAuth 回调登录失败问题

## 概述

部分用户在使用 AI 客户端（如 Google Antigravity 配合 [[Gemini 3]]）时，会遭遇 **OAuth 授权回调登录失败**的问题。具体表现为：点击客户端内的"登录"按钮后，浏览器成功弹出 Google 授权页面，用户完成授权确认，浏览器端显示授权成功，但客户端本身却无法接收到 Token，陷入"假死"或无响应状态，停留在初始界面。

---

## 问题复现

| 维度 | 说明 |
|------|------|
| **影响平台** | Windows、macOS |
| **触发现象** | 浏览器授权成功，客户端无响应或持续转圈 |
| **根本原因推测** | 客户端的本地验证流量未正确经过代理，或关键进程被直连规则绕过 |

> 注意：若授权跳转后弹出红色错误提示（而非卡死），则属于[[账号资格限制]]问题，与 OAuth 回调流量无关，需参考下文"账号条件不符"部分。

---

## 原因分析

OAuth 登录流程通常依赖客户端在本地监听一个回调端口，待浏览器授权完成后，认证服务器将 Token 重定向至该端口完成交换。当客户端所在的网络环境使用了代理工具，但代理规则仅覆盖浏览器流量（即 System Proxy 模式），客户端进程本身的回调流量可能被直连规则绕过，导致 Token 无法正常送达客户端。

---

## 解决方案：OAuth 回调卡死 / 无响应

### 方案一：开启 TUN 模式（最推荐）

**适用场景**：所有平台，成功率最高。

System Proxy 模式仅代理部分应用的流量，AI 客户端作为独立进程，其验证请求可能无法被系统代理捕获。开启 **TUN 模式**（虚拟网卡模式）可在网络层面接管所有进程的流量，从根本上解决回调被绕过的问题。

**操作步骤**：
1. 打开你使用的代理工具（如 Clash Verge、Mihomo、V2rayN 等）。
2. 找到 **TUN 模式** 或 **虚拟网卡模式** 选项并启用。
3. 重启 AI 客户端，重新尝试登录。

> 推荐核心：**Mihomo 内核 + TUN 模式开启**，配合 System Proxy，实测为最稳配置。

---

### 方案二：使用 Proxifier 强制代理

**适用场景**：不希望开启全局 TUN 模式，或 TUN 模式仍然无效的 Windows / macOS 高级用户。

[[Proxifier]] 可以按进程名称强制指定特定应用走代理，精准覆盖客户端的回调流量。

**操作步骤**：
1. 安装 Proxifier。
2. 配置**代理服务器（Proxy Server）**：填写本地代理端口，通常为 `127.0.0.1:7890`（具体端口以代理工具设置为准）。
3. 配置**代理规则（Proxification Rules）**：
   - 新建一条规则。
   - **Applications（应用程序）**：选择客户端可执行文件（如 `Antigravity.exe` 或 `Antigravity.app`）。
   - **Target Hosts（目标主机）**：可设为通配符 `*`。
   - **Action**：选择上述配置的代理服务器。
4. 保存规则后重启客户端登录。

---

### 方案三：macOS 多进程代理覆盖

**适用场景**：macOS 用户开启 TUN 后仍无法完成登录。

macOS 平台上，AI 客户端往往由多个后台辅助进程共同完成 OAuth 验证流程。若代理规则仅覆盖主程序，其他进程的回调流量仍会走直连，导致失败。

根据社区抓包结论，需要确保以下**所有进程**均能走代理：

| 进程名 | 说明 |
|--------|------|
| `Antigravity.app` | 主程序 |
| `Antigravity Helper` | 后台辅助进程 |
| `language_server_macos_x64` | 语言服务进程 |

若使用 **Surge** 或其他支持进程名 / Bundle ID 分流的工具，需将以下 Bundle ID 加入代理规则：

- `com.google.antigravity`
- `com.google.antigravity.helper`

---

## 账号条件不符引发的登录错误

若 OAuth 回调正常，但登录后弹出红色错误提示，则属于账号资格问题，与代理配置无关。

### 错误一："Not Eligible"（资格不符）

**提示内容**：
> *"Your current account is not eligible for Antigravity. Try signing in with another personal Google account."*

**原因**：客户端目前处于灰度测试阶段，Google 对账户有"资历"要求，新注册账户大概率被屏蔽。

**解决方案**：
- **最快方案**：将账号升级为 [[Gemini Pro]] 会员。
- **换用老账号**：建议使用注册时间在 **2020 年之前**的个人 Google 账户，成功率更高。
- 避免使用为体验该软件特意新注册的 Gmail 账号。

---

### 错误二：地区限制（Region Restricted）

**原因**：即使代理节点正确，Google 账户本身的"归属地（Country Association）"可能被判定在不支持的区域。

**解决方案**：

1. 访问 Google 官方地区关联申诉表单：
   `https://policies.google.com/country-association-form`
2. 将账户归属地修改为支持该服务的地区（如 US 或 SG）。
3. **耐心等待审核**：修改不会即时生效，审核通过后 Google 会发送邮件通知。
4. 收到邮件后，清除浏览器缓存及客户端缓存，再重新尝试登录。

**⚠️ 注意事项**：
- 不要频繁切换地区，易触发风控。
- 建议选择与常用代理节点一致的地区，保持"人号合一"。

---

## 推荐黄金配置

经多轮实测，以下配置综合成功率最高：

| 项目 | 推荐配置 |
|------|----------|
| **操作系统** | macOS / Windows 均可 |
| **代理内核** | Mihomo |
| **代理模式** | TUN 模式 + System Proxy 同时开启 |
| **节点地区** | 新加坡（SG）节点 |
| **账号类型** | 2020 年前注册的老号，或已升级 Gemini Pro 会员 |

---

## 相关页面

- [[Gemini 3]]
- [[TUN 模式]]
- [[Proxifier]]
- [[Gemini Pro]]
- [[OAuth 授权流程]]
- [[账号资格限制]]

---

## 来源

## 置信度概览

- AI 桌面客户端 OAuth 登录假死的核心原因是：客户端本地验证回调流量没有正确走代理，被系统直连规则绕过，导致浏览器侧授权成功但客户端无法接收 Token。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 针对 AI 客户端 OAuth 回调登录失败，开启代理软件的 TUN 模式是成功率最高、操作最简单的解决方案。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- macOS 上的 AI 客户端通常包含主进程和多个辅助进程（Helper、language_server 等），若 TUN 模式仍无效，需确保所有相关进程及其 Bundle ID 均被代理规则覆盖。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-d92e573019d0 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai-客户端-oauth-回调登录失败问题.md
- 处理动作：Deep Research
- 对象：macOS 上的 AI 客户端通常包含主进程和多个辅助进程（Helper、language_server 等），若 TUN 模式仍无效，需确保所有相关进程及其 Bundle ID 均被代理规则覆盖。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai-客户端-oauth-回调登录失败问题.md Low-confidence claim: macOS 上的 AI 客户端通常包含主进程和多个辅助进程（Helper、language_server 等），若 TUN 模式仍无效，需确保所有相关进程及其 Bundle ID 均被代理规则覆盖。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“macOS 上的 AI 客户端通常包含主进程和多个辅助进程（Helper、language_server 等），若 TUN 模式仍无效，需确保所有相关进程及其 Bundle ID 均被代理规则覆盖。”是否仍然成立。

<!-- deep-research:deep-research-check-fbb1b1c4aea6 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai-客户端-oauth-回调登录失败问题.md
- 处理动作：Deep Research
- 对象：针对 AI 客户端 OAuth 回调登录失败，开启代理软件的 TUN 模式是成功率最高、操作最简单的解决方案。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai-客户端-oauth-回调登录失败问题.md Low-confidence claim: 针对 AI 客户端 OAuth 回调登录失败，开启代理软件的 TUN 模式是成功率最高、操作最简单的解决方案。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“针对 AI 客户端 OAuth 回调登录失败，开启代理软件的 TUN 模式是成功率最高、操作最简单的解决方案。”是否仍然成立。

<!-- deep-research:deep-research-check-b30a06ede416 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/ai-客户端-oauth-回调登录失败问题.md
- 处理动作：Deep Research
- 对象：AI 桌面客户端 OAuth 登录假死的核心原因是：客户端本地验证回调流量没有正确走代理，被系统直连规则绕过，导致浏览器侧授权成功但客户端无法接收 Token。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\ai-客户端-oauth-回调登录失败问题.md Low-confidence claim: AI 桌面客户端 OAuth 登录假死的核心原因是：客户端本地验证回调流量没有正确走代理，被系统直连规则绕过，导致浏览器侧授权成功但客户端无法接收 Token。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“AI 桌面客户端 OAuth 登录假死的核心原因是：客户端本地验证回调流量没有正确走代理，被系统直连规则绕过，导致浏览器侧授权成功但客户端无法接收 Token。”是否仍然成立。
