# GBrain 中层逻辑迁移到 LLM Wiki — Design Spec

- **Date**: 2026-04-20
- **Target**: `web/client/` + `web/server/` + `scripts/` + `.llmwiki/`
- **Out of scope**: `gui/LlmWikiGui/`、整套 `gbrain` UI、`gbrain` 数据库引擎替换

## 1. Goal

在不改变 `LLM Wiki` 文件驱动主架构的前提下，吸收 `gbrain` 的中层逻辑能力，重点补齐五块：

1. 统一检索模式路由
2. 混合搜索打分与多查询扩展
3. 媒体源料富化流程
4. 确定性 lint / 系统检查规则引擎
5. 实体富化与远程 brain 镜像

本次改造的目标不是把 `LLM Wiki` 改造成另一个 `gbrain`，而是让当前的 `raw / sources_full / sources / wiki / .llmwiki` 体系获得更强的检索、检查、富化和远程访问能力。

## 2. Non-Goals

- 不把 `.md`/`.json` 主数据迁移到数据库
- 不引入 `PGLiteEngine` / `PostgresEngine` 作为新的主真相层
- 不移植 `gbrain` 的 UI、MCP server、skillpack、resolver
- 不把现有 compile 主流程替换为 git-first brain repo
- 不改动 WinForms 旧 GUI

## 3. Core Principle

### 3.1 文件驱动主架构保持不变

系统的唯一真实状态仍然在文件系统中：

- `raw/`
- `sources_full/`
- `sources/`
- `wiki/`
- `.llmwiki/*.json`

用户手动编辑 markdown、移动文件、查看目录结构，仍然是合法且优先的操作。

### 3.2 吸收数据库驱动 brain 的“派生层”

借鉴 `gbrain` 的地方不落在主真相层，而落在“可重建的派生层”：

- 搜索索引
- 向量索引
- 链接索引
- claims / episodes / procedures 索引
- lint / review 聚合结果
- 远程访问镜像

这些数据都可以删掉并从文件系统重新生成，因此它们是“索引层”，不是“主数据层”。

## 4. Target Architecture

三层结构：

1. **真相层**
   - 文件系统中的 raw、sources_full、wiki、project-log、状态文件
2. **派生索引层**
   - `.llmwiki/search-index.json`
   - `.llmwiki/link-index.json`
   - `.llmwiki/claims.json`
   - `.llmwiki/episodes.json`
   - `.llmwiki/procedures.json`
   - `.llmwiki/vector-index/*`
   - `.llmwiki/review-cache.json`
3. **服务逻辑层**
   - 检索
   - compile orchestration
   - lint / review aggregation
   - source-library
   - entity enrichment
   - remote brain sync

## 5. Search Stack

## 5.1 Search routing

统一检索入口，前端所有页面共用同一后端搜索管线。

决策顺序：

1. **Intent classifier**
   - entity
   - temporal
   - event
   - general
2. **Mode router**
   - direct get
   - keyword
   - hybrid
3. **Multi-query expansion**
4. **Keyword + vector parallel search**
5. **RRF fusion**
6. **Cosine re-score**
7. **Compiled truth boost**
8. **4-layer dedup**
9. **Result shaping**
   - snippet only
   - full page
   - source excerpt

## 5.2 Search layers

搜索结果按四层去重和排序：

1. `wiki/procedures/*`
2. `wiki/concepts/*`
3. `wiki/episodes/*`
4. `sources_full/*` 和 `raw/*`

原则：

- semantic / procedural 层优先回答
- raw / source 层优先召回
- 同一概念在多个层级命中时，只保留优先级最高的一层进入前台结果

## 5.3 Evaluation

引入可复现检索评估：

- `P@k`
- `Recall@k`
- `MRR`
- `nDCG@k`

通过 `queries.json + qrels` 形式维护评估集。每次改搜索参数前后都能跑 A/B 对比。

## 6. Media Source Enrichment

## 6.1 Scope

媒体源料包括：

- 网页剪藏
- 图片
- PDF
- 视频
- 日记中的图片/视频附件

## 6.2 Rules

每个媒体对象都应该具备以下至少一部分：

- 标题
- 来源 URL / 来源渠道
- 导入时间
- 文本内容或 OCR / transcript
- 摘要或 excerpt
- 引用到的实体
- 能回溯到原始文件和附件位置

## 6.3 Storage

真相层：

- `raw/剪藏`
- `raw/闪念日记`
- `sources_full/`
- `sources_full/附件副本（非Markdown）`

派生层：

- `.llmwiki/ocr/<id>.txt`
- `.llmwiki/transcripts/<id>.txt`
- `.llmwiki/source-media-index.json`
- `.llmwiki/archives/<id>.html`

