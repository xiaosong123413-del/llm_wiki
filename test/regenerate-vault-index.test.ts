/**
 * Vault index regeneration tests.
 *
 * These tests exercise the extracted core helpers so the CLI script can stay
 * thin while `fallow` sees direct coverage for page collection and markdown
 * generation behavior.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildIndex,
  buildMoc,
  collectPages,
} from "../scripts/regenerate-vault-index-core.mjs";

const roots: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("regenerate vault index core", () => {
  it("collects titled non-orphaned pages sorted by title", async () => {
    const root = createRoot();
    writePage(root, "concepts/redis.md", [
      "---",
      "title: Redis",
      "summary: '[[Cache]] summary'",
      "tags:",
      "  - Storage",
      "---",
      "# Redis",
    ].join("\n"));
    writePage(root, "concepts/orphan.md", [
      "---",
      "title: Ignore Me",
      "orphaned: true",
      "---",
    ].join("\n"));
    writePage(root, "concepts/no-title.md", "# Missing title");
    writePage(root, "concepts/agent.md", [
      "---",
      "title: Agent",
      "---",
      "# Agent",
    ].join("\n"));

    const pages = await collectPages(path.join(root, "concepts"));

    expect(pages).toEqual([
      {
        title: "Agent",
        summary: "",
        tags: [],
      },
      {
        title: "Redis",
        summary: "[[Cache]] summary",
        tags: ["Storage"],
      },
    ]);
  });

  it("builds index and MOC markdown from collected pages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));

    const concepts = [
      { title: "Redis", summary: "[[Cache]] summary", tags: ["Storage"] },
      { title: "Zettelkasten", summary: "Note system", tags: [] },
    ];
    const queries = [
      { title: "最近项目", summary: "[[项目]] 汇总", tags: [] },
    ];

    const index = buildIndex(concepts, queries);
    const moc = buildMoc(concepts);

    expect(index).toContain("- **[[Redis]]** — Cache summary");
    expect(index).toContain("## 保存的查询");
    expect(index).toContain("_3 页 | 生成于 2026-04-19T12:00:00.000Z_");
    expect(moc).toContain("## Storage");
    expect(moc).toContain("- [[Redis]]");
    expect(moc).toContain("## 未分类");
    expect(moc.indexOf("## Storage")).toBeLessThan(moc.indexOf("## 未分类"));
  });
});

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-index-"));
  roots.push(root);
  return root;
}

function writePage(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}
