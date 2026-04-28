/**
 * Save route for editable wiki markdown pages.
 *
 * Only source-backed wiki markdown files are writable. Runtime-generated pages
 * such as wiki/index.md remain read-only.
 */

import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { clearPageRenderCacheForPath } from "./pages.js";
import { resolveEditableSourceMarkdownPath } from "../runtime-paths.js";

export function handlePageSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const logicalPath = normalizeLogicalPath(req.body?.path);
    if (!logicalPath) {
      res.status(400).json({ success: false, error: "invalid page path" });
      return;
    }

    const editablePath = resolveEditableSourceMarkdownPath(cfg, logicalPath);
    if (!editablePath) {
      res.status(400).json({ success: false, error: "page is not editable" });
      return;
    }

    const raw = typeof req.body?.raw === "string" ? req.body.raw : "";
    fs.mkdirSync(path.dirname(editablePath), { recursive: true });
    fs.writeFileSync(editablePath, raw.endsWith("\n") ? raw : `${raw}\n`, "utf-8");
    clearPageRenderCacheForPath(editablePath);

    res.json({
      success: true,
      data: {
        path: logicalPath,
        modifiedAt: fs.statSync(editablePath).mtime.toISOString(),
      },
    });
  };
}

function normalizeLogicalPath(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) {
    return null;
  }
  const normalized = path.posix.normalize(input.replace(/\\/g, "/"));
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("../")) {
    return null;
  }
  return normalized;
}
