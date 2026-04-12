export interface WikiTemplate {
  id: string
  name: string
  description: string
  icon: string
  schema: string
  purpose: string
  extraDirs: string[]
}

const BASE_SCHEMA_TYPES = `| entity | wiki/entities/ | 命名实体（人物、工具、组织、数据集） |
| concept | wiki/concepts/ | 思想、技术、现象、框架 |
| source | wiki/sources/ | 论文、文章、演讲、书籍、博客 |
| query | wiki/queries/ | 正在调查的开放性问题 |
| comparison | wiki/comparisons/ | 相关实体的横向对比分析 |
| synthesis | wiki/synthesis/ | 跨素材的综合总结与结论 |
| overview | wiki/ | 项目高层概览（每个项目一个） |`

const BASE_NAMING = `- 文件名：\`kebab-case.md\`（短横线小写）
- 实体：尽量与官方名称一致（如 \`openai.md\`、\`gpt-4.md\`）
- 概念：描述性名词短语（如 \`chain-of-thought.md\`）
- 素材：\`作者-年份-标题缩写.md\`（如 \`wei-2022-cot.md\`）
- 问题：以问题作为文件名（如 \`does-scale-improve-reasoning.md\`）`

const BASE_FRONTMATTER = `所有页面必须包含 YAML frontmatter：

\`\`\`yaml
---
type: entity | concept | source | query | comparison | synthesis | overview
title: 人类可读标题
tags: []
related: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`

素材页面额外包含：
\`\`\`yaml
authors: []
year: YYYY
url: ""
venue: ""
\`\`\``

const BASE_INDEX_FORMAT = `\`wiki/index.md\` 按类型分组列出所有页面，每条格式：
\`\`\`
- [[页面文件名]] — 一行说明
\`\`\``

const BASE_LOG_FORMAT = `\`wiki/log.md\` 按倒序记录活动：
\`\`\`
## YYYY-MM-DD

- 执行的操作 / 记录的发现
\`\`\``

const BASE_CROSSREF = `- 使用 \`[[页面文件名]]\` 语法在 wiki 页面之间建立链接
- 每个实体和概念都应出现在 \`wiki/index.md\` 中
- 问题页面链接到它所引用的素材和概念
- 综合页面通过 \`related:\` 引用所有相关素材`

const BASE_CONTRADICTION = `当素材之间出现矛盾时：
1. 在相关概念或实体页面中记录矛盾
2. 创建或更新问题页面以追踪这个开放性问题
3. 从问题页面链接到两个素材
4. 积累足够证据后在综合页面中解决`

const researchTemplate: WikiTemplate = {
  id: "research",
  name: "研究",
  description: "深度研究，含假说追踪与方法论记录",
  icon: "🔬",
  extraDirs: ["wiki/methodology", "wiki/findings", "wiki/thesis"],
  schema: `# Wiki 结构规范 — 深度研究

## 页面类型

| 类型 | 目录 | 用途 |
|------|------|------|
${BASE_SCHEMA_TYPES}
| thesis | wiki/thesis/ | 工作假说及其演进过程 |
| methodology | wiki/methodology/ | 研究方法、协议与研究设计 |
| finding | wiki/findings/ | 单条实证结果或观察 |

## 命名规范

${BASE_NAMING}
- 假说：以假设为文件名（如 \`scaling-improves-reasoning.md\`）
- 方法论：方法名称（如 \`systematic-review.md\`、\`ablation-study.md\`）
- 发现：描述性文件名（如 \`larger-models-better-few-shot.md\`）

## Frontmatter

${BASE_FRONTMATTER}

假说页面额外包含：
\`\`\`yaml
confidence: low | medium | high
status: speculative | supported | refuted | settled
\`\`\`

发现页面额外包含：
\`\`\`yaml
source: "[[素材文件名]]"
confidence: low | medium | high
replicated: true | false | null
\`\`\`

## 索引格式

${BASE_INDEX_FORMAT}

## 日志格式

${BASE_LOG_FORMAT}

## 交叉引用规则

${BASE_CROSSREF}
- 发现页面通过 \`source:\` frontmatter 字段链接回对应素材
- 假说页面通过 \`related:\` 引用支持和反驳该假说的发现
- 方法论页面被使用该方法的发现引用

## 矛盾处理

${BASE_CONTRADICTION}

## 研究特有约定

- 随证据积累持续更新假说页面——它们是动态文档
- 每条发现应在已知情况下评估可复现性
- 方法论页面解释"为什么"（原理）而不只是"如何"（步骤）
- 在发现页面中区分直接证据与推断
`,
  purpose: `# 项目目的 — 深度研究

## 研究问题

<!-- 陈述本研究要回答的核心问题，要具体、可证伪。 -->

>

## 假说 / 工作论点

<!-- 你目前最好的猜测，会随证据积累而更新。 -->

>

## 背景

<!-- 哪些已有工作或背景促成了这项研究？它填补了什么空白？ -->

## 子问题

<!-- 将主问题拆解为可操作的子问题。 -->

1.
2.
3.
4.

## 研究范围

**范围内：**
-

**范围外：**
-

## 研究方法

<!-- 你将如何展开调查？哪类素材或实验是相关的？ -->

-

## 成功标准

<!-- 什么样的结果代表你找到了满意的答案？ -->

-

## 当前状态

> 尚未开始——随研究进展更新此部分。
`,
}

