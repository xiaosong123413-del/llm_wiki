/**
 * Source-owned automation flow for the review board.
 *
 * The automation workspace loads this module at runtime so review DAG updates
 * are driven by the source-owned flow definition rather than a central list.
 */

import type { CodeDerivedAutomationSeed } from "../../../../server/services/code-derived-automation-types.js";
import {
  flowBranch,
  flowEdge,
  flowNode,
} from "../../../../server/services/code-derived-automation-builders.js";

const REVIEW_BOARD_MERMAID = `
flowchart TD
    A["打开 #/review<br/>renderReviewPage() / bindReviewPage()"] --> B["GET /api/review<br/>handleReviewSummary()"]

    B --> C["回填旧版 outdated-source<br/>backfillLegacyOutdatedSourceRepairs()"]
    C --> D["回填旧版 needs-deep-research<br/>backfillLegacyNeedsDeepResearchRepairs()"]
    D --> E["恢复 running 中的 deep research<br/>resumeRunningDeepResearchItems()"]
    E --> F["聚合审查项<br/>aggregateReviewItems()"]
    F --> G["补挂已缓存的 web suggestions<br/>attachStoredReviewWebSearchSuggestions()"]
    G --> H["渲染审查列表<br/>renderReviewItems() / renderReviewState()"]

    H --> I{"用户点了哪种动作"}

    I -->|单条推进| J["POST /api/review/deep-research/:id/actions<br/>handleDeepResearchAction()"]
    J --> K["校验 action<br/>normalizeAction()"]
    K --> L{"action = ignore ?"}
    L -->|是| M["写回 ignored 状态<br/>mutateDeepResearchItem()"]
    L -->|否| N["写回 running / progress=10<br/>mutateDeepResearchItem()"]
    N --> O{"category = missing-citation ?"}
    O -->|是| P["启动引用批处理<br/>enqueueMissingCitationBatch()"]
    O -->|否| Q["启动单条后台任务<br/>enqueueDeepResearchTask()"]
    P --> R["后台推进<br/>runMissingCitationBatch()"]
    Q --> S["后台推进<br/>runDeepResearchTask()"]
    R --> T{"后台结果"}
    S --> T
    T -->|成功| U["写回 done-await-confirm<br/>deep-research-items.json"]
    T -->|失败| V["写回 failed + errorMessage<br/>deep-research-items.json"]

    I -->|确认写入| W["POST /api/review/deep-research/:id/confirm<br/>handleDeepResearchConfirm()"]
    W --> X["读取 item 并校验状态<br/>getDeepResearchItem()"]
    X --> Y["把 draft 写回目标页<br/>applyDeepResearchDraftToTarget()"]
    Y --> Z["刷新 claim 生命周期<br/>refreshConfirmedDeepResearchClaimLifecycle()"]
    Z --> AA["写回 completed / progress=100<br/>mutateDeepResearchItem()"]
    AA --> AB["重新 GET /api/review<br/>loadReview()"]

    I -->|批量进行| AC["POST /api/review/deep-research/bulk-advance<br/>handleDeepResearchBulkAdvance()"]
    AC --> AD["扫描 pending 项<br/>bulkAdvanceDeepResearchItems()"]
    AD --> AE["批量写回 running / progress=10<br/>writeDeepResearchItems()"]
    AE --> AF["逐条 enqueueDeepResearchTask()<br/>或 enqueueMissingCitationBatch()"]

    I -->|全部写入| AG["POST /api/review/deep-research/bulk-confirm<br/>handleDeepResearchBulkConfirm()"]
    AG --> AH["扫描 done-await-confirm 项<br/>bulkConfirmDeepResearchItems()"]
    AH --> AI["逐条 confirmDeepResearchWrite()"]
    AI --> AJ["成功: completed<br/>失败: failed"]

    I -->|批量录入 inbox| AK["POST /api/review/inbox/batch-ingest<br/>handleReviewInboxBatchIngest()"]
    AK --> AL["校验 targets<br/>stringArrayBody()"]
    AL --> AM["逐条规范化 inbox 路径<br/>normalizeInboxTarget()"]
    AM --> AN["写入批量录入队列文件<br/>review-inbox-batch-ingest.json"]

    I -->|打开对话| AO["POST /api/review/deep-research/:id/chat<br/>handleDeepResearchChat()"]
    AO --> AP{"已有 chatId ?"}
    AP -->|有| AQ["读取会话<br/>getConversation()"]
    AP -->|没有| AR["创建会话<br/>createConversation()"]
    AR --> AS["写入首条上下文消息<br/>addConversationMessage()"]
    AS --> AT["回写 chatId<br/>setDeepResearchChatId()"]
    AQ --> AU["跳转 #/chat/:id"]
    AT --> AU
`.trim();

