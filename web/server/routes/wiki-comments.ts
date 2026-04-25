import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import {
  createWikiComment,
  deleteWikiComment,
  listWikiComments,
  updateWikiComment,
} from "../services/wiki-comments.js";
import {
  confirmWikiCommentAiDraft,
  discardWikiCommentAiDraft,
  generateWikiCommentAiDraft,
} from "../services/wiki-comment-ai-drafts.js";

export function handleWikiCommentsList(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const pagePath = String(req.query.path ?? "").trim();
    if (!pagePath) {
      res.status(400).json({ error: "path is required" });
      return;
    }
    res.json({ success: true, data: listWikiComments(cfg.runtimeRoot, pagePath) });
  };
}

export function handleWikiCommentsCreate(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const { path: pagePath, quote, text, start, end } = req.body as {
      path?: string;
      quote?: string;
      text?: string;
      start?: number;
      end?: number;
    };
    if (!pagePath || typeof pagePath !== "string") {
      res.status(400).json({ error: "path is required" });
      return;
    }
    if (!quote || typeof quote !== "string") {
      res.status(400).json({ error: "quote is required" });
      return;
    }
    if (typeof start !== "number" || typeof end !== "number" || end <= start) {
      res.status(400).json({ error: "start and end must be valid numbers" });
      return;
    }
    const created = createWikiComment(cfg.runtimeRoot, {
      path: pagePath,
      quote,
      text: typeof text === "string" ? text : "",
      start,
      end,
    });
    res.json({ success: true, data: created });
  };
}

export function handleWikiCommentsUpdate(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const { path: pagePath, text, resolved } = req.body as {
      path?: string;
      text?: string;
      resolved?: boolean;
    };
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }
    if (!pagePath || typeof pagePath !== "string") {
      res.status(400).json({ error: "path is required" });
      return;
    }
    const updated = updateWikiComment(cfg.runtimeRoot, pagePath, id, {
      text,
      resolved,
    });
    if (!updated) {
      res.status(404).json({ error: "comment not found" });
      return;
    }
    res.json({ success: true, data: updated });
  };
}

export function handleWikiCommentsDelete(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const pagePath = String(req.query.path ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }
    if (!pagePath) {
      res.status(400).json({ error: "path is required" });
      return;
    }
    const removed = deleteWikiComment(cfg.runtimeRoot, pagePath, id);
    if (!removed) {
      res.status(404).json({ error: "comment not found" });
      return;
    }
    res.json({ success: true });
  };
}

export function handleWikiCommentAiDraftCreate(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }
    const draft = await generateWikiCommentAiDraft({
      projectRoot: cfg.projectRoot,
      sourceVaultRoot: cfg.sourceVaultRoot,
      runtimeRoot: cfg.runtimeRoot,
      commentId: id,
    });
    res.json({ success: true, data: draft });
  };
}

export function handleWikiCommentAiDraftConfirm(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const commentId = String(req.params.id ?? "").trim();
    const draftId = String(req.params.draftId ?? "").trim();
    if (!commentId || !draftId) {
      res.status(400).json({ success: false, error: "comment id and draft id are required" });
      return;
    }
    const draft = await confirmWikiCommentAiDraft({
      projectRoot: cfg.projectRoot,
      sourceVaultRoot: cfg.sourceVaultRoot,
      runtimeRoot: cfg.runtimeRoot,
      commentId,
      draftId,
    });
    res.json({ success: true, data: draft });
  };
}

export function handleWikiCommentAiDraftDiscard(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const commentId = String(req.params.id ?? "").trim();
    const draftId = String(req.params.draftId ?? "").trim();
    if (!commentId || !draftId) {
      res.status(400).json({ success: false, error: "comment id and draft id are required" });
      return;
    }
    const discarded = discardWikiCommentAiDraft(cfg.runtimeRoot, commentId, draftId);
    if (!discarded) {
      res.status(404).json({ success: false, error: "draft not found" });
      return;
    }
    res.json({ success: true });
  };
}