const readingTemplate: WikiTemplate = {
  id: "reading",
  name: "阅读",
  description: "追踪书中的人物、主题、情节线索与章节笔记",
  icon: "📚",
  extraDirs: ["wiki/characters", "wiki/themes", "wiki/plot-threads", "wiki/chapters"],
  schema: `# Wiki 结构规范 — 阅读记录

## 页面类型

| 类型 | 目录 | 用途 |
|------|------|------|
${BASE_SCHEMA_TYPES}
| character | wiki/characters/ | 书中的人物与角色 |
| theme | wiki/themes/ | 反复出现的思想、主题与象征线索 |
| plot-thread | wiki/plot-threads/ | 正在追踪的情节线或叙事弧 |
| chapter | wiki/chapters/ | 逐章笔记与摘要 |

## 命名规范

${BASE_NAMING}
- 人物：人物名转 kebab-case（如 \`elizabeth-bennet.md\`）
- 主题：主题性名词短语（如 \`social-class-mobility.md\`）
- 情节线：弧线描述（如 \`darcys-redemption-arc.md\`）
- 章节：\`ch-NN-标题缩写.md\`（如 \`ch-01-opening-scene.md\`）

## Frontmatter

${BASE_FRONTMATTER}

人物页面额外包含：
\`\`\`yaml
first_appearance: "第 N 章"
role: protagonist | antagonist | supporting | minor
\`\`\`

章节页面额外包含：
\`\`\`yaml
chapter: N
pages: "1-24"
\`\`\`

## 索引格式

${BASE_INDEX_FORMAT}

## 日志格式

${BASE_LOG_FORMAT}

## 交叉引用规则

${BASE_CROSSREF}
- 章节笔记通过 \`related:\` 引用该章出现的人物
- 主题页面链接到该主题最突出的章节
- 情节线页面列出推动该弧线发展的章节

## 矛盾处理

${BASE_CONTRADICTION}

## 阅读特有约定

- 章节页面在阅读时或阅读后立即记录——捕捉第一反应
- 在章节笔记中区分情节摘要与个人解读
- 主题页面应追踪主题在全书中的"发展"，而不只是声明主题存在
- 用 \`status: open\` 标注未解决的情节线，直至结局揭晓
- 记录重要引文的页码，便于日后回查
`,
  purpose: `# 项目目的 — 阅读记录

## 书籍信息

**书名：**
**作者：**
**出版年：**
**类型：**

## 为什么读这本书

<!-- 是什么吸引你读这本书？你希望从中获得什么？ -->

## 希望追踪的核心主题

<!-- 你预期或想要追踪哪些主题线索？ -->

1.
2.
3.

## 带着疑问出发

<!-- 你希望在阅读结束时得到回答或探索的问题。 -->

1.
2.

## 阅读进度

**开始时间：**
**目标完成：**
**当前章节：**

## 初步印象

<!-- 读完第一章或第一次阅读后更新。 -->

>

## 最终感悟

<!-- 读完后填写，这本书给你带来了什么？ -->

>
`,
}

