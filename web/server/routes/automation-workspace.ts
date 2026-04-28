/**
 * Read-only automation workspace routes plus comment/layout mutations.
 *
 * These endpoints feed the automation list, detail canvas, right-side comment
 * panel, and log page without exposing config-editing concerns from settings.
 */

import type { Express, Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import {
  getAutomationWorkspaceEventStream,
  type AutomationWorkspaceEventStream,
} from "../services/automation-workspace-events.js";
import {
  createAutomationWorkspaceComment,
  deleteAutomationWorkspaceComment,
  saveAutomationWorkspaceLayout,
  updateAutomationWorkspaceComment,
} from "../services/automation-workspace-store.js";
import {
  listAutomationWorkspace,
  listAutomationWorkspaceCommentsForId,
  listAutomationWorkspaceLogsForId,
  readAutomationWorkspaceDetail,
  readAutomationWorkspaceLayoutForId,
} from "../services/automation-workspace.js";

export function registerAutomationWorkspaceRoutes(app: Express, cfg: ServerConfig): void {
  app.get("/api/automation-workspace", handleAutomationWorkspaceList(cfg));
  app.get("/api/automation-workspace/events", handleAutomationWorkspaceEvents(getAutomationWorkspaceEventStream(cfg.projectRoot)));
  app.get("/api/automation-workspace/:id", handleAutomationWorkspaceDetail(cfg));
  app.get("/api/automation-workspace/:id/logs", handleAutomationWorkspaceLogs(cfg));
  app.get("/api/automation-workspace/:id/comments", handleAutomationWorkspaceComments(cfg));
  app.post("/api/automation-workspace/:id/comments", handleAutomationWorkspaceCommentCreate(cfg));
  app.patch("/api/automation-workspace/:id/comments/:commentId", handleAutomationWorkspaceCommentPatch(cfg));
  app.delete("/api/automation-workspace/:id/comments/:commentId", handleAutomationWorkspaceCommentDelete(cfg));
  app.get("/api/automation-workspace/:id/layout", handleAutomationWorkspaceLayoutGet(cfg));
  app.put("/api/automation-workspace/:id/layout", handleAutomationWorkspaceLayoutSave(cfg));
}

export function handleAutomationWorkspaceList(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { automations: await listAutomationWorkspace(cfg.projectRoot) } });
    } catch (error) {
      respondError(res, 500, error);
    }
  };
}

export function handleAutomationWorkspaceDetail(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    try {
      const detail = await readAutomationWorkspaceDetail(cfg.projectRoot, cfg.runtimeRoot, readAutomationId(req));
      if (!detail) {
        res.status(404).json({ success: false, error: "Automation not found." });
        return;
      }
      res.json({ success: true, data: detail });
    } catch (error) {
      respondError(res, 500, error);
    }
  };
}

export function handleAutomationWorkspaceEvents(events: AutomationWorkspaceEventStream) {
  return (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    writeSse(res, "change", events.snapshot());
    const unsubscribe = events.subscribe((event) => {
      writeSse(res, "change", event);
    });
    req.on("close", () => {
      unsubscribe();
    });
  };
}

export function handleAutomationWorkspaceLogs(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          logs: listAutomationWorkspaceLogsForId(cfg.runtimeRoot, readAutomationId(req)),
        },
      });
    } catch (error) {
      respondError(res, 500, error);
    }
  };
}

function handleAutomationWorkspaceComments(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: listAutomationWorkspaceCommentsForId(cfg.runtimeRoot, readAutomationId(req)),
      });
    } catch (error) {
      respondError(res, 500, error);
    }
  };
}

export function handleAutomationWorkspaceCommentCreate(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const commentDraft = parseCommentDraft(req.body);
      res.json({
        success: true,
        data: createAutomationWorkspaceComment(cfg.runtimeRoot, readAutomationId(req), commentDraft),
      });
    } catch (error) {
      respondError(res, 400, error);
    }
  };
}

export function handleAutomationWorkspaceCommentPatch(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const updated = updateAutomationWorkspaceComment(
        cfg.runtimeRoot,
        readAutomationId(req),
        String(req.params.commentId ?? ""),
        parseCommentPatch(req.body),
      );
      if (!updated) {
        res.status(404).json({ success: false, error: "Comment not found." });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      respondError(res, 400, error);
    }
  };
}

export function handleAutomationWorkspaceCommentDelete(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const removed = deleteAutomationWorkspaceComment(
        cfg.runtimeRoot,
        readAutomationId(req),
        String(req.params.commentId ?? ""),
      );
      if (!removed) {
        res.status(404).json({ success: false, error: "Comment not found." });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      respondError(res, 400, error);
    }
  };
}

