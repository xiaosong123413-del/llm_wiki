# Deterministic System-Check Autofix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic autofix phase to `检查` so the app auto-writes safe alias backfills, example-syntax escapes, and explicit migration bridge pages before final lint results are shown.

**Architecture:** Keep `llmwiki lint` as the single system-check entrypoint, but insert a two-pass deterministic repair stage in `src/linter/index.ts`: run the narrow error checks, apply file-system-safe repairs, rerun full lint, then print final diagnostics plus an autofix summary. Reuse existing frontmatter and alias extraction helpers, and refuse any fix that is not mechanically provable from local state.

**Tech Stack:** TypeScript, Node.js filesystem APIs, existing markdown/frontmatter helpers, Vitest, RTK command wrappers

---

**Repository note:** The working tree is already dirty and this feature changes user-visible workflow. Follow focused TDD first. Do not create a commit unless the required repo gates are green and the staged diff is limited to this feature.

## File Map

- `D:\Desktop\llm-wiki-compiler-main\src\linter\types.ts`
  - Extend `LintSummary` with deterministic autofix reporting types.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\index.ts`
  - Orchestrate the pre-pass autofix and the final full lint pass.
- `D:\Desktop\llm-wiki-compiler-main\src\commands\lint.ts`
  - Print autofix summary before final counts and keep exit semantics based on post-fix errors.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\rules.ts`
  - Reuse shared wikilink target normalization so lint and autofix interpret the same link target the same way.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\wiki-page-index.ts`
  - New shared helpers for reading wiki pages, normalizing wikilink targets, and building deterministic page candidate maps.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\types.ts`
  - New autofix detail/summary/result types.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\index.ts`
  - New autofix orchestrator. Use `index.ts` inside the folder instead of `src/linter/autofix.ts` to avoid a file/folder path collision.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\alias-backfill.ts`
  - New repairer for unique deterministic alias writes.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\example-escaping.ts`
  - New repairer for example-only lines that are being linted as real wikilinks or image references.
- `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\bridge-pages.ts`
  - New repairer that creates bridge pages only from `.llmwiki/link-migrations.json`.
- `D:\Desktop\llm-wiki-compiler-main\test\lint-autofix.test.ts`
  - New focused autofix integration and skip-behavior test file.
- `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
  - Record the new “检查先自愈 deterministic 错误，再输出剩余问题” workflow.

