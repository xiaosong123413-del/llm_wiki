import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import {
  addConversationMessage,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
} from "../services/chat-store.js";
import { readAppConfig } from "../services/app-config.js";
import { generateAssistantReply, streamAssistantReply } from "../services/llm-chat.js";
import { completeGuidedIngestFromConversation } from "../services/guided-ingest.js";

type ConversationMessageResult = NonNullable<ReturnType<typeof addConversationMessage>>;
type CreateConversationPayload = Parameters<typeof createConversation>[1];
type UpdateConversationPayload = Parameters<typeof updateConversation>[2];
type RequestBodyRecord = Record<string, unknown>;

interface IncomingChatMessage {
  content: string;
  articleRefs: string[];
}

interface PreparedConversationMessage {
  conversation: ConversationMessageResult;
  message: IncomingChatMessage;
}

const ASSISTANT_REPLY_PERSIST_ERROR = "assistant reply could not be persisted";

export function handleChatList(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    res.json({ success: true, data: listConversations(cfg.runtimeRoot) });
  };
}

export function handleChatCreate(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const conversation = createConversation(cfg.runtimeRoot, readCreateConversationInput(cfg, req));
    res.status(201).json({ success: true, data: conversation });
  };
}

export function handleChatGet(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const conversation = getConversation(cfg.runtimeRoot, req.params.id);
    if (!conversation) {
      res.status(404).json({ success: false, error: "conversation not found" });
      return;
    }
    res.json({ success: true, data: conversation });
  };
}

export function handleChatPatch(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const conversation = updateConversation(cfg.runtimeRoot, req.params.id, readUpdateConversationInput(req));
    if (!conversation) {
      res.status(404).json({ success: false, error: "conversation not found" });
      return;
    }
    res.json({ success: true, data: conversation });
  };
}

export function handleChatDelete(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const deleted = deleteConversation(cfg.runtimeRoot, req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "conversation not found" });
      return;
    }
    res.json({ success: true, data: { id: req.params.id } });
  };
}

export function handleChatAddMessage(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const prepared = prepareConversationMessage(cfg, req, res);
    if (!prepared) {
      return;
    }
    let conversation = prepared.conversation;

    try {
      const reply = await produceAssistantReply(cfg, conversation);
      conversation = persistAssistantReply(cfg, req.params.id, reply);
    } catch (error) {
      sendChatRouteError(res, error);
      return;
    }

    if (!conversation) {
      res.status(500).json({ success: false, error: ASSISTANT_REPLY_PERSIST_ERROR });
      return;
    }
    res.json({ success: true, data: conversation });
  };
}

export function handleChatStreamMessage(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const prepared = prepareConversationMessage(cfg, req, res);
    if (!prepared) {
      return;
    }
    let conversation = prepared.conversation;

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    writeSse(res, "user", { conversation });

    try {
      const reply = await produceAssistantReply(cfg, conversation, (token) => {
        writeSse(res, "token", { token });
      });
      conversation = persistAssistantReply(cfg, req.params.id, reply);
      if (!conversation) {
        writeStreamError(res, ASSISTANT_REPLY_PERSIST_ERROR);
        return;
      }
      writeStreamDone(res, conversation);
    } catch (error) {
      writeStreamError(res, error);
    } finally {
      res.end();
    }
  };
}

function prepareConversationMessage(
  cfg: ServerConfig,
  req: Request,
  res: Response,
): PreparedConversationMessage | null {
  const message = readIncomingChatMessage(req);
  if (!message) {
    res.status(400).json({ success: false, error: "content is required" });
    return null;
  }
  syncIncomingAgent(cfg, req);
  const conversation = addConversationMessage(cfg.runtimeRoot, req.params.id, {
    role: "user",
    content: message.content,
    articleRefs: message.articleRefs,
  });
  if (!conversation) {
    res.status(404).json({ success: false, error: "conversation not found" });
    return null;
  }
  return { conversation, message };
}

function readIncomingChatMessage(req: Request): IncomingChatMessage | null {
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    return null;
  }
  return {
    content,
    articleRefs: Array.isArray(req.body?.articleRefs) ? req.body.articleRefs : [],
  };
}

