---
orphaned: true
title: Proxifier 强制进程代理
summary: Proxifier 是一种可为指定应用程序强制绑定代理通道的工具，适用于不想开启全局 TUN 模式但需要让特定进程走代理的场景。
sources: null
createdAt: "2026-04-19T17:22:42.566Z"
updatedAt: "2026-04-19T17:22:42.566Z"
tags:
  - 网络代理
  - 工具配置
  - Windows
  - macOS
aliases:
  - proxifier-强制进程代理
  - Proxifier 强制进程代理
  - Proxifier
---

# Proxifier 强制进程代理

## 概述

Proxifier 是一款运行于 Windows 和 macOS 平台的网络代理工具，其核心能力在于**强制指定特定应用程序（进程）走代理通道**，而无需该应用程序本身支持代理设置。与开启 [[TUN 模式]] 的全局代理方案不同，Proxifier 允许用户以更精细的粒度控制哪些进程需要走代理、走哪个代理服务器。

---

## 适用场景

Proxifier 强制进程代理主要适用于以下情形：

- 代理软件默认只代理浏览器流量（System Proxy），而某个独立桌面应用的验证请求未能被系统代理捕获。
- 不希望或无法开启全局 [[TUN 模式]] 的用户，需要为单个应用单独配置代理。
- TUN 模式已开启但特定应用仍无法正常联网的进阶排查场景。

典型案例包括：部分应用（如 Google Antigravity）在进行本地 OAuth 验证时，其流量未被系统代理捕获，导致授权 Token 无法回传至客户端，软件陷入"假死"状态。使用 Proxifier 可将该应用的全部流量强制路由至代理服务器，从而解决问题。

---

## 工作原理

Proxifier 通过在操作系统网络层拦截指定进程的出站连接，将其重定向到配置好的代理服务器（如 SOCKS5 或 HTTP 代理）。这一机制使得即便目标程序本身不支持代理配置，其所有网络请求也会被强制经由代理转发，而其他未被规则命中的进程则不受影响。

---

## 配置步骤

### 第一步：安装 Proxifier

在 Windows 或 macOS 上下载并安装 Proxifier。

### 第二步：配置代理服务器（Proxy Server）

打开 Proxifier，进入代理服务器设置，填入本地代理软件的监听地址和端口。例如，若使用 Clash、Mihomo 等工具，默认本地端口通常为：

```
地址：127.0.0.1
端口：7890
```

具体端口号以实际使用的代理软件设置为准。

### 第三步：配置代理规则（Proxification Rules）

新建一条代理规则，各字段填写说明如下：

| 字段 | 说明 | 示例值 |
|---|---|---|
| **Target Hosts**（目标主机） | 需要代理的目标域名或 IP，可设为通配符以匹配所有目标 | `*`（通配符） |
| **Applications**（应用程序） | 指定需要被强制代理的进程名称 | `Antigravity.exe`（Windows）或 `Antigravity.app`（macOS） |
| **Action**（动作） | 选择流量处理方式 | 选择第二步中配置的 Proxy |

配置完成后保存规则，Proxifier 将在该进程启动时自动生效。

---

## macOS 多进程注意事项

在 macOS 上，部分应用由多个进程共同协作运行，仅代理主进程可能仍不够。以 Google Antigravity 为例，经社区用户抓包分析，需确保以下进程**全部**被代理规则覆盖：

| 进程 / Bundle ID | 说明 |
|---|---|
| `Antigravity.app` / `com.google.antigravity` | 主程序 |
| `Antigravity Helper` / `com.google.antigravity.helper` | 辅助进程 |
| `language_server_macos_x64` | 语言服务进程 |

在支持进程名分流的代理工具（如 Surge）中，可直接通过 Bundle ID 进行规则匹配，效果等同于在 Proxifier 中按进程名配置规则。

---

## 与 TUN 模式的比较

| 对比维度 | Proxifier 强制进程代理 | [[TUN 模式]] |
|---|---|---|
| **代理粒度** | 精细，仅指定进程走代理 | 全局，所有流量均经过虚拟网卡 |
| **配置复杂度** | 较高，需手动配置规则 | 低，开关即用 |
| **适用用户** | Windows/macOS 高级用户 | 普通用户 |
| **对系统影响** | 较小 | 较大（接管全局流量） |
| **推荐优先级** | 备选方案 | 首选方案（成功率最高） |

---

## 相关页面

- [[TUN 模式]]
- [[系统代理（System Proxy）]]
- [[Clash / Mihomo 配置]]
- [[OAuth 本地回调问题]]

---

## 来源

## 置信度概览

- Proxifier 可通过「代理规则（Proxification Rules）」为指定的可执行文件（如 Antigravity.exe）单独绑定代理服务器，实现精准的进程级代理，无需开启全局 TUN 模式。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 使用 Proxifier 的基本步骤为：①配置本地代理服务器地址（通常为 127.0.0.1:7890）；②新建规则，指定目标应用程序；③将 Action 设置为对应的代理服务器。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- Proxifier 主要面向 Windows/macOS 高级用户，适合在 TUN 模式不可用或不稳定时作为替代方案。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-3cc83a5311f8 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/proxifier-强制进程代理.md
- 处理动作：Deep Research
- 对象：Proxifier 主要面向 Windows/macOS 高级用户，适合在 TUN 模式不可用或不稳定时作为替代方案。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\proxifier-强制进程代理.md Low-confidence claim: Proxifier 主要面向 Windows/macOS 高级用户，适合在 TUN 模式不可用或不稳定时作为替代方案。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Proxifier 主要面向 Windows/macOS 高级用户，适合在 TUN 模式不可用或不稳定时作为替代方案。”是否仍然成立。

<!-- deep-research:deep-research-check-a981fd5a6877 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/proxifier-强制进程代理.md
- 处理动作：Deep Research
- 对象：使用 Proxifier 的基本步骤为：①配置本地代理服务器地址（通常为 127.0.0.1:7890）；②新建规则，指定目标应用程序；③将 Action 设置为对应的代理服务器。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\proxifier-强制进程代理.md Low-confidence claim: 使用 Proxifier 的基本步骤为：①配置本地代理服务器地址（通常为 127.0.0.1:7890）；②新建规则，指定目标应用程序；③将 Action 设置为对应的代理服务器。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“使用 Proxifier 的基本步骤为：①配置本地代理服务器地址（通常为 127.0.0.1:7890）；②新建规则，指定目标应用程序；③将 Action 设置为对应的代理服务器。”是否仍然成立。

<!-- deep-research:deep-research-check-56242db143c9 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/proxifier-强制进程代理.md
- 处理动作：Deep Research
- 对象：Proxifier 可通过「代理规则（Proxification Rules）」为指定的可执行文件（如 Antigravity.exe）单独绑定代理服务器，实现精准的进程级代理，无需开启全局 TUN 模式。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\proxifier-强制进程代理.md Low-confidence claim: Proxifier 可通过「代理规则（Proxification Rules）」为指定的可执行文件（如 Antigravity.exe）单独绑定代理服务器，实现精准的进程级代理，无需开启全局 TUN 模式。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Proxifier 可通过「代理规则（Proxification Rules）」为指定的可执行文件（如 Antigravity.exe）单独绑定代理服务器，实现精准的进程级代理，无需开启全局 TUN 模式。”是否仍然成立。
