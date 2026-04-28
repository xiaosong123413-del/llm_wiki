/**
 * Registers and implements the WebUI unified search routes.
 */
import type { Express, Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { getSearchStatus, searchAll, type SearchScope } from "../services/search-orchestrator.js";
import { readSearchProviderConfig, saveSearchProviderConfig } from "../services/search-config.js";
import type { SearchMode } from "../services/search-router.js";

export function registerSearchRoutes(app: Express, cfg: ServerConfig) {
  app.get("/api/search", handleSearch(cfg));
  app.get("/api/search/status", handleSearchStatus());
  app.get("/api/search/config", handleSearchConfig(cfg));
  const maybePut = (app as Express & { put?: Express["put"] }).put;
  maybePut?.call(app, "/api/search/config", handleSearchConfigSave(cfg));
  const maybePost = (app as Express & { post?: Express["post"] }).post;
  maybePost?.call(app, "/api/search/test", handleSearchTest(cfg));
}

function handleSearch(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const mode = normalizeMode(req.query.mode);
    const scope = normalizeScope(req.query.scope);
    const data = await searchAll(cfg, query, { scope, mode });
    res.json({ success: true, data });
  };
}

function handleSearchStatus() {
  return (_req: Request, res: Response) => {
    res.json({ success: true, data: getSearchStatus() });
  };
}

function handleSearchConfig(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    res.json({ success: true, data: readSearchProviderConfig(cfg.projectRoot) });
  };
}

function handleSearchConfigSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const data = saveSearchProviderConfig(cfg.projectRoot, req.body ?? {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

function handleSearchTest(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    const status = getSearchStatus();
    if (!status.web.configured) {
      res.json({
        success: true,
        data: {
          ok: false,
          message: "\u672a\u914d\u7f6e\u7f51\u7edc\u641c\u7d22 endpoint\u3002",
        },
      });
      return;
    }
    const data = await searchAll(cfg, "LLM Wiki connectivity test", {
      scope: "web",
      mode: "keyword",
      webLimit: 1,
    });
    res.json({
      success: true,
      data: {
        ok: data.web.results.length > 0,
        message: data.web.results.length > 0 ? "\u7f51\u7edc\u641c\u7d22 API \u53ef\u7528\u3002" : "\u7f51\u7edc\u641c\u7d22 API \u5df2\u8fde\u63a5\uff0c\u4f46\u6d4b\u8bd5\u6ca1\u6709\u8fd4\u56de\u7ed3\u679c\u3002",
      },
    });
  };
}

function normalizeMode(input: unknown): SearchMode {
  return input === "direct" || input === "hybrid" ? input : "keyword";
}

function normalizeScope(input: unknown): SearchScope {
  return input === "web" || input === "all" ? input : "local";
}
