import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerSearchRoutes } from "../web/server/routes/search.js";

const { readSearchProviderConfig, saveSearchProviderConfig, searchAll } = vi.hoisted(() => ({
  readSearchProviderConfig: vi.fn(),
  saveSearchProviderConfig: vi.fn(),
  searchAll: vi.fn(),
}));

vi.mock("../web/server/services/search-config.js", () => ({
  readSearchProviderConfig,
  saveSearchProviderConfig,
}));

vi.mock("../web/server/services/search-orchestrator.js", () => ({
  getSearchStatus: () => ({
    local: { configured: true },
    web: { configured: false, endpointHost: null },
  }),
  searchAll,
}));

describe("search routes", () => {
  beforeEach(() => {
    readSearchProviderConfig.mockReset();
    readSearchProviderConfig.mockReturnValue({
      url: "https://search.example.com/query/",
      keyConfigured: true,
      model: "provider/model",
    });
    saveSearchProviderConfig.mockReset();
    saveSearchProviderConfig.mockImplementation((_projectRoot: string, input: unknown) => ({
      url: typeof (input as { url?: unknown }).url === "string" ? (input as { url: string }).url : "",
      keyConfigured: Boolean((input as { key?: unknown }).key),
      model: typeof (input as { model?: unknown }).model === "string" ? (input as { model: string }).model : "",
    }));
    searchAll.mockReset();
    searchAll.mockResolvedValue({
      scope: "local",
      mode: "keyword",
      local: {
        mode: "keyword",
        results: [],
      },
      web: {
        results: [],
      },
    });
  });

  it("registers GET /api/search and returns local results by default", async () => {
    const getRoutes: Array<{
      path: string;
      handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void;
    }> = [];

    const app = {
      get(path: string, handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void) {
        getRoutes.push({ path, handler });
        return app;
      },
      put() {
        return app;
      },
    };

    registerSearchRoutes(app as never, { wikiRoot: "wiki", port: 4175, host: "127.0.0.1", author: "me", projectRoot: "project" });

    expect(getRoutes).toHaveLength(3);
    expect(getRoutes[0]?.path).toBe("/api/search");

    const json = vi.fn();
    await getRoutes[0].handler({ query: { q: "redis", mode: "keyword" } }, { json });

    expect(searchAll).toHaveBeenCalledWith(
      expect.objectContaining({ wikiRoot: "wiki" }),
      "redis",
      {
        scope: "local",
        mode: "keyword",
      },
    );
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        scope: "local",
        mode: "keyword",
        local: {
          mode: "keyword",
          results: [],
        },
        web: {
          results: [],
        },
      },
    });
  });

  it("registers GET /api/search/status for visible provider state", () => {
    const getRoutes: Array<{
      path: string;
      handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void;
    }> = [];

    const app = {
      get(path: string, handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void) {
        getRoutes.push({ path, handler });
        return app;
      },
      put() {
        return app;
      },
    };

    registerSearchRoutes(app as never, { wikiRoot: "wiki", port: 4175, host: "127.0.0.1", author: "me", projectRoot: "project" });

    const json = vi.fn();
    getRoutes[1]?.handler({ query: {} }, { json });

    expect(getRoutes[1]?.path).toBe("/api/search/status");
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        local: { configured: true },
        web: { configured: false, endpointHost: null },
      },
    });
  });

  it("registers GET /api/search/config and returns the persisted provider config", () => {
    const getRoutes: Array<{
      path: string;
      handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void;
    }> = [];

    const app = {
      get(path: string, handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void) {
        getRoutes.push({ path, handler });
        return app;
      },
      put() {
        return app;
      },
    };

    registerSearchRoutes(app as never, { wikiRoot: "wiki", port: 4175, host: "127.0.0.1", author: "me", projectRoot: "project-root" });

    const json = vi.fn();
    getRoutes[2]?.handler({ query: {} }, { json });

    expect(getRoutes[2]?.path).toBe("/api/search/config");
    expect(readSearchProviderConfig).toHaveBeenCalledWith("project-root");
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        url: "https://search.example.com/query/",
        keyConfigured: true,
        model: "provider/model",
      },
    });
  });

  it("registers PUT /api/search/config and saves the provider config", async () => {
    const putRoutes: Array<{
      path: string;
      handler: (req: { body?: unknown }, res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } }) => Promise<void> | void;
    }> = [];

    const app = {
      get() {
        return app;
      },
      put(
        path: string,
        handler: (req: { body?: unknown }, res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } }) => Promise<void> | void,
      ) {
        putRoutes.push({ path, handler });
        return app;
      },
    };

    registerSearchRoutes(app as never, { wikiRoot: "wiki", port: 4175, host: "127.0.0.1", author: "me", projectRoot: "project-root" });

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await putRoutes[0]?.handler(
      {
        body: {
          url: "https://search.example.com/live",
          key: "search-secret",
          model: "provider/search-model",
        },
      },
      { json, status },
    );

    expect(putRoutes[0]?.path).toBe("/api/search/config");
    expect(saveSearchProviderConfig).toHaveBeenCalledWith("project-root", {
      url: "https://search.example.com/live",
      key: "search-secret",
      model: "provider/search-model",
    });
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        url: "https://search.example.com/live",
        keyConfigured: true,
        model: "provider/search-model",
      },
    });
    expect(status).not.toHaveBeenCalled();
  });

  it("supports scope=all and returns separate local and web buckets", async () => {
    searchAll.mockResolvedValue({
      scope: "all",
      mode: "hybrid",
      local: {
        mode: "hybrid",
        results: [{ id: "l1", title: "Redis", path: "wiki/concepts/redis.md", layer: "wiki", excerpt: "cache", tags: [], modifiedAt: null }],
      },
      web: {
        results: [{ title: "Redis Docs", url: "https://redis.io", snippet: "external" }],
      },
    });

    const getRoutes: Array<{
      path: string;
      handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void;
    }> = [];
    const app = {
      get(path: string, handler: (req: { query?: Record<string, string | undefined> }, res: { json: (body: unknown) => void }) => Promise<void> | void) {
        getRoutes.push({ path, handler });
        return app;
      },
      put() {
        return app;
      },
    };

    registerSearchRoutes(app as never, { wikiRoot: "wiki", port: 4175, host: "127.0.0.1", author: "me", projectRoot: "project" });

    const json = vi.fn();
    await getRoutes[0].handler({ query: { q: "redis", mode: "hybrid", scope: "all" } }, { json });

    expect(searchAll).toHaveBeenCalledWith(
      expect.objectContaining({ wikiRoot: "wiki" }),
      "redis",
      {
        scope: "all",
        mode: "hybrid",
      },
    );
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        scope: "all",
        mode: "hybrid",
        local: {
          mode: "hybrid",
          results: [{ id: "l1", title: "Redis", path: "wiki/concepts/redis.md", layer: "wiki", excerpt: "cache", tags: [], modifiedAt: null }],
        },
        web: {
          results: [{ title: "Redis Docs", url: "https://redis.io", snippet: "external" }],
        },
      },
    });
  });
});
