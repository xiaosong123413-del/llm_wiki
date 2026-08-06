/**
 * Existing concept context loader.
 *
 * Concept briefs are the compiler's lightweight long-term state: each new
 * source is compared against prior concept pages before deciding what to
 * create or update.
 */

import { readdir } from "fs/promises";
import path from "path";
import { CONCEPTS_DIR } from "../utils/constants.js";
import { parseFrontmatter, safeReadFile } from "../utils/markdown.js";

const MAX_EXISTING_CONCEPTS = 80;

export async function loadExistingConceptBriefs(root: string): Promise<string> {
  let files: string[];
  try {
    files = await readdir(path.join(root, CONCEPTS_DIR));
  } catch {
    return "";
  }

  const lines: string[] = [];
  for (const file of files.filter((name) => name.endsWith(".md")).slice(0, MAX_EXISTING_CONCEPTS)) {
    const content = await safeReadFile(path.join(root, CONCEPTS_DIR, file));
    const { meta } = parseFrontmatter(content);
    if (meta.orphaned) continue;

    const title = typeof meta.title === "string" ? meta.title : file.replace(/\.md$/, "");
    const brief = briefFromMeta(meta);
    lines.push(`- ${title} (${file.replace(/\.md$/, "")}): ${brief}`);
  }

  return lines.join("\n");
}

function briefFromMeta(meta: Record<string, unknown>): string {
  if (typeof meta.brief === "string" && meta.brief.trim()) return meta.brief.trim();
  if (typeof meta.summary === "string" && meta.summary.trim()) return meta.summary.trim();
  return "No brief.";
}
