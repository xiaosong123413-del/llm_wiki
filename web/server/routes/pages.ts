import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { createRenderer, findPage } from "../render/markdown.js";
import {
  resolveContentPath,
  resolveEditableSourceMarkdownPath,
  resolveRuntimeWikiLogicalPath,
  runtimePath,
  sourcePath,
  toLogicalPath,
} from "../runtime-paths.js";
import { deleteWorkspaceEntry, listPendingWorkItems, listWorkspaceEntries } from "../services/project-workspace.js";

interface ClaimRecord {
  id: string;
  conceptSlug: string;
  status: "active" | "contested" | "superseded" | "stale";
  retention: number;
  lastAccessedAt?: string;
}

interface ProcedureRecord {
  id: string;
  supportingClaimIds: string[];
}

interface EpisodeRecord {
  id: string;
  sourceFile: string;
  candidateClaimIds: string[];
}

type WorkspaceDocKind = "root" | "domain" | "project" | "work-log";

interface WorkspaceDocRecord {
  id: string;
  kind: WorkspaceDocKind;
  label: string;
  path: string;
  title: string | null;
  html: string;
  raw: string;
  modifiedAt: string | null;
  domain: string | null;
  project: string | null;
}

interface CachedPagePayload {
  sourceSizeBytes: number;
  sourceMtimeMs: number;
    response: {
      path: string;
      title: string | null;
      frontmatter: Record<string, unknown> | null;
      html: string;
      raw: string;
      sizeBytes: number;
      modifiedAt: string;
      aliases: string[];
      sourceEditable: boolean;
    };
}

interface ChatMessageEntry {
  timestamp: string;
  speaker: string;
  text: string;
  occurrence: number;
  anchor: string;
}

const PAGE_RENDER_CACHE_LIMIT = 24;
const pageRenderCache = new Map<string, CachedPagePayload>();

export interface PagePayload {
  path: string;
  title: string | null;
  frontmatter: Record<string, unknown> | null;
  html: string;
  raw: string;
  sizeBytes: number;
  modifiedAt: string;
  aliases: string[];
  sourceEditable: boolean;
}

export function handlePage(cfg: ServerConfig) {
  const renderer = createRenderer({
    wikilinkResolver: (target) => {
      const resolved = resolveTargetPath(cfg, target);
      if (resolved) {
        return {
          href: `/?page=${encodeURIComponent(resolved.logicalPath)}`,
          exists: true,
        };
      }
      return {
        href: `/?page=${encodeURIComponent(target)}`,
        exists: false,
      };
    },
  });

  return (req: Request, res: Response) => {
    const relRaw = (req.query.path as string | undefined) ?? "";
    const rel = safeRel(relRaw);
    if (!rel) {
      res.status(400).json({ error: "missing or invalid `path` query" });
      return;
    }
    const payload = readPagePayload(cfg, rel, renderer);
    if (!payload) {
      res.status(404).json({ error: "file not found", path: rel });
      return;
    }
    const logicalPath = payload.path;
    touchClaimsForPage(cfg.runtimeRoot, logicalPath);
    res.json(payload);
  };
}

export function readPagePayload(
  cfg: ServerConfig,
  logicalPath: string,
  renderer = createRenderer({
    wikilinkResolver: (target) => {
      const resolved = resolveTargetPath(cfg, target);
      if (resolved) {
        return {
          href: `/?page=${encodeURIComponent(resolved.logicalPath)}`,
          exists: true,
        };
      }
      return {
        href: `/?page=${encodeURIComponent(target)}`,
        exists: false,
      };
    },
  }),
): PagePayload | null {
  const rel = safeRel(logicalPath);
  if (!rel) {
    return null;
  }

  let full = resolveContentPath(cfg, rel);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    full = path.join(full, "index.md");
  }

  if (!/\.(md|markdown|txt)$/i.test(full)) {
    full += ".md";
  }

  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return null;
  }

  const normalizedPath = toLogicalPath(cfg, full);
  if (!normalizedPath) {
    return null;
  }

  const stat = fs.statSync(full);
  return readOrRenderPage(cfg, normalizedPath, full, stat, renderer);
}

