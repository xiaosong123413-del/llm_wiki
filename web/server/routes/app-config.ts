import type { Express, Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { getAppConfigRelativePath, readAppConfig, saveAppConfig } from "../services/app-config.js";

export function registerAppConfigRoutes(app: Express, cfg: ServerConfig): void {
  app.get("/api/app-config", handleAppConfig(cfg));
  const maybePut = (app as Express & { put?: Express["put"] }).put;
  maybePut?.call(app, "/api/app-config", handleAppConfigSave(cfg));
}

export function handleAppConfig(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          ...readAppConfig(cfg.projectRoot),
          path: getAppConfigRelativePath(),
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

export function handleAppConfigSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          ...saveAppConfig(cfg.projectRoot, req.body ?? {}),
          path: getAppConfigRelativePath(),
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
