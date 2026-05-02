/**
 * Concept page generation.
 *
 * Owns the LLM page-writing prompt, frontmatter preservation, related-page
 * context loading, image attachment, validation, and final atomic write.
 */

import { readdir } from "fs/promises";
import path from "path";
import { callClaude } from "../utils/llm.js";
import {
  atomicWrite,
  buildFrontmatter,
  parseFrontmatter,
  safeReadFile,
  validateWikiPage,
} from "../utils/markdown.js";
import { CONCEPTS_DIR } from "../utils/constants.js";
import { attachGeneratedWikiSideImage, toWikiLogicalPath } from "../utils/wiki-side-image.js";
import { addObsidianMeta } from "./obsidian.js";
import { buildPagePrompt } from "./prompts.js";
import { renderClaimSections } from "./claim-sections.js";
import * as output from "../utils/output.js";
import type { ClaimRecord, ExtractedConcept } from "../utils/types.js";

export interface MergedConcept {
  slug: string;
  concept: ExtractedConcept;
  summaryLinks: string[];
  combinedContent: string;
}

export async function generateMergedPage(
  root: string,
  entry: MergedConcept,
  claims: ClaimRecord[],
): Promise<void> {
  const pagePath = path.join(root, CONCEPTS_DIR, `${entry.slug}.md`);
  const existingPage = await safeReadFile(pagePath);
  const relatedPages = await loadRelatedPages(root, entry.slug);
  const conceptClaims = claims.filter((claim) => claim.conceptSlug === entry.slug);
  const system = buildPagePrompt(
    entry.concept.concept,
    entry.combinedContent,
    existingPage,
    relatedPages,
  );
  const pageBody = await callClaude({
    system,
    messages: [{ role: "user", content: `请为“${entry.concept.concept}”写一篇中文 wiki 页面。` }],
  });
  const fullPage = buildConceptPage(entry, existingPage, pageBody, conceptClaims);
  const pageWithImage = !existingPage && validateWikiPage(fullPage)
    ? (await attachGeneratedWikiSideImage(root, toWikiLogicalPath(root, pagePath), fullPage)).content
    : fullPage;

  await writePageIfValid(pagePath, pageWithImage, entry.concept.concept);
}

function buildConceptPage(
  entry: MergedConcept,
  existingPage: string,
  pageBody: string,
  claims: ClaimRecord[],
): string {
  const now = new Date().toISOString();
  const existing = existingPage ? parseFrontmatter(existingPage) : null;
  const createdAt = typeof existing?.meta.createdAt === "string" ? existing.meta.createdAt : now;
  const frontmatterFields: Record<string, unknown> = {
    title: entry.concept.concept,
    summary: entry.concept.summary,
    brief: entry.concept.summary,
    sources: entry.summaryLinks.map((link) => `${link}.md`),
    createdAt,
    updatedAt: now,
  };
  addObsidianMeta(frontmatterFields, entry.concept.concept, entry.concept.tags ?? []);

  return [
    buildFrontmatter(frontmatterFields),
    "",
    pageBody.trim(),
    "",
    renderClaimSections(claims, entry.summaryLinks),
    "",
  ].join("\n");
}

async function loadRelatedPages(root: string, excludeSlug: string): Promise<string> {
  let files: string[];
  try {
    files = await readdir(path.join(root, CONCEPTS_DIR));
  } catch {
    return "";
  }

  const contents: string[] = [];
  for (const file of files.filter((name) => isRelatedConceptFile(name, excludeSlug)).slice(0, 5)) {
    const content = await safeReadFile(path.join(root, CONCEPTS_DIR, file));
    const { meta } = parseFrontmatter(content);
    if (!content || meta.orphaned) continue;
    contents.push(content);
  }

  return contents.join("\n\n---\n\n");
}

function isRelatedConceptFile(file: string, excludeSlug: string): boolean {
  return file.endsWith(".md") && file !== `${excludeSlug}.md`;
}

async function writePageIfValid(pagePath: string, content: string, conceptTitle: string): Promise<void> {
  if (!validateWikiPage(content)) {
    output.status("!", output.warn(`Invalid page for "${conceptTitle}" - skipped.`));
    return;
  }

  await atomicWrite(pagePath, content);
}
