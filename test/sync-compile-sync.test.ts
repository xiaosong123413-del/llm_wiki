import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  buildImportedFilename,
  syncMarkdownSources,
} from "../scripts/sync-compile/sync-files.mjs";
import { canClearStaleLock } from "../scripts/sync-compile/lock.mjs";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("sync compile raw sync", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("creates collision-safe filenames from source roots", () => {
    const one = buildImportedFilename("概念/README.md");
    const two = buildImportedFilename("项目/README.md");

    expect(one).not.toBe(two);
    expect(one.endsWith(".md")).toBe(true);
  });

  it("syncs markdown files from multiple roots and writes a manifest", async () => {
    tempDir = await makeTempDir("sync-files-");
    const sourceA = path.join(tempDir, "source-a");
    const sourceB = path.join(tempDir, "source-b");
    const vault = path.join(tempDir, "vault");
    await mkdir(path.join(sourceA, ".obsidian"), { recursive: true });
    await mkdir(path.join(sourceB, "概念"), { recursive: true });
    await mkdir(vault, { recursive: true });

    await writeFile(path.join(sourceA, "README.md"), "# a\n", "utf8");
    await writeFile(path.join(sourceA, ".obsidian", "hidden.md"), "# hidden\n", "utf8");
    await writeFile(path.join(sourceB, "概念", "README.md"), "# b\n", "utf8");

    const imported = await syncMarkdownSources([sourceA, sourceB], vault, [".obsidian"]);
    const manifest = await readFile(path.join(vault, "raw_import_manifest.csv"), "utf8");

    expect(imported).toBe(2);
    expect(manifest).toContain("source_root");
    expect(manifest).toContain("README.md");
  });

  it("treats a dead lock pid as removable", async () => {
    const removable = await canClearStaleLock("999999");
    expect(removable).toBe(true);
  });
});
