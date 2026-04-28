/**
 * Automation workspace aggregation.
 *
 * The workspace reads explicit automation definitions, derived app workflows,
 * and source-code-audited DAGs, then enriches their nodes with app metadata,
 * effective model labels, comments, layouts, and logs for the client pages.
 */

import type { AutomationDefinition } from "./automation-config.js";
import { readAutomationConfig } from "./automation-config.js";
import type { AutomationFlow, AutomationFlowBranch, AutomationFlowEdge, AutomationFlowNode } from "./automation-flow.js";
import { readAppConfig, type AppDefinition } from "./app-config.js";
import {
  listCodeDerivedAutomations,
  type CodeDerivedAutomationDefinition,
} from "./code-derived-automations.js";
import { readLlmProviderConfig } from "./llm-config.js";
import {
  listAutomationWorkspaceComments,
  listAutomationWorkspaceLogs,
  readAutomationWorkspaceLayout,
  type AutomationWorkspaceComment,
  type AutomationWorkspaceLayout,
  type AutomationWorkspaceLog,
} from "./automation-workspace-store.js";

const DERIVED_AUTOMATION_PREFIX = "app-workflow-";

type AutomationSourceKind = "automation" | "app" | "code";

interface WorkspaceAutomation extends AutomationDefinition {
  sourceKind: AutomationSourceKind;
  viewMode: "flow";
  documentSteps: [];
  mermaid?: string;
}

interface EffectiveAutomationModel {
  provider: string;
  model: string;
  source: "none" | "explicit" | "app" | "default";
  label: string;
}

interface AutomationWorkspaceNode extends AutomationFlowNode {
  app: Pick<AppDefinition, "id" | "name" | "workflow" | "prompt" | "provider" | "model"> | null;
  effectiveModel: EffectiveAutomationModel;
}

interface AutomationWorkspaceDetail {
  automation: WorkspaceAutomation & {
    apps: Array<Pick<AppDefinition, "id" | "name" | "workflow" | "prompt" | "provider" | "model">>;
    flow: {
      nodes: AutomationWorkspaceNode[];
      edges: AutomationFlowEdge[];
      branches: AutomationFlowBranch[];
    };
    mermaid?: string;
  };
  comments: AutomationWorkspaceComment[];
  layout: AutomationWorkspaceLayout;
}

export function listAutomationWorkspace(projectRoot: string): Promise<Array<{
  id: string;
  name: string;
  summary: string;
  icon: string;
  enabled: boolean;
  trigger: string;
  updatedAt?: string;
  sourceKind: AutomationSourceKind;
}>> {
  return listWorkspaceAutomations(projectRoot).then((automations) => automations.map((automation) => ({
    id: automation.id,
    name: automation.name,
    summary: automation.summary,
    icon: automation.icon,
    enabled: automation.enabled,
    trigger: automation.trigger,
    updatedAt: automation.updatedAt,
    sourceKind: automation.sourceKind,
  })));
}

export async function readAutomationWorkspaceDetail(
  projectRoot: string,
  runtimeRoot: string,
  automationId: string,
): Promise<AutomationWorkspaceDetail | null> {
  const automation = (await listWorkspaceAutomations(projectRoot)).find((item) => item.id === automationId);
  if (!automation) {
    return null;
  }
  const apps = readAppConfig(projectRoot).apps;
  const defaultModel = readLlmProviderConfig(projectRoot);
  const nodes = automation.flow.nodes.map((node) => enrichNode(node, apps, defaultModel));
  return {
    automation: {
      ...automation,
      apps: uniqueApps(nodes),
      flow: {
        nodes,
        edges: automation.flow.edges,
        branches: automation.flow.branches,
      },
      ...(automation.mermaid ? { mermaid: automation.mermaid } : {}),
    },
    comments: listAutomationWorkspaceComments(runtimeRoot, automationId),
    layout: readAutomationWorkspaceLayout(runtimeRoot, automationId),
  };
}

