/**
 * Mobile AI provider dispatch.
 *
 * The mobile app can either use the Worker AI binding or an OpenAI-compatible
 * provider supplied from settings. Keeping this logic here prevents the chat
 * and task routes from silently ignoring the selected provider.
 */

import { extractWorkerText } from "./runtime-helpers.js";
import type {
  MobileAiProviderRequest,
  MobileChatEnv,
} from "./mobile-shared.js";

export interface MobileAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: { content?: unknown };
    text?: unknown;
  }>;
  error?: unknown;
}

export function isExternalMobileAiProvider(provider: MobileAiProviderRequest | undefined): boolean {
  const mode = normalizeMode(provider?.mode);
  return mode === "api" || mode === "codex_oauth";
}

export async function runMobileAiText(
  env: MobileChatEnv,
  provider: MobileAiProviderRequest | undefined,
  messages: readonly MobileAiMessage[],
): Promise<string> {
  if (isExternalMobileAiProvider(provider)) {
    return runOpenAiCompatibleText(provider, messages);
  }
  const result = await env.AI!.run(env.LLM_MODEL!, { messages });
  return extractWorkerText(result);
}

async function runOpenAiCompatibleText(
  provider: MobileAiProviderRequest | undefined,
  messages: readonly MobileAiMessage[],
): Promise<string> {
  const apiBaseUrl = readText(provider?.apiBaseUrl);
  const apiKey = readText(provider?.apiKey);
  const model = readText(provider?.model) || (normalizeMode(provider?.mode) === "codex_oauth" ? "gpt-5-codex" : "");
  if (!apiBaseUrl) throw new Error("缺少 Provider API 地址。");
  if (!apiKey) throw new Error("缺少 Provider API Key。");
  if (!model) throw new Error("缺少 Provider Model。");

  const response = await fetch(createChatCompletionsUrl(apiBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });
  const payload = await response.json().catch(() => ({})) as OpenAiCompatibleResponse;
  if (!response.ok) {
    throw new Error(`Provider 请求失败：${readProviderError(payload) || response.status}`);
  }
  return readProviderText(payload);
}

function createChatCompletionsUrl(apiBaseUrl: string): string {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  return baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
}

function readProviderText(payload: OpenAiCompatibleResponse): string {
  const firstChoice = payload.choices?.[0];
  const messageContent = firstChoice?.message?.content;
  if (typeof messageContent === "string") return messageContent;
  if (typeof firstChoice?.text === "string") return firstChoice.text;
  return "";
}

function readProviderError(payload: OpenAiCompatibleResponse): string {
  const error = payload.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function normalizeMode(value: unknown): "cloudflare" | "api" | "codex_oauth" {
  return value === "api" || value === "codex_oauth" || value === "cloudflare" ? value : "cloudflare";
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
