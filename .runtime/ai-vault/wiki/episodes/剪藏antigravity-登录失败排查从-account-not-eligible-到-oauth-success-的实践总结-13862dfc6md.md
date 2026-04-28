---
title: Antigravity 登录失败排查：从 Account not eligible 到 oauth-success 的实践总结
summary: 将 Antigravity 登录失败按症状拆分为账号资格不符、浏览器回调异常、网络出口不一致三大类，分别对应不同排查路径。
sourceFile: 剪藏__Antigravity 登录失败排查：从 Account not eligible 到 oauth-success 的实践总结 1__3862dfc6.md
sourceChannel: 剪藏
observedAt: "2026-04-19T17:20:38.593Z"
tags:
  - 情景记忆
---
# Antigravity 登录失败排查：从 Account not eligible 到 oauth-success 的实践总结
## 来源
- 渠道：剪藏
- 文件：剪藏__Antigravity 登录失败排查：从 Account not eligible 到 oauth-success 的实践总结 1__3862dfc6.md
- 链接：https://www.cnblogs.com/yuntier/p/19872206
- 时间：2026-04-19T17:20:38.593Z
## 本篇观察摘要
将 Antigravity 登录失败按症状拆分为账号资格不符、浏览器回调异常、网络出口不一致三大类，分别对应不同排查路径。
## 候选 Claims
- Antigravity 登录失败通常不是单点故障，而是账号资格、浏览器回调链路、代理出口一致性三类问题交叉导致的。（active / confidence 0.55）
- 报错 'Account not eligible' 更可能源于账号类型、套餐、年龄状态或地区归属不满足，而非客户端本身问题。（active / confidence 0.55）
- 浏览器显示认证成功但 IDE 停在登录页、控制台出现 oauth-success 报错，通常是浏览器与桌面端走了不同网络出口导致回调状态无法同步。（active / confidence 0.54）
- 可通过 Google 服务条款页面顶部查看账号归属国家/地区，账号归属地、付款资料与当前网络出口三者差距过大时，AI 套餐资格识别容易出现异常。（active / confidence 0.55）
- 可通过 https://policies.google.com/country-association-form 申请调整账号归属国家，提交时网络出口需与目标国家一致，且需等待人工审核，不会即时生效。（active / confidence 0.55）
- 付费成功与桌面端识别成功并非同一件事，Google AI Developers Forum 在 2025 年 12 月已出现过付费成功但 Antigravity 仍识别为受限状态的反馈。（stale / confidence 0.22）
- 许多桌面应用不继承浏览器代理或终端代理设置，导致浏览器走代理完成 OAuth 认证后，桌面端进程仍直连，造成回调状态不同步。（active / confidence 0.55）
- 将代理客户端切换至 TUN 模式可接管系统全流量，使浏览器、桌面端、CLI 等所有进程统一走同一条出口，是解决 OAuth 回调不一致问题的推荐方案。（active / confidence 0.55）
- 登录过程中应避免频繁切换 IP、避免使用公共 VPN 或多人共享出口、避免明显机房 IP，以降低账号风控触发概率。（active / confidence 0.55）
- 将系统默认浏览器切换为官方原版 Google Chrome 后重新走登录流程，是解决浏览器认证成功但桌面端报 'Unexpected issue setting up your account' 的高频 workaround。（active / confidence 0.55）
- 处理 OAuth 回调异常的推荐步骤：安装官方原版 Chrome → 设为系统默认浏览器 → 彻底退出桌面应用 → 重新打开并走一遍 Sign in 流程。（active / confidence 0.55）
- Antigravity 当前主要面向 Google AI Pro / Ultra 用户，优先使用个人 Google 账号测试，Workspace、学校或公司托管账号因组织策略可能被拦截。（active / confidence 0.55）
- 可先用同一账号登录 https://gemini.google.com/ 验证套餐识别状态：若 Gemini 本身无法正常进入，问题大概率不在 Antigravity 客户端。（active / confidence 0.55）
- 部分地区和具体能力对账号年龄有更高要求，需确认账号未被标记为受监督账号、付款资料正常，并在被要求时完成年龄验证。（active / confidence 0.55）
## 与已有 Semantic Memory 的关系
- 涉及概念：[[antigravity-登录失败症状分类]]、[[google-账号归属国家与资格识别]]、[[代理出口一致性问题]]、[[oauth-桌面端回调机制]]、[[google-ai-服务账号资格前置条件]]
## 是否触发新 Procedure
- 暂未触发新的程序记忆