## 6.4 Usage

媒体富化结果将直接服务于：

- 源料库卡片展示
- 搜索召回
- lint 追溯规则
- compile 输入增强

## 7. Deterministic Lint Engine

## 7.1 Positioning

“系统检查”不再以页面逻辑为中心，而改成独立的规则引擎。

检查按钮触发：

1. 扫描文件层
2. 跑规则集
3. 聚合结果
4. 写入审查数据
5. 审查页渲染

## 7.2 Rule output shape

每条规则统一输出：

```ts
type RuleIssue = {
  id: string
  kind: string
  severity: "error" | "warn" | "info"
  path?: string
  line?: number
  message: string
  fixable: boolean
  reviewAction?: string
  payload?: Record<string, unknown>
}
```

## 7.3 Initial rule families

第一批规则：

- 断链
- 孤立页
- 空/薄页
- 缺摘要
- 重复概念
- 引用缺失
- 正文引用图片但 `raw/sources_full` 无来源追溯
- PDF/视频存在但无追溯记录
- `sources_full` 源料未进入编译状态
- inbox 长期未处理
- stale / confidence 低优先项

## 7.4 Review integration

规则引擎只产出 issue；审查页只消费 issue。

审查页左栏是：

- lint issue
- sync failure
- system gap
- source intake pending
- flash diary failure

右栏是工作区留存文件。

## 8. Sync Strategy

## 8.1 Keep file-first sync

不采用 `gbrain` 的 git-first sync 主模式，继续以文件 hash / 批次状态为主。

## 8.2 Borrowed ideas

借鉴：

- manifest
- anchor/checkpoint
- incremental batch
- large batch defer expensive work
- publish only after full success

## 8.3 Recommended backup model

同时保留：

1. **本地快照备份**
   - 用于灾难恢复
2. **git 文本历史**
   - 用于跟踪代码、配置、wiki 文本、项目日志

角色分工：

- 本地快照负责保命
- git 负责版本演化

## 9. Entity Enrichment

## 9.1 Purpose

实体富化在 `LLM Wiki` 中不是“社交画像系统”，而是“知识链接增强器”。

## 9.2 Flow

1. 从源料中抽实体
   - 人
   - 公司
   - 项目
   - 产品
   - 方法
2. 查询本地已有知识
   - concept
   - procedure
   - episode
   - source mentions
3. 统计提及强度
   - mention count
   - source diversity
   - recency
4. 判定 tier
   - Tier 1 / 2 / 3
5. 执行 enrich
   - 创建 stub
   - 更新时间线
   - 建立 backlinks
   - 更新 entity index
6. 对高 tier 实体触发 late affected sources / compile impact

## 9.3 Constraints

- enrich 不得静默覆盖用户手写判断
- enrich 必须写回索引和关系，不直接无边界改正文
- enrich 的外部富化原始数据应单独落盘，便于审计

## 10. Remote Brain

## 10.1 Need

用户明确需要 remote brain。

## 10.2 Model

不把本地主脑替换为云端脑，而是做“本地主脑 + 云端派生镜像”。

### 本地主脑

- `raw`
- `sources_full`
- `wiki`
- `.llmwiki`

负责：

- ingest
- compile
- lint
- enrich
- 项目日志

### 云端镜像

负责：

- 远程搜索
- 手机端对话
- wiki 阅读
- source 摘要访问

云端保存的是派生成果，而不是本地的全部运行态真相。

## 10.3 Sync direction

方向固定为：

- 手机 / 远程输入 → 云端 intake
- 电脑端同步云端 intake → 本地 `raw`
- 本地 compile / enrich / lint → 更新云端镜像

## 11. Delivery Order

按以下顺序实施：

1. 检索模式路由 + hybrid search
2. 确定性 lint 规则引擎
3. 媒体源料富化
4. entity enrichment
5. remote brain

理由：

- 搜索和 lint 最快出可见收益
- 媒体富化直接服务源料库和 compile
- enrich 和 remote brain 依赖前面三层的稳定数据面

## 12. Risks

- 如果过早引入数据库作为主真相层，会破坏现有文件工作流
- 如果先做 remote brain 而不先统一搜索/索引，手机端和远程端会得到低质量结果
- 如果媒体富化不先做，图片/PDF/video 追溯和 source library 会持续弱化

## 13. Acceptance

方案完成后的验收标准：

1. 搜索有统一内核，可跑 keyword/direct/hybrid 三种模式
2. 搜索评估可复现
3. 系统检查有统一规则引擎和统一 issue 结构
4. 图片/PDF/video 进入可检索和可追溯体系
5. 实体富化能生成 tier、反链和 timeline
6. remote brain 能作为云端镜像服务于手机和远程阅读/对话