export function listAutomationWorkspaceCommentsForId(runtimeRoot: string, automationId: string): AutomationWorkspaceComment[] {
  return listAutomationWorkspaceComments(runtimeRoot, automationId);
}

export function listAutomationWorkspaceLogsForId(runtimeRoot: string, automationId: string): AutomationWorkspaceLog[] {
  return listAutomationWorkspaceLogs(runtimeRoot, automationId);
}

export function readAutomationWorkspaceLayoutForId(runtimeRoot: string, automationId: string): AutomationWorkspaceLayout {
  return readAutomationWorkspaceLayout(runtimeRoot, automationId);
}

async function listWorkspaceAutomations(projectRoot: string): Promise<WorkspaceAutomation[]> {
  const configuredAutomations = readAutomationConfig(projectRoot).automations.map((automation) => (
    createWorkspaceAutomation(automation, "automation")
  ));
  const codeDerivedAutomations = (await listCodeDerivedAutomations(projectRoot)).map((automation) => (
    createWorkspaceAutomation(automation, "code")
  ));
  const apps = readAppConfig(projectRoot).apps;
  const configuredAppIds = new Set(configuredAutomations.map((automation) => automation.appId));
  const derivedAppAutomations = apps
    .filter((app) => !configuredAppIds.has(app.id))
    .map(createDerivedAutomationFromApp);
  return [...configuredAutomations, ...codeDerivedAutomations, ...derivedAppAutomations];
}

function createWorkspaceAutomation(
  automation: AutomationDefinition | CodeDerivedAutomationDefinition,
  sourceKind: AutomationSourceKind,
): WorkspaceAutomation {
  return {
    ...automation,
    sourceKind,
    viewMode: "flow",
    documentSteps: [],
  };
}

function enrichNode(
  node: AutomationFlowNode,
  apps: AppDefinition[],
  defaultModel: ReturnType<typeof readLlmProviderConfig>,
): AutomationWorkspaceNode {
  const app = findNodeApp(node, apps);
  return {
    ...node,
    app: summarizeApp(app),
    effectiveModel: resolveEffectiveModel(node, app, defaultModel),
  };
}

function resolveEffectiveModel(
  node: AutomationFlowNode,
  app: AppDefinition | null,
  defaultModel: ReturnType<typeof readLlmProviderConfig>,
): EffectiveAutomationModel {
  return resolveExplicitModel(node, app, defaultModel)
    ?? resolveAppModel(app)
    ?? resolveDefaultModel(app, defaultModel)
    ?? resolveMissingModel();
}

function findNodeApp(node: AutomationFlowNode, apps: AppDefinition[]): AppDefinition | null {
  return node.appId ? apps.find((item) => item.id === node.appId) ?? null : null;
}

function summarizeApp(app: AppDefinition | null): AutomationWorkspaceNode["app"] {
  if (!app) {
    return null;
  }
  return {
    id: app.id,
    name: app.name,
    workflow: app.workflow,
    prompt: app.prompt,
    provider: app.provider,
    model: app.model,
  };
}

function resolveExplicitModel(
  node: AutomationFlowNode,
  app: AppDefinition | null,
  defaultModel: ReturnType<typeof readLlmProviderConfig>,
): EffectiveAutomationModel | null {
  if (node.modelMode !== "explicit" || !node.model) {
    return null;
  }
  const provider = app?.provider || defaultModel.provider || "default";
  return {
    provider,
    model: node.model,
    source: "explicit",
    label: `显式模型 · ${provider} / ${node.model}`,
  };
}

function resolveAppModel(app: AppDefinition | null): EffectiveAutomationModel | null {
  if (!app?.model) {
    return null;
  }
  return {
    provider: app.provider,
    model: app.model,
    source: "app",
    label: `应用模型 · ${app.provider} / ${app.model}`,
  };
}

function resolveDefaultModel(
  app: AppDefinition | null,
  defaultModel: ReturnType<typeof readLlmProviderConfig>,
): EffectiveAutomationModel | null {
  if (!app) {
    return null;
  }
  const provider = defaultModel.provider || app.provider || "default";
  const model = defaultModel.model || "未配置";
  return {
    provider,
    model,
    source: "default",
    label: `跟随默认模型 · ${provider} / ${model}`,
  };
}