function readCreateConversationInput(cfg: ServerConfig, req: Request): CreateConversationPayload {
  const body = readRequestBody(req.body);
  const requestedAppId = readRequestedAppId(body);
  const defaultAppId = readAppConfig(cfg.projectRoot).defaultAppId;
  return {
    title: readOptionalString(body, "title"),
    webSearchEnabled: readOptionalBoolean(body, "webSearchEnabled"),
    searchScope: normalizeSearchScope(body?.searchScope),
    appId: requestedAppId === undefined ? defaultAppId ?? undefined : requestedAppId,
    articleRefs: readOptionalStringArray(body, "articleRefs"),
  };
}

function readUpdateConversationInput(req: Request): UpdateConversationPayload {
  const body = readRequestBody(req.body);
  return {
    title: readOptionalString(body, "title"),
    webSearchEnabled: readOptionalBoolean(body, "webSearchEnabled"),
    searchScope: normalizeSearchScope(body?.searchScope),
    appId: readRequestedAppId(body),
    articleRefs: readOptionalStringArray(body, "articleRefs"),
  };
}

async function produceAssistantReply(
  cfg: ServerConfig,
  conversation: ConversationMessageResult,
  onToken?: (token: string) => void,
): Promise<string> {
  const guided = completeGuidedIngestFromConversation(cfg.sourceVaultRoot, conversation);
  if (guided) {
    return buildGuidedIngestReply(guided.createdPage);
  }
  if (onToken) {
    return streamAssistantReply(cfg.sourceVaultRoot, conversation, { projectRoot: cfg.projectRoot }, onToken);
  }
  return generateAssistantReply(cfg.sourceVaultRoot, conversation, { projectRoot: cfg.projectRoot });
}

function writeSse(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeStreamDone(res: Response, conversation: ConversationMessageResult): void {
  writeSse(res, "done", { conversation });
}

function writeStreamError(res: Response, error: unknown): void {
  writeSse(res, "error", {
    error: error instanceof Error ? error.message : String(error),
  });
}

function persistAssistantReply(cfg: ServerConfig, conversationId: string, reply: string) {
  return addConversationMessage(cfg.runtimeRoot, conversationId, {
    role: "assistant",
    content: normalizeAssistantReply(reply),
  });
}

function buildGuidedIngestReply(createdPage: string): string {
  return `\u5df2\u5b8c\u6210\u4eb2\u81ea\u6307\u5bfc\u5f55\u5165\uff1a${createdPage}\n\n\u4e0b\u4e00\u6b65\u53ef\u4ee5\u8fd0\u884c\u540c\u6b65\u7f16\u8bd1\uff0c\u91cd\u5efa index / MOC / log\u3002`;
}

function normalizeAssistantReply(reply: string): string {
  return reply.trim() || "\u62b1\u6b49\uff0c\u8fd9\u4e00\u8f6e\u6ca1\u6709\u751f\u6210\u6709\u6548\u56de\u7b54\u3002";
}

function sendChatRouteError(res: Response, error: unknown): void {
  res.status(502).json({
    success: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

function normalizeSearchScope(value: unknown): "local" | "web" | "all" | undefined {
  return value === "web" || value === "all" || value === "local" ? value : undefined;
}

function normalizeAppId(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRequestBody(value: unknown): RequestBodyRecord | null {
  return value && typeof value === "object" ? value as RequestBodyRecord : null;
}

function readOptionalString(body: RequestBodyRecord | null, key: string): string | undefined {
  return typeof body?.[key] === "string" ? body[key] as string : undefined;
}

function readOptionalBoolean(body: RequestBodyRecord | null, key: string): boolean | undefined {
  return typeof body?.[key] === "boolean" ? body[key] as boolean : undefined;
}

function readOptionalStringArray(body: RequestBodyRecord | null, key: string): string[] | undefined {
  const value = body?.[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function readRequestedAppId(body: RequestBodyRecord | null): string | null | undefined {
  if (!body) {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(body, "appId")) {
    return normalizeAppId(body.appId);
  }
  if (Object.prototype.hasOwnProperty.call(body, "agentId")) {
    return normalizeAppId(body.agentId);
  }
  return undefined;
}

function syncIncomingAgent(cfg: ServerConfig, req: Request): void {
  const appId = readRequestedAppId(readRequestBody(req.body));
  if (appId !== undefined) {
    updateConversation(cfg.runtimeRoot, req.params.id, { appId });
  }
}
