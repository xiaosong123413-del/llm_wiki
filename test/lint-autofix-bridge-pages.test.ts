/**
 * Focused direct tests for the migration-backed bridge-page repairer.
 *
 * These tests stay isolated from lint() so bridge behavior can be checked
 * without depending on the legacy autofix wiring in the lint path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bridgePageRepairer } from "../src/linter/autofix/bridge-pages.js";

interface MigrationFixture {
  oldTitle: string;
  canonicalPath: string;
  createdAt: string;
  reason: string;
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "lint-autofix-bridge-"));
  await mkdir(path.join(tmpDir, ".llmwiki"), { recursive: true });
  await mkdir(path.join(tmpDir, "wiki", "concepts"), { recursive: true });
  await mkdir(path.join(tmpDir, "wiki", "queries"), { recursive: true });
  await mkdir(path.join(tmpDir, "raw"), { recursive: true });
  await mkdir(path.join(tmpDir, "sources_full"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeConcept(slug: string, content: string): Promise<string> {
  const filePath = path.join(tmpDir, "wiki", "concepts", `${slug}.md`);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

async function writeMigrationMap(migrations: MigrationFixture[]): Promise<void> {
  await writeFile(
    path.join(tmpDir, ".llmwiki", "link-migrations.json"),
    JSON.stringify({ migrations }, null, 2),
    "utf8",
  );
}

describe("bridge page repairer", () => {
  it("creates a bridge page only when an explicit migration record exists", async () => {
    await writeConcept(
      "new-page",
      [
        "---",
        "title: New Page",
        "summary: 新页面。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeMigrationMap([
      {
        oldTitle: "Old Page",
        canonicalPath: "wiki/concepts/new-page.md",
        createdAt: "2026-04-25T00:00:00.000Z",
        reason: "rename",
      },
    ]);

    const details = await bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer.md"),
          message: "Broken wikilink [[Old Page]] - no matching page found",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "applied",
        target: "wiki/concepts/old-page.md",
      }),
    ]);

    const bridgePath = path.join(tmpDir, "wiki", "concepts", "old-page.md");
    const bridge = await readFile(bridgePath, "utf8");
    expect(bridge).toContain("title: Old Page");
    expect(bridge).toContain("[[New Page]]");
  });

  it("does not create a bridge page when no explicit migration record exists", async () => {
    const details = await bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer.md"),
          message: "Broken wikilink [[Old Page]] - no matching page found",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "skipped",
        reason: "missing-migration",
      }),
    ]);
  });

  it("rejects ambiguous migration records deterministically", async () => {
    await writeConcept(
      "new-page-a",
      [
        "---",
        "title: New Page A",
        "summary: 新页面 A。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeConcept(
      "new-page-b",
      [
        "---",
        "title: New Page B",
        "summary: 新页面 B。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeMigrationMap([
      {
        oldTitle: "Old Page",
        canonicalPath: "wiki/concepts/new-page-a.md",
        createdAt: "2026-04-25T00:00:00.000Z",
        reason: "rename-a",
      },
      {
        oldTitle: "Old Page",
        canonicalPath: "wiki/concepts/new-page-b.md",
        createdAt: "2026-04-25T00:01:00.000Z",
        reason: "rename-b",
      },
    ]);

    const details = await bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer.md"),
          message: "Broken wikilink [[Old Page]] - no matching page found",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "skipped",
        reason: "ambiguous-migration",
      }),
    ]);
  });

  it("does not auto-match slug-colliding titles that are not exact matches", async () => {
    await writeConcept(
      "new-page",
      [
        "---",
        "title: New Page",
        "summary: 新页面。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeMigrationMap([
      {
        oldTitle: "Old Page!",
        canonicalPath: "wiki/concepts/new-page.md",
        createdAt: "2026-04-25T00:00:00.000Z",
        reason: "rename",
      },
    ]);

    const details = await bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer.md"),
          message: "Broken wikilink [[Old Page]] - no matching page found",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "skipped",
        reason: "missing-migration",
      }),
    ]);
  });

  it("handles malformed and unsafe migration input without throwing", async () => {
    await writeConcept(
      "safe-target",
      [
        "---",
        "title: Safe Target",
        "summary: 安全目标。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeFile(
      path.join(tmpDir, ".llmwiki", "link-migrations.json"),
      '{"migrations":[{"oldTitle":"Unsafe","canonicalPath":"../outside.md","createdAt":"2026-04-25","reason":"bad"},',
      "utf8",
    );

    await expect(bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer.md"),
          message: "Broken wikilink [[Unsafe]] - no matching page found",
        },
      ],
    })).resolves.toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "failed",
        reason: "invalid-migration-map",
      }),
    ]);

    await writeFile(
      path.join(tmpDir, ".llmwiki", "link-migrations.json"),
      JSON.stringify({
        migrations: [
          {
            oldTitle: "Unsafe",
            canonicalPath: "../outside.md",
            createdAt: "2026-04-25T00:00:00.000Z",
            reason: "bad",
          },
          {
            oldTitle: 123,
            canonicalPath: "wiki/concepts/safe-target.md",
            createdAt: "2026-04-25T00:01:00.000Z",
            reason: "bad-type",
          },
        ],
      }),
      "utf8",
    );

    await expect(bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer.md"),
          message: "Broken wikilink [[Unsafe]] - no matching page found",
        },
      ],
    })).resolves.toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "failed",
        reason: "unsafe-canonical-path",
      }),
    ]);
  });

  it("rejects canonical paths that are not readable markdown files", async () => {
    await writeMigrationMap([
      {
        oldTitle: "Folder Target",
        canonicalPath: "wiki/concepts",
        createdAt: "2026-04-25T00:00:00.000Z",
        reason: "bad-target",
      },
    ]);

    const details = await bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer.md"),
          message: "Broken wikilink [[Folder Target]] - no matching page found",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "failed",
        reason: "invalid-canonical-path",
      }),
    ]);
  });

  it("processes duplicate diagnostics for the same bridge target deterministically", async () => {
    await writeConcept(
      "new-page",
      [
        "---",
        "title: New Page",
        "summary: 新页面。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeMigrationMap([
      {
        oldTitle: "Old Page",
        canonicalPath: "wiki/concepts/new-page.md",
        createdAt: "2026-04-25T00:00:00.000Z",
        reason: "rename",
      },
    ]);

    const details = await bridgePageRepairer.run({
      root: tmpDir,
      diagnostics: Array.from({ length: 5 }, (_, index) => ({
        rule: "broken-wikilink" as const,
        severity: "error" as const,
        file: path.join(tmpDir, "wiki", "concepts", `consumer-${index}.md`),
        message: "Broken wikilink [[Old Page]] - no matching page found",
      })),
    });

    expect(details.filter((detail) => detail.status === "applied")).toHaveLength(1);
    expect(details.filter((detail) => (
      detail.status === "skipped" && detail.reason === "bridge-already-exists"
    ))).toHaveLength(4);
  });
});
