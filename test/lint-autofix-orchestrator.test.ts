/**
 * Focused tests for deterministic autofix verification inside the orchestrator.
 *
 * These tests lock the rule that an edit only counts as applied when the
 * corresponding prepass diagnostic disappears after the rerun.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = "D:/repo";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("deterministic autofix orchestrator", () => {
  it("demotes alias edits to failed when the broken wikilink survives the rerun", async () => {
    const diagnostic = {
      rule: "broken-wikilink" as const,
      severity: "error" as const,
      file: `${ROOT}/wiki/concepts/consumer.md`,
      line: 8,
      message: "Broken wikilink [[Ghost]] - no matching page found",
    };
    const rerunRules = vi.fn(async () => [diagnostic]);

    vi.doMock("../src/linter/autofix/example-escaping.js", () => ({
      exampleEscapingRepairer: { name: "example-escaping", run: vi.fn(async () => []) },
    }));
    vi.doMock("../src/linter/autofix/alias-backfill.js", () => ({
      aliasBackfillRepairer: {
        name: "alias-backfill",
        run: vi.fn(async () => [{
          repairer: "alias-backfill" as const,
          kind: "broken-wikilink" as const,
          target: "wiki/concepts/ghost.md",
          reason: "unique-target",
          status: "applied" as const,
        }]),
      },
    }));
    vi.doMock("../src/linter/autofix/bridge-pages.js", () => ({
      bridgePageRepairer: { name: "bridge-page", run: vi.fn(async () => []) },
    }));

    const { applyDeterministicLintAutofixes } = await import("../src/linter/autofix.js");
    const summary = await applyDeterministicLintAutofixes(ROOT, [diagnostic], rerunRules);

    expect(rerunRules).toHaveBeenCalledTimes(1);
    expect(summary.applied).toBe(0);
    expect(summary.failures).toBe(1);
    expect(summary.details).toEqual([
      expect.objectContaining({
        repairer: "alias-backfill",
        status: "failed",
        reason: "did-not-clear-diagnostic",
      }),
    ]);
  });

  it("demotes bridge-page edits to failed when the broken wikilink survives the rerun", async () => {
    const diagnostic = {
      rule: "broken-wikilink" as const,
      severity: "error" as const,
      file: `${ROOT}/wiki/concepts/consumer.md`,
      line: 8,
      message: "Broken wikilink [[Ghost]] - no matching page found",
    };
    const rerunRules = vi.fn(async () => [diagnostic]);

    vi.doMock("../src/linter/autofix/example-escaping.js", () => ({
      exampleEscapingRepairer: { name: "example-escaping", run: vi.fn(async () => []) },
    }));
    vi.doMock("../src/linter/autofix/alias-backfill.js", () => ({
      aliasBackfillRepairer: {
        name: "alias-backfill",
        run: vi.fn(async () => [{
          repairer: "alias-backfill" as const,
          kind: "broken-wikilink" as const,
          target: "wiki/concepts/consumer.md",
          reason: "missing-target",
          status: "skipped" as const,
        }]),
      },
    }));
    vi.doMock("../src/linter/autofix/bridge-pages.js", () => ({
      bridgePageRepairer: {
        name: "bridge-page",
        run: vi.fn(async () => [{
          repairer: "bridge-page" as const,
          kind: "broken-wikilink" as const,
          target: "wiki/concepts/ghost.md",
          reason: "created-bridge-page",
          status: "applied" as const,
        }]),
      },
    }));

    const { applyDeterministicLintAutofixes } = await import("../src/linter/autofix.js");
    const summary = await applyDeterministicLintAutofixes(ROOT, [diagnostic], rerunRules);

    expect(rerunRules).toHaveBeenCalledTimes(1);
    expect(summary.applied).toBe(0);
    expect(summary.failures).toBe(1);
    expect(summary.details).toEqual([
      expect.objectContaining({
        repairer: "bridge-page",
        status: "failed",
        reason: "did-not-clear-diagnostic",
      }),
    ]);
  });

  it("demotes example rewrites to failed when the same line still fails the rerun", async () => {
    const diagnostic = {
      rule: "untraceable-image" as const,
      severity: "error" as const,
      file: `${ROOT}/wiki/concepts/examples.md`,
      line: 7,
      message: "Untraceable image reference ![[ghost.png]]",
    };
    const rerunRules = vi.fn(async () => [diagnostic]);

    vi.doMock("../src/linter/autofix/example-escaping.js", () => ({
      exampleEscapingRepairer: {
        name: "example-escaping",
        run: vi.fn(async () => [{
          repairer: "example-escaping" as const,
          kind: "untraceable-image" as const,
          target: "wiki/concepts/examples.md:7",
          reason: "escaped-example-line",
          status: "applied" as const,
        }]),
      },
    }));
    vi.doMock("../src/linter/autofix/alias-backfill.js", () => ({
      aliasBackfillRepairer: { name: "alias-backfill", run: vi.fn(async () => []) },
    }));
    vi.doMock("../src/linter/autofix/bridge-pages.js", () => ({
      bridgePageRepairer: { name: "bridge-page", run: vi.fn(async () => []) },
    }));

    const { applyDeterministicLintAutofixes } = await import("../src/linter/autofix.js");
    const summary = await applyDeterministicLintAutofixes(ROOT, [diagnostic], rerunRules);

    expect(rerunRules).toHaveBeenCalledTimes(1);
    expect(summary.applied).toBe(0);
    expect(summary.failures).toBe(1);
    expect(summary.details).toEqual([
      expect.objectContaining({
        repairer: "example-escaping",
        status: "failed",
        reason: "did-not-clear-diagnostic",
      }),
    ]);
  });
});
