/**
 * Wiki index generator.
 *
 * Scans all concept pages in wiki/concepts/, extracts frontmatter metadata,
 * and produces wiki/index.md with a sorted list of all concepts and their
 * summaries. Used after each compilation pass.
 */

import { readdir } from "fs/promises";
import path from "path";
import { atomicWrite, safeReadFile, parseFrontmatter } from "../utils/markdown.js";
import { CONCEPTS_DIR, PROCEDURES_DIR, QUERIES_DIR, INDEX_FILE } from "../utils/constants.js";
import * as output from "../utils/output.js";
import type { PageSummary } from "../utils/types.js";

export async function generateIndex(root: string): Promise<void> {
  output.status("*", output.info("Generating index..."));

  const conceptsPath = path.join(root, CONCEPTS_DIR);
  const proceduresPath = path.join(root, PROCEDURES_DIR);
  const queriesPath = path.join(root, QUERIES_DIR);
  const concepts = await collectPageSummaries(conceptsPath);
  const procedures = await collectPageSummaries(proceduresPath);
  const queries = await collectPageSummaries(queriesPath);

  concepts.sort((a, b) => a.title.localeCompare(b.title));
  procedures.sort((a, b) => a.title.localeCompare(b.title));
  queries.sort((a, b) => a.title.localeCompare(b.title));

  const indexContent = buildIndexContent(concepts, procedures, queries);
  const indexPath = path.join(root, INDEX_FILE);
  await atomicWrite(indexPath, indexContent);

  const total = concepts.length + procedures.length + queries.length;
  output.status("+", output.success(`Index updated with ${total} pages.`));
}

async function collectPageSummaries(conceptsPath: string): Promise<PageSummary[]> {
  let files: string[];

  try {
    files = await readdir(conceptsPath);
  } catch {
    return [];
  }

  const pages: PageSummary[] = [];

  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const content = await safeReadFile(path.join(conceptsPath, file));
    const { meta } = parseFrontmatter(content);
    if (meta.title && typeof meta.title === "string" && !meta.orphaned) {
      pages.push({
        title: meta.title,
        slug: file.replace(/\.md$/, ""),
        summary: typeof meta.summary === "string" ? meta.summary : "",
      });
    }
  }

  return pages;
}

function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, "$1");
}

function buildIndexContent(
  concepts: PageSummary[],
  procedures: PageSummary[],
  queries: PageSummary[],
): string {
  const total = concepts.length + procedures.length + queries.length;
  const lines = [
    "# \u77e5\u8bc6 Wiki",
    "",
    "\u8fd9\u662f\u7f16\u8bd1\u540e\u7684\u603b\u7d22\u5f15\u9875\uff0c\u9002\u5408\u7528\u6765\u5feb\u901f\u4e86\u89e3\u73b0\u5728\u5df2\u7ecf\u6709\u54ea\u4e9b\u6982\u5ff5\u9875\u3001\u67e5\u8be2\u9875\u548c\u77e5\u8bc6\u5165\u53e3\u3002",
    "",
    "## \u5feb\u901f\u5165\u53e3",
    "",
    "- [[MOC]]\uff1a\u6309\u4e3b\u9898\u5bfc\u822a\u6d4f\u89c8 wiki",
    "- [[\u6b22\u8fce]]\uff1a\u56de\u5230\u4ed3\u5e93\u9996\u9875",
    "- [[00-\u4ed3\u5e93\u603b\u8bf4\u660e]]\uff1a\u67e5\u770b\u6574\u4e2a vault \u7684\u7ed3\u6784\u89e3\u91ca",
    "",
    "## \u4f7f\u7528\u5efa\u8bae",
    "",
    `- \u5982\u679c\u4f60\u60f3\u5148\u627e\u5165\u53e3\uff0c\u770b [[MOC]]\u3002`,
    `- \u5982\u679c\u4f60\u60f3\u76f4\u63a5\u67e5\u5177\u4f53\u6982\u5ff5\uff0c\u4ece\u4e0b\u9762\u7684\u300c\u6982\u5ff5\u300d\u5f00\u59cb\u3002`,
    `- \u5f53\u524d\u7d22\u5f15\u6536\u5f55 ${total} \u9875\uff0c\u5305\u62ec\u6982\u5ff5\u4e0e\u5df2\u4fdd\u5b58\u7684\u67e5\u8be2\u7ed3\u679c\u3002`,
    "",
    "## \u6982\u5ff5",
    "",
  ];

  for (const page of concepts) {
    lines.push(`- **[[${page.title}]]** \u2014 ${stripWikilinks(page.summary)}`);
  }

  if (procedures.length > 0) {
    lines.push("", "## \u7a0b\u5e8f\u8bb0\u5fc6", "");
    for (const page of procedures) {
      lines.push(`- **[[${page.title}]]** \u2014 ${stripWikilinks(page.summary)}`);
    }
  }

  if (queries.length > 0) {
    lines.push("", "## \u4fdd\u5b58\u7684\u67e5\u8be2", "");
    for (const page of queries) {
      lines.push(`- **[[${page.title}]]** \u2014 ${stripWikilinks(page.summary)}`);
    }
  }

  lines.push("");
  lines.push(`_${total} \u9875 | \u751f\u6210\u4e8e ${new Date().toISOString()}_`);
  lines.push("");

  return lines.join("\n");
}
