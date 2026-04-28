import { searchWebExternal, type WebSearchResult } from "../../../src/services/cloudflare-web-search.js";
import { readCloudflareServicesConfig } from "../../../src/utils/cloudflare-services-config.js";
import type { ServerConfig } from "../config.js";
import { runSearch, type SearchMode, type SearchResponse } from "./search-router.js";

export type SearchScope = "local" | "web" | "all";

interface SearchAllOptions {
  scope?: SearchScope;
  mode?: SearchMode;
  webLimit?: number;
}

interface SearchAllResponse {
  scope: SearchScope;
  mode: SearchMode;
  local: SearchResponse;
  web: {
    configured: boolean;
    results: WebSearchResult[];
  };
}

interface SearchStatusResponse {
  local: {
    configured: boolean;
  };
  web: {
    configured: boolean;
    endpointHost: string | null;
  };
}

export function getSearchStatus(): SearchStatusResponse {
  const cfg = readCloudflareServicesConfig();
  return {
    local: { configured: true },
    web: {
      configured: Boolean(cfg.searchEndpoint),
      endpointHost: cfg.searchEndpoint ? readHost(cfg.searchEndpoint) : null,
    },
  };
}

export async function searchAll(
  cfg: ServerConfig | undefined,
  query: string,
  options: SearchAllOptions = {},
): Promise<SearchAllResponse> {
  const scope = normalizeScope(options.scope);
  const mode = normalizeMode(options.mode);
  const webLimit = normalizeWebLimit(options.webLimit);

  const [local, web] = await Promise.all([
    scope === "local" || scope === "all"
      ? runSearch(cfg, query, mode)
      : Promise.resolve<SearchResponse>({ mode, results: [] }),
    scope === "web" || scope === "all"
      ? runWebSearch(query, webLimit)
      : Promise.resolve({ configured: false, results: [] as WebSearchResult[] }),
  ]);

  return {
    scope,
    mode: local.mode,
    local,
    web,
  };
}

async function runWebSearch(query: string, limit: number): Promise<{ configured: boolean; results: WebSearchResult[] }> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { configured: true, results: [] };
  }
  try {
    const result = await searchWebExternal(normalizedQuery, limit);
    return {
      configured: result.ok || result.error.type !== "cloudflare-unconfigured",
      results: result.ok ? result.data : [],
    };
  } catch {
    return { configured: true, results: [] };
  }
}

function normalizeScope(value: SearchScope | undefined): SearchScope {
  return value === "web" || value === "all" ? value : "local";
}

function normalizeMode(value: SearchMode | undefined): SearchMode {
  return value === "direct" || value === "hybrid" ? value : "keyword";
}

function normalizeWebLimit(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 5;
  }
  return Math.max(1, Math.min(10, Math.trunc(value)));
}

function readHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
