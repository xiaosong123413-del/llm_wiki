import type { Express, Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { getAgentConfigRelativePath, readAgentConfig, saveAgentConfig } from "../services/agent-config.js";

export function registerAgentConfigRoutes(app: Express, cfg: ServerConfig): void {
  app.get("/api/agent-config", handleAgentConfig(cfg));
  const maybePut = (app as Express & { put?: Express["put"] }).put;
  maybePut?.call(app, "/api/agent-config", handleAgentConfigSave(cfg));
}

export function handleAgentConfig(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          ...readAgentConfig(cfg.projectRoot),
          path: getAgentConfigRelativePath(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function handleAgentConfigSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          ...saveAgentConfig(cfg.projectRoot, req.body ?? {}),
          path: getAgentConfigRelativePath(),
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
