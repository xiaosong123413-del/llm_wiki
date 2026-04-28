import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listMarkdownFilesRecursive } from "../web/server/services/markdown-file-listing.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("markdown file listing", () => {
  it("lists markdown files recursively and supports relative paths with excluded directories", () => {
    const root = makeRoot();
    write(root, "notes/a.md", "# A");
    write(root, "notes/nested/b.md", "# B");
    write(root, "notes/_已录入/skip.md", "# Skip");
    write(root, "notes/readme.txt", "txt");

    const files = listMarkdownFilesRecursive(path.join(root, "notes"), {
      relative: true,
      excludeDirs: ["_已录入"],
    });

    expect(files.sort()).toEqual(["a.md", path.join("nested", "b.md")]);
  });

  it("returns absolute paths and tolerates missing roots when requested", () => {
    const root = makeRoot();
    write(root, "wiki/concepts/demo.md", "# Demo");

    const files = listMarkdownFilesRecursive(path.join(root, "wiki"));
    const missingFiles = listMarkdownFilesRecursive(path.join(root, "missing"), { ignoreMissing: true });

    expect(files).toEqual([path.join(root, "wiki", "concepts", "demo.md")]);
    expect(missingFiles).toEqual([]);
  });

  it("skips hidden files and directories when requested", () => {
    const root = makeRoot();
    write(root, "wiki/.hidden.md", "# Hidden");
    write(root, "wiki/.obsidian/config.md", "# Config");
    write(root, "wiki/visible/page.md", "# Visible");

    const files = listMarkdownFilesRecursive(path.join(root, "wiki"), {
      relative: true,
      skipHidden: true,
    });

    expect(files).toEqual([path.join("visible", "page.md")]);
  });
});

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-listing-"));
  roots.push(root);
  return root;
}

function write(root: string, relativePath: string, content: string): void {
  const full = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}
