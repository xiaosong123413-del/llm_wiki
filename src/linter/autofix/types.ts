/**
 * Shared types for deterministic lint autofix repairers.
 *
 * Repairers consume the prepass diagnostics and return structured detail
 * records. This file also provides the single summary reducer used by
 * orchestrators and tests.
 */

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
