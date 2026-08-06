/**
 * Dedicated wiki home cover for `wiki/index.md`.
 * Renders a Peiweipedia-style landing page using the compiled wiki tree
 * plus the actual `wiki/index.md` source content.
 */
import { renderWikiHomeSidebar } from "./home-sidebar.js";
import { disposeWikiHomeGraph, mountWikiHomeGraph } from "./home-graph.js";
import { bindWikiPathCopy } from "./path-copy.js";
import { bindWikiPathOrder } from "./path-order.js";
import {
  buildCategoryGroups,
  collectWikiCategoryGroups,
  flattenWikiTree,
  formatDate,
  pageTitleFromPath,
  type WikiHomeCategoryGroup,
  type WikiHomePageLink,
  type WikiHomeTreeNode,
} from "./home-tree.js";

interface WikiHomePageResponse {
  path: string;
  title: string | null;
  html: string;
  raw?: string;
  frontmatter: Record<string, unknown> | null;
  modifiedAt?: string;
}

interface WikiHomeFeaturedItem {
  title: string;
  path: string;
  summary: string;
  imageUrl: string | null;
}

interface WikiHomeViewModel {
  totalArticles: number;
  totalCategories: number;
  intro: string;
  about: string;
  featured: WikiHomeFeaturedItem | null;
  recent: WikiHomePageLink[];
  categories: WikiHomeCategoryGroup[];
}

type DisposableNode = HTMLElement & {
  __dispose?: () => void;
};

const DEFAULT_INDEX_PATH = "wiki/index.md";
const HERO_TITLE = "欢迎来到 Peiweipedia";
const MAX_RECENT_ITEMS = 5;
const MAX_CATEGORY_GROUPS = 4;
const MAX_CATEGORY_ITEMS = 4;

export function renderWikiHomeCoverPage(path = DEFAULT_INDEX_PATH): HTMLElement {
  const root = document.createElement("section") as DisposableNode;
  const controller = new AbortController();

  root.className = "wiki-home-cover";
  root.dataset.wikiHome = "true";
  root.innerHTML = `
    <div class="wiki-home-cover__layout" data-wiki-home-layout>
      ${renderWikiHomeSidebar(null)}
      <main class="wiki-home-cover__main">
        <div class="wiki-home-cover__shell" data-wiki-home-shell>
          <section class="wiki-home-cover__hero">
            <p class="wiki-home-cover__eyebrow">WIKI 首页</p>
            <h1 data-wiki-home-title>${escapeHtml(HERO_TITLE)}</h1>
            <p class="wiki-home-cover__intro" data-wiki-home-intro>正在从你的 wiki 生成首页封面…</p>
            <p class="wiki-home-cover__meta" data-wiki-home-meta>正在统计条目与分类…</p>
            <form class="wiki-home-cover__search" data-wiki-home-search>
              <input data-wiki-home-search-input type="search" placeholder="搜索 wiki 条目…" autocomplete="off" />
              <button type="submit">搜索</button>
            </form>
          </section>
          <div class="wiki-home-cover__grid">
            <section class="wiki-home-cover__panel wiki-home-cover__panel--featured">
              <h2>精选条目</h2>
              <div class="wiki-home-cover__panel-body" data-wiki-home-featured>正在加载精选条目…</div>
            </section>
            <section class="wiki-home-cover__panel wiki-home-cover__panel--recent">
              <h2>最近更新</h2>
              <div class="wiki-home-cover__panel-body" data-wiki-home-recent>正在加载最近更新…</div>
            </section>
            <section class="wiki-home-cover__panel wiki-home-cover__panel--graph">
              <h2><a class="wiki-home-cover__panel-title-link" href="#/graph">Graphy</a></h2>
              <div class="wiki-home-cover__panel-body" data-wiki-home-graph>正在加载 Graphy…</div>
            </section>
            <section class="wiki-home-cover__panel wiki-home-cover__panel--categories">
              <h2>按分类浏览</h2>
              <div class="wiki-home-cover__panel-body" data-wiki-home-categories>正在加载分类…</div>
            </section>
            <section class="wiki-home-cover__panel wiki-home-cover__panel--about">
              <h2>关于</h2>
              <div class="wiki-home-cover__panel-body" data-wiki-home-about>正在整理首页摘要…</div>
            </section>
          </div>
        </div>
      </main>
    </div>
  `;

  root.__dispose = () => {
    controller.abort();
    disposeWikiHomeGraph(root);
  };
  bindWikiPathCopy(root);
  bindWikiPathOrder(root);
  bindWikiHomeSearch(root, controller.signal);
  void loadWikiHomeCover(root, controller.signal, path);
  return root;
}

