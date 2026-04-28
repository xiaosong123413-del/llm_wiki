import { attachResizeHandle } from "../../shell/resize-handle.js";
import { renderIcon } from "../../components/icon.js";
import { hydrateAppPublishSection, renderAppPublishSection } from "../publish/index.js";
import {
  bindCLIProxyControls,
  fetchCLIProxyAccountModels,
  fetchCLIProxyOAuthAccounts,
  formatCLIProxyProvider,
  renderCLIProxyPanel,
  type CLIProxyOAuthAccountResponse,
} from "./cli-proxy.js";
import { readSettingsJsonPayload } from "./json.js";
import {
  bindNetworkSearchPanel,
  renderEmbeddingPanel,
  renderNetworkSearchPanel,
  renderPluginsPanel,
} from "./network-search.js";
import {
  buildLlmDefaultAccountOptions,
  buildXiaohongshuImportDirState,
  buildXiaohongshuImportState,
  buildDouyinCookieSnapshot,
  buildXiaohongshuProgressSnapshot,
  describeLlmAccountRowView,
  describeLlmProviderStatus,
  describeLlmDefaultSelection,
  describeXhsSyncStatus,
  resolveRenderedLlmDefaultOptions,
} from "./state-helpers.js";

const DEFAULT_FLASH_DIARY_SHORTCUT = "CommandOrControl+Shift+J";
const SETTINGS_SIDEBAR_WIDTH_KEY = "llm-wiki-settings-sidebar-width";

interface LlmProviderConfigResponse {
  accountRef?: string;
  provider: string;
  url: string;
  keyConfigured: boolean;
  model: string;
}

interface LlmApiAccountResponse {
  id: string;
  name: string;
  provider: string;
  url: string;
  keyConfigured: boolean;
  model: string;
  enabled: boolean;
  updatedAt: string;
}

interface LlmApiAccountsResponse {
  accounts: LlmApiAccountResponse[];
}

interface LlmProviderTestResponse {
  ok: boolean;
  provider: string;
  endpoint: string;
  message: string;
}

interface AppConfigResponse {
  apps: AppDefinitionResponse[];
  defaultAppId: string | null;
  path?: string;
}

interface AppDefinitionResponse {
  id: string;
  name: string;
  mode: "chat" | "workflow" | "knowledge" | "hybrid";
  purpose: string;
  provider: string;
  accountRef: string;
  model: string;
  workflow: string;
  prompt: string;
  enabled: boolean;
  updatedAt: string;
}

interface AutomationConfigResponse {
  automations: AutomationDefinitionResponse[];
  path?: string;
}

interface AutomationFlowNodeResponse {
  id: string;
  type: "trigger" | "action" | "branch" | "merge";
  title: string;
  description: string;
  appId?: string;
  modelMode: "explicit" | "default";
  model?: string;
}

interface AutomationFlowEdgeResponse {
  id: string;
  source: string;
  target: string;
}

interface AutomationFlowBranchResponse {
  id: string;
  title: string;
  sourceNodeId: string;
  mergeNodeId?: string;
  nodeIds: string[];
}

interface AutomationDefinitionResponse {
  id: string;
  name: string;
  summary: string;
  icon: string;
  trigger: "schedule" | "webhook" | "message";
  appId: string;
  enabled: boolean;
  schedule: string;
  webhookPath: string;
  updatedAt: string;
  flow: {
    nodes: AutomationFlowNodeResponse[];
    edges: AutomationFlowEdgeResponse[];
    branches: AutomationFlowBranchResponse[];
  };
}

interface AgentAccountOption {
  value: string;
  label: string;
  provider: string;
  model?: string;
  source?: "default" | "api" | "oauth";
  accountName?: string;
}

interface YtDlpStatusResponse {
  installed: boolean;
  source: "project" | "path" | "missing";
  path?: string;
  version?: string;
  message?: string;
}

interface XhsProgressResponse {
  current: number;
  total: number;
  percent: number;
}

interface XhsSyncStatusResponse {
  latestExtraction: { progress: XhsProgressResponse } | null;
  failures: Array<{ id: string; error: string }>;
}

interface XhsActionResponse {
  status: string;
  path?: string;
  progress?: XhsProgressResponse;
  error?: string;
}

interface XhsFavoritesSyncResponse extends XhsActionResponse {
  scanned: number;
  skipped: number;
  queued: number;
  message: string;
}

type ImportSource =
  | "xiaohongshu"
  | "wechat"
  | "douyin"
  | "bilibili"
  | "xiaoyuzhou"
  | "rss"
  | "x";

interface SyncRepoState {
  targetRepoPath: string;
  sourceRepoPaths: string[];
}

interface XiaohongshuImportState {
  cookie: string;
  importDirPath?: string;
  progress: number;
  status: "idle" | "saving" | "queued" | "importing" | "success" | "error";
  message?: string;
  taskId?: string;
}

interface DouyinCookieState {
  cookie: string;
  status: "idle" | "saving" | "success" | "error";
  message?: string;
  hasCookie?: boolean;
  path?: string;
}

interface SyncConfigResponse {
  targetRepoPath: string;
  sourceRepoPaths: string[];
}

interface XiaohongshuImportProgressResponse {
  taskId: string | null;
  progress: number;
  status: "idle" | "queued" | "importing" | "success" | "error";
  message: string;
  hasCookie: boolean;
  importDirPath: string;
}

interface XiaohongshuImportConfigResponse {
  importDirPath: string;
}

interface DouyinCookieStatusResponse {
  hasCookie: boolean;
  path: string;
}

type RunKind = "check" | "sync";
type RunStatus = "running" | "succeeded" | "failed" | "stopped";

interface RunLine {
  at: string;
  source: "stdout" | "stderr" | "system";
  text: string;
}

interface RunSnapshot {
  id: string;
  kind: RunKind;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  lines: RunLine[];
}

interface RunResponse {
  success?: boolean;
  data?: RunSnapshot | null;
  error?: string;
}

type SettingsSection =
  | "llm"
  | "app-config"
  | "automation"
  | "workspace-sync"
  | "network-search"
  | "embedding"
  | "plugins"
  | "shortcuts"
  | "project-log";

const SETTINGS_SECTION_VALUES = new Set<SettingsSection>([
  "llm",
  "app-config",
  "automation",
  "workspace-sync",
  "network-search",
  "embedding",
  "plugins",
  "shortcuts",
  "project-log",
]);

interface ProviderDefinition {
  id: string;
  name: string;
  endpoint: string;
  note: string;
}

const PROVIDERS: readonly ProviderDefinition[] = [
  { id: "anthropic", name: "Anthropic (Claude)", endpoint: "https://api.anthropic.com", note: "Official Claude API" },
  { id: "openai", name: "OpenAI (GPT)", endpoint: "https://api.openai.com/v1", note: "Official OpenAI API" },
  { id: "gemini", name: "Google (Gemini)", endpoint: "https://generativelanguage.googleapis.com", note: "Generative Language API" },
  { id: "deepseek", name: "DeepSeek", endpoint: "https://api.deepseek.com/v1", note: "DeepSeek API" },
  { id: "groq", name: "Groq", endpoint: "https://api.groq.com/openai/v1", note: "Groq API" },
  { id: "xai", name: "xAI (Grok)", endpoint: "https://api.x.ai/v1", note: "xAI API" },
  { id: "kimi-global", name: "Kimi (Moonshot)", endpoint: "https://api.moonshot.ai/v1", note: "Moonshot Global" },
  { id: "kimi-cn", name: "Kimi (Moonshot, \u4e2d\u56fd)", endpoint: "https://api.moonshot.cn/v1", note: "Moonshot China" },
  { id: "glm", name: "\u667a\u8c31 GLM (Zhipu)", endpoint: "https://open.bigmodel.cn/api/paas/v4", note: "Zhipu AI" },
  { id: "minimax", name: "MiniMax", endpoint: "https://api.minimax.chat/v1", note: "MiniMax API" },
  { id: "ollama", name: "Ollama", endpoint: "http://localhost:11434/v1", note: "\u672c\u5730\u6a21\u578b" },
  { id: "custom", name: "\u81ea\u5b9a\u4e49 OpenAI-compatible", endpoint: "custom endpoint", note: "\u517c\u5bb9 /v1/chat/completions" },
  { id: "relay", name: "\u4e2d\u8f6c\u7ad9 API", endpoint: "OpenAI-compatible relay", note: "\u652f\u6301\u4f59\u989d\u67e5\u8be2\u63a5\u53e3" },
  { id: "codex-cli", name: "Codex CLI", endpoint: "local executable", note: "\u8bfb\u53d6\u672c\u673a Codex CLI \u767b\u5f55\u548c\u4f59\u989d\u72b6\u6001" },
];

const MODEL_OPTIONS_BY_PROVIDER: Readonly<Record<string, readonly string[]>> = {
  anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-sonnet-latest"],
  openai: ["gpt-5-codex", "gpt-4o", "gpt-4.1", "o4-mini"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-exp"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  groq: ["llama-3.3-70b-versatile", "qwen-qwq-32b", "deepseek-r1-distill-llama-70b"],
  xai: ["grok-4", "grok-3", "grok-3-mini"],
  "kimi-global": ["kimi-k2-0711-preview", "moonshot-v1-8k", "moonshot-v1-32k"],
  "kimi-cn": ["kimi-k2-0711-preview", "moonshot-v1-8k", "moonshot-v1-32k"],
  glm: ["glm-4.5", "glm-4.5-air", "glm-4.1v-thinking-flash"],
  minimax: ["MiniMax-M2.7", "MiniMax-Text-01"],
  ollama: ["llama3.1", "qwen2.5", "deepseek-r1:latest"],
  relay: ["gpt-5-codex", "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.5-pro"],
  custom: ["gpt-5-codex", "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.5-pro"],
  "codex-cli": ["gpt-5-codex", "gpt-4.1", "o4-mini"],
};

const IMPORT_SOURCE_DEFINITIONS: ReadonlyArray<{
  id: ImportSource;
  name: string;
  description: string;
  badge: string;
  badgeClass: string;
}> = [
  { id: "xiaohongshu", name: "小红书", description: "导入小红书笔记数据", badge: "红", badgeClass: "is-red" },
  { id: "wechat", name: "微信聊天记录", description: "导入微信聊天记录", badge: "微", badgeClass: "is-green" },
  { id: "douyin", name: "抖音", description: "导入抖音作品数据", badge: "抖", badgeClass: "is-dark" },
  { id: "bilibili", name: "b站", description: "导入 B 站视频数据", badge: "B", badgeClass: "is-blue" },
  { id: "xiaoyuzhou", name: "小宇宙", description: "导入小宇宙播客数据", badge: "宙", badgeClass: "is-orange" },
  { id: "rss", name: "RSS", description: "导入 RSS 订阅内容", badge: "R", badgeClass: "is-purple" },
  { id: "x", name: "X (Twitter)", description: "导入 X 平台内容", badge: "X", badgeClass: "is-black" },
];

const appConfigState = new WeakMap<HTMLElement, AppConfigResponse>();
const agentAccountOptionsState = new WeakMap<HTMLElement, AgentAccountOption[]>();
const automationConfigState = new WeakMap<HTMLElement, AutomationConfigResponse>();
const llmConfigState = new WeakMap<HTMLElement, LlmProviderConfigResponse>();
const llmDefaultAccountOptionsState = new WeakMap<HTMLElement, AgentAccountOption[]>();
const llmAccountsState = new WeakMap<HTMLElement, LlmApiAccountResponse[]>();
const workspaceSyncState = new WeakMap<HTMLElement, SyncRepoState>();
const xiaohongshuImportState = new WeakMap<HTMLElement, XiaohongshuImportState>();
const xiaohongshuImportPollers = new WeakMap<HTMLElement, number>();
const douyinCookieState = new WeakMap<HTMLElement, DouyinCookieState>();

type XiaohongshuProgressDraft = Parameters<typeof buildXiaohongshuProgressSnapshot>[1];
type DouyinCookieDraft = Parameters<typeof buildDouyinCookieSnapshot>[1];

interface SuccessDataPayload<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setOptionalText(element: HTMLElement | null, text: string): void {
  if (element) {
    element.textContent = text;
  }
}

function readRequiredControlValue(
  control: HTMLInputElement | HTMLSelectElement | null,
  errorMessage: string,
): string {
  const value = control?.value.trim() ?? "";
  if (!value) {
    throw new Error(errorMessage);
  }
  return value;
}

async function readSuccessData<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const payload = await readJsonPayload<SuccessDataPayload<T>>(response);
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? fallbackMessage);
  }
  return payload.data;
}

async function loadOptionalCliProxyOAuthAccounts(): Promise<readonly CLIProxyOAuthAccountResponse[]> {
  try {
    return await fetchCLIProxyOAuthAccounts(false);
  } catch {
    return [];
  }
}

function buildXiaohongshuImportDirState(
  state: XiaohongshuImportState | undefined,
  importDirPath: string,
): XiaohongshuImportState {
  return {
    cookie: state?.cookie ?? "",
    importDirPath,
    progress: state?.progress ?? 0,
    status: state?.status ?? "idle",
    message: state?.message,
    taskId: state?.taskId,
  };
}

function applyXiaohongshuImportDir(root: HTMLElement, importDirPath: string): void {
  const input = root.querySelector<HTMLInputElement>("[data-xhs-import-dir-input]");
  if (input) {
    input.value = importDirPath;
  }
  xiaohongshuImportState.set(
    root,
    buildXiaohongshuImportDirState(xiaohongshuImportState.get(root), importDirPath),
  );
}

function renderXiaohongshuImportProgressFields(
  root: HTMLElement,
  progress: XiaohongshuImportProgressResponse,
  nextImportDirPath: string,
): void {
  const percent = root.querySelector<HTMLElement>("[data-xhs-import-percent]");
  const bar = root.querySelector<HTMLElement>("[data-xhs-import-progress]");
  const status = root.querySelector<HTMLElement>("[data-xhs-import-status]");
  const importDirInput = root.querySelector<HTMLInputElement>("[data-xhs-import-dir-input]");
  setOptionalText(percent, `${progress.progress}%`);
  if (bar) {
    bar.style.width = `${progress.progress}%`;
  }
  setOptionalText(status, progress.message);
  if (importDirInput && nextImportDirPath && importDirInput.value !== nextImportDirPath) {
    importDirInput.value = nextImportDirPath;
  }
}

function buildXiaohongshuImportState(
  state: XiaohongshuImportState | undefined,
  progress: XiaohongshuImportProgressResponse,
): { nextImportDirPath: string; nextState: XiaohongshuImportState } {
  const nextImportDirPath = progress.importDirPath || state?.importDirPath || "";
  return {
    nextImportDirPath,
    nextState: {
      cookie: state?.cookie ?? "",
      importDirPath: nextImportDirPath,
      progress: progress.progress,
      status: progress.status,
      message: progress.message,
      taskId: progress.taskId ?? undefined,
    },
  };
}

function describeXhsSyncStatus(failureCount: number): string {
  return failureCount > 0
    ? `有 ${failureCount} 条小红书同步问题，已写入审查页。`
    : "小红书同步状态正常。";
}

function readSelectedLlmDefaultAccount(root: HTMLElement): string {
  return readRequiredControlValue(
    root.querySelector<HTMLSelectElement>("[data-llm-default-account]"),
    "请先从已有 OAuth 或 API 账号里选择默认模型。",
  );
}

export function renderSettingsPage(initialSection?: string): HTMLElement {
  const activeSection = normalizeSettingsSection(initialSection);
  const root = document.createElement("section");
  root.className = "settings-page settings-page--with-sidebar";
  root.innerHTML = `
    <aside class="settings-sidebar" data-settings-sidebar>
      <div class="settings-sidebar__header">
        <div class="eyebrow">SETTINGS</div>
        <h2 class="settings-page__title">&#x8bbe;&#x7f6e;</h2>
      </div>
        <nav class="settings-sidebar__nav">
        ${renderSettingsNavItem("llm", "LLM &#x5927;&#x6a21;&#x578b;")}
        ${renderSettingsNavItem("app-config", "&#x5e94;&#x7528;")}
        ${renderSettingsNavItem("automation", "&#x81ea;&#x52a8;&#x5316;")}
        ${renderSettingsNavItem("workspace-sync", "&#x4ed3;&#x5e93;&#x4e0e;&#x540c;&#x6b65;")}
        ${renderSettingsNavItem("network-search", "&#x7f51;&#x7edc;&#x641c;&#x7d22;")}
        ${renderSettingsNavItem("embedding", "Vector Search / Embedding")}
        ${renderSettingsNavItem("plugins", "&#x63d2;&#x4ef6; / MCP")}
        ${renderSettingsNavItem("shortcuts", "&#x5feb;&#x6377;&#x952e;")}
        ${renderSettingsNavItem("project-log", "&#x9879;&#x76ee;&#x65e5;&#x5fd7;")}
      </nav>
    </aside>
    <div class="settings-sidebar-resize panel-resize-handle" data-settings-sidebar-resize></div>
      <main class="settings-content">
        ${renderLlmPanel()}
        ${renderAgentConfigPanel()}
        ${renderAutomationPanel()}
        ${renderWorkspaceSyncPanel()}
      ${renderNetworkSearchPanel()}
      ${renderEmbeddingPanel()}
      ${renderPluginsPanel()}
      ${renderShortcutSection()}
      ${renderProjectLogSection()}
      <p class="settings-page__status" data-settings-status></p>
    </main>
  `;
  root.querySelector<HTMLElement>("[data-settings-panel=\"app-config\"]")?.appendChild(renderAppPublishSection());
  bindSettingsPage(root, activeSection);
  return root;
}

function renderSettingsNavItem(section: SettingsSection, label: string): string {
  return `<button type="button" class="settings-sidebar__item" data-settings-nav="${section}" data-settings-section="${section}" data-active="false">${label}</button>`;
}

function renderLlmPanel(): string {
  return `
    <section class="settings-panel" data-settings-panel="llm">
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">LLM PROVIDERS</div>
          <h1 class="settings-page__title">LLM &#x5927;&#x6a21;&#x578b;</h1>
          <p>&#x6bcf;&#x4e2a;&#x5382;&#x5546;&#x53ef;&#x4ee5;&#x914d;&#x7f6e;&#x591a;&#x4e2a;&#x8d26;&#x6237;&#xff0c;&#x6253;&#x5f00;&#x5f00;&#x5173;&#x540e;&#x4f5c;&#x4e3a;&#x53ef;&#x7528 provider&#x3002;</p>
          <p class="settings-page__status" data-llm-config-status>&#x6b63;&#x5728;&#x8bfb;&#x53d6; LLM &#x914d;&#x7f6e;...</p>
        </div>
        <button type="button" class="btn btn-primary" data-settings-save>&#x4fdd;&#x5b58;&#x914d;&#x7f6e;</button>
      </div>
      <div class="settings-llm-overview">
        ${renderLlmDefaultCard()}
        ${renderLlmAccountSummaryCard()}
      </div>
      ${renderCLIProxyPanel()}
      <div class="settings-provider-list">
        ${PROVIDERS.map(renderLlmProvider).join("")}
      </div>
    </section>
  `;
}