function readOrRenderPage(
  cfg: ServerConfig,
  normalizedPath: string,
  fullPath: string,
  stat: fs.Stats,
  renderer: ReturnType<typeof createRenderer>,
): PagePayload {
  const cached = pageRenderCache.get(fullPath);
  if (cached && cached.sourceMtimeMs === stat.mtimeMs && cached.sourceSizeBytes === stat.size) {
    return cached.response;
  }

  const rawMarkdown = fs.readFileSync(fullPath, "utf-8");
  const rendered = renderer.render(rawMarkdown);
  const response = {
    path: normalizedPath,
    title: rendered.title,
    frontmatter: rendered.frontmatter,
    html: decorateWikiHtml(cfg, normalizedPath, rawMarkdown, rendered.html),
    raw: rendered.rawMarkdown,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    aliases: normalizeAliases(rendered.frontmatter),
    sourceEditable: Boolean(resolveEditableSourceMarkdownPath(cfg, normalizedPath)),
  };
  writePageRenderCache(fullPath, {
    sourceMtimeMs: stat.mtimeMs,
    sourceSizeBytes: stat.size,
    response,
  });
  return response;
}

function writePageRenderCache(fullPath: string, payload: CachedPagePayload): void {
  pageRenderCache.delete(fullPath);
  pageRenderCache.set(fullPath, payload);
  while (pageRenderCache.size > PAGE_RENDER_CACHE_LIMIT) {
    const oldestKey = pageRenderCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    pageRenderCache.delete(oldestKey);
  }
}

const CHAT_RECORD_WIKILINK_RE = /\[\[([^\]|#\n]*聊天记录\/[^\]|#\n]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/u;
const EVIDENCE_TIMESTAMP_RE = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]/g;
const CHAT_MESSAGE_ITEM_RE = /<li([^>]*)>\s*<code>(\d{4}-\d{2}-\d{2} \d{2}:\d{2})<\/code>/g;
const CHAT_MESSAGE_ITEM_BRACKET_RE = /<li([^>]*)>\s*\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]/g;
const CHAT_MESSAGE_MARKDOWN_RE = /^\s*[-*+]\s+`(\d{4}-\d{2}-\d{2} \d{2}:\d{2})`\s+\*\*(.+?)\*\*[：:]\s*(.+)$/gmu;
const CHAT_MESSAGE_MARKDOWN_BRACKET_RE = /^\s*[-*+]\s+\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s+(?:\*\*(.+?)\*\*[：:]|([^：:\n]+)[：:])\s*(.+)$/gmu;
const EVIDENCE_LINE_TIMESTAMP_RE = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]/g;

function decorateWikiHtml(cfg: ServerConfig, relPath: string, rawMarkdown: string, html: string): string {
  let nextHtml = html;

  if (relPath.startsWith("wiki/聊天记录/")) {
    const timestampOccurrences = new Map<string, number>();
    nextHtml = nextHtml.replace(CHAT_MESSAGE_ITEM_RE, (match, attrs: string, timestamp: string) => {
      if (/\sid=/.test(attrs)) {
        return match;
      }
      const occurrence = (timestampOccurrences.get(timestamp) ?? 0) + 1;
      timestampOccurrences.set(timestamp, occurrence);
      return `<li${attrs} id="${buildChatMessageAnchor(timestamp, occurrence)}"><code>${timestamp}</code>`;
    });
    nextHtml = nextHtml.replace(CHAT_MESSAGE_ITEM_BRACKET_RE, (match, attrs: string, timestamp: string) => {
      if (/\sid=/.test(attrs)) {
        return match;
      }
      const occurrence = (timestampOccurrences.get(timestamp) ?? 0) + 1;
      timestampOccurrences.set(timestamp, occurrence);
      return `<li${attrs} id="${buildChatMessageAnchor(timestamp, occurrence)}">[${timestamp}]`;
    });
  }

  const chatRecord = resolveTargetPath(cfg, extractChatRecordTarget(rawMarkdown));
  if (!chatRecord) {
    return nextHtml;
  }

  const chatEntries = readChatMessageEntries(chatRecord.fullPath);
  const evidenceAnchors = collectEvidenceAnchors(rawMarkdown, chatEntries);
  let evidenceIndex = 0;
  return nextHtml.replace(EVIDENCE_TIMESTAMP_RE, (_match, timestamp: string) => {
    const anchor = evidenceAnchors[evidenceIndex] ?? buildChatMessageAnchor(timestamp, 1);
    evidenceIndex += 1;
    return `<a href="${buildWikiHashHref(chatRecord.logicalPath, anchor)}" class="wiki-evidence-timestamp" data-chat-message-anchor="${anchor}">[${timestamp}]</a>`;
  });
}

