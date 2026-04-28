import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../web/server/config.js";
import {
  handleWikiCommentsCreate,
  handleWikiCommentsDelete,
  handleWikiCommentsList,
  handleWikiCommentsUpdate,
} from "../web/server/routes/wiki-comments.js";

const roots: string[] = [];

describe("wiki comments routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates, lists, updates, and deletes comments by page path", async () => {
    const cfg = createConfig();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await handleWikiCommentsCreate(cfg)(
      {
        body: {
          path: "wiki/concepts/test.md",
          quote: "Beta",
          text: "first note",
          start: 6,
          end: 10,
        },
      } as never,
      { json, status } as never,
    );

    const created = json.mock.calls[0]?.[0];
    expect(created.success).toBe(true);
    const id = created.data.id as string;

    json.mockClear();
    handleWikiCommentsList(cfg)(
      { query: { path: "wiki/concepts/test.md" } } as never,
      { json, status } as never,
    );
    expect(json.mock.calls[0]?.[0]).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          id,
          path: "wiki/concepts/test.md",
          text: "first note",
        }),
      ],
    });

    json.mockClear();
    await handleWikiCommentsUpdate(cfg)(
      {
        params: { id },
        body: { path: "wiki/concepts/test.md", text: "updated note", resolved: true },
      } as never,
      { json, status } as never,
    );
    expect(json.mock.calls[0]?.[0]).toEqual({
      success: true,
      data: expect.objectContaining({
        id,
        text: "updated note",
        resolved: true,
      }),
    });

    json.mockClear();
    handleWikiCommentsDelete(cfg)(
      {
        params: { id },
        query: { path: "wiki/concepts/test.md" },
      } as never,
      { json, status } as never,
    );
    expect(json.mock.calls[0]?.[0]).toEqual({ success: true });

    const storePath = path.join(cfg.runtimeRoot, ".llmwiki", "wiki-comments.json");
    expect(fs.existsSync(storePath)).toBe(true);
  });

});

function createConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-wiki-comments-project-"));
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-wiki-comments-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-wiki-comments-runtime-"));
  roots.push(projectRoot, sourceVaultRoot, runtimeRoot);
  return {
    sourceVaultRoot,
    runtimeRoot,
    projectRoot,
    host: "127.0.0.1",
    port: 4175,
    author: "tester",
  };
}
