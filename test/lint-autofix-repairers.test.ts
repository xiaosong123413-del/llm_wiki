/**
 * Focused direct tests for alias-backfill and example-escaping repairers.
 *
 * These tests bypass lint() so repairer behavior can be validated
 * independently from the legacy autofix wiring in the lint path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { aliasBackfillRepairer } from "../src/linter/autofix/alias-backfill.js";
import { exampleEscapingRepairer } from "../src/linter/autofix/example-escaping.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "lint-autofix-repairers-"));
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

describe("deterministic autofix repairers", () => {
  it("preserves multiple alias additions targeting the same page in one repair run", async () => {
    const target = await writeConcept(
      "web-clipper",
      [
        "---",
        "title: Web Clipper素材捕获知识库",
        "summary: 用于网页内容捕获。",
        "aliases:",
        "  - Web Clipper",
        "---",
        "",
        "# Web Clipper素材捕获知识库",
        "",
        "```markdown",
        "---",
        "aliases:",
        "  - 素材捕获",
        "  - 知识库",
        "---",
        "```",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );

    const details = await aliasBackfillRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer-a.md"),
          message: "Broken wikilink [[素材捕获]] - no matching page found",
        },
        {
          rule: "broken-wikilink",
          severity: "error",
          file: path.join(tmpDir, "wiki", "concepts", "consumer-b.md"),
          message: "Broken wikilink [[知识库]] - no matching page found",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "alias-backfill",
        status: "applied",
        target: "wiki/concepts/web-clipper.md",
        reason: "unique-target",
      }),
      expect.objectContaining({
        repairer: "alias-backfill",
        status: "applied",
        target: "wiki/concepts/web-clipper.md",
        reason: "unique-target",
      }),
    ]);

    const repaired = await readFile(target, "utf8");
    expect(repaired).toContain("  - 素材捕获");
    expect(repaired).toContain("  - 知识库");
  });

  it("rewrites documentation-only image examples into non-linking prose", async () => {
    const pagePath = await writeConcept(
      "obsidian-images",
      [
        "---",
        "title: Obsidian Images",
        "summary: 图片语法说明。",
        "---",
        "",
        "### 图片链接格式",
        "`![[图片文件.jpg]]`",
      ].join("\n"),
    );

    const details = await exampleEscapingRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "untraceable-image",
          severity: "error",
          file: pagePath,
          line: 7,
          message: "Untraceable image reference ![[图片文件.jpg]]",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "example-escaping",
        status: "applied",
        target: "wiki/concepts/obsidian-images.md:7",
      }),
    ]);

    const repaired = await readFile(pagePath, "utf8");
    expect(repaired).toContain("感叹号 + 双中括号 + 图片文件名");
    expect(repaired).not.toContain("![[图片文件.jpg]]");
  });

  it("does not rewrite real embed syntax that is not marked as an example", async () => {
    const pagePath = await writeConcept(
      "real-embed",
      [
        "---",
        "title: Real Embed",
        "summary: 真实嵌入。",
        "---",
        "",
        "![[图片文件.jpg]]",
      ].join("\n"),
    );

    const details = await exampleEscapingRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "untraceable-image",
          severity: "error",
          file: pagePath,
          line: 6,
          message: "Untraceable image reference ![[图片文件.jpg]]",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "example-escaping",
        status: "skipped",
        reason: "not-example-line",
        target: "wiki/concepts/real-embed.md:6",
      }),
    ]);

    const repaired = await readFile(pagePath, "utf8");
    expect(repaired).toContain("![[图片文件.jpg]]");
  });

  it("processes duplicate diagnostics on the same example line only once", async () => {
    const pagePath = await writeConcept(
      "duplicate-example",
      [
        "---",
        "title: Duplicate Example",
        "summary: 重复诊断示例。",
        "---",
        "",
        "### 示例",
        "`![[图片文件.jpg]]`",
      ].join("\n"),
    );

    const details = await exampleEscapingRepairer.run({
      root: tmpDir,
      diagnostics: [
        {
          rule: "untraceable-image",
          severity: "error",
          file: pagePath,
          line: 7,
          message: "Untraceable image reference ![[图片文件.jpg]]",
        },
        {
          rule: "broken-wikilink",
          severity: "error",
          file: pagePath,
          line: 7,
          message: "Broken wikilink [[图片文件.jpg]] - no matching page found",
        },
      ],
    });

    expect(details).toEqual([
      expect.objectContaining({
        repairer: "example-escaping",
        status: "applied",
        kind: "broken-wikilink",
        target: "wiki/concepts/duplicate-example.md:7",
      }),
    ]);

    const repaired = await readFile(pagePath, "utf8");
    expect(repaired).toContain("感叹号 + 双中括号 + 图片文件名");
    expect(repaired.match(/感叹号 \+ 双中括号 \+ 图片文件名/g)?.length).toBe(1);
  });
});
