/**
 * Regression coverage for high-fanout deep-research bulk advance.
 *
 * These tests exercise the runtime state file used by review-page Deep Research
 * tasks. The bug under investigation appears when a large number of pending
 * items are advanced at once and many background tasks concurrently rewrite the
 * same `.llmwiki/deep-research-items.json` file. The expected behavior is that
 * the state file remains valid JSON and every pending item eventually reaches
 * `done-await-confirm` with a prepared draft.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bulkAdvanceDeepResearchItems } from "../web/server/services/deep-research.js";

interface BulkAdvanceFixture {
  sourceVaultRoot: string;
  runtimeRoot: string;
  itemCount: number;
}

interface StoredDeepResearchItem {
  id: string;
  status: string;
  draftResult?: {
    mode: string;
  };
}

const tempRoots: string[] = [];
const BROKEN_CITATION = "missing-source__deadbeef12.md";
const PAGE_PATH = "wiki/concepts/citation-storm.md";
const HIGH_FANOUT_ITEM_COUNT = 1000;
const WAIT_FOR_BACKGROUND_MS = 1000;

describe("deep research bulk advance", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it("keeps the runtime state file parseable and finishes all pending items under high fanout", async () => {
    const fixture = makeBulkAdvanceFixture(HIGH_FANOUT_ITEM_COUNT);

    const result = await bulkAdvanceDeepResearchItems(fixture.runtimeRoot, fixture.sourceVaultRoot);

    expect(result).toEqual({
      started: fixture.itemCount,
      confirmed: 0,
      skipped: 0,
    });

    await wait(WAIT_FOR_BACKGROUND_MS);

    const stored = JSON.parse(
      fs.readFileSync(path.join(fixture.runtimeRoot, ".llmwiki", "deep-research-items.json"), "utf8"),
    ) as StoredDeepResearchItem[];

    expect(stored).toHaveLength(fixture.itemCount);
    expect(stored.every((item) => item.status === "done-await-confirm")).toBe(true);
    expect(stored.every((item) => item.draftResult?.mode === "rewrite-citations")).toBe(true);
  });
});

function makeBulkAdvanceFixture(itemCount: number): BulkAdvanceFixture {
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deep-research-bulk-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deep-research-bulk-runtime-"));
  tempRoots.push(sourceVaultRoot, runtimeRoot);

  fs.mkdirSync(path.join(sourceVaultRoot, "wiki", "concepts"), { recursive: true });
  fs.mkdirSync(path.join(sourceVaultRoot, "sources"), { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, ".llmwiki"), { recursive: true });

  fs.writeFileSync(path.join(sourceVaultRoot, ...PAGE_PATH.split("/")), buildCitationStormPage(itemCount), "utf8");
  fs.writeFileSync(
    path.join(runtimeRoot, ".llmwiki", "deep-research-items.json"),
    `${JSON.stringify(buildPendingItems(itemCount), null, 2)}\n`,
    "utf8",
  );

  return { sourceVaultRoot, runtimeRoot, itemCount };
}

function buildCitationStormPage(itemCount: number): string {
  const lines = [
    "# Citation Storm",
    "",
    ...Array.from({ length: itemCount }, (_, index) => `段落 ${index + 1}。^[${BROKEN_CITATION}]`),
    "",
  ];
  return lines.join("\n");
}

function buildPendingItems(itemCount: number): StoredDeepResearchItem[] {
  return Array.from({ length: itemCount }, (_, index) => {
    const line = index + 3;
    return {
      id: `deep-research-check-item-${index + 1}`,
      kind: "check",
      title: "引用缺失",
      detail: "原文引用指向的来源文件不存在。",
      category: "missing-citation",
      scope: "claim",
      pagePath: PAGE_PATH,
      line,
      factText: `第 ${line} 行引用无法追溯到现有来源文件。`,
      gapText: `Broken citation ^[${BROKEN_CITATION}] - source file not found`,
      triggerReason: "原文引用指向的来源文件不存在。",
      sourceExcerpt: `x error ${PAGE_PATH}:${line} Broken citation ^[${BROKEN_CITATION}] - source file not found`,
      status: "pending",
      progress: 0,
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
    };
  }) as StoredDeepResearchItem[];
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