function renderLlmDefaultCard(): string {
  return `
    <article class="settings-card settings-card--llm-default" data-llm-default-card>
      <div class="settings-card__header">
        <div>
          <div class="eyebrow">DEFAULT MODEL</div>
          <h2>默认模型</h2>
          <p class="settings-card__hint">只从已有 API 或 OAuth 账号里选择默认运行来源。</p>
        </div>
      </div>
      <div class="settings-card__body">
        <label class="settings-field">
          <span>默认账号来源</span>
          <select data-llm-default-account>
            <option value="">暂无可用账号</option>
          </select>
        </label>
        <div class="settings-llm-default-meta">
          <div class="settings-llm-default-meta__item">
            <span>来源</span>
            <strong data-llm-default-source>暂无可用账号</strong>
          </div>
          <div class="settings-llm-default-meta__item">
            <span>Provider</span>
            <strong data-llm-default-provider>--</strong>
          </div>
          <div class="settings-llm-default-meta__item">
            <span>模型</span>
            <strong data-llm-default-model>--</strong>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderLlmAccountSummaryCard(): string {
  return `
    <article class="settings-card settings-card--llm-accounts" data-llm-account-summary-card>
      <div class="settings-card__header">
        <div>
          <div class="eyebrow">ACCOUNT POOL</div>
          <h2>已有 OAuth 和 API</h2>
          <p class="settings-card__hint">这里只显示当前可用的账号来源，不展示密钥和技术细节。</p>
        </div>
      </div>
      <div class="settings-card__body">
        <div class="settings-llm-account-summary" data-llm-account-summary-list>
          <span class="settings-source-empty">暂无可用账号</span>
        </div>
      </div>
    </article>
  `;
}

function renderLlmProvider(provider: ProviderDefinition): string {
  const relayStats = provider.id === "relay"
    ? `
      <div class="settings-provider-balance">
        <div class="settings-provider-balance__tile" data-relay-balance-current><span>&#x5f53;&#x524d;&#x4f59;&#x989d;</span><strong>--</strong></div>
        <div class="settings-provider-balance__tile" data-relay-balance-used><span>&#x5386;&#x53f2;&#x6d88;&#x8017;</span><strong>--</strong></div>
        <button type="button" class="btn btn-secondary btn-inline" data-relay-balance-refresh>&#x5237;&#x65b0;&#x4f59;&#x989d;</button>
      </div>
      <label class="settings-field"><span>&#x4f59;&#x989d;&#x67e5;&#x8be2; URL</span><input data-provider="${provider.id}:balanceUrl" type="text" /></label>
      <label class="settings-field"><span>&#x4f59;&#x989d;&#x5b57;&#x6bb5;&#x8def;&#x5f84;</span><input data-provider="${provider.id}:balancePath" type="text" placeholder="data.balance" /></label>
      <label class="settings-field"><span>&#x6d88;&#x8017;&#x5b57;&#x6bb5;&#x8def;&#x5f84;</span><input data-provider="${provider.id}:usedPath" type="text" placeholder="data.used" /></label>
    `
    : "";
  const codexStats = provider.id === "codex-cli"
    ? `
      <div class="settings-provider-balance">
        <div class="settings-provider-balance__tile" data-codex-cli-balance><span>Codex CLI &#x4f59;&#x989d;</span><strong>CLI &#x672a;&#x68c0;&#x6d4b;</strong></div>
        <div class="settings-provider-balance__tile"><span>CLI &#x72b6;&#x6001;</span><strong data-codex-cli-status>&#x672a;&#x68c0;&#x6d4b;</strong></div>
        <button type="button" class="btn btn-secondary btn-inline" data-codex-cli-refresh>&#x5237;&#x65b0;</button>
      </div>
    `
    : "";
  return `
    <article class="settings-provider-card" data-llm-provider="${provider.id}">
      <button type="button" class="settings-provider-card__summary" data-provider-toggle="${provider.id}">
        <span class="settings-provider-card__chevron">›</span>
        <span class="settings-provider-card__copy">
          <strong>${escapeHtml(provider.name)}</strong>
          <small>${escapeHtml(provider.note)} · ${escapeHtml(provider.endpoint)}</small>
        </span>
        <span class="settings-switch" data-provider-enabled="${provider.id}" role="switch" aria-checked="false"></span>
      </button>
      <div class="settings-provider-card__body" data-provider-body="${provider.id}" hidden>
        <div class="settings-provider-account-list" data-llm-account-list="${provider.id}">
        <div class="settings-account-row" data-llm-account="${provider.id}">
          <label class="settings-field"><span>&#x8d26;&#x6237;&#x540d;</span><input data-provider="${provider.id}:name" type="text" /></label>
          <label class="settings-field"><span>&#x5730;&#x5740;</span><input data-provider="${provider.id}:url" type="text" value="${escapeHtml(provider.endpoint)}" /></label>
          <label class="settings-field"><span>&#x5bc6;&#x94a5;</span><input data-provider="${provider.id}:key" type="password" /></label>
          <label class="settings-field"><span>&#x6a21;&#x578b;</span><select data-provider="${provider.id}:model">${renderModelOptions(provider.id)}</select></label>
          <button type="button" class="btn btn-secondary btn-inline" data-llm-account-test>&#x9a8c;&#x8bc1;</button>
          <button type="button" class="btn btn-primary btn-inline" data-llm-account-save>&#x4fdd;&#x5b58;</button>
          <button type="button" class="btn btn-secondary btn-inline" data-llm-account-delete>&#x5220;&#x9664;</button>
          <span class="settings-account-row__status" data-llm-account-status></span>
        </div>
        </div>
        ${relayStats}
        ${codexStats}
        <button type="button" class="btn btn-secondary" data-llm-account-add="${provider.id}">&#x65b0;&#x589e;&#x8d26;&#x6237;</button>
      </div>
    </article>
  `;
}

function renderAgentConfigPanel(): string {
  return `
    <section class="settings-panel" data-settings-panel="app-config" hidden>
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">APPS</div>
          <h1 class="settings-page__title">&#x5e94;&#x7528;</h1>
          <p>&#x5bf9;&#x8bdd;&#x3001;&#x5de5;&#x4f5c;&#x6d41;&#x3001;&#x77e5;&#x8bc6;&#x548c;&#x6df7;&#x5408;&#x5e94;&#x7528;&#x90fd;&#x5728;&#x8fd9;&#x91cc;&#x7edf;&#x4e00;&#x5b9a;&#x4e49;&#xff0c;&#x804a;&#x5929;&#x548c;&#x81ea;&#x52a8;&#x5316;&#x53ea;&#x7ed1;&#x5b9a;&#x5e94;&#x7528;&#xff0c;&#x4e0d;&#x76f4;&#x63a5;&#x9762;&#x5411;&#x6a21;&#x578b;&#x8d26;&#x53f7;&#x3002;</p>
          <p class="settings-page__status" data-agent-config-status>&#x6b63;&#x5728;&#x8bfb;&#x53d6;&#x5e94;&#x7528;&#x914d;&#x7f6e;...</p>
        </div>
        <div class="settings-run-panel__actions">
          <button type="button" class="btn btn-secondary" data-agent-config-add>&#x65b0;&#x589e;&#x5e94;&#x7528;</button>
          <button type="button" class="btn btn-primary" data-agent-config-save>&#x4fdd;&#x5b58;</button>
        </div>
      </div>
      <article class="settings-card settings-card--agent-config">
        <div class="settings-agent-config">
          <aside class="settings-agent-config__list">
              <div class="settings-card__header">
                <div>
                  <div class="eyebrow">APPS</div>
                  <h2>&#x5e94;&#x7528;&#x5217;&#x8868;</h2>
                </div>
              </div>
              <div class="settings-agent-config__items" data-agent-config-list>
                <div class="settings-source-empty">&#x6682;&#x672a;&#x8bfb;&#x53d6;&#x5e94;&#x7528;</div>
              </div>
            </aside>
            <section class="settings-agent-config__editor" data-agent-config-editor>
              <div class="settings-card__header">
                <div>
                  <div class="eyebrow">EDITOR</div>
                  <h2>&#x9009;&#x62e9;&#x5de6;&#x4fa7;&#x5e94;&#x7528;&#x540e;&#x7f16;&#x8f91;</h2>
                </div>
                <button type="button" class="btn btn-secondary btn-inline" data-agent-config-delete>&#x5220;&#x9664;</button>
              </div>
              <div class="settings-agent-config__form">
                <label class="settings-field"><span>App ID</span><input data-agent-config-field="id" type="text" readonly /></label>
                <label class="settings-field"><span>&#x540d;&#x79f0;</span><input data-agent-config-field="name" type="text" /></label>
                <label class="settings-field"><span>&#x5e94;&#x7528;&#x6a21;&#x5f0f;</span><select data-agent-config-field="mode">${renderAppModeOptions()}</select></label>
                <label class="settings-field"><span>&#x53ef;&#x4ee5;&#x89e3;&#x51b3;&#x5565;&#x9700;&#x6c42;</span><input data-agent-config-field="purpose" type="text" /></label>
                <label class="settings-field"><span>&#x63a5;&#x5165;&#x7684;&#x5927;&#x6a21;&#x578b;</span><select data-agent-config-field="provider">${renderAgentProviderOptions()}</select></label>
                <label class="settings-field"><span>账号 / 授权来源</span><select data-agent-config-field="accountRef"><option value="">跟随应用资源默认配置</option></select></label>
                <label class="settings-field"><span>&#x6a21;&#x578b;&#x540d;</span><select data-agent-config-field="model">${renderModelOptions("openai")}</select></label>
                <label class="settings-field settings-field--wide"><span>&#x5de5;&#x4f5c;&#x6d41;</span><textarea data-agent-config-field="workflow" rows="6"></textarea></label>
                <label class="settings-field settings-field--wide"><span>Prompt</span><textarea data-agent-config-field="prompt" rows="8"></textarea></label>
                <label class="settings-check-row"><input data-agent-config-field="enabled" type="checkbox" /> <span>&#x542f;&#x7528;&#x8fd9;&#x4e2a;&#x5e94;&#x7528;</span></label>
              </div>
            </section>
          </div>
        </article>
      </section>
  `;
}

function renderAutomationPanel(): string {
  return `
    <section class="settings-panel" data-settings-panel="automation" hidden>
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">AUTOMATIONS</div>
          <h1 class="settings-page__title">&#x81ea;&#x52a8;&#x5316;</h1>
          <p>&#x5b9a;&#x65f6;&#x3001;Webhook &#x548c;&#x6d88;&#x606f;&#x89e6;&#x53d1;&#x90fd;&#x5728;&#x8fd9;&#x91cc;&#x7edf;&#x4e00;&#x7ed1;&#x5b9a;&#x5e94;&#x7528;&#xff0c;&#x4e0d;&#x76f4;&#x63a5;&#x8dd1;&#x88f8; LLM &#x6216;&#x5e95;&#x5c42;&#x8fd0;&#x884c;&#x5355;&#x5143;&#x3002;</p>
          <p class="settings-page__status" data-automation-config-status>&#x6b63;&#x5728;&#x8bfb;&#x53d6;&#x81ea;&#x52a8;&#x5316;...</p>
        </div>
        <div class="settings-run-panel__actions">
          <button type="button" class="btn btn-secondary" data-automation-config-add>&#x65b0;&#x589e;&#x81ea;&#x52a8;&#x5316;</button>
          <button type="button" class="btn btn-primary" data-automation-config-save>&#x4fdd;&#x5b58;</button>
        </div>
      </div>
      <article class="settings-card settings-card--agent-config">
        <div class="settings-agent-config">
          <aside class="settings-agent-config__list">
            <div class="settings-card__header">
              <div>
                <div class="eyebrow">AUTOMATIONS</div>
                <h2>&#x81ea;&#x52a8;&#x5316;&#x5217;&#x8868;</h2>
              </div>
            </div>
            <div class="settings-agent-config__items" data-automation-config-list>
              <div class="settings-source-empty">&#x6682;&#x672a;&#x8bfb;&#x53d6;&#x81ea;&#x52a8;&#x5316;</div>
            </div>
          </aside>
          <section class="settings-agent-config__editor" data-automation-config-editor>
            <div class="settings-card__header">
              <div>
                <div class="eyebrow">EDITOR</div>
                <h2>&#x9009;&#x62e9;&#x5de6;&#x4fa7;&#x81ea;&#x52a8;&#x5316;&#x540e;&#x7f16;&#x8f91;</h2>
              </div>
              <button type="button" class="btn btn-secondary btn-inline" data-automation-config-delete>&#x5220;&#x9664;</button>
            </div>
            <div class="settings-agent-config__form">
              <label class="settings-field"><span>Automation ID</span><input data-automation-config-field="id" type="text" readonly /></label>
              <label class="settings-field"><span>&#x540d;&#x79f0;</span><input data-automation-config-field="name" type="text" /></label>
              <label class="settings-field"><span>&#x6458;&#x8981;</span><input data-automation-config-field="summary" type="text" /></label>
              <label class="settings-field"><span>&#x56fe;&#x6807;</span><input data-automation-config-field="icon" type="text" placeholder="calendar" /></label>
              <label class="settings-field"><span>&#x89e6;&#x53d1;&#x65b9;&#x5f0f;</span><select data-automation-config-field="trigger">${renderAutomationTriggerOptions()}</select></label>
              <label class="settings-field"><span>&#x76ee;&#x6807;&#x5e94;&#x7528;</span><select data-automation-config-field="appId"><option value="">&#x8bf7;&#x5148;&#x9009;&#x62e9;&#x5e94;&#x7528;</option></select></label>
              <label class="settings-field"><span>&#x5b9a;&#x65f6;&#x8868;&#x8fbe;&#x5f0f;</span><input data-automation-config-field="schedule" type="text" placeholder="0 9 * * *" /></label>
              <label class="settings-field"><span>Webhook Path</span><input data-automation-config-field="webhookPath" type="text" placeholder="/hooks/publish" /></label>
              <label class="settings-check-row"><input data-automation-config-field="enabled" type="checkbox" /> <span>&#x542f;&#x7528;&#x8fd9;&#x6761;&#x81ea;&#x52a8;&#x5316;</span></label>
              <label class="settings-field"><span>Flow JSON</span><textarea data-automation-config-field="flow" rows="12" placeholder='{"nodes":[],"edges":[],"branches":[]}'></textarea></label>
            </div>
          </section>
        </div>
      </article>
    </section>
  `;
}

function renderAgentProviderOptions(): string {
  return PROVIDERS.map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.name)}</option>`).join("");
}

function renderAppModeOptions(): string {
  return [
    { value: "chat", label: "对话" },
    { value: "workflow", label: "工作流" },
    { value: "knowledge", label: "知识" },
    { value: "hybrid", label: "混合" },
  ].map((mode) => `<option value="${mode.value}">${mode.label}</option>`).join("");
}

function renderAutomationTriggerOptions(): string {
  return [
    { value: "schedule", label: "定时" },
    { value: "webhook", label: "Webhook" },
    { value: "message", label: "消息触发" },
  ].map((trigger) => `<option value="${trigger.value}">${trigger.label}</option>`).join("");
}

function renderModelOptions(provider: string, selected = ""): string {
  const models = MODEL_OPTIONS_BY_PROVIDER[provider] ?? [];
  return renderModelOptionsFromList(models, selected);
}

function renderModelOptionsFromList(models: readonly string[], selected = ""): string {
  const values = selected && !models.includes(selected) ? [selected, ...models] : [...models];
  const options = ['<option value="">未指定</option>'];
  for (const model of values) {
    options.push(`<option value="${escapeHtml(model)}"${model === selected ? " selected" : ""}>${escapeHtml(model)}</option>`);
  }
  return options.join("");
}

function renderWorkspaceSyncPanel(): string {
  return `
    <section class="settings-panel" data-settings-panel="workspace-sync" hidden>
      <div class="settings-workspace-sync">
        <section class="settings-sync-section">
          <div class="settings-sync-section__intro">
            <h1>数据导入</h1>
            <p>支持从多种来源导入数据，每个来源将以一个小卡片的形式展示。</p>
          </div>
          <div class="settings-sync-section__panel">
            <div class="settings-sync-section__panel-header">
              <div>
                <h2>1. 选择导入来源</h2>
              </div>
            </div>
            <div class="settings-import-grid">
              ${IMPORT_SOURCE_DEFINITIONS.map(renderImportSourceCard).join("")}
            </div>
          </div>
        </section>
        <section class="settings-sync-section">
          <div class="settings-sync-section__panel settings-sync-section__panel--sync">
            <div class="settings-sync-section__panel-header settings-sync-section__panel-header--actions">
              <div>
                <h2>2. 同步仓库</h2>
                <p>指定目标仓库和源仓库地址，点击地址位置可以直接跳转选择桌面文件夹位置并且支持多选。鼠标移到已经有的地址上面的时候，后面会有删除按钮。</p>
              </div>
              <div class="settings-sync-section__actions">
                <button type="button" class="btn btn-secondary" data-sync-config-refresh>同步仓库设置</button>
                <button type="button" class="btn btn-primary" data-sync-config-save>保存</button>
              </div>
            </div>
            <div class="settings-sync-form">
              <div class="settings-path-row" data-sync-target-row>
                <label class="settings-path-row__label" for="settings-sync-target-input">目标仓库</label>
                <div class="settings-path-row__field">
                  <input id="settings-sync-target-input" data-sync-target-input type="text" placeholder="请选择目标仓库地址" />
                  <button type="button" class="settings-path-row__icon" data-sync-target-pick aria-label="选择目标仓库">${renderIcon("folder-open", { size: 18 })}</button>
                  <button type="button" class="settings-path-row__clear" data-sync-target-clear aria-label="清空目标仓库">删除</button>
                </div>
              </div>
              <div class="settings-path-row settings-path-row--source" data-sync-source-row>
                <label class="settings-path-row__label" for="settings-sync-source-input">源仓库</label>
                <div class="settings-path-row__field">
                  <input id="settings-sync-source-input" data-sync-source-input type="text" placeholder="请选择源仓库地址" />
                  <button type="button" class="settings-path-row__add" data-sync-source-add>添加路径</button>
                  <button type="button" class="settings-path-row__icon" data-sync-source-pick aria-label="选择源仓库">${renderIcon("folder-open", { size: 18 })}</button>
                </div>
              </div>
              <div class="settings-source-paths" data-sync-source-paths></div>
            </div>
          </div>
        </section>
        ${renderXiaohongshuImportModal()}
        ${renderDouyinCookieModal()}
      </div>
    </section>
  `;
}

function renderImportSourceCard(source: {
  id: ImportSource;
  name: string;
  description: string;
  badge: string;
  badgeClass: string;
}): string {
  return `
    <button type="button" class="settings-import-card" data-import-source="${source.id}">
      <span class="settings-import-card__badge ${source.badgeClass}">${escapeHtml(source.badge)}</span>
      <span class="settings-import-card__copy">
        <strong>${escapeHtml(source.name)}</strong>
        <small>${escapeHtml(source.description)}</small>
      </span>
      <span class="settings-import-card__arrow">›</span>
    </button>
  `;
}

