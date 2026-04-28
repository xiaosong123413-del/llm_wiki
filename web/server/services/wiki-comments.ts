import fs from "node:fs";
import path from "node:path";

interface WikiCommentRecord {
  id: string;
  path: string;
  quote: string;
  text: string;
  start: number;
  end: number;
  resolved: boolean;
  createdAt: string;
}

interface WikiCommentsStore {
  commentsByPath: Record<string, WikiCommentRecord[]>;
}

const STORE_DIR = ".llmwiki";
const STORE_FILE = "wiki-comments.json";

export function listWikiComments(runtimeRoot: string, pagePath: string): WikiCommentRecord[] {
  const store = readStore(runtimeRoot);
  return [...(store.commentsByPath[pagePath] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createWikiComment(
  runtimeRoot: string,
  input: Omit<WikiCommentRecord, "id" | "resolved" | "createdAt"> & { text?: string },
  now: Date = new Date(),
): WikiCommentRecord {
  const store = readStore(runtimeRoot);
  const next: WikiCommentRecord = {
    id: `comment-${now.getTime()}-${Math.random().toString(16).slice(2, 10)}`,
    path: input.path,
    quote: input.quote,
    text: input.text ?? "",
    start: input.start,
    end: input.end,
    resolved: false,
    createdAt: now.toISOString(),
  };
  const list = store.commentsByPath[input.path] ?? [];
  list.push(next);
  store.commentsByPath[input.path] = list;
  writeStore(runtimeRoot, store);
  return next;
}

export function updateWikiComment(
  runtimeRoot: string,
  pagePath: string,
  id: string,
  patch: { text?: string; resolved?: boolean },
): WikiCommentRecord | null {
  const store = readStore(runtimeRoot);
  const comments = store.commentsByPath[pagePath] ?? [];
  const comment = comments.find((item) => item.id === id) ?? null;
  if (!comment) {
    return null;
  }
  if (typeof patch.text === "string") {
    comment.text = patch.text;
  }
  if (typeof patch.resolved === "boolean") {
    comment.resolved = patch.resolved;
  }
  writeStore(runtimeRoot, store);
  return comment;
}

export function deleteWikiComment(runtimeRoot: string, pagePath: string, id: string): boolean {
  const store = readStore(runtimeRoot);
  const comments = store.commentsByPath[pagePath] ?? [];
  const next = comments.filter((item) => item.id !== id);
  if (next.length === comments.length) {
    return false;
  }
  if (next.length === 0) {
    delete store.commentsByPath[pagePath];
  } else {
    store.commentsByPath[pagePath] = next;
  }
  writeStore(runtimeRoot, store);
  return true;
}

export function findWikiCommentById(runtimeRoot: string, id: string): WikiCommentRecord | null {
  const store = readStore(runtimeRoot);
  for (const entries of Object.values(store.commentsByPath)) {
    const match = entries.find((item) => item.id === id);
    if (match) {
      return match;
    }
  }
  return null;
}

function readStore(runtimeRoot: string): WikiCommentsStore {
  const file = storePath(runtimeRoot);
  if (!fs.existsSync(file)) {
    return { commentsByPath: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { commentsByPath: {} };
    }
    const commentsByPath = (parsed as { commentsByPath?: unknown }).commentsByPath;
    if (!commentsByPath || typeof commentsByPath !== "object") {
      return { commentsByPath: {} };
    }
    const normalized: Record<string, WikiCommentRecord[]> = {};
    for (const [pagePath, entries] of Object.entries(commentsByPath as Record<string, unknown>)) {
      if (!Array.isArray(entries)) {
        continue;
      }
      normalized[pagePath] = entries.flatMap(normalizeComment);
    }
    return { commentsByPath: normalized };
  } catch {
    return { commentsByPath: {} };
  }
}

function normalizeComment(entry: unknown): WikiCommentRecord[] {
  if (!isWikiCommentRecord(entry)) {
    return [];
  }
  return [entry];
}

function isWikiCommentRecord(entry: unknown): entry is WikiCommentRecord {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const candidate = entry as Partial<WikiCommentRecord>;
  return [
    isString(candidate.id),
    isString(candidate.path),
    isString(candidate.quote),
    isString(candidate.text),
    isNumber(candidate.start),
    isNumber(candidate.end),
    typeof candidate.resolved === "boolean",
    isString(candidate.createdAt),
  ].every(Boolean);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function writeStore(runtimeRoot: string, store: WikiCommentsStore): void {
  const file = storePath(runtimeRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2), "utf8");
}

function storePath(runtimeRoot: string): string {
  return path.join(runtimeRoot, STORE_DIR, STORE_FILE);
}
