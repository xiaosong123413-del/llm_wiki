/**
 * Mobile chat contracts and pure helpers for the remote-brain Worker.
 *
 * Keeps mobile chat mode parsing, web-search request shaping, and source
 * normalization outside the large Worker entrypoint so the behavior can be
 * unit-tested without Worker bindings.
 */

export type MobileChatMode = "wiki" | "web" | "hybrid";
type MobileChatSourceType = "wiki" | "web";

export interface MobileChatSource {
  id: string;
  type: MobileChatSourceType;
  title: string;
  path?: string;
  url?: string;
  domain?: string;
}

export interface MobileWebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export function resolveMobileChatMode(value: unknown): MobileChatMode {
  return value === "web" || value === "hybrid" || value === "wiki" ? value : "wiki";
}

export function mergeMobileChatSources(
  wikiSources: readonly MobileChatSource[],
  webSources: readonly MobileChatSource[],
): MobileChatSource[] {
  return [...wikiSources, ...webSources];
}

export function normalizeMobileWebSearchResults(payload: unknown): MobileWebSearchResult[] {
  const record = asRecord(payload);
  const result = asRecord(record.result);
  const raw = Array.isArray(record.results) ? record.results : result.results;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeMobileWebSearchResult).filter((item): item is MobileWebSearchResult => Boolean(item));
}

export function buildMobileSearchRequest(
  endpoint: string,
  query: string,
  limit: number,
  model: string | null,
): {
  endpoint: string;
  payload: Record<string, unknown>;
} {
  if (isTavilyEndpoint(endpoint)) {
    return {
      endpoint: withTavilySearchPath(endpoint),
      payload: {
        query,
        max_results: limit,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      },
    };
  }
  return {
    endpoint,
    payload: model ? { query, limit, model } : { query, limit },
  };
}

export function toWikiChatSource(input: {
  id?: string;
  title: string;
  path: string;
}): MobileChatSource {
  return {
    id: input.id ?? input.path,
    type: "wiki",
    title: input.title,
    path: input.path,
  };
}

export function toWebChatSource(input: MobileWebSearchResult, index: number): MobileChatSource {
  return {
    id: `web-${index + 1}`,
    type: "web",
    title: input.title,
    url: input.url,
    domain: readDomain(input.url),
  };
}

function normalizeMobileWebSearchResult(value: unknown): MobileWebSearchResult | null {
  const item = asRecord(value);
  const title = firstString(item.title);
  const url = firstString(item.url);
  const snippet = firstString(item.snippet, item.content, item.description, item.raw_content);
  if (!title || !url) {
    return null;
  }
  return { title, url, snippet };
}

function isTavilyEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).host.toLowerCase() === "api.tavily.com";
  } catch {
    return false;
  }
}

function withTavilySearchPath(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/search";
  }
  return url.toString();
}

function readDomain(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname || undefined;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}
