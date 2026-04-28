/**
 * Source-owned automation flow for the sync entry page.
 *
 * The automation workspace imports this module directly so the rendered DAG
 * stays attached to the same source area that owns the sync-entry behavior.
 */

import type { CodeDerivedAutomationSeed } from "../../../../server/services/code-derived-automation-types.js";
import {
  flowBranch,
  flowEdge,
  flowNode,
} from "../../../../server/services/code-derived-automation-builders.js";

const SYNC_ENTRY_MERMAID = `
flowchart TD
    A["点击同步按钮<br/>bindRunPage() startButton.click"] --> B["confirmSyncPlan()<br/>统一决定是 none / inbox / confirm"]
    B --> C["GET /api/intake/scan<br/>loadIntakeScan()"]
    C --> D{"scan.items.length 是否为 0"}
    D -->|是| E["返回 none 并提示未检测到新源料<br/>statusNode / metaNode update"]
    D -->|否| F{"scan.plan.length 是否为 0"}
    F -->|是| G["返回 inbox 并提示去审查页<br/>statusNode / metaNode update"]
    F -->|否| H["showIntakePlanDialog()<br/>showIntakePlanDialog(root, scan.plan)"]
    H --> I{"用户是否确认同步编译方案"}
    I -->|否| J["返回 none 并结束<br/>return \"none\""]
    I -->|是| K["POST /api/runs/sync<br/>startRun(\"sync\")"]
    K --> L["attachRunStream()<br/>实时刷新运行日志"]
`.trim();

export const codeDerivedAutomationSeeds: readonly CodeDerivedAutomationSeed[] = [
  {
    slug: "sync-entry",
    name: "同步入口",
    summary: "从运行页点击同步，到 intake 扫描、计划判断和启动 sync run 的真实分支。",
    icon: "rocket",
    sourcePaths: [
      "web/client/src/pages/runs/index.ts",
    ],
    mermaid: SYNC_ENTRY_MERMAID,
    flow: {
      nodes: [
        flowNode("sync-trigger", "trigger", "点击同步按钮", "运行页点击后进入同步前置检查。", "bindRunPage() startButton.click"),
        flowNode("sync-confirm-plan", "action", "confirmSyncPlan()", "同步入口先统一决定是 none、inbox 还是 confirm。", "confirmSyncPlan()"),
        flowNode("sync-scan", "action", "GET /api/intake/scan", "先读取 intake scan 结果。", "loadIntakeScan()"),
        flowNode("sync-branch-items", "branch", "scan.items.length 是否为 0", "没有待处理原料时直接终止同步。", "if (scan.items.length === 0)"),
        flowNode("sync-none", "action", "返回 none 并提示未检测到新源料", "写入状态文案后直接结束。", "statusNode/metaNode update"),
        flowNode("sync-branch-plan", "branch", "scan.plan.length 是否为 0", "有原料但没有批量计划时，要求先去审查页处理 inbox。", "if (scan.plan.length === 0)"),
        flowNode("sync-inbox", "action", "返回 inbox 并提示去审查页", "提示用户做亲自指导录入或优先批量录入。", "statusNode/metaNode update"),
        flowNode("sync-dialog", "action", "showIntakePlanDialog()", "把同步编译方案弹窗展示给用户确认。", "showIntakePlanDialog(root, scan.plan)"),
        flowNode("sync-branch-confirm", "branch", "用户是否确认同步编译方案", "取消则结束，确认则真正启动 sync run。", "showIntakePlanDialog() result"),
        flowNode("sync-cancel", "action", "返回 none 并结束", "用户取消方案后不启动后端任务。", "return \"none\""),
        flowNode("sync-start", "action", "POST /api/runs/sync", "请求后端创建 sync run。", "startRun(\"sync\")"),
        flowNode("sync-stream", "action", "attachRunStream()", "订阅 line/status 事件并实时刷新运行日志。", "attachRunStream()"),
      ],
      edges: [
        flowEdge("sync-trigger", "sync-confirm-plan"),
        flowEdge("sync-confirm-plan", "sync-scan"),
        flowEdge("sync-scan", "sync-branch-items"),
        flowEdge("sync-branch-items", "sync-none"),
        flowEdge("sync-branch-items", "sync-branch-plan"),
        flowEdge("sync-branch-plan", "sync-inbox"),
        flowEdge("sync-branch-plan", "sync-dialog"),
        flowEdge("sync-dialog", "sync-branch-confirm"),
        flowEdge("sync-branch-confirm", "sync-cancel"),
        flowEdge("sync-branch-confirm", "sync-start"),
        flowEdge("sync-start", "sync-stream"),
      ],
      branches: [
        flowBranch("sync-items", "是否存在待处理项", "sync-branch-items", ["sync-none", "sync-branch-plan"]),
        flowBranch("sync-plan", "是否需要先去 inbox", "sync-branch-plan", ["sync-inbox", "sync-dialog", "sync-branch-confirm", "sync-cancel", "sync-start", "sync-stream"]),
        flowBranch("sync-confirm", "用户确认方案", "sync-branch-confirm", ["sync-cancel", "sync-start"]),
      ],
    },
  },
];
