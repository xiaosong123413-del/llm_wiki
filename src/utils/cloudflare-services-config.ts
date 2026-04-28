/**
 * Shared Cloudflare services configuration.
 *
 * Reads only server-side environment variables and exposes redacted summaries
 * so secrets stay out of frontend responses and logs.
 */

export interface CloudflareServicesConfig {
  provider: string | null;
  accountId: string | null;
  apiToken: string | null;
  workerUrl: string | null;
  remoteToken: string | null;
  searchToken: string | null;
  aiModel: string | null;
  ocrModel: string | null;
  transcribeModel: string | null;
  embeddingModel: string | null;
  searchModel: string | null;
  searchEndpoint: string | null;
}

interface CloudflareServicesSummary {
  provider: string | null;
  accountId: string | null;
  workerUrl: string | null;
  aiModel: string | null;
  ocrModel: string | null;
  transcribeModel: string | null;
  embeddingModel: string | null;
  searchModel: string | null;
  searchEndpoint: string | null;
  apiTokenConfigured: boolean;
  remoteTokenConfigured: boolean;
  searchTokenConfigured: boolean;
}

export function readCloudflareServicesConfig(
  env: NodeJS.ProcessEnv = process.env,
): CloudflareServicesConfig {
  return {
    provider: normalizeOptional(env.LLMWIKI_PROVIDER)?.toLowerCase() ?? null,
    accountId: normalizeOptional(env.CLOUDFLARE_ACCOUNT_ID),
    apiToken: normalizeOptional(env.CLOUDFLARE_API_TOKEN),
    workerUrl: normalizeUrl(env.CLOUDFLARE_WORKER_URL),
    remoteToken: normalizeOptional(env.CLOUDFLARE_REMOTE_TOKEN),
    searchToken: normalizeOptional(env.CLOUDFLARE_SEARCH_TOKEN),
    aiModel: normalizeOptional(env.CLOUDFLARE_AI_MODEL),
    ocrModel: normalizeOptional(env.CLOUDFLARE_OCR_MODEL),
    transcribeModel: normalizeOptional(env.CLOUDFLARE_TRANSCRIBE_MODEL),
    embeddingModel: normalizeOptional(env.CLOUDFLARE_EMBEDDING_MODEL),
    searchModel: normalizeOptional(env.CLOUDFLARE_SEARCH_MODEL),
    searchEndpoint: normalizeUrl(env.CLOUDFLARE_SEARCH_ENDPOINT),
  };
}

export function summarizeCloudflareServicesConfig(
  cfg: CloudflareServicesConfig,
): CloudflareServicesSummary {
  return {
    provider: cfg.provider,
    accountId: cfg.accountId,
    workerUrl: cfg.workerUrl,
    aiModel: cfg.aiModel,
    ocrModel: cfg.ocrModel,
    transcribeModel: cfg.transcribeModel,
    embeddingModel: cfg.embeddingModel,
    searchModel: cfg.searchModel,
    searchEndpoint: cfg.searchEndpoint,
    apiTokenConfigured: Boolean(cfg.apiToken),
    remoteTokenConfigured: Boolean(cfg.remoteToken),
    searchTokenConfigured: Boolean(cfg.searchToken),
  };
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeOptional(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeUrl(value: unknown): string | null {
  const text = normalizeOptional(value);
  if (!text) return null;
  try {
    return ensureTrailingSlash(new URL(text).toString());
  } catch {
    return text;
  }
}
