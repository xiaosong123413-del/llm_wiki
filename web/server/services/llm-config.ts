import { fetchWithOptionalProxy } from "../../../src/utils/proxy-fetch.js";
import { assignEnvValue, updateEnvFile } from "./env-file.js";
import { readCLIProxyConfig } from "./cliproxy-config.js";
import { readLlmApiAccount } from "./llm-accounts.js";
import {
  defaultBaseUrlForProvider,
  defaultModelForProvider,
  isSupportedLlmProvider,
  normalizeOpenAICompatibleBaseUrl,
} from "./llm-provider-defaults.js";

const PROVIDER_ENV = "LLMWIKI_PROVIDER";
const OPENAI_COMPAT_PROVIDER_ENV = "LLMWIKI_OPENAI_COMPAT_PROVIDER";
const OPENAI_BASE_URL_ENV = "LLMWIKI_OPENAI_BASE_URL";
const OPENAI_KEY_ENV = "OPENAI_API_KEY";
const ANTHROPIC_BASE_URL_ENV = "ANTHROPIC_BASE_URL";
const ANTHROPIC_KEY_ENV = "ANTHROPIC_API_KEY";
const ANTHROPIC_AUTH_TOKEN_ENV = "ANTHROPIC_AUTH_TOKEN";
const MINIMAX_KEY_ENV = "MINIMAX_API_KEY";
const OLLAMA_HOST_ENV = "OLLAMA_HOST";
const MODEL_ENV = "LLMWIKI_MODEL";
const DEFAULT_ACCOUNT_REF_ENV = "LLMWIKI_DEFAULT_ACCOUNT_REF";

interface LlmProviderConfig {
  accountRef?: string;
  provider: string;
  url: string;
  keyConfigured: boolean;
  model: string;
}

interface LlmProviderConfigInput {
  accountRef?: unknown;
  provider?: unknown;
  url?: unknown;
  key?: unknown;
  model?: unknown;
}

interface LlmProviderTestResult {
  ok: boolean;
  provider: string;
  endpoint: string;
  message: string;
}

type LlmProviderTestFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function readLlmProviderConfig(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderConfig {
  const provider = normalizeText(env[PROVIDER_ENV]) ?? "anthropic";
  const compatProvider = provider === "openai" ? normalizeText(env[OPENAI_COMPAT_PROVIDER_ENV]) : null;
  const accountRef = normalizeText(env[DEFAULT_ACCOUNT_REF_ENV]);
  return {
    ...(accountRef ? { accountRef } : {}),
    provider: compatProvider ?? provider,
    url: readProviderUrl(provider, env),
    keyConfigured: readProviderKeyConfigured(provider, env),
    model: normalizeText(env[MODEL_ENV]) ?? "",
  };
}

export function saveLlmProviderConfig(
  projectRoot: string,
  input: LlmProviderConfigInput,
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderConfig {
  const resolvedAccount = resolveAccountRefConfig(projectRoot, input.accountRef);
  const provider = resolvedAccount?.provider ?? normalizeSavedProvider(input.provider);
  const runtimeProvider = toRuntimeProvider(provider);
  const url = resolvedAccount?.url ?? normalizeUrl(input.url);
  const key = resolvedAccount?.key ?? normalizeText(input.key);
  const model = resolvedAccount?.model ?? normalizeText(input.model);
  const updates = buildProviderEnvUpdates(
    provider,
    runtimeProvider,
    url,
    key,
    model,
    resolvedAccount?.accountRef ?? null,
  );
  updateEnvFile(projectRoot, updates);
  for (const [envKey, value] of Object.entries(updates)) {
    assignEnvValue(env, envKey, value);
  }
  return readLlmProviderConfig(projectRoot, env);
}

export async function testLlmProviderConfig(
  projectRoot: string,
  input: LlmProviderConfigInput,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: LlmProviderTestFetcher = (request, init) => fetchWithOptionalProxy(request, init, env),
): Promise<LlmProviderTestResult> {
  const provider = normalizeSavedProvider(input.provider);
  const model = normalizeText(input.model) ?? normalizeText(env[MODEL_ENV]) ?? defaultModelForProvider(provider);
  const url = normalizeUrl(input.url) ?? readProviderUrl(toRuntimeProvider(provider), env);
  const key = normalizeText(input.key) ?? readProviderKey(provider, env);

  if (!model && provider !== "ollama") {
    return { ok: false, provider, endpoint: url, message: "需要填写模型名。" };
  }
  if (!key && provider !== "ollama") {
    return { ok: false, provider, endpoint: url, message: "需要填写 API Key，或先保存已有密钥。" };
  }

  const request = buildTestRequest(provider, url, key, model);
  const response = await fetcher(request.endpoint, request.init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      provider,
      endpoint: request.endpoint,
      message: buildProviderTestErrorMessage(provider, response.status, text, model),
    };
  }
  return {
    ok: true,
    provider,
    endpoint: request.endpoint,
    message: "验证成功，API 可以连通。",
  };
}

function buildProviderTestErrorMessage(provider: string, status: number, text: string, model: string): string {
  const error = parseProviderError(text);
  if (
    provider === "relay"
    && (
      error?.code === "model_not_found"
      || error?.message?.toLowerCase().includes("no available channel for model")
    )
  ) {
    return `验证失败：当前中转站账号不支持模型 ${model}，请改成该中转实际支持的模型名后再试。`;
  }
  return `验证失败：HTTP ${status}${text ? ` ${text.slice(0, 160)}` : ""}`;
}

function parseProviderError(text: string): { code: string | null; message: string | null } | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: unknown; message?: unknown } };
    return {
      code: normalizeText(parsed.error?.code) ?? null,
      message: normalizeText(parsed.error?.message) ?? null,
    };
  } catch {
    return null;
  }
}

function normalizeSavedProvider(value: unknown): string {
  const provider = normalizeText(value);
  if (!provider) return "openai";
  if (!isSupportedLlmProvider(provider)) {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
  return provider;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeUrl(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    throw new Error("LLM API 地址必须是完整 URL。");
  }
}

function toRuntimeProvider(provider: string): string {
  if (provider === "anthropic" || provider === "minimax" || provider === "ollama") return provider;
  return "openai";
}

function buildProviderEnvUpdates(
  provider: string,
  runtimeProvider: string,
  url: string | null,
  key: string | null,
  model: string | null,
  accountRef: string | null,
): Record<string, string | null> {
  const updates: Record<string, string | null> = {
    [DEFAULT_ACCOUNT_REF_ENV]: accountRef,
    [PROVIDER_ENV]: runtimeProvider,
    [OPENAI_COMPAT_PROVIDER_ENV]: runtimeProvider === "openai" ? provider : null,
    [OPENAI_BASE_URL_ENV]: null,
    [OPENAI_KEY_ENV]: null,
    [ANTHROPIC_BASE_URL_ENV]: null,
    [ANTHROPIC_KEY_ENV]: null,
    [ANTHROPIC_AUTH_TOKEN_ENV]: null,
    [MINIMAX_KEY_ENV]: null,
    [OLLAMA_HOST_ENV]: null,
    [MODEL_ENV]: model,
  };
  if (runtimeProvider === "anthropic") {
    updates[ANTHROPIC_BASE_URL_ENV] = url;
    updates[ANTHROPIC_KEY_ENV] = key;
    return updates;
  }
  if (runtimeProvider === "minimax") {
    updates[OPENAI_BASE_URL_ENV] = url;
    updates[MINIMAX_KEY_ENV] = key;
    return updates;
  }
  if (runtimeProvider === "ollama") {
    updates[OLLAMA_HOST_ENV] = url;
    return updates;
  }
  updates[OPENAI_BASE_URL_ENV] = normalizeOpenAIBaseUrl(url, provider);
  updates[OPENAI_KEY_ENV] = key;
  return updates;
}

function resolveAccountRefConfig(
  projectRoot: string,
  input: unknown,
): { accountRef: string; provider: string; url: string; key: string; model: string } | null {
  const accountRef = normalizeText(input);
  if (!accountRef) return null;
  const route = parseAccountRef(accountRef);
  if (!route) {
    throw new Error("默认模型账号来源无效。");
  }
  if (route.kind === "api") {
    const account = readLlmApiAccount(projectRoot, route.key);
    if (!account || account.enabled === false) {
      throw new Error("默认模型引用的 API 账号不存在，或已被停用。");
    }
    return {
      accountRef,
      provider: account.provider,
      url: account.url,
      key: account.key,
      model: account.model,
    };
  }
  const config = readCLIProxyConfig(projectRoot);
  return {
    accountRef,
    provider: providerFromOAuthAccount(route.provider),
    url: `http://127.0.0.1:${config.port}/v1`,
    key: config.clientKey,
    model: config.model,
  };
}

function parseAccountRef(value: string): { kind: "api" | "oauth"; provider: string; key: string } | null {
  if (value.startsWith("api:")) {
    const key = value.slice(4).trim();
    if (!key) return null;
    return { kind: "api", provider: "api", key };
  }
  if (value.startsWith("oauth:")) {
    const parts = value.split(":");
    const provider = parts[1]?.trim();
    const key = parts.slice(2).join(":").trim();
    if (!provider || !key) return null;
    return { kind: "oauth", provider, key };
  }
  return null;
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
      return "custom";
  }
}

