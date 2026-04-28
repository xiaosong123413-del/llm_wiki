import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSyncRoots } from "../scripts/sync-compile/roots.mjs";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("sync compile roots", () => {
  it("uses explicit source and runtime roots", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sync-runtime-roots-explicit-"));
    tempRoots.push(tempRoot);
    const sourceVaultRoot = path.join(tempRoot, "source-vault");
    const runtimeRoot = path.join(tempRoot, "runtime-root");
    fs.mkdirSync(sourceVaultRoot, { recursive: true });
    fs.mkdirSync(runtimeRoot, { recursive: true });

    const roots = resolveSyncRoots(
      {
        source_vault_root: sourceVaultRoot,
        runtime_output_root: runtimeRoot,
      },
      tempRoot,
    );

    const expectedRuntimeRoot = path.resolve(runtimeRoot).toLowerCase();
    expect(roots.sourceVaultRoot).toBe(path.resolve(sourceVaultRoot).toLowerCase());
    expect(roots.runtimeRoot).toBe(expectedRuntimeRoot);
    expect(roots.runtimeWikiDir).toBe(path.join(expectedRuntimeRoot, "wiki"));
    expect(roots.runtimeStateDir).toBe(path.join(expectedRuntimeRoot, ".llmwiki"));
    expect(roots.runtimeSystemDir).toBe(path.join(expectedRuntimeRoot, ".wiki-system"));
    expect(roots.runtimeAuditDir).toBe(path.join(expectedRuntimeRoot, "audit"));
    expect(roots.runtimeSourcesDir).toBe(path.join(expectedRuntimeRoot, "sources"));
    expect(roots.runtimeSourcesFullDir).toBe(path.join(expectedRuntimeRoot, "sources_full"));
    expect(roots.compilerRoot).toBe(path.resolve(tempRoot));
  });

  it("rejects non-absolute, non-directory, equal, and nested root setups", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sync-runtime-roots-"));
    tempRoots.push(tempRoot);
    const sourceVaultRoot = path.join(tempRoot, "source-vault");
    const runtimeRoot = path.join(tempRoot, "runtime-root");
    const runtimeInsideSource = path.join(sourceVaultRoot, "runtime-root");
    const sourceInsideRuntime = path.join(runtimeRoot, "source-vault");
    const notDirectory = path.join(tempRoot, "not-a-directory.txt");
    fs.mkdirSync(sourceVaultRoot, { recursive: true });
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.mkdirSync(runtimeInsideSource, { recursive: true });
    fs.mkdirSync(sourceInsideRuntime, { recursive: true });
    fs.writeFileSync(notDirectory, "x", "utf8");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: "relative/source-vault",
          runtime_output_root: runtimeRoot,
        },
        tempRoot,
      )).toThrow("absolute");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: sourceVaultRoot,
          runtime_output_root: "relative/runtime-root",
        },
        tempRoot,
      )).toThrow("absolute");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: path.join(tempRoot, "missing-source"),
          runtime_output_root: runtimeRoot,
        },
        tempRoot,
      )).toThrow("exist");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: notDirectory,
          runtime_output_root: runtimeRoot,
        },
        tempRoot,
      )).toThrow("directory");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: sourceVaultRoot,
          runtime_output_root: sourceVaultRoot,
        },
        tempRoot,
      )).toThrow("must not be the same");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: sourceVaultRoot,
          runtime_output_root: runtimeInsideSource,
        },
        tempRoot,
      )).toThrow("inside");

    expect(() =>
      resolveSyncRoots(
        {
          source_vault_root: sourceInsideRuntime,
          runtime_output_root: runtimeRoot,
        },
        tempRoot,
      )).toThrow("inside");
  });
});