function extractChatRecordTarget(rawMarkdown: string): string {
  const match = CHAT_RECORD_WIKILINK_RE.exec(rawMarkdown);
  return match?.[1]?.trim() ?? "";
}

function readChatMessageEntries(chatFullPath: string): ChatMessageEntry[] {
  if (!fs.existsSync(chatFullPath) || !fs.statSync(chatFullPath).isFile()) {
    return [];
  }
  const chatRawMarkdown = fs.readFileSync(chatFullPath, "utf-8");
  const entries: ChatMessageEntry[] = [];
  const occurrences = new Map<string, number>();
  for (const match of chatRawMarkdown.matchAll(CHAT_MESSAGE_MARKDOWN_RE)) {
    const timestamp = match[1]?.trim() ?? "";
    if (!timestamp) {
      continue;
    }
    const occurrence = (occurrences.get(timestamp) ?? 0) + 1;
    occurrences.set(timestamp, occurrence);
    entries.push({
      timestamp,
      speaker: (match[2] ?? "").trim(),
      text: (match[3] ?? "").trim(),
      occurrence,
      anchor: buildChatMessageAnchor(timestamp, occurrence),
    });
  }
  for (const match of chatRawMarkdown.matchAll(CHAT_MESSAGE_MARKDOWN_BRACKET_RE)) {
    const timestamp = match[1]?.trim() ?? "";
    if (!timestamp) {
      continue;
    }
    const occurrence = (occurrences.get(timestamp) ?? 0) + 1;
    occurrences.set(timestamp, occurrence);
    entries.push({
      timestamp,
      speaker: ((match[2] ?? match[3]) ?? "").trim(),
      text: (match[4] ?? "").trim(),
      occurrence,
      anchor: buildChatMessageAnchor(timestamp, occurrence),
    });
  }
  entries.sort((a, b) => {
    const cmp = a.timestamp.localeCompare(b.timestamp);
    return cmp !== 0 ? cmp : a.occurrence - b.occurrence;
  });
  return entries;
}

function collectEvidenceAnchors(rawMarkdown: string, chatEntries: readonly ChatMessageEntry[]): string[] {
  const anchors: string[] = [];
  const lines = rawMarkdown.split(/\r?\n/);
  for (const line of lines) {
    const matches = Array.from(line.matchAll(EVIDENCE_LINE_TIMESTAMP_RE));
    if (matches.length === 0) {
      continue;
    }
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const timestamp = match[1]?.trim() ?? "";
      if (!timestamp) {
        continue;
      }
      const start = (match.index ?? 0) + match[0].length;
      const end = index + 1 < matches.length
        ? matches[index + 1]?.index ?? line.length
        : line.length;
      const snippet = line.slice(start, end).trim();
      anchors.push(resolveEvidenceAnchor(chatEntries, timestamp, snippet));
    }
  }
  return anchors;
}

function resolveEvidenceAnchor(
  chatEntries: readonly ChatMessageEntry[],
  timestamp: string,
  snippet: string,
): string {
  const matches = chatEntries.filter((entry) => entry.timestamp === timestamp);
  if (matches.length === 0) {
    return buildChatMessageAnchor(timestamp, 1);
  }
  const parsedSnippet = parseEvidenceSnippet(snippet);
  if (!parsedSnippet) {
    return matches[0].anchor;
  }

  const exactSpeakerAndText = matches.find((entry) =>
    parsedSnippet.speaker !== null
      && normalizeComparable(entry.speaker) === parsedSnippet.speaker
      && normalizeComparable(entry.text).startsWith(parsedSnippet.text),
  );
  if (exactSpeakerAndText) {
    return exactSpeakerAndText.anchor;
  }

  const exactText = matches.find((entry) => normalizeComparable(entry.text).startsWith(parsedSnippet.text));
  if (exactText) {
    return exactText.anchor;
  }

  return matches[0].anchor;
}

function parseEvidenceSnippet(snippet: string): { speaker: string | null; text: string } | null {
  const normalizedSnippet = snippet
    .replace(/^[：:;；，,\s-]+/u, "")
    .trim();
  if (!normalizedSnippet) {
    return null;
  }
  const speakerMatch = /^([^:：]+)[:：]\s*(.+)$/u.exec(normalizedSnippet);
  if (speakerMatch) {
    return {
      speaker: normalizeComparable(speakerMatch[1] ?? ""),
      text: normalizeComparable(speakerMatch[2] ?? ""),
    };
  }
  return {
    speaker: null,
    text: normalizeComparable(normalizedSnippet),
  };
}

