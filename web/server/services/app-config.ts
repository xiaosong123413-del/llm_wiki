import fs from "node:fs";
import path from "node:path";

const APP_CONFIG_PATH = path.join("agents", "agents.json");
const TASK_PLAN_ASSISTANT_ID = "task-plan-assistant";
const TASK_PLAN_ASSISTANT_NAME = "任务计划助手";
const TASK_PLAN_ASSISTANT_PURPOSE = "处理任务计划页的语音整理、排期生成、微调落盘与执行确认";
const TASK_PLAN_ASSISTANT_WORKFLOW = "读取任务计划页状态\n读取最近语音输入、任务池和工作日志上下文\n输出严格 JSON 计划结果\n在人工微调后只做结构校正，不改变用户意图";
const TASK_PLAN_ASSISTANT_PROMPT = "你是任务计划页专用助手。你的输出必须是严格 JSON，不要输出 Markdown，不要补充解释，不要虚构缺失上下文。";

type AppMode = "chat" | "workflow" | "knowledge" | "hybrid";

export interface AppDefinition {
  id: string;
  name: string;
  mode: AppMode;
  purpose: string;
  provider: string;
  accountRef: string;
  model: string;
  workflow: string;
  prompt: string;
  enabled: boolean;
  updatedAt: string;
}

export interface AppConfig {
  apps: AppDefinition[];
  defaultAppId: string | null;
}

export interface AppConfigInput {
  apps?: unknown;
  defaultAppId?: unknown;
  agents?: unknown;
  activeAgentId?: unknown;
}

export function readAppConfig(projectRoot: string): AppConfig {
  ensureAppConfig(projectRoot);
  const raw = fs.readFileSync(getAppConfigPath(projectRoot), "utf8").replace(/^\uFEFF/, "");
  return normalizeAppConfig(JSON.parse(raw));
}

