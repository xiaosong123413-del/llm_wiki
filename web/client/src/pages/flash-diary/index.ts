/**
 * Flash-diary workspace page.
 *
 * Binds the left rail, editable markdown panel, and rendered Memory view for
 * the flash-diary workflow.
 */
import {
  applyPanelWidth,
  clampPanelWidth,
  readPanelWidth,
  writePanelWidth,
  type PanelWidthBounds,
} from "../../shell/panel-layout.js";
import { attachResizeHandle } from "../../shell/resize-handle.js";
import { createWikiCommentSurface, type WikiCommentSurfaceController } from "../../components/wiki-comments.js";
import {
  createWikiSelectionToolbar,
  type WikiSelectionToolbarController,
} from "../../components/wiki-selection-toolbar.js";
import {
  applyDiaryView,
  applyDocumentView,
  applyMemoryView,
  bindListActions,
  createDefaultMemorySummary,
  createPageState,
  formatMemoryMeta,
  MEMORY_PATH,
  MEMORY_TITLE,
  renderList,
  resetView,
  syncActiveItem,
  TWELVE_QUESTIONS_PATH,
  type ApiResponse,
  type FlashDiaryListPayload,
  type FlashDiaryMemoryPageResponse,
  type FlashDiaryPageRefs,
  type FlashDiaryPageResponse,
} from "./view-helpers.js";

type DisposableNode = HTMLElement & {
  __dispose?: () => void;
};

const FLASH_DIARY_LIST_BOUNDS: PanelWidthBounds = {
  defaultWidth: 304,
  minWidth: 252,
  maxWidth: 420,
};

export function renderFlashDiaryPage(): HTMLElement {
  const root = document.createElement("section") as DisposableNode;
  root.className = "flash-diary-page";
  root.innerHTML = renderPageShell();
  bindFlashDiaryPage(root);
  return root;
}

function renderPageShell(): string {
  return `
    <div class="flash-diary-page__workspace">
      <aside class="flash-diary-page__list-panel">
        <div class="flash-diary-page__panel-header">
          <h2>以往日记</h2>
          <button type="button" class="btn btn-secondary btn-inline" data-flash-diary-refresh>刷新</button>
        </div>
        <div class="flash-diary-page__list" data-flash-diary-list>
          <div class="flash-diary-page__empty">正在读取闪念日记...</div>
        </div>
      </aside>
      <div
        class="panel-resize-handle panel-resize-handle--page"
        data-panel-handle="flashDiary.listWidth"
        aria-hidden="true"
      ></div>
      <section class="flash-diary-page__editor-panel">
        <div class="flash-diary-page__panel-header">
          <div>
            <h2 data-flash-diary-current-title>未选中文档</h2>
            <p data-flash-diary-current-meta>请从左侧选择一篇日记、十二个问题或 Memory。</p>
          </div>
          <div class="flash-diary-page__actions">
            <button type="button" class="btn btn-primary btn-inline" data-flash-diary-save disabled>保存当前文档</button>
            <button type="button" class="btn btn-secondary btn-inline" data-flash-diary-memory-refresh hidden>刷新 Memory</button>
            <button type="button" class="btn btn-secondary btn-inline" data-flash-diary-memory-comment hidden>评论</button>
          </div>
        </div>
        <textarea class="flash-diary-page__editor" data-flash-diary-editor spellcheck="false" placeholder="尚未加载日记"></textarea>
        <div class="flash-diary-page__memory-layout" data-flash-diary-memory-layout data-wiki-comments-open="false" hidden>
          <div class="wiki-page__selection-toolbar" data-flash-diary-selection-toolbar hidden>
            <button type="button" class="wiki-page__tab-action" data-flash-diary-selection-comment>评论</button>
            <button type="button" class="wiki-page__tab-action" data-flash-diary-selection-copy>复制</button>
            <button type="button" class="wiki-page__tab-action" data-flash-diary-selection-cancel>取消</button>
          </div>
          <article class="flash-diary-page__memory-article markdown-rendered" data-flash-diary-memory-body>
            <div class="flash-diary-page__empty">请选择左侧记忆卡片。</div>
          </article>
          <aside class="wiki-comments-panel flash-diary-page__memory-comments" data-flash-diary-memory-comments hidden>
            <div class="wiki-comments-panel__header">
              <div>
                <div class="eyebrow">COMMENTS</div>
                <h3 class="wiki-comments-panel__title">评论</h3>
              </div>
              <button type="button" class="btn btn-secondary btn-inline" data-flash-diary-memory-comments-close>关闭</button>
            </div>
            <p class="wiki-comments-panel__hint">这里保存当前 Memory 页面评论；AI 自动解决会直接写回 journal-memory.md。</p>
            <p class="wiki-comments-panel__status" data-wiki-comments-status>选中文本后点击“评论”。</p>
            <div data-wiki-comments-list></div>
          </aside>
        </div>
      </section>
    </div>
  `;
}

