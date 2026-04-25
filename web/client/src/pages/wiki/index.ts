/**
 * Farzapedia-style wiki reader for the main web UI.
 */
import {
  createWikiCommentSurface,
  locateSelection,
  type WikiCommentSelection,
  type WikiCommentSurfaceController,
} from "../../components/wiki-comments.js";
import {
  applyPanelWidth,
  clampPanelWidth,
  readPanelWidth,
  writePanelWidth,
  type PanelWidthBounds,
} from "../../shell/panel-layout.js";
import { attachResizeHandle } from "../../shell/resize-handle.js";

interface WikiPageResponse {
  path: string;
  title: string | null;
  html: string;
  raw: string;
  frontmatter: Record<string, unknown> | null;
  aliases?: string[];
  sizeBytes?: number;
  modifiedAt?: string;
  sourceEditable?: boolean;
}

interface WikiTreeNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: WikiTreeNode[];
}

interface WikiDirectory {
  name: string;
  pages: WikiPageLink[];
}

interface WikiPageLink {
  path: string;
  title: string;
}

interface WikiPageCard extends WikiPageLink {
  modifiedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface WikiSearchResult {
  path: string;
  title: string;
  excerpt: string;
  tags: string[];
  modifiedAt: string | null;
}

interface WikiSearchResponse {
  local: {
    results: WikiSearchResult[];
  };
}

interface WikiPageData {
  article: WikiPageResponse | null;
  navigation: WikiPageLink[];
  categories: WikiDirectory[];
  recentlyUpdated: WikiPageCard[];
}

interface WikiTocEntry {
  id: string;
  label: string;
  level: number;
}

type DisposableNode = HTMLElement & {
  __dispose?: () => void;
};

interface WikiSelectionToolbarController {
  reset(): void;
  dispose(): void;
}

interface WikiSelectionToolbarPlacement {
  left: number;
  top: number;
}

const DEFAULT_INDEX_PATH = "wiki/index.md";
const WIKI_SELECTION_TOOLBAR_GUTTER = 12;
const WIKI_SELECTION_TOOLBAR_FALLBACK_WIDTH = 160;
const wikiPageTimers = new WeakMap<HTMLElement, Set<number>>();
const WIKI_TOC_BOUNDS: PanelWidthBounds = {
  defaultWidth: 320,
  minWidth: 240,
  maxWidth: 480,
};

export function renderWikiPage(initialPath = DEFAULT_INDEX_PATH, initialAnchor = ""): HTMLElement {
  const root = document.createElement("section") as DisposableNode;
  wikiPageTimers.set(root, new Set());
  root.dataset.wikiCurrentPath = initialPath;
  root.dataset.wikiCurrentAnchor = initialAnchor;
  root.className = "wiki-page";
  root.innerHTML = `
    <aside class="wiki-page__sidebar">
      <div class="wiki-page__brand">
        <div class="wiki-page__mark">F</div>
        <strong>Farzapedia</strong>
        <span>The Personal Encyclopedia</span>
      </div>
      <section class="wiki-page__sidebar-section">
        <h2>Navigation</h2>
        <nav class="wiki-page__sidebar-links" data-wiki-navigation>
          <a href="${wikiHref(DEFAULT_INDEX_PATH)}">Main page</a>
          <a href="${wikiHref(DEFAULT_INDEX_PATH)}">Recent changes</a>
          <a href="${wikiHref(DEFAULT_INDEX_PATH)}">Random article</a>
        </nav>
      </section>
      <section class="wiki-page__sidebar-section">
        <h2>Categories</h2>
        <nav class="wiki-page__sidebar-links" data-wiki-sidebar-categories>
          <span class="wiki-page__placeholder">Loading categories...</span>
        </nav>
      </section>
    </aside>
    <main class="wiki-page__main">
      <div class="wiki-page__chrome" data-wiki-chrome>
        <header class="wiki-page__header">
          <div class="wiki-page__header-copy">
            <div class="wiki-page__eyebrow">FARZAPEDIA</div>
            <h1 data-wiki-title>Wiki</h1>
            <p class="wiki-page__subtitle">The Personal Encyclopedia</p>
          </div>
          <form class="wiki-page__search" data-wiki-search>
            <input data-wiki-search-input type="search" placeholder="Search Farzapedia" autocomplete="off" />
            <button type="submit">Search</button>
          </form>
          <a class="wiki-page__open" data-wiki-open-current href="${wikiHref(initialPath)}">\u6253\u5f00 wiki</a>
        </header>
        <nav class="wiki-page__tabs" aria-label="Page tools">
          <div class="wiki-page__tab-group wiki-page__tab-group--mode" data-wiki-page-mode-group>
            <a class="is-active" aria-current="page">Article</a>
            <button type="button" class="wiki-page__tab-action" data-wiki-action="talk">Talk</button>
          </div>
          <div class="wiki-page__tab-group wiki-page__tab-group--tools" data-wiki-reading-tools-group>
            <a class="is-active" aria-current="page">Read</a>
            <button type="button" class="wiki-page__tab-action" data-wiki-toc-toggle aria-pressed="false">目录</button>
            <button type="button" class="wiki-page__tab-action" data-wiki-comment-action>Comment</button>
          </div>
        </nav>
      </div>
      <div class="wiki-page__body" data-wiki-body>
        <section class="wiki-page__lead">
          <div>
            <div class="wiki-page__article-path" data-wiki-path>wiki/index.md</div>
            <p class="wiki-page__article-meta" data-wiki-meta>Loading article...</p>
          </div>
        </section>
        <div class="wiki-page__selection-toolbar" data-wiki-selection-toolbar hidden>
          <button type="button" class="wiki-page__tab-action" data-wiki-selection-comment>评论</button>
          <button type="button" class="wiki-page__tab-action" data-wiki-selection-copy>复制</button>
          <button type="button" class="wiki-page__tab-action" data-wiki-selection-cancel>取消</button>
        </div>
        <div class="wiki-page__article-layout">
          <article class="wiki-page__article markdown-rendered" data-wiki-article>
            <div class="wiki-page__empty-state">
              <h2>Loading Farzapedia...</h2>
              <p>The personal encyclopedia is preparing the default article.</p>
            </div>
          </article>
          <aside class="wiki-comments-panel wiki-page__comments">
            <div class="wiki-comments-panel__header">
              <div>
                <div class="wiki-page__eyebrow">COMMENTS</div>
                <h2 class="wiki-comments-panel__title">评论</h2>
              </div>
              <div class="wiki-comments-panel__actions">
                <button type="button" class="wiki-page__tab-action" data-wiki-comments-close>关闭</button>
              </div>
            </div>
            <p class="wiki-comments-panel__hint">这里保存当前 wiki 页评论；会和对话页预览中的同一路径评论互通。</p>
            <p class="wiki-comments-panel__status" data-wiki-comments-status>选中文本后点击浮动“评论”。</p>
            <div data-wiki-comments-list></div>
          </aside>
        </div>
        <aside class="wiki-page__toc" data-wiki-toc-panel hidden>
          <div class="wiki-page__toc-resize panel-resize-handle" data-wiki-toc-resize></div>
          <div class="wiki-page__toc-card">
            <div class="wiki-page__toc-header">
              <div>
                <div class="wiki-page__eyebrow">CONTENTS</div>
                <h2>目录</h2>
              </div>
              <button type="button" class="wiki-page__toc-close" aria-label="关闭目录" data-wiki-toc-close>&times;</button>
            </div>
            <nav class="wiki-page__toc-list" data-wiki-toc-list>
              <div class="wiki-page__placeholder">当前页面没有目录</div>
            </nav>
          </div>
        </aside>
        <section class="wiki-page__modules">
          <section class="wiki-page__module wiki-page__module--categories">
            <h2>Categories</h2>
            <div class="wiki-page__module-body" data-wiki-categories>
              <div class="wiki-page__placeholder">Loading categories...</div>
            </div>
          </section>
          <section class="wiki-page__module wiki-page__module--recent">
            <h2>Recently updated</h2>
            <div class="wiki-page__module-body" data-wiki-recent>
              <div class="wiki-page__placeholder">Loading recent pages...</div>
            </div>
          </section>
          <section class="wiki-page__module wiki-page__module--about">
            <h2>About</h2>
            <div class="wiki-page__module-body" data-wiki-about>
              <p>Farzapedia is the local Wikipedia-style reader for the compiled wiki.</p>
            </div>
          </section>
        </section>
      </div>
    </main>
  `;

  const refs = getRefs(root);
  const controller = new AbortController();
  const comments = createCommentsSurface(refs);
  const disposeToc = bindWikiToc(root, refs);
  const selectionToolbar = bindWikiSelectionToolbar(refs, comments);

  root.__dispose = () => {
    controller.abort();
    disposeToc();
    selectionToolbar.dispose();
    clearWikiPageTimers(root);
  };
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const renderedWikilink = target.closest<HTMLAnchorElement>("a.wikilink");
    if (renderedWikilink) {
      const url = new URL(renderedWikilink.href, window.location.origin);
      const page = url.searchParams.get("page");
      if (page) {
        event.preventDefault();
        const nextHash = wikiHref(page, url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined);
        if (window.location.hash !== nextHash) {
          window.location.hash = nextHash;
        }
        return;
      }
    }
    const wikiLink = target.closest<HTMLAnchorElement>("a[href^='#/wiki/']");
    if (wikiLink) {
      event.preventDefault();
      const nextHash = wikiLink.getAttribute("href");
      if (!nextHash) return;
      const parsed = parseWikiHref(nextHash);
      if (parsed?.anchor && parsed.path === root.dataset.wikiCurrentPath) {
        const anchorTarget = refs.article.querySelector<HTMLElement>(`#${cssEscape(parsed.anchor)}`);
        if (anchorTarget) {
          highlightWikiAnchorTarget(root, anchorTarget);
          scrollWikiTargetIntoView(anchorTarget);
          return;
        }
      }
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
      return;
    }
    const action = target.closest<HTMLElement>("[data-wiki-action]")?.dataset.wikiAction;
    if (!action) {
      return;
    }
    const currentPath = root.dataset.wikiCurrentPath ?? DEFAULT_INDEX_PATH;
    if (action === "talk") {
      queueWikiPageForChat(currentPath);
      window.location.hash = "#/chat";
      return;
    }
  });
  refs.commentAction.addEventListener("click", () => {
    if (refs.commentPanel.hidden) {
      closeWikiToc(refs);
    }
    comments.toggle();
  });
  refs.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = refs.searchInput.value.trim();
    if (!query) {
      void loadWikiPage(root, refs, controller.signal, comments, selectionToolbar);
      return;
    }
    void runWikiSearch(root, refs, query, controller.signal, comments, selectionToolbar);
  });

  void loadWikiPage(root, refs, controller.signal, comments, selectionToolbar, initialAnchor);
  return root;
}

