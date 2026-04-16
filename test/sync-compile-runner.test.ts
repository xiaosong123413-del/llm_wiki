import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { clearStaleLockIfSafe, summarizeBatchProgress } from "../scripts/sync-compile.mjs";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("sync compile runner helpers", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("clears a stale lock when the pid is dead", async () => {
    tempDir = await makeTempDir("sync-runner-");
    const lockDir = path.join(tempDir, ".llmwiki");
    const lockPath = path.join(lockDir, "lock");
    await mkdir(lockDir, { recursive: true });
    await writeFile(lockPath, "999999", "utf8");

    await clearStaleLockIfSafe(tempDir);

    await expect(readFile(lockPath, "utf8")).rejects.toThrow();
  });

  it("summarizes progress using completed and active batch counts", () => {
    const summary = summarizeBatchProgress({
      importedCount: 1174,
      completedCount: 40,
      activeBatchCount: 20,
    });

    expect(summary).toContain("1174");
    expect(summary).toContain("40");
    expect(summary).toContain("20");
  });
});