function renderXiaohongshuImportModal(): string {
  return `
    <div class="settings-modal" data-xhs-import-modal hidden>
      <button type="button" class="settings-modal__backdrop" data-xhs-import-close aria-label="关闭小红书导入"></button>
      <div class="settings-modal__dialog settings-modal__dialog--xhs" role="dialog" aria-modal="true" aria-labelledby="settings-xhs-import-title">
        <div class="settings-modal__header">
          <h2 id="settings-xhs-import-title">小红书导入</h2>
          <button type="button" class="settings-modal__close" data-xhs-import-close aria-label="关闭">×</button>
        </div>
        <div class="settings-modal__body">
          <div class="settings-xhs-import">
            <label class="settings-field settings-field--wide">
              <span>cookie填写地址</span>
              <div class="settings-xhs-import__cookie-row">
                <textarea data-xhs-cookie-input rows="4" placeholder="请粘贴小红书 Cookie"></textarea>
                <button type="button" class="btn btn-secondary" data-xhs-login-open>打开小红书登录</button>
                <button type="button" class="btn btn-secondary" data-xhs-cookie-import>一键导入小红书 Cookie</button>
                <button type="button" class="btn btn-primary" data-xhs-cookie-save>保存</button>
              </div>
            </label>
            <label class="settings-field settings-field--wide">
              <span>导入文件夹地址</span>
              <div class="settings-xhs-import__path-row">
                <input data-xhs-import-dir-input type="text" placeholder="请选择导入文件夹地址" />
                <button type="button" class="btn btn-secondary" data-xhs-import-dir-pick>选择</button>
                <button type="button" class="btn btn-secondary" data-xhs-import-dir-clear>删除</button>
                <button type="button" class="btn btn-primary" data-xhs-import-dir-save>保存</button>
              </div>
            </label>
            <div class="settings-xhs-import__sync-action">
              <button type="button" class="btn btn-primary" data-xhs-import-sync>一键同步</button>
            </div>
            <div class="settings-xhs-import__progress">
              <div class="settings-xhs-import__progress-row">
                <span>导入进度</span>
                <strong data-xhs-import-percent>0%</strong>
              </div>
              <div class="settings-xhs-import__bar" aria-label="小红书导入进度">
                <span data-xhs-import-progress style="width:0%"></span>
              </div>
              <p data-xhs-import-status>未开始</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDouyinCookieModal(): string {
  return `
    <div class="settings-modal" data-douyin-cookie-modal hidden>
      <button type="button" class="settings-modal__backdrop" data-douyin-cookie-close aria-label="关闭抖音 Cookie 导入"></button>
      <div class="settings-modal__dialog settings-modal__dialog--xhs" role="dialog" aria-modal="true" aria-labelledby="settings-douyin-cookie-title">
        <div class="settings-modal__header">
          <h2 id="settings-douyin-cookie-title">抖音 Cookie 导入</h2>
          <button type="button" class="settings-modal__close" data-douyin-cookie-close aria-label="关闭">×</button>
        </div>
        <div class="settings-modal__body">
          <div class="settings-xhs-import">
            <label class="settings-field settings-field--wide">
              <span>cookie 填写地址</span>
              <div class="settings-xhs-import__cookie-row">
                <textarea data-douyin-cookie-input rows="4" placeholder="请粘贴抖音 Cookie"></textarea>
                <button type="button" class="btn btn-secondary" data-douyin-login-open>打开抖音登录</button>
                <button type="button" class="btn btn-secondary" data-douyin-cookie-import>一键导入抖音 Cookie</button>
                <button type="button" class="btn btn-primary" data-douyin-cookie-save>保存</button>
              </div>
            </label>
            <div class="settings-xhs-import__progress">
              <div class="settings-xhs-import__progress-row">
                <span>项目级 fallback</span>
                <strong data-douyin-cookie-light>未读取</strong>
              </div>
              <p data-douyin-cookie-status>未开始</p>
              <p data-douyin-cookie-path></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderShortcutSection(): string {
  return `
    <section class="settings-panel" data-settings-panel="shortcuts" hidden>
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">SHORTCUTS</div>
          <h1 class="settings-page__title">&#x5feb;&#x6377;&#x952e;</h1>
          <p>&#x5728;&#x8fd9;&#x91cc;&#x7edf;&#x4e00;&#x7ba1;&#x7406; Electron &#x684c;&#x9762;&#x7aef;&#x7684;&#x5feb;&#x6377;&#x952e;&#x3002;</p>
        </div>
      </div>
      ${renderShortcutPanel()}
    </section>
  `;
}

function renderProjectLogSection(): string {
  return `
    <section class="settings-panel" data-settings-panel="project-log" hidden>
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">PROJECT MEMORY</div>
          <h1 class="settings-page__title">&#x9879;&#x76ee;&#x65e5;&#x5fd7;</h1>
          <p>&#x67e5;&#x770b;&#x754c;&#x9762;&#x3001;&#x6d41;&#x7a0b;&#x548c;&#x65f6;&#x95f4;&#x7ebf;&#xff0c;&#x5e76;&#x8fdb;&#x5165;&#x53ef;&#x8bc4;&#x8bba;&#x7684;&#x9879;&#x76ee;&#x65e5;&#x5fd7;&#x9875;&#x3002;</p>
        </div>
      </div>
      ${renderProjectLogCard()}
    </section>
  `;
}

function renderVaultPanel(): string {
  return `
    <article class="settings-card settings-card--vault">
      <div class="settings-card__header"><div><div class="eyebrow">WORKSPACE</div><h2>&#x4ed3;&#x5e93;&#x4e0e;&#x540c;&#x6b65;</h2></div><span class="settings-card__badge">&#x672c;&#x5730;&#x6587;&#x4ef6;</span></div>
      <label class="settings-field"><span>&#x76ee;&#x6807;&#x4ed3;&#x5e93;</span><div class="settings-input-row"><input data-settings-target type="text" /><button type="button" class="btn btn-secondary" data-settings-choose-target>&#x9009;&#x62e9;</button></div></label>
      <div class="settings-field"><span>&#x540c;&#x6b65;&#x6e90;&#x6587;&#x4ef6;&#x5939;</span><div class="settings-source-toolbar"><p>&#x53ef;&#x6dfb;&#x52a0;&#x591a;&#x4e2a;&#x539f;&#x59cb;&#x8d44;&#x6599;&#x76ee;&#x5f55;&#x3002;</p><button type="button" class="btn btn-secondary" data-settings-add-source>&#x6dfb;&#x52a0;&#x6587;&#x4ef6;&#x5939;</button></div><ul class="settings-source-list" data-settings-sources></ul></div>
    </article>
  `;
}

function renderYtDlpPanel(): string {
  return `
    <article class="settings-card settings-card--yt-dlp">
      <div class="settings-card__header">
        <div><div class="eyebrow">LINK CLIPPING</div><h2>yt-dlp</h2></div>
        <span class="settings-card__badge" data-yt-dlp-light>&#x672a;&#x68c0;&#x6d4b;</span>
      </div>
      <p data-yt-dlp-status>&#x8fdb;&#x5165;&#x4ed3;&#x5e93;&#x4e0e;&#x540c;&#x6b65;&#x540e;&#x68c0;&#x6d4b; yt-dlp&#x3002;</p>
      <div class="settings-run-panel__actions">
        <button type="button" class="btn btn-secondary" data-yt-dlp-refresh>&#x68c0;&#x6d4b;</button>
        <button type="button" class="btn btn-secondary" data-yt-dlp-install>&#x5b89;&#x88c5;&#x5230;&#x9879;&#x76ee;</button>
      </div>
    </article>
  `;
}

function renderXhsSyncPanel(): string {
  return `
    <article class="settings-card settings-card--xhs-sync" data-xhs-sync-card>
      <div class="settings-card__header">
        <div><div class="eyebrow">LINK CLIPPING</div><h2>小红书同步</h2></div>
        <span class="settings-card__badge">rednote-to-obsidian</span>
      </div>
      <p data-xhs-sync-status>识别到小红书链接后，会优先走小红书专用流程；失败会写入审查页。</p>
      <label class="settings-field settings-field--wide">
        <span>链接 / 链接列表</span>
        <textarea data-xhs-sync-input rows="4" placeholder="粘贴单个小红书链接，或多行链接"></textarea>
      </label>
      <div class="settings-run-panel__actions">
        <button type="button" class="btn btn-secondary" data-xhs-extract>提取单个帖子</button>
        <button type="button" class="btn btn-secondary" data-xhs-batch>批量提取多个帖子</button>
        <button type="button" class="btn btn-secondary" data-xhs-refresh>刷新</button>
      </div>
      <div class="settings-run-panel">
        <div class="settings-run-panel__row"><span>提取进度</span><strong data-xhs-extract-meta>0 / 0</strong></div>
        <div class="settings-run-panel__bar"><span data-xhs-extract-progress style="width:0%"></span></div>
      </div>
    </article>
  `;
}

function renderShortcutPanel(): string {
  return `
    <article class="settings-card settings-card--shortcuts">
      <div class="settings-card__header"><div><div class="eyebrow">SHORTCUTS</div><h2>&#x5feb;&#x6377;&#x952e;</h2></div><span class="settings-card__badge">Electron</span></div>
      <div class="settings-shortcut-row">
        <div class="settings-shortcut-row__copy"><strong>&#x95ea;&#x5ff5;&#x65e5;&#x8bb0;&#x5feb;&#x901f;&#x8bb0;&#x5f55;</strong><span>&#x6253;&#x5f00;&#x72ec;&#x7acb;&#x5c0f;&#x7a97;&#x53e3;&#x3002;</span></div>
        <div class="settings-shortcut-row__control"><input data-shortcut-id="flashDiaryCapture" type="text" value="${DEFAULT_FLASH_DIARY_SHORTCUT}" /><button type="button" class="btn btn-secondary" data-shortcut-save="flashDiaryCapture">&#x4fdd;&#x5b58;&#x5feb;&#x6377;&#x952e;</button></div>
      </div>
      <p class="settings-shortcut-status" data-shortcut-status></p>
    </article>
  `;
}

function renderCloudSyncCard(): string {
  return `
    <article class="settings-card settings-card--cloud-sync">
      <div class="settings-card__header">
        <div>
          <div class="eyebrow">REMOTE BRAIN</div>
          <h2>&#x540c;&#x6b65;&#x7ed3;&#x679c;</h2>
        </div>
      </div>
      <p>&#x5168;&#x5c40;&#x5bfc;&#x822a;&#x680f;&#x91cc;&#x70b9;&#x51fb;&#x201c;&#x540c;&#x6b65;&#x201d;&#x540e;&#xff0c;&#x8fd0;&#x884c;&#x8fdb;&#x5ea6;&#x3001;&#x6700;&#x65b0;&#x65e5;&#x5fd7;&#x548c;&#x7ed3;&#x679c;&#x4f1a;&#x76f4;&#x63a5;&#x843d;&#x5230;&#x8fd9;&#x91cc;&#x3002;</p>
      <div class="settings-run-panel" data-sync-run-panel>
        <div class="settings-run-panel__row">
          <span>&#x540c;&#x6b65;&#x72b6;&#x6001;</span>
          <strong data-sync-run-status>&#x5f85;&#x8fd0;&#x884c;</strong>
        </div>
        <div class="settings-run-panel__meta" data-sync-run-meta>&#x8fd8;&#x6ca1;&#x6709;&#x8fd0;&#x884c;&#x4e2d;&#x7684;&#x540c;&#x6b65;&#x4efb;&#x52a1;&#x3002;</div>
        <div class="settings-run-panel__bar"><span data-sync-run-progress style="width:0%"></span></div>
        <div class="settings-run-panel__summary" data-sync-run-summary>
          <span class="settings-run-panel__chip">&#x672a;&#x542f;&#x52a8;</span>
        </div>
        <pre class="settings-run-panel__log" data-sync-run-log>&#x6682;&#x65e0;&#x8fd0;&#x884c;&#x8f93;&#x51fa;</pre>
        <div class="settings-run-panel__actions">
          <button type="button" class="btn btn-secondary" data-sync-run-pause disabled>&#x6682;&#x505c;</button>
          <button type="button" class="btn btn-secondary" data-sync-run-cancel disabled>&#x53d6;&#x6d88;</button>
          <button type="button" class="btn btn-secondary" data-sync-run-refresh>&#x5237;&#x65b0;</button>
        </div>
      </div>
    </article>
  `;
}

function renderCompileRunCard(): string {
  return `
    <article class="settings-card settings-card--cloud-sync">
      <div class="settings-card__header">
        <div>
          <div class="eyebrow">COMPILE</div>
          <h2>&#x7f16;&#x8bd1;&#x60c5;&#x51b5;</h2>
        </div>
      </div>
      <p>&#x8fd9;&#x91cc;&#x53ea;&#x805a;&#x7126; compile \u9636\u6bb5\uff0c\u663e;&#x793a;&#x767e;&#x5206;&#x6bd4;&#x3001;&#x8fdb;&#x5ea6;&#x6761;&#x548c;&#x7f16;&#x8bd1;&#x65e5;&#x5fd7;&#x3002;</p>
      <div class="settings-run-panel" data-compile-run-panel>
        <div class="settings-run-panel__row">
          <span>&#x7f16;&#x8bd1;&#x72b6;&#x6001;</span>
          <strong data-compile-run-status>&#x5f85;&#x8fd0;&#x884c;</strong>
        </div>
        <div class="settings-run-panel__meta" data-compile-run-meta>&#x8fd8;&#x6ca1;&#x6709;&#x68c0;&#x6d4b;&#x5230; compile \u8fdb;&#x5ea6\u3002;</div>
        <div class="settings-run-panel__bar"><span data-compile-run-progress style="width:0%"></span></div>
        <div class="settings-run-panel__summary" data-compile-run-summary>
          <span class="settings-run-panel__chip">&#x672a;&#x542f;&#x52a8;</span>
        </div>
        <pre class="settings-run-panel__log" data-compile-run-log>&#x6682;&#x65e0;&#x7f16;&#x8bd1;&#x8f93;&#x51fa;</pre>
        <div class="settings-run-panel__actions">
          <button type="button" class="btn btn-secondary" data-compile-run-refresh>&#x5237;&#x65b0;</button>
        </div>
      </div>
    </article>
  `;
}

function renderProjectLogCard(): string {
  return `
    <article class="settings-card settings-card--project-log" data-settings-project-log>
      <div class="settings-card__header"><div><div class="eyebrow">PROJECT MEMORY</div><h2>&#x9879;&#x76ee;&#x65e5;&#x5fd7;</h2></div></div>
      <p>&#x67e5;&#x770b; LLM Wiki &#x5e94;&#x7528;&#x5f53;&#x524d;&#x754c;&#x9762;&#x3001;&#x5f53;&#x524d;&#x6d41;&#x7a0b;&#x548c;&#x642d;&#x5efa;&#x65f6;&#x95f4;&#x7ebf;&#x3002;</p>
    </article>
  `;
}

function bindSettingsPage(root: HTMLElement, initialSection: SettingsSection): void {
  bindSettingsNavigation(root);
  bindWorkspaceSyncPanel(root);
  bindProviderCards(root);
  bindProviderStatusControls(root);
  bindSettingsSidebarResize(root);
  bindLegacySettingsControls(root);
  bindLlmProviderConfig(root);
  bindAgentConfigControls(root);
  bindAutomationConfigControls(root);
  bindCLIProxyControls(root, hydrateLlmDefaultAccountOptions);
  bindSyncRunPanel(root);
  bindNetworkSearchPanel(root);
  selectSettingsSection(root, initialSection);
}

function bindSettingsNavigation(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-settings-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.settingsNav as SettingsSection | undefined;
      if (!section) {
        return;
      }
      selectSettingsSection(root, section);
    });
  });
}

function selectSettingsSection(root: HTMLElement, section: SettingsSection): void {
  if (section === "project-log") {
    window.location.hash = "#/project-log";
    return;
  }
  root.querySelectorAll<HTMLButtonElement>("[data-settings-nav]").forEach((item) => {
    item.dataset.active = item.dataset.settingsNav === section ? "true" : "false";
  });
  root.querySelectorAll<HTMLElement>("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== section;
  });
  if (section === "workspace-sync") {
    void hydrateWorkspaceSyncPanel(root);
  }
  if (section === "app-config") {
    hydrateAppPublishSection(root);
  }
}

function normalizeSettingsSection(value: string | undefined): SettingsSection {
  return value && SETTINGS_SECTION_VALUES.has(value as SettingsSection)
    ? value as SettingsSection
    : "llm";
}

function bindProviderCards(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-provider-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest(".settings-switch")) {
        return;
      }
      const id = button.dataset.providerToggle ?? "";
      const body = root.querySelector<HTMLElement>(`[data-provider-body="${cssEscape(id)}"]`);
      if (body) body.hidden = !body.hidden;
    });
  });
  root.querySelectorAll<HTMLElement>("[data-provider-enabled]").forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const checked = toggle.getAttribute("aria-checked") === "true";
      toggle.setAttribute("aria-checked", checked ? "false" : "true");
      toggle.classList.toggle("is-on", !checked);
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-llm-account-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const providerId = button.dataset.llmAccountAdd ?? "";
      const list = root.querySelector<HTMLElement>(`[data-llm-account-list="${cssEscape(providerId)}"]`);
      list?.insertAdjacentHTML("beforeend", renderLlmAccountRow(providerId));
    });
  });
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const testButton = target.closest<HTMLButtonElement>("[data-llm-account-test]");
    if (testButton) {
      void testLlmAccountRow(testButton);
      return;
    }
    const saveButton = target.closest<HTMLButtonElement>("[data-llm-account-save]");
    if (saveButton) {
      void saveLlmAccountRow(root, saveButton);
      return;
    }
    const deleteButton = target.closest<HTMLButtonElement>("[data-llm-account-delete]");
    if (deleteButton) {
      void deleteLlmAccountRow(root, deleteButton);
    }
  });
}

function bindProviderStatusControls(root: HTMLElement): void {
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-relay-balance-refresh]")) {
      void refreshRelayBalance(root);
      return;
    }
    if (target.closest("[data-codex-cli-refresh]")) {
      void refreshCodexCliStatus(root);
      return;
    }
    if (target.closest("[data-yt-dlp-refresh]")) {
      void hydrateYtDlpStatus(root);
      return;
    }
    if (target.closest("[data-yt-dlp-install]")) {
      void installYtDlp(root).catch((error) => {
        const status = root.querySelector<HTMLElement>("[data-yt-dlp-status]");
        if (status) status.textContent = error instanceof Error ? error.message : String(error);
      });
      return;
    }
    if (target.closest("[data-xhs-refresh]")) {
      void hydrateXhsSyncStatus(root);
      return;
    }
    if (target.closest("[data-xhs-extract]")) {
      void runXhsAction(root, "extract");
      return;
    }
    if (target.closest("[data-xhs-batch]")) {
      void runXhsAction(root, "batch");
      return;
    }
  });
}

async function hydrateYtDlpStatus(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-yt-dlp-status]");
  const light = root.querySelector<HTMLElement>("[data-yt-dlp-light]");
  if (!status || !light) return;
  status.textContent = "\u6b63\u5728\u68c0\u6d4b yt-dlp...";
  try {
    const response = await fetch("/api/clips/yt-dlp");
    const payload = (await response.json()) as { success?: boolean; data?: YtDlpStatusResponse; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "yt-dlp status load failed");
    }
    renderYtDlpStatus(status, light, payload.data);
  } catch (error) {
    light.textContent = "\u5931\u8d25";
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function installYtDlp(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-yt-dlp-status]");
  if (status) status.textContent = "\u6b63\u5728\u5b89\u88c5 yt-dlp...";
  const response = await fetch("/api/clips/yt-dlp/install", { method: "POST" });
  const payload = (await response.json()) as { success?: boolean; data?: YtDlpStatusResponse; error?: string };
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? "yt-dlp install failed");
  }
  renderYtDlpStatus(
    root.querySelector<HTMLElement>("[data-yt-dlp-status]")!,
    root.querySelector<HTMLElement>("[data-yt-dlp-light]")!,
    payload.data,
  );
}

function renderYtDlpStatus(status: HTMLElement, light: HTMLElement, data: YtDlpStatusResponse): void {
  light.textContent = data.installed ? "\u53ef\u7528" : "\u672a\u5b89\u88c5";
  status.textContent = data.installed
    ? `${data.version ?? "yt-dlp"} · ${data.source}${data.path ? ` · ${data.path}` : ""}`
    : data.message ?? "\u672a\u68c0\u6d4b\u5230 yt-dlp";
}

async function hydrateXhsSyncStatus(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-xhs-sync-status]");
  if (!status) return;
  setOptionalText(status, "正在读取小红书同步状态...");
  try {
    const response = await fetch("/api/xhs-sync/status");
    const data = await readSuccessData<XhsSyncStatusResponse>(response, "小红书同步状态读取失败");
    renderXhsProgress(root, "extract", data.latestExtraction?.progress ?? emptyXhsProgress());
    setOptionalText(status, describeXhsSyncStatus(data.failures.length));
  } catch (error) {
    setOptionalText(status, readErrorMessage(error));
  }
}

