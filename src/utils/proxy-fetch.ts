import { ProxyAgent } from "undici";

let cachedProxyUrl: string | null = null;
let cachedProxyAgent: ProxyAgent | null = null;

function getProxyUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return normalizeProxyUrl(
    env.GLOBAL_AGENT_HTTP_PROXY
      ?? env.HTTPS_PROXY
      ?? env.HTTP_PROXY
      ?? env.https_proxy
      ?? env.http_proxy,
  );
}

export async function fetchWithOptionalProxy(
  input: string | URL | Request,
  init: RequestInit = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> {
  const proxyUrl = getProxyUrl(env);
  if (!proxyUrl) {
    return fetch(input, init);
  }

  return fetch(input, {
    ...init,
    dispatcher: getProxyAgent(proxyUrl),
  } as RequestInit & { dispatcher: ProxyAgent });
}

function getProxyAgent(proxyUrl: string): ProxyAgent {
  if (cachedProxyUrl === proxyUrl && cachedProxyAgent) {
    return cachedProxyAgent;
  }

  cachedProxyAgent?.close().catch(() => undefined);
  cachedProxyUrl = proxyUrl;
  cachedProxyAgent = new ProxyAgent(proxyUrl);
  return cachedProxyAgent;
}

function normalizeProxyUrl(value: string | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  try {
    return new URL(text).toString();
  } catch {
    return null;
  }
}
