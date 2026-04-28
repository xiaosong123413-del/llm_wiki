import fs from "node:fs";
import path from "node:path";

interface GuidedIngestInput {
  sourcePath: string;
  conversationNotes: string[];
}

interface GuidedIngestResult {
  createdPage: string;
  archivedSource: string;
}

interface GuidedConversation {
  title: string;
  articleRefs: string[];
  messages: Array<{ role: string; content: string }>;
}

const COMPLETED_INBOX_DIR = "_\u5df2\u5f55\u5165";

export function detectGuidedIngestRequest(content: string): boolean {
  return /(\u53ef\u4ee5|\u786e\u8ba4|\u5f00\u59cb|\u73b0\u5728).{0,8}\u5f55\u5165/.test(content);
}

export function completeGuidedIngest(wikiRoot: string, input: GuidedIngestInput): GuidedIngestResult {
  const sourceFullPath = resolveInboxSource(wikiRoot, input.sourcePath);
  const raw = fs.readFileSync(sourceFullPath, "utf8");
  const title = extractTitle(raw, path.basename(sourceFullPath, path.extname(sourceFullPath)));
  const createdPage = path.posix.join("wiki", "inbox", `${sanitizeFilename(title)}.md`);
  const targetFullPath = path.join(wikiRoot, ...createdPage.split("/"));

  fs.mkdirSync(path.dirname(targetFullPath), { recursive: true });
  fs.writeFileSync(targetFullPath, buildSummaryPage(title, input.sourcePath, input.conversationNotes, raw), "utf8");
  const archivedSource = archiveInboxSource(wikiRoot, sourceFullPath);
  appendGuidedLog(wikiRoot, title, createdPage);

  return { createdPage, archivedSource };
}

export function completeGuidedIngestFromConversation(
  wikiRoot: string,
  conversation: GuidedConversation,
): GuidedIngestResult | null {
  const latestUser = [...conversation.messages].reverse().find((message) => message.role === "user");
  if (!latestUser || !detectGuidedIngestRequest(latestUser.content)) return null;
  const sourcePath = conversation.articleRefs.find((ref) => ref.startsWith("inbox/"));
  if (!sourcePath) return null;
  return completeGuidedIngest(wikiRoot, {
    sourcePath,
    conversationNotes: collectConversationNotes(conversation),
  });
}

function resolveInboxSource(wikiRoot: string, sourcePath: string): string {
  const fullPath = path.resolve(wikiRoot, sourcePath);
  const inboxRoot = path.resolve(wikiRoot, "inbox");
  if (!fullPath.startsWith(inboxRoot) || fullPath.includes(`${path.sep}${COMPLETED_INBOX_DIR}${path.sep}`)) {
    throw new Error("sourcePath must point to an active inbox file");
  }
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error("inbox source not found");
  }
  return fullPath;
}

function buildSummaryPage(title: string, sourcePath: string, notes: string[], raw: string): string {
  return [
    "---",
    `title: ${title}`,
    "status: guided-draft",
    `source: ${sourcePath.replace(/\\/g, "/")}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## \u6307\u5bfc\u8981\u70b9",
    "",
    notes.length > 0 ? notes.map((note) => `- ${note}`).join("\n") : "- \u5c1a\u672a\u8bb0\u5f55\u989d\u5916\u6307\u5bfc\u8981\u70b9\u3002",
    "",
    "## \u539f\u6587",
    "",
    raw.trim(),
    "",
  ].join("\n");
}

function archiveInboxSource(wikiRoot: string, sourceFullPath: string): string {
  const inboxRoot = path.join(wikiRoot, "inbox");
  const relative = path.relative(inboxRoot, sourceFullPath);
  const target = path.join(inboxRoot, COMPLETED_INBOX_DIR, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(sourceFullPath, target);
  return path.relative(wikiRoot, target).replace(/\\/g, "/");
}

function appendGuidedLog(wikiRoot: string, title: string, createdPage: string): void {
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n## [${date}] guided-ingest | ${title}\n\n- created: ${createdPage}\n`;
  fs.appendFileSync(path.join(wikiRoot, "log.md"), entry, "utf8");
}

function collectConversationNotes(conversation: GuidedConversation): string[] {
  return conversation.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => content && !detectGuidedIngestRequest(content))
    .slice(-6);
}

function extractTitle(content: string, fallback: string): string {
  return (content.match(/^#\s+(.+)$/m)?.[1] ?? fallback).trim();
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "-").trim() || "untitled";
}
