import { afterEach, describe, expect, it } from "vitest";
import { clearRuleRegistry, registerRule } from "../web/server/services/rules/registry.js";
import { runRules } from "../web/server/services/rule-engine.js";
import { ruleIssuesToReviewItems } from "../web/server/services/review-items.js";

afterEach(() => {
  clearRuleRegistry();
});

describe("rule engine", () => {
  it("runs registered deterministic rules and adapts issues for review items", () => {
    registerRule({
      id: "sample-title-rule",
      run: () => [
        {
          id: "issue-1",
          ruleId: "sample-title-rule",
          severity: "warn",
          title: "Missing title",
          detail: "The page is missing a title.",
          createdAt: "2026-04-20T00:00:00.000Z",
          target: "wiki/concepts/sample.md",
        },
      ],
    });

    const issues = runRules({ wikiRoot: "/wiki", projectRoot: "/project" });

    expect(issues).toEqual([
      {
        id: "issue-1",
        ruleId: "sample-title-rule",
        severity: "warn",
        title: "Missing title",
        detail: "The page is missing a title.",
        createdAt: "2026-04-20T00:00:00.000Z",
        target: "wiki/concepts/sample.md",
      },
    ]);

    expect(ruleIssuesToReviewItems(issues)).toEqual([
      {
        id: "issue-1",
        kind: "rule",
        severity: "warn",
        title: "Missing title",
        detail: "The page is missing a title.",
        createdAt: "2026-04-20T00:00:00.000Z",
        target: "wiki/concepts/sample.md",
      },
    ]);
  });
});
