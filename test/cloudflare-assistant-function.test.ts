/**
 * Cloudflare assistant function tests.
 *
 * These tests cover the Pages Function through its public request handler so
 * prompt validation, context normalization, and OpenAI response parsing remain
 * stable while `fallow` tracks real coverage.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../functions/api/assistant.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistant Pages Function", () => {
  it("returns 500 when OPENAI_API_KEY is missing", async () => {
    const response = await onRequestPost(createContext({
      env: {},
      request: new Request("https://example.com/api/assistant", {
        method: "POST",
        body: JSON.stringify({ question: "test" }),
      }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "OPENAI_API_KEY is not configured on Cloudflare Pages.",
    });
  });

  it("returns 400 for invalid JSON or empty questions", async () => {
    const invalidJson = await onRequestPost(createContext({
      env: { OPENAI_API_KEY: "key" },
      request: new Request("https://example.com/api/assistant", {
        method: "POST",
        body: "{not-json",
      }),
    }));
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toEqual({ error: "Invalid JSON body." });

    const missingQuestion = await onRequestPost(createContext({
      env: { OPENAI_API_KEY: "key" },
      request: new Request("https://example.com/api/assistant", {
        method: "POST",
        body: JSON.stringify({ question: "   " }),
      }),
    }));
    expect(missingQuestion.status).toBe(400);
    await expect(missingQuestion.json()).resolves.toEqual({ error: "Question is required." });
  });

  it("normalizes contexts and reads array-based OpenAI content", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: [
              { text: "第一段" },
              { text: "第二段" },
            ],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequestPost(createContext({
      env: {
        OPENAI_API_KEY: "key",
        OPENAI_BASE_URL: "https://proxy.example.com/",
        OPENAI_MODEL: "gpt-test",
      },
      request: new Request("https://example.com/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          question: "Redis 是什么？",
          contexts: [
            {
              title: "Redis",
              path: "wiki/redis.md",
              excerpt: "缓存系统",
              text: "Redis is an in-memory store.",
            },
            {
              title: 123,
              path: null,
              excerpt: false,
              text: ["bad"],
            },
          ],
        }),
      }),
    }));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      answer: "第一段\n第二段",
      contexts: [
        {
          title: "Redis",
          path: "wiki/redis.md",
          excerpt: "缓存系统",
          text: "Redis is an in-memory store.",
        },
        {
          title: "",
          path: "",
          excerpt: "",
          text: "",
        },
      ],
    });
  });
});

function createContext(input: {
  env: Record<string, string>;
  request: Request;
}) {
  return {
    env: input.env,
    request: input.request,
  };
}
