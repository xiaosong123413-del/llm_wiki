/**
 * Commander action for `llmwiki lint`.
 *
 * Runs rule-based quality checks against the wiki without any LLM calls.
 * Prints colored diagnostics grouped by severity and exits with code 1
 * if any errors are found.
 */

import { lint } from "../linter/index.js";
import { formatSystemCheckGuidance } from "../linter/system-check-guidance.js";
import * as output from "../utils/output.js";
import { appendMaintenanceLog } from "../utils/maintenance-log.js";
import type { LintAutofixDetail, LintAutofixSummary, LintResult } from "../linter/types.js";

/** Map severity levels to output formatting functions. */
const SEVERITY_FORMATTERS: Record<LintResult["severity"], (text: string) => string> = {
  error: output.error,
  warning: output.warn,
  info: output.info,
};

/** Map severity levels to display icons. */
const SEVERITY_ICONS: Record<LintResult["severity"], string> = {
  error: "x",
  warning: "!",
  info: "i",
};

/** Print a single lint result with colored output. */
function printResult(result: LintResult): void {
  const formatter = SEVERITY_FORMATTERS[result.severity];
  const icon = SEVERITY_ICONS[result.severity];
  const location = result.line ? `${result.file}:${result.line}` : result.file;
  output.status(icon, `${formatter(result.severity)} ${output.dim(location)} ${result.message}`);
}

function printAutofix(summary: LintAutofixSummary): void {
  if (summary.attempted === 0) {
    return;
  }

  output.status("*", output.info(buildAutofixSummaryLine(summary)));
  for (const detail of summary.details) {
    printAutofixDetail(detail);
  }
  console.log();
}

function buildAutofixSummaryLine(summary: LintAutofixSummary): string {
  return `自动修复 ${output.dim([
    `尝试 ${summary.attempted} 项`,
    `已应用 ${summary.applied} 项`,
    `已跳过 ${summary.skipped} 项`,
    `失败 ${summary.failures} 项`,
  ].join("，"))}`;
}

function printAutofixDetail(detail: LintAutofixDetail): void {
  const reason = detail.reason ? `（${detail.reason}）` : "";
  const statusLabel = describeAutofixStatus(detail.status);
  output.status(
    detail.status === "failed" ? "x" : "-",
    `${detail.repairer} ${statusLabel} ${output.dim(detail.target)} ${detail.kind}${reason}`,
  );
}

function describeAutofixStatus(status: LintAutofixDetail["status"]): string {
  return status === "applied" ? "已应用" : status === "failed" ? "失败" : "已跳过";
}

/**
 * Run the lint command: execute all rules and print results.
 * Exits with code 1 if any errors are found.
 */
export default async function lintCommand(): Promise<void> {
  output.header("系统检查");

  const summary = await lint(process.cwd());
  printAutofix(summary.autofix);

  for (const result of summary.results) {
    printResult(result);
  }

  console.log();
  const summaryLine = [
    output.error(`${summary.errors} error(s)`),
    output.warn(`${summary.warnings} warning(s)`),
    output.info(`${summary.info} info`),
  ].join(", ");
  output.status("*", summaryLine);
  console.log();
  console.log(formatSystemCheckGuidance());

  await appendMaintenanceLog(process.cwd(), {
    action: "system-check",
    title: `${summary.errors} errors, ${summary.warnings} warnings, ${summary.info} info`,
    details: {
      errors: summary.errors,
      warnings: summary.warnings,
      info: summary.info,
      status: summary.errors > 0 ? "failed" : "passed",
    },
  });

  if (summary.errors > 0) {
    process.exit(1);
  }
}
