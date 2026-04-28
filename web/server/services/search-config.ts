import { assignEnvValue, updateEnvFile } from "./env-file.js";

const SEARCH_ENDPOINT_ENV = "CLOUDFLARE_SEARCH_ENDPOINT";
const SEARCH_TOKEN_ENV = "CLOUDFLARE_SEARCH_TOKEN";
const SEARCH_MODEL_ENV = "CLOUDFLARE_SEARCH_MODEL";
const REMOTE_TOKEN_ENV = "CLOUDFLARE_REMOTE_TOKEN";

interface SearchProviderConfig {
  url: string;
  keyConfigured: boolean;
  model: string;
}

interface SearchProviderConfigInput {
  url?: unknown;
  key?: unknown;
  model?: unknown;
}

export function readSearchProviderConfig(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): SearchProviderConfig {
  return {
    url: normalizeUrl(env[SEARCH_ENDPOINT_ENV]) ?? "",
    keyConfigured: Boolean(normalizeText(env[SEARCH_TOKEN_ENV]) ?? normalizeText(env[REMOTE_TOKEN_ENV])),
    model: normalizeText(env[SEARCH_MODEL_ENV]) ?? "",
  };
}

export function saveSearchProviderConfig(
  projectRoot: string,
  input: SearchProviderConfigInput,
  env: NodeJS.ProcessEnv = process.env,
): SearchProviderConfig {
  const url = normalizeUrl(input.url);
  const key = normalizeText(input.key);
  const model = normalizeText(input.model);
  updateEnvFile(projectRoot, {
    [SEARCH_ENDPOINT_ENV]: url,
    [SEARCH_TOKEN_ENV]: key,
    [SEARCH_MODEL_ENV]: model,
  });
  assignEnvValue(env, SEARCH_ENDPOINT_ENV, url);
  assignEnvValue(env, SEARCH_TOKEN_ENV, key);
  assignEnvValue(env, SEARCH_MODEL_ENV, model);
  return readSearchProviderConfig(projectRoot, env);
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeUrl(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  try {
    return new URL(text).toString();
  } catch {
    throw new Error("网络搜索地址必须是完整 URL。");
  }
}
