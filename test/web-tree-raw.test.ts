import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTree } from "../web/server/routes/tree.js";

const tempRoots: string[] = [];

describe("raw tree", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("shows raw, inbox, sources, and sources_full roots", () => {
    const sourceVaultRoot = makeRoot("raw-tree-source-");
    const runtimeRoot = makeRoot("raw-tree-runtime-");
    fs.mkdirSync(path.join(sourceVaultRoot, "raw", "\u526a\u85cf"), { recursive: true });
    fs.mkdirSync(path.join(sourceVaultRoot, "inbox"), { recursive: true });
    fs.mkdirSync(path.join(runtimeRoot, "sources"), { recursive: true });
    fs.mkdirSync(path.join(runtimeRoot, "sources_full"), { recursive: true });
    fs.writeFileSync(path.join(sourceVaultRoot, "inbox", "todo.md"), "# Todo", "utf8");
    fs.writeFileSync(path.join(runtimeRoot, "sources", "runtime.md"), "# Runtime", "utf8");

    const tree = buildTree({
      sourceVaultRoot,
      runtimeRoot,
      projectRoot: runtimeRoot,
      host: "127.0.0.1",
      port: 4175,
      author: "me",
    }, "raw");
    const names = tree.children?.map((child) => child.name) ?? [];

    expect(names).toEqual(expect.arrayContaining(["raw", "inbox", "sources", "sources_full"]));
    expect(JSON.stringify(tree)).toContain("inbox/todo.md");
    expect(JSON.stringify(tree)).toContain("sources/runtime.md");
  });
});

function makeRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}