export const codeDerivedAutomationSeeds: readonly CodeDerivedAutomationSeed[] = [
  {
    slug: "review-board",
    name: "审查与运行结果",
    summary: "从审查页汇总，到推进 deep research、确认写入或触发 inbox 批量录入的真实流程。",
    icon: "bot",
    sourcePaths: [
      "web/client/src/pages/review/index.ts",
      "web/server/routes/review.ts",
      "web/server/services/chat-store.ts",
      "web/server/services/review-aggregator.ts",
      "web/server/services/deep-research.ts",
      "web/server/services/review-inbox-batch.ts",
      "web/server/services/review-web-search.ts",
    ],
    mermaid: REVIEW_BOARD_MERMAID,
    flow: {
      nodes: [
        flowNode("review-trigger", "trigger", "打开 /review", "页面挂载后立即读取审查队列。", "renderReviewPage() -> loadReview()"),
        flowNode("review-summary", "action", "GET /api/review", "审查页读取统一 review summary。", "handleReviewSummary()"),
        flowNode("review-backfill-outdated", "action", "backfillLegacyOutdatedSourceRepairs()", "先把历史 outdated-source 修复项补进统一队列。", "backfillLegacyOutdatedSourceRepairs()"),
        flowNode("review-backfill-deep", "action", "backfillLegacyNeedsDeepResearchRepairs()", "再把历史 needs-deep-research 修复项补进队列。", "backfillLegacyNeedsDeepResearchRepairs()"),
        flowNode("review-resume", "action", "resumeRunningDeepResearchItems()", "恢复仍在执行中的 Deep Research 项。", "resumeRunningDeepResearchItems()"),
        flowNode("review-aggregate", "action", "aggregateReviewItems()", "聚合 deep research、run、state、inbox 等审查项。", "aggregateReviewItems()"),
        flowNode("review-suggestions", "action", "attachStoredReviewWebSearchSuggestions()", "把已保存的 web search 建议附到审查项上。", "attachStoredReviewWebSearchSuggestions()"),
        flowNode("review-render", "action", "renderReviewItems()", "把审查项渲染成卡片列表和工作区。", "renderReviewItems() -> renderReviewState()"),
        flowNode("review-branch", "branch", "用户从审查卡片发起什么动作", "同一批卡片支持单条、批量、inbox 和聊天分支。", "handleReviewItemClick() / handleReviewToolbarClick()"),
        flowNode("review-action", "action", "POST /api/review/deep-research/:id/actions", "推进单条 Deep Research 动作。", "handleDeepResearchAction() -> startDeepResearchAction()"),
        flowNode("review-confirm", "action", "POST /api/review/deep-research/:id/confirm", "把待确认草案写回目标页面。", "handleDeepResearchConfirm() -> confirmDeepResearchWrite()"),
        flowNode("review-bulk-advance", "action", "POST /api/review/deep-research/bulk-advance", "批量推进 pending Deep Research 卡片。", "handleDeepResearchBulkAdvance() -> bulkAdvanceDeepResearchItems()"),
        flowNode("review-bulk-confirm", "action", "POST /api/review/deep-research/bulk-confirm", "批量确认 done-await-confirm 草案。", "handleDeepResearchBulkConfirm() -> bulkConfirmDeepResearchItems()"),
        flowNode("review-inbox-batch", "action", "POST /api/review/inbox/batch-ingest", "把 inbox 目标加入优先批量录入队列。", "handleReviewInboxBatchIngest() -> queueReviewInboxBatchIngest()"),
        flowNode("review-chat", "action", "POST /api/review/deep-research/:id/chat", "为单条 Deep Research 卡片打开或创建对话。", "handleDeepResearchChat() -> createConversation()"),
      ],
      edges: [
        flowEdge("review-trigger", "review-summary"),
        flowEdge("review-summary", "review-backfill-outdated"),
        flowEdge("review-backfill-outdated", "review-backfill-deep"),
        flowEdge("review-backfill-deep", "review-resume"),
        flowEdge("review-resume", "review-aggregate"),
        flowEdge("review-aggregate", "review-suggestions"),
        flowEdge("review-suggestions", "review-render"),
        flowEdge("review-render", "review-branch"),
        flowEdge("review-branch", "review-action"),
        flowEdge("review-branch", "review-confirm"),
        flowEdge("review-branch", "review-bulk-advance"),
        flowEdge("review-branch", "review-bulk-confirm"),
        flowEdge("review-branch", "review-inbox-batch"),
        flowEdge("review-branch", "review-chat"),
      ],
      branches: [
        flowBranch(
          "review-actions",
          "审查动作分支",
          "review-branch",
          ["review-action", "review-confirm", "review-bulk-advance", "review-bulk-confirm", "review-inbox-batch", "review-chat"],
        ),
      ],
    },
  },
];
