import type { Express, Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import {
  getAutomationConfigRelativePath,
  readAutomationConfig,
  saveAutomationConfig,
} from "../services/automation-config.js";

export function registerAutomationConfigRoutes(app: Express, cfg: ServerConfig): void {
  app.get("/api/automations", handleAutomationConfig(cfg));
  const maybePut = (app as Express & { put?: Express["put"] }).put;
  maybePut?.call(app, "/api/automations", handleAutomationConfigSave(cfg));
}

export function handleAutomationConfig(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          ...readAutomationConfig(cfg.projectRoot),
          path: getAutomationConfigRelativePath(),
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

export function handleAutomationConfigSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          ...saveAutomationConfig(cfg.projectRoot, req.body ?? {}),
          path: getAutomationConfigRelativePath(),
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
