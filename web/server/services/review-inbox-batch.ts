import fs from "node:fs";
import path from "node:path";

interface ReviewInboxBatchQueueItem {
  target: string;
  queuedAt: string;
}

interface ReviewInboxBatchQueueFile {
  updatedAt: string;
  items: ReviewInboxBatchQueueItem[];
}

const COMPLETED_INBOX_DIR = "_已录入";
const REVIEW_INBOX_BATCH_QUEUE_PATH = ".llmwiki/review-inbox-batch-ingest.json";

export async function queueReviewInboxBatchIngest(
  sourceVaultRoot: string,
  runtimeRoot: string,
  targets: readonly string[],
): Promise<{ path: string; queued: number; skipped: number }> {
  const queuePath = path.join(runtimeRoot, REVIEW_INBOX_BATCH_QUEUE_PATH);
  const existing = readQueue(queuePath);
  const now = new Date().toISOString();
  const nextItems = new Map(existing.items.map((item) => [item.target, item] as const));
  let queued = 0;
  let skipped = 0;

  for (const target of targets) {
    const normalized = normalizeInboxTarget(sourceVaultRoot, target);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    nextItems.set(normalized, {
      target: normalized,
      queuedAt: now,
    });
    queued += 1;
  }

  const payload: ReviewInboxBatchQueueFile = {
    updatedAt: now,
    items: [...nextItems.values()].sort((left, right) => right.queuedAt.localeCompare(left.queuedAt)),
  };
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  fs.writeFileSync(queuePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    path: REVIEW_INBOX_BATCH_QUEUE_PATH,
    queued,
    skipped,
  };
}

function normalizeInboxTarget(wikiRoot: string, target: string): string | null {
  const normalized = target.replace(/\\/g, "/").trim();
  if (!normalized || !normalized.startsWith("inbox/")) {
    return null;
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.includes(COMPLETED_INBOX_DIR)) {
    return null;
  }
  const fullPath = path.resolve(wikiRoot, normalized);
  const inboxRoot = path.resolve(wikiRoot, "inbox");
  if (!fullPath.startsWith(inboxRoot)) {
    return null;
  }
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return null;
  }
  return path.posix.normalize(normalized);
}

function readQueue(queuePath: string): ReviewInboxBatchQueueFile {
  if (!fs.existsSync(queuePath)) {
    return { updatedAt: "", items: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(queuePath, "utf8")) as ReviewInboxBatchQueueFile;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      items: Array.isArray(parsed.items)
        ? parsed.items.filter(isQueueItem)
        : [],
    };
  } catch {
    return { updatedAt: "", items: [] };
  }
}

function isQueueItem(value: unknown): value is ReviewInboxBatchQueueItem {
  return typeof value === "object"
    && value !== null
    && typeof (value as ReviewInboxBatchQueueItem).target === "string"
    && typeof (value as ReviewInboxBatchQueueItem).queuedAt === "string";
}
