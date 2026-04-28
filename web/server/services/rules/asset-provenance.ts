import { readdirSync, statSync, existsSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import type { RuleContext, RuleDefinition, RuleIssue } from "./types.js";

const TRACKED_EXTENSIONS = new Set([".pdf", ".mp4", ".mov", ".webm", ".mkv", ".m4v", ".avi"]);
const PROVENANCE_EXTENSIONS = [".provenance.md", ".provenance.json", ".md", ".json"];

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function hasProvenanceSidecar(assetPath: string): boolean {
  const directory = assetPath.slice(0, assetPath.lastIndexOf("\\"));
  const stem = assetPath.slice(0, assetPath.length - extname(assetPath).length);
  return PROVENANCE_EXTENSIONS.some((suffix) => existsSync(`${stem}${suffix}`) || existsSync(join(directory, `${basename(stem)}${suffix}`)));
}

function makeIssueId(assetPath: string): string {
  return `asset-provenance:${assetPath.replace(/\\/g, "/")}`;
}

function buildIssue(assetPath: string, projectRoot: string): RuleIssue {
  return {
    id: makeIssueId(assetPath),
    ruleId: "asset-provenance",
    severity: "warn",
    title: "Missing asset provenance record",
    detail: `No provenance sidecar was found for ${relative(projectRoot, assetPath).replace(/\\/g, "/")}.`,
    createdAt: new Date().toISOString(),
    target: relative(projectRoot, assetPath).replace(/\\/g, "/"),
  };
}

export function hasTrackedAssetName(projectRoot: string, assetName: string): boolean {
  for (const folder of ["raw", "sources_full"]) {
    const base = join(projectRoot, folder);
    for (const filePath of walkFiles(base)) {
      if (basename(filePath) === assetName) {
        return true;
      }
    }
  }

  return false;
}

function run(context: RuleContext): RuleIssue[] {
  const issues: RuleIssue[] = [];

  for (const folder of ["raw", "sources_full"]) {
    const root = join(context.projectRoot, folder);
    for (const filePath of walkFiles(root)) {
      if (!TRACKED_EXTENSIONS.has(extname(filePath).toLowerCase())) {
        continue;
      }
      if (hasProvenanceSidecar(filePath)) {
        continue;
      }
      issues.push(buildIssue(filePath, context.projectRoot));
    }
  }

  return issues;
}

export const assetProvenanceRule: RuleDefinition = {
  id: "asset-provenance",
  run,
};