function resolveXhsActionRequest(
  action: "extract" | "batch",
  inputValue: string,
): { body: { body: string; url: string } | { text: string }; endpoint: string } {
  if (action === "extract") {
    return {
      endpoint: "/api/xhs-sync/extract",
      body: { url: readFirstXhsUrl(inputValue), body: inputValue },
    };
  }
  return {
    endpoint: "/api/xhs-sync/batch",
    body: { text: inputValue },
  };
}

async function readXhsActionData(response: Response): Promise<XhsActionResponse> {
  const payload = await readJsonPayload<{ success?: boolean; data?: XhsActionResponse; error?: string }>(response);
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? payload.data?.error ?? "小红书同步失败");
  }
  return payload.data;
}

function resolveXhsActionProgress(data: XhsActionResponse): XhsProgressResponse {
  if (data.progress) {
    return data.progress;
  }
  return {
    current: 1,
    total: 1,
    percent: data.status === "failed" ? 0 : 100,
  };
}

function describeXhsActionStatus(data: XhsActionResponse): string {
  if (data.path) {
    return `已完成：${data.path}`;
  }
  return "小红书同步任务已完成。";
}

async function runXhsAction(root: HTMLElement, action: "extract" | "batch"): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-xhs-sync-status]");
  const input = root.querySelector<HTMLTextAreaElement>("[data-xhs-sync-input]");
  const request = resolveXhsActionRequest(action, input?.value ?? "");
  setOptionalText(status, "正在执行小红书提取...");
  try {
    const response = await fetch(request.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
    const data = await readXhsActionData(response);
    renderXhsProgress(root, "extract", resolveXhsActionProgress(data));
    setOptionalText(status, describeXhsActionStatus(data));
  } catch (error) {
    setOptionalText(status, readErrorMessage(error));
  }
}

function renderXhsProgress(root: HTMLElement, kind: "extract", progress: XhsProgressResponse): void {
  const bar = root.querySelector<HTMLElement>("[data-xhs-extract-progress]");
  const meta = root.querySelector<HTMLElement>("[data-xhs-extract-meta]");
  if (bar) bar.style.width = `${clamp(progress.percent, 0, 100)}%`;
  if (meta) meta.textContent = `${progress.current} / ${progress.total}`;
}

function emptyXhsProgress(): XhsProgressResponse {
  return { current: 0, total: 0, percent: 0 };
}

function readFirstXhsUrl(value: string): string {
  return value.match(/https?:\/\/[^\s,，]+/i)?.[0] ?? "";
}

interface RelayBalanceResponseData {
  ok?: boolean;
  currentBalance?: string | null;
  usedBalance?: string | null;
  message?: string;
}

function renderRelayBalanceLoading(current: HTMLElement, used: HTMLElement): void {
  current.textContent = "\u8bfb\u53d6\u4e2d...";
  used.textContent = "\u8bfb\u53d6\u4e2d...";
}

function readRelayBalanceRequestBody(root: HTMLElement): Record<string, string> {
  return {
    url: readProviderInput(root, "relay:balanceUrl"),
    key: readProviderInput(root, "relay:key"),
    balancePath: readProviderInput(root, "relay:balancePath"),
    usedPath: readProviderInput(root, "relay:usedPath"),
  };
}

async function readRelayBalanceResponse(response: Response): Promise<RelayBalanceResponseData> {
  const payload = (await response.json()) as {
    success?: boolean;
    data?: RelayBalanceResponseData;
    error?: string;
  };
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? "\u4f59\u989d\u8bfb\u53d6\u5931\u8d25");
  }
  return payload.data;
}

function renderRelayBalanceSuccess(
  current: HTMLElement,
  used: HTMLElement,
  data: RelayBalanceResponseData,
): void {
  current.textContent = data.currentBalance ?? "--";
  used.textContent = data.usedBalance ?? "--";
  if (!data.ok && data.message) {
    used.textContent = data.message;
  }
}

async function refreshRelayBalance(root: HTMLElement): Promise<void> {
  const current = root.querySelector<HTMLElement>("[data-relay-balance-current] strong");
  const used = root.querySelector<HTMLElement>("[data-relay-balance-used] strong");
  if (!current || !used) return;
  renderRelayBalanceLoading(current, used);
  try {
    const response = await fetch("/api/providers/relay/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readRelayBalanceRequestBody(root)),
    });
    renderRelayBalanceSuccess(current, used, await readRelayBalanceResponse(response));
  } catch (error) {
    current.textContent = "\u5931\u8d25";
    used.textContent = readErrorMessage(error);
  }
}

interface CodexCliStatusData {
  ok?: boolean;
  installed?: boolean;
  version?: string | null;
  balance?: string | null;
  message?: string;
}

async function readCodexCliStatusData(response: Response): Promise<CodexCliStatusData> {
  const payload = (await response.json()) as {
    success?: boolean;
    data?: CodexCliStatusData;
    error?: string;
  };
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? "Codex CLI 状态读取失败");
  }
  return payload.data;
}

function renderCodexCliStatusLoading(balance: HTMLElement, status: HTMLElement): void {
  balance.textContent = "检测中...";
  status.textContent = "检测中...";
}

function renderCodexCliStatusSuccess(
  balance: HTMLElement,
  status: HTMLElement,
  data: CodexCliStatusData,
): void {
  status.textContent = data.version ?? (data.installed ? "Codex CLI" : "未安装");
  balance.textContent = data.balance ?? data.message ?? "--";
}

function renderCodexCliStatusFailure(balance: HTMLElement, status: HTMLElement, error: unknown): void {
  status.textContent = "失败";
  balance.textContent = readErrorMessage(error);
}

async function refreshCodexCliStatus(root: HTMLElement): Promise<void> {
  const balance = root.querySelector<HTMLElement>("[data-codex-cli-balance] strong");
  const status = root.querySelector<HTMLElement>("[data-codex-cli-status]");
  if (!balance || !status) return;

  renderCodexCliStatusLoading(balance, status);
  try {
    const response = await fetch("/api/providers/codex-cli/status");
    renderCodexCliStatusSuccess(balance, status, await readCodexCliStatusData(response));
  } catch (error) {
    renderCodexCliStatusFailure(balance, status, error);
  }
}

function bindSettingsSidebarResize(root: HTMLElement): void {
  const sidebar = root.querySelector<HTMLElement>("[data-settings-sidebar]");
  const handle = root.querySelector<HTMLElement>("[data-settings-sidebar-resize]");
  if (!sidebar || !handle) return;
  const storedWidth = Number(window.localStorage?.getItem(SETTINGS_SIDEBAR_WIDTH_KEY));
  if (Number.isFinite(storedWidth) && storedWidth >= 180) {
    root.style.setProperty("--settings-sidebar-width", `${storedWidth}px`);
  }
  attachResizeHandle({
    handle,
    onMove(event) {
      const rect = root.getBoundingClientRect();
      const width = clamp(event.clientX - rect.left, 180, 320);
      root.style.setProperty("--settings-sidebar-width", `${width}px`);
      window.localStorage?.setItem(SETTINGS_SIDEBAR_WIDTH_KEY, String(width));
    },
  });
}

function bindWorkspaceSyncPanel(root: HTMLElement): void {
  workspaceSyncState.set(root, { targetRepoPath: "", sourceRepoPaths: [] });
  xiaohongshuImportState.set(root, { cookie: "", progress: 0, status: "idle", message: "未开始" });
  douyinCookieState.set(root, { cookie: "", status: "idle", message: "未开始", hasCookie: false, path: "" });

  root.querySelectorAll<HTMLButtonElement>("[data-import-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = button.dataset.importSource as ImportSource | undefined;
      if (source === "xiaohongshu") {
        openXiaohongshuImportModal(root);
        return;
      }
      if (source === "douyin") {
        openDouyinCookieModal(root);
        return;
      }
      updateSettingsStatus(root, `${button.textContent?.trim() ?? "该来源"} 暂未接入导入流程。`);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-xhs-import-close]").forEach((button) => {
    button.addEventListener("click", () => {
      closeXiaohongshuImportModal(root);
    });
  });
  root.querySelector<HTMLButtonElement>("[data-xhs-import-dir-pick]")?.addEventListener("click", () => {
    void chooseXiaohongshuImportDir(root);
  });
  root.querySelector<HTMLButtonElement>("[data-xhs-import-dir-save]")?.addEventListener("click", () => {
    void saveXiaohongshuImportDir(root);
  });
  root.querySelector<HTMLButtonElement>("[data-xhs-import-dir-clear]")?.addEventListener("click", () => {
    void clearXiaohongshuImportDir(root);
  });
  root.querySelector<HTMLInputElement>("[data-xhs-import-dir-input]")?.addEventListener("click", () => {
    if (!window.llmWikiDesktop) return;
    void chooseXiaohongshuImportDir(root);
  });
  root.querySelector<HTMLButtonElement>("[data-xhs-import-sync]")?.addEventListener("click", () => {
    void syncXiaohongshuFavorites(root);
  });
  root.querySelector<HTMLTextAreaElement>("[data-xhs-cookie-input]")?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    const state = xiaohongshuImportState.get(root) ?? { cookie: "", progress: 0, status: "idle" as const };
    xiaohongshuImportState.set(root, { ...state, cookie: input.value });
  });

  root.querySelector<HTMLButtonElement>("[data-xhs-cookie-save]")?.addEventListener("click", () => {
    void saveXiaohongshuCookieAndStart(root);
  });
  root.querySelector<HTMLButtonElement>("[data-xhs-login-open]")?.addEventListener("click", () => {
    void openXiaohongshuLoginWindow(root);
  });
  root.querySelector<HTMLButtonElement>("[data-xhs-cookie-import]")?.addEventListener("click", () => {
    void importXiaohongshuCookieFromBrowser(root);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-douyin-cookie-close]").forEach((button) => {
    button.addEventListener("click", () => {
      closeDouyinCookieModal(root);
    });
  });
  root.querySelector<HTMLTextAreaElement>("[data-douyin-cookie-input]")?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    const state = douyinCookieState.get(root) ?? { cookie: "", status: "idle" as const };
    douyinCookieState.set(root, { ...state, cookie: input.value });
  });
  root.querySelector<HTMLButtonElement>("[data-douyin-cookie-save]")?.addEventListener("click", () => {
    void saveDouyinCookie(root);
  });
  root.querySelector<HTMLButtonElement>("[data-douyin-login-open]")?.addEventListener("click", () => {
    void openDouyinLoginWindow(root);
  });
  root.querySelector<HTMLButtonElement>("[data-douyin-cookie-import]")?.addEventListener("click", () => {
    void importDouyinCookieFromBrowser(root);
  });

  root.querySelector<HTMLButtonElement>("[data-sync-config-refresh]")?.addEventListener("click", () => {
    void hydrateWorkspaceSyncPanel(root);
  });
  root.querySelector<HTMLButtonElement>("[data-sync-config-save]")?.addEventListener("click", () => {
    void saveWorkspaceSyncConfig(root);
  });
  root.querySelector<HTMLButtonElement>("[data-sync-target-pick]")?.addEventListener("click", () => {
    void chooseWorkspaceTarget(root);
  });
  root.querySelector<HTMLButtonElement>("[data-sync-source-pick]")?.addEventListener("click", () => {
    void chooseWorkspaceSources(root);
  });
  root.querySelector<HTMLButtonElement>("[data-sync-source-add]")?.addEventListener("click", () => {
    addManualWorkspaceSource(root);
  });
  root.querySelector<HTMLButtonElement>("[data-sync-target-clear]")?.addEventListener("click", () => {
    setWorkspaceSyncState(root, { ...readWorkspaceSyncState(root), targetRepoPath: "" });
  });

  root.querySelector<HTMLInputElement>("[data-sync-target-input]")?.addEventListener("input", (event) => {
    const value = (event.currentTarget as HTMLInputElement).value;
    setWorkspaceSyncState(root, { ...readWorkspaceSyncState(root), targetRepoPath: value });
  });
  root.querySelector<HTMLInputElement>("[data-sync-source-input]")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addManualWorkspaceSource(root);
  });

  root.querySelector<HTMLInputElement>("[data-sync-target-input]")?.addEventListener("click", () => {
    if (window.llmWikiDesktop) {
      void chooseWorkspaceTarget(root);
    }
  });
  root.querySelector<HTMLInputElement>("[data-sync-source-input]")?.addEventListener("click", () => {
    if (window.llmWikiDesktop) {
      void chooseWorkspaceSources(root);
    }
  });

  root.addEventListener("click", (event) => {
    const removeButton = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sync-remove-source]");
    if (removeButton) {
      event.preventDefault();
      removeWorkspaceSource(root, removeButton.dataset.syncRemoveSource ?? "");
    }
  });
}

async function hydrateWorkspaceSyncPanel(root: HTMLElement): Promise<void> {
  await Promise.all([
    hydrateWorkspaceSyncConfig(root),
    hydrateXiaohongshuImportProgress(root),
  ]);
}

async function hydrateWorkspaceSyncConfig(root: HTMLElement): Promise<void> {
  const targetInput = root.querySelector<HTMLInputElement>("[data-sync-target-input]");
  const sourceInput = root.querySelector<HTMLInputElement>("[data-sync-source-input]");
  if (!targetInput || !sourceInput) return;
  try {
    const config = await loadWorkspaceSyncConfig();
    workspaceSyncState.set(root, config);
    targetInput.readOnly = Boolean(window.llmWikiDesktop);
    sourceInput.readOnly = Boolean(window.llmWikiDesktop);
    renderWorkspaceSyncState(root);
  } catch (error) {
    updateSettingsStatus(root, error instanceof Error ? error.message : String(error));
  }
}

async function readDesktopWorkspaceSyncConfig(): Promise<SyncRepoState | null> {
  if (!window.llmWikiDesktop) {
    return null;
  }
  const bootstrap = await window.llmWikiDesktop.getAppBootstrap();
  const desktopState: SyncRepoState = {
    targetRepoPath: bootstrap.appConfig?.targetRepoPath ?? bootstrap.desktopConfig.targetVault ?? "",
    sourceRepoPaths: bootstrap.appConfig?.sourceFolders ?? [],
  };
  if (!desktopState.targetRepoPath && desktopState.sourceRepoPaths.length === 0) {
    return null;
  }
  return normalizeWorkspaceSyncState(desktopState);
}

async function readApiWorkspaceSyncConfig(): Promise<SyncRepoState> {
  const response = await fetch("/api/sync/config");
  const data = await readSuccessData<SyncConfigResponse>(response, "同步配置读取失败");
  return normalizeWorkspaceSyncState(data);
}

async function loadWorkspaceSyncConfig(): Promise<SyncRepoState> {
  const desktopState = await readDesktopWorkspaceSyncConfig();
  if (desktopState) {
    return desktopState;
  }
  return readApiWorkspaceSyncConfig();
}

function finalizeWorkspaceSyncState(root: HTMLElement): SyncRepoState {
  const sourceInput = root.querySelector<HTMLInputElement>("[data-sync-source-input]");
  if (sourceInput?.value.trim()) {
    addManualWorkspaceSource(root);
  }
  return normalizeWorkspaceSyncState(readWorkspaceSyncState(root));
}

function hasWorkspaceSyncConfig(state: SyncRepoState): boolean {
  return Boolean(state.targetRepoPath) && state.sourceRepoPaths.length > 0;
}

async function persistWorkspaceSyncConfig(state: SyncRepoState): Promise<void> {
  if (window.llmWikiDesktop) {
    await window.llmWikiDesktop.saveDesktopConfig(state.targetRepoPath);
    await window.llmWikiDesktop.saveAppConfig({
      targetRepoPath: state.targetRepoPath,
      sourceFolders: state.sourceRepoPaths,
    });
    return;
  }
  const response = await fetch("/api/sync/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  const payload = await readJsonPayload<{ success?: boolean; error?: string }>(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? "同步配置保存失败");
  }
}

async function saveWorkspaceSyncConfig(root: HTMLElement): Promise<void> {
  const state = finalizeWorkspaceSyncState(root);
  if (!hasWorkspaceSyncConfig(state)) {
    updateSettingsStatus(root, "需要先填写目标仓库和至少一个源仓库。");
    return;
  }
  try {
    await persistWorkspaceSyncConfig(state);
    setWorkspaceSyncState(root, state);
    updateSettingsStatus(root, "同步配置已保存。");
  } catch (error) {
    updateSettingsStatus(root, readErrorMessage(error));
  }
}

async function chooseWorkspaceTarget(root: HTMLElement): Promise<void> {
  if (!window.llmWikiDesktop) return;
  const selected = await window.llmWikiDesktop.chooseTargetVault();
  if (!selected) return;
  setWorkspaceSyncState(root, { ...readWorkspaceSyncState(root), targetRepoPath: selected });
}

async function chooseWorkspaceSources(root: HTMLElement): Promise<void> {
  if (!window.llmWikiDesktop) return;
  const selected = await window.llmWikiDesktop.chooseSourceFolders();
  if (!selected || selected.length === 0) return;
  setWorkspaceSyncState(root, {
    ...readWorkspaceSyncState(root),
    sourceRepoPaths: [...readWorkspaceSyncState(root).sourceRepoPaths, ...selected],
  });
}

function addManualWorkspaceSource(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>("[data-sync-source-input]");
  if (!input) return;
  const value = input.value.trim();
  if (!value) return;
  setWorkspaceSyncState(root, {
    ...readWorkspaceSyncState(root),
    sourceRepoPaths: [...readWorkspaceSyncState(root).sourceRepoPaths, value],
  });
  input.value = "";
}

function removeWorkspaceSource(root: HTMLElement, sourcePath: string): void {
  if (!sourcePath) return;
  setWorkspaceSyncState(root, {
    ...readWorkspaceSyncState(root),
    sourceRepoPaths: readWorkspaceSyncState(root).sourceRepoPaths.filter((item) => item !== sourcePath),
  });
}

function readWorkspaceSyncState(root: HTMLElement): SyncRepoState {
  return workspaceSyncState.get(root) ?? { targetRepoPath: "", sourceRepoPaths: [] };
}

function setWorkspaceSyncState(root: HTMLElement, state: SyncRepoState): void {
  workspaceSyncState.set(root, normalizeWorkspaceSyncState(state));
  renderWorkspaceSyncState(root);
}

function normalizeWorkspaceSyncState(state: SyncRepoState): SyncRepoState {
  return {
    targetRepoPath: state.targetRepoPath.trim(),
    sourceRepoPaths: [...new Set(state.sourceRepoPaths.map((item) => item.trim()).filter(Boolean))],
  };
}

function renderWorkspaceSyncState(root: HTMLElement): void {
  const state = readWorkspaceSyncState(root);
  const targetInput = root.querySelector<HTMLInputElement>("[data-sync-target-input]");
  const sourcePaths = root.querySelector<HTMLElement>("[data-sync-source-paths]");
  const clearButton = root.querySelector<HTMLButtonElement>("[data-sync-target-clear]");
  if (targetInput) targetInput.value = state.targetRepoPath;
  if (clearButton) clearButton.hidden = !state.targetRepoPath;
  if (!sourcePaths) return;
  if (state.sourceRepoPaths.length === 0) {
    sourcePaths.innerHTML = `<div class="settings-source-paths__empty">尚未添加源仓库路径</div>`;
    return;
  }
  sourcePaths.innerHTML = state.sourceRepoPaths.map((sourcePath) => `
    <div class="settings-source-path" data-source-path="${escapeHtml(sourcePath)}">
      <span>${escapeHtml(sourcePath)}</span>
      <button type="button" class="settings-source-path__delete" data-sync-remove-source="${escapeHtml(sourcePath)}">删除</button>
    </div>
  `).join("");
}