### Task 1: Lock The Autofix Contract With Failing Tests

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\test\lint-autofix.test.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\linter\types.ts`

- [ ] **Step 1: Write the failing autofix integration test file**

Create `D:\Desktop\llm-wiki-compiler-main\test\lint-autofix.test.ts` with this exact content:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { lint } from "../src/linter/index.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "lint-autofix-test-"));
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

async function writeMigrationMap(migrations: Array<Record<string, string>>): Promise<void> {
  await writeFile(
    path.join(tmpDir, ".llmwiki", "link-migrations.json"),
    JSON.stringify({ migrations }, null, 2),
    "utf8",
  );
}

describe("deterministic lint autofix", () => {
  it("backfills a unique alias and clears the broken wikilink", async () => {
    const target = await writeConcept(
      "web-clipper",
      [
        "---",
        "title: Web Clipper素材捕获",
        "summary: 用于网页内容捕获。",
        "aliases:",
        "  - Web Clipper",
        "---",
        "",
        "# Web Clipper素材捕获",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeConcept(
      "consumer",
      [
        "---",
        "title: Consumer",
        "summary: 消费页。",
        "---",
        "",
        "See [[素材捕获]].",
      ].join("\n"),
    );

    const summary = await lint(tmpDir);
    expect(summary.errors).toBe(0);
    expect(summary.autofix?.applied).toBe(1);
    expect(summary.autofix?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repairer: "alias-backfill",
          status: "applied",
          target: "wiki/concepts/web-clipper.md",
        }),
      ]),
    );

    const repaired = await readFile(target, "utf8");
    expect(repaired).toContain("素材捕获");
  });

  it("skips alias writes when more than one deterministic target exists", async () => {
    await writeConcept(
      "oauth-browser",
      [
        "---",
        "title: OAuth 桌面端回调机制",
        "summary: 桌面端回调。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeConcept(
      "oauth-local",
      [
        "---",
        "title: OAuth 本地回调问题",
        "summary: 本地回调问题。",
        "---",
        "",
        "正文内容足够长，避免空页规则干扰。",
      ].join("\n"),
    );
    await writeConcept(
      "consumer",
      [
        "---",
        "title: Consumer",
        "summary: 消费页。",
        "---",
        "",
        "See [[OAuth]].",
      ].join("\n"),
    );

    const summary = await lint(tmpDir);
    expect(summary.errors).toBeGreaterThan(0);
    expect(summary.results.some((result) => result.rule === "broken-wikilink")).toBe(true);
    expect(summary.autofix?.skipped).toBe(1);
    expect(summary.autofix?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repairer: "alias-backfill",
          status: "skipped",
          reason: "ambiguous-target",
        }),
      ]),
    );
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

    const summary = await lint(tmpDir);
    expect(summary.errors).toBe(0);
    expect(summary.autofix?.applied).toBe(1);
    expect(summary.autofix?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repairer: "example-escaping",
          status: "applied",
          target: "wiki/concepts/obsidian-images.md:7",
        }),
      ]),
    );

    const repaired = await readFile(pagePath, "utf8");
    expect(repaired).toContain("感叹号 + 双中括号 + 图片文件名");
    expect(repaired).not.toContain("![[图片文件.jpg]]");
  });

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
    await writeConcept(
      "consumer",
      [
        "---",
        "title: Consumer",
        "summary: 消费页。",
        "---",
        "",
        "See [[Old Page]].",
      ].join("\n"),
    );

    const summary = await lint(tmpDir);
    expect(summary.errors).toBe(0);
    expect(summary.autofix?.applied).toBe(1);

    const bridgePath = path.join(tmpDir, "wiki", "concepts", "old-page.md");
    const bridge = await readFile(bridgePath, "utf8");
    expect(bridge).toContain("title: Old Page");
    expect(bridge).toContain("[[New Page]]");
  });
});
```

- [ ] **Step 2: Run the new autofix test file to verify it fails before implementation**

Run:

```powershell
rtk test "npm test -- test/lint-autofix.test.ts"
```

Expected:

- FAIL because `lint()` does not yet return `autofix`
- FAIL because broken wikilinks and untraceable image references are still reported instead of being auto-fixed

- [ ] **Step 3: Extend the lint summary types for autofix reporting**

Update `D:\Desktop\llm-wiki-compiler-main\src\linter\types.ts` to this exact content:

```ts
/**
 * Type definitions for the wiki linter.
 * Defines the shape of lint results, summaries, and rule functions
 * used across all lint rules and the orchestrator.
 */

export interface LintResult {
  rule: string;
  severity: "error" | "warning" | "info";
  file: string;
  message: string;
  line?: number;
}

export interface LintAutofixDetail {
  repairer: "alias-backfill" | "example-escaping" | "bridge-page";
  kind: string;
  target: string;
  reason: string;
  status: "applied" | "skipped" | "failed";
}

export interface LintAutofixSummary {
  attempted: number;
  applied: number;
  skipped: number;
  failures: number;
  details: LintAutofixDetail[];
}

export interface LintSummary {
  errors: number;
  warnings: number;
  info: number;
  results: LintResult[];
  autofix: LintAutofixSummary;
}

export type LintRule = (root: string) => Promise<LintResult[]>;
```

