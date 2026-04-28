import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { readDouyinCookieStatus, saveDouyinCookie } from "../services/douyin-sync.js";

export function handleDouyinCookieStatusGet(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    try {
      res.json({ success: true, data: readDouyinCookieStatus(cfg.projectRoot) });
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function handleDouyinCookieSave(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    try {
      const cookie = stringBody(req.body?.cookie);
      if (!cookie) {
        throw new Error("cookie 不能为空");
      }
      const data = await saveDouyinCookie(cfg.projectRoot, cookie);
      res.json({ success: true, data, message: "抖音 cookie 已保存" });
    } catch (error) {
      sendError(res, error);
    }
  };
}

function stringBody(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sendError(res: Response, error: unknown): void {
  res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
}
