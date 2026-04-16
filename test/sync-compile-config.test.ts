import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadSyncCompileConfig,
  saveSyncCompileConfig,
} from "../scripts/sync-compile/config.mjs";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("sync compile config", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("fills defaults when optional fields are missing", async () => {
    tempDir = await makeTempDir("sync-config-");
    await writeFile(
      path.join(tempDir, "sync-compile-config.json"),
      JSON.stringify({
        target_vault: "C:/vault",
        compiler_root: tempDir,
        source_folders: [],
      }),
      "utf8",
    );

    const config = await loadSyncCompileConfig(tempDir);

    expect(config.compile_mode).toBe("batch");
    expect(config.batch_limit).toBe(20);
    expect(config.exclude_dirs).toContain(".obsidian");
    expect(config.batch_pattern_order[0]).toContain("概念");
  });

  it("persists updated source folders", async () => {
    tempDir = await makeTempDir("sync-config-save-");

    await saveSyncCompileConfig(tempDir, {
      target_vault: "C:/vault",
      compiler_root: tempDir,
      source_folders: ["C:/a", "C:/b"],
      compile_mode: "batch",
      batch_limit: 20,
      batch_pattern_order: ["*"],
      exclude_dirs: [".obsidian"],
    });

    const config = await loadSyncCompileConfig(tempDir);

    expect(config.source_folders).toEqual(["C:/a", "C:/b"]);
  });

  it("loads config files that start with a UTF-8 BOM", async () => {
    tempDir = await makeTempDir("sync-config-bom-");
    const withBom =
      "\uFEFF" +
      JSON.stringify({
        target_vault: "C:/vault",
        compiler_root: tempDir,
        source_folders: [],
      });
    await writeFile(
      path.join(tempDir, "sync-compile-config.json"),
      withBom,
      "utf8",
    );

    const config = await loadSyncCompileConfig(tempDir);

    expect(config.target_vault).toBe("C:/vault");
  });
});
