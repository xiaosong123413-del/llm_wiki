---
orphaned: true
title: Antigravity 登录失败症状分类
summary: 将 Antigravity 登录失败按症状拆分为账号资格不符、浏览器回调异常、网络出口不一致三大类，分别对应不同排查路径。
sources: null
createdAt: "2026-04-19T17:21:41.106Z"
updatedAt: "2026-04-19T17:21:41.106Z"
tags:
  - AI工具
  - 登录排查
  - 故障诊断
  - Antigravity
aliases:
  - antigravity-登录失败症状分类
  - Antigravity 登录失败症状分类
  - Antigravity
  - Google Antigravity
  - Antigravity 登录问题排查
  - Google Antigravity 登录问题排查
---

# Antigravity 登录失败症状分类

## 概述

[[Antigravity]] 登录失败并不总是由单一原因引起。根据实践总结，此类问题大多是**账号资格、浏览器回调、代理出口一致性**三类问题交叉导致的，而非某个单点故障。准确识别症状类型，是高效排查的前提。

---

## 症状分类总览

根据用户在登录过程中实际看到的表现，可将 Antigravity 登录失败归纳为以下三大类：

| 症状表现 | 更可能的根因 |
|---|---|
| 报错 `Your current account is not eligible for Antigravity` | 账号类型、套餐、年龄状态或地区归属不满足 |
| 浏览器显示 `You have successfully authenticated`，但应用报 `Unexpected issue setting up your account` | 浏览器回调链路异常 |
| 浏览器登录完成，应用仍停在登录页，控制台出现 `oauth-success` | 浏览器与桌面端网络出口不一致 |

---

## 类型一：Account not eligible

### 症状描述

登录时直接出现提示：

```
Your current account is not eligible for Antigravity
```

### 常见根因

此类症状与**账号本身的资格**密切相关，通常由以下原因之一或组合导致：

1. **账号类型不符**：使用了 Workspace、学校或公司托管账号，而非个人 Google 账号。此类账号可能带有组织策略、年龄管控或地区限制，即便已开通 Google AI 套餐，组织策略也可能将 Antigravity 挡掉。
2. **套餐未被正确识别**：Antigravity 当前主要面向 Google AI Pro / Ultra 用户。付费成功与桌面端识别成功并不是同一件事——Google AI Developers Forum 在 2025 年 12 月已出现过"付费成功但 Antigravity 仍识别成受限状态"的反馈。
3. **年龄状态异常**：账号被标记为受监督账号，或付款资料存在异常，或此前被要求进行年龄验证但尚未完成。
4. **账号归属地与当前出口地区不一致**：如果账号归属地、付款资料、当前出口地区三者差距过大，资格识别容易出现问题。

### 自查方法

- 优先使用**个人 Google 账号**测试，暂不使用托管账号。
- 用同一账号登录 `https://gemini.google.com/`，确认 Gemini 页面能否正常进入；若 Gemini 本身无法打开，问题大概率不在客户端。
- 打开任意 Google 页面 → 点击右上角头像 → 进入"服务条款" → 查看页面顶部显示的账号归属国家/地区。

---

## 类型二：浏览器认证成功但应用报错

### 症状描述

- 浏览器页面已出现：`You have successfully authenticated`
- 回到 Antigravity 后弹出：`Unexpected issue setting up your account`

### 根因分析

这种情况通常**不是登录失败**，而是浏览器的成功结果没有被桌面端正确接住，属于**浏览器回调链路异常**。

### 处理思路

社区中复现率较高的 workaround 是：将系统默认浏览器切换为官方原版 Google Chrome，再重新走一次登录流程。推荐的处理顺序如下：

1. 安装官方原版 Google Chrome
2. 暂时将 Chrome 设为系统默认浏览器
3. 彻底退出 Antigravity
4. 重新打开应用，再走一遍 `Sign in`

---

## 类型三：出现 oauth-success / IDE 不回跳

### 症状描述

这是中文用户最常见、也最容易误判的一类，典型表现为：

- 浏览器页面显示认证成功
- 切回 Antigravity 后仍停在登录页
- 打开开发者工具，能看到 `oauth-success` 相关报错

### 根因分析

