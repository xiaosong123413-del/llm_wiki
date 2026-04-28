import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectRoot } from "../web/server/config.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("web server config", () => {
  it("resolves the repo root when the server is launched from the web directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-web-config-"));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, "web"), { recursive: true });
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), "{}\n", "utf8");
    fs.writeFileSync(path.join(root, "scripts", "sync-compile.mjs"), "", "utf8");

    expect(findProjectRoot(path.join(root, "web"))).toBe(root);
  });
});