### Task 2: Implement Shared Wiki-Page Indexing And Alias Backfill Repair

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\wiki-page-index.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\types.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\alias-backfill.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\linter\rules.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\lint-autofix.test.ts`

- [ ] **Step 1: Create shared wiki-page indexing helpers**

Create `D:\Desktop\llm-wiki-compiler-main\src\linter\wiki-page-index.ts` with this exact content:

```ts
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter, slugify } from "../utils/markdown.js";
import { CONCEPTS_DIR, QUERIES_DIR } from "../utils/constants.js";
import {
  extractChineseAliasCandidate,
  extractEmbeddedAliasCandidates,
  extractSourceAliasCandidates,
  extractTitleVariantAliases,
} from "../wiki/aliases.js";

export interface WikiPageRecord {
  filePath: string;
  content: string;
}

export interface WikiPageCandidate {
  filePath: string;
  aliases: string[];
}

export function normalizeWikilinkTarget(captured: string): string {
  return captured.split("|")[0].split("#")[0].trim();
}

export async function collectAllPages(root: string): Promise<WikiPageRecord[]> {
  const conceptPages = await readMarkdownFiles(path.join(root, CONCEPTS_DIR));
  const queryPages = await readMarkdownFiles(path.join(root, QUERIES_DIR));
  return [...conceptPages, ...queryPages];
}

export function buildPageSlugSet(pages: WikiPageRecord[]): Set<string> {
  const slugs = new Set<string>();
  for (const page of pages) {
    const baseName = path.basename(page.filePath, ".md");
    slugs.add(baseName.toLowerCase());

    const { meta } = parseFrontmatter(page.content);
    if (typeof meta.title === "string" && meta.title.trim() !== "") {
      slugs.add(slugify(meta.title));
    }

    if (Array.isArray(meta.aliases)) {
      for (const alias of meta.aliases) {
        if (typeof alias === "string" && alias.trim() !== "") {
          slugs.add(slugify(alias));
        }
      }
    }
  }
  return slugs;
}

export function buildAutofixCandidateMap(pages: WikiPageRecord[]): Map<string, WikiPageCandidate[]> {
  const map = new Map<string, WikiPageCandidate[]>();

  for (const page of pages) {
    const { meta } = parseFrontmatter(page.content);
    const aliases = uniqueStrings([
      ...(Array.isArray(meta.aliases) ? meta.aliases.filter((value): value is string => typeof value === "string") : []),
      typeof meta.title === "string" ? meta.title : "",
      extractChineseAliasCandidate(page.content) ?? "",
      ...extractSourceAliasCandidates(page.content),
      ...extractTitleVariantAliases(page.content),
      ...extractEmbeddedAliasCandidates(page.content),
    ]);

    for (const alias of aliases) {
      const slug = slugify(alias);
      const current = map.get(slug) ?? [];
      current.push({ filePath: page.filePath, aliases });
      map.set(slug, current);
    }
  }

  return map;
}

async function readMarkdownFiles(dirPath: string): Promise<WikiPageRecord[]> {
  if (!existsSync(dirPath)) {
    return [];
  }

  const entries = await readdir(dirPath);
  const mdFiles = entries.filter((entry) => entry.endsWith(".md"));
  return Promise.all(
    mdFiles.map(async (fileName) => {
      const filePath = path.join(dirPath, fileName);
      const content = await readFile(filePath, "utf8");
      return { filePath, content };
    }),
  );
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}
```

- [ ] **Step 2: Add shared autofix result helpers**

Create `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\types.ts` with this exact content:

```ts
import type { LintAutofixDetail, LintAutofixSummary, LintResult } from "../types.js";

export interface AutofixContext {
  root: string;
  diagnostics: LintResult[];
}

export interface AutofixRepairer {
  name: LintAutofixDetail["repairer"];
  run(context: AutofixContext): Promise<LintAutofixDetail[]>;
}

export const EMPTY_AUTOFIX_SUMMARY: LintAutofixSummary = {
  attempted: 0,
  applied: 0,
  skipped: 0,
  failures: 0,
  details: [],
};

