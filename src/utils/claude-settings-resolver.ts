/**
 * Anthropic env precedence and validation helpers.
 *
 * Keeps the higher-level auth/model/base-url resolution separate from the
 * low-level Claude settings file reader so the public barrel can stay thin.
 */

import { readClaudeSettingsEnv, type ClaudeSettingsEnv } from "./claude-settings-reader.js";

interface AnthropicAuthConfig {
  apiKey?: string;
  authToken?: string;
}

export function resolveAnthropicAuthFromEnv(env: NodeJS.ProcessEnv = process.env): AnthropicAuthConfig {
  const explicitApiKey = normalizeEnvString(env.ANTHROPIC_API_KEY);
  if (explicitApiKey) return { apiKey: explicitApiKey };

  const explicitAuthToken = normalizeEnvString(env.ANTHROPIC_AUTH_TOKEN);
  if (explicitAuthToken) return { authToken: explicitAuthToken };

  const fallback = readClaudeSettingsEnv(env);
  if (fallback?.ANTHROPIC_API_KEY) return { apiKey: fallback.ANTHROPIC_API_KEY };
  if (fallback?.ANTHROPIC_AUTH_TOKEN) return { authToken: fallback.ANTHROPIC_AUTH_TOKEN };
  return {};
}

export function resolveAnthropicModelFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicitModel = env.LLMWIKI_MODEL;
  if (explicitModel !== undefined) return explicitModel;
  return tryReadClaudeSettingsEnv(env)?.ANTHROPIC_MODEL;
}

export function resolveAnthropicBaseURLFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicitBaseURL = normalizeEnvString(env.ANTHROPIC_BASE_URL);
  if (explicitBaseURL) return validateAnthropicBaseURL(explicitBaseURL);

  const fallbackBaseURL = tryReadClaudeSettingsEnv(env)?.ANTHROPIC_BASE_URL;
  if (!fallbackBaseURL) return undefined;
  return validateAnthropicBaseURL(fallbackBaseURL);
}

function normalizeEnvString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function tryReadClaudeSettingsEnv(env: NodeJS.ProcessEnv): ClaudeSettingsEnv | undefined {
  try {
    return readClaudeSettingsEnv(env);
  } catch {
    return undefined;
  }
}

function validateAnthropicBaseURL(value: string): string {
  const normalized = value.trim();
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Must use http:// or https:// protocol.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Must be a valid http(s) URL.";
    throw new Error(`Invalid ANTHROPIC_BASE_URL: "${normalized}". ${message}`);
  }
  return normalized;
}
