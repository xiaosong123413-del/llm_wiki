/**
 * Registers and implements the WebUI LLM configuration routes.
 */
import type { Express, Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { readLlmProviderConfig, saveLlmProviderConfig, testLlmProviderConfig } from "../services/llm-config.js";
import { deleteLlmApiAccount, readLlmApiAccounts, saveLlmApiAccount } from "../services/llm-accounts.js";

export function registerLlmRoutes(app: Express, cfg: ServerConfig): void {
  app.get("/api/llm/config", handleLlmConfig(cfg));
  app.get("/api/llm/accounts", handleLlmAccounts(cfg));
  const maybePut = (app as Express & { put?: Express["put"] }).put;
  const maybeDelete = (app as Express & { delete?: Express["delete"] }).delete;
  maybePut?.call(app, "/api/llm/config", handleLlmConfigSave(cfg));
  maybePut?.call(app, "/api/llm/accounts", handleLlmAccountSave(cfg));
  maybeDelete?.call(app, "/api/llm/accounts", handleLlmAccountDelete(cfg));
  app.post("/api/llm/test", handleLlmConfigTest(cfg));
}

function handleLlmConfig(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    res.json({ success: true, data: readLlmProviderConfig(cfg.projectRoot) });
  };
}

function handleLlmConfigSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const data = saveLlmProviderConfig(cfg.projectRoot, req.body ?? {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

function handleLlmAccounts(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    res.json({ success: true, data: readLlmApiAccounts(cfg.projectRoot) });
  };
}

function handleLlmAccountSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const data = saveLlmApiAccount(cfg.projectRoot, req.body ?? {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

function handleLlmAccountDelete(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const data = deleteLlmApiAccount(cfg.projectRoot, req.body ?? {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

function handleLlmConfigTest(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    try {
      const data = await testLlmProviderConfig(cfg.projectRoot, req.body ?? {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