表面上看，浏览器已完成 Google 登录；实际上，浏览器和 Antigravity 桌面端可能并没有走同一条网络路径。**浏览器拿到了成功结果，但桌面端回调阶段走了另一条出口，或者干脆没走代理**，导致本地状态没有对上，最终卡在登录页。

这一问题的核心在于：许多桌面应用不会继承"浏览器代理"或"终端代理"设置，用户以为全局走了代理，实际上只有浏览器走了，桌面端进程仍在直连。

### 处理思路

首要操作是将代理客户端切换至 **[[TUN 模式]]**，或换用能真正接管系统全流量的模式，再重新测试一次。TUN 模式的价值不在于"更高级"，而在于能更容易地将浏览器、桌面端、CLI 和系统请求统一到同一条出口上。

此外，登录过程中还应注意：

- 不要频繁切换 IP
- 浏览器和桌面端尽量走同一条代理出口
- 尽量避免公共 VPN、多人共享出口、明显机房 IP

---

## 症状判断流程

```
登录失败
  ├─ 是否直接报 "not eligible"？
  │    └─ 是 → 排查账号类型、套餐识别、年龄状态、归属地区（类型一）
  │
  ├─ 浏览器显示认证成功，但应用报 "Unexpected issue"？
  │    └─ 是 → 排查浏览器回调链路，尝试切换默认浏览器为 Chrome（类型二）
  │
  └─ 浏览器成功但 IDE 不回跳 / 控制台出现 oauth-success？
       └─ 是 → 排查浏览器与桌面端出口一致性，尝试切换 TUN 模式（类型三）
```

---

## 相关页面

- [[Antigravity]]
- [[TUN 模式]]
- [[Google AI Pro]]
- [[代理出口一致性]]
- [[OAuth 回调链路]]

---

## 来源

## 置信度概览

- Antigravity 登录失败通常不是单点故障，而是账号资格、浏览器回调链路、代理出口一致性三类问题交叉导致的。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 报错 'Account not eligible' 更可能源于账号类型、套餐、年龄状态或地区归属不满足，而非客户端本身问题。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 浏览器显示认证成功但 IDE 停在登录页、控制台出现 oauth-success 报错，通常是浏览器与桌面端走了不同网络出口导致回调状态无法同步。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-5ff2f8c89f33 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/antigravity-登录失败症状分类.md
- 处理动作：Deep Research
- 对象：浏览器显示认证成功但 IDE 停在登录页、控制台出现 oauth-success 报错，通常是浏览器与桌面端走了不同网络出口导致回调状态无法同步。
- 触发依据：当前结论置信度只有 0.54，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\antigravity-登录失败症状分类.md Low-confidence claim: 浏览器显示认证成功但 IDE 停在登录页、控制台出现 oauth-success 报错，通常是浏览器与桌面端走了不同网络出口导致回调状态无法同步。 (confidence 0.54, status active)
- 建议写入：补齐外部来源后，再确认“浏览器显示认证成功但 IDE 停在登录页、控制台出现 oauth-success 报错，通常是浏览器与桌面端走了不同网络出口导致回调状态无法同步。”是否仍然成立。

<!-- deep-research:deep-research-check-94e6cb0ba581 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/antigravity-登录失败症状分类.md
- 处理动作：Deep Research
- 对象：报错 'Account not eligible' 更可能源于账号类型、套餐、年龄状态或地区归属不满足，而非客户端本身问题。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\antigravity-登录失败症状分类.md Low-confidence claim: 报错 'Account not eligible' 更可能源于账号类型、套餐、年龄状态或地区归属不满足，而非客户端本身问题。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“报错 'Account not eligible' 更可能源于账号类型、套餐、年龄状态或地区归属不满足，而非客户端本身问题。”是否仍然成立。

<!-- deep-research:deep-research-check-445a1e3bd34d -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/antigravity-登录失败症状分类.md
- 处理动作：Deep Research
- 对象：Antigravity 登录失败通常不是单点故障，而是账号资格、浏览器回调链路、代理出口一致性三类问题交叉导致的。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\antigravity-登录失败症状分类.md Low-confidence claim: Antigravity 登录失败通常不是单点故障，而是账号资格、浏览器回调链路、代理出口一致性三类问题交叉导致的。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Antigravity 登录失败通常不是单点故障，而是账号资格、浏览器回调链路、代理出口一致性三类问题交叉导致的。”是否仍然成立。
