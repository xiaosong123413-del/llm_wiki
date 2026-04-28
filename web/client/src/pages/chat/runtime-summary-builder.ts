/**
 * Chat runtime summary builder.
 *
 * Encapsulates the app/account label derivation used by the chat page while
 * keeping the public `runtime.ts` module as a thin export surface.
 */

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  gemini: "Google (Gemini)",
  deepseek: "DeepSeek",
  groq: "Groq",
  xai: "xAI (Grok)",
  "kimi-global": "Kimi (Moonshot)",
  "kimi-cn": "Kimi (Moonshot, 中国)",
  glm: "智谱 GLM",
  minimax: "MiniMax",
  ollama: "Ollama",
  relay: "中转站 API",
  custom: "自定义 OpenAI-compatible",
  "codex-cli": "Codex CLI",
  codex: "Codex CLI",
};

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  "gemini-cli": "Gemini CLI",
  gemini: "Gemini CLI",
  anthropic: "Claude Code",
  codex: "Codex OAuth",
  kimi: "Kimi OAuth",
};

interface ChatAppRuntimeApp {
  id: string;
  name: string;
  mode: string;
  provider: string;
  model: string;
  enabled: boolean;
  accountRef?: string;
}

export interface ChatAgentRuntimeApiAccount {
  id: string;
  name: string;
  provider: string;
  model: string;
  enabled: boolean;
}

export interface ChatAgentRuntimeOAuthAccount {
  provider: string;
  name: string;
  email?: string;
  enabled?: boolean;
}

export interface ChatRuntimeSummary {
  appLabel: string;
  providerLabel: string;
  modelLabel: string;
  sourceLabel: string;
}

interface BuildChatRuntimeSummaryInput {
  appId: string | null;
  defaultAppId: string | null;
  apps: readonly ChatAppRuntimeApp[];
  apiAccounts: readonly ChatAgentRuntimeApiAccount[];
  oauthAccounts: readonly ChatAgentRuntimeOAuthAccount[];
}

export function buildChatRuntimeSummary(input: BuildChatRuntimeSummaryInput): ChatRuntimeSummary {
  const selectedAppId = normalizeText(input.appId) ?? normalizeText(input.defaultAppId);
  const app = selectedAppId
    ? input.apps.find((item) => item.id === selectedAppId && item.enabled)
    : null;
  if (!app) {
    return {
      appLabel: "未绑定应用",
      providerLabel: "应用未配置",
      modelLabel: "请先选择应用",
      sourceLabel: "聊天必须绑定应用后才能发送",
    };
  }

  const providerLabel = formatProviderLabel(app.provider);
  const accountRef = normalizeText(app.accountRef);
  if (!accountRef) {
    return {
      appLabel: app.name,
      providerLabel,
      modelLabel: normalizeText(app.model) ?? "跟随应用默认模型",
      sourceLabel: "应用资源默认配置",
    };
  }

  if (accountRef.startsWith("api:")) {
    return buildApiSummary(app, providerLabel, accountRef, input.apiAccounts);
  }

  if (accountRef.startsWith("oauth:")) {
    return buildOAuthSummary(app, providerLabel, accountRef, input.oauthAccounts);
  }

  return {
    appLabel: app.name,
    providerLabel,
    modelLabel: normalizeText(app.model) ?? "跟随应用默认模型",
    sourceLabel: accountRef,
  };
}

function buildApiSummary(
  app: ChatAppRuntimeApp,
  providerLabel: string,
  accountRef: string,
  apiAccounts: readonly ChatAgentRuntimeApiAccount[],
): ChatRuntimeSummary {
  const accountId = accountRef.slice(4).trim();
  const account = apiAccounts.find((item) => item.id === accountId && item.enabled);
  return {
    appLabel: app.name,
    providerLabel,
    modelLabel: normalizeText(app.model) ?? normalizeText(account?.model) ?? "跟随账号默认模型",
    sourceLabel: account
      ? `API · ${formatProviderLabel(account.provider)} · ${account.name}`
      : `API · ${accountId}`,
  };
}

function buildOAuthSummary(
  app: ChatAppRuntimeApp,
  providerLabel: string,
  accountRef: string,
  oauthAccounts: readonly ChatAgentRuntimeOAuthAccount[],
): ChatRuntimeSummary {
  const parts = accountRef.split(":");
  const oauthProvider = parts[1]?.trim() ?? "";
  const oauthName = parts.slice(2).join(":").trim();
  const account = oauthAccounts.find((item) => item.provider === oauthProvider && item.name === oauthName);
  return {
    appLabel: app.name,
    providerLabel,
    modelLabel: normalizeText(app.model) ?? "跟随账号默认模型",
    sourceLabel: account
      ? `OAuth · ${formatOAuthProviderLabel(account.provider)} · ${account.email ?? account.name}`
      : `OAuth · ${formatOAuthProviderLabel(oauthProvider)} · ${oauthName || "未命名账号"}`,
  };
}

function formatProviderLabel(provider: string): string {
  return PROVIDER_LABELS[normalizeProviderKey(provider)] ?? (provider || "默认 LLM");
}

function formatOAuthProviderLabel(provider: string): string {
  return OAUTH_PROVIDER_LABELS[normalizeProviderKey(provider)] ?? (provider || "OAuth");
}

function normalizeProviderKey(provider: string): string {
  return provider.trim().toLowerCase();
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}
