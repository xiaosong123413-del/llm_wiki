/**
 * Characterization tests for shared sync-compile file walkers.
 *
 * These tests pin the recursive directory traversal behavior before the
 * sync-compile scripts start sharing a common helper.
 */

import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { listFilesRecursive, listMarkdownFilesRecursive } from "../scripts/sync-compile/file-listing.mjs";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("sync-compile file listing", () => {
  it("lists markdown files recursively and skips excluded folders", async () => {
    const root = await makeTempRoot("sync-compile-listing-");
    await mkdir(path.join(root, "notes", "_已清理"), { recursive: true });
    await mkdir(path.join(root, "notes", "nested"), { recursive: true });
    await writeFile(path.join(root, "notes", "idea.md"), "# Idea\n", "utf8");
    await writeFile(path.join(root, "notes", "nested", "clip.md"), "# Clip\n", "utf8");
    await writeFile(path.join(root, "notes", "_已清理", "skip.md"), "# Skip\n", "utf8");

    const files = await listMarkdownFilesRecursive(path.join(root, "notes"), {
      excludeDirs: ["_已清理"],
      normalizeSlashes: true,
    });

    expect(files.sort()).toEqual(["idea.md", "nested/clip.md"]);
  });

  it("returns custom file matches and tolerates missing roots when requested", async () => {
    const root = await makeTempRoot("sync-compile-files-");
    await mkdir(path.join(root, "assets"), { recursive: true });
    await writeFile(path.join(root, "assets", "cover.png"), "png", "utf8");
    await writeFile(path.join(root, "assets", "note.md"), "# Note\n", "utf8");

    const assetFiles = await listFilesRecursive(path.join(root, "assets"), {
      predicate: (entryName) => !entryName.toLowerCase().endsWith(".md"),
      normalizeSlashes: true,
    });
    const missingFiles = await listMarkdownFilesRecursive(path.join(root, "missing"), {
      ignoreMissing: true,
    });

    expect(assetFiles).toEqual(["cover.png"]);
    expect(missingFiles).toEqual([]);
  });
});

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}
