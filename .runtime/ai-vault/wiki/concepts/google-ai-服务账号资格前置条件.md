---
orphaned: true
title: Google AI 服务账号资格前置条件
summary: 使用 Antigravity 等 Google AI 工具前，需确认账号类型、订阅套餐、年龄状态均满足要求，Workspace/学校/公司托管账号因组织策略限制往往无法直接使用。
sources: null
createdAt: "2026-04-19T17:21:54.290Z"
updatedAt: "2026-04-19T17:21:54.290Z"
tags:
  - Google AI
  - 账号资格
  - 套餐识别
  - Workspace限制
aliases:
  - google-ai-服务账号资格前置条件
  - GA服
  - Google AI 服务账号资格前置条件
  - Google AI
  - 账号资格限制
---

# Google AI 服务账号资格前置条件

## 概述

在使用 [[Antigravity]] 等 Google AI 相关服务之前，账号需要满足若干前置条件，才能顺利通过资格验证。若条件不满足，常见错误提示包括 `Your current account is not eligible for Antigravity` 或 `Account not eligible`。此类问题大多不是单点故障，而是**账号类型、套餐识别、年龄状态、地区归属**四类因素交叉导致的。

---

## 一、账号类型要求

### 优先使用个人 Google 账号

建议优先使用**个人 Google 账号**进行测试与登录，避免直接使用以下类型账号作为首选：

- **Google Workspace 账号**（企业账号）
- **学校托管账号**
- **公司托管账号**

这类组织账号往往附带**组织策略、年龄管控或地区限制**。即便该账号已开通某个 Google AI 套餐，组织策略也可能将服务访问权限屏蔽，导致资格验证失败。

---

## 二、套餐识别要求

### 确认是否为受支持的订阅套餐

[[Antigravity]] 当前主要面向 **Google AI Pro** 和 **Google AI Ultra** 用户。付费成功并不等同于桌面端识别成功，两者是独立的状态。

> Google AI Developers Forum 在 2025 年 12 月已有"付费成功但 Antigravity 仍识别成受限状态"的用户反馈。

### 自查方法

用同一账号访问 `https://gemini.google.com/`：

- 若 Gemini 页面**无法打开、无限转圈或无法进入聊天界面**，问题大概率不在客户端本身
- 若 Gemini **能正常进入**，且右上角可见会员识别状态，则可继续排查其他条件

---

## 三、年龄状态要求

根据 Gemini Apps Help，Google AI 计划在不同地区的年龄门槛**并非统一标准**。大多数国家并非一刀切的 `18+`，但在部分地区和特定能力上，确实存在更高的年龄要求。

### 建议检查项

| 检查项 | 说明 |
|---|---|
| 账号监督状态 | 确认账号未被标记为**受监督账号** |
| 付款资料状态 | 确认付款资料和账号状态无异常 |
| 年龄验证完成情况 | 若曾被要求年龄验证，须先完成验证流程 |

---

## 四、账号归属国家 / 地区要求

### 三者一致原则

若以下三项**差异过大**，资格识别容易出现问题：

1. **账号归属地**（Google 账号注册所在地区）
2. **付款资料所在地**
3. **当前网络出口地区**

### 查看账号归属国家 / 地区的方法

1. 打开任意 Google 页面，点击右上角头像
2. 在弹出层进入"服务条款"
3. 查看页面顶部显示的账号归属国家 / 地区

### 申请变更归属地区

如当前归属国家与目标使用地区不符，可通过 Google 官方表单申请调整：

```
https://policies.google.com/country-association-form
```

**注意事项：**

- 提交申请时的**网络出口地区**应与目标国家保持一致，否则容易被拒
- 表单提交成功**不代表立即生效**，通常需要等待人工审核

---

## 五、网络环境要求

网络环境是资格识别中**最容易被忽视**的前置条件，尤其对于依赖代理访问 Google 服务的用户。

### 基本要求

- 登录过程中**不要频繁切换 IP**
- **浏览器与桌面端**尽量走同一条代理出口
- 尽量避免使用**公共 VPN、多人共享出口、明显机房 IP**
- 长期使用时，优先选择风控更低、更稳定的出口方案