function openXiaohongshuImportModal(root: HTMLElement): void {
  const modal = root.querySelector<HTMLElement>("[data-xhs-import-modal]");
  if (!modal) return;
  modal.hidden = false;
  const cookieInput = root.querySelector<HTMLTextAreaElement>("[data-xhs-cookie-input]");
  if (cookieInput) {
    const state = xiaohongshuImportState.get(root);
    if (!cookieInput.value && state?.cookie) {
      cookieInput.value = state.cookie;
    }
    cookieInput.focus();
  }
  void hydrateXiaohongshuImportConfig(root);
  void hydrateXiaohongshuImportProgress(root);
}

function closeXiaohongshuImportModal(root: HTMLElement): void {
  const modal = root.querySelector<HTMLElement>("[data-xhs-import-modal]");
  if (modal) modal.hidden = true;
  stopXiaohongshuImportPolling(root);
}

function openDouyinCookieModal(root: HTMLElement): void {
  const modal = root.querySelector<HTMLElement>("[data-douyin-cookie-modal]");
  if (!modal) return;
  modal.hidden = false;
  const cookieInput = root.querySelector<HTMLTextAreaElement>("[data-douyin-cookie-input]");
  if (cookieInput) {
    const state = douyinCookieState.get(root);
    if (!cookieInput.value && state?.cookie) {
      cookieInput.value = state.cookie;
    }
    cookieInput.focus();
  }
  void hydrateDouyinCookieStatus(root);
}

function closeDouyinCookieModal(root: HTMLElement): void {
  const modal = root.querySelector<HTMLElement>("[data-douyin-cookie-modal]");
  if (modal) modal.hidden = true;
}

function renderXiaohongshuProgress(root: HTMLElement, progress: XiaohongshuProgressDraft): void {
  renderXiaohongshuImportState(
    root,
    buildXiaohongshuProgressSnapshot(xiaohongshuImportState.get(root), progress),
  );
}

function renderDouyinCookieSnapshot(root: HTMLElement, draft: DouyinCookieDraft): void {
  renderDouyinCookieState(root, buildDouyinCookieSnapshot(douyinCookieState.get(root), draft));
}

function currentXiaohongshuImportDir(root: HTMLElement): string {
  return xiaohongshuImportState.get(root)?.importDirPath
    ?? root.querySelector<HTMLInputElement>("[data-xhs-import-dir-input]")?.value.trim()
    ?? "";
}

async function saveXiaohongshuCookie(cookie: string): Promise<string> {
  const response = await fetch("/api/import/xiaohongshu/cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookie }),
  });
  const payload = await readJsonPayload<{ success?: boolean; message?: string; error?: string }>(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? "Cookie 保存失败");
  }
  return payload.message ?? "Cookie 保存成功，正在启动导入任务";
}

async function startXiaohongshuImportTask(): Promise<string> {
  const response = await fetch("/api/import/xiaohongshu/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await readJsonPayload<{ success?: boolean; taskId?: string; error?: string }>(response);
  if (!response.ok || !payload.success || !payload.taskId) {
    throw new Error(payload.error ?? "小红书导入任务启动失败");
  }
  return payload.taskId;
}

async function resolveXiaohongshuFavoritesRequest(): Promise<{ endpoint: string; requestBody: string }> {
  if (!window.llmWikiDesktop?.fetchXiaohongshuFavorites) {
    return { endpoint: "/api/xhs-sync/favorites", requestBody: "{}" };
  }
  const favorites = await window.llmWikiDesktop.fetchXiaohongshuFavorites();
  if (!favorites?.ok) {
    throw new Error(favorites?.message ?? "小红书收藏读取失败");
  }
  return {
    endpoint: "/api/xhs-sync/batch",
    requestBody: JSON.stringify({ urls: favorites.urls }),
  };
}

async function requestXiaohongshuFavoritesSync(
  endpoint: string,
  requestBody: string,
): Promise<XhsFavoritesSyncResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });
  const payload = await readJsonPayload<{ success?: boolean; data?: XhsFavoritesSyncResponse; error?: string }>(response);
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? payload.data?.error ?? "小红书一键同步失败");
  }
  return payload.data;
}

async function saveXiaohongshuCookieAndStart(root: HTMLElement): Promise<void> {
  const cookieInput = root.querySelector<HTMLTextAreaElement>("[data-xhs-cookie-input]");
  if (!cookieInput) return;
  const cookie = cookieInput.value.trim();
  const state = xiaohongshuImportState.get(root);
  if (!cookie) {
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: 0,
      status: "error",
      message: "请先粘贴 Cookie",
    });
    return;
  }
  xiaohongshuImportState.set(root, {
    cookie,
    importDirPath: state?.importDirPath,
    progress: 0,
    status: "saving",
    message: "正在保存 Cookie",
  });
  renderXiaohongshuProgress(root, {
    taskId: null,
    progress: 0,
    status: "importing",
    message: "正在保存 Cookie",
  });
  try {
    const message = await saveXiaohongshuCookie(cookie);
    const taskId = await startXiaohongshuImportTask();
    const nextState: XiaohongshuImportState = {
      cookie,
      importDirPath: state?.importDirPath,
      progress: 0,
      status: "queued",
      message,
      taskId,
    };
    xiaohongshuImportState.set(root, nextState);
    await hydrateXiaohongshuImportProgress(root, taskId);
    startXiaohongshuImportPolling(root, taskId);
  } catch (error) {
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: 0,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function importXiaohongshuCookieFromBrowser(root: HTMLElement): Promise<void> {
  const cookieInput = root.querySelector<HTMLTextAreaElement>("[data-xhs-cookie-input]");
  if (!cookieInput) return;
  if (!window.llmWikiDesktop?.importXiaohongshuCookie) {
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: 0,
      status: "error",
      message: "当前环境不支持从浏览器自动读取小红书 Cookie。",
    });
    return;
  }
  try {
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: 0,
      status: "importing",
      message: "正在从浏览器读取小红书 Cookie",
    });
    const result = await window.llmWikiDesktop.importXiaohongshuCookie();
    if (!result.ok || !result.cookie.trim()) {
      throw new Error(result.message || "没有读取到小红书 Cookie");
    }
    cookieInput.value = result.cookie;
    updateSettingsStatus(root, result.message);
    await saveXiaohongshuCookieAndStart(root);
  } catch (error) {
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: 0,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function readDouyinCookieStatus(): Promise<DouyinCookieStatusResponse> {
  const response = await fetch("/api/import/douyin/cookie");
  return readSuccessData<DouyinCookieStatusResponse>(response, "抖音 cookie 状态读取失败");
}

function renderHydratedDouyinCookieStatus(root: HTMLElement, status: DouyinCookieStatusResponse): void {
  renderDouyinCookieState(root, {
    cookie: douyinCookieState.get(root)?.cookie ?? "",
    status: status.hasCookie ? "success" : "idle",
    message: status.hasCookie ? "已检测到项目级抖音 fallback cookie。" : "当前还没有保存项目级抖音 fallback cookie。",
    hasCookie: status.hasCookie,
    path: status.path,
  });
}

function renderDouyinCookieStatusFailure(root: HTMLElement, error: unknown): void {
  renderDouyinCookieState(root, {
    cookie: douyinCookieState.get(root)?.cookie ?? "",
    status: "error",
    message: readErrorMessage(error),
    hasCookie: false,
    path: "",
  });
}

async function hydrateDouyinCookieStatus(root: HTMLElement): Promise<void> {
  try {
    renderHydratedDouyinCookieStatus(root, await readDouyinCookieStatus());
  } catch (error) {
    renderDouyinCookieStatusFailure(root, error);
  }
}

async function persistDouyinCookie(
  cookie: string,
): Promise<{ message: string; status: DouyinCookieStatusResponse }> {
  const response = await fetch("/api/import/douyin/cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookie }),
  });
  const payload = await readJsonPayload<{
    success?: boolean;
    data?: DouyinCookieStatusResponse;
    message?: string;
    error?: string;
  }>(response);
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? "抖音 cookie 保存失败");
  }
  return {
    message: payload.message ?? "抖音 cookie 已保存",
    status: payload.data,
  };
}

async function saveDouyinCookie(root: HTMLElement): Promise<void> {
  const cookieInput = root.querySelector<HTMLTextAreaElement>("[data-douyin-cookie-input]");
  if (!cookieInput) return;
  let cookie = "";
  try {
    cookie = readRequiredControlValue(cookieInput, "请先粘贴抖音 Cookie");
  } catch (error) {
    renderDouyinCookieSnapshot(root, {
      status: "error",
      message: readErrorMessage(error),
    });
    return;
  }
  renderDouyinCookieSnapshot(root, {
    cookie,
    status: "saving",
    message: "正在保存抖音 Cookie",
  });
  try {
    const result = await persistDouyinCookie(cookie);
    renderDouyinCookieSnapshot(root, {
      cookie,
      status: "success",
      message: result.message,
      hasCookie: result.status.hasCookie,
      path: result.status.path,
    });
  } catch (error) {
    renderDouyinCookieSnapshot(root, {
      cookie,
      status: "error",
      message: readErrorMessage(error),
    });
  }
}

