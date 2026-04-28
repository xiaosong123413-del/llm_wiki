import { describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { makeTempRoot } from "./fixtures/temp-root.js";
import {
  appendMaintenanceLog,
  formatMaintenanceLogEntry,
} from "../src/utils/maintenance-log.js";

describe("maintenance log", () => {
  it("formats entries with a grep-friendly chronological header", () => {
    const entry = formatMaintenanceLogEntry({
      action: "ingest",
      title: "Article Title",
      timestamp: new Date("2026-04-02T03:04:05.000Z"),
      details: {
        saved: "sources/article-title.md",
        truncated: false,
      },
    });

    expect(entry).toContain("## [2026-04-02] ingest | Article Title");
    expect(entry).toContain("- time: 2026-04-02T03:04:05.000Z");
    expect(entry).toContain("- saved: sources/article-title.md");
    expect(entry).toContain("- truncated: false");
  });

  it("appends entries to log.md without replacing earlier events", async () => {
    const root = await makeTempRoot("maintenance-log");

    await appendMaintenanceLog(root, {
      action: "ingest",
      title: "First Source",
      timestamp: new Date("2026-04-02T03:04:05.000Z"),
    });
    await appendMaintenanceLog(root, {
      action: "compile",
      title: "1 compiled, 0 skipped, 0 deleted",
      timestamp: new Date("2026-04-03T04:05:06.000Z"),
      details: {
        rebuilt: ["wiki/index.md", "wiki/MOC.md"],
      },
    });

    const log = await readFile(path.join(root, "log.md"), "utf-8");
    const headers = log.match(/^## \[.*$/gm);

    expect(headers).toEqual([
      "## [2026-04-02] ingest | First Source",
      "## [2026-04-03] compile | 1 compiled, 0 skipped, 0 deleted",
    ]);
    expect(log).toContain("- rebuilt: wiki/index.md, wiki/MOC.md");
  });
});
