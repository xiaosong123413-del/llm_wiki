---
orphaned: true
title: TUN 模式（虚拟网卡模式）
summary: 代理软件中的一种全局流量接管模式，通过创建虚拟网卡捕获系统所有进程的网络请求，解决独立应用程序绕过系统代理的问题。
sources: null
createdAt: "2026-04-19T17:22:31.212Z"
updatedAt: "2026-04-19T17:22:31.212Z"
tags:
  - 网络代理
  - 科学上网
  - 工具配置
aliases:
  - tun-模式虚拟网卡模式
  - TUN 模式
  - TUN
  - TUN 模式代理配置
  - 代理与 TUN 模式
---

# TUN 模式（虚拟网卡模式）

## 概述

TUN 模式（又称"虚拟网卡模式"）是代理软件中的一种工作模式。与默认的系统代理（System Proxy）模式不同，TUN 模式通过在操作系统层面创建一块虚拟网络接口（虚拟网卡），将设备上**所有进程**产生的网络流量统一接管并转发至代理隧道，而不仅仅是浏览器流量。

---

## 背景与原理

### 系统代理的局限性

常见代理软件（如 [[Clash]]、[[Mihomo]]、[[V2RayN]] 等）在默认情况下启用的是**系统代理（System Proxy）**模式。该模式依赖操作系统的代理设置，只有主动识别并遵循系统代理配置的应用（如大多数浏览器）才会将流量送入代理通道。对于不读取系统代理设置的独立应用程序，其网络请求将直接发出，绕过代理。

### TUN 模式的工作方式

TUN 模式在操作系统的网络栈层面进行劫持，创建一张虚拟网卡设备，将系统路由表中的流量重定向至该虚拟网卡，再由代理软件负责转发。由于介入层级更低，无论目标应用程序是否感知代理的存在，其流量都会被统一捕获。这使得 TUN 模式能够代理几乎任意进程发出的网络请求，包括那些没有代理支持的独立客户端程序。

---

## 适用场景

TUN 模式尤其适用于以下情况：

- **独立桌面应用的登录与鉴权**：部分应用（如 Google Antigravity）在完成 OAuth 授权跳转后，需要在本地进程之间传递 Token。这一过程产生的流量属于应用本身的网络请求，不会走系统代理，若未开启 TUN 模式则可能导致软件端无法接收 Token，出现授权成功但应用界面毫无响应（"假死"）的现象。
- **多进程应用的全量代理**：部分应用由多个后台辅助进程组成，系统代理只能覆盖主进程，TUN 模式则可将所有相关进程的流量一并捕获。
- **游戏客户端、命令行工具等不支持代理设置的程序**：这类程序无法通过系统代理走代理，只有 TUN 模式或类似工具（如 [[Proxifier]]）才能强制接管其流量。

---

## 开启方法

不同代理软件的 TUN 模式入口名称略有差异，但操作逻辑一致：在软件设置或主界面中找到 **"TUN 模式"** 或 **"虚拟网卡模式"** 开关并将其打开。常见软件的对应名称如下：

| 软件 | TUN 模式入口名称 |
|---|---|
| [[Clash Verge]] | TUN 模式 |
| [[Mihomo]] | TUN 模式 |
| [[Surge]]（macOS） | 增强模式 / TUN |
| [[V2RayN]] | TUN 模式 / 虚拟网卡 |

> 开启后通常需要重启代理软件或目标应用，才能使新模式生效。

---

## 与 Proxifier 的对比

对于不希望开启全局 TUN 模式的用户，[[Proxifier]] 是另一种替代方案。Proxifier 通过在用户态拦截指定应用的网络调用，强制将其流量导向代理服务器，无需创建虚拟网卡。

| 对比维度 | TUN 模式 | Proxifier |
|---|---|---|
| 介入层级 | 操作系统网络栈（虚拟网卡） | 用户态（进程级拦截） |
| 覆盖范围 | 全设备所有进程 | 可指定特定应用程序 |
| 配置复杂度 | 低（一键开关） | 较高（需手动配置规则） |
| 适用人群 | 普通用户 | 高级用户 |
| 平台支持 | Windows / macOS | Windows / macOS |

---

## 注意事项

### macOS 多进程覆盖