export function summarizeAutofix(details: LintAutofixDetail[]): LintAutofixSummary {
  return {
    attempted: details.length,
    applied: details.filter((detail) => detail.status === "applied").length,
    skipped: details.filter((detail) => detail.status === "skipped").length,
    failures: details.filter((detail) => detail.status === "failed").length,
    details,
  };
}
```

- [ ] **Step 3: Implement the alias-backfill repairer**

Create `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\alias-backfill.ts` with this exact content:

```ts
import path from "node:path";
import { atomicWrite, buildFrontmatter, parseFrontmatter, slugify } from "../../utils/markdown.js";
import type { LintAutofixDetail } from "../types.js";
import { buildAutofixCandidateMap, collectAllPages, normalizeWikilinkTarget } from "../wiki-page-index.js";
import type { AutofixContext, AutofixRepairer } from "./types.js";

export const aliasBackfillRepairer: AutofixRepairer = {
  name: "alias-backfill",
  async run(context) {
    const diagnostics = context.diagnostics.filter((result) => result.rule === "broken-wikilink");
    if (diagnostics.length === 0) {
      return [];
    }

    const pages = await collectAllPages(context.root);
    const candidates = buildAutofixCandidateMap(pages);
    const details: LintAutofixDetail[] = [];

    for (const diagnostic of diagnostics) {
      const captured = diagnostic.message.match(/\[\[(.+?)\]\]/)?.[1];
      if (!captured) {
        continue;
      }

      const visibleTarget = normalizeWikilinkTarget(captured);
      const slug = slugify(visibleTarget);
      const matches = uniqueByPath(candidates.get(slug) ?? []);

      if (matches.length === 0) {
        details.push(makeDetail("skipped", diagnostic.file, "missing-target"));
        continue;
      }

      if (matches.length > 1) {
        details.push(makeDetail("skipped", diagnostic.file, "ambiguous-target"));
        continue;
      }

      const target = matches[0]!;
      const page = pages.find((entry) => entry.filePath === target.filePath);
      if (!page) {
        details.push(makeDetail("failed", diagnostic.file, "candidate-not-loaded"));
        continue;
      }

      const { meta, body } = parseFrontmatter(page.content);
      if (Object.keys(meta).length === 0) {
        details.push(makeDetail("skipped", diagnostic.file, "missing-frontmatter"));
        continue;
      }

      const aliases = Array.isArray(meta.aliases)
        ? meta.aliases.filter((value): value is string => typeof value === "string")
        : [];
      if (aliases.includes(visibleTarget)) {
        details.push(makeDetail("skipped", diagnostic.file, "alias-already-present"));
        continue;
      }

      const nextContent = `${buildFrontmatter({ ...meta, aliases: [...aliases, visibleTarget] })}\n\n${body.trimStart()}`;
      await atomicWrite(page.filePath, nextContent);
      details.push({
        repairer: "alias-backfill",
        kind: diagnostic.rule,
        target: path.relative(context.root, page.filePath).replace(/\\/g, "/"),
        reason: "unique-target",
        status: "applied",
      });
    }

    return details;
  },
};

function uniqueByPath(values: Array<{ filePath: string }>): Array<{ filePath: string }> {
  const seen = new Set<string>();
  const next: Array<{ filePath: string }> = [];
  for (const value of values) {
    if (seen.has(value.filePath)) {
      continue;
    }
    seen.add(value.filePath);
    next.push(value);
  }
  return next;
}

