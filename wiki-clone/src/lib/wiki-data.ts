/**
 * File-system data model for the standalone Wikipedia-style wiki clone.
 *
 * The module reads markdown pages from a wiki root, chooses `index.md` as the
 * default page, extracts lightweight metadata, and builds backlinks when no
 * precomputed `_backlinks.json` is present.
 */

import fs from "node:fs";
import path from "node:path";

export interface WikiArticle {
  path: string;
  title: string;
  category: string;
  summary: string;
  html: string;
  raw: string;
  images: string[];
  sources: string[];
  links: string[];
  modifiedAt: string;
}

export interface WikiLink {
  path: string;
  title: string;
}

export interface WikiCategory {
  name: string;
  articles: WikiLink[];
}

export interface WikiModel {
  wikiRoot: string;
  home: WikiArticle | null;
  current: WikiArticle | null;
  articles: WikiArticle[];
  articleCount: number;
  categories: WikiCategory[];
  recentlyUpdated: WikiArticle[];
  featured: WikiArticle | null;
  backlinks: Record<string, WikiLink[]>;
}

interface LoadOptions {
  wikiRoot?: string;
  currentPath?: string;
}

interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);

export function loadWikiModel(options: LoadOptions = {}): WikiModel {
  const wikiRoot = resolveWikiRoot(options.wikiRoot);
  const articles = fs.existsSync(wikiRoot) ? loadArticles(wikiRoot) : [];
  const home = findArticle(articles, "index.md") ?? findArticle(articles, "_index.md") ?? null;
  const current = findArticle(articles, options.currentPath ?? home?.path ?? "index.md") ?? home;
  const backlinks = loadBacklinks(wikiRoot, articles);
  return {
    wikiRoot,
    home,
    current,
    articles,
    articleCount: articles.length,
    categories: buildCategories(articles),
    recentlyUpdated: [...articles].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 8),
    featured: pickFeatured(articles, current),
    backlinks,
  };
}

function resolveWikiRoot(input?: string): string {
  if (input) return input;
  if (process.env.WIKI_ROOT) return process.env.WIKI_ROOT;
  const configured = readConfiguredWikiRoot();
  if (configured) return configured;
  return path.resolve(process.cwd(), "..", "wiki");
}

function readConfiguredWikiRoot(): string | null {
  const configPath = path.resolve(process.cwd(), "..", "sync-compile-config.json");
  if (!fs.existsSync(configPath)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as { target_vault?: unknown };
    if (typeof config.target_vault !== "string" || !config.target_vault.trim()) return null;
    return path.join(config.target_vault, "wiki");
  } catch {
    return null;
  }
}

function loadArticles(wikiRoot: string): WikiArticle[] {
  return listMarkdownFiles(wikiRoot).map((file) => readArticle(wikiRoot, file));
}

function listMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(full));
    if (entry.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function readArticle(wikiRoot: string, fullPath: string): WikiArticle {
  const raw = fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
  const rel = path.relative(wikiRoot, fullPath).split(path.sep).join("/");
  const parsed = parseMarkdown(raw);
  const title = getTitle(parsed, rel);
  return {
    path: rel,
    title,
    category: getCategory(parsed, rel),
    summary: getSummary(parsed.body),
    html: markdownToHtml(parsed.body, rel),
    raw,
    images: extractImages(parsed.body, rel),
    sources: extractSources(parsed.frontmatter, parsed.body),
    links: extractWikiLinks(parsed.body),
    modifiedAt: fs.statSync(fullPath).mtime.toISOString(),
  };
}

function parseMarkdown(raw: string): ParsedMarkdown {
  if (!raw.startsWith("---\n")) return { frontmatter: {}, body: raw };
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: raw };
  return {
    frontmatter: parseFrontmatter(raw.slice(4, end)),
    body: raw.slice(end + 4).trimStart(),
  };
}

function parseFrontmatter(value: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) result[match[1]!] = match[2]!.trim();
  }
  return result;
}

function getTitle(parsed: ParsedMarkdown, rel: string): string {
  if (typeof parsed.frontmatter.title === "string" && parsed.frontmatter.title) return parsed.frontmatter.title;
  const heading = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || path.basename(rel, path.extname(rel)).replace(/-/g, " ");
}

function getCategory(parsed: ParsedMarkdown, rel: string): string {
  const category = parsed.frontmatter.category ?? parsed.frontmatter.type;
  if (typeof category === "string" && category.trim()) return category.trim();
  const folder = rel.includes("/") ? rel.split("/")[0] : "Main";
  return folder || "Main";
}

