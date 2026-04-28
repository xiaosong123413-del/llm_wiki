/**
 * Obsidian integration helpers for the llmwiki knowledge compiler.
 *
 * Provides two capabilities:
 * 1. Enriching wiki page frontmatter with tags and aliases for better
 *    Obsidian graph navigation and search.
 * 2. Generating a Map of Content (MOC) page that groups concept pages
 *    by tag for easy browsing.
 */

import { readdir } from "fs/promises";
import path from "path";
import { slugify, atomicWrite, safeReadFile, parseFrontmatter } from "../utils/markdown.js";
import { CONCEPTS_DIR, MOC_FILE, PROCEDURES_DIR } from "../utils/constants.js";

const ABBREVIATION_MIN_WORDS = 3;
const SWAP_CONJUNCTIONS = [" and ", " or "];
const UNCATEGORIZED_TAG = "\u672a\u5206\u7c7b";

export function addObsidianMeta(
  frontmatter: Record<string, unknown>,
  conceptTitle: string,
  tags: string[],
): void {
  frontmatter.tags = tags;
  frontmatter.aliases = generateAliases(conceptTitle);
}

function generateAliases(title: string): string[] {
  const aliases: string[] = [];
  const slug = slugify(title);

  if (slug !== title) {
    aliases.push(slug);
  }

  const swapAlias = generateSwapAlias(title);
  if (swapAlias) {
    aliases.push(swapAlias);
  }

  const abbreviation = generateAbbreviation(title);
  if (abbreviation) {
    aliases.push(abbreviation);
  }

  return aliases;
}

function generateSwapAlias(title: string): string | null {
  for (const conjunction of SWAP_CONJUNCTIONS) {
    const index = title.toLowerCase().indexOf(conjunction);
    if (index === -1) continue;

    const before = title.slice(0, index);
    const after = title.slice(index + conjunction.length);
    const originalConjunction = title.slice(index, index + conjunction.length);
    return `${after}${originalConjunction}${before}`;
  }
  return null;
}

function generateAbbreviation(title: string): string | null {
  const words = title.split(/\s+/);
  if (words.length < ABBREVIATION_MIN_WORDS) return null;

  const abbreviation = words.map((w) => w[0].toUpperCase()).join("");
  if (abbreviation === title) return null;

  return abbreviation;
}

export async function generateMOC(root: string): Promise<void> {
  const conceptsPath = path.join(root, CONCEPTS_DIR);
  const proceduresPath = path.join(root, PROCEDURES_DIR);
  const conceptPages = await loadConceptPages(conceptsPath);
  const procedurePages = await loadConceptPages(proceduresPath, ["\u7a0b\u5e8f\u8bb0\u5fc6"]);
  const pages = [...conceptPages, ...procedurePages];

  const tagGroups = groupPagesByTag(pages);
  const content = buildMOCContent(tagGroups);

  await atomicWrite(path.join(root, MOC_FILE), content);
}

interface PageInfo {
  title: string;
  tags: string[];
}

async function loadConceptPages(conceptsPath: string, fallbackTags: string[] = []): Promise<PageInfo[]> {
  let files: string[];
  try {
    files = await readdir(conceptsPath);
  } catch {
    return [];
  }

  const pages: PageInfo[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const content = await safeReadFile(path.join(conceptsPath, file));
    if (!content) continue;

    const { meta } = parseFrontmatter(content);
    if (meta.orphaned) continue;

    const title = typeof meta.title === "string" ? meta.title : file.replace(/\.md$/, "");
    const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : fallbackTags;
    pages.push({ title, tags });
  }

  return pages;
}

function groupPagesByTag(pages: PageInfo[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const page of pages) {
    if (page.tags.length === 0) {
      appendToGroup(groups, UNCATEGORIZED_TAG, page.title);
      continue;
    }

    for (const tag of page.tags) {
      appendToGroup(groups, tag, page.title);
    }
  }

  return groups;
}

function appendToGroup(groups: Map<string, string[]>, key: string, title: string): void {
  const existing = groups.get(key);
  if (existing) {
    existing.push(title);
  } else {
    groups.set(key, [title]);
  }
}

function buildMOCContent(tagGroups: Map<string, string[]>): string {
  const totalTags = tagGroups.size;
  const totalPages = [...tagGroups.values()].reduce((sum, titles) => sum + titles.length, 0);
  const lines: string[] = [
    "# \u5185\u5bb9\u5730\u56fe",
    "",
    "\u8fd9\u662f wiki \u7684\u4e3b\u9898\u5bfc\u822a\u9875\uff0c\u9002\u5408\u6309\u6807\u7b7e\u548c\u4e3b\u9898\u7ec4\u5757\u6d4f\u89c8\u5df2\u7ecf\u7f16\u8bd1\u597d\u7684\u6982\u5ff5\u9875\u3002",
    "",
    "## \u5e38\u7528\u5165\u53e3",
    "",
    "- [[index]]\uff1a\u770b\u5b8c\u6574\u603b\u7d22\u5f15",
    "- [[\u6b22\u8fce]]\uff1a\u56de\u5230\u4ed3\u5e93\u9996\u9875",
    "- [[00-\u4ed3\u5e93\u603b\u8bf4\u660e]]\uff1a\u67e5\u770b vault \u7ed3\u6784\u8bf4\u660e",
    "",
    "## \u4e3b\u9898\u5bfc\u822a",
    "",
    `- \u5f53\u524d\u6309 ${totalTags} \u4e2a\u6807\u7b7e\u7ec4\u7ec7\u4e3b\u9898\uff0c\u5171\u8986\u76d6 ${totalPages} \u4e2a\u6982\u5ff5\u6761\u76ee\u3002`,
    "- \u5982\u679c\u4f60\u53ea\u60f3\u5feb\u901f\u627e\u6982\u5ff5\u540d\uff0c\u5148\u770b [[index]]\u3002",
    "- \u5982\u679c\u4f60\u60f3\u6309\u4e3b\u9898\u6d4f\u89c8\uff0c\u4ece\u4e0b\u9762\u7684\u6807\u7b7e\u5206\u533a\u5f00\u59cb\u3002",
    "",
  ];

  const sortedTags = [...tagGroups.keys()].sort((a, b) => {
    if (a === UNCATEGORIZED_TAG) return 1;
    if (b === UNCATEGORIZED_TAG) return -1;
    return a.localeCompare(b);
  });

  for (const tag of sortedTags) {
    const titles = tagGroups.get(tag) ?? [];
    lines.push(`## ${tag}`, "");
    for (const title of titles.sort()) {
      lines.push(`- [[${title}]]`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
