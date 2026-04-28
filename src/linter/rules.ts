/**
 * Lint rules for wiki quality checks.
 *
 * Each rule is a function that takes a project root path and returns
 * an array of LintResult diagnostics. Rules perform pure static analysis
 * with no LLM calls - they inspect frontmatter, wikilinks, citations,
 * and file structure to find potential issues.
 */

import { existsSync, readdirSync } from "fs";
import path from "path";
import { parseFrontmatter, slugify } from "../utils/markdown.js";
import { SOURCES_DIR, SOURCES_FULL_DIR } from "../utils/constants.js";
import type { LintResult } from "./types.js";
import { buildPageSlugSet, collectAllPages, normalizeWikilinkTarget } from "./wiki-page-index.js";

const MIN_BODY_LENGTH = 50;
const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;
const CITATION_PATTERN = /\^\[([^\]]+)\]/g;

interface LineMatch {
  captured: string;
  line: number;
}

interface CitationSourceIndex {
  fileNames: Set<string>;
  hashes: Map<string, string[]>;
}

function findMatchesInContent(content: string, pattern: RegExp): LineMatch[] {
  const results: LineMatch[] = [];
  const lines = content.split("\n");
  let activeFence: "`" | "~" | null = null;
  for (let i = 0; i < lines.length; i++) {
    const fenceMarker = readFenceMarker(lines[i]);
    if (activeFence) {
      if (fenceMarker === activeFence) {
        activeFence = null;
      }
      continue;
    }
    if (fenceMarker) {
      activeFence = fenceMarker;
      continue;
    }

    const matches = lines[i].matchAll(pattern);
    for (const match of matches) {
      results.push({ captured: match[1], line: i + 1 });
    }
  }
  return results;
}

function readFenceMarker(line: string): "`" | "~" | null {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("```")) {
    return "`";
  }
  if (trimmed.startsWith("~~~")) {
    return "~";
  }
  return null;
}

function extractTrailingHash(fileName: string): string | null {
  const match = fileName.match(/(?:__)?([a-f0-9]{8,32})\.md$/i);
  return match ? match[1].toLowerCase() : null;
}

function expandCitationParts(captured: string): string[] {
  return captured
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function buildCitationSourceIndex(root: string): CitationSourceIndex {
  const fileNames = new Set<string>();
  const hashes = new Map<string, string[]>();

  for (const dir of [SOURCES_DIR, SOURCES_FULL_DIR]) {
    const dirPath = path.join(root, dir);
    if (!existsSync(dirPath)) {
      continue;
    }

    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith(".md")) {
        continue;
      }

      fileNames.add(fileName);
      const hash = extractTrailingHash(fileName);
      if (!hash) {
        continue;
      }

      const existing = hashes.get(hash) ?? [];
      existing.push(fileName);
      hashes.set(hash, existing);
    }
  }

  return { fileNames, hashes };
}

function citationExists(citation: string, index: CitationSourceIndex): boolean {
  if (index.fileNames.has(citation)) {
    return true;
  }

  const citationHash = extractTrailingHash(citation);
  if (!citationHash) {
    return false;
  }

  return (index.hashes.get(citationHash) ?? []).length > 0;
}

export async function checkBrokenWikilinks(root: string): Promise<LintResult[]> {
  const pages = await collectAllPages(root);
  const existingSlugs = buildPageSlugSet(pages);
  const results: LintResult[] = [];

  for (const page of pages) {
    for (const { captured, line } of findMatchesInContent(page.content, WIKILINK_PATTERN)) {
      const target = normalizeWikilinkTarget(captured);
      const linkSlug = slugify(target);
      if (!existingSlugs.has(linkSlug)) {
        results.push({
          rule: "broken-wikilink",
          severity: "error",
          file: page.filePath,
          message: `Broken wikilink [[${captured}]] - no matching page found`,
          line,
        });
      }
    }
  }

  return results;
}

export async function checkNoOutlinks(root: string): Promise<LintResult[]> {
  const pages = await collectAllPages(root);
  const results: LintResult[] = [];

  for (const page of pages) {
    const outlinks = findMatchesInContent(page.content, WIKILINK_PATTERN);
    if (outlinks.length > 0) continue;
    results.push({
      rule: "no-outlinks",
      severity: "warning",
      file: page.filePath,
      message: "Page has no outbound [[wikilink]] references",
    });
  }

  return results;
}

export async function checkOrphanedPages(root: string): Promise<LintResult[]> {
  const pages = await collectAllPages(root);
  const results: LintResult[] = [];

  for (const page of pages) {
    const { meta } = parseFrontmatter(page.content);
    if (meta.orphaned === true) {
      results.push({
        rule: "orphaned-page",
        severity: "warning",
        file: page.filePath,
        message: "Page is marked as orphaned",
      });
    }
  }

  return results;
}

export async function checkMissingSummaries(root: string): Promise<LintResult[]> {
  const pages = await collectAllPages(root);
  const results: LintResult[] = [];

  for (const page of pages) {
    const { meta } = parseFrontmatter(page.content);
    const summary = meta.summary;
    const isMissing = !summary || (typeof summary === "string" && summary.trim() === "");

    if (isMissing) {
      results.push({
        rule: "missing-summary",
        severity: "warning",
        file: page.filePath,
        message: "Page has no summary in frontmatter",
      });
    }
  }

  return results;
}

export async function checkDuplicateConcepts(root: string): Promise<LintResult[]> {
  const pages = await collectAllPages(root);
  const titleMap = new Map<string, string[]>();

  for (const page of pages) {
    const { meta } = parseFrontmatter(page.content);
    const title = typeof meta.title === "string" ? meta.title : "";
    if (!title) continue;

    const normalizedTitle = title.toLowerCase().trim();
    const existing = titleMap.get(normalizedTitle) ?? [];
    existing.push(page.filePath);
    titleMap.set(normalizedTitle, existing);
  }

  const results: LintResult[] = [];
  for (const [title, files] of titleMap) {
    if (files.length <= 1) continue;
    for (const file of files) {
      results.push({
        rule: "duplicate-concept",
        severity: "error",
        file,
        message: `Duplicate title "${title}" - also in ${files.filter((f) => f !== file).join(", ")}`,
      });
    }
  }

  return results;
}

export async function checkEmptyPages(root: string): Promise<LintResult[]> {
  const pages = await collectAllPages(root);
  const results: LintResult[] = [];

  for (const page of pages) {
    const { meta, body } = parseFrontmatter(page.content);
    const hasTitle = typeof meta.title === "string" && meta.title.trim() !== "";
    const isBodyEmpty = body.trim().length < MIN_BODY_LENGTH;

    if (hasTitle && isBodyEmpty) {
      results.push({
        rule: "empty-page",
        severity: "warning",
        file: page.filePath,
        message: `Page body is empty or too short (< ${MIN_BODY_LENGTH} chars)`,
      });
    }
  }

  return results;
}

export async function checkBrokenCitations(root: string): Promise<LintResult[]> {
  const pages = await collectAllPages(root);
  const sourceIndex = buildCitationSourceIndex(root);
  const results: LintResult[] = [];

  for (const page of pages) {
    for (const { captured, line } of findMatchesInContent(page.content, CITATION_PATTERN)) {
      for (const citation of expandCitationParts(captured)) {
        if (!citationExists(citation, sourceIndex)) {
          results.push({
            rule: "broken-citation",
            severity: "error",
            file: page.filePath,
            message: `Broken citation ^[${citation}] - source file not found`,
            line,
          });
        }
      }
    }
  }

  return results;
}