export function saveAppConfig(projectRoot: string, input: AppConfigInput): AppConfig {
  const config = normalizeAppConfig(input);
  const configPath = getAppConfigPath(projectRoot);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function getAppConfigRelativePath(): string {
  return APP_CONFIG_PATH.split(path.sep).join("/");
}

function ensureAppConfig(projectRoot: string): void {
  const configPath = getAppConfigPath(projectRoot);
  if (fs.existsSync(configPath)) {
    return;
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(createDefaultAppConfig(), null, 2)}\n`, "utf8");
}

function getAppConfigPath(projectRoot: string): string {
  return path.join(projectRoot, APP_CONFIG_PATH);
}

function createDefaultAppConfig(): AppConfig {
  const now = new Date().toISOString();
  return {
    defaultAppId: "wiki-general",
    apps: [
      {
        id: "wiki-general",
        name: "Wiki 通用助手",
        mode: "chat",
        purpose: "处理 Wiki 页面、资料整理、代码与文件任务",
        provider: "openai",
        accountRef: "",
        model: "",
        workflow: "理解当前页面或任务\n读取必要上下文\n给出方案或直接执行可确认的修改\n回写结果并说明验证方式",
        prompt: "你是 LLM Wiki 的通用工作助手。优先读取当前仓库和当前 Wiki 上下文，保持修改范围清晰，输出可验证的结果。",
        enabled: true,
        updatedAt: now,
      },
      {
        ...createTaskPlanAssistantApp(null),
        updatedAt: now,
      },
      {
        id: "xhs-decision-note",
        name: "小红书决策笔记助手",
        mode: "chat",
        purpose: "把小红书图文、视频转录和用户备注重写成可行动的决策笔记",
        provider: "cloudflare",
        accountRef: "",
        model: "",
        workflow: "读取当前项目上下文\n读取原帖标题、正文、标签、视频转录和用户备注\n判断这条内容和当前目标的关系\n输出严格 JSON，不写 Markdown\n控制外层摘要不超过 6 行",
        prompt: "你是小红书决策笔记助手。你的任务不是复述原帖，而是结合用户当前在做什么、想做什么，把帖子提炼成一条可判断、可行动、可归档的决策笔记。输出必须是 JSON：{\"insightTitle\":\"一句话核心洞察\",\"shortTitle\":\"15字内文件名标题\",\"summaryLines\":[\"最多6行外层摘要\"],\"decisionNote\":\"折叠块中的决策笔记正文\"}。不要输出 Markdown，不要输出解释。",
        enabled: true,
        updatedAt: now,
      },
    ],
  };
}

function normalizeAppConfig(input: unknown): AppConfig {
  const record = isRecord(input) ? input : {};
  const normalizedApps = readRawApps(record)
    .map((app, index) => normalizeApp(app, index))
    .filter((app): app is AppDefinition => app !== null);
  const preferredDefaultAppId = resolveDefaultAppId(record, normalizedApps);
  const apps = ensureTaskPlanAssistant(normalizedApps, preferredDefaultAppId);
  return {
    apps,
    defaultAppId: resolveDefaultAppId(record, apps),
  };
}

function normalizeApp(input: unknown, index: number): AppDefinition | null {
  if (!isRecord(input)) return null;
  const name = normalizeText(input.name);
  if (!name) return null;
  return createNormalizedApp(input, name, index);
}

function readRawApps(record: Record<string, unknown>): unknown[] {
  if (Array.isArray(record.apps)) return record.apps;
  if (Array.isArray(record.agents)) return record.agents;
  return [];
}

function resolveDefaultAppId(record: Record<string, unknown>, apps: AppDefinition[]): string | null {
  const preferredId = normalizeText(record.defaultAppId) ?? normalizeText(record.activeAgentId);
  if (preferredId && apps.some((app) => app.id === preferredId)) {
    return preferredId;
  }
  return apps.find((app) => app.enabled)?.id ?? apps[0]?.id ?? null;
}

function createNormalizedApp(input: Record<string, unknown>, name: string, index: number): AppDefinition {
  const now = new Date().toISOString();
  return {
    id: normalizeId(input.id) ?? createAppId(name, index),
    name,
    mode: normalizeMode(input.mode),
    purpose: normalizeText(input.purpose) ?? "",
    provider: normalizeText(input.provider) ?? "openai",
    accountRef: normalizeText(input.accountRef) ?? "",
    model: normalizeText(input.model) ?? "",
    workflow: normalizeText(input.workflow) ?? "",
    prompt: normalizeText(input.prompt) ?? "",
    enabled: input.enabled === true,
    updatedAt: normalizeText(input.updatedAt) ?? now,
  };
}

function ensureTaskPlanAssistant(
  apps: readonly AppDefinition[],
  preferredDefaultAppId: string | null,
): AppDefinition[] {
  if (apps.some((app) => app.id === TASK_PLAN_ASSISTANT_ID)) {
    return [...apps];
  }
  const fallbackApp = resolveTaskPlanAssistantFallbackApp(apps, preferredDefaultAppId);
  return [...apps, createTaskPlanAssistantApp(fallbackApp)];
}

function resolveTaskPlanAssistantFallbackApp(
  apps: readonly AppDefinition[],
  preferredDefaultAppId: string | null,
): AppDefinition | null {
  if (preferredDefaultAppId) {
    const preferredApp = apps.find((app) => app.id === preferredDefaultAppId);
    if (preferredApp) {
      return preferredApp;
    }
  }
  return apps.find((app) => app.enabled) ?? apps[0] ?? null;
}

function createTaskPlanAssistantApp(source: AppDefinition | null): AppDefinition {
  return {
    id: TASK_PLAN_ASSISTANT_ID,
    name: TASK_PLAN_ASSISTANT_NAME,
    mode: "chat",
    purpose: TASK_PLAN_ASSISTANT_PURPOSE,
    provider: source?.provider ?? "openai",
    accountRef: source?.accountRef ?? "",
    model: "",
    workflow: TASK_PLAN_ASSISTANT_WORKFLOW,
    prompt: TASK_PLAN_ASSISTANT_PROMPT,
    enabled: true,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMode(input: unknown): AppMode {
  return input === "workflow" || input === "knowledge" || input === "hybrid" ? input : "chat";
}

function normalizeId(input: unknown): string | null {
  const text = normalizeText(input);
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || null;
}

function createAppId(name: string, index: number): string {
  const base = normalizeId(name) ?? "app";
  return `${base}-${index + 1}`;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
