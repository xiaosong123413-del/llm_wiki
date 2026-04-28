/**
 * Cloudflare chat message function tests.
 *
 * These tests exercise the Pages Function through its exported request handler
 * so database guards, message validation, and assistant reply persistence stay
 * covered without changing production code.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../functions/api/chat/[id]/messages.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat message Pages Function", () => {
  it("returns 500 when the D1 binding is missing", async () => {
    const response = await onRequestPost({
      env: {},
      params: { id: "convo-1" },
      request: new Request("https://example.com/api/chat/convo-1/messages", {
        method: "POST",
        body: JSON.stringify({ content: "hello" }),
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "D1 binding DB is not configured.",
    });
  });

  it("returns 404 when the conversation does not exist", async () => {
    const response = await onRequestPost({
      env: {
        DB: createConversationDb([]),
        OPENAI_API_KEY: "key",
      },
      params: { id: "missing" },
      request: new Request("https://example.com/api/chat/missing/messages", {
        method: "POST",
        body: JSON.stringify({ content: "hello" }),
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "conversation not found",
    });
  });

  it("appends the user message and assistant reply to the stored conversation", async () => {
    const db = createConversationDb([
      {
        id: "convo-1",
        title: "Existing",
        created_at: "2026-04-19T09:00:00.000Z",
        updated_at: "2026-04-19T09:30:00.000Z",
        web_search_enabled: 0,
        search_scope: "local",
        agent_id: null,
        article_refs_json: "[]",
        messages_json: JSON.stringify([
          {
            id: "msg-1",
            role: "assistant",
            content: "历史回答",
            createdAt: "2026-04-19T09:15:00.000Z",
            articleRefs: [],
          },
        ]),
      },
    ]);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "新的回答" } }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequestPost({
      env: {
        DB: db,
        OPENAI_API_KEY: "key",
        OPENAI_BASE_URL: "https://proxy.example.com/",
        OPENAI_MODEL: "gpt-test",
      },
      params: { id: "convo-1" },
      request: new Request("https://example.com/api/chat/convo-1/messages", {
        method: "POST",
        body: JSON.stringify({
          content: "请总结这篇文章",
          articleRefs: ["wiki/index.md"],
          contexts: [
            {
              title: "Index",
              path: "wiki/index.md",
              excerpt: "首页摘要",
              text: "正文片段",
            },
          ],
        }),
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.articleRefs).toEqual(["wiki/index.md"]);
    expect(payload.data.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: "user",
        content: "请总结这篇文章",
        articleRefs: ["wiki/index.md"],
      }),
      expect.objectContaining({
        role: "assistant",
        content: "新的回答",
      }),
    ]));
  });
});

function createConversationDb(rows: Array<Record<string, unknown>>) {
  const store = new Map(rows.map((row) => [String(row.id), { ...row }]));
  return {
    prepare(query: string) {
      const state: { args: unknown[] } = { args: [] };
      return {
        bind(...args: unknown[]) {
          state.args = args;
          return this;
        },
        async first() {
          if (!query.includes("FROM web_conversations WHERE id = ?")) {
            return null;
          }
          return store.get(String(state.args[0])) ?? null;
        },
        async run() {
          if (!query.includes("INSERT INTO web_conversations")) {
            return { success: true };
          }
          const [
            id,
            title,
            createdAt,
            updatedAt,
            webSearchEnabled,
            searchScope,
            agentId,
            articleRefsJson,
            messagesJson,
          ] = state.args;
          store.set(String(id), {
            id,
            title,
            created_at: createdAt,
            updated_at: updatedAt,
            web_search_enabled: webSearchEnabled,
            search_scope: searchScope,
            agent_id: agentId,
            article_refs_json: articleRefsJson,
            messages_json: messagesJson,
          });
          return { success: true };
        },
      };
    },
  };
}