function bindFlashDiaryPage(root: DisposableNode): void {
  const refs = getRefs(root);
  const comments = createMemoryCommentSurface(refs);
  const selectionToolbar = createMemorySelectionToolbar(refs, comments);
  const state = createPageState();
  const workspace = root.querySelector<HTMLElement>(".flash-diary-page__workspace")!;
  const resizeHandle = root.querySelector<HTMLElement>("[data-panel-handle='flashDiary.listWidth']")!;
  let listWidth = readPanelWidth("flashDiary.listWidth", FLASH_DIARY_LIST_BOUNDS);
  applyPanelWidth(workspace, "--flash-diary-list-width", listWidth);

  refs.refreshButton.addEventListener("click", () => {
    void loadList();
  });
  refs.saveButton.addEventListener("click", () => {
    void saveCurrentEditablePage();
  });
  refs.memoryRefreshButton.addEventListener("click", () => {
    void openMemory();
  });
  refs.memoryCommentButton.addEventListener("click", () => {
    if (window.getSelection()?.toString().trim()) {
      selectionToolbar.reset();
      void comments.createFromSelection(null);
      return;
    }
    comments.toggle();
  });
  refs.editor.addEventListener("input", () => {
    refs.saveButton.disabled = (state.view !== "diary" && state.view !== "document") || refs.editor.value === state.savedRaw;
  });

  const disposeResize = attachResizeHandle({
    handle: resizeHandle,
    onMove(event) {
      const rect = workspace.getBoundingClientRect();
      listWidth = clampPanelWidth(event.clientX - rect.left, FLASH_DIARY_LIST_BOUNDS);
      applyPanelWidth(workspace, "--flash-diary-list-width", listWidth);
    },
    onEnd() {
      listWidth = writePanelWidth("flashDiary.listWidth", listWidth, FLASH_DIARY_LIST_BOUNDS);
      applyPanelWidth(workspace, "--flash-diary-list-width", listWidth);
    },
  });

  const refreshFromDesktop = () => {
    void loadList();
  };
  window.addEventListener("llmwiki:flash-diary-refresh", refreshFromDesktop);
  root.__dispose = () => {
    window.removeEventListener("llmwiki:flash-diary-refresh", refreshFromDesktop);
    disposeResize();
    selectionToolbar.dispose();
  };

  void loadList();

  async function loadList(): Promise<void> {
    refs.list.innerHTML = `<div class="flash-diary-page__empty">正在读取闪念日记...</div>`;
    try {
      const response = await fetch("/api/flash-diary");
      const payload = (await response.json()) as ApiResponse<FlashDiaryListPayload>;
      state.items = payload.data?.items ?? [];
      state.memory = payload.data?.memory ?? createDefaultMemorySummary();
      state.twelveQuestions = payload.data?.twelveQuestions ?? state.twelveQuestions;
      renderList(refs.list, state);
      bindListActions(refs.list, { openDiary, openMemory, openTwelveQuestions });
      await restoreActiveView();
    } catch {
      refs.list.innerHTML = `<div class="flash-diary-page__empty">闪念日记列表读取失败。</div>`;
      resetView(selectionToolbar, comments, refs, state);
    }
  }

  async function restoreActiveView(): Promise<void> {
    if (state.view === "memory" || state.currentPath === MEMORY_PATH) {
      await openMemory();
      return;
    }
    if (state.view === "document" || state.currentPath === TWELVE_QUESTIONS_PATH) {
      await openTwelveQuestions();
      return;
    }
    if (state.items.length === 0) {
      resetView(selectionToolbar, comments, refs, state);
      renderList(refs.list, state, true);
      bindListActions(refs.list, { openDiary, openMemory, openTwelveQuestions });
      return;
    }
    const nextPath = state.items.some((item) => item.path === state.currentPath)
      ? state.currentPath
      : state.items[0]!.path;
    await openDiary(nextPath);
  }

  async function openDiary(relativePath: string): Promise<void> {
    if (!relativePath) {
      return;
    }
    try {
      const response = await fetch(`/api/flash-diary/page?path=${encodeURIComponent(relativePath)}`);
      const payload = (await response.json()) as ApiResponse<FlashDiaryPageResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        return;
      }
      state.view = "diary";
      state.currentPath = payload.data.path;
      state.savedRaw = payload.data.raw;
      selectionToolbar.reset();
      applyDiaryView(refs, payload.data, state);
      comments.clear("当前打开的是日记原文。");
      syncActiveItem(refs.list, state.currentPath);
    } catch {
      resetView(selectionToolbar, comments, refs, state);
    }
  }

  async function openTwelveQuestions(): Promise<void> {
    try {
      const response = await fetch(`/api/flash-diary/page?path=${encodeURIComponent(TWELVE_QUESTIONS_PATH)}`);
      const payload = (await response.json()) as ApiResponse<FlashDiaryPageResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        selectionToolbar.reset();
        state.view = "document";
        state.currentPath = TWELVE_QUESTIONS_PATH;
        state.savedRaw = "";
        refs.title.textContent = "十二个问题";
        refs.meta.textContent = "文档不存在";
        refs.editor.value = "";
        refs.editor.placeholder = "十二个问题文档不存在";
        refs.editor.readOnly = true;
        refs.editor.hidden = false;
        refs.memoryLayout.hidden = true;
        refs.saveButton.hidden = true;
        refs.saveButton.disabled = true;
        refs.memoryRefreshButton.hidden = true;
        refs.memoryCommentButton.hidden = true;
        comments.clear("十二个问题文档不存在。");
        syncActiveItem(refs.list, TWELVE_QUESTIONS_PATH);
        return;
      }
      state.currentPath = payload.data.path;
      state.savedRaw = payload.data.raw;
      selectionToolbar.reset();
      applyDocumentView(refs, payload.data, state, state.twelveQuestions);
      comments.clear("当前打开的是可编辑 Markdown 文档。");
      syncActiveItem(refs.list, state.currentPath);
    } catch {
      resetView(selectionToolbar, comments, refs, state);
    }
  }

  async function openMemory(): Promise<void> {
    try {
      const response = await fetch("/api/flash-diary/memory");
      const payload = (await response.json()) as ApiResponse<FlashDiaryMemoryPageResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Memory 加载失败。");
      }
      state.view = "memory";
      state.currentPath = payload.data.path;
      state.savedRaw = payload.data.raw;
      state.memory = {
        ...state.memory,
        exists: true,
        modifiedAt: payload.data.modifiedAt,
        lastAppliedDiaryDate: payload.data.lastAppliedDiaryDate,
      };
      selectionToolbar.reset();
      applyMemoryView(refs, payload.data);
      syncActiveItem(refs.list, MEMORY_PATH);
      void comments.setDocument(payload.data.path, payload.data.html, {
        sourceEditable: payload.data.sourceEditable,
        refreshPage(page) {
          selectionToolbar.reset();
          state.savedRaw = page.raw;
          state.memory = {
            ...state.memory,
            exists: true,
            modifiedAt: page.modifiedAt ?? state.memory.modifiedAt,
          };
          refs.title.textContent = page.title ?? MEMORY_TITLE;
          refs.meta.textContent = formatMemoryMeta(state.memory);
          renderList(refs.list, state);
          bindListActions(refs.list, { openDiary, openMemory, openTwelveQuestions });
          syncActiveItem(refs.list, MEMORY_PATH);
        },
      });
      renderList(refs.list, state);
      bindListActions(refs.list, { openDiary, openMemory, openTwelveQuestions });
    } catch {
      selectionToolbar.reset();
      refs.title.textContent = MEMORY_TITLE;
      refs.meta.textContent = "Memory 加载失败。";
      refs.memoryBody.innerHTML = `<div class="flash-diary-page__empty">Memory 加载失败。</div>`;
      refs.editor.hidden = true;
      refs.memoryLayout.hidden = false;
      refs.saveButton.hidden = true;
      refs.memoryRefreshButton.hidden = false;
      refs.memoryCommentButton.hidden = false;
      comments.clear("当前 Memory 还没有评论。");
    }
  }

  async function saveCurrentEditablePage(): Promise<void> {
    if ((state.view !== "diary" && state.view !== "document") || !state.currentPath) {
      return;
    }
    try {
      const response = await fetch("/api/flash-diary/page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: state.currentPath,
          raw: refs.editor.value,
        }),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !payload.success) {
        return;
      }
      await reloadCurrentEditablePage(state.currentPath);
      await loadList();
    } catch {
      // Keep current editor content untouched so the user can retry save.
    }
  }

  async function reloadCurrentEditablePage(currentPath: string): Promise<void> {
    if (currentPath === TWELVE_QUESTIONS_PATH) {
      await openTwelveQuestions();
      return;
    }
    await openDiary(currentPath);
  }
}

