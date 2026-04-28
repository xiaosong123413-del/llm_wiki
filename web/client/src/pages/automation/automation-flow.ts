/**
 * Source-owned automation flow for the automation workspace itself.
 *
 * Keeping the DAG next to the page source lets the workspace update as soon as
 * this source-owned flow module changes and the server emits a change event.
 */

import type { CodeDerivedAutomationSeed } from "../../../../server/services/code-derived-automation-types.js";
import {
  flowBranch,
  flowEdge,
  flowNode,
} from "../../../../server/services/code-derived-automation-builders.js";

const AUTOMATION_WORKSPACE_MERMAID = `
flowchart TD
    A["打开 #/automation<br/>renderAutomationWorkspacePage()"] --> B["GET /api/automation-workspace<br/>handleAutomationWorkspaceList()"]
    B --> C["汇总所有 Workflow<br/>listWorkspaceAutomations()"]
    C --> D["渲染 Workflow 列表<br/>renderAutomationList()"]
    D --> E{"用户下一步做什么"}
    E -->|等待变化| F["订阅 /api/automation-workspace/events<br/>bindAutomationWorkspaceLiveRefresh()"]
    E -->|打开详情| G["点击 Workflow 卡片<br/>bindAutomationListActions()"]
    G --> H["GET /api/automation-workspace/:id<br/>handleAutomationWorkspaceDetail()"]
    H --> I["补全节点 app / model 信息<br/>readAutomationWorkspaceDetail() + enrichNode()"]
    I --> J["渲染 Mermaid 详情图<br/>renderAutomationMermaidView()"]
    J --> K{"详情页下一步做什么"}
    K -->|查看日志| L["GET /api/automation-workspace/:id/logs<br/>handleAutomationWorkspaceLogs()"]
    L --> M["渲染运行日志<br/>loadAutomationLogs()"]
    K -->|等待变化| N["订阅 /api/automation-workspace/events<br/>bindAutomationWorkspaceLiveRefresh()"]
`.trim();

export const codeDerivedAutomationSeeds: readonly CodeDerivedAutomationSeed[] = [
  {
    slug: "automation-workspace",
    name: "Workflow 工作区",
    summary: "从 Workflow 列表加载，到详情、日志和页面刷新联动的真实页面/API 流程。",
    icon: "git-branch",
    sourcePaths: [
      "web/client/src/pages/automation/index.ts",
      "web/client/src/pages/automation/live-events.ts",
      "web/client/src/pages/automation/panels.ts",
      "web/server/routes/automation-workspace.ts",
      "web/server/services/automation-workspace.ts",
    ],
    mermaid: AUTOMATION_WORKSPACE_MERMAID,
    flow: {
      nodes: [
        flowNode("auto-trigger", "trigger", "打开 #/automation", "路由挂载 Workflow 列表页。", "renderAutomationWorkspacePage()"),
        flowNode("auto-list-api", "action", "GET /api/automation-workspace", "列表页先读取所有 Workflow 卡片数据。", "handleAutomationWorkspaceList()"),
        flowNode("auto-list-service", "action", "listWorkspaceAutomations()", "汇总显式 automation、code flow 和 app-derived flow。", "listWorkspaceAutomations()"),
        flowNode("auto-list-render", "action", "renderAutomationList()", "把真实 Workflow 和源码真实流程分区渲染出来。", "bindAutomationListPage().refresh()"),
        flowNode("auto-list-branch", "branch", "列表页下一步要做什么", "列表页会等待变更事件，或打开某个 Workflow 详情。", "bindAutomationListActions()"),
        flowNode("auto-list-refresh", "action", "订阅 /api/automation-workspace/events", "收到 SSE change 事件后重新拉列表。", "bindAutomationWorkspaceLiveRefresh()"),
        flowNode("auto-open", "action", "点击 Workflow 卡片", "切到 #/automation/:id 详情路由。", "bindAutomationListActions()"),
        flowNode("auto-detail-api", "action", "GET /api/automation-workspace/:id", "详情路由请求 automation、comments、layout。", "handleAutomationWorkspaceDetail()"),
        flowNode("auto-detail-service", "action", "readAutomationWorkspaceDetail()", "补全 app 信息和 effectiveModel 后返回详情。", "readAutomationWorkspaceDetail() -> enrichNode()"),
        flowNode("auto-detail-render", "action", "renderAutomationMermaidView()", "把 flow 数据交给 Mermaid 视图渲染。", "renderAutomationDetail()"),
        flowNode("auto-detail-branch", "branch", "详情页下一步要做什么", "详情页可继续打开运行日志，或等待变更后自动刷新。", "bindAutomationDetailHeader()"),
        flowNode("auto-logs-api", "action", "GET /api/automation-workspace/:id/logs", "只对可执行 workflow 读取日志列表。", "handleAutomationWorkspaceLogs()"),
        flowNode("auto-logs-render", "action", "loadAutomationLogs()", "把运行日志渲染成时间线列表。", "loadAutomationLogs()"),
        flowNode("auto-detail-refresh", "action", "订阅 /api/automation-workspace/events", "详情页收到 SSE change 后重新拉详情。", "bindAutomationWorkspaceLiveRefresh()"),
      ],
      edges: [
        flowEdge("auto-trigger", "auto-list-api"),
        flowEdge("auto-list-api", "auto-list-service"),
        flowEdge("auto-list-service", "auto-list-render"),
        flowEdge("auto-list-render", "auto-list-branch"),
        flowEdge("auto-list-branch", "auto-list-refresh"),
        flowEdge("auto-list-branch", "auto-open"),
        flowEdge("auto-open", "auto-detail-api"),
        flowEdge("auto-detail-api", "auto-detail-service"),
        flowEdge("auto-detail-service", "auto-detail-render"),
        flowEdge("auto-detail-render", "auto-detail-branch"),
        flowEdge("auto-detail-branch", "auto-logs-api"),
        flowEdge("auto-logs-api", "auto-logs-render"),
        flowEdge("auto-detail-branch", "auto-detail-refresh"),
      ],
      branches: [
        flowBranch("auto-list-actions", "列表页动作分支", "auto-list-branch", ["auto-list-refresh", "auto-open"]),
        flowBranch("auto-detail-actions", "详情页动作分支", "auto-detail-branch", ["auto-logs-api", "auto-logs-render", "auto-detail-refresh"]),
      ],
    },
  },
];