function makeDetail(
  status: "skipped" | "failed",
  target: string,
  reason: string,
): LintAutofixDetail {
  return {
    repairer: "alias-backfill",
    kind: "broken-wikilink",
    target,
    reason,
    status,
  };
}
```

- [ ] **Step 4: Make broken-wikilink lint reuse the shared target normalizer**

Update `D:\Desktop\llm-wiki-compiler-main\src\linter\rules.ts` with this diff:

```diff
-import { parseFrontmatter, slugify } from "../utils/markdown.js";
+import { collectAllPages, buildPageSlugSet, normalizeWikilinkTarget } from "./wiki-page-index.js";
-
-function normalizeWikilinkTarget(captured: string): string {
-  return captured.split("|")[0].split("#")[0].trim();
-}
-
-async function collectAllPages(
-  root: string,
-): Promise<Array<{ filePath: string; content: string }>> {
-  const conceptPages = await readMarkdownFiles(path.join(root, CONCEPTS_DIR));
-  const queryPages = await readMarkdownFiles(path.join(root, QUERIES_DIR));
-  return [...conceptPages, ...queryPages];
-}
-
-function buildPageSlugSet(pages: Array<{ filePath: string; content: string }>): Set<string> {
-  const slugs = new Set<string>();
-  for (const page of pages) {
-    const baseName = path.basename(page.filePath, ".md");
-    slugs.add(baseName.toLowerCase());
-
-    const { meta } = parseFrontmatter(page.content);
-    if (typeof meta.title === "string" && meta.title.trim() !== "") {
-      slugs.add(slugify(meta.title));
-    }
-
-    if (Array.isArray(meta.aliases)) {
-      for (const alias of meta.aliases) {
-        if (typeof alias === "string" && alias.trim() !== "") {
-          slugs.add(slugify(alias));
-        }
-      }
-    }
-  }
-  return slugs;
-}
```

- [ ] **Step 5: Run the autofix tests again and make sure only the alias tests turn green**

Run:

```powershell
rtk test "npm test -- test/lint-autofix.test.ts"
```

Expected:

- PASS for `backfills a unique alias`
- PASS for `skips alias writes`
- FAIL for the example-escaping and bridge-page tests because those repairers do not exist yet

### Task 3: Implement Example Escaping And Bridge-Page Repairs

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\example-escaping.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\bridge-pages.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\lint-autofix.test.ts`

- [ ] **Step 1: Implement the example-escaping repairer**

Create `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\example-escaping.ts` with this exact content:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWrite } from "../../utils/markdown.js";
import type { LintAutofixDetail } from "../types.js";
import type { AutofixContext, AutofixRepairer } from "./types.js";

export const exampleEscapingRepairer: AutofixRepairer = {
  name: "example-escaping",
  async run(context) {
    const diagnostics = context.diagnostics.filter((result) => (
      result.rule === "broken-wikilink" || result.rule === "untraceable-image"
    ) && typeof result.line === "number");
    const details: LintAutofixDetail[] = [];

    for (const diagnostic of diagnostics) {
      const content = await readFile(diagnostic.file, "utf8");
      const lines = content.split("\n");
      const index = (diagnostic.line ?? 1) - 1;
      const currentLine = lines[index] ?? "";

      const replacement = buildReplacement(currentLine);
      if (!replacement) {
        details.push(makeDetail(context.root, "skipped", diagnostic, "not-example-line"));
        continue;
      }

      lines[index] = replacement;
      await atomicWrite(diagnostic.file, lines.join("\n"));
      details.push(makeDetail(context.root, "applied", diagnostic, "escaped-example-line"));
    }

    return details;
  },
};

function buildReplacement(line: string): string | null {
  const trimmed = line.trim();
  if (/^`?!\[\[[^|\]]+\|[^|\]]+\]\]`?$/.test(trimmed)) {
    return "图片尺寸示例：感叹号 + 双中括号 + 图片文件名 + 竖线 + 宽度数值。";
  }
  if (/^`?!\[\[[^\]]+\]\]`?$/.test(trimmed)) {
    return "图片嵌入示例：感叹号 + 双中括号 + 图片文件名。";
  }
  if (/^`?\[\[[^|\]]+\|[^\]]+\]\]`?$/.test(trimmed)) {
    return "双链显示文字示例：双中括号 + 页面名 + 竖线 + 显示文本。";
  }
  if (/^`?\[\[[^\]]+\]\]`?$/.test(trimmed)) {
    return "双链示例：双中括号 + 页面名。";
  }
  return null;
}