function resolveMissingModel(): EffectiveAutomationModel {
  return {
    provider: "",
    model: "",
    source: "none",
    label: "",
  };
}

function uniqueApps(
  nodes: AutomationWorkspaceNode[],
): Array<Pick<AppDefinition, "id" | "name" | "workflow" | "prompt" | "provider" | "model">> {
  const seen = new Set<string>();
  const result: Array<Pick<AppDefinition, "id" | "name" | "workflow" | "prompt" | "provider" | "model">> = [];
  for (const node of nodes) {
    if (!node.app || seen.has(node.app.id)) {
      continue;
    }
    seen.add(node.app.id);
    result.push(node.app);
  }
  return result;
}

function createDerivedAutomationFromApp(app: AppDefinition): WorkspaceAutomation {
  const id = `${DERIVED_AUTOMATION_PREFIX}${app.id}`;
  const summary = summarizeAutomationPurpose(app);
  return createWorkspaceAutomation({
    id,
    name: app.name,
    summary,
    icon: iconForAppMode(app.mode),
    trigger: "message",
    appId: app.id,
    enabled: app.enabled,
    schedule: "",
    webhookPath: "",
    updatedAt: app.updatedAt,
    flow: createDerivedFlow(app, id, summary),
  }, "app");
}

function summarizeAutomationPurpose(app: AppDefinition): string {
  return app.purpose.trim() || `查看 ${app.name} 的自动化工作流。`;
}

function iconForAppMode(mode: AppDefinition["mode"]): string {
  switch (mode) {
    case "workflow":
      return "git-branch";
    case "knowledge":
      return "book-open";
    case "hybrid":
      return "sparkles";
    default:
      return "bot";
  }
}

function createDerivedFlow(app: AppDefinition, automationId: string, summary: string): AutomationFlow {
  const triggerId = `trigger-${automationId}`;
  const workflowSteps = parseWorkflowSteps(app);
  const nodes: AutomationFlowNode[] = [
    {
      id: triggerId,
      type: "trigger",
      title: triggerTitleForApp(app),
      description: summary,
      modelMode: "default",
    },
    ...workflowSteps.map((step, index) => createDerivedActionNode(app, automationId, step, index)),
  ];
  return {
    nodes,
    edges: createDerivedEdges(nodes),
    branches: [],
  };
}

function parseWorkflowSteps(app: AppDefinition): string[] {
  const steps = normalizeMultilineText(app.workflow)
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean);
  return steps.length > 0 ? steps : [`执行 ${app.name}`];
}

function triggerTitleForApp(app: AppDefinition): string {
  return app.mode === "workflow" ? "工作流触发" : "调用应用时触发";
}

function createDerivedActionNode(
  app: AppDefinition,
  automationId: string,
  step: string,
  index: number,
): AutomationFlowNode {
  return {
    id: `action-${automationId}-${index + 1}`,
    type: "action",
    title: step,
    description: describeDerivedAction(app, index),
    appId: app.id,
    modelMode: "default",
  };
}

function describeDerivedAction(app: AppDefinition, index: number): string {
  if (index === 0 && app.prompt.trim()) {
    return `应用 ${app.name} · ${summarizePrompt(app.prompt)}`;
  }
  return `应用 ${app.name} 的内置工作流步骤。`;
}

function summarizePrompt(prompt: string): string {
  const normalized = normalizeMultilineText(prompt).replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function normalizeMultilineText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function createDerivedEdges(nodes: AutomationFlowNode[]): AutomationFlowEdge[] {
  const edges: AutomationFlowEdge[] = [];
  for (let index = 1; index < nodes.length; index += 1) {
    const source = nodes[index - 1];
    const target = nodes[index];
    if (!source || !target) {
      continue;
    }
    edges.push({
      id: `edge-${source.id}-${target.id}`,
      source: source.id,
      target: target.id,
    });
  }
  return edges;
}
