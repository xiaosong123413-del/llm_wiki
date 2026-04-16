import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { selectNextBatch } from "../scripts/sync-compile/batch-plan.mjs";
import { prepareActiveSources } from "../scripts/sync-compile/prepare-active-sources.mjs";
import { readBatchState, writeBatchState } from "../scripts/sync-compile/batch-state.mjs";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("sync compile batch planning", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("prioritizes patterns and excludes completed files", () => {
    const files = [
      "ai知识库（第二大脑）__概念__A.md",
      "ai知识库（第二大脑）__项目__B.md",
      "00_inbox__C.md",
    ];

    const selected = selectNextBatch(files, {
      completedFiles: new Set(["ai知识库（第二大脑）__概念__A.md"]),
      batchLimit: 1,
      patternOrder: ["ai知识库（第二大脑）__项目__*", "*"],
    });

    expect(selected).toEqual(["ai知识库（第二大脑）__项目__B.md"]);
  });

  it("loads empty batch state when state file is missing", async () => {
    tempDir = await makeTempDir("sync-state-");

    const state = await readBatchState(tempDir);

    expect(state.completed_files).toEqual([]);
  });

  it("copies only selected files into active sources", async () => {
    tempDir = await makeTempDir("sync-active-");
    const fullDir = path.join(tempDir, "sources_full");
    await mkdir(fullDir, { recursive: true });
    await writeFile(path.join(fullDir, "one.md"), "# one\n", "utf8");
    await writeFile(path.join(fullDir, "two.md"), "# two\n", "utf8");

    const count = await prepareActiveSources(tempDir, ["two.md"]);
    const files = await readdir(path.join(tempDir, "sources"));

    expect(count).toBe(1);
    expect(files).toEqual(["two.md"]);
  });

  it("writes and reloads completed batch files", async () => {
    tempDir = await makeTempDir("sync-state-save-");

    await writeBatchState(tempDir, {
      completed_files: ["one.md", "two.md"],
    });

    const state = await readBatchState(tempDir);

    expect(state.completed_files).toEqual(["one.md", "two.md"]);
  });
});