function createMemoryCommentSurface(refs: ReturnType<typeof getRefs>): WikiCommentSurfaceController {
  return createWikiCommentSurface({
    content: refs.memoryBody,
    list: refs.commentList,
    status: refs.commentStatus,
    panel: refs.memoryCommentsPanel,
    closeButton: refs.memoryCommentsClose,
    emptyLabel: "当前 Memory 还没有评论。",
  });
}

function createMemorySelectionToolbar(
  refs: ReturnType<typeof getRefs>,
  comments: WikiCommentSurfaceController,
): WikiSelectionToolbarController {
  return createWikiSelectionToolbar({
    article: refs.memoryBody,
    toolbar: refs.selectionToolbar,
    commentButton: refs.selectionComment,
    copyButton: refs.selectionCopy,
    cancelButton: refs.selectionCancel,
    comments,
  });
}

function getRefs(root: HTMLElement): FlashDiaryPageRefs & {
  refreshButton: HTMLButtonElement;
  selectionToolbar: HTMLElement;
  selectionComment: HTMLButtonElement;
  selectionCopy: HTMLButtonElement;
  selectionCancel: HTMLButtonElement;
  memoryCommentsPanel: HTMLElement;
  memoryCommentsClose: HTMLButtonElement;
  commentList: HTMLElement;
  commentStatus: HTMLElement;
} {
  return {
    list: root.querySelector<HTMLElement>("[data-flash-diary-list]")!,
    title: root.querySelector<HTMLElement>("[data-flash-diary-current-title]")!,
    meta: root.querySelector<HTMLElement>("[data-flash-diary-current-meta]")!,
    editor: root.querySelector<HTMLTextAreaElement>("[data-flash-diary-editor]")!,
    saveButton: root.querySelector<HTMLButtonElement>("[data-flash-diary-save]")!,
    refreshButton: root.querySelector<HTMLButtonElement>("[data-flash-diary-refresh]")!,
    memoryRefreshButton: root.querySelector<HTMLButtonElement>("[data-flash-diary-memory-refresh]")!,
    memoryCommentButton: root.querySelector<HTMLButtonElement>("[data-flash-diary-memory-comment]")!,
    memoryLayout: root.querySelector<HTMLElement>("[data-flash-diary-memory-layout]")!,
    memoryBody: root.querySelector<HTMLElement>("[data-flash-diary-memory-body]")!,
    selectionToolbar: root.querySelector<HTMLElement>("[data-flash-diary-selection-toolbar]")!,
    selectionComment: root.querySelector<HTMLButtonElement>("[data-flash-diary-selection-comment]")!,
    selectionCopy: root.querySelector<HTMLButtonElement>("[data-flash-diary-selection-copy]")!,
    selectionCancel: root.querySelector<HTMLButtonElement>("[data-flash-diary-selection-cancel]")!,
    memoryCommentsPanel: root.querySelector<HTMLElement>("[data-flash-diary-memory-comments]")!,
    memoryCommentsClose: root.querySelector<HTMLButtonElement>("[data-flash-diary-memory-comments-close]")!,
    commentList: root.querySelector<HTMLElement>("[data-wiki-comments-list]")!,
    commentStatus: root.querySelector<HTMLElement>("[data-wiki-comments-status]")!,
  };
}