async function runWikiSearch(
  root: DisposableNode,
  refs: ReturnType<typeof getRefs>,
  query: string,
  signal: AbortSignal,
  comments: WikiCommentSurfaceController,
  selectionToolbar: WikiSelectionToolbarController,
): Promise<void> {
  try {
    selectionToolbar.reset();
    refs.title.textContent = `搜索：${query}`;
    refs.path.textContent = "/api/search";
    refs.meta.textContent = "Searching local wiki, raw, sources_full, and vector index...";
    refs.article.innerHTML = `<div class="wiki-page__placeholder">Searching...</div>`;

    const response = await fetch(
      `/api/search?scope=local&mode=hybrid&q=${encodeURIComponent(query)}`,
      { signal },
    );
    const payload = (await response.json()) as ApiResponse<WikiSearchResponse>;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Search failed");
    }
    if (signal.aborted) return;
    renderSearchResults(refs, query, payload.data.local.results);
    renderWikiTableOfContents(root, refs, []);
    selectionToolbar.reset();
    comments.clear("搜索结果不支持评论。");
  } catch {
    if (signal.aborted) return;
    refs.meta.textContent = "Search failed";
    refs.article.innerHTML = `
      <div class="wiki-page__empty-state">
        <h2>Search failed.</h2>
        <p>The unified local search endpoint did not return results.</p>
      </div>
    `;
    renderWikiTableOfContents(root, refs, []);
    selectionToolbar.reset();
    comments.clear("搜索结果不支持评论。");
  }
}

