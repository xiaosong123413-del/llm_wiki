/**
 * Source-owned automation flow for the source gallery page.
 *
 * The automation workspace reads this audited flow module directly so the DAG
 * tracks the source-gallery behavior defined in this source area.
 */

import type { CodeDerivedAutomationSeed } from "../../../../server/services/code-derived-automation-types.js";
import {
  flowBranch,
  flowEdge,
  flowNode,
} from "../../../../server/services/code-derived-automation-builders.js";

const SOURCE_GALLERY_MERMAID = `
flowchart TD
    A["打开 #/sources<br/>renderSourcesPage()"] --> B["GET /api/source-gallery<br/>handleSourceGalleryList()"]
    B --> C["汇总源料卡片<br/>listSourceGalleryItems()"]
    C --> D["渲染源料库列表<br/>renderSourceGallery()"]
    D --> E{"用户选择哪种源料动作"}
    E -->|送入 inbox| F["POST /api/source-gallery/selection/inbox<br/>handleSourceGalleryMoveToInbox()"]
    F --> G["复制到 inbox/source-gallery<br/>moveSourceGalleryItemsToInbox()"]
    E -->|加入优先录入| H["POST /api/source-gallery/selection/ingest<br/>handleSourceGalleryIngestQueue()"]
    H --> I["写入优先录入队列<br/>queueSourceGalleryBatchIngest()"]
    E -->|单条发起 compile| J["POST /api/source-gallery/:id/compile<br/>handleSourceGalleryCompile()"]
    J --> K["生成 compile 输入 Markdown<br/>createSourceGalleryCompileInput()"]
    K --> L["启动 sync run<br/>runManager.start(\"sync\")"]
`.trim();

export const codeDerivedAutomationSeeds: readonly CodeDerivedAutomationSeed[] = [
  {
    slug: "source-gallery",
    name: "源料库",
    summary: "从源料库列表加载，到送入 inbox 或生成 compile 输入并启动 sync run 的真实流程。",
    icon: "book-open",
    sourcePaths: [
      "web/client/src/pages/sources/index.ts",
      "web/server/routes/source-gallery.ts",
      "web/server/services/source-gallery.ts",
    ],
    mermaid: SOURCE_GALLERY_MERMAID,
    flow: {
      nodes: [
        flowNode("source-trigger", "trigger", "打开 #/sources", "源料库页面挂载后先刷新列表。", "renderSourcesPage()"),
        flowNode("source-list-api", "action", "GET /api/source-gallery", "按 query / sort / filter 读取源料列表。", "handleSourceGalleryList()"),
        flowNode("source-list-service", "action", "listSourceGalleryItems()", "从 runtime 索引和源目录汇总列表项。", "listSourceGalleryItems()"),
        flowNode("source-render", "action", "renderSourceGallery()", "把筛选后的源料卡片渲染到网格里。", "refreshSourceGallery()"),
        flowNode("source-branch", "branch", "用户选择哪种源料动作", "源料库支持送入 inbox、加入优先录入和发起 compile。", "bindSourcesPage()"),
        flowNode("source-inbox-api", "action", "POST /api/source-gallery/selection/inbox", "批量把选中源料复制到 inbox/source-gallery。", "handleSourceGalleryMoveToInbox()"),
        flowNode("source-inbox-service", "action", "moveSourceGalleryItemsToInbox()", "按 layer / bucket 生成唯一 inbox 目标路径。", "moveSourceGalleryItemsToInbox()"),
        flowNode("source-ingest-api", "action", "POST /api/source-gallery/selection/ingest", "把选中源料加入优先批量录入队列。", "handleSourceGalleryIngestQueue()"),
        flowNode("source-ingest-service", "action", "queueSourceGalleryBatchIngest()", "把源料条目写进 .llmwiki/source-gallery-batch-ingest.json。", "queueSourceGalleryBatchIngest()"),
        flowNode("source-compile-api", "action", "POST /api/source-gallery/:id/compile", "携带 conversationId 为单条源料发起 compile。", "handleSourceGalleryCompile()"),
        flowNode("source-input", "action", "createSourceGalleryCompileInput()", "把 guided ingest 对话整理成 compile 输入 Markdown。", "createSourceGalleryCompileInput()"),
        flowNode("source-run", "action", "runManager.start(\"sync\")", "启动 sync run 并返回 runId。", "runManager.start(\"sync\")"),
      ],
      edges: [
        flowEdge("source-trigger", "source-list-api"),
        flowEdge("source-list-api", "source-list-service"),
        flowEdge("source-list-service", "source-render"),
        flowEdge("source-render", "source-branch"),
        flowEdge("source-branch", "source-inbox-api"),
        flowEdge("source-inbox-api", "source-inbox-service"),
        flowEdge("source-branch", "source-ingest-api"),
        flowEdge("source-ingest-api", "source-ingest-service"),
        flowEdge("source-branch", "source-compile-api"),
        flowEdge("source-compile-api", "source-input"),
        flowEdge("source-input", "source-run"),
      ],
      branches: [
        flowBranch(
          "source-actions",
          "源料库操作分支",
          "source-branch",
          ["source-inbox-api", "source-inbox-service", "source-ingest-api", "source-ingest-service", "source-compile-api", "source-input", "source-run"],
        ),
      ],
    },
  },
];
