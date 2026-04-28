/**
 * Wiki linter orchestrator.
 *
 * Imports all lint rules, runs them concurrently, and aggregates
 * results into a summary with error/warning/info counts.
 * This is the main entry point for programmatic lint access.
 */

import type { LintResult, LintRule, LintSummary } from "./types.js";
import { applyDeterministicLintAutofixes } from "./autofix.js";
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

const AUTOFIX_PREPASS_RULES: LintRule[] = [
  checkBrokenWikilinks,
  checkUntraceableMediaReferences,
];

/** All lint rules to execute during a lint pass. */
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

/**
 * Count occurrences of a specific severity level in the results.
 */
function countBySeverity(
  results: LintResult[],
  severity: LintResult["severity"],
): number {
  return results.filter((r) => r.severity === severity).length;
}

/**
 * Run all lint rules concurrently against the wiki at the given root.
 * @param root - Absolute path to the project root directory.
 * @returns A summary containing all diagnostics and severity counts.
 */
export async function lint(root: string): Promise<LintSummary> {
  const prepassResults = await runLintRules(root, AUTOFIX_PREPASS_RULES);
  const autofix = await applyDeterministicLintAutofixes(
    root,
    prepassResults,
    () => runLintRules(root, AUTOFIX_PREPASS_RULES),
  );
  const results = await runLintRules(root, ALL_RULES);

  return {
    errors: countBySeverity(results, "error"),
    warnings: countBySeverity(results, "warning"),
    info: countBySeverity(results, "info"),
    results,
    autofix,
  };
}

async function runLintRules(root: string, rules: readonly LintRule[]): Promise<LintResult[]> {
  const ruleResults = await Promise.all(rules.map((rule) => rule(root)));
  return ruleResults.flat();
}