function makeDetail(
  root: string,
  status: "applied" | "skipped",
  diagnostic: { file: string; line?: number; rule: string },
  reason: string,
): LintAutofixDetail {
  return {
    repairer: "example-escaping",
    kind: diagnostic.rule,
    target: `${path.relative(root, diagnostic.file).replace(/\\/g, "/")}:${diagnostic.line ?? 0}`,
    reason,
    status,
  };
}
```

- [ ] **Step 2: Implement the bridge-page repairer**

Create `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\bridge-pages.ts` with this exact content:

```ts
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWrite, buildFrontmatter, parseFrontmatter, slugify } from "../../utils/markdown.js";
import type { LintAutofixDetail } from "../types.js";
import { normalizeWikilinkTarget } from "../wiki-page-index.js";
import type { AutofixContext, AutofixRepairer } from "./types.js";

interface LinkMigration {
  oldTitle: string;
  canonicalPath: string;
  createdAt: string;
  reason: string;
}

export const bridgePageRepairer: AutofixRepairer = {
  name: "bridge-page",
  async run(context) {
    const migrations = await readMigrations(context.root);
    const diagnostics = context.diagnostics.filter((result) => result.rule === "broken-wikilink");
    const details: LintAutofixDetail[] = [];

    for (const diagnostic of diagnostics) {
      const captured = diagnostic.message.match(/\[\[(.+?)\]\]/)?.[1];
      const visibleTarget = captured ? normalizeWikilinkTarget(captured) : "";
      const migration = migrations.find((entry) => slugify(entry.oldTitle) === slugify(visibleTarget));

      if (!migration) {
        details.push(makeDetail(context.root, "skipped", diagnostic.file, "missing-migration"));
        continue;
      }

      const canonicalFile = path.join(context.root, migration.canonicalPath);
      if (!existsSync(canonicalFile)) {
        details.push(makeDetail(context.root, "failed", diagnostic.file, "missing-canonical-page"));
        continue;
      }

      const canonicalContent = await readFile(canonicalFile, "utf8");
      const canonicalMeta = parseFrontmatter(canonicalContent).meta;
      const canonicalTitle = typeof canonicalMeta.title === "string"
        ? canonicalMeta.title
        : path.basename(canonicalFile, ".md");

      const bridgeFile = path.join(path.dirname(canonicalFile), `${slugify(migration.oldTitle)}.md`);
      if (existsSync(bridgeFile)) {
        details.push(makeDetail(context.root, "skipped", bridgeFile, "bridge-already-exists"));
        continue;
      }

      const bridgeContent = [
        buildFrontmatter({
          title: migration.oldTitle,
          summary: `桥接页：兼容旧链接，指向 [[${canonicalTitle}]]。`,
          aliases: [migration.oldTitle],
        }),
        "",
        `# ${migration.oldTitle}`,
        "",
        `本页是桥接页，请改用 [[${canonicalTitle}]]。`,
      ].join("\n");

      await atomicWrite(bridgeFile, bridgeContent);
      details.push(makeDetail(context.root, "applied", bridgeFile, "created-bridge-page"));
    }

    return details;
  },
};

async function readMigrations(root: string): Promise<LinkMigration[]> {
  const filePath = path.join(root, ".llmwiki", "link-migrations.json");
  if (!existsSync(filePath)) {
    return [];
  }

  const parsed = JSON.parse(await readFile(filePath, "utf8")) as { migrations?: LinkMigration[] };
  return Array.isArray(parsed.migrations) ? parsed.migrations : [];
}

function makeDetail(
  root: string,
  status: "applied" | "skipped" | "failed",
  target: string,
  reason: string,
): LintAutofixDetail {
  return {
    repairer: "bridge-page",
    kind: "broken-wikilink",
    target: path.relative(root, target).replace(/\\/g, "/"),
    reason,
    status,
  };
}
```

- [ ] **Step 3: Run the autofix tests again and make sure only the orchestrator wiring is still red**

Run:

```powershell
rtk test "npm test -- test/lint-autofix.test.ts"
```

Expected:

- alias tests PASS
- example-escaping test PASS
- bridge-page test PASS
- remaining failures point to `lint()` not yet invoking the repairers or surfacing summary counts correctly

### Task 4: Wire The Autofix Orchestrator Into Lint And Command Output

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\linter\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\commands\lint.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\lint-autofix.test.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\lint.test.ts`

