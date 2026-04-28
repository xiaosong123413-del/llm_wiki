import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { readSyncRepoConfig, saveSyncRepoConfig } from "../services/sync-config.js";

export function handleSyncConfigGet(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    try {
      res.json({ success: true, data: readSyncRepoConfig(cfg.projectRoot) });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function handleSyncConfigSave(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    try {
      const data = await saveSyncRepoConfig(cfg.projectRoot, {
        sourceVaultRoot: stringBody(req.body?.sourceVaultRoot) ?? "",
        runtimeOutputRoot: stringBody(req.body?.runtimeOutputRoot) ?? "",
        sourceRepoPaths: readPathList(req.body?.sourceRepoPaths),
      });
      res.json({ success: true, data, message: "同步配置已保存" });
    } catch (error) {
      sendError(res, error);
    }
  };
}

function readPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function stringBody(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sendError(res: Response, error: unknown): void {
  res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
}
