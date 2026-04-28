/**
 * Sync web state normalization tests.
 *
 * These tests pin the conversation/comment shaping logic used by the sync
 * script so refactors can reduce script complexity without changing payloads.
 */

import { describe, expect, it } from "vitest";
import {
  mergeByUpdatedAt,
  normalizeArray,
  normalizeComment,
  normalizeConversation,
} from "../scripts/sync-web-state-core.mjs";

describe("sync web state core", () => {
  it("normalizes conversation records from legacy snake_case payloads", () => {
    const conversation = normalizeConversation({
      id: " convo-1 ",
      title: " 测试对话 ",
      created_at: "2026-04-19T10:00:00.000Z",
      updated_at: "2026-04-19T11:00:00.000Z",
      web_search_enabled: 1,
      search_scope: "both",
      agent_id: "agent-1",
      article_refs_json: "[\"wiki/index.md\"]",
      messages_json: JSON.stringify([
        {
          id: "msg-1",
          role: "user",
          content: " hello ",
          created_at: "2026-04-19T10:30:00.000Z",
          article_refs: ["wiki/index.md"],
          search_results: [{ title: "wiki" }],
        },
      ]),
    });

    expect(conversation).toEqual({
      id: "convo-1",
      title: "测试对话",
      createdAt: "2026-04-19T10:00:00.000Z",
      updatedAt: "2026-04-19T11:00:00.000Z",
      webSearchEnabled: true,
      searchScope: "both",
      agentId: "agent-1",
      articleRefs: ["wiki/index.md"],
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "hello",
          createdAt: "2026-04-19T10:30:00.000Z",
          articleRefs: ["wiki/index.md"],
          citations: [],
          searchResults: [{ title: "wiki" }],
          error: null,
        },
      ],
    });
  });

  it("normalizes comments and drops invalid records", () => {
    expect(normalizeComment({ id: "", pagePath: "wiki/index.md" })).toBeNull();

    expect(normalizeComment({
      id: "comment-1",
      page_path: "wiki/index.md",
      quote: "段落",
      comment: "需要补充",
      resolved: 1,
      created_at: "2026-04-19T10:00:00.000Z",
      updated_at: "2026-04-19T11:00:00.000Z",
    })).toEqual({
      id: "comment-1",
      pagePath: "wiki/index.md",
      quote: "段落",
      comment: "需要补充",
      resolved: true,
      source: "desktop",
      createdAt: "2026-04-19T10:00:00.000Z",
      updatedAt: "2026-04-19T11:00:00.000Z",
    });
  });

  it("merges by updatedAt and keeps the newest records first", () => {
    const merged = mergeByUpdatedAt(
      [
        { id: "same", updatedAt: "2026-04-19T11:00:00.000Z", value: "local" },
        { id: "local-only", updatedAt: "2026-04-19T09:00:00.000Z", value: "local-only" },
      ],
      [
        { id: "same", updatedAt: "2026-04-19T10:00:00.000Z", value: "remote" },
        { id: "remote-only", updatedAt: "2026-04-19T12:00:00.000Z", value: "remote-only" },
      ],
    );

    expect(merged).toEqual([
      { id: "remote-only", updatedAt: "2026-04-19T12:00:00.000Z", value: "remote-only" },
      { id: "same", updatedAt: "2026-04-19T11:00:00.000Z", value: "local" },
      { id: "local-only", updatedAt: "2026-04-19T09:00:00.000Z", value: "local-only" },
    ]);
  });

  it("parses JSON-backed arrays and rejects invalid array payloads", () => {
    expect(normalizeArray(["a"])).toEqual(["a"]);
    expect(normalizeArray("[1,2,3]")).toEqual([1, 2, 3]);
    expect(normalizeArray("{\"a\":1}")).toEqual([]);
    expect(normalizeArray("nope")).toEqual([]);
  });
});
