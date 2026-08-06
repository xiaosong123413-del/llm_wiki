/**
 * Source summary page generation for the compiler pipeline.
 *
 * Each source gets a stable `wiki/summaries/*.md` page before concept
 * extraction. The summary becomes the durable cross-document source reference
 * used by concept pages and Obsidian backlinks.
 */

import path from "path";
import { callClaude } from "../utils/llm.js";
import {
  atomicWrite,
  buildFrontmatter,
  parseFrontmatter,
  safeReadFile,
} from "../utils/markdown.js";
import { SUMMARIES_DIR } from "../utils/constants.js";

interface SourceSummary {
  brief: string;
  content: string;
}

interface SourceSummaryPage {
  brief: string;
  markdown: string;
  wikiPath: string;
  linkTarget: string;
}

export async function writeSourceSummaryPage(
  root: string,
  sourceFile: string,
  sourceContent: string,
): Promise<SourceSummaryPage> {
  const summary = await generateSourceSummary(root, sourceContent);
  const summaryFile = summaryFileName(sourceFile);
  const wikiPath = path.posix.join("summaries", summaryFile);
  const linkTarget = wikiPath.replace(/\.md$/, "");
  const now = new Date().toISOString();
  const fullPage = [
    buildFrontmatter({
      title: titleFromSourceFile(sourceFile),
      brief: summary.brief,
      source: sourceFile,
      createdAt: now,
      updatedAt: now,
    }),
    "",
    summary.content.trim(),
    "",
  ].join("\n");

  await atomicWrite(path.join(root, SUMMARIES_DIR, summaryFile), fullPage);
  return { brief: summary.brief, markdown: fullPage, wikiPath, linkTarget };
}

export async function addSummaryConceptLinks(
  root: string,
  summaryLinkTarget: string,
  conceptLinkTargets: readonly string[],
): Promise<void> {
  const summaryFile = `${path.posix.basename(summaryLinkTarget)}.md`;
  const summaryPath = path.join(root, SUMMARIES_DIR, summaryFile);
  const current = await safeReadFile(summaryPath);
  if (!current) return;

  const { meta, body } = parseFrontmatter(current);
  const cleanedBody = removeSection(body, "Related concepts").trimEnd();
  const links = conceptLinkTargets.map((target) => `- [[${target}]]`);
  const next = [
    buildFrontmatter({ ...meta, updatedAt: new Date().toISOString() }),
    "",
    cleanedBody,
    "",
    "## Related concepts",
    "",
    ...links,
    "",
  ].join("\n");

  await atomicWrite(summaryPath, next);
}

function summaryFileName(sourceFile: string): string {
  return `${path.basename(sourceFile, path.extname(sourceFile))}.md`;
}

function titleFromSourceFile(sourceFile: string): string {
  return path.basename(sourceFile, path.extname(sourceFile)).replace(/[-_]+/g, " ");
}

async function generateSourceSummary(root: string, sourceContent: string): Promise<SourceSummary> {
  const schema = await safeReadFile(path.join(root, "wiki", "schema.md"));
  const raw = await callClaude({
    system: buildSummaryPrompt(schema, sourceContent),
    messages: [{ role: "user", content: "Generate the source summary JSON." }],
    maxTokens: 4096,
  });

  return parseSourceSummary(raw);
}

function buildSummaryPrompt(schema: string, sourceContent: string): string {
  const schemaSection = schema.trim()
    ? `Wiki schema:\n\n${schema.trim()}`
    : "Wiki schema: use concise Chinese Markdown with factual sections.";

  return [
    "You create durable source summary pages for an Obsidian-style knowledge wiki.",
    "Return only valid JSON with this exact shape:",
    '{"brief":"one sentence summary","content":"complete Markdown summary"}',
    "Write in Chinese unless the source requires quoted terms in another language.",
    "Do not invent facts. Preserve concrete names, dates, decisions, and findings.",
    schemaSection,
    "--- SOURCE DOCUMENT ---",
    sourceContent,
  ].join("\n\n");
}

function parseSourceSummary(raw: string): SourceSummary {
  const parsed = parseJsonObject(raw);
  const brief = typeof parsed.brief === "string" ? parsed.brief.trim() : "";
  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  return {
    brief: brief || "No brief generated.",
    content: content || "No summary content generated.",
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function removeSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`\\n?## ${escapeRegExp(heading)}\\n[\\s\\S]*?(?=\\n## |$)`, "g");
  return markdown.replace(pattern, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