async function loadWikiHomeCover(
  root: HTMLElement,
  signal: AbortSignal,
  path: string,
): Promise<void> {
  const refs = getHomeRefs(root);
  try {
    const [indexPage, tree] = await Promise.all([
      fetchWikiHomePage(path, signal),
      fetchWikiHomeTree(signal),
    ]);
    if (!indexPage || signal.aborted) {
      renderMissingWikiHome(refs);
      return;
    }

    const featuredLink = pickFeaturedLink(flattenWikiTree(tree));
    const featuredPage = featuredLink
      ? await fetchWikiHomePage(featuredLink.path, signal)
      : null;
    if (signal.aborted) {
      return;
    }

    refs.layout.innerHTML = `${renderWikiHomeSidebar(tree)}${refs.main.outerHTML}`;
    const refreshedRefs = getHomeRefs(root);
    const model = buildWikiHomeViewModel(indexPage, tree, featuredPage);
    renderWikiHomeView(refreshedRefs, model);
    mountWikiHomeGraph(root, refreshedRefs.graph, signal);
  } catch {
    if (signal.aborted) {
      return;
    }
    renderMissingWikiHome(refs);
  }
}

async function fetchWikiHomePage(
  path: string,
  signal: AbortSignal,
): Promise<WikiHomePageResponse | null> {
  const response = await fetch(`/api/page?path=${encodeURIComponent(path)}&raw=1`, { signal });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as WikiHomePageResponse;
}

async function fetchWikiHomeTree(signal: AbortSignal): Promise<WikiHomeTreeNode | null> {
  const response = await fetch("/api/tree?layer=wiki", { signal });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as WikiHomeTreeNode;
}

function buildWikiHomeViewModel(
  indexPage: WikiHomePageResponse,
  tree: WikiHomeTreeNode | null,
  featuredPage: WikiHomePageResponse | null,
): WikiHomeViewModel {
  const pages = flattenWikiTree(tree);
  const meaningfulLines = extractMeaningfulLines(indexPage);
  return {
    totalArticles: pages.length,
    totalCategories: collectWikiCategoryGroups(tree).length,
    intro: buildIntroText(meaningfulLines),
    about: buildAboutText(meaningfulLines),
    featured: buildFeaturedItem(featuredPage),
    recent: buildRecentItems(pages),
    categories: buildCategoryGroups(tree, MAX_CATEGORY_GROUPS, MAX_CATEGORY_ITEMS),
  };
}

function pickFeaturedLink(pages: readonly WikiHomePageLink[]): WikiHomePageLink | null {
  const candidates = pages.filter((page) => page.path !== DEFAULT_INDEX_PATH);
  if (candidates.length === 0) {
    return null;
  }
  return candidates
    .slice()
    .sort(compareRecentPages)[0] ?? null;
}

function compareRecentPages(a: WikiHomePageLink, b: WikiHomePageLink): number {
  const left = a.modifiedAt ?? "";
  const right = b.modifiedAt ?? "";
  return right.localeCompare(left);
}

function buildIntroText(lines: readonly string[]): string {
  return lines[0] ?? "这里会根据你的 wiki 首页内容自动生成简介。";
}

