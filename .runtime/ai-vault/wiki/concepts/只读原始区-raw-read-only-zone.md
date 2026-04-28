---
orphaned: true
title: 只读原始区 (Raw Read-Only Zone)
summary: 知识库中专门存放未经处理的原始素材的只读目录区域，防止原始内容被意外修改，保持素材的原始状态。
sources:
  - inbox（剪藏进来的）__notionmpclipper__C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl__fdb56e6d.md
createdAt: "2026-04-16T15:52:31.361Z"
updatedAt: "2026-04-16T15:52:31.361Z"
tags:
  - 知识管理
  - 文件结构
  - 原始素材
aliases:
  - 只读原始区-raw-read-only-zone
  - 只(RZ
  - 只读原始区
  - raw（只读区）
  - C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl
  - raw区
  - 只读区
  - Raw Zone
---

---
title: 只读原始区 (Raw Read-Only Zone)
summary: 知识管理系统中用于存放未经处理的原始素材的专属区域，以只读方式保护原始内容不被修改。
tags:
  - 知识管理
  - 文件管理
  - 第二大脑
  - PKM
aliases:
  - raw区
  - 只读区
  - Raw Zone
---

# 只读原始区 (Raw Read-Only Zone)

只读原始区（Raw Read-Only Zone，简称 raw 区或只读区）是个人知识管理系统（PKM）中的一个专属存储区域，用于集中存放从外部渠道收集、尚未经过加工处理的原始素材。该区域以"只读"为核心约束，确保原始内容的完整性与可溯源性。^[inbox（剪藏进来的）__notionmpclipper__C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl__fdb56e6d.md]

## 核心理念

raw 区的设计哲学是将"收集"与"加工"两个动作严格分离。原始素材一旦进入 raw 区，便不应被直接编辑或修改——任何加工、提炼、整理都应在其他区域（如笔记区、项目区）中进行，并通过 [[双链]] 或引用的方式指向 raw 区中的原始内容。这一机制保证了素材的原始状态始终可查，便于日后核实来源或重新解读。^[inbox（剪藏进来的）__notionmpclipper__C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl__fdb56e6d.md]

## 典型目录结构

raw 区通常按来源类型组织子目录，常见结构如下：

```
raw（只读区）/
├── inbox/                  # 待处理的新收集内容
│   ├── notion mp clipper/  # 通过 Notion MP Clipper 剪藏的网页内容
│   ├── 微信收藏/
│   └── 截图/
├── 书籍摘录/
├── 论文/
└── 视频笔记/
```

inbox 子目录是 raw 区的入口缓冲层，所有新收集的内容首先落入 inbox，待定期整理后归入对应的来源分类目录。^[inbox（剪藏进来的）__notionmpclipper__C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl__fdb56e6d.md]

## 常见收集来源

raw 区中的内容通常来自以下渠道：

- 网页剪藏工具（如 Notion MP Clipper、Obsidian Web Clipper）
- 微信文章、公众号收藏
- 电子书标注与摘录
- 学术论文 PDF
- 播客、视频的文字记录
- 截图与图片素材

^[inbox（剪藏进来的）__notionmpclipper__C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl__fdb56e6d.md]

## 与知识管理系统其他区域的关系

raw 区通常是整个知识库工作流的起点。其与其他区域的典型关系如下：

- raw 区 → 加工提炼 → 永久笔记区（Permanent Notes）
- raw 区 → 项目引用 → [[PARA System]] 中的 Projects / Areas
- raw 区 → 归档 → 完成处理后可按 [[321 备份原则]] 进行备份存档

raw 区本身不产出知识，它是知识生产的原材料仓库。^[inbox（剪藏进来的）__notionmpclipper__C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl__fdb56e6d.md]

## 维护建议

- 定期清理 inbox，避免积压导致"收集焦虑"
- 为每条原始素材保留来源 URL 或文件路径，确保可溯源
- 不在 raw 区内直接写批注，批注应在独立笔记中通过引用关联
- 可结合 [[321 备份原则]] 对 raw 区进行定期冷备份，防止原始素材丢失

## 相关概念

- [[321 备份原则]]
- [[PARA System]]
- [[文件管理]]
- [[第二大脑]]

## 来源

- `raw（只读区）（按照来源分类）__inbox（剪藏进来的）__notionmpclipper__C_Users_Administrator_Desktop_xiaosong的知识库_ai知识库_第二大脑_raw_只读区_inbox_notion_mp_cl__bafe53f2.md`