function readProviderUrl(provider: string, env: NodeJS.ProcessEnv): string {
  if (provider === "anthropic") return normalizeText(env[ANTHROPIC_BASE_URL_ENV]) ?? "";
  if (provider === "ollama") return normalizeText(env[OLLAMA_HOST_ENV]) ?? "";
  return normalizeText(env[OPENAI_BASE_URL_ENV]) ?? "";
}

function readProviderKeyConfigured(provider: string, env: NodeJS.ProcessEnv): boolean {
  return Boolean(readProviderKey(provider, env));
}

function readProviderKey(provider: string, env: NodeJS.ProcessEnv): string | null {
  if (provider === "anthropic") {
    return normalizeText(env[ANTHROPIC_KEY_ENV]) ?? normalizeText(env[ANTHROPIC_AUTH_TOKEN_ENV]);
  }
  if (provider === "minimax") return normalizeText(env[MINIMAX_KEY_ENV]);
  if (provider === "ollama") return null;
  return normalizeText(env[OPENAI_KEY_ENV]);
}

function normalizeOpenAIBaseUrl(url: string | null, provider: string): string | null {
  if (!url) return null;
  return normalizeOpenAICompatibleBaseUrl(url, provider);
}

function buildTestRequest(provider: string, url: string, key: string | null, model: string): { endpoint: string; init: RequestInit } {
  if (provider === "anthropic") {
    const endpoint = new URL("/v1/messages", url || "https://api.anthropic.com").toString();
    return {
      endpoint,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": key ?? "",
        },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      },
    };
  }
  if (provider === "gemini") {
    const endpoint = new URL(`/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key ?? "")}`, url || "https://generativelanguage.googleapis.com").toString();
    return {
      endpoint,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
      },
    };
  }
  const endpoint = openAIChatCompletionsEndpoint(url, provider);
  return {
    endpoint,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    },
  };
}

function openAIChatCompletionsEndpoint(url: string, provider: string): string {
  const normalized = normalizeOpenAIBaseUrl(url || defaultBaseUrlForProvider(provider), provider) ?? defaultBaseUrlForProvider(provider);
  const parsed = new URL(normalized);
  if (!parsed.pathname.replace(/\/+$/, "").endsWith("/chat/completions")) {
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/chat/completions`;
  }
  return parsed.toString();
}