在 macOS 上，部分应用由多个进程共同组成，仅代理主进程可能仍然不足。以 Google Antigravity 为例，根据社区实测，需确保以下进程均被代理规则覆盖：

- `Antigravity.app`（主程序）
- `Antigravity Helper`（辅助进程）
- `language_server_macos_x64`（语言服务）

对应的 Bundle ID 参考：
- `com.google.antigravity`
- `com.google.antigravity.helper`

使用支持进程名分流的软件（如 [[Surge]]）时，可将上述进程名或 Bundle ID 加入代理规则以确保全量覆盖。

### 推荐配置组合

社区实测中，以下配置组合被认为是稳定性最高的方案：

- **代理内核**：[[Mihomo]]
- **模式**：开启 TUN 模式 + 系统代理（System Proxy）同时开启
- **节点**：优先选择新加坡节点（响应速度快，Google 服务支持好）

---

## 相关概念

- [[系统代理（System Proxy）]]
- [[Mihomo]]
- [[Clash Verge]]
- [[Proxifier]]
- [[Surge]]
- [[分流规则]]

---

## 来源

## 置信度概览

- TUN 模式（虚拟网卡模式）可将系统内所有进程的流量统一接管，解决独立应用程序无法被系统代理（System Proxy）捕获的问题。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- 默认的 System Proxy（系统代理）通常只代理浏览器流量，而桌面应用程序的验证请求可能被直连规则绕过，需开启 TUN 模式才能正确代理。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）
- Clash Verge、Mihomo、V2rayN 等主流代理客户端均支持 TUN 模式，通常在客户端设置中可一键开启。（confidence 0.55 / retention 1.00 / last confirmed 2026-04-19）

## 冲突 / 争议结论

- 暂无。

## 已替代历史结论

- 暂无。

## 来源

-

<!-- deep-research:deep-research-check-48b3e0e7b48a -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/tun-模式虚拟网卡模式.md
- 处理动作：Deep Research
- 对象：Clash Verge、Mihomo、V2rayN 等主流代理客户端均支持 TUN 模式，通常在客户端设置中可一键开启。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\tun-模式虚拟网卡模式.md Low-confidence claim: Clash Verge、Mihomo、V2rayN 等主流代理客户端均支持 TUN 模式，通常在客户端设置中可一键开启。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“Clash Verge、Mihomo、V2rayN 等主流代理客户端均支持 TUN 模式，通常在客户端设置中可一键开启。”是否仍然成立。

<!-- deep-research:deep-research-check-af2d2042ad35 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/tun-模式虚拟网卡模式.md
- 处理动作：Deep Research
- 对象：默认的 System Proxy（系统代理）通常只代理浏览器流量，而桌面应用程序的验证请求可能被直连规则绕过，需开启 TUN 模式才能正确代理。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\tun-模式虚拟网卡模式.md Low-confidence claim: 默认的 System Proxy（系统代理）通常只代理浏览器流量，而桌面应用程序的验证请求可能被直连规则绕过，需开启 TUN 模式才能正确代理。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“默认的 System Proxy（系统代理）通常只代理浏览器流量，而桌面应用程序的验证请求可能被直连规则绕过，需开启 TUN 模式才能正确代理。”是否仍然成立。

<!-- deep-research:deep-research-check-312dfb2e9216 -->
## Deep Research草案
- 问题类型：需要网络搜索补证的数据空白
- 页面：wiki/concepts/tun-模式虚拟网卡模式.md
- 处理动作：Deep Research
- 对象：TUN 模式（虚拟网卡模式）可将系统内所有进程的流量统一接管，解决独立应用程序无法被系统代理（System Proxy）捕获的问题。
- 触发依据：当前结论置信度只有 0.55，状态为 active，需要补充外部证据后再确认。
- 原始诊断：i info D:\Desktop\ai的仓库\wiki\concepts\tun-模式虚拟网卡模式.md Low-confidence claim: TUN 模式（虚拟网卡模式）可将系统内所有进程的流量统一接管，解决独立应用程序无法被系统代理（System Proxy）捕获的问题。 (confidence 0.55, status active)
- 建议写入：补齐外部来源后，再确认“TUN 模式（虚拟网卡模式）可将系统内所有进程的流量统一接管，解决独立应用程序无法被系统代理（System Proxy）捕获的问题。”是否仍然成立。