function renderSearchResults(refs: ReturnType<typeof getRefs>, query: string, results: WikiSearchResult[]): void {
  refs.title.textContent = `搜索：${query}`;
  refs.path.textContent = "/api/search";
  refs.meta.textContent = `${results.length} local result${results.length === 1 ? "" : "s"}`;
  refs.article.innerHTML = results.length === 0
    ? `
      <div class="wiki-page__empty-state">
        <h2>No results.</h2>
        <p>No local wiki, raw, sources_full, or vector result matched <code>${escapeHtml(query)}</code>.</p>
      </div>
    `
    : `
      <section class="wiki-page__search-results">
        ${results.map((result) => `
          <article class="wiki-page__search-result">
            <h2><a href="${wikiHref(result.path)}" title="${escapeHtml(result.path)}">${escapeHtml(result.title)}</a></h2>
            <p>${escapeHtml(result.excerpt || result.path)}</p>
            <div class="wiki-page__search-meta">
              <code>${escapeHtml(result.path)}</code>
              ${result.modifiedAt ? `<span>${escapeHtml(formatDate(result.modifiedAt))}</span>` : ""}
              ${result.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
            </div>
          </article>
        `).join("")}
      </section>
    `;
}

async function loadWikiPage(
  root: DisposableNode,
  refs: ReturnType<typeof getRefs>,
  signal: AbortSignal,
  comments: WikiCommentSurfaceController,
  selectionToolbar: WikiSelectionToolbarController,
  initialAnchor = "",
): Promise<void> {
  try {
    const currentPath = root.dataset.wikiCurrentPath ?? DEFAULT_INDEX_PATH;
    const [treeResponse, pageResponse] = await Promise.all([
      fetch("/api/tree?layer=wiki", { signal }),
      fetchPage(currentPath, signal),
    ]);

    if (signal.aborted) return;

    const tree = treeResponse.ok ? ((await treeResponse.json()) as WikiTreeNode) : null;
    const page = pageResponse;
    const treePages = flattenTree(tree);
    const pageCards = await loadRecentPages(treePages, signal);

    if (signal.aborted) return;
    if (refs.searchInput.value.trim()) return;

    renderPageData(refs, {
      article: page,
      navigation: buildNavigation(treePages),
      categories: buildCategories(tree),
      recentlyUpdated: pageCards,
    });
    selectionToolbar.reset();
    renderWikiTableOfContents(root, refs);
    scrollToWikiAnchor(root, refs.article, initialAnchor);
    if (page) {
      await comments.setDocument(page.path, page.html || "", {
        sourceEditable: page.sourceEditable,
        onPageConfirmed: (confirmedPage) => {
          root.dataset.wikiCurrentPath = confirmedPage.path;
          root.dataset.wikiCurrentAnchor = "";
          updatePageChrome(refs, confirmedPage);
          renderWikiTableOfContents(root, refs);
        },
      });
    } else {
      selectionToolbar.reset();
      comments.clear("当前页面还没有可评论正文。");
    }
  } catch {
    if (signal.aborted) return;
    if (refs.searchInput.value.trim()) return;
    renderEmptyState(refs);
    selectionToolbar.reset();
    renderWikiTableOfContents(root, refs, []);
    comments.clear("当前页面还没有可评论正文。");
  }
}

function scrollToWikiAnchor(root: DisposableNode, article: HTMLElement, anchor: string): void {
  if (!anchor) {
    return;
  }
  let attempts = 0;
  const maxAttempts = 24;

  const tryScroll = (): void => {
    const target = article.querySelector<HTMLElement>(`#${cssEscape(anchor)}`);
    if (!target) {
      if (attempts < maxAttempts) {
        attempts += 1;
        scheduleWikiPageTimer(root, tryScroll, 32);
      }
      return;
    }

    highlightWikiAnchorTarget(root, target);
    scrollWikiTargetIntoView(target);

    if (attempts < 2) {
      attempts += 1;
      scheduleWikiPageTimer(root, tryScroll, 48);
    }
  };

  scheduleWikiPageTimer(root, tryScroll, 0);
}

function scrollWikiTargetIntoView(target: HTMLElement): void {
  const scrollContainer = findScrollContainer(target);
  if (!scrollContainer) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const top = targetRect.top - containerRect.top + scrollContainer.scrollTop - 24;
  scrollContainer.scrollTo({
    top: Math.max(top, 0),
    behavior: "smooth",
  });
}

function findScrollContainer(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement;
  while (current) {
    const styles = window.getComputedStyle(current);
    const overflowY = styles.overflowY;
    const overflow = styles.overflow;
    const scrollable = overflowY === "auto"
      || overflowY === "scroll"
      || overflow === "auto"
      || overflow === "scroll";
    if (scrollable && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function highlightWikiAnchorTarget(root: DisposableNode, target: HTMLElement): void {
  target.classList.add("wiki-page__anchor-target");
  scheduleWikiPageTimer(root, () => {
    target.classList.remove("wiki-page__anchor-target");
  }, 1600);
}

function scheduleWikiPageTimer(root: HTMLElement, callback: () => void, delay: number): void {
  const timerSet = wikiPageTimers.get(root);
  const timeoutId = window.setTimeout(() => {
    timerSet?.delete(timeoutId);
    callback();
  }, delay);
  timerSet?.add(timeoutId);
}

function clearWikiPageTimers(root: HTMLElement): void {
  const timerSet = wikiPageTimers.get(root);
  if (!timerSet) {
    return;
  }
  for (const timeoutId of timerSet) {
    window.clearTimeout(timeoutId);
  }
  timerSet.clear();
  wikiPageTimers.delete(root);
}

async function fetchPage(path: string, signal: AbortSignal): Promise<WikiPageResponse | null> {
  const response = await fetch(`/api/page?path=${encodeURIComponent(path)}`, { signal });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as WikiPageResponse;
}

async function loadRecentPages(paths: WikiPageLink[], signal: AbortSignal): Promise<WikiPageCard[]> {
  const candidates = paths.filter((item) => item.path !== DEFAULT_INDEX_PATH).slice(0, 6);
  const results = await Promise.all(
    candidates.map(async (item) => {
      try {
        const page = await fetchPage(item.path, signal);
        if (!page?.modifiedAt) return null;
        return {
          path: item.path,
          title: page.title ?? item.title,
          modifiedAt: page.modifiedAt,
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((item): item is WikiPageCard => item !== null).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function renderPageData(refs: ReturnType<typeof getRefs>, data: WikiPageData): void {
  const article = data.article;
  if (article) {
    updatePageChrome(refs, article);
    refs.article.innerHTML = article.html || `
      <div class="wiki-page__empty-state">
        <h2>${escapeHtml(article.title ?? "Wiki")}</h2>
        <p>This page exists, but it does not contain rendered article content yet.</p>
      </div>
    `;
  } else {
    renderEmptyState(refs);
  }

  refs.navigation.innerHTML = renderLinks(data.navigation);
  refs.sidebarCategories.innerHTML = renderDirectoryList(data.categories, "No categories yet");
  refs.categories.innerHTML = renderDirectoryList(data.categories, "No categories indexed yet");
  refs.recent.innerHTML = renderRecentList(data.recentlyUpdated);
  refs.about.innerHTML = `
    <p>Farzapedia is the local Wikipedia-style reader for the compiled wiki.</p>
    <p>It opens <code>wiki/index.md</code> by default and keeps the reading surface separate from the chat shell.</p>
  `;
}

function renderEmptyState(refs: ReturnType<typeof getRefs>): void {
  refs.title.textContent = "Wiki";
  refs.path.textContent = DEFAULT_INDEX_PATH;
  refs.meta.textContent = "No compiled article found";
  refs.openCurrent.href = wikiHref(DEFAULT_INDEX_PATH);
  refs.article.innerHTML = `
    <div class="wiki-page__empty-state">
      <h2>This page does not exist yet.</h2>
      <p>Compile the wiki to generate <code>wiki/index.md</code> and restore the reading view.</p>
      <ul>
        <li>Farzapedia / The Personal Encyclopedia layout stays intact.</li>
        <li>Article and Talk tabs remain available.</li>
        <li>Navigation, Categories, Recently updated, and About sections still render.</li>
      </ul>
    </div>
  `;
  refs.navigation.innerHTML = renderLinks([
    { path: DEFAULT_INDEX_PATH, title: "Main page" },
  ]);
  refs.sidebarCategories.innerHTML = `<div class="wiki-page__placeholder">No categories yet</div>`;
  refs.categories.innerHTML = `<div class="wiki-page__placeholder">No categories indexed yet</div>`;
  refs.recent.innerHTML = `<div class="wiki-page__placeholder">No recent pages yet</div>`;
  refs.about.innerHTML = `
    <p>Farzapedia is the local Wikipedia-style reader for the compiled wiki.</p>
    <p>When the default article is missing, the page still stays structured instead of collapsing into plain text.</p>
  `;
}

function updatePageChrome(refs: ReturnType<typeof getRefs>, article: Pick<WikiPageResponse, "path" | "title" | "modifiedAt">): void {
  refs.title.textContent = article.title ?? "Wiki";
  refs.path.textContent = article.path;
  refs.meta.textContent = article.modifiedAt ? `Updated ${formatDate(article.modifiedAt)}` : "Ready to read";
  refs.openCurrent.href = wikiHref(article.path);
}

function getRefs(root: HTMLElement) {
  return {
    title: root.querySelector<HTMLElement>("[data-wiki-title]")!,
    path: root.querySelector<HTMLElement>("[data-wiki-path]")!,
    meta: root.querySelector<HTMLElement>("[data-wiki-meta]")!,
    article: root.querySelector<HTMLElement>("[data-wiki-article]")!,
    categories: root.querySelector<HTMLElement>("[data-wiki-categories]")!,
    recent: root.querySelector<HTMLElement>("[data-wiki-recent]")!,
    about: root.querySelector<HTMLElement>("[data-wiki-about]")!,
    navigation: root.querySelector<HTMLElement>("[data-wiki-navigation]")!,
    sidebarCategories: root.querySelector<HTMLElement>("[data-wiki-sidebar-categories]")!,
    openCurrent: root.querySelector<HTMLAnchorElement>("[data-wiki-open-current]")!,
    searchForm: root.querySelector<HTMLFormElement>("[data-wiki-search]")!,
    searchInput: root.querySelector<HTMLInputElement>("[data-wiki-search-input]")!,
    commentAction: root.querySelector<HTMLButtonElement>("[data-wiki-comment-action]")!,
    commentClose: root.querySelector<HTMLButtonElement>("[data-wiki-comments-close]")!,
    commentList: root.querySelector<HTMLElement>("[data-wiki-comments-list]")!,
    commentStatus: root.querySelector<HTMLElement>("[data-wiki-comments-status]")!,
    commentPanel: root.querySelector<HTMLElement>(".wiki-page__comments")!,
    selectionToolbar: root.querySelector<HTMLElement>("[data-wiki-selection-toolbar]")!,
    selectionComment: root.querySelector<HTMLButtonElement>("[data-wiki-selection-comment]")!,
    selectionCopy: root.querySelector<HTMLButtonElement>("[data-wiki-selection-copy]")!,
    selectionCancel: root.querySelector<HTMLButtonElement>("[data-wiki-selection-cancel]")!,
    tocToggle: root.querySelector<HTMLButtonElement>("[data-wiki-toc-toggle]")!,
    tocPanel: root.querySelector<HTMLElement>("[data-wiki-toc-panel]")!,
    tocResize: root.querySelector<HTMLElement>("[data-wiki-toc-resize]")!,
    tocList: root.querySelector<HTMLElement>("[data-wiki-toc-list]")!,
    tocClose: root.querySelector<HTMLButtonElement>("[data-wiki-toc-close]")!,
  };
}

function bindWikiSelectionToolbar(
  refs: ReturnType<typeof getRefs>,
  comments: WikiCommentSurfaceController,
): WikiSelectionToolbarController {
  let selectionSnapshot: WikiCommentSelection | null = null;

  const reset = (): void => {
    selectionSnapshot = null;
    refs.selectionToolbar.style.removeProperty("left");
    refs.selectionToolbar.style.removeProperty("top");
    refs.selectionToolbar.style.removeProperty("visibility");
    refs.selectionToolbar.hidden = true;
  };

  const dismissToolbar = (clearSelection: boolean): void => {
    if (clearSelection) {
      window.getSelection()?.removeAllRanges();
    }
    reset();
  };

  const syncSelectionToolbar = (): void => {
    const liveState = readSelectionState(refs.article);
    if (liveState.kind === "inside") {
      selectionSnapshot = liveState.selection;
      if (refs.selectionToolbar.hidden) {
        refs.selectionToolbar.style.visibility = "hidden";
        refs.selectionToolbar.hidden = false;
      }
      refs.selectionToolbar.style.left = `${Math.round(clampSelectionToolbarLeft(liveState.placement.left, refs.selectionToolbar))}px`;
      refs.selectionToolbar.style.top = `${Math.round(liveState.placement.top)}px`;
      refs.selectionToolbar.style.removeProperty("visibility");
      refs.selectionToolbar.hidden = false;
      return;
    }
    if (liveState.kind === "outside") {
      selectionSnapshot = null;
    }
    refs.selectionToolbar.style.removeProperty("left");
    refs.selectionToolbar.style.removeProperty("top");
    refs.selectionToolbar.style.removeProperty("visibility");
    refs.selectionToolbar.hidden = true;
  };

  const onCreateComment = (): void => {
    const preservedSelection = selectionSnapshot;
    dismissToolbar(true);
    closeWikiToc(refs);
    void comments.createFromSelection(preservedSelection);
  };

  const onCopySelection = async (): Promise<void> => {
    if (!selectionSnapshot) {
      dismissToolbar(true);
      return;
    }
    await navigator.clipboard?.writeText?.(selectionSnapshot.quote);
    dismissToolbar(true);
  };

  const onCancelSelection = (): void => {
    dismissToolbar(true);
  };

  const onCopySelectionClick = (): void => {
    void onCopySelection();
  };

  document.addEventListener("selectionchange", syncSelectionToolbar);
  refs.selectionComment.addEventListener("click", onCreateComment);
  refs.selectionCopy.addEventListener("click", onCopySelectionClick);
  refs.selectionCancel.addEventListener("click", onCancelSelection);
  syncSelectionToolbar();

  return {
    reset,
    dispose() {
      document.removeEventListener("selectionchange", syncSelectionToolbar);
      refs.selectionComment.removeEventListener("click", onCreateComment);
      refs.selectionCopy.removeEventListener("click", onCopySelectionClick);
      refs.selectionCancel.removeEventListener("click", onCancelSelection);
    },
  };
}

function readSelectionState(article: HTMLElement):
  | { kind: "inside"; selection: WikiCommentSelection; placement: WikiSelectionToolbarPlacement }
  | { kind: "outside" }
  | { kind: "empty" } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return { kind: "empty" };
  }
  const range = selection.getRangeAt(0);
  if (!article.contains(range.commonAncestorContainer)) {
    return { kind: "outside" };
  }
  const snapshot = locateSelection(article);
  if (!snapshot) {
    return { kind: "empty" };
  }
  const placement = getSelectionToolbarPlacement(range);
  if (!placement) {
    return { kind: "empty" };
  }
  return { kind: "inside", selection: snapshot, placement };
}

function getSelectionToolbarPlacement(range: Range): WikiSelectionToolbarPlacement | null {
  const rect = readRangeRect(range);
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
    return null;
  }
  return {
    left: rect.left + (rect.width / 2),
    top: Math.max(rect.top - 12, 12),
  };
}

function clampSelectionToolbarLeft(anchorLeft: number, toolbar: HTMLElement): number {
  const halfWidth = readSelectionToolbarWidth(toolbar) / 2;
  const minLeft = WIKI_SELECTION_TOOLBAR_GUTTER + halfWidth;
  const maxLeft = Math.max(minLeft, window.innerWidth - WIKI_SELECTION_TOOLBAR_GUTTER - halfWidth);
  return Math.min(Math.max(anchorLeft, minLeft), maxLeft);
}

function readSelectionToolbarWidth(toolbar: HTMLElement): number {
  const rectWidth = toolbar.getBoundingClientRect().width;
  if (rectWidth > 0) {
    return rectWidth;
  }
  if (toolbar.offsetWidth > 0) {
    return toolbar.offsetWidth;
  }
  return WIKI_SELECTION_TOOLBAR_FALLBACK_WIDTH;
}

function readRangeRect(range: Range): DOMRect | DOMRectReadOnly {
  const rangeWithRect = range as Range & { getBoundingClientRect?: () => DOMRect | DOMRectReadOnly };
  if (typeof rangeWithRect.getBoundingClientRect === "function") {
    return rangeWithRect.getBoundingClientRect();
  }

  const fallbackElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as Element
    : range.startContainer.parentElement;
  if (fallbackElement && typeof fallbackElement.getBoundingClientRect === "function") {
    return fallbackElement.getBoundingClientRect();
  }

  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
  };
}

function bindWikiToc(root: DisposableNode, refs: ReturnType<typeof getRefs>): () => void {
  let tocWidth = readPanelWidth("wiki.tocWidth", WIKI_TOC_BOUNDS);
  applyPanelWidth(root, "--wiki-page-toc-width", tocWidth);

  const syncState = (): void => {
    const open = !refs.tocPanel.hidden;
    root.classList.toggle("wiki-page--toc-open", open);
    refs.tocToggle.setAttribute("aria-pressed", open ? "true" : "false");
  };

  const closeToc = (): void => {
    refs.tocPanel.hidden = true;
    syncState();
  };

  const onToggleClick = (): void => {
    if (refs.tocToggle.disabled) {
      return;
    }
    if (refs.tocPanel.hidden) {
      closeWikiComments(refs);
    }
    refs.tocPanel.hidden = !refs.tocPanel.hidden;
    syncState();
  };

  refs.tocToggle.addEventListener("click", onToggleClick);
  refs.tocClose.addEventListener("click", closeToc);

  const disposeResize = attachResizeHandle({
    handle: refs.tocResize,
    onMove(event) {
      tocWidth = clampPanelWidth(window.innerWidth - 24 - event.clientX, WIKI_TOC_BOUNDS);
      applyPanelWidth(root, "--wiki-page-toc-width", tocWidth);
    },
    onEnd() {
      tocWidth = writePanelWidth("wiki.tocWidth", tocWidth, WIKI_TOC_BOUNDS);
      applyPanelWidth(root, "--wiki-page-toc-width", tocWidth);
    },
  });

  syncState();
  return () => {
    refs.tocToggle.removeEventListener("click", onToggleClick);
    refs.tocClose.removeEventListener("click", closeToc);
    disposeResize();
  };
}

function closeWikiToc(refs: ReturnType<typeof getRefs>): void {
  if (!refs.tocPanel.hidden) {
    refs.tocClose.click();
  }
}

function closeWikiComments(refs: ReturnType<typeof getRefs>): void {
  if (!refs.commentPanel.hidden) {
    refs.commentClose.click();
  }
}

function renderWikiTableOfContents(
  root: DisposableNode,
  refs: ReturnType<typeof getRefs>,
  entries = collectWikiTocEntries(refs.article),
): void {
  if (entries.length === 0) {
    refs.tocList.innerHTML = `<div class="wiki-page__placeholder">当前页面没有目录</div>`;
    refs.tocToggle.disabled = true;
    refs.tocPanel.hidden = true;
    root.classList.remove("wiki-page--toc-open");
    refs.tocToggle.setAttribute("aria-pressed", "false");
    return;
  }

  refs.tocToggle.disabled = false;
  refs.tocList.innerHTML = entries.map((entry) => `
    <button
      type="button"
      class="wiki-page__toc-link wiki-page__toc-link--level-${entry.level}"
      data-wiki-toc-target="${escapeHtml(entry.id)}"
    >${escapeHtml(entry.label)}</button>
  `).join("");

  refs.tocList.querySelectorAll<HTMLButtonElement>("[data-wiki-toc-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.wikiTocTarget;
      if (!targetId) {
        return;
      }
      const target = refs.article.querySelector<HTMLElement>(`#${cssEscape(targetId)}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function collectWikiTocEntries(article: HTMLElement): WikiTocEntry[] {
  const headings = Array.from(article.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4"));
  return headings.map((heading, index) => {
    const level = Number(heading.tagName.slice(1));
    const id = heading.id || `wiki-heading-${index}`;
    heading.id = id;
    return {
      id,
      label: heading.textContent?.trim() || `Section ${index + 1}`,
      level,
    };
  });
}

function flattenTree(tree: WikiTreeNode | null): WikiPageLink[] {
  if (!tree) return [];
  const nodes: WikiPageLink[] = [];
  const visit = (node: WikiTreeNode): void => {
    if (node.kind === "file") {
      nodes.push({
        path: node.path,
        title: pageTitleFromPath(node.path, node.name),
      });
      return;
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(tree);
  return nodes;
}

function buildNavigation(paths: WikiPageLink[]): WikiPageLink[] {
  return paths.slice(0, 8);
}

function buildCategories(tree: WikiTreeNode | null): WikiDirectory[] {
  const children = tree?.children?.find((child) => child.kind === "dir" && child.name === "wiki")?.children ?? tree?.children ?? [];
  return children
    .filter((child) => child.kind === "dir")
    .slice(0, 4)
    .map((child) => ({
      name: pageTitleFromPath(child.path, child.name),
      pages: (child.children ?? [])
        .filter((grandChild) => grandChild.kind === "file")
        .slice(0, 5)
        .map((grandChild) => ({
          path: grandChild.path,
          title: pageTitleFromPath(grandChild.path, grandChild.name),
        })),
    }));
}

function renderLinks(items: WikiPageLink[]): string {
  if (items.length === 0) {
    return `<div class="wiki-page__placeholder">No navigation items yet</div>`;
  }
  return items
    .map(
      (item) => `<a href="${wikiHref(item.path)}" title="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a>`,
    )
    .join("");
}

function renderDirectoryList(items: WikiDirectory[], emptyLabel: string): string {
  if (items.length === 0) {
    return `<div class="wiki-page__placeholder">${escapeHtml(emptyLabel)}</div>`;
  }
  return items
    .map(
      (item) => `
        <div class="wiki-page__directory">
          <h3>${escapeHtml(item.name)}</h3>
          <ul>
            ${
              item.pages.length === 0
                ? `<li class="wiki-page__placeholder">${escapeHtml(emptyLabel)}</li>`
                : item.pages
                    .map(
                      (page) =>
                        `<li><a href="${wikiHref(page.path)}" title="${escapeHtml(page.path)}">${escapeHtml(page.title)}</a></li>`,
                    )
                    .join("")
            }
          </ul>
        </div>
      `,
    )
    .join("");
}

function renderRecentList(items: WikiPageCard[]): string {
  if (items.length === 0) {
    return `<div class="wiki-page__placeholder">No recent pages yet</div>`;
  }
  return `
    <ul class="wiki-page__recent-list">
      ${items
        .map(
          (item) => `
            <li>
              <a href="${wikiHref(item.path)}" title="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a>
              <span>${escapeHtml(formatDate(item.modifiedAt))}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function pageTitleFromPath(path: string, fallback: string): string {
  const base = path.split("/").pop() ?? fallback;
  return base.replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
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

function cssEscape(value: string): string {
  const css = (window as Window & { CSS?: { escape?: (input: string) => string } }).CSS;
  if (typeof css?.escape === "function") {
    return css.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function wikiHref(path: string, anchor?: string): string {
  const route = `#/wiki/${encodeURIComponent(path)}`;
  return anchor ? `${route}#${encodeURIComponent(anchor)}` : route;
}

function parseWikiHref(href: string): { path: string; anchor: string } | null {
  if (!href.startsWith("#/wiki/")) return null;
  const rest = href.slice(7);
  const hashIdx = rest.indexOf("#");
  if (hashIdx === -1) {
    return { path: decodeURIComponent(rest), anchor: "" };
  }
  return {
    path: decodeURIComponent(rest.slice(0, hashIdx)),
    anchor: decodeURIComponent(rest.slice(hashIdx + 1)),
  };
}

function createCommentsSurface(refs: ReturnType<typeof getRefs>): WikiCommentSurfaceController {
  return createWikiCommentSurface({
    content: refs.article,
    list: refs.commentList,
    status: refs.commentStatus,
    panel: refs.commentPanel,
    closeButton: refs.commentClose,
    emptyLabel: "当前 wiki 页还没有评论。",
  });
}

function queueWikiPageForChat(path: string): void {
  const storageKey = "llmWiki.pendingChatArticleRefs";
  let current: string[] = [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        current = parsed.filter((item): item is string => typeof item === "string");
      }
    }
  } catch {
    current = [];
  }
  if (!current.includes(path)) {
    current.unshift(path);
  }
  window.localStorage.setItem(storageKey, JSON.stringify(current.slice(0, 12)));
}
