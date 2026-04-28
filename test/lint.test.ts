/**
 * Tests for the wiki linter rules and orchestrator.
 * Each describe block creates a temporary wiki structure, runs a rule,
 * and asserts the expected diagnostics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import os from "os";
import {
  checkBrokenWikilinks,
  checkOrphanedPages,
  checkMissingSummaries,
  checkDuplicateConcepts,
  checkEmptyPages,
  checkBrokenCitations,
} from "../src/linter/rules.js";
import { lint } from "../src/linter/index.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "lint-test-"));
  await mkdir(path.join(tmpDir, "wiki", "concepts"), { recursive: true });
  await mkdir(path.join(tmpDir, "wiki", "queries"), { recursive: true });
  await mkdir(path.join(tmpDir, "sources"), { recursive: true });
  await mkdir(path.join(tmpDir, "sources_full"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/** Helper to write a wiki page to the concepts directory. */
async function writeConcept(slug: string, content: string): Promise<void> {
  await writeFile(path.join(tmpDir, "wiki", "concepts", `${slug}.md`), content);
}

/** Helper to write a wiki page to the queries directory. */
async function writeQuery(slug: string, content: string): Promise<void> {
  await writeFile(path.join(tmpDir, "wiki", "queries", `${slug}.md`), content);
}

/** Helper to write a source file. */
async function writeSource(name: string, content: string): Promise<void> {
  await writeFile(path.join(tmpDir, "sources", name), content);
}

/** Helper to write a full-source file. */
async function writeFullSource(name: string, content: string): Promise<void> {
  await writeFile(path.join(tmpDir, "sources_full", name), content);
}