async function importDouyinCookieFromBrowser(root: HTMLElement): Promise<void> {
  const cookieInput = root.querySelector<HTMLTextAreaElement>("[data-douyin-cookie-input]");
  if (!cookieInput) return;
  if (!window.llmWikiDesktop?.importDouyinCookie) {
    renderDouyinCookieSnapshot(root, {
      status: "error",
      message: "当前环境不支持从浏览器自动读取抖音 Cookie。",
    });
    return;
  }
  try {
    renderDouyinCookieSnapshot(root, {
      status: "saving",
      message: "正在从浏览器读取抖音 Cookie",
    });
    const result = await window.llmWikiDesktop.importDouyinCookie();
    if (!result.ok || !result.cookie.trim()) {
      throw new Error(result.message || "没有读取到抖音 Cookie");
    }
    cookieInput.value = result.cookie;
    updateSettingsStatus(root, result.message);
    await saveDouyinCookie(root);
  } catch (error) {
    renderDouyinCookieSnapshot(root, {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function openDouyinLoginWindow(root: HTMLElement): Promise<void> {
  if (!window.llmWikiDesktop?.openDouyinLogin) {
    renderDouyinCookieSnapshot(root, {
      status: "error",
      message: "当前环境不支持打开抖音登录窗口。",
    });
    return;
  }
  try {
    const result = await window.llmWikiDesktop.openDouyinLogin();
    renderDouyinCookieSnapshot(root, {
      status: result.ok ? (douyinCookieState.get(root)?.status ?? "idle") : "error",
      message: result.message,
    });
    updateSettingsStatus(root, result.message);
  } catch (error) {
    renderDouyinCookieSnapshot(root, {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function openXiaohongshuLoginWindow(root: HTMLElement): Promise<void> {
  if (!window.llmWikiDesktop?.openXiaohongshuLogin) {
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: xiaohongshuImportState.get(root)?.progress ?? 0,
      status: "error",
      message: "当前环境不支持打开小红书登录窗口。",
    });
    return;
  }

  try {
    const result = await window.llmWikiDesktop.openXiaohongshuLogin();
    const state = xiaohongshuImportState.get(root);
    renderXiaohongshuProgress(root, buildXiaohongshuLoginProgress(state, result.ok, result.message));
    updateSettingsStatus(root, result.message);
  } catch (error) {
    renderXiaohongshuProgress(
      root,
      buildXiaohongshuLoginErrorProgress(xiaohongshuImportState.get(root), readErrorMessage(error)),
    );
  }
}

function buildXiaohongshuLoginProgress(
  state: XiaohongshuImportState | undefined,
  ok: boolean,
  message: string,
): XiaohongshuProgressDraft {
  return {
    taskId: state?.taskId ?? null,
    progress: state?.progress ?? 0,
    status: ok ? (state?.status ?? "idle") : "error",
    message,
  };
}

function buildXiaohongshuLoginErrorProgress(
  state: XiaohongshuImportState | undefined,
  message: string,
): XiaohongshuProgressDraft {
  return {
    taskId: null,
    progress: state?.progress ?? 0,
    status: "error",
    message,
  };
}

async function hydrateXiaohongshuImportConfig(root: HTMLElement): Promise<void> {
  const input = root.querySelector<HTMLInputElement>("[data-xhs-import-dir-input]");
  if (!input) return;
  try {
    const response = await fetch("/api/import/xiaohongshu/config");
    const data = await readSuccessData<XiaohongshuImportConfigResponse>(response, "小红书导入目录读取失败");
    applyXiaohongshuImportDir(root, data.importDirPath);
  } catch {
    input.value = "";
  }
}

async function chooseXiaohongshuImportDir(root: HTMLElement): Promise<void> {
  if (!window.llmWikiDesktop) return;
  const selected = await window.llmWikiDesktop.chooseTargetVault();
  if (!selected) return;
  applyXiaohongshuImportDir(root, selected);
}

async function saveXiaohongshuImportDir(root: HTMLElement): Promise<void> {
  const input = root.querySelector<HTMLInputElement>("[data-xhs-import-dir-input]");
  if (!input) return;
  try {
    const importDirPath = readRequiredControlValue(input, "请先选择导入文件夹地址");
    const response = await fetch("/api/import/xiaohongshu/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importDirPath }),
    });
    const payload = await readJsonPayload<{ success?: boolean; data?: XiaohongshuImportConfigResponse; error?: string; message?: string }>(response);
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "导入文件夹保存失败");
    }
    applyXiaohongshuImportDir(root, payload.data.importDirPath);
    updateSettingsStatus(root, payload.message ?? "导入文件夹已保存");
  } catch (error) {
    updateSettingsStatus(root, readErrorMessage(error));
  }
}

async function clearXiaohongshuImportDir(root: HTMLElement): Promise<void> {
  try {
    const response = await fetch("/api/import/xiaohongshu/config", {
      method: "DELETE",
    });
    const payload = await readJsonPayload<{ success?: boolean; error?: string; message?: string }>(response);
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? "导入文件夹删除失败");
    }
    applyXiaohongshuImportDir(root, "");
    updateSettingsStatus(root, payload.message ?? "导入文件夹已删除");
  } catch (error) {
    updateSettingsStatus(root, readErrorMessage(error));
  }
}

async function syncXiaohongshuFavorites(root: HTMLElement): Promise<void> {
  renderXiaohongshuProgress(root, {
    taskId: xiaohongshuImportState.get(root)?.taskId ?? null,
    progress: 0,
    status: "importing",
    message: "正在读取小红书收藏并批量同步...",
    importDirPath: currentXiaohongshuImportDir(root),
  });
  try {
    const { endpoint, requestBody } = await resolveXiaohongshuFavoritesRequest();
    const payload = await requestXiaohongshuFavoritesSync(endpoint, requestBody);
    const progress = payload.progress ?? { current: payload.queued, total: payload.queued, percent: 100 };
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: progress.percent,
      status: payload.status === "failed" ? "error" : "success",
      message: payload.message,
      importDirPath: currentXiaohongshuImportDir(root),
    });
    renderXhsProgress(root, "extract", progress);
  } catch (error) {
    renderXiaohongshuProgress(root, {
      taskId: null,
      progress: 0,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function hydrateXiaohongshuImportProgress(root: HTMLElement, taskId?: string): Promise<void> {
  const state = xiaohongshuImportState.get(root);
  try {
    const suffix = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
    const response = await fetch(`/api/import/xiaohongshu/progress${suffix}`);
    const payload = await readJsonPayload<XiaohongshuImportProgressResponse & { success?: boolean; error?: string }>(response);
    if (!response.ok) {
      throw new Error(payload.error ?? "小红书导入进度读取失败");
    }
    renderXiaohongshuImportState(root, payload);
  } catch (error) {
    renderXiaohongshuImportState(root, {
      taskId: taskId ?? null,
      progress: 0,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      hasCookie: Boolean(state?.cookie.trim()),
      importDirPath: state?.importDirPath ?? "",
    });
  }
}

function renderXiaohongshuImportState(root: HTMLElement, progress: XiaohongshuImportProgressResponse): void {
  const next = buildXiaohongshuImportState(xiaohongshuImportState.get(root), progress);
  xiaohongshuImportState.set(root, next.nextState);
  renderXiaohongshuImportProgressFields(root, progress, next.nextImportDirPath);
  updateSettingsStatus(root, progress.message);
}

function renderDouyinCookieState(root: HTMLElement, state: DouyinCookieState): void {
  douyinCookieState.set(root, state);
  const light = root.querySelector<HTMLElement>("[data-douyin-cookie-light]");
  const status = root.querySelector<HTMLElement>("[data-douyin-cookie-status]");
  const path = root.querySelector<HTMLElement>("[data-douyin-cookie-path]");
  if (light) {
    light.textContent = state.hasCookie ? "已保存" : "未保存";
  }
  if (status) {
    status.textContent = state.message ?? "未开始";
  }
  if (path) {
    path.textContent = state.path ? `保存位置：${state.path}` : "";
  }
  updateSettingsStatus(root, state.message ?? "未开始");
}

function startXiaohongshuImportPolling(root: HTMLElement, taskId: string): void {
  stopXiaohongshuImportPolling(root);
  const poll = async () => {
    await hydrateXiaohongshuImportProgress(root, taskId);
    const state = xiaohongshuImportState.get(root);
    if (!state || state.taskId !== taskId) return;
    if (state.status === "success" || state.status === "error") {
      stopXiaohongshuImportPolling(root);
      return;
    }
    const handle = window.setTimeout(() => {
      void poll();
    }, 1200);
    xiaohongshuImportPollers.set(root, handle);
  };
  void poll();
}

function stopXiaohongshuImportPolling(root: HTMLElement): void {
  const handle = xiaohongshuImportPollers.get(root);
  if (typeof handle === "number") {
    window.clearTimeout(handle);
    xiaohongshuImportPollers.delete(root);
  }
}

function updateSettingsStatus(root: HTMLElement, message: string): void {
  const status = root.querySelector<HTMLElement>("[data-settings-status]");
  if (status) status.textContent = message;
}

function bindLegacySettingsControls(root: HTMLElement): void {
  const targetInput = root.querySelector<HTMLInputElement>("[data-settings-target]");
  const sourceList = root.querySelector<HTMLUListElement>("[data-settings-sources]");
  const status = root.querySelector<HTMLElement>("[data-settings-status]");
  const shortcutInput = root.querySelector<HTMLInputElement>("[data-shortcut-id=\"flashDiaryCapture\"]");
  const shortcutStatus = root.querySelector<HTMLElement>("[data-shortcut-status]");
  if (!targetInput || !sourceList || !status || !shortcutInput || !shortcutStatus) return;

  root.querySelector<HTMLButtonElement>("[data-settings-choose-target]")?.addEventListener("click", async () => {
    const selected = await window.llmWikiDesktop?.chooseTargetVault();
    if (selected) targetInput.value = selected;
  });

  root.querySelector<HTMLButtonElement>("[data-settings-add-source]")?.addEventListener("click", async () => {
    const selected = await window.llmWikiDesktop?.chooseSourceFolders();
    if (!selected || selected.length === 0) return;
    renderSources(sourceList, [...new Set([...readSources(sourceList), ...selected])]);
  });

  root.querySelector<HTMLButtonElement>("[data-settings-save]")?.addEventListener("click", async () => {
    const target = targetInput.value.trim();
    const sources = readSources(sourceList);
    if (!target || sources.length === 0) {
      status.textContent = "\u9700\u8981\u5148\u586b\u5199\u76ee\u6807\u4ed3\u5e93\u548c\u81f3\u5c11\u4e00\u4e2a\u540c\u6b65\u6e90\u3002";
      return;
    }
    try {
      await window.llmWikiDesktop?.saveDesktopConfig(target);
      await window.llmWikiDesktop?.saveAppConfig({ targetRepoPath: target, sourceFolders: sources });
      status.textContent = "\u5df2\u4fdd\u5b58\u3002";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  root.querySelector<HTMLButtonElement>("[data-shortcut-save=\"flashDiaryCapture\"]")?.addEventListener("click", async () => {
    if (!window.llmWikiDesktop) {
      shortcutStatus.textContent = "\u5feb\u6377\u952e\u53ea\u80fd\u5728 Electron \u684c\u9762\u7aef\u4fee\u6539\u3002";
      return;
    }
    try {
      const result = await window.llmWikiDesktop.saveShortcut({
        id: "flashDiaryCapture",
        accelerator: shortcutInput.value.trim(),
      });
      shortcutInput.value = result.shortcuts.flashDiaryCapture;
      shortcutStatus.textContent = result.registered
        ? "\u5feb\u6377\u952e\u5df2\u4fdd\u5b58\u5e76\u6ce8\u518c\u3002"
        : `\u5df2\u4fdd\u5b58\uff0c\u4f46\u6ce8\u518c\u5931\u8d25\uff1a${result.error ?? shortcutInput.value}`;
    } catch (error) {
      shortcutStatus.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  void hydrateSettings(targetInput, sourceList, status, shortcutInput, shortcutStatus);
}

interface SyncRunPanelElements {
  statusNode: HTMLElement;
  metaNode: HTMLElement;
  progressNode: HTMLElement;
  summaryNode: HTMLElement;
  logNode: HTMLElement;
  pauseButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  refreshButton: HTMLButtonElement;
  compileStatusNode: HTMLElement;
  compileMetaNode: HTMLElement;
  compileProgressNode: HTMLElement;
  compileSummaryNode: HTMLElement;
  compileLogNode: HTMLElement;
  compileRefreshButton: HTMLButtonElement;
}

interface SyncRunPanelState {
  currentRunId: string | null;
  currentRun: RunSnapshot | null;
  eventSource: EventSource | null;
}

function readSyncRunPanelElements(root: HTMLElement): SyncRunPanelElements | null {
  const statusNode = root.querySelector<HTMLElement>("[data-sync-run-status]");
  const metaNode = root.querySelector<HTMLElement>("[data-sync-run-meta]");
  const progressNode = root.querySelector<HTMLElement>("[data-sync-run-progress]");
  const summaryNode = root.querySelector<HTMLElement>("[data-sync-run-summary]");
  const logNode = root.querySelector<HTMLElement>("[data-sync-run-log]");
  const pauseButton = root.querySelector<HTMLButtonElement>("[data-sync-run-pause]");
  const cancelButton = root.querySelector<HTMLButtonElement>("[data-sync-run-cancel]");
  const refreshButton = root.querySelector<HTMLButtonElement>("[data-sync-run-refresh]");
  const compileStatusNode = root.querySelector<HTMLElement>("[data-compile-run-status]");
  const compileMetaNode = root.querySelector<HTMLElement>("[data-compile-run-meta]");
  const compileProgressNode = root.querySelector<HTMLElement>("[data-compile-run-progress]");
  const compileSummaryNode = root.querySelector<HTMLElement>("[data-compile-run-summary]");
  const compileLogNode = root.querySelector<HTMLElement>("[data-compile-run-log]");
  const compileRefreshButton = root.querySelector<HTMLButtonElement>("[data-compile-run-refresh]");
  const elements = [
    statusNode,
    metaNode,
    progressNode,
    summaryNode,
    logNode,
    pauseButton,
    cancelButton,
    refreshButton,
    compileStatusNode,
    compileMetaNode,
    compileProgressNode,
    compileSummaryNode,
    compileLogNode,
    compileRefreshButton,
  ];
  if (elements.some((element) => !element)) {
    return null;
  }
  return {
    statusNode: statusNode!,
    metaNode: metaNode!,
    progressNode: progressNode!,
    summaryNode: summaryNode!,
    logNode: logNode!,
    pauseButton: pauseButton!,
    cancelButton: cancelButton!,
    refreshButton: refreshButton!,
    compileStatusNode: compileStatusNode!,
    compileMetaNode: compileMetaNode!,
    compileProgressNode: compileProgressNode!,
    compileSummaryNode: compileSummaryNode!,
    compileLogNode: compileLogNode!,
    compileRefreshButton: compileRefreshButton!,
  };
}

function closeSyncRunStream(state: SyncRunPanelState): void {
  state.eventSource?.close();
  state.eventSource = null;
}

function formatRunLogLines(lines: readonly RunLine[], emptyText: string): string {
  return lines.length > 0
    ? lines.map((line) => `[${formatTime(line.at)}] ${line.source}: ${line.text}`).join("\n")
    : emptyText;
}

function renderIdleSyncRun(elements: SyncRunPanelElements, state: SyncRunPanelState): void {
  state.currentRunId = null;
  elements.statusNode.textContent = "\u5f85\u8fd0\u884c";
  elements.metaNode.textContent = "\u8fd8\u6ca1\u6709\u68c0\u6d4b\u5230 sync run \u8bb0\u5f55\u3002";
  elements.progressNode.style.width = "0%";
  elements.summaryNode.innerHTML = `<span class="settings-run-panel__chip">\u672a\u542f\u52a8</span>`;
  elements.logNode.textContent = "\u6682\u65e0\u8fd0\u884c\u8f93\u51fa";
  elements.compileStatusNode.textContent = "\u5f85\u8fd0\u884c";
  elements.compileMetaNode.textContent = "\u8fd8\u6ca1\u6709\u68c0\u6d4b\u5230; compile \u8fdb\u5ea6\u3002";
  elements.compileProgressNode.style.width = "0%";
  elements.compileSummaryNode.innerHTML = `<span class="settings-run-panel__chip">\u672a\u542f\u52a8</span>`;
  elements.compileLogNode.textContent = "\u6682\u65e0\u7f16\u8bd1\u8f93\u51fa";
  elements.pauseButton.disabled = true;
  elements.cancelButton.disabled = true;
}

function renderSyncRunSnapshot(
  elements: SyncRunPanelElements,
  state: SyncRunPanelState,
  run: RunSnapshot | null,
): void {
  state.currentRun = run;
  if (!run || run.kind !== "sync") {
    renderIdleSyncRun(elements, state);
    return;
  }

  state.currentRunId = run.id;
  const progress = deriveSyncProgress(run);
  const compileProgress = deriveCompileProgress(run);
  const compileLines = filterCompileLines(run);
  elements.statusNode.textContent = formatRunStatus(run.status);
  elements.metaNode.textContent = formatRunMeta(run);
  elements.progressNode.style.width = `${progress.percent}%`;
  elements.summaryNode.innerHTML = renderRunSummary(progress);
  elements.logNode.textContent = formatRunLogLines(run.lines, "\u6682\u65e0\u8fd0\u884c\u8f93\u51fa");
  elements.compileStatusNode.textContent = formatRunStatus(run.status);
  elements.compileMetaNode.textContent = formatCompileMeta(run, compileLines.length);
  elements.compileProgressNode.style.width = `${compileProgress.percent}%`;
  elements.compileSummaryNode.innerHTML = renderRunSummary(compileProgress);
  elements.compileLogNode.textContent = formatRunLogLines(compileLines, "\u6682\u65e0\u7f16\u8bd1\u8f93\u51fa");
  elements.pauseButton.disabled = run.status !== "running";
  elements.cancelButton.disabled = run.status !== "running";
}

function attachSyncRunStream(
  elements: SyncRunPanelElements,
  state: SyncRunPanelState,
  runId: string,
): void {
  closeSyncRunStream(state);
  state.eventSource = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  state.eventSource.addEventListener("status", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as { run?: RunSnapshot };
    if (!payload.run) {
      return;
    }
    renderSyncRunSnapshot(elements, state, payload.run);
    if (payload.run.status !== "running") {
      closeSyncRunStream(state);
    }
  });
  state.eventSource.addEventListener("line", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as { line?: RunLine };
    if (!payload.line || !state.currentRun || state.currentRun.id !== runId) {
      return;
    }
    renderSyncRunSnapshot(elements, state, {
      ...state.currentRun,
      lines: [...state.currentRun.lines, payload.line],
    });
  });
  state.eventSource.onerror = () => {
    closeSyncRunStream(state);
  };
}

async function readCurrentSyncRunSnapshot(): Promise<RunSnapshot | null> {
  const response = await fetch("/api/runs/current");
  const payload = (await response.json()) as RunResponse;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error ?? "sync run status load failed");
  }
  return payload.data && payload.data.kind === "sync" ? payload.data : null;
}

function renderSyncRunLoadFailure(
  elements: SyncRunPanelElements,
  state: SyncRunPanelState,
  message: string,
): void {
  closeSyncRunStream(state);
  elements.statusNode.textContent = "\u8bfb\u53d6\u5931\u8d25";
  elements.metaNode.textContent = message;
  elements.progressNode.style.width = "0%";
  elements.summaryNode.innerHTML = `<span class="settings-run-panel__chip is-error">\u8bfb\u53d6\u5931\u8d25</span>`;
  elements.logNode.textContent = "\u6682\u65e0\u8fd0\u884c\u8f93\u51fa";
  elements.pauseButton.disabled = true;
  elements.cancelButton.disabled = true;
}

async function refreshSyncRunPanel(
  elements: SyncRunPanelElements,
  state: SyncRunPanelState,
): Promise<void> {
  elements.refreshButton.disabled = true;
  try {
    const run = await readCurrentSyncRunSnapshot();
    renderSyncRunSnapshot(elements, state, run);
    if (run?.status === "running") {
      attachSyncRunStream(elements, state, run.id);
    } else {
      closeSyncRunStream(state);
    }
  } catch (error) {
    renderSyncRunLoadFailure(elements, state, readErrorMessage(error));
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function stopCurrentSyncRun(
  elements: SyncRunPanelElements,
  state: SyncRunPanelState,
  button: HTMLButtonElement,
): Promise<void> {
  if (!state.currentRunId) {
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(state.currentRunId)}/stop`, { method: "POST" });
    const payload = (await response.json()) as RunResponse;
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error ?? "stop run failed");
    }
    renderSyncRunSnapshot(elements, state, payload.data && payload.data.kind === "sync" ? payload.data : null);
    closeSyncRunStream(state);
  } catch (error) {
    elements.metaNode.textContent = readErrorMessage(error);
  } finally {
    button.disabled = false;
  }
}

function bindSyncRunPanel(root: HTMLElement): void {
  const elements = readSyncRunPanelElements(root);
  if (!elements) {
    return;
  }
  const state: SyncRunPanelState = {
    currentRunId: null,
    currentRun: null,
    eventSource: null,
  };

  elements.pauseButton.addEventListener("click", () => {
    void stopCurrentSyncRun(elements, state, elements.pauseButton);
  });
  elements.cancelButton.addEventListener("click", () => {
    void stopCurrentSyncRun(elements, state, elements.cancelButton);
  });
  elements.refreshButton.addEventListener("click", () => {
    void refreshSyncRunPanel(elements, state);
  });
  elements.compileRefreshButton.addEventListener("click", () => {
    void refreshSyncRunPanel(elements, state);
  });
  document.addEventListener("llmwiki:run-started", ((event: Event) => {
    const detail = (event as CustomEvent<{ kind?: RunKind }>).detail;
    if (detail?.kind === "sync") {
      void refreshSyncRunPanel(elements, state);
    }
  }) as EventListener);
  void refreshSyncRunPanel(elements, state);
}

interface SyncRunProgress {
  percent: number;
  chips: string[];
}

interface ProgressStep {
  chip: string;
  keywords: readonly string[];
  percent: number;
}

interface SyncStatusCounts {
  synced: number;
  compiled: number;
  notSynced: number;
  notCompiled: number;
}

const SYNC_PROGRESS_STEPS: readonly ProgressStep[] = [
  { percent: 12, chip: "\u5f00\u59cb\u626b\u63cf", keywords: ["starting sync"] },
  { percent: 28, chip: "\u540c\u6b65\u6e90\u6599", keywords: ["sources_full", "synced markdown", "markdown", "assets"] },
  { percent: 56, chip: "Phase 1", keywords: ["phase 1", "claims"] },
  { percent: 78, chip: "Phase 2", keywords: ["phase 2", "episodes", "procedures"] },
  { percent: 95, chip: "\u6574\u7406\u6700\u7ec8\u7ed3\u679c", keywords: ["final result:"] },
];

const COMPILE_PROGRESS_STEPS: readonly ProgressStep[] = [
  { percent: 12, chip: "\u542f\u52a8 compile", keywords: ["compile"] },
  { percent: 36, chip: "\u6982\u5ff5\u62bd\u53d6", keywords: ["phase 1", "claims"] },
  { percent: 56, chip: "\u5408\u5e76\u6e90\u6599", keywords: ["late affected", "episode"] },
  { percent: 76, chip: "\u751f\u6210 wiki", keywords: ["phase 2", "procedure", "concept"] },
  { percent: 92, chip: "\u91cd\u5efa\u5bfc\u822a", keywords: ["interlink", "index", "moc", "final result"] },
];

const COMPILE_LINE_KEYWORDS = [
  "compile",
  "phase 1",
  "phase 2",
  "claim",
  "episode",
  "procedure",
  "interlink",
  "index",
  "moc",
  "late affected",
  "final result",
  "frozen",
  "orphan",
  "wiki/",
] as const;

function includesAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function deriveProgressFromSteps(
  text: string,
  basePercent: number,
  steps: readonly ProgressStep[],
): SyncRunProgress {
  let percent = basePercent;
  const chips: string[] = [];
  for (const step of steps) {
    if (!includesAnyKeyword(text, step.keywords)) {
      continue;
    }
    percent = Math.max(percent, step.percent);
    chips.push(step.chip);
  }
  return { percent, chips };
}

function finalizeRunProgress(
  run: RunSnapshot,
  progress: SyncRunProgress,
  labels: { failed: string; running: string; stopped: string; succeeded: string },
): SyncRunProgress {
  if (run.status === "succeeded") {
    return { percent: 100, chips: [...progress.chips, labels.succeeded] };
  }
  if (run.status === "failed") {
    return { percent: 100, chips: [...progress.chips, labels.failed] };
  }
  if (run.status === "stopped") {
    return { percent: progress.percent, chips: [...progress.chips, labels.stopped] };
  }
  if (progress.chips.length === 0) {
    return { percent: progress.percent, chips: [labels.running] };
  }
  return progress;
}

function deriveSyncProgress(run: RunSnapshot): SyncRunProgress {
  const joined = run.lines.map((line) => line.text.toLowerCase()).join("\n");
  const progress = deriveProgressFromSteps(joined, 8, SYNC_PROGRESS_STEPS);
  const statusCounts = extractStatusCounts(joined);
  if (statusCounts) {
    progress.chips.push(`已同步 ${statusCounts.synced}`);
    progress.chips.push(`已编译 ${statusCounts.compiled}`);
    progress.chips.push(`未同步 ${statusCounts.notSynced}`);
    progress.chips.push(`未编译 ${statusCounts.notCompiled}`);
  }
  const finalized = finalizeRunProgress(run, progress, {
    succeeded: "\u5df2\u5b8c\u6210",
    failed: "\u8fd0\u884c\u5931\u8d25",
    stopped: "\u5df2\u53d6\u6d88",
    running: "\u8fd0\u884c\u4e2d",
  });
  return {
    percent: clamp(finalized.percent, 0, 100),
    chips: Array.from(new Set(finalized.chips)),
  };
}

function extractStatusCounts(text: string): SyncStatusCounts | null {
  const match = text.match(/status counts:\s*synced\s+(\d+),\s*compiled\s+(\d+),\s*not synced\s+(\d+),\s*not compiled\s+(\d+)/i);
  if (!match) return null;
  return {
    synced: Number(match[1]),
    compiled: Number(match[2]),
    notSynced: Number(match[3]),
    notCompiled: Number(match[4]),
  };
}

function filterCompileLines(run: RunSnapshot): RunLine[] {
  const matched = run.lines.filter((line) => {
    const text = line.text.toLowerCase();
    return includesAnyKeyword(text, COMPILE_LINE_KEYWORDS);
  });
  return matched.length > 0 ? matched : run.lines;
}

function deriveCompileProgress(run: RunSnapshot): SyncRunProgress {
  const joined = filterCompileLines(run).map((line) => line.text.toLowerCase()).join("\n");
  const progress = deriveProgressFromSteps(joined, 6, COMPILE_PROGRESS_STEPS);
  const finalized = finalizeRunProgress(run, progress, {
    succeeded: "\u7f16\u8bd1\u5b8c\u6210",
    failed: "\u7f16\u8bd1\u5931\u8d25",
    stopped: "\u5df2\u53d6\u6d88",
    running: "\u7f16\u8bd1\u7b49\u5f85\u4e2d",
  });
  return {
    percent: clamp(finalized.percent, 0, 100),
    chips: Array.from(new Set(finalized.chips)),
  };
}

function renderRunSummary(progress: SyncRunProgress): string {
  return progress.chips
    .map((chip) => `<span class="settings-run-panel__chip">${escapeHtml(chip)}</span>`)
    .join("");
}

function formatRunStatus(status: RunStatus): string {
  switch (status) {
    case "running":
      return "\u8fd0\u884c\u4e2d";
    case "succeeded":
      return "\u5df2\u5b8c\u6210";
    case "failed":
      return "\u5931\u8d25";
    case "stopped":
      return "\u5df2\u53d6\u6d88";
    default:
      return status;
  }
}

function formatRunMeta(run: RunSnapshot): string {
  const parts = [
    `ID ${run.id.slice(0, 8)}`,
    `\u542f\u52a8 ${formatTime(run.startedAt)}`,
  ];
  if (run.endedAt) {
    parts.push(`\u7ed3\u675f ${formatTime(run.endedAt)}`);
  }
  if (typeof run.exitCode === "number") {
    parts.push(`exit ${run.exitCode}`);
  }
  return parts.join(" · ");
}

function formatCompileMeta(run: RunSnapshot, compileLineCount: number): string {
  const parts = [
    `ID ${run.id.slice(0, 8)}`,
    `\u542f\u52a8 ${formatTime(run.startedAt)}`,
    `\u65e5\u5fd7 ${compileLineCount} \u6761`,
  ];
  if (run.endedAt) {
    parts.push(`\u7ed3\u675f ${formatTime(run.endedAt)}`);
  }
  if (typeof run.exitCode === "number") {
    parts.push(`exit ${run.exitCode}`);
  }
  return parts.join(" · ");
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function bindLlmProviderConfig(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("[data-settings-save]")?.addEventListener("click", () => {
    void saveLlmProviderConfigFromPage(root);
  });
  root.querySelector<HTMLSelectElement>("[data-llm-default-account]")?.addEventListener("change", () => {
    renderLlmDefaultAccountSelection(root);
  });
  void hydrateLlmProviderConfig(root);
  void hydrateLlmProviderAccounts(root);
}

async function hydrateLlmProviderConfig(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-llm-config-status]");
  try {
    const response = await fetch("/api/llm/config");
    const data = await readSuccessData<LlmProviderConfigResponse>(response, "LLM config load failed");
    renderLlmProviderConfig(root, data);
    setOptionalText(status, describeLlmProviderStatus({
      config: data,
      emptyText: "LLM OpenAI-compatible 尚未配置。",
      prefix: "LLM OpenAI-compatible 已配置：",
      resolveHost: readHost,
    }));
  } catch (error) {
    setOptionalText(status, readErrorMessage(error));
  }
}

async function hydrateLlmProviderAccounts(root: HTMLElement): Promise<void> {
  try {
    const response = await fetch("/api/llm/accounts");
    const payload = await readJsonPayload<{ success?: boolean; data?: LlmApiAccountsResponse; error?: string }>(response);
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "LLM accounts load failed");
    }
    llmAccountsState.set(root, payload.data.accounts);
    renderLlmApiAccounts(root, payload.data.accounts);
    void hydrateLlmDefaultAccountOptions(root);
  } catch {
    llmAccountsState.set(root, []);
    void hydrateLlmDefaultAccountOptions(root);
  }
}

async function saveLlmProviderConfigFromPage(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-llm-config-status]");
  setOptionalText(status, "正在保存 LLM 配置...");
  try {
    const response = await fetch("/api/llm/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountRef: readSelectedLlmDefaultAccount(root),
      }),
    });
    const data = await readSuccessData<LlmProviderConfigResponse>(response, "LLM config save failed");
    renderLlmProviderConfig(root, data);
    setOptionalText(status, describeLlmProviderStatus({
      config: data,
      emptyText: "已保存，LLM OpenAI-compatible 地址已清空。",
      prefix: "已保存：",
      resolveHost: readHost,
    }));
  } catch (error) {
    setOptionalText(status, readErrorMessage(error));
  }
}

async function persistLlmAccountRow(row: HTMLElement): Promise<LlmApiAccountResponse> {
  const response = await fetch("/api/llm/accounts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readLlmAccountRow(row)),
  });
  return readSuccessData<LlmApiAccountResponse>(response, "LLM config save failed");
}

function renderSavingLlmAccountStatus(status: HTMLElement | null, button: HTMLButtonElement): void {
  if (status) {
    status.textContent = "正在保存...";
  }
  button.disabled = true;
}

function renderSavedLlmAccountStatus(
  row: HTMLElement,
  status: HTMLElement | null,
  account: LlmApiAccountResponse,
): void {
  row.dataset.llmAccountId = account.id;
  if (status) {
    status.textContent = account.url ? `已保存：${readHost(account.url) ?? account.url}` : "已保存";
  }
}

function renderFailedLlmAccountStatus(status: HTMLElement | null, error: unknown): void {
  if (status) {
    status.textContent = readErrorMessage(error);
  }
}

async function saveLlmAccountRow(root: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const row = button.closest<HTMLElement>("[data-llm-account]");
  if (!row) return;
  const status = row.querySelector<HTMLElement>("[data-llm-account-status]");
  renderSavingLlmAccountStatus(status, button);
  try {
    renderSavedLlmAccountStatus(row, status, await persistLlmAccountRow(row));
    await hydrateLlmProviderAccounts(root);
  } catch (error) {
    renderFailedLlmAccountStatus(status, error);
  } finally {
    button.disabled = false;
  }
}

async function testLlmAccountRow(button: HTMLButtonElement): Promise<void> {
  const row = button.closest<HTMLElement>("[data-llm-account]");
  if (!row) return;
  const status = row.querySelector<HTMLElement>("[data-llm-account-status]");
  setOptionalText(status, "正在验证...");
  button.disabled = true;
  try {
    const response = await fetch("/api/llm/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readLlmAccountRow(row)),
    });
    const data = await readSuccessData<LlmProviderTestResponse>(response, "LLM provider test failed");
    setOptionalText(status, data.message);
  } catch (error) {
    setOptionalText(status, readErrorMessage(error));
  } finally {
    button.disabled = false;
  }
}

function readLlmAccountRow(row: HTMLElement): { id?: string; name: string; provider: string; url: string; key: string; model: string } {
  const provider = row.dataset.llmAccount ?? "openai";
  const id = row.dataset.llmAccountId;
  return {
    ...(id ? { id } : {}),
    name: readProviderInput(row, `${provider}:name`) || provider,
    provider,
    url: readProviderInput(row, `${provider}:url`),
    key: readProviderInput(row, `${provider}:key`),
    model: readProviderInput(row, `${provider}:model`),
  };
}

function renderLlmProviderConfig(root: HTMLElement, config: LlmProviderConfigResponse): void {
  llmConfigState.set(root, config);
  const provider = config.provider || "openai";
  const row = root.querySelector<HTMLElement>(`[data-llm-account="${cssEscape(provider)}"]`) ?? root;
  const urlInput = row.querySelector<HTMLInputElement>(`[data-provider="${cssEscape(provider)}:url"]`);
  const keyInput = row.querySelector<HTMLInputElement>(`[data-provider="${cssEscape(provider)}:key"]`);
  const modelInput = row.querySelector<HTMLSelectElement>(`[data-provider="${cssEscape(provider)}:model"]`);
  if (urlInput) {
    urlInput.value = config.url;
  }
  if (keyInput) {
    keyInput.value = "";
    keyInput.placeholder = config.keyConfigured ? "已保存密钥，重新输入可覆盖" : "";
  }
  if (modelInput) {
    modelInput.innerHTML = renderModelOptions(provider, config.model);
    modelInput.value = config.model;
  }
  renderLlmDefaultAccountSelection(root);
}

function renderLlmApiAccounts(root: HTMLElement, accounts: readonly LlmApiAccountResponse[]): void {
  for (const provider of PROVIDERS) {
    const list = root.querySelector<HTMLElement>(`[data-llm-account-list="${cssEscape(provider.id)}"]`);
    if (!list) continue;
    const providerAccounts = accounts.filter((account) => account.provider === provider.id);
    list.innerHTML = providerAccounts.length > 0
      ? providerAccounts.map((account) => renderLlmAccountRow(provider.id, account)).join("")
      : renderLlmAccountRow(provider.id);
  }
}

async function hydrateLlmDefaultAccountOptions(
  root: HTMLElement,
  oauthAccounts?: readonly CLIProxyOAuthAccountResponse[],
): Promise<void> {
  const apiAccounts = llmAccountsState.get(root) ?? [];
  const resolvedOAuthAccounts = oauthAccounts ?? await loadOptionalCliProxyOAuthAccounts();
  llmDefaultAccountOptionsState.set(root, dedupeAgentAccountOptions(buildLlmDefaultAccountOptions({
    apiAccounts,
    oauthAccounts: resolvedOAuthAccounts,
    getProviderDisplayName,
    formatOAuthProvider: formatCLIProxyProvider,
    providerFromOAuthAccount,
  })));
  renderLlmDefaultAccountOptions(root);
  renderLlmAccountSummary(root);
}

function renderLlmDefaultAccountOptions(root: HTMLElement): void {
  const select = root.querySelector<HTMLSelectElement>("[data-llm-default-account]");
  if (!select) return;
  const rendered = resolveRenderedLlmDefaultOptions({
    options: llmDefaultAccountOptionsState.get(root) ?? [],
    preferredValue: select.value.trim() || llmConfigState.get(root)?.accountRef?.trim() || "",
    fallbackProvider: llmConfigState.get(root)?.provider ?? "openai",
  });
  if (rendered.disabled) {
    select.innerHTML = `<option value="">暂无可用账号</option>`;
    select.value = "";
    select.disabled = true;
    renderLlmDefaultAccountSelection(root);
    return;
  }
  select.disabled = false;
  select.innerHTML = rendered.options
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  select.value = rendered.selectedValue;
  renderLlmDefaultAccountSelection(root);
}

function renderLlmDefaultAccountSelection(root: HTMLElement): void {
  const source = root.querySelector<HTMLElement>("[data-llm-default-source]");
  const provider = root.querySelector<HTMLElement>("[data-llm-default-provider]");
  const model = root.querySelector<HTMLElement>("[data-llm-default-model]");
  const select = root.querySelector<HTMLSelectElement>("[data-llm-default-account]");
  const summary = describeLlmDefaultSelection({
    options: llmDefaultAccountOptionsState.get(root) ?? [],
    config: llmConfigState.get(root) ?? null,
    selectedValue: select?.value.trim() || "",
  });
  if (source) source.textContent = summary.sourceText;
  if (provider) provider.textContent = getProviderDisplayName(summary.providerId);
  if (model) model.textContent = summary.modelText;
}

function renderLlmAccountSummary(root: HTMLElement): void {
  const container = root.querySelector<HTMLElement>("[data-llm-account-summary-list]");
  if (!container) return;
  const options = llmDefaultAccountOptionsState.get(root) ?? [];
  if (options.length === 0) {
    container.innerHTML = `<span class="settings-source-empty">暂无可用账号</span>`;
    return;
  }
  container.innerHTML = options.map((option) => `
    <article class="settings-llm-account-pill">
      <strong>${escapeHtml(option.accountName ?? option.label)}</strong>
      <small>${escapeHtml([
        option.source === "oauth" ? "OAuth" : "API",
        getProviderDisplayName(option.provider),
        option.model,
      ].filter(Boolean).join(" · "))}</small>
    </article>
  `).join("");
}

function renderLlmAccountRow(providerId: string, account?: Partial<LlmApiAccountResponse>): string {
  const rowView = describeLlmAccountRowView(defaultProviderEndpoint(providerId), account);
  return `
    <div class="settings-account-row" data-llm-account="${escapeHtml(providerId)}"${rowView.accountId ? ` data-llm-account-id="${escapeHtml(rowView.accountId)}"` : ""}>
      <label class="settings-field"><span>&#x8d26;&#x6237;&#x540d;</span><input data-provider="${escapeHtml(providerId)}:name" type="text" value="${escapeHtml(rowView.nameValue)}" /></label>
      <label class="settings-field"><span>&#x5730;&#x5740;</span><input data-provider="${escapeHtml(providerId)}:url" type="text" value="${escapeHtml(rowView.urlValue)}" /></label>
      <label class="settings-field"><span>&#x5bc6;&#x94a5;</span><input data-provider="${escapeHtml(providerId)}:key" type="password" placeholder="${rowView.keyPlaceholder}" /></label>
      <label class="settings-field"><span>&#x6a21;&#x578b;</span><select data-provider="${escapeHtml(providerId)}:model">${renderModelOptions(providerId, rowView.modelValue)}</select></label>
      <button type="button" class="btn btn-secondary btn-inline" data-llm-account-test>&#x9a8c;&#x8bc1;</button>
      <button type="button" class="btn btn-primary btn-inline" data-llm-account-save>&#x4fdd;&#x5b58;</button>
      <button type="button" class="btn btn-secondary btn-inline" data-llm-account-delete>&#x5220;&#x9664;</button>
      <span class="settings-account-row__status" data-llm-account-status></span>
    </div>
  `;
}

async function deleteLlmAccountRow(root: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const row = button.closest<HTMLElement>("[data-llm-account]");
  if (!row) return;
  const accountId = row.dataset.llmAccountId;
  if (!accountId) {
    row.remove();
    return;
  }
  const response = await fetch("/api/llm/accounts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: accountId }),
  });
  const payload = await readJsonPayload<{ success?: boolean; error?: string }>(response);
  if (!response.ok || !payload.success) {
    const status = row.querySelector<HTMLElement>("[data-llm-account-status]");
    if (status) status.textContent = payload.error ?? "删除失败";
    return;
  }
  row.remove();
  await hydrateLlmProviderAccounts(root);
}

function bindAgentConfigControls(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("[data-agent-config-add]")?.addEventListener("click", () => {
    syncAgentFormToState(root);
    const config = appConfigState.get(root) ?? { apps: [], defaultAppId: null };
    const agent = createClientAgent();
    config.apps = [...config.apps, agent];
    config.defaultAppId = agent.id;
    renderAgentConfig(root, config);
    setAgentConfigStatus(root, "\u65b0\u5e94\u7528\u5df2\u6dfb\u52a0\uff0c\u8bf7\u8865\u5145\u540e\u4fdd\u5b58\u3002");
  });
  root.querySelector<HTMLButtonElement>("[data-agent-config-save]")?.addEventListener("click", () => {
    void saveAgentConfigFromPage(root);
  });
  root.querySelector<HTMLButtonElement>("[data-agent-config-delete]")?.addEventListener("click", () => {
    deleteSelectedAgent(root);
  });
  root.querySelector<HTMLElement>("[data-agent-config-editor]")?.addEventListener("input", () => {
    syncAgentFormToState(root);
  });
  root.querySelector<HTMLElement>("[data-agent-config-editor]")?.addEventListener("change", () => {
    syncAgentFormToState(root);
  });
  root.querySelector<HTMLSelectElement>("[data-agent-config-field=\"provider\"]")?.addEventListener("change", () => {
    syncAgentAccountSelection(root);
    void hydrateAgentModelOptions(root);
  });
  root.querySelector<HTMLSelectElement>("[data-agent-config-field=\"accountRef\"]")?.addEventListener("change", () => {
    applySelectedAgentAccount(root);
    syncAgentFormToState(root);
  });
  void hydrateAgentConfig(root);
  void hydrateAgentAccountOptions(root);
}

async function hydrateAgentConfig(root: HTMLElement): Promise<void> {
  try {
    const response = await fetch("/api/app-config");
    const payload = (await response.json()) as { success?: boolean; data?: AppConfigResponse; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "App config load failed");
    }
    renderAgentConfig(root, payload.data);
    setAgentConfigStatus(root, payload.data.path ? `\u5e94\u7528\u914d\u7f6e\u5df2\u8bfb\u53d6\uff1a${payload.data.path}` : "\u5e94\u7528\u914d\u7f6e\u5df2\u8bfb\u53d6\u3002");
    syncAutomationAppOptions(root);
  } catch (error) {
    setAgentConfigStatus(root, error instanceof Error ? error.message : String(error));
  }
}

async function hydrateAgentAccountOptions(root: HTMLElement): Promise<void> {
  const options: AgentAccountOption[] = [{ value: "", label: "跟随应用资源默认配置", provider: "openai" }];
  try {
    const response = await fetch("/api/llm/accounts");
    const payload = await readJsonPayload<{ success?: boolean; data?: LlmApiAccountsResponse; error?: string }>(response);
    if (response.ok && payload.success && payload.data) {
      for (const account of payload.data.accounts) {
        options.push({
          value: `api:${account.id}`,
          label: `API · ${getProviderDisplayName(account.provider)} · ${account.name}`,
          provider: account.provider,
          model: account.model,
          source: "api",
          accountName: account.name,
        });
      }
    }
  } catch {
    // API accounts are optional for agent configuration.
  }
  try {
    const accounts = await fetchCLIProxyOAuthAccounts(false);
    for (const account of accounts) {
      options.push({
        value: `oauth:${account.provider}:${account.name}`,
        label: `OAuth · ${formatCLIProxyProvider(account.provider)} · ${account.email ?? account.name}`,
        provider: providerFromOAuthAccount(account.provider),
        source: "oauth",
        accountName: account.name,
      });
    }
  } catch {
    // OAuth accounts are optional for agent configuration.
  }
  agentAccountOptionsState.set(root, dedupeAgentAccountOptions(options));
  syncAgentAccountSelection(root);
  await hydrateAgentModelOptions(root);
}

function renderAgentAccountOptions(root: HTMLElement, selected: string): void {
  const select = root.querySelector<HTMLSelectElement>("[data-agent-config-field=\"accountRef\"]");
  if (!select) return;
  const options = visibleAgentAccountOptions(root);
  const hasSelected = options.some((option) => option.value === selected);
  const fullOptions = hasSelected || !selected
    ? options
    : [...options, { value: selected, label: `已保存账号 · ${selected}`, provider: "openai" }];
  select.innerHTML = fullOptions
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  select.value = selected;
}

function applySelectedAgentAccount(root: HTMLElement): void {
  const selected = readAgentField(root, "accountRef");
  const option = (agentAccountOptionsState.get(root) ?? []).find((item) => item.value === selected);
  if (!option || !selected) return;
  setAgentField(root, "provider", option.provider);
  syncAgentAccountSelection(root);
  void hydrateAgentModelOptions(root, option.model);
}

async function loadAgentModelOptions(
  provider: string,
  accountRef: string,
  accountName?: string,
): Promise<string[]> {
  const models = [...(MODEL_OPTIONS_BY_PROVIDER[provider] ?? [])];
  if (!accountRef.startsWith("oauth:") || !accountName) {
    return models;
  }
  try {
    const oauthModels = await fetchCLIProxyAccountModels(accountName);
    return oauthModels.length > 0 ? oauthModels : models;
  } catch {
    return models;
  }
}

function resolveAgentModelSelection(
  preferredModel: string | undefined,
  currentModel: string,
  accountModel?: string,
): string {
  if (preferredModel) {
    return preferredModel;
  }
  if (currentModel) {
    return currentModel;
  }
  return accountModel ?? "";
}

async function hydrateAgentModelOptions(root: HTMLElement, preferredModel?: string): Promise<void> {
  const provider = readAgentField(root, "provider") || "openai";
  const accountRef = readAgentField(root, "accountRef");
  const select = root.querySelector<HTMLSelectElement>("[data-agent-config-field=\"model\"]");
  if (!select) return;
  const selectedAccount = (agentAccountOptionsState.get(root) ?? []).find((item) => item.value === accountRef);
  const models = await loadAgentModelOptions(provider, accountRef, selectedAccount?.accountName);
  const selected = resolveAgentModelSelection(
    preferredModel,
    readAgentField(root, "model"),
    selectedAccount?.model,
  );
  select.innerHTML = renderModelOptionsFromList(models, selected);
  if (selected && [...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  }
}

function dedupeAgentAccountOptions(options: AgentAccountOption[]): AgentAccountOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function syncAgentAccountSelection(root: HTMLElement): void {
  const nextSelected = resolveAgentAccountSelection(root);
  renderAgentAccountOptions(root, nextSelected);
  setAgentField(root, "accountRef", nextSelected);
}

function visibleAgentAccountOptions(root: HTMLElement): AgentAccountOption[] {
  const options = agentAccountOptionsState.get(root) ?? [{ value: "", label: "跟随应用资源默认配置", provider: "openai" }];
  return [...options];
}

function resolveAgentAccountSelection(root: HTMLElement): string {
  const provider = readAgentField(root, "provider") || "openai";
  const selected = readAgentField(root, "accountRef");
  const visibleOptions = visibleAgentAccountOptions(root);
  if (selected && visibleOptions.some((option) => option.value === selected)) {
    return selected;
  }
  const matchingOptions = visibleOptions.filter((option) => option.value !== "" && option.provider === provider);
  if (matchingOptions.length === 1) {
    return matchingOptions[0]?.value ?? "";
  }
  return "";
}

function getProviderDisplayName(providerId: string): string {
  return PROVIDERS.find((provider) => provider.id === providerId)?.name ?? providerId;
}

function defaultProviderEndpoint(providerId: string): string {
  return PROVIDERS.find((provider) => provider.id === providerId)?.endpoint ?? "";
}

function providerFromOAuthAccount(provider: string): string {
  switch (provider) {
    case "gemini-cli":
    case "gemini":
      return "gemini";
    case "anthropic":
      return "anthropic";
    case "codex":
      return "codex-cli";
    case "kimi":
      return "kimi-global";
    default:
      return provider;
  }
}

async function saveAgentConfigFromPage(root: HTMLElement): Promise<void> {
  syncAgentFormToState(root);
  const config = appConfigState.get(root) ?? { apps: [], defaultAppId: null };
  setAgentConfigStatus(root, "\u6b63\u5728\u4fdd\u5b58\u5e94\u7528\u914d\u7f6e...");
  try {
    const response = await fetch("/api/app-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const payload = (await response.json()) as { success?: boolean; data?: AppConfigResponse; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "App config save failed");
    }
    renderAgentConfig(root, payload.data);
    setAgentConfigStatus(root, payload.data.path ? `\u5df2\u4fdd\u5b58\uff1a${payload.data.path}` : "\u5df2\u4fdd\u5b58\u5e94\u7528\u914d\u7f6e\u3002");
    syncAutomationAppOptions(root);
  } catch (error) {
    setAgentConfigStatus(root, error instanceof Error ? error.message : String(error));
  }
}

function renderAgentConfig(root: HTMLElement, config: AppConfigResponse): void {
  const normalized = normalizeClientAgentConfig(config);
  appConfigState.set(root, normalized);
  const list = root.querySelector<HTMLElement>("[data-agent-config-list]");
  if (list) {
    list.innerHTML = normalized.apps.length > 0
      ? normalized.apps.map((agent) => renderAgentListItem(agent, agent.id === normalized.defaultAppId)).join("")
      : `<div class="settings-source-empty">\u6682\u65e0\u5e94\u7528\uff0c\u70b9\u51fb\u201c\u65b0\u589e\u5e94\u7528\u201d\u521b\u5efa\u3002</div>`;
    list.querySelectorAll<HTMLButtonElement>("[data-agent-config-select]").forEach((button) => {
      button.addEventListener("click", () => {
        syncAgentFormToState(root);
        const state = appConfigState.get(root);
        if (!state) return;
        state.defaultAppId = button.dataset.agentConfigSelect ?? null;
        renderAgentConfig(root, state);
      });
    });
  }
  renderAgentEditor(root, normalized.apps.find((agent) => agent.id === normalized.defaultAppId) ?? null);
}

function renderAgentListItem(agent: AppDefinitionResponse, active: boolean): string {
  return `
    <button type="button" class="settings-agent-config__item" data-agent-config-select="${escapeHtml(agent.id)}" data-active="${active ? "true" : "false"}">
      <span>${agent.enabled ? "\u25cf" : "\u25cb"}</span>
      <strong>${escapeHtml(agent.name)}</strong>
      <small>${escapeHtml(`${formatAppModeLabel(agent.mode)} · ${agent.purpose || "\u672a\u586b\u5199\u7528\u9014"}`)}</small>
    </button>
  `;
}

function readAgentEditorFields(agent: AppDefinitionResponse | null): Array<[string, string]> {
  if (!agent) {
    return [
      ["id", ""],
      ["name", ""],
      ["mode", "chat"],
      ["purpose", ""],
      ["provider", "openai"],
      ["workflow", ""],
      ["prompt", ""],
    ];
  }
  return [
    ["id", agent.id],
    ["name", agent.name],
    ["mode", agent.mode],
    ["purpose", agent.purpose],
    ["provider", agent.provider],
    ["workflow", agent.workflow],
    ["prompt", agent.prompt],
  ];
}

function renderAgentEditor(root: HTMLElement, agent: AppDefinitionResponse | null): void {
  for (const [key, value] of readAgentEditorFields(agent)) {
    setAgentField(root, key, value);
  }
  renderAgentAccountOptions(root, agent?.accountRef ?? "");
  void hydrateAgentModelOptions(root, agent?.model ?? "");
  const enabled = root.querySelector<HTMLInputElement>("[data-agent-config-field=\"enabled\"]");
  if (enabled) enabled.checked = agent?.enabled ?? false;
}

function syncAgentFormToState(root: HTMLElement): void {
  const config = appConfigState.get(root);
  if (!config) return;
  const editorAgentId = readAgentField(root, "id");
  const activeAgentId = editorAgentId || config.defaultAppId;
  if (!activeAgentId) return;
  const index = config.apps.findIndex((agent) => agent.id === activeAgentId);
  if (index < 0) return;
  config.defaultAppId = activeAgentId;
  config.apps[index] = {
    ...config.apps[index]!,
    name: readAgentField(root, "name") || config.apps[index]!.name,
    mode: normalizeAppMode(readAgentField(root, "mode")),
    purpose: readAgentField(root, "purpose"),
    provider: readAgentField(root, "provider") || "openai",
    accountRef: readAgentField(root, "accountRef"),
    model: readAgentField(root, "model"),
    workflow: readAgentField(root, "workflow"),
    prompt: readAgentField(root, "prompt"),
    enabled: root.querySelector<HTMLInputElement>("[data-agent-config-field=\"enabled\"]")?.checked ?? false,
    updatedAt: new Date().toISOString(),
  };
}

function deleteSelectedAgent(root: HTMLElement): void {
  const config = appConfigState.get(root);
  if (!config?.defaultAppId) return;
  config.apps = config.apps.filter((agent) => agent.id !== config.defaultAppId);
  config.defaultAppId = config.apps.find((agent) => agent.enabled)?.id ?? config.apps[0]?.id ?? null;
  renderAgentConfig(root, config);
  setAgentConfigStatus(root, "\u5df2\u79fb\u9664\u5e94\u7528\uff0c\u8bf7\u4fdd\u5b58\u540e\u751f\u6548\u3002");
}

function createClientAgent(): AppDefinitionResponse {
  const now = new Date().toISOString();
  return {
    id: `app-${Date.now()}`,
    name: "\u65b0\u5e94\u7528",
    mode: "chat",
    purpose: "",
    provider: "openai",
    accountRef: "",
    model: "",
    workflow: "",
    prompt: "",
    enabled: true,
    updatedAt: now,
  };
}

function normalizeClientAgentConfig(config: AppConfigResponse): AppConfigResponse {
  const defaultAppId = config.defaultAppId && config.apps.some((agent) => agent.id === config.defaultAppId)
    ? config.defaultAppId
    : config.apps.find((agent) => agent.enabled)?.id ?? config.apps[0]?.id ?? null;
  return {
    ...config,
    apps: config.apps.map((agent) => ({ ...agent, mode: normalizeAppMode(agent.mode), accountRef: agent.accountRef ?? "" })),
    defaultAppId,
  };
}

function normalizeAppMode(value: string): AppDefinitionResponse["mode"] {
  return value === "workflow" || value === "knowledge" || value === "hybrid" ? value : "chat";
}

function formatAppModeLabel(mode: AppDefinitionResponse["mode"]): string {
  switch (mode) {
    case "workflow":
      return "工作流";
    case "knowledge":
      return "知识";
    case "hybrid":
      return "混合";
    default:
      return "对话";
  }
}

function setAgentField(root: HTMLElement, key: string, value: string): void {
  const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-agent-config-field="${cssEscape(key)}"]`);
  if (field) field.value = value;
}

function readAgentField(root: HTMLElement, key: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-agent-config-field="${cssEscape(key)}"]`)?.value.trim() ?? "";
}

function setAgentConfigStatus(root: HTMLElement, text: string): void {
  const status = root.querySelector<HTMLElement>("[data-agent-config-status]");
  if (status) status.textContent = text;
}

function bindAutomationConfigControls(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("[data-automation-config-add]")?.addEventListener("click", () => {
    syncAutomationFormToState(root);
    const config = automationConfigState.get(root) ?? { automations: [] };
    const automation = createClientAutomation(root);
    config.automations = [...config.automations, automation];
    renderAutomationConfig(root, config);
    setAutomationConfigStatus(root, "新自动化已添加，请补充后保存。");
  });
  root.querySelector<HTMLButtonElement>("[data-automation-config-save]")?.addEventListener("click", () => {
    void saveAutomationConfigFromPage(root);
  });
  root.querySelector<HTMLButtonElement>("[data-automation-config-delete]")?.addEventListener("click", () => {
    deleteSelectedAutomation(root);
  });
  root.querySelector<HTMLElement>("[data-automation-config-editor]")?.addEventListener("input", () => {
    syncAutomationFormToState(root);
  });
  root.querySelector<HTMLElement>("[data-automation-config-editor]")?.addEventListener("change", () => {
    syncAutomationFormToState(root);
  });
  void hydrateAutomationConfig(root);
}

async function hydrateAutomationConfig(root: HTMLElement): Promise<void> {
  try {
    const response = await fetch("/api/automations");
    const payload = (await response.json()) as { success?: boolean; data?: AutomationConfigResponse; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Automation config load failed");
    }
    renderAutomationConfig(root, payload.data);
    setAutomationConfigStatus(root, payload.data.path ? `自动化已读取：${payload.data.path}` : "自动化已读取。");
  } catch (error) {
    setAutomationConfigStatus(root, error instanceof Error ? error.message : String(error));
  }
}

async function saveAutomationConfigFromPage(root: HTMLElement): Promise<void> {
  setAutomationConfigStatus(root, "正在保存自动化...");
  try {
    syncAutomationFormToState(root, { strictFlow: true });
    const config = automationConfigState.get(root) ?? { automations: [] };
    const response = await fetch("/api/automations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const payload = (await response.json()) as { success?: boolean; data?: AutomationConfigResponse; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Automation config save failed");
    }
    renderAutomationConfig(root, payload.data);
    setAutomationConfigStatus(root, payload.data.path ? `已保存：${payload.data.path}` : "已保存自动化。");
  } catch (error) {
    setAutomationConfigStatus(root, error instanceof Error ? error.message : String(error));
  }
}

function renderAutomationConfig(root: HTMLElement, config: AutomationConfigResponse): void {
  const normalized = normalizeAutomationConfig(config);
  automationConfigState.set(root, normalized);
  const list = root.querySelector<HTMLElement>("[data-automation-config-list]");
  if (list) {
    const selectedId = normalized.automations[0]?.id ?? null;
    list.innerHTML = normalized.automations.length > 0
      ? normalized.automations.map((automation) => `
        <button type="button" class="settings-agent-config__item" data-automation-config-select="${escapeHtml(automation.id)}" data-active="${automation.id === selectedId ? "true" : "false"}">
          <span>${automation.enabled ? "●" : "○"}</span>
          <strong>${escapeHtml(automation.name)}</strong>
          <small>${escapeHtml(`${formatAutomationTriggerLabel(automation.trigger)} · ${automation.appId}`)}</small>
        </button>
      `).join("")
      : `<div class="settings-source-empty">暂无自动化，点击“新增自动化”创建。</div>`;
    list.querySelectorAll<HTMLButtonElement>("[data-automation-config-select]").forEach((button) => {
      button.addEventListener("click", () => {
        const state = automationConfigState.get(root);
        if (!state) return;
        const selected = state.automations.find((item) => item.id === button.dataset.automationConfigSelect) ?? null;
        renderAutomationEditor(root, selected);
        list.querySelectorAll<HTMLButtonElement>("[data-automation-config-select]").forEach((item) => {
          item.dataset.active = item === button ? "true" : "false";
        });
      });
    });
  }
  renderAutomationEditor(root, normalized.automations[0] ?? null);
}

function renderAutomationEditor(root: HTMLElement, automation: AutomationDefinitionResponse | null): void {
  const fields = automation ? [
    ["id", automation.id],
    ["name", automation.name],
    ["summary", automation.summary],
    ["icon", automation.icon],
    ["trigger", automation.trigger],
    ["appId", automation.appId],
    ["schedule", automation.schedule],
    ["webhookPath", automation.webhookPath],
    ["flow", formatAutomationFlow(automation.flow)],
  ] : [
    ["id", ""],
    ["name", ""],
    ["summary", ""],
    ["icon", ""],
    ["trigger", "schedule"],
    ["appId", ""],
    ["schedule", ""],
    ["webhookPath", ""],
    ["flow", ""],
  ];
  for (const [key, value] of fields) {
    setAutomationField(root, key, value);
  }
  syncAutomationAppOptions(root);
  const enabled = root.querySelector<HTMLInputElement>("[data-automation-config-field=\"enabled\"]");
  if (enabled) enabled.checked = automation?.enabled ?? true;
}

function syncAutomationFormToState(root: HTMLElement, options: { strictFlow?: boolean } = {}): void {
  const config = automationConfigState.get(root);
  if (!config) return;
  const id = readAutomationField(root, "id");
  if (!id) return;
  const index = config.automations.findIndex((automation) => automation.id === id);
  if (index < 0) return;
  config.automations[index] = {
    ...config.automations[index]!,
    name: readAutomationField(root, "name") || config.automations[index]!.name,
    summary: readAutomationField(root, "summary") || config.automations[index]!.summary,
    icon: readAutomationField(root, "icon") || config.automations[index]!.icon,
    trigger: normalizeAutomationTrigger(readAutomationField(root, "trigger")),
    appId: readAutomationField(root, "appId"),
    schedule: readAutomationField(root, "schedule"),
    webhookPath: readAutomationField(root, "webhookPath"),
    enabled: root.querySelector<HTMLInputElement>("[data-automation-config-field=\"enabled\"]")?.checked ?? true,
    updatedAt: new Date().toISOString(),
    flow: readAutomationFlowField(root, config.automations[index]!, options.strictFlow === true),
  };
}

function deleteSelectedAutomation(root: HTMLElement): void {
  const config = automationConfigState.get(root);
  const id = readAutomationField(root, "id");
  if (!config || !id) return;
  config.automations = config.automations.filter((automation) => automation.id !== id);
  renderAutomationConfig(root, config);
  setAutomationConfigStatus(root, "已移除自动化，请保存后生效。");
}

function createClientAutomation(root: HTMLElement): AutomationDefinitionResponse {
  const firstAppId = appConfigState.get(root)?.defaultAppId ?? "";
  const now = new Date().toISOString();
  const id = `automation-${Date.now()}`;
  return {
    id,
    name: "新自动化",
    summary: "填写这条自动化的目的和触发后要做什么。",
    icon: "calendar",
    trigger: "schedule",
    appId: firstAppId,
    enabled: true,
    schedule: "",
    webhookPath: "",
    updatedAt: now,
    flow: createDefaultAutomationFlow({
      id,
      name: "新自动化",
      summary: "填写这条自动化的目的和触发后要做什么。",
      trigger: "schedule",
      appId: firstAppId,
    }),
  };
}

function normalizeAutomationConfig(config: AutomationConfigResponse): AutomationConfigResponse {
  return {
    ...config,
    automations: config.automations.map((automation) => ({
      ...automation,
      summary: automation.summary ?? "",
      icon: automation.icon ?? "calendar",
      trigger: normalizeAutomationTrigger(automation.trigger),
      schedule: automation.schedule ?? "",
      webhookPath: automation.webhookPath ?? "",
      flow: automation.flow ?? createDefaultAutomationFlow(automation),
    })),
  };
}

function syncAutomationAppOptions(root: HTMLElement): void {
  const select = root.querySelector<HTMLSelectElement>("[data-automation-config-field=\"appId\"]");
  if (!select) return;
  const current = select.value;
  const apps = appConfigState.get(root)?.apps ?? [];
  const options = ['<option value="">请先选择应用</option>'];
  for (const app of apps) {
    options.push(`<option value="${escapeHtml(app.id)}">${escapeHtml(app.name)}</option>`);
  }
  select.innerHTML = options.join("");
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  } else if ([...select.options].some((option) => option.value === (appConfigState.get(root)?.defaultAppId ?? ""))) {
    select.value = appConfigState.get(root)?.defaultAppId ?? "";
  }
}

function setAutomationField(root: HTMLElement, key: string, value: string): void {
  const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-automation-config-field="${cssEscape(key)}"]`);
  if (field) field.value = value;
}

function readAutomationField(root: HTMLElement, key: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-automation-config-field="${cssEscape(key)}"]`)?.value.trim() ?? "";
}

function setAutomationConfigStatus(root: HTMLElement, text: string): void {
  const status = root.querySelector<HTMLElement>("[data-automation-config-status]");
  if (status) status.textContent = text;
}

function formatAutomationFlow(flow: AutomationDefinitionResponse["flow"]): string {
  return JSON.stringify(flow, null, 2);
}

function readAutomationFlowField(
  root: HTMLElement,
  fallback: AutomationDefinitionResponse,
  strict: boolean,
): AutomationDefinitionResponse["flow"] {
  const raw = readAutomationField(root, "flow");
  if (!raw) {
    if (strict) {
      throw new Error("Flow JSON 不能为空。");
    }
    return fallback.flow;
  }
  try {
    const parsed = JSON.parse(raw) as AutomationDefinitionResponse["flow"];
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.branches)) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    if (strict) {
      throw new Error("Flow JSON 不是合法的自动化流程结构。");
    }
    return fallback.flow;
  }
}

function createDefaultAutomationFlow(
  automation: Pick<AutomationDefinitionResponse, "id" | "name" | "summary" | "trigger" | "appId">,
): AutomationDefinitionResponse["flow"] {
  return {
    nodes: [
      {
        id: `trigger-${automation.id}`,
        type: "trigger",
        title: formatAutomationTriggerLabel(automation.trigger),
        description: automation.summary,
        modelMode: "default",
      },
      {
        id: `action-${automation.id}`,
        type: "action",
        title: `执行 ${automation.name}`,
        description: `调用 ${automation.appId || "应用"} 执行后续处理。`,
        ...(automation.appId ? { appId: automation.appId } : {}),
        modelMode: "default",
      },
    ],
    edges: [
      {
        id: `edge-${automation.id}`,
        source: `trigger-${automation.id}`,
        target: `action-${automation.id}`,
      },
    ],
    branches: [],
  };
}

function normalizeAutomationTrigger(value: string): AutomationDefinitionResponse["trigger"] {
  return value === "schedule" || value === "webhook" ? value : "message";
}

function formatAutomationTriggerLabel(trigger: AutomationDefinitionResponse["trigger"]): string {
  switch (trigger) {
    case "schedule":
      return "定时";
    case "webhook":
      return "Webhook";
    default:
      return "消息触发";
  }
}

function readHost(value: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

async function hydrateSettings(
  targetInput: HTMLInputElement,
  sourceList: HTMLUListElement,
  status: HTMLElement,
  shortcutInput: HTMLInputElement,
  shortcutStatus: HTMLElement,
): Promise<void> {
  if (!window.llmWikiDesktop) {
    status.textContent = "\u5f53\u524d\u662f\u6d4f\u89c8\u5668\u9884\u89c8\u6a21\u5f0f\uff0c\u672c\u5730\u6587\u4ef6\u9009\u62e9\u53ea\u5728 Electron \u5e94\u7528\u4e2d\u53ef\u7528\u3002";
    shortcutStatus.textContent = "\u5f53\u524d\u662f\u6d4f\u89c8\u5668\u9884\u89c8\u6a21\u5f0f\uff0c\u5feb\u6377\u952e\u4fee\u6539\u53ea\u5728 Electron \u5e94\u7528\u4e2d\u751f\u6548\u3002";
    renderSources(sourceList, []);
    return;
  }
  const bootstrap = await window.llmWikiDesktop.getAppBootstrap();
  targetInput.value = bootstrap.appConfig?.targetRepoPath ?? bootstrap.desktopConfig.targetVault ?? "";
  renderSources(sourceList, bootstrap.appConfig?.sourceFolders ?? []);
  const shortcuts = await window.llmWikiDesktop.getShortcuts();
  shortcutInput.value = shortcuts.shortcuts.flashDiaryCapture;
  shortcutStatus.textContent = shortcuts.registered
    ? "\u5f53\u524d\u5feb\u6377\u952e\u5df2\u6ce8\u518c\u3002"
    : `\u5f53\u524d\u5feb\u6377\u952e\u672a\u6ce8\u518c\uff1a${shortcuts.error ?? shortcuts.shortcuts.flashDiaryCapture}`;
}

function renderSources(list: HTMLUListElement, sources: string[]): void {
  if (sources.length === 0) {
    list.innerHTML = `<li class="settings-source-empty">\u6682\u672a\u6dfb\u52a0</li>`;
    return;
  }
  list.innerHTML = sources.map((source) => `
    <li class="settings-source-item" data-source="${escapeHtml(source)}">
      <span>${escapeHtml(source)}</span>
      <button type="button" class="btn btn-secondary btn-inline" data-remove-source>\u5220\u9664</button>
    </li>
  `).join("");
  list.querySelectorAll<HTMLButtonElement>("[data-remove-source]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest("li")?.remove();
      if (readSources(list).length === 0) renderSources(list, []);
    });
  });
}

function readSources(list: HTMLUListElement): string[] {
  return Array.from(list.querySelectorAll<HTMLLIElement>("[data-source]"))
    .map((item) => item.dataset.source ?? "")
    .filter(Boolean);
}

function readProviderInput(root: HTMLElement, key: string): string {
  const controls = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-provider]"));
  return controls.find((input) => input.dataset.provider === key)?.value.trim() ?? "";
}

async function readJsonPayload<T>(response: Response): Promise<T> {
  return readSettingsJsonPayload<T>(response);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cssEscape(value: string): string {
  if (typeof window.CSS?.escape === "function") {
    return window.CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}
