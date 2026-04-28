/**
 * Wiki clone data model tests.
 *
 * These tests exercise the standalone wiki clone loader through its public
 * entry point so category derivation, HTML rendering, image rewriting, and
 * backlink handling stay stable while `fallow` tracks coverage for the module.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadWikiModel } from "../wiki-clone/src/lib/wiki-data.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("wiki clone data model", () => {
  it("loads markdown articles, renders HTML, and builds backlinks from links", () => {
    const wikiRoot = createWikiRoot();
    writeFile(wikiRoot, "index.md", [
      "# Index",
      "",
      "See [[Redis]] and [Docs](https://example.com/docs).",
      "",
      "- one",
      "- two",
      "",
      "![Diagram](images/overview.png)",
    ].join("\n"));
    writeFile(wikiRoot, "concepts/redis.md", [
      "---",
      "title: Redis",
      "---",
      "# Redis",
      "",
      "In-memory store.",
      "",
      "## Sources",
      "- https://redis.io",
    ].join("\n"));

    const model = loadWikiModel({
      wikiRoot,
      currentPath: "concepts/redis.md",
    });

    expect(model.home?.path).toBe("index.md");
    expect(model.current?.path).toBe("concepts/redis.md");
    expect(model.articleCount).toBe(2);
    expect(model.categories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "concepts",
        articles: [expect.objectContaining({ path: "concepts/redis.md", title: "Redis" })],
      }),
    ]));
    expect(model.current?.sources).toEqual(["https://redis.io"]);
    expect(model.home?.images).toEqual(["/wiki-file/images/overview.png"]);
    expect(model.home?.html).toContain('<a href="/?path=Redis">Redis</a>');
    expect(model.home?.html).toContain('<a href="https://example.com/docs">Docs</a>');
    expect(model.home?.html).toContain("<ul>");
    expect(model.backlinks["concepts/redis.md"]).toEqual([
      { path: "index.md", title: "Index" },
    ]);
  });

  it("prefers precomputed backlinks when _backlinks.json is present", () => {
    const wikiRoot = createWikiRoot();
    writeFile(wikiRoot, "index.md", "# Index\n");
    writeFile(wikiRoot, "notes/topic.md", "# Topic\n");
    writeFile(wikiRoot, "_backlinks.json", JSON.stringify({
      "index.md": ["notes/topic.md"],
    }, null, 2));

    const model = loadWikiModel({ wikiRoot });

    expect(model.backlinks["index.md"]).toEqual([
      { path: "notes/topic.md", title: "Topic" },
    ]);
  });
});

function createWikiRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-clone-"));
  roots.push(root);
  return root;
}

function writeFile(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}