function getSummary(body: string): string {
  return body
    .replace(/^#.+$/gm, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?]]/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find(Boolean)
    ?.slice(0, 420) ?? "";
}

function markdownToHtml(body: string, articlePath: string): string {
  const lines = body.split(/\r?\n/);
  const html: string[] = [];
  let listOpen = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (listOpen) html.push("</ul>");
      listOpen = false;
      continue;
    }
    const list = trimmed.match(/^[-*]\s+(.+)$/);
    if (list) {
      if (!listOpen) html.push("<ul>");
      listOpen = true;
      html.push(`<li>${inlineMarkdown(list[1]!, articlePath)}</li>`);
      continue;
    }
    if (listOpen) html.push("</ul>");
    listOpen = false;
    html.push(blockMarkdown(trimmed, articlePath));
  }
  if (listOpen) html.push("</ul>");
  return html.join("\n");
}

function blockMarkdown(line: string, articlePath: string): string {
  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    const level = Math.min(heading[1]!.length, 6);
    return `<h${level}>${inlineMarkdown(heading[2]!, articlePath)}</h${level}>`;
  }
  return `<p>${inlineMarkdown(line, articlePath)}</p>`;
}

function inlineMarkdown(value: string, articlePath: string): string {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
      return `<img alt="${alt}" src="${toWikiFileUrl(src, articlePath)}" />`;
    })
    .replace(/\[\[([^\]|]+)\|([^\]]+)]]/g, '<a href="/?path=$1">$2</a>')
    .replace(/\[\[([^\]]+)]]/g, '<a href="/?path=$1">$1</a>')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function extractImages(body: string, articlePath: string): string[] {
  return [...body.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)]
    .map((match) => toWikiFileUrl(match[1]!, articlePath))
    .slice(0, 12);
}

function toWikiFileUrl(src: string, articlePath: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith("/")) return src;
  const base = path.posix.dirname(articlePath);
  const rel = path.posix.normalize(path.posix.join(base === "." ? "" : base, src));
  return `/wiki-file/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

function extractSources(frontmatter: Record<string, unknown>, body: string): string[] {
  const sources = frontmatter.sources;
  if (typeof sources === "string" && sources.trim()) return [sources.trim()];
  const section = body.match(/^##\s+(Sources|来源|参考资料)\s*\n([\s\S]*?)(?=\n##\s+|$)/im)?.[2] ?? "";
  return section.split(/\r?\n/).map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
}

function extractWikiLinks(body: string): string[] {
  return [...body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?]]/g)].map((match) => match[1]!.trim());
}

function loadBacklinks(wikiRoot: string, articles: WikiArticle[]): Record<string, WikiLink[]> {
  const precomputed = readPrecomputedBacklinks(wikiRoot, articles);
  return precomputed ?? buildBacklinks(articles);
}

function readPrecomputedBacklinks(wikiRoot: string, articles: WikiArticle[]): Record<string, WikiLink[]> | null {
  const full = path.join(wikiRoot, "_backlinks.json");
  if (!fs.existsSync(full)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(full, "utf8")) as Record<string, string[]>;
    return Object.fromEntries(Object.entries(parsed).map(([key, links]) => [key, links.map((link) => toLink(link, articles))]));
  } catch {
    return null;
  }
}

function buildBacklinks(articles: WikiArticle[]): Record<string, WikiLink[]> {
  const result: Record<string, WikiLink[]> = {};
  for (const target of articles) {
    result[target.path] = articles
      .filter((source) => source.path !== target.path && source.links.some((link) => matchesArticle(link, target)))
      .map((source) => ({ path: source.path, title: source.title }));
  }
  return result;
}

function matchesArticle(link: string, article: WikiArticle): boolean {
  const normalized = normalizeTitle(link);
  return normalized === normalizeTitle(article.title) || normalized === normalizeTitle(path.basename(article.path, path.extname(article.path)));
}

function buildCategories(articles: WikiArticle[]): WikiCategory[] {
  const groups = new Map<string, WikiLink[]>();
  for (const article of articles) {
    const list = groups.get(article.category) ?? [];
    list.push({ path: article.path, title: article.title });
    groups.set(article.category, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, links]) => ({ name, articles: links }));
}

function pickFeatured(articles: WikiArticle[], current: WikiArticle | null): WikiArticle | null {
  return articles.find((article) => article.images.length > 0 && article.summary.length > 120) ?? current ?? articles[0] ?? null;
}

function findArticle(articles: WikiArticle[], rel: string): WikiArticle | null {
  return articles.find((article) => article.path.toLowerCase() === rel.toLowerCase()) ?? null;
}

function toLink(rel: string, articles: WikiArticle[]): WikiLink {
  const article = findArticle(articles, rel);
  return { path: rel, title: article?.title ?? path.basename(rel, path.extname(rel)) };
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/\.md$/i, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