function normalizeComparable(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[：]/g, ":")
    .trim()
    .toLowerCase();
}

function buildChatMessageAnchor(timestamp: string, occurrence: number): string {
  const base = `msg-${timestamp.replace(/[:\s]/g, "-")}`;
  return occurrence > 1 ? `${base}-${occurrence}` : base;
}

function buildWikiHashHref(pagePath: string, anchor: string): string {
  return `#/wiki/${encodeURIComponent(pagePath)}#${encodeURIComponent(anchor)}`;
}

function touchClaimsForPage(wikiRoot: string, relPath: string): void {
  const normalized = relPath.replace(/\\/g, "/");
  const claimsPath = path.join(wikiRoot, ".llmwiki", "claims.json");
  if (!fs.existsSync(claimsPath)) return;

  const touchedClaimIds = resolveTouchedClaimIds(wikiRoot, normalized);
  if (touchedClaimIds.size === 0) return;

  let claims: ClaimRecord[];
  try {
    claims = JSON.parse(fs.readFileSync(claimsPath, "utf-8")) as ClaimRecord[];
  } catch {
    return;
  }

  const now = new Date().toISOString();
  let changed = false;
  for (const claim of claims) {
    if (!touchedClaimIds.has(claim.id)) continue;
    claim.lastAccessedAt = now;
    claim.retention = 1;
    if (claim.status === "stale") {
      claim.status = "active";
    }
    changed = true;
  }

  if (!changed) return;
  fs.writeFileSync(claimsPath, `${JSON.stringify(claims, null, 2)}\n`, "utf-8");
}

