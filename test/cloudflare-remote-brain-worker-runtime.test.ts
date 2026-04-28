/**
 * Runtime coverage for the Cloudflare Remote Brain Worker.
 *
 * These tests exercise the Worker through its exported `fetch` entrypoint with
 * a tiny in-memory D1/R2 harness so fallow sees real execution paths for the
 * higher-risk publish and mobile flows.
 */

import { describe, expect, it, vi } from "vitest";
import worker from "../cloudflare/remote-brain-worker/src/index.js";
import {
  buildMobileChatReply,
  handleMobileChatSend,
} from "../cloudflare/remote-brain-worker/src/mobile-chat-api.js";
import { writeDailyDiaryImages } from "../cloudflare/remote-brain-worker/src/mobile-diary-image-api.js";
import {
  mobileEntryFromRow,
  normalizeMobileEntry,
} from "../cloudflare/remote-brain-worker/src/mobile-entry-api.js";
import {
  createAuthorizedRequest,
  createBucketHarness,
  createDbHarness,
  createEnv,
  type WorkerEnv,
} from "./cloudflare-remote-brain-worker-test-helpers.js";

describe("Cloudflare Remote Brain Worker runtime", () => {
  it("publishes pages into D1 and R2 through the worker fetch entrypoint", async () => {
    const dbHarness = createDbHarness(async () => ({}));
    const bucketHarness = createBucketHarness();
    const env = createEnv({
      DB: dbHarness.db,
      WIKI_BUCKET: bucketHarness.bucket,
    });

    const response = await worker.fetch(
      createAuthorizedRequest("/publish", {
        wikiRoot: "D:/wiki",
        publishVersion: "2026-04-25T12:00:00.000Z",
        publishedAt: "2026-04-25T12:00:00.000Z",
        files: [
          {
            path: "wiki/example.md",
            content: "# Example",
            hash: "hash-1",
            modifiedAt: "2026-04-25T10:00:00.000Z",
          },
        ],
        indexFiles: [
          {
            path: "wiki/index.json",
            content: "{}",
            hash: "hash-index",
            modifiedAt: "2026-04-25T10:00:00.000Z",
          },
        ],
      }),
      env,
    );
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.pageCount).toBe(1);
    expect(payload.indexFileCount).toBe(1);
    expect(bucketHarness.puts).toEqual([{ key: "wiki/example.md", value: "# Example" }]);
    expect(dbHarness.calls.some((call) => call.sql.includes("INSERT INTO publish_runs"))).toBe(true);
    expect(dbHarness.calls.some((call) => call.sql.includes("INSERT INTO wiki_pages"))).toBe(true);
  });

  it("stores D1-safe preview content for oversized wiki pages while keeping the full body in R2", async () => {
    const dbHarness = createDbHarness(async () => ({}));
    const bucketHarness = createBucketHarness();
    const env = createEnv({
      DB: dbHarness.db,
      WIKI_BUCKET: bucketHarness.bucket,
    });
    const oversizedContent = "# 巨大页面\n\n" + "a".repeat(2_100_000);

    const response = await worker.fetch(
      createAuthorizedRequest("/publish", {
        wikiRoot: "D:/wiki",
        publishVersion: "2026-04-25T13:00:00.000Z",
        publishedAt: "2026-04-25T13:00:00.000Z",
        files: [
          {
            path: "wiki/huge.md",
            content: oversizedContent,
            hash: "hash-huge",
            modifiedAt: "2026-04-25T13:00:00.000Z",
          },
        ],
        indexFiles: [],
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(bucketHarness.puts).toEqual([{ key: "wiki/huge.md", value: oversizedContent }]);
    const wikiPageUpsert = dbHarness.calls.find((call) => call.sql.includes("INSERT INTO wiki_pages"));
    expect(typeof wikiPageUpsert?.params.at(-1)).toBe("string");
    expect(String(wikiPageUpsert?.params.at(-1))).not.toBe(oversizedContent);
    expect(String(wikiPageUpsert?.params.at(-1))).toContain("Full content available from Cloudflare R2");
  });

  it("returns full mobile wiki page content from R2 when the D1 row only stores a preview", async () => {
    const bucketHarness = createBucketHarness({
      "wiki/huge.md": "# 完整正文\n\n" + "b".repeat(50),
    });
    const dbHarness = createDbHarness(async (sql) => {
      if (sql.includes("FROM wiki_pages WHERE path = ?")) {
        return {
          first: {
            path: "wiki/huge.md",
            title: "巨大页面",
            version: "hash-huge",
            updatedAt: "2026-04-25T13:00:00.000Z",
            content: "# 预览正文",
            r2Key: "wiki/huge.md",
          },
        };
      }
      return {};
    });
    const env = createEnv({
      DB: dbHarness.db,
      WIKI_BUCKET: bucketHarness.bucket,
    });

    const response = await worker.fetch(
      createAuthorizedRequest("/mobile/wiki/page", { path: "wiki/huge.md" }),
      env,
    );
    const payload = await response.json() as {
      ok: boolean;
      page: {
        path: string;
        contentMarkdown: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.page.path).toBe("wiki/huge.md");
    expect(payload.page.contentMarkdown).toContain("完整正文");
    expect(payload.page.contentMarkdown).not.toBe("# 预览正文");
  });

  it("normalizes mobile entry rows when listing entries", async () => {
    const dbHarness = createDbHarness(async (sql) => {
      if (sql.includes("FROM mobile_entries WHERE owner_uid = ? OR owner_uid = ''")) {
        return {
          results: [
            {
              id: "entry-1",
              ownerUid: "owner-1",
              type: "clipping",
              title: "剪藏条目",
              text: "正文",
              mediaFilesJson: '["one.png"]',
              createdAt: "2026-04-25T08:00:00.000Z",
              targetDate: "2026-04-25",
              status: "synced",
              channel: "ios",
              sourceName: "相册",
              sourceUrl: "https://example.com/post",
              desktopPath: "领域/条目.md",
              syncedAt: "2026-04-25T08:05:00.000Z",
              failedAt: "",
              error: "",
            },
            {
              id: "desktop-entry-1",
              ownerUid: "",
              type: "flash_diary",
              title: "电脑端日记",
              text: "电脑端正文",
              mediaFilesJson: "[]",
              createdAt: "2026-04-21T21:07:42+08:00",
              targetDate: "2026-04-21",
              status: "synced",
              channel: "desktop-flash-diary",
              sourceName: "电脑端日记",
              sourceUrl: "",
              desktopPath: "raw/闪念日记/2026-04-21.md",
              syncedAt: "2026-04-27T08:00:00.000Z",
              failedAt: "",
              error: "",
            },
            {
              id: "desktop-entry-duplicate",
              ownerUid: "",
              type: "clipping",
              title: "剪藏条目",
              text: "正文",
              mediaFilesJson: "[]",
              createdAt: "2026-04-25T08:00:00+08:00",
              targetDate: "2026-04-25",
              status: "synced",
              channel: "desktop-flash-diary",
              sourceName: "电脑端日记",
              sourceUrl: "",
              desktopPath: "raw/闪念日记/2026-04-25.md",
              syncedAt: "2026-04-27T08:00:00.000Z",
              failedAt: "",
              error: "",
            },
          ],
        };
      }
      return {};
    });
    const env = createEnv({ DB: dbHarness.db });

    const response = await worker.fetch(
      createAuthorizedRequest("/mobile/entries/list", { ownerUid: "owner-1" }),
      env,
    );
    const payload = await response.json() as {
      entries: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(payload.entries[0]).toMatchObject({
      id: "entry-1",
      ownerUid: "owner-1",
      type: "clipping",
      title: "剪藏条目",
      mediaFiles: ["one.png"],
      status: "synced",
      sourceName: "相册",
      sourceUrl: "https://example.com/post",
      desktopPath: "领域/条目.md",
    });
    expect(payload.entries[1]).toMatchObject({
      id: "desktop-entry-1",
      ownerUid: "",
      type: "flash_diary",
      title: "电脑端日记",
      channel: "desktop-flash-diary",
    });
    expect(payload.entries).toHaveLength(2);
    expect(dbHarness.calls[0]?.params).toEqual(["owner-1"]);
  });

  it("allows desktop flash diary sync entries without a mobile owner uid", async () => {
    const dbHarness = createDbHarness(async () => ({}));
    const env = createEnv({ DB: dbHarness.db });

    const response = await worker.fetch(
      createAuthorizedRequest("/mobile/entries", {
        ownerUid: "",
        type: "flash_diary",
        title: "电脑端日记",
        text: "电脑端正文",
        targetDate: "2026-04-21",
        createdAt: "2026-04-21T21:07:42+08:00",
        status: "synced",
        channel: "desktop-flash-diary",
      }),
      env,
    );
    const payload = await response.json() as {
      ok: boolean;
      entry: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.entry).toMatchObject({
      ownerUid: "",
      channel: "desktop-flash-diary",
      status: "synced",
    });
    expect(dbHarness.calls[0]?.sql).toContain("INSERT INTO mobile_entries");
    expect(dbHarness.calls[0]?.params[1]).toBe("");
  });

  it("stores a fallback mobile wiki chat when no wiki context is available", async () => {
    const dbHarness = createDbHarness(async (sql) => {
      if (sql.startsWith("SELECT id, owner_uid AS ownerUid, title, mode")) {
        return { first: null };
      }
      if (sql.includes("FROM wiki_pages WHERE content LIKE ?")) {
        return { results: [] };
      }
      return {};
    });
    const env = createEnv({ DB: dbHarness.db });

    const response = await worker.fetch(
      createAuthorizedRequest("/mobile/chat/send", {
        ownerUid: "owner-1",
        message: "今天有什么记录？",
        mode: "wiki",
      }),
      env,
    );
    const payload = await response.json() as {
      ok: boolean;
      chat: {
        title: string;
        sources: unknown[];
        messages: Array<{ role: string; content: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.chat.title).toBe("今天有什么记录？");
    expect(payload.chat.sources).toEqual([]);
    expect(payload.chat.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "未找到相关 wiki 来源。",
    });
    expect(dbHarness.calls.some((call) => call.sql.includes("INSERT INTO mobile_chats"))).toBe(true);
  });

  it("normalizes mobile entry payloads and persisted rows into the mobile schema", () => {
    expect(normalizeMobileEntry({
      ownerUid: "owner-1",
      type: "clipping",
      title: "剪藏",
      mediaFiles: ["one.png"],
      sourceName: "相册",
    })).toMatchObject({
      ownerUid: "owner-1",
      type: "clipping",
      title: "剪藏",
      mediaFiles: ["one.png"],
      status: "new",
      sourceName: "相册",
    });

    expect(mobileEntryFromRow({
      id: "entry-1",
      owner_uid: "owner-2",
      title: "闪念",
      text: "正文",
      media_files_json: "[\"two.png\"]",
      source_name: "快捷记录",
      status: "weird",
    })).toMatchObject({
      id: "entry-1",
      ownerUid: "owner-2",
      title: "闪念",
      text: "正文",
      mediaFiles: ["two.png"],
      sourceName: "快捷记录",
      status: "new",
    });
  });

  it("returns direct mobile chat fallbacks before invoking the AI model", async () => {
    const env = createEnv({});

    await expect(buildMobileChatReply(env, "wiki", "没有命中", [], [], { ok: true, results: [] })).resolves.toEqual({
      text: "未找到相关 wiki 来源。",
      sources: [],
    });
    await expect(buildMobileChatReply(env, "web", "网络不可用", [], [], { ok: false, results: [] })).resolves.toEqual({
      text: "网络搜索不可用。",
      sources: [],
    });
  });

  it("builds hybrid mobile chat replies by combining wiki and web sources", async () => {
    const env = createEnv({
      LLM_MODEL: "@cf/fake-model",
      AI: {
        run: async () => ({
          response: "综合结论",
        }),
      } as WorkerEnv["AI"],
    });

    const reply = await buildMobileChatReply(
      env,
      "hybrid",
      "综合问题",
      [{ id: "m1", role: "user", content: "之前的问题", createdAt: "2026-04-25T00:00:00.000Z" }],
      [{ path: "wiki/example.md", title: "示例页", content: "Wiki 内容" }],
      {
        ok: true,
        results: [{
          title: "网页来源",
          url: "https://example.com/post",
          snippet: "Web 摘要",
        }],
      },
    );

    expect(reply.text).toBe("综合结论");
    expect(reply.sources).toHaveLength(2);
    expect(reply.sources[0]).toMatchObject({ title: "示例页" });
    expect(reply.sources[1]).toMatchObject({ title: "网页来源" });
  });

  it("uses the selected OpenAI-compatible mobile provider for chat replies", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "外部模型回答" } }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const env = createEnv({});

    try {
      const reply = await buildMobileChatReply(
        env,
        "wiki",
        "外部模型问题",
        [],
        [{ path: "wiki/provider.md", title: "Provider", content: "Provider 内容" }],
        { ok: true, results: [] },
        {
          mode: "api",
          apiBaseUrl: "https://api.example.com",
          apiKey: "provider-key",
          model: "provider-model",
        },
      );

      expect(reply.text).toBe("外部模型回答");
      expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/v1/chat/completions", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer provider-key",
        }),
      }));
      const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { model: string };
      expect(requestBody.model).toBe("provider-model");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("generates a diary cover image for today's entries without images", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: "ZmFrZS1pbWFnZQ==" }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const bucketHarness = createBucketHarness();
    const dbHarness = createDbHarness(async (sql) => {
      if (sql.includes("FROM mobile_ai_providers")) {
        return {
          results: [{
            ownerUid: "owner-1",
            apiName: "主 API",
            apiBaseUrl: "https://api.example.com",
            apiKey: "key-1",
            model: "gpt-image-1",
          }],
        };
      }
      if (sql.includes("FROM mobile_entries")) {
        return {
          results: [{
            id: "entry-1",
            text: "今天在校园散步，阳光很好。",
            mediaFilesJson: "[]",
            createdAt: "2026-04-27T08:00:00.000Z",
          }],
        };
      }
      return {};
    });
    const env = createEnv({
      DB: dbHarness.db,
      MEDIA_BUCKET: bucketHarness.bucket,
      PUBLIC_MEDIA_BASE_URL: "https://remote-brain.example",
    });

    try {
      const result = await writeDailyDiaryImages(env, new Date("2026-04-27T15:30:00.000Z"));

      expect(result.generatedCount).toBe(1);
      expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/v1/images/generations", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key-1",
        }),
      }));
      expect(bucketHarness.puts[0]?.key).toContain("generated-diary/owner-1/2026-04-27/");
      const update = dbHarness.calls.find((call) => call.sql.includes("UPDATE mobile_entries SET media_files_json"));
      expect(update?.params[1]).toBe("entry-1");
      expect(JSON.parse(String(update?.params[0]))[0]).toMatch(/^https:\/\/remote-brain\.example\/media\//);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not generate a diary cover when today's diary already has an image", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const bucketHarness = createBucketHarness();
    const dbHarness = createDbHarness(async (sql) => {
      if (sql.includes("FROM mobile_ai_providers")) {
        return {
          results: [{
            ownerUid: "owner-1",
            apiName: "主 API",
            apiBaseUrl: "https://api.example.com",
            apiKey: "key-1",
            model: "gpt-image-1",
          }],
        };
      }
      if (sql.includes("FROM mobile_entries")) {
        return {
          results: [{
            id: "entry-1",
            text: "已经有图片。",
            mediaFilesJson: "[\"https://remote-brain.example/media/photo.png\"]",
            createdAt: "2026-04-27T08:00:00.000Z",
          }],
        };
      }
      return {};
    });
    const env = createEnv({
      DB: dbHarness.db,
      MEDIA_BUCKET: bucketHarness.bucket,
      PUBLIC_MEDIA_BASE_URL: "https://remote-brain.example",
    });

    try {
      const result = await writeDailyDiaryImages(env, new Date("2026-04-27T15:30:00.000Z"));

      expect(result.generatedCount).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(bucketHarness.puts).toHaveLength(0);
      expect(dbHarness.calls.some((call) => call.sql.includes("UPDATE mobile_entries SET media_files_json"))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("supports direct mobile chat handler calls for wiki-only fallback replies", async () => {
    const dbHarness = createDbHarness(async () => ({}));
    const env = createEnv({ DB: dbHarness.db });

    const response = await handleMobileChatSend(
      createAuthorizedRequest("/mobile/chat/send", {
        ownerUid: "owner-direct",
        message: "没有命中的 wiki 问题",
        mode: "wiki",
      }),
      env,
    );
    const payload = await response.json() as {
      chat: {
        messages: Array<{ role: string; content: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.chat.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "未找到相关 wiki 来源。",
    });
    expect(dbHarness.calls.some((call) => call.sql.includes("INSERT INTO mobile_chats"))).toBe(true);
  });

  it("rejects mobile chat handler calls without an owner or message", async () => {
    const env = createEnv({ DB: createDbHarness(async () => ({})).db });

    const missingOwner = await handleMobileChatSend(
      createAuthorizedRequest("/mobile/chat/send", {
        ownerUid: "",
        message: "hello",
        mode: "wiki",
      }),
      env,
    );
    const missingMessage = await handleMobileChatSend(
      createAuthorizedRequest("/mobile/chat/send", {
        ownerUid: "owner-1",
        message: "",
        mode: "wiki",
      }),
      env,
    );

    expect(missingOwner.status).toBe(400);
    await expect(missingOwner.json()).resolves.toMatchObject({ error: "missing_owner_uid" });
    expect(missingMessage.status).toBe(400);
    await expect(missingMessage.json()).resolves.toMatchObject({ error: "missing_message" });
  });
});
