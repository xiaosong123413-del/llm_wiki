import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadSyncCompileConfig,
  saveSyncCompileConfig,
} from "../scripts/sync-compile/config.mjs";
import { resolveSyncRoots } from "../scripts/sync-compile/roots.mjs";
import * as syncCompileModule from "../scripts/sync-compile.mjs";

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
        source_vault_root: "C:/vault",
        runtime_output_root: "C:/runtime",
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
      source_vault_root: "C:/vault",
      runtime_output_root: "C:/runtime",
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
        source_vault_root: "C:/vault",
        runtime_output_root: "C:/runtime",
        compiler_root: tempDir,
        source_folders: [],
      });
    await writeFile(
      path.join(tempDir, "sync-compile-config.json"),
      withBom,
      "utf8",
    );

    const config = await loadSyncCompileConfig(tempDir);

    expect(config.source_vault_root).toBe("C:/vault");
    expect(config.runtime_output_root).toBe("C:/runtime");
  });

  it("fails fast when a sync root is missing", () => {
    tempDir = path.join(os.tmpdir(), "sync-config-missing");
    const sourceVaultRoot = path.join(tempDir, "source-vault");
    fs.mkdirSync(sourceVaultRoot, { recursive: true });

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: "",
          runtime_output_root: "C:/runtime",
          compiler_root: tempDir,
        },
        tempDir,
      )).toThrow("source_vault_root");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: sourceVaultRoot,
          runtime_output_root: "   ",
          compiler_root: tempDir,
        },
        tempDir,
      )).toThrow("runtime_output_root");
  });

  it("derives compile roots from the renamed config fields", () => {
    expect(typeof syncCompileModule.resolveCompileRootsFromConfig).toBe("function");
    tempDir = path.join(os.tmpdir(), "sync-config-derive");
    const sourceVaultRoot = path.join(tempDir, "source-vault");
    const runtimeRoot = path.join(tempDir, "runtime-root");
    fs.mkdirSync(sourceVaultRoot, { recursive: true });
    fs.mkdirSync(runtimeRoot, { recursive: true });

    const roots = syncCompileModule.resolveCompileRootsFromConfig(
      {
        source_vault_root: sourceVaultRoot,
        runtime_output_root: runtimeRoot,
        compiler_root: "C:/compiler",
      },
      tempDir,
    );

    expect(roots.sourceVaultRoot).toBe(path.resolve(sourceVaultRoot).toLowerCase());
    expect(roots.runtimeRoot).toBe(path.resolve(runtimeRoot).toLowerCase());
    expect(roots.runtimeWikiDir).toBe(path.join(path.resolve(runtimeRoot).toLowerCase(), "wiki"));
  });
});
