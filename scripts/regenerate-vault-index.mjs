import yaml from "js-yaml";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const vaultRoot = process.argv[2];
if (!vaultRoot) {
  console.error("Usage: node scripts/regenerate-vault-index.mjs <vault-root>");
  process.exit(1);
}

const wikiRoot = path.join(vaultRoot, "wiki");

function stripWikilinks(text) {
  return text.replace(/\[\[([^\]]+)\]\]/g, "$1");
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---", 4);
  if (end === -1) return {};
  try {
    return yaml.load(content.slice(4, end)) ?? {};
  } catch {
    return {};
  }
}

async function collectPages(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const pages = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const content = await readFile(path.join(dir, entry.name), "utf8");
    const meta = parseFrontmatter(content);
    if (!meta.title || meta.orphaned) continue;
    pages.push({
      title: String(meta.title),
      summary: typeof meta.summary === "string" ? meta.summary : "",
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
    });
  }
  return pages.sort((a, b) => a.title.localeCompare(b.title));
}

function buildIndex(concepts, queries) {
  const lines = ["# 知识 Wiki", "", "## 概念", ""];
  for (const page of concepts) {
    lines.push(`- **[[${page.title}]]** — ${stripWikilinks(page.summary)}`);
  }
  if (queries.length > 0) {
    lines.push("", "## 保存的查询", "");
    for (const page of queries) {
      lines.push(`- **[[${page.title}]]** — ${stripWikilinks(page.summary)}`);
    }
  }
  lines.push("");
  lines.push(`_${concepts.length + queries.length} 页 | 生成于 ${new Date().toISOString()}_`);
  lines.push("");
  return lines.join("\n");
}

function buildMoc(concepts) {
  const groups = new Map();
  for (const page of concepts) {
    const tags = page.tags.length > 0 ? page.tags : ["未分类"];
    for (const tag of tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(page.title);
    }
  }

  const tags = [...groups.keys()].sort((a, b) => {
    if (a === "未分类") return 1;
    if (b === "未分类") return -1;
    return a.localeCompare(b);
  });

  const lines = ["# 内容地图", ""];
  for (const tag of tags) {
    lines.push(`## ${tag}`, "");
    for (const title of groups.get(tag).sort()) {
      lines.push(`- [[${title}]]`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const concepts = await collectPages(path.join(wikiRoot, "concepts"));
const queries = await collectPages(path.join(wikiRoot, "queries"));

await writeFile(path.join(wikiRoot, "index.md"), buildIndex(concepts, queries), "utf8");
await writeFile(path.join(wikiRoot, "MOC.md"), buildMoc(concepts), "utf8");

console.log(`Regenerated index and MOC for ${concepts.length + queries.length} pages.`);
