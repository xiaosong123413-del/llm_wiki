import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../wiki-clone/app/wiki-file/[...path]/route.js";

const tempRoots: string[] = [];
const originalWikiRoot = process.env.WIKI_ROOT;

afterEach(() => {
  process.env.WIKI_ROOT = originalWikiRoot;
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("wiki clone file route", () => {
  it("serves local pdf assets with an application/pdf content type", async () => {
    const wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-clone-file-route-"));
    tempRoots.push(wikiRoot);
    writeFile(wikiRoot, "docs/spec.pdf", "pdf");
    process.env.WIKI_ROOT = wikiRoot;

    const response = await GET(new Request("http://localhost/wiki-file/docs/spec.pdf"), {
      params: Promise.resolve({ path: ["docs", "spec.pdf"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });
});

function writeFile(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}
