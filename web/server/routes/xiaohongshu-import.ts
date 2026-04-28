import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import {
  clearXiaohongshuImportConfig,
  getXiaohongshuImportProgress,
  readXiaohongshuImportConfig,
  saveXiaohongshuImportConfig,
  saveXiaohongshuCookie,
  startXiaohongshuImport,
  type XiaohongshuImportOptions,
} from "../services/xiaohongshu-import.js";

interface XiaohongshuImportRouteOptions extends XiaohongshuImportOptions {}

export function handleXiaohongshuImportConfigGet(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    try {
      res.json({ success: true, data: readXiaohongshuImportConfig(cfg.projectRoot) });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function handleXiaohongshuImportConfigSave(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    try {
      const importDirPath = stringBody(req.body?.importDirPath);
      if (!importDirPath) {
        throw new Error("导入文件夹地址不能为空");
      }
      const data = await saveXiaohongshuImportConfig(cfg.projectRoot, importDirPath);
      res.json({ success: true, data, message: "导入文件夹已保存" });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function handleXiaohongshuImportConfigDelete(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    try {
      await clearXiaohongshuImportConfig(cfg.projectRoot);
      res.json({ success: true, message: "导入文件夹已删除" });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function handleXiaohongshuCookieSave(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    try {
      const cookie = stringBody(req.body?.cookie);
      if (!cookie) {
        throw new Error("cookie 不能为空");
      }
      await saveXiaohongshuCookie(cfg.projectRoot, cookie);
      res.json({ success: true, message: "cookie 保存成功" });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function handleXiaohongshuImportStart(cfg: ServerConfig, options: XiaohongshuImportRouteOptions = {}) {
  return async (_req: Request, res: Response) => {
    try {
      const task = await startXiaohongshuImport(cfg.projectRoot, {
        ...options,
        wikiRoot: options.wikiRoot ?? cfg.sourceVaultRoot,
      });
      res.json({ success: true, taskId: task.id });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function handleXiaohongshuImportProgress(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const progress = getXiaohongshuImportProgress(cfg.projectRoot, stringQuery(req.query.taskId));
      res.json({ success: progress.status !== "error", ...progress });
    } catch (error) {
      sendError(res, error);
    }
  };
}

function stringBody(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sendError(res: Response, error: unknown): void {
  res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
}
