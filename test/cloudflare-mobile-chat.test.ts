import { describe, expect, it } from "vitest";
import {
  buildMobileSearchRequest,
  mergeMobileChatSources,
  normalizeMobileWebSearchResults,
  resolveMobileChatMode,
  toWebChatSource,
  toWikiChatSource,
} from "../cloudflare/remote-brain-worker/src/mobile-chat.ts";

describe("cloudflare mobile chat helpers", () => {
  it("defaults unknown mobile chat mode to wiki", () => {
    expect(resolveMobileChatMode("wiki")).toBe("wiki");
    expect(resolveMobileChatMode("web")).toBe("web");
    expect(resolveMobileChatMode("hybrid")).toBe("hybrid");
    expect(resolveMobileChatMode("other")).toBe("wiki");
  });

  it("normalizes generic and Tavily web search payloads", () => {
    expect(normalizeMobileWebSearchResults({
      results: [{ title: "Redis Docs", url: "https://redis.io", snippet: "Official docs" }],
    })).toEqual([
      { title: "Redis Docs", url: "https://redis.io", snippet: "Official docs" },
    ]);

    expect(normalizeMobileWebSearchResults({
      result: {
        results: [{ title: "AMD", url: "https://www.amd.com", content: "GPU updates" }],
      },
    })).toEqual([
      { title: "AMD", url: "https://www.amd.com", snippet: "GPU updates" },
    ]);
  });

  it("builds Tavily requests with the expected path and payload", () => {
    expect(buildMobileSearchRequest("https://api.tavily.com", "redis", 3, null)).toEqual({
      endpoint: "https://api.tavily.com/search",
      payload: {
        query: "redis",
        max_results: 3,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      },
    });

    expect(buildMobileSearchRequest("https://search.example.com/query", "redis", 3, "model-1")).toEqual({
      endpoint: "https://search.example.com/query",
      payload: {
        query: "redis",
        limit: 3,
        model: "model-1",
      },
    });
  });

  it("keeps wiki sources ahead of web sources and annotates web domains", () => {
    const wikiSource = toWikiChatSource({
      title: "Redis 笔记",
      path: "wiki/concepts/redis.md",
    });
    const webSource = toWebChatSource({
      title: "Redis Docs",
      url: "https://www.redis.io/docs/latest",
      snippet: "Official docs",
    }, 0);

    expect(webSource).toEqual({
      id: "web-1",
      type: "web",
      title: "Redis Docs",
      url: "https://www.redis.io/docs/latest",
      domain: "redis.io",
    });
    expect(mergeMobileChatSources([wikiSource], [webSource])).toEqual([
      {
        id: "wiki/concepts/redis.md",
        type: "wiki",
        title: "Redis 笔记",
        path: "wiki/concepts/redis.md",
      },
      {
        id: "web-1",
        type: "web",
        title: "Redis Docs",
        url: "https://www.redis.io/docs/latest",
        domain: "redis.io",
      },
    ]);
  });
});