- [ ] **Step 1: Create the autofix orchestrator**

Create `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\index.ts` with this exact content:

```ts
import type { LintAutofixDetail, LintResult } from "../types.js";
import { aliasBackfillRepairer } from "./alias-backfill.js";
import { bridgePageRepairer } from "./bridge-pages.js";
import { exampleEscapingRepairer } from "./example-escaping.js";
import { EMPTY_AUTOFIX_SUMMARY, summarizeAutofix } from "./types.js";

const REPAIRERS = [
  aliasBackfillRepairer,
  exampleEscapingRepairer,
  bridgePageRepairer,
];

export async function runDeterministicAutofix(root: string, diagnostics: LintResult[]) {
  if (diagnostics.length === 0) {
    return EMPTY_AUTOFIX_SUMMARY;
  }

  const details: LintAutofixDetail[] = [];
  for (const repairer of REPAIRERS) {
    details.push(...await repairer.run({ root, diagnostics }));
  }

  return summarizeAutofix(details);
}
```

- [ ] **Step 2: Wire the two-pass lint flow**

Update `D:\Desktop\llm-wiki-compiler-main\src\linter\index.ts` to this exact content:

```ts
/**
 * Wiki linter orchestrator.
 *
 * Imports all lint rules, runs them concurrently, and aggregates
 * results into a summary with error/warning/info counts.
 * This is the main entry point for programmatic lint access.
 */

import type { LintResult, LintRule, LintSummary } from "./types.js";
import {
  checkBrokenWikilinks,
  checkNoOutlinks,
  checkOrphanedPages,
  checkMissingSummaries,
  checkDuplicateConcepts,
  checkEmptyPages,
  checkBrokenCitations,
} from "./rules.js";
import { checkUntraceableMediaReferences } from "./media-rules.js";
import { checkLowConfidenceClaims, checkStaleClaims } from "./lifecycle-rules.js";
import { runDeterministicAutofix } from "./autofix/index.js";

const PREPASS_RULES: LintRule[] = [
  checkBrokenWikilinks,
  checkUntraceableMediaReferences,
];

const ALL_RULES: LintRule[] = [
  checkBrokenWikilinks,
  checkNoOutlinks,
  checkOrphanedPages,
  checkMissingSummaries,
  checkDuplicateConcepts,
  checkEmptyPages,
  checkBrokenCitations,
  checkUntraceableMediaReferences,
  checkStaleClaims,
  checkLowConfidenceClaims,
];

function countBySeverity(
  results: LintResult[],
  severity: LintResult["severity"],
): number {
  return results.filter((result) => result.severity === severity).length;
}

async function runRules(root: string, rules: LintRule[]): Promise<LintResult[]> {
  const ruleResults = await Promise.all(rules.map((rule) => rule(root)));
  return ruleResults.flat();
}

export async function lint(root: string): Promise<LintSummary> {
  const prepassResults = await runRules(root, PREPASS_RULES);
  const autofix = await runDeterministicAutofix(root, prepassResults);
  const results = await runRules(root, ALL_RULES);

  return {
    errors: countBySeverity(results, "error"),
    warnings: countBySeverity(results, "warning"),
    info: countBySeverity(results, "info"),
    results,
    autofix,
  };
}
```

- [ ] **Step 3: Print the autofix summary in the CLI command**

Update `D:\Desktop\llm-wiki-compiler-main\src\commands\lint.ts` with this diff:

