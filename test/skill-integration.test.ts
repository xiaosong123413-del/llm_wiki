import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function fileExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

describe("llm wiki skill integration", () => {
  it("vendors the external skill, audit library, web viewer, and Obsidian plugin into this repo", async () => {
    expect(await fileExists(path.join(root, "llm-wiki", "SKILL.md"))).toBe(true);
    expect(await fileExists(path.join(root, "llm-wiki", "references", "audit-guide.md"))).toBe(true);
    expect(await fileExists(path.join(root, "llm-wiki", "scripts", "scaffold.py"))).toBe(true);
    expect(await fileExists(path.join(root, "audit-shared", "package.json"))).toBe(true);
    expect(await fileExists(path.join(root, "web", "package.json"))).toBe(true);
    expect(await fileExists(path.join(root, "web", "server", "index.ts"))).toBe(true);
    expect(await fileExists(path.join(root, "plugins", "obsidian-audit", "manifest.json"))).toBe(true);
  });

  it("adds root package scripts for the integrated audit and web tooling", async () => {
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

    expect(pkg.scripts["audit-shared:build"]).toBeDefined();
    expect(pkg.scripts["web:build"]).toBeDefined();
    expect(pkg.scripts["web:start"]).toBeDefined();
    expect(pkg.scripts["obsidian-audit:build"]).toBeDefined();
  });
});