function buildAboutText(lines: readonly string[]): string {
  if (lines.length === 0) {
    return "这里会根据你的 wiki 全文自动整理首页摘要。";
  }
  return lines.slice(0, 3).join(" ");
}

function buildFeaturedItem(page: WikiHomePageResponse | null): WikiHomeFeaturedItem | null {
  if (!page) {
    return null;
  }
  const lines = extractMeaningfulLines(page);
  return {
    title: page.title ?? pageTitleFromPath(page.path, page.path),
    path: page.path,
    summary: lines[0] ?? "这篇条目已经生成，但还没有可用摘要。",
    imageUrl: extractFirstImageUrl(page),
  };
}

function buildRecentItems(pages: readonly WikiHomePageLink[]): WikiHomePageLink[] {
  return pages
    .filter((page) => page.path !== DEFAULT_INDEX_PATH)
    .slice()
    .sort(compareRecentPages)
    .slice(0, MAX_RECENT_ITEMS);
}

function extractMeaningfulLines(page: Pick<WikiHomePageResponse, "raw" | "html">): string[] {
  const rawText = page.raw?.trim() ? page.raw : extractTextFromHtml(page.html);
  return rawText
    .split(/\r?\n/)
    .map(normalizeWikiLine)
    .filter((line) => line.length > 0);
}

function extractTextFromHtml(html: string): string {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  return documentNode.body.textContent ?? "";
}

