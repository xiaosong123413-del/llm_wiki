export interface CloudflareRemoteBrainConfig {
  provider: "cloudflare";
  enabled: boolean;
  workerUrl: string | null;
  remoteToken: string | null;
  accountId: string | null;
  d1DatabaseId: string | null;
  r2Bucket: string | null;
  vectorizeIndex: string | null;
  configurationError: string | null;
}

export interface CloudflareRemoteBrainSummary {
  provider: "cloudflare";
  enabled: boolean;
  workerUrl: string | null;
  accountId: string | null;
  d1DatabaseId: string | null;
  r2Bucket: string | null;
  vectorizeIndex: string | null;
  tokenConfigured: boolean;
}

export function readCloudflareRemoteBrainConfig(env: NodeJS.ProcessEnv = process.env): CloudflareRemoteBrainConfig {
  const provider = String(env.LLMWIKI_REMOTE_PROVIDER ?? "").trim().toLowerCase();
  const workerUrl = normalizeOptional(env.CLOUDFLARE_WORKER_URL);
  const remoteToken = normalizeOptional(env.CLOUDFLARE_REMOTE_TOKEN);
  const accountId = normalizeOptional(env.CLOUDFLARE_ACCOUNT_ID);
  const d1DatabaseId = normalizeOptional(env.CLOUDFLARE_D1_DATABASE_ID);
  const r2Bucket = normalizeOptional(env.CLOUDFLARE_R2_BUCKET);
  const vectorizeIndex = normalizeOptional(env.CLOUDFLARE_VECTORIZE_INDEX);

  if (provider !== "cloudflare") {
    return {
      provider: "cloudflare",
      enabled: false,
      workerUrl,
      remoteToken,
      accountId,
      d1DatabaseId,
      r2Bucket,
      vectorizeIndex,
      configurationError: null,
    };
  }

  if (!workerUrl || !remoteToken) {
    return {
      provider: "cloudflare",
      enabled: false,
      workerUrl,
      remoteToken,
      accountId,
      d1DatabaseId,
      r2Bucket,
      vectorizeIndex,
      configurationError: "Missing CLOUDFLARE_WORKER_URL or CLOUDFLARE_REMOTE_TOKEN",
    };
  }

  try {
    new URL(workerUrl);
  } catch {
    return {
      provider: "cloudflare",
      enabled: false,
      workerUrl,
      remoteToken,
      accountId,
      d1DatabaseId,
      r2Bucket,
      vectorizeIndex,
      configurationError: "Invalid CLOUDFLARE_WORKER_URL",
    };
  }

  return {
    provider: "cloudflare",
    enabled: true,
    workerUrl: ensureTrailingSlash(workerUrl),
    remoteToken,
    accountId,
    d1DatabaseId,
    r2Bucket,
    vectorizeIndex,
    configurationError: null,
  };
}

export function summarizeCloudflareRemoteBrainConfig(
  cfg: CloudflareRemoteBrainConfig,
): CloudflareRemoteBrainSummary {
  return {
    provider: "cloudflare",
    enabled: cfg.enabled,
    workerUrl: cfg.workerUrl ? ensureTrailingSlash(cfg.workerUrl) : null,
    accountId: cfg.accountId,
    d1DatabaseId: cfg.d1DatabaseId,
    r2Bucket: cfg.r2Bucket,
    vectorizeIndex: cfg.vectorizeIndex,
    tokenConfigured: Boolean(cfg.remoteToken),
  };
}

function normalizeOptional(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