describe("checkBrokenWikilinks", () => {
  it("returns no results when all wikilinks are valid", async () => {
    await writeConcept("machine-learning", "---\ntitle: Machine Learning\n---\nSee [[Neural Networks]].");
    await writeConcept("neural-networks", "---\ntitle: Neural Networks\n---\nA type of ML model.");

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("detects broken wikilinks", async () => {
    await writeConcept("machine-learning", "---\ntitle: Machine Learning\n---\nSee [[Nonexistent Topic]].");

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe("broken-wikilink");
    expect(results[0].severity).toBe("error");
    expect(results[0].message).toContain("Nonexistent Topic");
  });

  it("resolves wikilinks across concepts and queries", async () => {
    await writeConcept("intro", "---\ntitle: Intro\n---\nSee [[My Query]].");
    await writeQuery("my-query", "---\ntitle: My Query\n---\nAnswer to the query.");

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("reports the correct line number for broken wikilinks", async () => {
    const content = "---\ntitle: Test\n---\nLine one.\nLine two.\n[[Missing Page]] here.";
    await writeConcept("test", content);

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].line).toBe(6);
  });

  it("resolves wikilinks by page title even when filename slug differs", async () => {
    await writeConcept(
      "three-tier-knowledge-architecture",
      "---\ntitle: 三层知识架构\n---\n正文内容足够长，避免空页面规则干扰。",
    );
    await writeConcept(
      "consumer",
      "---\ntitle: Consumer\n---\nSee [[三层知识架构]].",
    );

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("resolves wikilinks by aliases", async () => {
    await writeConcept(
      "ai-knowledge-base-construction",
      "---\ntitle: AI Knowledge Base Construction\naliases:\n  - AI知识库构建\n---\n正文内容足够长，避免空页面规则干扰。",
    );
    await writeConcept(
      "consumer",
      "---\ntitle: Consumer\n---\nSee [[AI知识库构建]].",
    );

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("resolves wikilinks with display text aliases after a pipe", async () => {
    await writeConcept(
      "three-tier-knowledge-architecture",
      "---\ntitle: 三层知识架构\naliases:\n  - 三层知识架构\n---\n正文内容足够长，避免空页面规则干扰。",
    );
    await writeConcept(
      "consumer",
      "---\ntitle: Consumer\n---\nSee [[三层知识架构|knowledge structure]].",
    );

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("ignores wikilinks inside fenced code blocks", async () => {
    await writeConcept(
      "consumer",
      [
        "---",
        "title: Consumer",
        "---",
        "",
        "```markdown",
        "[[Missing Page]]",
        "```",
      ].join("\n"),
    );

    const results = await checkBrokenWikilinks(tmpDir);
    expect(results).toHaveLength(0);
  });
});

describe("checkOrphanedPages", () => {
  it("returns no results when no pages are orphaned", async () => {
    await writeConcept("active-page", "---\ntitle: Active\n---\nContent here.");

    const results = await checkOrphanedPages(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("detects orphaned pages", async () => {
    await writeConcept("orphan", "---\ntitle: Orphan\norphaned: true\n---\nContent here.");

    const results = await checkOrphanedPages(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe("orphaned-page");
    expect(results[0].severity).toBe("warning");
  });
});

describe("checkMissingSummaries", () => {
  it("returns no results when all pages have summaries", async () => {
    await writeConcept("good-page", "---\ntitle: Good\nsummary: A good page.\n---\nContent.");

    const results = await checkMissingSummaries(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("detects pages with missing summary", async () => {
    await writeConcept("no-summary", "---\ntitle: No Summary\n---\nContent here.");

    const results = await checkMissingSummaries(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe("missing-summary");
    expect(results[0].severity).toBe("warning");
  });

  it("detects pages with empty summary", async () => {
    await writeConcept("empty-summary", '---\ntitle: Empty\nsummary: ""\n---\nContent here.');

    const results = await checkMissingSummaries(tmpDir);
    expect(results).toHaveLength(1);
  });
});

describe("checkDuplicateConcepts", () => {
  it("returns no results when all titles are unique", async () => {
    await writeConcept("page-a", "---\ntitle: Page A\n---\nContent A.");
    await writeConcept("page-b", "---\ntitle: Page B\n---\nContent B.");

    const results = await checkDuplicateConcepts(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("detects duplicate titles (case-insensitive)", async () => {
    await writeConcept("ml-intro", "---\ntitle: Machine Learning\n---\nContent A.");
    await writeConcept("ml-guide", "---\ntitle: machine learning\n---\nContent B.");

    const results = await checkDuplicateConcepts(tmpDir);
    expect(results).toHaveLength(2);
    expect(results[0].rule).toBe("duplicate-concept");
    expect(results[0].severity).toBe("error");
  });
});

describe("checkEmptyPages", () => {
  it("returns no results for pages with sufficient body content", async () => {
    const longBody = "This is a sufficiently long body that exceeds the minimum character threshold for content.";
    await writeConcept("full-page", `---\ntitle: Full\n---\n${longBody}`);

    const results = await checkEmptyPages(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("detects pages with empty body", async () => {
    await writeConcept("empty", "---\ntitle: Empty Page\n---\n");

    const results = await checkEmptyPages(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe("empty-page");
    expect(results[0].severity).toBe("warning");
  });

  it("detects pages with very short body", async () => {
    await writeConcept("short", "---\ntitle: Short Page\n---\nToo short.");

    const results = await checkEmptyPages(tmpDir);
    expect(results).toHaveLength(1);
  });

  it("ignores pages without a title", async () => {
    await writeConcept("no-title", "---\nsummary: No title\n---\n");

    const results = await checkEmptyPages(tmpDir);
    expect(results).toHaveLength(0);
  });
});

describe("checkBrokenCitations", () => {
  it("returns no results when all citations are valid", async () => {
    await writeSource("article.md", "# Article\nSome source content.");
    await writeConcept("cited", "---\ntitle: Cited\n---\nBased on ^[article.md] research.");

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("detects broken citations", async () => {
    await writeConcept("bad-cite", "---\ntitle: Bad Cite\n---\nBased on ^[missing.md] data.");

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe("broken-citation");
    expect(results[0].severity).toBe("error");
    expect(results[0].message).toContain("missing.md");
  });

  it("reports the correct line number", async () => {
    const content = "---\ntitle: Test\n---\nLine one.\n^[gone.md] here.";
    await writeConcept("cite-line", content);

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].line).toBe(5);
  });

  it("accepts citations that exist in sources_full", async () => {
    await writeFullSource("archived-source.md", "# Archived\nSource content.");
    await writeConcept("full-cite", "---\ntitle: Full Cite\n---\nBased on ^[archived-source.md] data.");

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("accepts citations that reference only the trailing hash filename", async () => {
    await writeFullSource(
      "ai知识库（第二大脑）__概念__AI-Agent规划__1e0b10dd.md",
      "# Archived\nSource content.",
    );
    await writeConcept(
      "hash-cite",
      "---\ntitle: Hash Cite\n---\nBased on ^[1e0b10dd.md] data.",
    );

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("accepts citations whose visible filename differs but hash matches a source file", async () => {
    await writeFullSource(
      "ai知识库（第二大脑）__概念__LLM知识库方法论__e653ef16.md",
      "# Archived\nSource content.",
    );
    await writeConcept(
      "variant-cite",
      "---\ntitle: Variant Cite\n---\nBased on ^[ai知識庫（第二大脳）__概念__LLM知識庫方法論__e653ef16.md] data.",
    );

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("validates each file separately inside a multi-source citation", async () => {
    await writeFullSource(
      "ai知识库（第二大脑）__概念__AI-Agent规划__1e0b10dd.md",
      "# Archived\nSource content.",
    );
    await writeFullSource(
      "ai知识库（第二大脑）__概念__CoT__60ca95e7.md",
      "# Archived\nSource content.",
    );
    await writeConcept(
      "multi-cite",
      "---\ntitle: Multi Cite\n---\nBased on ^[1e0b10dd.md, 60ca95e7.md] data.",
    );

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("ignores citations inside fenced code blocks", async () => {
    await writeConcept(
      "code-cite",
      [
        "---",
        "title: Code Cite",
        "---",
        "",
        "```markdown",
        "^[missing.md]",
        "```",
      ].join("\n"),
    );

    const results = await checkBrokenCitations(tmpDir);
    expect(results).toHaveLength(0);
  });
});

describe("lint orchestrator", () => {
  it("returns a summary with zero counts for a clean wiki", async () => {
    const longBody = "This is a sufficiently long body that exceeds the minimum character threshold for content.";
    await writeConcept(
      "linked-page",
      `---\ntitle: Linked Page\nsummary: A linked page.\n---\n${longBody}\n\nSee [[Clean Page]].`,
    );
    await writeConcept(
      "clean",
      `---\ntitle: Clean Page\nsummary: A clean page.\n---\n${longBody}\n\nSee [[Linked Page]].`,
    );

    const summary = await lint(tmpDir);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.info).toBe(0);
    expect(summary.results).toHaveLength(0);
  });

  it("aggregates results from multiple rules", async () => {
    await writeConcept("broken", "---\ntitle: Broken\n---\nSee [[Ghost Page]].");
    await writeConcept("orphan", "---\ntitle: Orphan\norphaned: true\nsummary: ok\n---\nSome sufficiently long body content for the orphan page test case.");

    const summary = await lint(tmpDir);
    const hasWikilinkError = summary.results.some((r) => r.rule === "broken-wikilink");
    const hasOrphanWarning = summary.results.some((r) => r.rule === "orphaned-page");
    expect(hasWikilinkError).toBe(true);
    expect(hasOrphanWarning).toBe(true);
    expect(summary.errors).toBeGreaterThan(0);
    expect(summary.warnings).toBeGreaterThan(0);
  });

  it("works with an empty wiki directory", async () => {
    const summary = await lint(tmpDir);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.results).toHaveLength(0);
  });
});

describe("lint integration contracts", () => {
  it("uses an autofix prepass before the final full lint pass", async () => {
    vi.resetModules();
    const prepassDiagnostic = {
      rule: "broken-wikilink",
      severity: "error" as const,
      file: "prepass.md",
      message: "Broken wikilink [[Ghost]] - no matching page found",
    };
    const finalWarning = {
      rule: "missing-summary",
      severity: "warning" as const,
      file: "final.md",
      message: "Page has no summary in frontmatter",
    };
    const applyDeterministicLintAutofixes = vi.fn(async (_root: string, diagnostics: unknown[]) => {
      expect(diagnostics).toEqual([prepassDiagnostic]);
      return { attempted: 1, applied: 1, skipped: 0, failures: 0, details: [] };
    });

    vi.doMock("../src/linter/autofix.js", () => ({ applyDeterministicLintAutofixes }));
    vi.doMock("../src/linter/rules.js", () => ({
      checkBrokenWikilinks: vi.fn(async () => [prepassDiagnostic]),
      checkNoOutlinks: vi.fn(async () => []),
      checkOrphanedPages: vi.fn(async () => []),
      checkMissingSummaries: vi.fn(async () => [finalWarning]),
      checkDuplicateConcepts: vi.fn(async () => []),
      checkEmptyPages: vi.fn(async () => []),
      checkBrokenCitations: vi.fn(async () => []),
    }));
    vi.doMock("../src/linter/media-rules.js", () => ({
      checkUntraceableMediaReferences: vi.fn(async () => []),
    }));
    vi.doMock("../src/linter/lifecycle-rules.js", () => ({
      checkLowConfidenceClaims: vi.fn(async () => []),
      checkStaleClaims: vi.fn(async () => []),
    }));

    const { lint: mockedLint } = await import("../src/linter/index.js");

    const summary = await mockedLint(tmpDir);
    expect(summary.results).toEqual([prepassDiagnostic, finalWarning]);
    expect(summary.errors).toBe(1);
    expect(summary.warnings).toBe(1);
    expect(applyDeterministicLintAutofixes).toHaveBeenCalledTimes(1);
  });
});
