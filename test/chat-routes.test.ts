import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConversation, getConversation } from "../web/server/services/chat-store.js";
import {
  handleChatCreate,
  handleChatAddMessage,
  handleChatPatch,
  handleChatStreamMessage,
} from "../web/server/routes/chat.js";

const tempRoots: string[] = [];
const {
  generateAssistantReplyMock,
  streamAssistantReplyMock,
  completeGuidedIngestFromConversationMock,
} = vi.hoisted(() => ({
  generateAssistantReplyMock: vi.fn(),
  streamAssistantReplyMock: vi.fn(),
  completeGuidedIngestFromConversationMock: vi.fn(),
}));

vi.mock("../web/server/services/llm-chat.js", () => ({
  generateAssistantReply: generateAssistantReplyMock,
  streamAssistantReply: streamAssistantReplyMock,
}));

vi.mock("../web/server/services/guided-ingest.js", () => ({
  completeGuidedIngestFromConversation: completeGuidedIngestFromConversationMock,
}));

describe("chat routes", () => {
  beforeEach(() => {
    generateAssistantReplyMock.mockReset();
    streamAssistantReplyMock.mockReset();
    completeGuidedIngestFromConversationMock.mockReset();
    completeGuidedIngestFromConversationMock.mockReturnValue(null);
  });

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root && fs.existsSync(root)) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects blank chat messages before touching conversation state", async () => {
    const cfg = makeConfig();
    const conversation = createConversation(cfg.runtimeRoot, { title: "Thread" });
    const response = createJsonResponse();

    await handleChatAddMessage(cfg)({
      params: { id: conversation.id },
      body: { content: "   " },
    } as never, response as never);

    expect(response.statusCode).toBe(400);
    expect(response.payload).toEqual({ success: false, error: "content is required" });
    expect(generateAssistantReplyMock).not.toHaveBeenCalled();
    expect(getConversation(cfg.runtimeRoot, conversation.id)?.messages).toHaveLength(0);
  });

  it("keeps the app binding empty when create receives an explicit null appId", async () => {
    const cfg = makeConfig();
    const response = createJsonResponse();

    handleChatCreate(cfg)({
      body: {
        title: "Unbound thread",
        appId: null,
      },
    } as never, response as never);

    expect(response.statusCode).toBe(201);
    expect(response.payload.data.title).toBe("Unbound thread");
    expect(response.payload.data.appId).toBeNull();
  });

  it("lets patch clear the app binding even when a legacy agentId is still present", () => {
    const cfg = makeConfig();
    const conversation = createConversation(cfg.runtimeRoot, {
      title: "Bound thread",
      appId: "writer-app",
    });
    const response = createJsonResponse();

    handleChatPatch(cfg)({
      params: { id: conversation.id },
      body: {
        appId: null,
        agentId: "legacy-agent",
      },
    } as never, response as never);

    expect(response.statusCode).toBe(200);
    expect(response.payload.data.appId).toBeNull();
  });

  it("persists the synced appId and assistant reply for regular chat messages", async () => {
    const cfg = makeConfig();
    const conversation = createConversation(cfg.runtimeRoot, { title: "Thread" });
    const response = createJsonResponse();
    generateAssistantReplyMock.mockResolvedValue("  Assistant reply  ");

    await handleChatAddMessage(cfg)({
      params: { id: conversation.id },
      body: {
        content: "Need a summary",
        appId: "writer-app",
        articleRefs: ["wiki/concepts/redis.md"],
      },
    } as never, response as never);

    expect(response.statusCode).toBe(200);
    expect(generateAssistantReplyMock).toHaveBeenCalledOnce();
    expect(generateAssistantReplyMock.mock.calls[0]?.[0]).toBe(cfg.sourceVaultRoot);
    expect(generateAssistantReplyMock.mock.calls[0]?.[2]).toEqual({ projectRoot: cfg.projectRoot });
    expect(response.payload.data.appId).toBe("writer-app");
    expect(response.payload.data.messages).toHaveLength(2);
    expect(response.payload.data.messages[0]?.content).toBe("Need a summary");
    expect(response.payload.data.messages[1]?.content).toBe("Assistant reply");
  });

  it("streams SSE tokens and persists the final assistant reply", async () => {
    const cfg = makeConfig();
    const conversation = createConversation(cfg.runtimeRoot, { title: "Thread" });
    const response = createStreamResponse();
    streamAssistantReplyMock.mockImplementation(async (_root, _conversation, _options, onToken?: (token: string) => void) => {
      onToken?.("Hello");
      onToken?.(" world");
      return "Hello world";
    });

    await handleChatStreamMessage(cfg)({
      params: { id: conversation.id },
      body: { content: "Stream this", agentId: "stream-app" },
    } as never, response as never);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    expect(response.output).toContain("event: user");
    expect(response.output).toContain("event: token");
    expect(response.output).toContain("event: done");
    expect(response.output).toContain("\"token\":\"Hello\"");
    expect(response.output).toContain("\"token\":\" world\"");
    expect(response.ended).toBe(true);

    const stored = getConversation(cfg.runtimeRoot, conversation.id);
    expect(stored?.appId).toBe("stream-app");
    expect(stored?.messages.at(-1)?.content).toBe("Hello world");
  });

  it("streams an error event when the assistant reply cannot be persisted", async () => {
    const cfg = makeConfig();
    const conversation = createConversation(cfg.runtimeRoot, { title: "Thread" });
    const response = createStreamResponse();
    streamAssistantReplyMock.mockImplementation(async (_root, _conversation, _options, onToken?: (token: string) => void) => {
      onToken?.("partial");
      fs.rmSync(path.join(cfg.runtimeRoot, ".chat", `${conversation.id}.json`), { force: true });
      return "Partial reply";
    });

    await handleChatStreamMessage(cfg)({
      params: { id: conversation.id },
      body: { content: "Stream this" },
    } as never, response as never);

    expect(response.statusCode).toBe(200);
    expect(response.output).toContain("event: user");
    expect(response.output).toContain("event: token");
    expect(response.output).toContain("event: error");
    expect(response.output).toContain("assistant reply could not be persisted");
    expect(response.output).not.toContain("event: done");
    expect(response.ended).toBe(true);
  });
});

function makeConfig() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chat-routes-"));
  const sourceVaultRoot = path.join(projectRoot, "source-vault");
  const runtimeRoot = path.join(projectRoot, ".runtime");
  fs.mkdirSync(sourceVaultRoot, { recursive: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });
  tempRoots.push(projectRoot);
  return {
    projectRoot,
    sourceVaultRoot,
    runtimeRoot,
    port: 4175,
    host: "127.0.0.1",
    author: "test",
  };
}

function createJsonResponse() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

function createStreamResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    output: "",
    ended: false,
    writeHead(code: number, headers: Record<string, string>) {
      this.statusCode = code;
      this.headers = headers;
      return this;
    },
    write(chunk: string) {
      this.output += chunk;
      return true;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}