```diff
+import type { LintSummary } from "../linter/types.js";
+
+function printAutofixSummary(summary: LintSummary["autofix"]): void {
+  const line = [
+    `attempted ${summary.attempted}`,
+    `applied ${summary.applied}`,
+    `skipped ${summary.skipped}`,
+    `failed ${summary.failures}`,
+  ].join(", ");
+  output.status("~", `自动修复 ${output.dim(line)}`);
+}
+
+function printAutofixDetails(summary: LintSummary["autofix"]): void {
+  for (const detail of summary.details) {
+    output.status(
+      "-",
+      `${detail.repairer} ${output.dim(detail.status)} ${output.dim(detail.target)} ${detail.reason}`,
+    );
+  }
+}
+
+  if (summary.autofix.attempted > 0) {
+    printAutofixSummary(summary.autofix);
+    printAutofixDetails(summary.autofix);
+    console.log();
+  }
+
   for (const result of summary.results) {
     printResult(result);
   }
```

- [ ] **Step 4: Run the focused lint suites**

Run:

```powershell
rtk test "npm test -- test/lint-autofix.test.ts test/lint.test.ts"
```

Expected:

- PASS for the new autofix integration tests
- PASS for the existing lint rule/orchestrator tests

### Task 5: Document The Workflow Change And Run Verification Gates

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\linter\types.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\linter\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\commands\lint.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\src\linter\rules.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\wiki-page-index.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\types.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\index.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\alias-backfill.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\example-escaping.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\src\linter\autofix\bridge-pages.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\test\lint-autofix.test.ts`

- [ ] **Step 1: Update the project log to describe deterministic pre-check self-healing**

Edit `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md` with these exact additions:

At the end of the `## 现有流程` description for system check, add:

```md
系统检查现在会先执行一轮 deterministic autofix：对唯一目标的 alias 缺失、文档示例语法误报、以及有显式迁移表支撑的旧链接，先自动写回修复，再输出剩余问题。需要语义判断的缺页、缺引用和过时结论仍然保留在审查流中。
```

At the top of `## 时间线`, prepend:

```md
### [2026-04-25 22:40] 系统检查增加 deterministic autofix 预修复阶段

- 修改内容：`检查` 在输出最终 lint 结果前，先尝试自动修复三类可机械证明的问题：唯一目标 alias 缺失、示例语法误报、显式迁移表驱动的桥接页。
- 修改内容：`llmwiki lint` 新增 autofix 摘要输出，最终错误数以修复后的第二轮 lint 为准。
- 影响范围：system check CLI、review run log、wiki frontmatter 写回、桥接页生成。
```

- [ ] **Step 2: Run the focused verification commands**

Run:

```powershell
rtk test "npm test -- test/lint-autofix.test.ts test/lint.test.ts"
rtk tsc --noEmit
rtk err "npm run build"
```

Expected:

- all targeted lint tests PASS
- `tsc --noEmit` PASS
- `npm run build` PASS

- [ ] **Step 3: Run the required repo-wide gates**

Run:

```powershell
rtk test "npm test"
rtk err "npx fallow"
```

Expected:

- `npm test` PASS
- `npx fallow` PASS

- [ ] **Step 4: Only if the full gates are green, commit the deterministic autofix feature**

Run:

```powershell
git add src/linter/types.ts src/linter/index.ts src/commands/lint.ts src/linter/rules.ts src/linter/wiki-page-index.ts src/linter/autofix/types.ts src/linter/autofix/index.ts src/linter/autofix/alias-backfill.ts src/linter/autofix/example-escaping.ts src/linter/autofix/bridge-pages.ts test/lint-autofix.test.ts docs/project-log.md
git commit -m "feat: add deterministic system-check autofix"
```

Expected:

- commit succeeds with only the deterministic autofix files staged

- [ ] **Step 5: If the repo-wide gates are still red on unrelated failures, stop and report instead of committing**

Report:

- exact failing test files from `npm test`
- exact `fallow` failures
- confirmation that targeted autofix tests, TypeScript, and build passed
