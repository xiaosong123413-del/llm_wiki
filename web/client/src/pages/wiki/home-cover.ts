/**
 * Dedicated wiki home cover for `wiki/index.md`.
 * Renders a Peiweipedia-style landing page using the compiled wiki tree
 * plus the actual `wiki/index.md` source content.
 */
interface WikiHomePageResponse {
  path: string;
  title: string | null;
  html: string;
  raw?: string;
  modifiedAt?: string;
}

interface WikiHomeTreeNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  modifiedAt?: string;
  children?: WikiHomeTreeNode[];
}

interface WikiHomePageLink {
  path: string;
  title: string;
  modifiedAt: string | null;
}

interface WikiHomeFeaturedItem {
  title: string;
  path: string;
  summary: string;
  imageUrl: string | null;
}

interface WikiHomeCategoryGroup {
  name: string;
  pages: WikiHomePageLink[];
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
    <div class="wiki-home-cover__shell" data-wiki-home-shell>
      <section class="wiki-home-cover__hero">
        <p class="wiki-home-cover__eyebrow">WIKI 首页</p>
        <h1 data-wiki-home-title>${escapeHtml(HERO_TITLE)}</h1>
        <p class="wiki-home-cover__intro" data-wiki-home-intro>正在从你的 wiki 生成首页封面…</p>
        <p class="wiki-home-cover__meta" data-wiki-home-meta>正在统计条目与分类…</p>
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
  `;

  root.__dispose = () => controller.abort();
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

    const model = buildWikiHomeViewModel(indexPage, tree, featuredPage);
    renderWikiHomeView(refs, model);
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
    categories: buildCategoryGroups(tree),
  };
}

function flattenWikiTree(tree: WikiHomeTreeNode | null): WikiHomePageLink[] {
  const pages: WikiHomePageLink[] = [];
  visitWikiTree(tree, (node) => {
    if (node.kind !== "file") {
      return;
    }
    pages.push({
      path: node.path,
      title: pageTitleFromPath(node.name, node.name),
      modifiedAt: node.modifiedAt ?? null,
    });
  });
  return pages;
}

function visitWikiTree(
  node: WikiHomeTreeNode | null,
  visit: (node: WikiHomeTreeNode) => void,
): void {
  if (!node) {
    return;
  }
  visit(node);
  for (const child of node.children ?? []) {
    visitWikiTree(child, visit);
  }
}

function collectWikiCategoryGroups(tree: WikiHomeTreeNode | null): WikiHomeTreeNode[] {
  const wikiRoot = findWikiContentRoot(tree);
  return (wikiRoot?.children ?? []).filter((child) => child.kind === "dir");
}

function findWikiContentRoot(tree: WikiHomeTreeNode | null): WikiHomeTreeNode | null {
  if (!tree) {
    return null;
  }
  if (tree.path === "wiki" && tree.kind === "dir") {
    const nestedWiki = (tree.children ?? []).find((child) => child.path === "wiki" && child.kind === "dir");
    return nestedWiki ?? tree;
  }
  return tree;
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

function buildCategoryGroups(tree: WikiHomeTreeNode | null): WikiHomeCategoryGroup[] {
  return collectWikiCategoryGroups(tree)
    .slice(0, MAX_CATEGORY_GROUPS)
    .map((group) => ({
      name: pageTitleFromPath(group.path, group.name),
      pages: (group.children ?? [])
        .filter((child) => child.kind === "file")
        .slice(0, MAX_CATEGORY_ITEMS)
        .map((child) => ({
          path: child.path,
          title: pageTitleFromPath(child.name, child.name),
          modifiedAt: child.modifiedAt ?? null,
        })),
    }));
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

function extractFirstImageUrl(page: Pick<WikiHomePageResponse, "raw" | "html">): string | null {
  const rawMatch = page.raw?.match(/!\[[^\]]*\]\(([^)]+)\)/u);
  if (rawMatch?.[1]) {
    return rawMatch[1];
  }
  const htmlMatch = page.html.match(/<img[^>]+src=["']([^"']+)["']/iu);
  return htmlMatch?.[1] ?? null;
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
  refs.shell.innerHTML = `
    <section class="wiki-home-cover__empty-state" data-wiki-home-empty>
      <h1>尚未找到 wiki/index.md。</h1>
      <p>重新编译 wiki 后，这里会自动恢复为首页封面。</p>
    </section>
  `;
}

function getHomeRefs(root: HTMLElement) {
  return {
    shell: root.querySelector<HTMLElement>("[data-wiki-home-shell]")!,
    title: root.querySelector<HTMLElement>("[data-wiki-home-title]")!,
    intro: root.querySelector<HTMLElement>("[data-wiki-home-intro]")!,
    meta: root.querySelector<HTMLElement>("[data-wiki-home-meta]")!,
    featured: root.querySelector<HTMLElement>("[data-wiki-home-featured]")!,
    recent: root.querySelector<HTMLElement>("[data-wiki-home-recent]")!,
    categories: root.querySelector<HTMLElement>("[data-wiki-home-categories]")!,
    about: root.querySelector<HTMLElement>("[data-wiki-home-about]")!,
  };
}

function buildInitials(value: string): string {
  const parts = value.trim().split(/\s+/u).slice(0, 2);
  const initials = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return initials || "W";
}

function pageTitleFromPath(path: string, fallback: string): string {
  const base = path.split("/").pop() ?? fallback;
  return base
    .replace(/\.(md|markdown|txt)$/iu, "")
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString();
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

function wikiHref(path: string): string {
  return `#/wiki/${encodeURIComponent(path)}`;
}
