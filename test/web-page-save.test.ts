import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePageSave } from "../web/server/routes/page-save.js";

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("handlePageSave", () => {
  it("writes source-backed wiki pages back to the source vault", () => {
    const sourceVaultRoot = makeDir("llmwiki-page-save-source-");
    const runtimeRoot = makeDir("llmwiki-page-save-runtime-");
    const pagePath = path.join(sourceVaultRoot, "wiki", "about-me.md");
    fs.mkdirSync(path.dirname(pagePath), { recursive: true });
    fs.writeFileSync(pagePath, "# Old\n", "utf8");

    const handler = handlePageSave(makeServerConfig(sourceVaultRoot, runtimeRoot));
    const json = vi.fn();

    handler(
      { body: { path: "wiki/about-me.md", raw: "# New Title\n\n![头像](https://example.com/avatar.png)\n" } } as never,
      { json, status: vi.fn() } as never,
    );

    expect(fs.readFileSync(pagePath, "utf8")).toContain("# New Title");
    expect(fs.readFileSync(pagePath, "utf8")).toContain("https://example.com/avatar.png");
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ path: "wiki/about-me.md" }),
    }));
  });

  it("rejects runtime-only wiki pages", () => {
    const sourceVaultRoot = makeDir("llmwiki-page-save-runtime-source-");
    const runtimeRoot = makeDir("llmwiki-page-save-runtime-root-");
    fs.mkdirSync(path.join(runtimeRoot, "wiki"), { recursive: true });
    fs.writeFileSync(path.join(runtimeRoot, "wiki", "index.md"), "# Runtime\n", "utf8");

    const handler = handlePageSave(makeServerConfig(sourceVaultRoot, runtimeRoot));
    const statusJson = vi.fn();
    const status = vi.fn(() => ({ json: statusJson }));

    handler(
      { body: { path: "wiki/index.md", raw: "# Edited\n" } } as never,
      { json: vi.fn(), status } as never,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(statusJson).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: "page is not editable",
    }));
  });
});

function makeDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeServerConfig(sourceVaultRoot: string, runtimeRoot: string) {
  return {
    sourceVaultRoot,
    runtimeRoot,
    projectRoot: runtimeRoot,
    host: "127.0.0.1",
    port: 4175,
    author: "me",
  };
}
