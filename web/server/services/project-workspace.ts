/**
 * Project workspace inventory helpers.
 *
 * These helpers group dirty worktree entries into user-facing buckets so the
 * workspace page can explain what changed and which generated artifacts are
 * safe to delete.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type WorkspaceEntryRecommendation = "delete" | "keep";

interface WorkspaceEntry {
  path: string;
  status: string;
  project: string;
  recommendation: WorkspaceEntryRecommendation;
  reason: string;
  kind: "file" | "directory";
}

interface WorkspaceProjectGroup {
  name: string;
  entries: WorkspaceEntry[];
}

interface PendingWorkItem {
  id: string;
  title: string;
  area: string;
  status: "\u6682\u7f13" | "\u534a\u6210\u54c1" | "MVP \u540e\u7eed" | "\u5916\u90e8\u4f9d\u8d56\u963b\u585e";
  description: string;
  pausedReason: string;
  nextStep: string;
}

const GENERATED_ITEMS: Array<{
  relPath: string;
  project: string;
  recommendation: WorkspaceEntryRecommendation;
  reason: string;
}> = [
  {
    relPath: "wiki-clone/.next",
    project: "\u6784\u5efa\u4ea7\u7269\u4e0e\u672c\u5730\u72b6\u6001",
    recommendation: "delete",
    reason: "Next.js \u672c\u5730\u6784\u5efa\u7f13\u5b58\uff0c\u5220\u6389\u540e\u53ef\u91cd\u65b0\u751f\u6210\u3002",
  },
  {
    relPath: "gui-panel-state.json",
    project: "\u6784\u5efa\u4ea7\u7269\u4e0e\u672c\u5730\u72b6\u6001",
    recommendation: "delete",
    reason: "\u672c\u5730 UI \u9762\u677f\u72b6\u6001\u6587\u4ef6\uff0c\u4e0d\u5c5e\u4e8e\u6e90\u7801\u3002",
  },
];

const ROOT_CONFIG_FILES = new Set([".gitignore", "AGENTS.md", "README.md"]);
const PROJECT_GROUP_RULES: Array<{
  label: string;
  exact?: readonly string[];
  prefixes?: readonly string[];
}> = [
  { label: "Wiki 仿站阅读器", prefixes: ["wiki-clone/"] },
  { label: "WebUI 前后端", exact: ["web"], prefixes: ["web/"] },
  { label: "Electron 桌面壳", prefixes: ["desktop-webui/", "desktop-webui-launcher/"] },
  { label: "WinForms 控制面板", prefixes: ["gui/", "gui-panel-state"] },
  { label: "审计插件与共享库", prefixes: ["plugins/", "audit-shared/"] },
  { label: "文档与界面资产", prefixes: ["docs/", "project-log-assets/"] },
  { label: "测试", prefixes: ["test/"] },
  { label: "编译、同步与 Lint 内核", exact: ["sync-compile-config.json"], prefixes: ["scripts/", "src/"] },
  { label: "根目录配置", prefixes: [".claude/"] },
];

export function listWorkspaceEntries(projectRoot: string): WorkspaceProjectGroup[] {
  const entries = new Map<string, WorkspaceEntry>();
  for (const entry of readGitStatus(projectRoot)) {
    entries.set(entry.path, entry);
  }
  for (const entry of readGeneratedItems(projectRoot)) {
    entries.set(entry.path, entry);
  }

  const groups = new Map<string, WorkspaceEntry[]>();
  for (const entry of entries.values()) {
    const bucket = groups.get(entry.project) ?? [];
    bucket.push(entry);
    groups.set(entry.project, bucket);
  }

  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], "zh-CN"))
    .map(([name, groupEntries]) => ({
      name,
      entries: groupEntries.sort(compareWorkspaceEntries),
    }));
}

export function listPendingWorkItems(projectRoot: string): PendingWorkItem[] {
  const pendingPath = path.join(projectRoot, "docs", "project-pending.json");
  if (!fs.existsSync(pendingPath)) return [];

  const parsed = JSON.parse(fs.readFileSync(pendingPath, "utf-8")) as PendingWorkItem[];
  return parsed
    .filter((item) => item.id && item.title)
    .sort((left, right) => left.area.localeCompare(right.area, "zh-CN") || left.title.localeCompare(right.title, "zh-CN"));
}

export function deleteWorkspaceEntry(projectRoot: string, relPath: string): void {
  const normalized = path.normalize(relPath).replace(/^(\.\.[/\\])+/, "");
  if (!normalized || normalized === "." || normalized === path.sep) {
    throw new Error("invalid workspace path");
  }

  const full = path.resolve(projectRoot, normalized);
  const relative = path.relative(projectRoot, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("workspace path escapes project root");
  }
  if (!fs.existsSync(full)) {
    throw new Error("workspace path does not exist");
  }

  fs.rmSync(full, { recursive: true, force: true });
}

function readGitStatus(projectRoot: string): WorkspaceEntry[] {
  const output = execFileSync(
    "git",
    ["-C", projectRoot, "status", "--short"],
    { encoding: "utf8" },
  );

  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStatusLine)
    .filter((entry): entry is WorkspaceEntry => entry !== null);
}

function readGeneratedItems(projectRoot: string): WorkspaceEntry[] {
  return GENERATED_ITEMS
    .map((item) => {
      const full = path.join(projectRoot, item.relPath);
      if (!fs.existsSync(full)) return null;
      return {
        path: item.relPath.replace(/\\/g, "/") + (fs.statSync(full).isDirectory() ? "/" : ""),
        status: "\u751f\u6210\u7269",
        project: item.project,
        recommendation: item.recommendation,
        reason: item.reason,
        kind: fs.statSync(full).isDirectory() ? "directory" : "file",
      } satisfies WorkspaceEntry;
    })
    .filter((entry): entry is WorkspaceEntry => entry !== null);
}

function parseStatusLine(line: string): WorkspaceEntry | null {
  const code = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  if (!rawPath) return null;

  const relPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)! : rawPath;
  const normalized = relPath.replace(/\\/g, "/");
  const project = classifyProject(normalized);
  const recommendation = classifyRecommendation(normalized, code);
  return {
    path: normalized,
    status: humanizeStatus(code),
    project,
    recommendation,
    reason: buildReason(normalized, recommendation, code),
    kind: normalized.endsWith("/") ? "directory" : "file",
  };
}

function classifyProject(relPath: string): string {
  if (ROOT_CONFIG_FILES.has(relPath)) {
    return "根目录配置";
  }
  for (const rule of PROJECT_GROUP_RULES) {
    if (matchesProjectGroupRule(relPath, rule)) {
      return rule.label;
    }
  }
  return "其他";
}

function classifyRecommendation(relPath: string, statusCode: string): WorkspaceEntryRecommendation {
  if (relPath === "gui-panel-state.json") return "delete";
  if (relPath.startsWith("wiki-clone/.next/")) return "delete";
  if (statusCode === "??" && (relPath === "log.md" || relPath === "raw_asset_manifest.csv")) {
    return "delete";
  }
  return "keep";
}

function buildReason(
  relPath: string,
  recommendation: WorkspaceEntryRecommendation,
  statusCode: string,
): string {
  if (relPath.startsWith("wiki-clone/.next/")) {
    return "Next.js \u6784\u5efa\u7f13\u5b58\uff0c\u53ea\u662f\u672c\u5730\u751f\u6210\u7269\u3002";
  }
  if (relPath === "gui-panel-state.json") {
    return "\u672c\u5730\u9762\u677f\u72b6\u6001\uff0c\u4e0d\u5f71\u54cd\u6e90\u7801\u3002";
  }
  if (relPath === "raw_asset_manifest.csv") {
    return "\u5f53\u524d\u66f4\u50cf\u5bfc\u51fa / \u8fd0\u884c\u4ea7\u7269\uff0c\u4e0d\u662f\u6838\u5fc3\u6e90\u7801\u3002";
  }
  if (relPath === "log.md") {
    return "\u9879\u76ee\u6839\u76ee\u5f55\u8fd0\u884c\u65e5\u5fd7\uff0c\u901a\u5e38\u4e0d\u9700\u8981\u957f\u671f\u7559\u5728 Git \u5de5\u4f5c\u533a\u3002";
  }
  if (recommendation === "delete") {
    return "\u5efa\u8bae\u5220\u9664\u7684\u672c\u5730\u7559\u5b58\u9879\u3002";
  }
  if (statusCode === "??") {
    return "\u672a\u8ddf\u8e2a\u7684\u9879\u76ee\u6587\u4ef6\uff0c\u66f4\u50cf\u4e00\u6761\u529f\u80fd\u7ebf\u800c\u4e0d\u662f\u7f13\u5b58\u3002";
  }
  return "\u5df2\u8ddf\u8e2a\u7684\u6e90\u7801\u6539\u52a8\uff0c\u901a\u5e38\u4e0d\u5efa\u8bae\u76f4\u63a5\u5220\u6389\u3002";
}

function humanizeStatus(code: string): string {
  if (code === "??") return "\u672a\u8ddf\u8e2a";
  if (code.includes("M")) return "\u5df2\u4fee\u6539";
  if (code.includes("A")) return "\u5df2\u65b0\u589e";
  if (code.includes("D")) return "\u5df2\u5220\u9664";
  if (code.includes("R")) return "\u5df2\u91cd\u547d\u540d";
  return code.trim() || "\u5df2\u53d8\u66f4";
}

function compareWorkspaceEntries(left: WorkspaceEntry, right: WorkspaceEntry): number {
  if (left.recommendation !== right.recommendation) {
    return left.recommendation === "delete" ? -1 : 1;
  }
  return left.path.localeCompare(right.path, "zh-CN");
}

function matchesProjectGroupRule(
  relPath: string,
  rule: { exact?: readonly string[]; prefixes?: readonly string[] },
): boolean {
  return rule.exact?.includes(relPath)
    || rule.prefixes?.some((prefix) => relPath.startsWith(prefix))
    || false;
}