function resolveTouchedClaimIds(wikiRoot: string, relPath: string): Set<string> {
  const claimIds = new Set<string>();

  if (relPath.startsWith("wiki/concepts/")) {
    const slug = relPath.replace(/^wiki\/concepts\//, "").replace(/\.md$/i, "");
    const claims = readJsonFile<ClaimRecord[]>(path.join(wikiRoot, ".llmwiki", "claims.json"), []);
    for (const claim of claims) {
      if (claim.conceptSlug === slug) {
        claimIds.add(claim.id);
      }
    }
    return claimIds;
  }

  if (relPath.startsWith("wiki/procedures/")) {
    const procedureId = relPath.replace(/^wiki\/procedures\//, "").replace(/\.md$/i, "");
    const procedures = readJsonFile<ProcedureRecord[]>(path.join(wikiRoot, ".llmwiki", "procedures.json"), []);
    const procedure = procedures.find((item) => item.id === procedureId);
    for (const claimId of procedure?.supportingClaimIds ?? []) {
      claimIds.add(claimId);
    }
    return claimIds;
  }

  if (relPath.startsWith("wiki/episodes/")) {
    const episodeSlug = relPath.replace(/^wiki\/episodes\//, "").replace(/\.md$/i, "");
    const episodes = readJsonFile<EpisodeRecord[]>(path.join(wikiRoot, ".llmwiki", "episodes.json"), []);
    const episode = episodes.find((item) => slugifyEpisodeFile(item.sourceFile) === episodeSlug);
    for (const claimId of episode?.candidateClaimIds ?? []) {
      claimIds.add(claimId);
    }
  }

  return claimIds;
}

function slugifyEpisodeFile(sourceFile: string): string {
  return sourceFile
    .toLowerCase()
    .replace(/\.(md|markdown|txt)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function handleRaw(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const relRaw = (req.query.path as string | undefined) ?? "";
    const rel = safeRel(relRaw);
    if (!rel) {
      res.status(400).send("bad path");
      return;
    }
    const full = resolveContentPath(cfg, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      res.status(404).send("not found");
      return;
    }
    res.type("text/markdown").send(fs.readFileSync(full));
  };
}

export function handleActivityLog(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    const preferred = sourcePath(cfg, "log.md");
    const fallback = path.join(cfg.projectRoot, "log.md");
    const selected = fs.existsSync(preferred) ? preferred : fallback;

    if (!fs.existsSync(selected) || !fs.statSync(selected).isFile()) {
      res.json({
        path: selected,
        content: "",
      });
      return;
    }

    res.json({
      path: selected,
      content: fs.readFileSync(selected, "utf-8"),
    });
  };
}

export function handleProjectLog(cfg: ServerConfig) {
  const renderer = createRenderer({ pageLookupRoot: cfg.projectRoot });

  return (_req: Request, res: Response) => {
    const full = path.join(cfg.projectRoot, "docs", "project-log.md");
    const relFromRoot = path.relative(cfg.projectRoot, full);

    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      res.json({
        success: true,
        data: {
          path: relFromRoot.split(path.sep).join("/"),
          html: "<p>Project log has not been created yet.</p>",
          raw: "",
          modifiedAt: null,
        },
      });
      return;
    }

    const raw = fs.readFileSync(full, "utf-8");
    const rendered = renderer.render(raw);
    const stat = fs.statSync(full);
    res.json({
      success: true,
      data: {
        path: relFromRoot.split(path.sep).join("/"),
        html: rendered.html,
        raw,
        modifiedAt: stat.mtime.toISOString(),
      },
    });
  };
}

export function handleProjectWorkspace(cfg: ServerConfig) {
  return (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          groups: listWorkspaceEntries(cfg.projectRoot),
          pending: listPendingWorkItems(cfg.projectRoot),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function handleProjectWorkspaceDelete(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    const relPath = typeof req.body?.path === "string" ? req.body.path : "";
    if (!relPath) {
      res.status(400).json({ success: false, error: "missing workspace path" });
      return;
    }

    try {
      deleteWorkspaceEntry(cfg.projectRoot, relPath);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function handleWorkspaceDocs(cfg: ServerConfig) {
  const renderer = createRenderer({ pageLookupRoot: cfg.projectRoot });

  return (_req: Request, res: Response) => {
    try {
      ensureWorkspaceDocScaffold(cfg.projectRoot);
      res.json({
        success: true,
        data: {
          documents: listWorkspaceDocs(cfg.projectRoot, renderer),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function handleWorkspaceDocsSave(cfg: ServerConfig) {
  return (req: Request, res: Response) => {
    try {
      const rawPath = String(req.body?.path ?? "").trim();
      const raw = String(req.body?.raw ?? "");
      const relativePath = safeWorkspaceDocPath(rawPath);
      if (!relativePath) {
        res.status(400).json({ success: false, error: "invalid workspace document path" });
        return;
      }

      const fullPath = path.join(cfg.projectRoot, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, raw.endsWith("\n") ? raw : `${raw}\n`, "utf-8");
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

function safeRel(input: string): string | null {
  if (!input) return "wiki/index.md";
  // Reject absolute and ..
  if (path.isAbsolute(input)) return null;
  const normalized = path.posix.normalize(input);
  if (normalized.startsWith("..")) return null;
  return normalized;
}

function resolveTargetPath(
  cfg: ServerConfig,
  target: string,
): { logicalPath: string; fullPath: string } | null {
  const normalizedTarget = target.trim();
  if (!normalizedTarget) {
    return null;
  }

  const runtimeWikiPath = resolveRuntimeWikiLogicalPath(normalizedTarget);
  if (runtimeWikiPath) {
    const fullPath = runtimePath(cfg, runtimeWikiPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return { logicalPath: runtimeWikiPath, fullPath };
    }
  }

  for (const root of [cfg.sourceVaultRoot, cfg.runtimeRoot]) {
    const fullPath = findPage(root, normalizedTarget);
    if (!fullPath) {
      continue;
    }
    const logicalPath = toLogicalPath(cfg, fullPath);
    if (logicalPath) {
      return { logicalPath, fullPath };
    }
  }

  return null;
}

function normalizeAliases(frontmatter: Record<string, unknown> | null): string[] {
  const aliases = frontmatter?.aliases;
  if (typeof aliases === "string" && aliases.trim()) {
    return [aliases.trim()];
  }
  if (Array.isArray(aliases)) {
    return aliases.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  }
  return [];
}

function safeWorkspaceDocPath(input: string): string | null {
  if (!input) return null;
  if (path.isAbsolute(input)) return null;
  const normalized = path.posix.normalize(input);
  if (normalized.startsWith("..")) return null;
  const allowed = normalized === "领域.md" || normalized.startsWith("领域/");
  if (!allowed || !normalized.endsWith(".md")) {
    return null;
  }
  return normalized;
}

function ensureWorkspaceDocScaffold(projectRoot: string): void {
  const rootDoc = path.join(projectRoot, "领域.md");
  const domainDir = path.join(projectRoot, "领域");
  const domainDoc = path.join(domainDir, "产品.md");
  const projectDir = path.join(domainDir, "产品");
  const projectDoc = path.join(projectDir, "LLM Wiki WebUI.md");
  const workLogDir = path.join(projectDir, "LLM Wiki WebUI");
  const workLogDoc = path.join(workLogDir, "工作日志.md");

  ensureFile(rootDoc, `# 领域

- 产品：沉淀当前产品线与项目推进脉络。
`);
  fs.mkdirSync(domainDir, { recursive: true });
  ensureFile(domainDoc, `# 产品

## 当前关注

- LLM Wiki WebUI

## 说明

这个领域用来沉淀产品方向下的项目文档和工作日志。
`);
  fs.mkdirSync(projectDir, { recursive: true });
  ensureFile(projectDoc, `# LLM Wiki WebUI

## 项目定位

持续迭代个人知识 Wiki 的 WebUI、工作台和剪藏能力。

## 当前主线

- 工作台结构收口
- 多层文档组织方式
- 项目内工作日志沉淀
`);
  fs.mkdirSync(workLogDir, { recursive: true });
  ensureFile(workLogDoc, `# 工作日志

## 2026-04-23

- 初始化领域 / 项目 / 工作日志四层文档结构
- 准备把工作台里的工作日志切换成真实文档视图
`);
}

function ensureFile(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function listWorkspaceDocs(
  projectRoot: string,
  renderer: ReturnType<typeof createRenderer>,
): WorkspaceDocRecord[] {
  const documents: WorkspaceDocRecord[] = [];

  pushWorkspaceDoc(documents, renderer, {
    id: "root",
    kind: "root",
    label: "领域",
    filePath: path.join(projectRoot, "领域.md"),
    relPath: "领域.md",
    domain: null,
    project: null,
  });

  const domainRoot = path.join(projectRoot, "领域");
  if (!fs.existsSync(domainRoot) || !fs.statSync(domainRoot).isDirectory()) {
    return documents;
  }

  const domainNames = collectNames(domainRoot);
  for (const domain of domainNames) {
    pushWorkspaceDoc(documents, renderer, {
      id: `domain:${domain}`,
      kind: "domain",
      label: domain,
      filePath: path.join(domainRoot, `${domain}.md`),
      relPath: `领域/${domain}.md`,
      domain,
      project: null,
    });

    const projectDir = path.join(domainRoot, domain);
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
      continue;
    }

    const projectNames = collectNames(projectDir);
    for (const project of projectNames) {
      pushWorkspaceDoc(documents, renderer, {
        id: `project:${domain}/${project}`,
        kind: "project",
        label: project,
        filePath: path.join(projectDir, `${project}.md`),
        relPath: `领域/${domain}/${project}.md`,
        domain,
        project,
      });
      pushWorkspaceDoc(documents, renderer, {
        id: `work-log:${domain}/${project}`,
        kind: "work-log",
        label: "工作日志",
        filePath: path.join(projectDir, project, "工作日志.md"),
        relPath: `领域/${domain}/${project}/工作日志.md`,
        domain,
        project,
      });
    }
  }

  return documents;
}

function collectNames(dir: string): string[] {
  const names = new Set<string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      names.add(entry.name.replace(/\.md$/i, ""));
    }
    if (entry.isDirectory()) {
      names.add(entry.name);
    }
  }
  return Array.from(names).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

function pushWorkspaceDoc(
  documents: WorkspaceDocRecord[],
  renderer: ReturnType<typeof createRenderer>,
  input: {
    id: string;
    kind: WorkspaceDocKind;
    label: string;
    filePath: string;
    relPath: string;
    domain: string | null;
    project: string | null;
  },
): void {
  if (!fs.existsSync(input.filePath) || !fs.statSync(input.filePath).isFile()) {
    return;
  }

  const raw = fs.readFileSync(input.filePath, "utf-8");
  const rendered = renderer.render(raw);
  const stat = fs.statSync(input.filePath);
  documents.push({
    id: input.id,
    kind: input.kind,
    label: input.label,
    path: input.relPath,
    title: rendered.title,
    html: rendered.html,
    raw,
    modifiedAt: stat.mtime.toISOString(),
    domain: input.domain,
    project: input.project,
  });
}
