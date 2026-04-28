/**
 * Shared wiki page indexing helpers for lint rules and deterministic autofix.
 * These helpers keep page loading and wikilink target normalization consistent
 * across lint diagnostics and repair candidate selection.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter, slugify } from "../utils/markdown.js";
import { CONCEPTS_DIR, QUERIES_DIR } from "../utils/constants.js";
import {
  extractChineseAliasCandidate,
  extractEmbeddedAliasCandidates,
  extractSourceAliasCandidates,
  extractTitleVariantAliases,
} from "../wiki/aliases.js";

interface WikiPageRecord {
  filePath: string;
  content: string;
}

interface WikiPageCandidate {
  filePath: string;
  aliases: string[];
}

export function normalizeWikilinkTarget(captured: string): string {
  return captured.split("|")[0].split("#")[0].trim();
}

export async function collectAllPages(root: string): Promise<WikiPageRecord[]> {
  const conceptPages = await readMarkdownFiles(path.join(root, CONCEPTS_DIR));
  const queryPages = await readMarkdownFiles(path.join(root, QUERIES_DIR));
  return [...conceptPages, ...queryPages];
}

export function buildPageSlugSet(pages: WikiPageRecord[]): Set<string> {
  const slugs = new Set<string>();
  for (const page of pages) {
    const baseName = path.basename(page.filePath, ".md");
    slugs.add(slugify(baseName));

    const { meta } = parseFrontmatter(page.content);
    if (typeof meta.title === "string" && meta.title.trim() !== "") {
      slugs.add(slugify(meta.title));
    }

    if (Array.isArray(meta.aliases)) {
      for (const alias of meta.aliases) {
        if (typeof alias === "string" && alias.trim() !== "") {
          slugs.add(slugify(alias));
        }
      }
    }
  }
  return slugs;
}

export function buildAutofixCandidateMap(pages: WikiPageRecord[]): Map<string, WikiPageCandidate[]> {
  const map = new Map<string, WikiPageCandidate[]>();
  for (const page of pages) {
    const { meta } = parseFrontmatter(page.content);
    const aliases = uniqueStrings([
      ...(Array.isArray(meta.aliases) ? meta.aliases.filter((value): value is string => typeof value === "string") : []),
      typeof meta.title === "string" ? meta.title : "",
      extractTrailingHanAlias(typeof meta.title === "string" ? meta.title : ""),
      extractChineseAliasCandidate(page.content) ?? "",
      ...extractSourceAliasCandidates(page.content),
      ...extractTitleVariantAliases(page.content),
      ...extractEmbeddedAliasCandidates(page.content),
    ]);

    for (const alias of aliases) {
      const slug = slugify(alias);
      const current = map.get(slug) ?? [];
      current.push({ filePath: page.filePath, aliases });
      map.set(slug, current);
    }
  }
  return map;
}

async function readMarkdownFiles(dirPath: string): Promise<WikiPageRecord[]> {
  if (!existsSync(dirPath)) {
    return [];
  }

  const entries = await readdir(dirPath);
  const mdFiles = entries.filter((entry) => entry.endsWith(".md"));
  return Promise.all(
    mdFiles.map(async (fileName) => {
      const filePath = path.join(dirPath, fileName);
      const content = await readFile(filePath, "utf8");
      return { filePath, content };
    }),
  );
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

function extractTrailingHanAlias(title: string): string {
  const match = title.match(/[\p{Script=Han}][\p{Script=Han}\p{Number}]*/u);
  return match?.[0] ?? "";
}
