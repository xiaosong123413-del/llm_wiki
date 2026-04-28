import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { hasTrackedAssetName } from "./asset-provenance.js";
import { listMarkdownFilesRecursive } from "../markdown-file-listing.js";
import type { RuleContext, RuleDefinition, RuleIssue } from "./types.js";

const IMAGE_REF_RE = /!\[[^\]]*]\(([^)]+)\)|<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

function extractImageRefs(markdown: string): string[] {
  const refs: string[] = [];
  for (const match of markdown.matchAll(IMAGE_REF_RE)) {
    const ref = (match[1] ?? match[2] ?? "").trim();
    if (ref) {
      refs.push(ref);
    }
  }
  return refs;
}

function isLocalRef(ref: string): boolean {
  return !/^(https?:|data:|file:|mailto:|\/\/)/i.test(ref);
}

function makeIssueId(pagePath: string, ref: string): string {
  return `image-provenance:${pagePath.replace(/\\/g, "/")}:${ref}`;
}

function run(context: RuleContext): RuleIssue[] {
  const issues: RuleIssue[] = [];

  const pagePaths = listMarkdownFilesRecursive(context.wikiRoot, { ignoreMissing: true });
  for (const pagePath of pagePaths) {
    const markdown = readFileSync(pagePath, "utf8");
    for (const ref of extractImageRefs(markdown)) {
      if (!isLocalRef(ref)) {
        continue;
      }

      const assetName = ref.split(/[\\/]/).pop() ?? ref;
      if (hasTrackedAssetName(context.projectRoot, assetName)) {
        continue;
      }

      issues.push({
        id: makeIssueId(pagePath, ref),
        ruleId: "image-provenance",
        severity: "error",
        title: "Untraceable image reference",
        detail: `Wiki page ${relative(context.projectRoot, pagePath).replace(/\\/g, "/")} references ${ref}, but no matching image was found in raw or sources_full.`,
        createdAt: new Date().toISOString(),
        target: relative(context.projectRoot, pagePath).replace(/\\/g, "/"),
      });
    }
  }

  return issues;
}

export const imageProvenanceRule: RuleDefinition = {
  id: "image-provenance",
  run,
};