### 出口不一致的典型问题

若浏览器与桌面端走了不同的网络路径，常见表现为：

- 浏览器页面显示认证成功（`You have successfully authenticated`）
- 切回 Antigravity 仍停留在登录页
- 开发者工具中可见 `oauth-success` 相关报错

**推荐解决方案：** 将代理客户端切换至 **TUN 模式**，以统一浏览器、桌面端、CLI 和系统请求的网络出口。

---

## 六、资格前置条件核查清单

在进一步排查客户端问题之前，建议先逐项确认以下内容：

- [ ] 使用的是**个人 Google 账号**，而非组织托管账号
- [ ] 账号已订阅 **Google AI Pro 或 Ultra** 套餐
- [ ] 在 `gemini.google.com` 可正常登录并看到会员状态
- [ ] 账号**未被标记为受监督账号**
- [ ] 账号**年龄验证已完成**（如被要求）
- [ ] 账号归属地、付款地、网络出口**三者基本一致**
- [ ] 登录过程中 IP **未频繁变动**
- [ ] 浏览器与桌面端**走同一代理出口**

---

## 相关页面

- [[Antigravity]]
- [[Gemini]]
- [[Google AI Pro]]
- [[OAuth 登录排查]]
- [[TUN 模式代理配置]]

---

## 来源

## 置信度概览

- Antigravity 当前主要面向 Google AI Pro / Ultra 用户，优先使用个人 Google 账号测试，Workspace、学校或公司托管账号因组织策略可能被拦截。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 可先用同一账号登录 https://gemini.google.com/ 验证套餐识别状态：若 Gemini 本身无法正常进入，问题大概率不在 Antigravity 客户端。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 部分地区和具体能力对账号年龄有更高要求，需确认账号未被标记为受监督账号、付款资料正常，并在被要求时完成年龄验证。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-9f9c50f11231 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/google-ai-服务账号资格前置条件.md
- 处理动作：Deep Research
- 对象：部分地区和具体能力对账号年龄有更高要求，需确认账号未被标记为受监督账号、付款资料正常，并在被要求时完成年龄验证。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\google-ai-服务账号资格前置条件.md Low-confidence claim: 部分地区和具体能力对账号年龄有更高要求，需确认账号未被标记为受监督账号、付款资料正常，并在被要求时完成年龄验证。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“部分地区和具体能力对账号年龄有更高要求，需确认账号未被标记为受监督账号、付款资料正常，并在被要求时完成年龄验证。”是否仍然成立。

<!-- deep-research:deep-research-check-30cbd6f653f0 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/google-ai-服务账号资格前置条件.md
- 处理动作：Deep Research
- 对象：可先用同一账号登录 https://gemini.google.com/ 验证套餐识别状态：若 Gemini 本身无法正常进入，问题大概率不在 Antigravity 客户端。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\google-ai-服务账号资格前置条件.md Low-confidence claim: 可先用同一账号登录 https://gemini.google.com/ 验证套餐识别状态：若 Gemini 本身无法正常进入，问题大概率不在 Antigravity 客户端。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“可先用同一账号登录 https://gemini.google.com/ 验证套餐识别状态：若 Gemini 本身无法正常进入，问题大概率不在 Antigravity 客户端。”是否仍然成立。

<!-- deep-research:deep-research-check-03980b46ee05 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/google-ai-服务账号资格前置条件.md
- 处理动作：Deep Research
- 对象：Antigravity 当前主要面向 Google AI Pro / Ultra 用户，优先使用个人 Google 账号测试，Workspace、学校或公司托管账号因组织策略可能被拦截。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\google-ai-服务账号资格前置条件.md Low-confidence claim: Antigravity 当前主要面向 Google AI Pro / Ultra 用户，优先使用个人 Google 账号测试，Workspace、学校或公司托管账号因组织策略可能被拦截。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Antigravity 当前主要面向 Google AI Pro / Ultra 用户，优先使用个人 Google 账号测试，Workspace、学校或公司托管账号因组织策略可能被拦截。”是否仍然成立。