const personalTemplate: WikiTemplate = {
  id: "personal",
  name: "个人成长",
  description: "追踪目标、习惯、反思与日记，用于自我提升",
  icon: "🌱",
  extraDirs: ["wiki/goals", "wiki/habits", "wiki/reflections", "wiki/journal"],
  schema: `# Wiki 结构规范 — 个人成长

## 页面类型

| 类型 | 目录 | 用途 |
|------|------|------|
${BASE_SCHEMA_TYPES}
| goal | wiki/goals/ | 你正在努力实现的具体目标 |
| habit | wiki/habits/ | 习惯行为及其追踪 |
| reflection | wiki/reflections/ | 阶段性复盘与总结 |
| journal | wiki/journal/ | 自由书写的日常或随笔记录 |

## 命名规范

${BASE_NAMING}
- 目标：以结果为文件名（如 \`run-a-marathon.md\`、\`learn-spanish.md\`）
- 习惯：行为名称（如 \`daily-meditation.md\`、\`morning-pages.md\`）
- 反思：类型+日期（如 \`weekly-2024-03.md\`、\`quarterly-2024-q1.md\`）
- 日记：日期文件名（如 \`2024-03-15.md\`）

## Frontmatter

${BASE_FRONTMATTER}

目标页面额外包含：
\`\`\`yaml
target_date: YYYY-MM-DD
status: active | paused | achieved | abandoned
progress: 0-100
\`\`\`

习惯页面额外包含：
\`\`\`yaml
frequency: daily | weekly | monthly
streak: N
status: active | paused | dropped
\`\`\`

反思页面额外包含：
\`\`\`yaml
period: weekly | monthly | quarterly | annual
\`\`\`

## 索引格式

${BASE_INDEX_FORMAT}

## 日志格式

${BASE_LOG_FORMAT}

## 交叉引用规则

${BASE_CROSSREF}
- 反思页面引用该周期内复盘的目标和习惯
- 目标通过 \`related:\` 链接到支持它的习惯
- 日记可以用 \`[[文件名]]\` 内联引用目标和反思

## 矛盾处理

${BASE_CONTRADICTION}

## 个人成长特有约定

- 日记和反思要诚实——这个 wiki 是给自己的，不是给读者看的
- 定期更新目标进度字段；过时的数据比没有数据更糟
- 区分结果目标（你想要什么）与过程目标（你将做什么）
- 反思习惯为什么成功或失败，而不仅仅是记录结果
- 用综合目录记录跨越多个目标或阶段的洞察
`,
  purpose: `# 项目目的 — 个人成长

## 关注领域

<!-- 你目前正在积极提升自己的哪些方面？ -->

1.
2.
3.

## 动力来源

<!-- 为什么是现在？是什么促使你开始这个知识库？ -->

## 当前目标（概览）

<!-- 高层列表——在 wiki/goals/ 中创建详细目标页面 -->

- [ ]
- [ ]
- [ ]

## 当前习惯

<!-- 高层列表——在 wiki/habits/ 中创建详细习惯页面 -->

-
-

## 复盘节奏

**每日日记：** 是 / 否
**每周反思：**
**每月反思：**
**每季反思：**

## 指导原则

<!-- 哪些价值观或原则引导你的成长工作？ -->

1.
2.
3.

## 今年的主题

<!-- 一句话概括你对这一年的意图。 -->

>
`,
}

