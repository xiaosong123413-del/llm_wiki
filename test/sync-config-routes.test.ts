import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerConfig } from "../web/server/config.js";
import { handleSyncConfigGet, handleSyncConfigSave } from "../web/server/routes/sync-config.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("sync config routes", () => {
  it("reads source vault and runtime output roots from sync-compile-config.json", async () => {
    const cfg = makeConfig();
    fs.writeFileSync(path.join(cfg.projectRoot, "sync-compile-config.json"), JSON.stringify({
      source_vault_root: "D:/Desktop/source-vault",
      runtime_output_root: "D:/Desktop/runtime-root",
      source_folders: ["D:/Desktop/source-a", "D:/Desktop/source-b"],
    }), "utf8");
    const response = createResponse();

    handleSyncConfigGet(cfg)({} as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual({
      sourceVaultRoot: "D:/Desktop/source-vault",
      runtimeOutputRoot: "D:/Desktop/runtime-root",
      sourceRepoPaths: ["D:/Desktop/source-a", "D:/Desktop/source-b"],
    });
  });

  it("saves validated source vault and runtime output roots back to sync-compile-config.json", async () => {
    const cfg = makeConfig();
    const sourceVault = path.join(cfg.projectRoot, "source-vault");
    const runtimeRoot = path.join(cfg.projectRoot, "runtime-root");
    const source = path.join(cfg.projectRoot, "source");
    fs.mkdirSync(sourceVault, { recursive: true });
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    const response = createResponse();

    await handleSyncConfigSave(cfg)({
      body: {
        sourceVaultRoot: sourceVault,
        runtimeOutputRoot: runtimeRoot,
        sourceRepoPaths: [source],
      },
    } as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("同步配置已保存");
    const saved = JSON.parse(fs.readFileSync(path.join(cfg.projectRoot, "sync-compile-config.json"), "utf8")) as {
      source_vault_root: string;
      runtime_output_root: string;
      source_folders: string[];
    };
    expect(saved.source_vault_root).toBe(sourceVault);
    expect(saved.runtime_output_root).toBe(runtimeRoot);
    expect(saved.source_folders).toEqual([source]);
  });

  it("removes stale legacy root keys while preserving sync compile settings on save", async () => {
    const cfg = makeConfig();
    const sourceVault = path.join(cfg.projectRoot, "source-vault");
    const runtimeRoot = path.join(cfg.projectRoot, "runtime-root");
    const source = path.join(cfg.projectRoot, "source");
    fs.mkdirSync(sourceVault, { recursive: true });
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(cfg.projectRoot, "sync-compile-config.json"), JSON.stringify({
      target_vault: "D:/stale/runtime",
      source_vault_root: "D:/stale/source",
      runtime_output_root: "D:/stale/runtime",
      source_folders: ["D:/stale/source"],
      compiler_root: "D:/compiler",
      compile_mode: "batch",
      batch_limit: 8,
      batch_pattern_order: ["*"],
      exclude_dirs: [".obsidian", ".trash"],
      unrelated: "discard-me",
    }), "utf8");
    const response = createResponse();

    await handleSyncConfigSave(cfg)({
      body: {
        sourceVaultRoot: sourceVault,
        runtimeOutputRoot: runtimeRoot,
        sourceRepoPaths: [source],
      },
    } as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(fs.readFileSync(path.join(cfg.projectRoot, "sync-compile-config.json"), "utf8"))).toEqual({
      source_vault_root: sourceVault,
      runtime_output_root: runtimeRoot,
      source_folders: [source],
      compiler_root: "D:/compiler",
      compile_mode: "batch",
      batch_limit: 8,
      batch_pattern_order: ["*"],
      exclude_dirs: [".obsidian", ".trash"],
    });
  });

  it("rejects non-absolute, missing, equal, and nested sync roots when saving", async () => {
    const cfg = makeConfig();
    const sourceVault = path.join(cfg.projectRoot, "source-vault");
    const runtimeRoot = path.join(cfg.projectRoot, "runtime-root");
    const source = path.join(cfg.projectRoot, "source");
    const runtimeInsideSource = path.join(sourceVault, "runtime-root");
    const sourceInsideRuntime = path.join(runtimeRoot, "source-vault");
    const fileRoot = path.join(cfg.projectRoot, "not-a-directory.txt");
    fs.mkdirSync(sourceVault, { recursive: true });
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(runtimeInsideSource, { recursive: true });
    fs.mkdirSync(sourceInsideRuntime, { recursive: true });
    fs.writeFileSync(fileRoot, "x", "utf8");

    await expectSaveError(cfg, {
      sourceVaultRoot: "relative/source-vault",
      runtimeOutputRoot: runtimeRoot,
      sourceRepoPaths: [source],
    }, "absolute");

    await expectSaveError(cfg, {
      sourceVaultRoot: sourceVault,
      runtimeOutputRoot: "relative/runtime-root",
      sourceRepoPaths: [source],
    }, "absolute");

    await expectSaveError(cfg, {
      sourceVaultRoot: path.join(cfg.projectRoot, "missing-source"),
      runtimeOutputRoot: runtimeRoot,
      sourceRepoPaths: [source],
    }, "exist");

    await expectSaveError(cfg, {
      sourceVaultRoot: fileRoot,
      runtimeOutputRoot: runtimeRoot,
      sourceRepoPaths: [source],
    }, "directory");

    await expectSaveError(cfg, {
      sourceVaultRoot: sourceVault,
      runtimeOutputRoot: sourceVault,
      sourceRepoPaths: [source],
    }, "must not be the same");

    await expectSaveError(cfg, {
      sourceVaultRoot: sourceVault,
      runtimeOutputRoot: runtimeInsideSource,
      sourceRepoPaths: [source],
    }, "inside");

    await expectSaveError(cfg, {
      sourceVaultRoot: sourceInsideRuntime,
      runtimeOutputRoot: runtimeRoot,
      sourceRepoPaths: [source],
    }, "inside");
  });
});

function makeConfig(): ServerConfig {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-config-routes-"));
  roots.push(root);
  return {
    sourceVaultRoot: root,
    runtimeRoot: root,
    port: 4175,
    host: "127.0.0.1",
    author: "test",
    projectRoot: root,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

async function expectSaveError(cfg: ServerConfig, body: unknown, expectedMessage: string): Promise<void> {
  const response = createResponse();

  await handleSyncConfigSave(cfg)({ body } as Request, response as Response);

  expect(response.statusCode).toBe(400);
  expect(response.body).toMatchObject({
    success: false,
    error: expect.stringContaining(expectedMessage),
  });
}