function normalizeWikiLine(line: string): string {
  const withoutLinks = line.replace(/!\[[^\]]*\]\(([^)]+)\)/g, "");
  const plain = withoutLinks
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s*/u, "")
    .replace(/^>\s*/u, "")
    .replace(/^[-*+]\s*/u, "")
    .replace(/^\d+\.\s*/u, "")
    .replace(/`/g, "")
    .replace(/[_*]/g, "")
    .trim();
  if (plain.startsWith("生成于 ")) {
    return "";
  }
  return plain;
}

function extractFirstImageUrl(
  page: Pick<WikiHomePageResponse, "raw" | "html" | "frontmatter">,
): string | null {
  const sideImagePath = readFrontmatterString(page.frontmatter, "side_image");
  if (sideImagePath) {
    return buildSideImageUrl(sideImagePath);
  }
  const htmlMatch = page.html.match(/<img[^>]+src=["']([^"']+)["']/iu);
  if (htmlMatch?.[1]) {
    return htmlMatch[1];
  }
  const rawMatch = page.raw?.match(/!\[[^\]]*\]\(([^)]+)\)/u);
  return rawMatch?.[1] ?? null;
}

function renderWikiHomeView(
  refs: ReturnType<typeof getHomeRefs>,
  model: WikiHomeViewModel,
): void {
  refs.title.textContent = HERO_TITLE;
  refs.intro.textContent = model.intro;
  refs.meta.textContent = `共 ${model.totalArticles} 篇条目，分布在 ${model.totalCategories} 个分类中`;
  refs.featured.innerHTML = renderFeaturedPanel(model.featured);
  refs.recent.innerHTML = renderRecentPanel(model.recent);
  refs.categories.innerHTML = renderCategoryPanel(model.categories);
  refs.about.textContent = model.about;
}

function renderFeaturedPanel(featured: WikiHomeFeaturedItem | null): string {
  if (!featured) {
    return `<p class="wiki-home-cover__empty">当前还没有可展示的精选条目。</p>`;
  }
  const media = featured.imageUrl
    ? `<img src="${escapeHtml(featured.imageUrl)}" alt="${escapeHtml(featured.title)}" />`
    : `<div class="wiki-home-cover__featured-fallback">${escapeHtml(buildInitials(featured.title))}</div>`;
  return `
    <article class="wiki-home-cover__featured-card">
      <div class="wiki-home-cover__featured-media">${media}</div>
      <div class="wiki-home-cover__featured-copy">
        <h3><a href="${wikiHref(featured.path)}">${escapeHtml(featured.title)}</a></h3>
        <p>${escapeHtml(featured.summary)}</p>
        <a class="wiki-home-cover__read-more" href="${wikiHref(featured.path)}">阅读全文 →</a>
      </div>
    </article>
  `;
}

function renderRecentPanel(items: readonly WikiHomePageLink[]): string {
  if (items.length === 0) {
    return `<p class="wiki-home-cover__empty">当前还没有最近更新条目。</p>`;
  }
  return `
    <ul class="wiki-home-cover__recent-list">
      ${items.map((item) => `
        <li>
          <a href="${wikiHref(item.path)}">${escapeHtml(item.title)}</a>
          <span>${escapeHtml(formatDate(item.modifiedAt))}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderCategoryPanel(groups: readonly WikiHomeCategoryGroup[]): string {
  if (groups.length === 0) {
    return `<p class="wiki-home-cover__empty">当前还没有可浏览的分类。</p>`;
  }
  return groups.map((group) => `
    <section class="wiki-home-cover__category-group">
      <h3>${escapeHtml(group.name)}</h3>
      <ul>
        ${group.pages.map((page) => `
          <li><a href="${wikiHref(page.path)}">${escapeHtml(page.title)}</a></li>
        `).join("")}
      </ul>
    </section>
  `).join("");
}

function renderMissingWikiHome(refs: ReturnType<typeof getHomeRefs>): void {
  disposeWikiHomeGraph(refs.shell.closest<HTMLElement>("[data-wiki-home]") ?? refs.shell);
  refs.shell.innerHTML = `
    <section class="wiki-home-cover__empty-state" data-wiki-home-empty>
      <h1>尚未找到 wiki/index.md。</h1>
      <p>重新编译 wiki 后，这里会自动恢复为首页封面。</p>
    </section>
  `;
}

function getHomeRefs(root: HTMLElement) {
  return {
    layout: root.querySelector<HTMLElement>("[data-wiki-home-layout]")!,
    main: root.querySelector<HTMLElement>(".wiki-home-cover__main")!,
    shell: root.querySelector<HTMLElement>("[data-wiki-home-shell]")!,
    title: root.querySelector<HTMLElement>("[data-wiki-home-title]")!,
    intro: root.querySelector<HTMLElement>("[data-wiki-home-intro]")!,
    meta: root.querySelector<HTMLElement>("[data-wiki-home-meta]")!,
    featured: root.querySelector<HTMLElement>("[data-wiki-home-featured]")!,
    recent: root.querySelector<HTMLElement>("[data-wiki-home-recent]")!,
    graph: root.querySelector<HTMLElement>("[data-wiki-home-graph]")!,
    categories: root.querySelector<HTMLElement>("[data-wiki-home-categories]")!,
    about: root.querySelector<HTMLElement>("[data-wiki-home-about]")!,
  };
}

function buildInitials(value: string): string {
  const parts = value.trim().split(/\s+/u).slice(0, 2);
  const initials = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return initials || "W";
}

function readFrontmatterString(
  frontmatter: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const candidate = frontmatter?.[key];
  if (typeof candidate !== "string") {
    return "";
  }
  return candidate.trim().replace(/^['"]|['"]$/gu, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}

interface WikiHomeSearchResult {
  path: string;
  title: string;
  excerpt: string;
  modifiedAt?: string;
  tags: string[];
  retrievalSources?: string[];
}

// fallow-ignore-next-line complexity
function bindWikiHomeSearch(root: HTMLElement, signal: AbortSignal): void {
  const form = root.querySelector<HTMLFormElement>("[data-wiki-home-search]");
  const input = root.querySelector<HTMLInputElement>("[data-wiki-home-search-input]");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    void runWikiHomeSearch(root, query, signal);
  });
}

// fallow-ignore-next-line complexity
async function runWikiHomeSearch(
  root: HTMLElement,
  query: string,
  signal: AbortSignal,
): Promise<void> {
  const shell = root.querySelector<HTMLElement>("[data-wiki-home-shell]");
  if (!shell) return;
  disposeWikiHomeGraph(root);

  shell.innerHTML = `
    <div class="wiki-home-cover__search-status">
      <p>正在搜索「${escapeHtml(query)}」…</p>
    </div>
  `;

  try {
    const response = await fetch(
      `/api/search?scope=local&mode=hybrid&q=${encodeURIComponent(query)}`,
      { signal },
    );
    const payload = (await response.json()) as { success?: boolean; data?: { local?: { results?: WikiHomeSearchResult[] } }; error?: string };
    if (signal.aborted) return;

    const results = payload.data?.local?.results ?? [];
    renderWikiHomeSearchResults(root, shell, query, results);
  } catch {
    if (signal.aborted) return;
    shell.innerHTML = `
      <div class="wiki-home-cover__search-status">
        <p>搜索失败，请稍后重试。</p>
        <button type="button" data-wiki-home-search-back>返回首页</button>
      </div>
    `;
    bindBackButton(shell, root);
  }
}

// fallow-ignore-next-line complexity
function renderWikiHomeSearchResults(
  root: HTMLElement,
  shell: HTMLElement,
  query: string,
  results: WikiHomeSearchResult[],
): void {
  if (results.length === 0) {
    disposeWikiHomeGraph(root);
    shell.innerHTML = `
      <div class="wiki-home-cover__search-status">
        <p>没有找到与「${escapeHtml(query)}」匹配的条目。</p>
        <button type="button" data-wiki-home-search-back>返回首页</button>
      </div>
    `;
    bindBackButton(shell, root);
    return;
  }

  disposeWikiHomeGraph(root);
  shell.innerHTML = `
    <div class="wiki-home-cover__search-header">
      <h2>搜索：${escapeHtml(query)}</h2>
      <span>${results.length} 个结果</span>
      <button type="button" data-wiki-home-search-back>返回首页</button>
    </div>
    <section class="wiki-home-cover__search-results">
      ${results.map((result) => `
        <article class="wiki-home-cover__search-result">
          <h3><a href="${wikiHref(result.path)}" title="${escapeHtml(result.path)}">${escapeHtml(result.title)}</a></h3>
          <p>${escapeHtml(result.excerpt || result.path)}</p>
          <div class="wiki-home-cover__search-meta">
            <code>${escapeHtml(result.path)}</code>
            ${renderRetrievalSourceBadges(result.retrievalSources)}
            ${result.modifiedAt ? `<span>${escapeHtml(formatDate(result.modifiedAt))}</span>` : ""}
            ${result.tags.slice(0, 4).map((tag) => `<span class="wiki-home-cover__search-tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </article>
      `).join("")}
    </section>
  `;
  bindBackButton(shell, shell);
}

function renderRetrievalSourceBadges(sources: string[] | undefined): string {
  return (sources ?? []).map((source) =>
    `<span class="wiki-home-cover__search-source">${escapeHtml(formatRetrievalSource(source))}</span>`
  ).join("");
}

function formatRetrievalSource(source: string): string {
  if (source === "token") return "token";
  if (source === "vector") return "vector";
  if (source === "graph") return "graph";
  return source;
}

function bindBackButton(container: HTMLElement, root: HTMLElement): void {
  const backBtn = container.querySelector<HTMLButtonElement>("[data-wiki-home-search-back]");
  if (!backBtn) return;
  backBtn.addEventListener("click", () => {
    void loadWikiHomeCover(root, new AbortController().signal, DEFAULT_INDEX_PATH);
  });
}

function wikiHref(path: string): string {
  return `#/wiki/${encodeURIComponent(path)}`;
}

function buildSideImageUrl(logicalPath: string): string {
  return `/api/page-side-image?path=${encodeURIComponent(logicalPath)}`;
}