const businessTemplate: WikiTemplate = {
  id: "business",
  name: "商业",
  description: "管理会议、决策、项目与利益相关方信息",
  icon: "💼",
  extraDirs: ["wiki/meetings", "wiki/decisions", "wiki/projects", "wiki/stakeholders"],
  schema: `# Wiki 结构规范 — 商业 / 团队

## 页面类型

| 类型 | 目录 | 用途 |
|------|------|------|
${BASE_SCHEMA_TYPES}
| meeting | wiki/meetings/ | 会议记录、议程与行动项 |
| decision | wiki/decisions/ | 架构或战略决策（ADR 风格）|
| project | wiki/projects/ | 项目简介、状态与复盘 |
| stakeholder | wiki/stakeholders/ | 涉及的人员、团队与组织 |

## 命名规范

${BASE_NAMING}
- 会议：\`YYYY-MM-DD-标题缩写.md\`（如 \`2024-03-15-sprint-planning.md\`）
- 决策：\`NNN-标题缩写.md\`（如 \`001-adopt-typescript.md\`）
- 项目：描述性文件名（如 \`payments-redesign.md\`）
- 利益相关方：姓名或团队转 kebab-case（如 \`alice-chen.md\`、\`platform-team.md\`）

## Frontmatter

${BASE_FRONTMATTER}

会议页面额外包含：
\`\`\`yaml
date: YYYY-MM-DD
attendees: []
action_items: []
\`\`\`

决策页面额外包含：
\`\`\`yaml
status: proposed | accepted | deprecated | superseded
deciders: []
date: YYYY-MM-DD
supersedes: ""   # 被本决策替代的 ADR 文件名（如有）
\`\`\`

项目页面额外包含：
\`\`\`yaml
status: planned | active | on-hold | complete | cancelled
owner: ""
start_date: YYYY-MM-DD
target_date: YYYY-MM-DD
\`\`\`

## 索引格式

${BASE_INDEX_FORMAT}

## 日志格式

${BASE_LOG_FORMAT}

## 交叉引用规则

${BASE_CROSSREF}
- 会议记录通过 \`attendees:\` frontmatter 和 \`[[利益相关方文件名]]\` 引用参会者
- 决策页面链接到讨论该决策的会议
- 项目页面通过 \`related:\` 链接关键决策
- 利益相关方页面列出其参与的项目和决策

## 矛盾处理

${BASE_CONTRADICTION}

## 商业特有约定

- 会议记录应在会议中或会后 24 小时内完成——记忆衰退很快
- 行动项必须有负责人和截止日期才算可执行
- 决策页面记录"背景与后果"，不只是决策本身
- 已废弃的决策应链接到替代它的新决策
- 项目完成后应补充复盘部分
`,
  purpose: `# 项目目的 — 商业 / 团队

## 业务背景

**组织 / 团队：**
**领域：**
**覆盖时间段：**

## 目标

<!-- 这个知识库支持哪些顶层业务目标？ -->

1.
2.
3.

## 主要项目

<!-- 高层列表——在 wiki/projects/ 中创建详细页面 -->

-
-

## 主要利益相关方

<!-- 涉及的主要人员或团队是谁？ -->

-
-

## 待定决策

<!-- 正在推进中的决策——在 wiki/decisions/ 中创建 ADR 页面 -->

-
-

## 衡量指标 / 成功标准

<!-- 团队如何衡量目标进展？ -->

-

## 约束与风险

<!-- 已知约束（预算、时间、组织）和需追踪的风险 -->

-

## 复盘节奏

**每周同步记录：**
**每月状态更新：**
**每季复盘：**
`,
}

const generalTemplate: WikiTemplate = {
  id: "general",
  name: "通用",
  description: "极简配置——适合任何用途的空白起点",
  icon: "📄",
  extraDirs: [],
  schema: `# Wiki 结构规范

## 页面类型

| 类型 | 目录 | 用途 |
|------|------|------|
${BASE_SCHEMA_TYPES}

## 命名规范

${BASE_NAMING}

## Frontmatter

${BASE_FRONTMATTER}

## 索引格式

${BASE_INDEX_FORMAT}

## 日志格式

${BASE_LOG_FORMAT}

## 交叉引用规则

${BASE_CROSSREF}

## 矛盾处理

${BASE_CONTRADICTION}
`,
  purpose: `# 项目目的

## 目标

<!-- 你想理解或构建什么？ -->

## 核心问题

<!-- 列出驱动本项目的主要问题 -->

1.
2.
3.

## 研究范围

**范围内：**
-

**范围外：**
-

## 论点

<!-- 你当前的工作假说或结论（随项目进展持续更新）-->

> 待定
`,
}

export const templates: WikiTemplate[] = [
  researchTemplate,
  readingTemplate,
  personalTemplate,
  businessTemplate,
  generalTemplate,
]

export function getTemplate(id: string): WikiTemplate {
  const found = templates.find((t) => t.id === id)
  if (!found) {
    throw new Error(`Unknown template id: "${id}"`)
  }
  return found
}