export function handleAutomationWorkspaceLayoutGet(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: readAutomationWorkspaceLayoutForId(cfg.runtimeRoot, readAutomationId(req)),
      });
    } catch (error) {
      respondError(res, 500, error);
    }
  };
}

export function handleAutomationWorkspaceLayoutSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: saveAutomationWorkspaceLayout(
          cfg.runtimeRoot,
          readAutomationId(req),
          req.body?.branchOffsets ?? {},
        ),
      });
    } catch (error) {
      respondError(res, 400, error);
    }
  };
}

function respondError(res: Response, status: number, error: unknown): void {
  res.status(status).json({
    success: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

function readAutomationId(req: Request): string {
  return String(req.params.id ?? "");
}

function parseCommentDraft(body: unknown): {
  targetType: "node" | "edge" | "canvas";
  targetId: string;
  text: string;
  pinnedX: number;
  pinnedY: number;
  manualX?: number;
  manualY?: number;
} {
  const targetType = requireTargetType(body);
  const targetId = readCommentField(body, "targetId");
  const text = readCommentField(body, "text");
  if (!targetId || !text) {
    throw new Error("Comment targetId and text are required.");
  }
  const pinnedX = requireNumber(body, "pinnedX");
  const pinnedY = requireNumber(body, "pinnedY");
  const manualX = readOptionalNumber(body, "manualX");
  const manualY = readOptionalNumber(body, "manualY");
  return {
    targetType,
    targetId,
    text,
    pinnedX,
    pinnedY,
    ...(typeof manualX === "number" ? { manualX } : {}),
    ...(typeof manualY === "number" ? { manualY } : {}),
  };
}

function parseCommentPatch(body: unknown): Partial<{
  text: string;
  targetType: "node" | "edge" | "canvas";
  targetId: string;
  pinnedX: number;
  pinnedY: number;
  manualX: number | null;
  manualY: number | null;
}> {
  const patch: Partial<{
    text: string;
    targetType: "node" | "edge" | "canvas";
    targetId: string;
    pinnedX: number;
    pinnedY: number;
    manualX: number | null;
    manualY: number | null;
  }> = {};
  const text = readOptionalString(body, "text");
  const targetType = readTargetType(body);
  const targetId = readOptionalString(body, "targetId");
  const pinnedX = readOptionalNumber(body, "pinnedX");
  const pinnedY = readOptionalNumber(body, "pinnedY");
  const manualX = readOptionalNullableNumber(body, "manualX");
  const manualY = readOptionalNullableNumber(body, "manualY");

  if (typeof text === "string") patch.text = text;
  if (targetType) patch.targetType = targetType;
  if (typeof targetId === "string") patch.targetId = targetId;
  if (typeof pinnedX === "number") patch.pinnedX = pinnedX;
  if (typeof pinnedY === "number") patch.pinnedY = pinnedY;
  if (manualX !== undefined) patch.manualX = manualX;
  if (manualY !== undefined) patch.manualY = manualY;

  return patch;
}

function readCommentField(body: unknown, key: "targetId" | "text"): string {
  return readOptionalString(body, key) ?? "";
}

function readOptionalString(body: unknown, key: "targetId" | "text"): string | undefined {
  const value = readBodyValue(body, key);
  if (value === undefined) {
    return undefined;
  }
  return String(value).trim();
}

function readOptionalNumber(body: unknown, key: "pinnedX" | "pinnedY" | "manualX" | "manualY"): number | undefined {
  const value = readBodyValue(body, key);
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Comment ${key} must be a finite number.`);
  }
  return value;
}

function readOptionalNullableNumber(body: unknown, key: "manualX" | "manualY"): number | null | undefined {
  const value = readBodyValue(body, key);
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Comment ${key} must be a finite number or null.`);
  }
  return value;
}

function readTargetType(body: unknown): "node" | "edge" | "canvas" | undefined {
  const value = readBodyValue(body, "targetType");
  if (value === undefined) {
    return undefined;
  }
  if (value === "node" || value === "edge" || value === "canvas") {
    return value;
  }
  throw new Error("Comment targetType must be node, edge, or canvas.");
}

function requireTargetType(body: unknown): "node" | "edge" | "canvas" {
  const targetType = readTargetType(body);
  if (!targetType) {
    throw new Error("Comment targetType is required.");
  }
  return targetType;
}

function requireNumber(body: unknown, key: "pinnedX" | "pinnedY"): number {
  const value = readOptionalNumber(body, key);
  if (value === undefined) {
    throw new Error("Comment pinnedX and pinnedY are required.");
  }
  return value;
}

function readBodyValue(
  body: unknown,
  key: "targetId" | "text" | "targetType" | "pinnedX" | "pinnedY" | "manualX" | "manualY",
): unknown {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  return (body as Record<string, unknown>)[key];
}

function writeSse(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
