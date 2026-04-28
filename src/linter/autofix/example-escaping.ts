/**
 * Deterministic repairer for documentation-only wikilink and image examples.
 *
 * This repairer rewrites isolated example syntax lines into plain-language
 * prose so lint stops treating them as real wikilinks or embedded media.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWrite } from "../../utils/markdown.js";
import type { LintAutofixDetail } from "../types.js";
import type { AutofixContext, AutofixRepairer } from "./types.js";

export const exampleEscapingRepairer: AutofixRepairer = {
  name: "example-escaping",
  async run(context): Promise<LintAutofixDetail[]> {
    const diagnostics = collectUniqueExampleDiagnostics(context.diagnostics);
    const details: LintAutofixDetail[] = [];

    for (const diagnostic of diagnostics) {
      const line = diagnostic.line;
      if (typeof line !== "number") {
        details.push(makeDetail(context.root, "skipped", diagnostic, "missing-line"));
        continue;
      }

      const content = await readFile(diagnostic.file, "utf8");
      const lines = content.split("\n");
      const index = line - 1;
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

function collectUniqueExampleDiagnostics(diagnostics: AutofixContext["diagnostics"]): Array<{
  file: string;
  line?: number;
  rule: string;
}> {
  const uniqueDiagnostics = new Map<string, { file: string; line?: number; rule: string }>();

  for (const diagnostic of diagnostics.filter((result) => (
      result.rule === "broken-wikilink" || result.rule === "untraceable-image"
    ) && typeof result.line === "number")) {
    const key = `${diagnostic.file}:${diagnostic.line ?? 0}`;
    const current = uniqueDiagnostics.get(key);
    if (!current || isPreferredExampleRule(diagnostic.rule, current.rule)) {
      uniqueDiagnostics.set(key, {
        file: diagnostic.file,
        line: diagnostic.line,
        rule: diagnostic.rule,
      });
    }
  }

  return [...uniqueDiagnostics.values()];
}

function isPreferredExampleRule(nextRule: string, currentRule: string): boolean {
  return nextRule === "broken-wikilink" && currentRule !== "broken-wikilink";
}

function buildReplacement(line: string): string | null {
  const trimmed = line.trim();

  if (/^`!\[\[[^|\]]+\|[^|\]]+\]\]`$/.test(trimmed)) {
    return "图片尺寸示例：感叹号 + 双中括号 + 图片文件名 + 竖线 + 宽度数值。";
  }
  if (/^`!\[\[[^\]]+\]\]`$/.test(trimmed)) {
    return "图片嵌入示例：感叹号 + 双中括号 + 图片文件名。";
  }
  if (/^`\[\[[^|\]]+\|[^\]]+\]\]`$/.test(trimmed)) {
    return "双链显示文字示例：双中括号 + 页面名 + 竖线 + 显示文本。";
  }
  if (/^`\[\[[^\]]+\]\]`$/.test(trimmed)) {
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
