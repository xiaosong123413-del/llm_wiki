import {
  applyPanelWidth,
  clampPanelWidth,
  readPanelWidth,
  writePanelWidth,
  type PanelWidthBounds,
} from "../../shell/panel-layout.js";
import { attachResizeHandle } from "../../shell/resize-handle.js";
import { renderIcon } from "../../components/icon.js";
import { isCompactMessage, renderMessageHtml } from "./message-markdown.js";
import type { ChatRuntimeSummary } from "./runtime.js";

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  latestMessage: string;
}

interface ChatThreadMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface ChatThreadView {
  id?: string;
  title: string;
  messages: ChatThreadMessage[];
  articleRefs: string[];
}

export interface ChatAppOption {
  id: string;
  name: string;
  mode: string;
  provider: string;
  model: string;
  enabled: boolean;
  accountRef?: string;
}

interface ChatPageOptions {
  onCreateConversation?: () => void;
  onOpenConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onSendMessage?: (content: string) => void;
  onComposerChange?: (content: string) => void;
  onSearchScopeChange?: (scope: ChatSearchScope) => void;
  onAppChange?: (appId: string | null) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onRemoveArticleRef?: (path: string) => void;
}

type ChatSearchScope = "local" | "web" | "both";
export type { ChatSearchScope };

export interface ChatPageHandle {
  newConversationButton: HTMLButtonElement;
  conversationList: HTMLElement;
  messageList: HTMLElement;
  articleRefs: HTMLElement;
  composer: HTMLTextAreaElement;
  composerForm: HTMLFormElement;
  renderConversationList(items: ConversationSummary[], selectedId: string | null): void;
  renderThread(view: ChatThreadView | null): void;
  clearComposer(): void;
  setBusy(isBusy: boolean): void;
  setComposerArticleRefs(paths: string[]): void;
  setComposerDraft(content: string): void;
  setWebSearchEnabled(enabled: boolean): void;
  setSearchScope(scope: ChatSearchScope): void;
  setApps(apps: ChatAppOption[], selectedAppId: string | null): void;
  setApp(appId: string | null): void;
  setRuntimeSummary(summary: ChatRuntimeSummary | null): void;
}

const CHAT_SIDEBAR_BOUNDS: PanelWidthBounds = {
  defaultWidth: 300,
  minWidth: 1,
  maxWidth: 420,
};
const CHAT_SIDEBAR_AUTO_COLLAPSE_WIDTH = 1;

const CHAT_CONVERSATION_SIDEBAR_COLLAPSED_KEY = "llmWiki.chat.conversationSidebarCollapsed";

export function mountChatPage(container: HTMLElement, options: ChatPageOptions = {}): ChatPageHandle {
  container.innerHTML = `
    <div class="chat-workspace" data-chat-sidebar-collapsed="false">
      <aside class="chat-sidebar panel" data-chat-sidebar-collapsed="false">
        <div class="chat-sidebar__header">
          <button
            id="chat-new-conversation"
            class="icon-btn chat-sidebar__action chat-sidebar__action--primary"
            type="button"
            aria-label="\u65b0\u5bf9\u8bdd"
          >
            ${renderIcon("plus", { size: 26 })}
          </button>
          <button
            type="button"
            class="icon-btn chat-sidebar__action chat-sidebar__toggle"
            data-chat-sidebar-toggle
            aria-label="\u6298\u53e0\u4f1a\u8bdd\u680f"
          >
            ${renderIcon("chevron-left", { size: 24 })}
          </button>
        </div>
        <div id="chat-conversation-list" class="chat-conversation-list">
          <p class="muted">\u6682\u65e0\u5bf9\u8bdd</p>
        </div>
        <button
          type="button"
          class="icon-btn chat-sidebar__rail-toggle"
          data-chat-sidebar-rail-toggle
          aria-label="\u5c55\u5f00\u4f1a\u8bdd\u680f"
          hidden
        >
          ${renderIcon("chevron-right", { size: 24 })}
        </button>
      </aside>
      <div
        class="panel-resize-handle panel-resize-handle--page"
        data-panel-handle="chat.sidebarWidth"
        aria-hidden="true"
      ></div>
      <section class="chat-thread panel">
        <div class="chat-thread__header">
          <div>
            <div class="eyebrow">Chat</div>
            <h2 id="chat-thread-title">\u5f00\u59cb\u65b0\u5bf9\u8bdd</h2>
            <div id="chat-runtime-summary" class="chat-runtime-summary hidden"></div>
          </div>
        </div>
        <div class="chat-thread__viewport">
          <div id="chat-message-list" class="chat-message-list">
            <div class="chat-empty-state">
              <p class="chat-empty-state__title">\u5f00\u59cb\u65b0\u5bf9\u8bdd</p>
              <p class="muted">\u70b9\u51fb\u300c+\u65b0\u5bf9\u8bdd\u300d\u5f00\u59cb</p>
            </div>
          </div>
        </div>
        <section id="chat-refs-panel" class="chat-refs-panel hidden" data-chat-refs-panel data-chat-refs-collapsed="false">
          <div class="chat-refs-panel__header">
            <div>
              <div class="eyebrow">Pages</div>
              <strong>\u9009\u4e2d\u5bf9\u8bdd\u9875</strong>
            </div>
            <button type="button" class="btn btn-secondary btn-inline" data-chat-refs-toggle>\u6298\u53e0</button>
          </div>
          <div id="chat-article-refs" class="chat-article-refs hidden"></div>
          <div id="chat-composer-refs" class="chat-composer-refs hidden"></div>
        </section>
        <form id="chat-composer-form" class="chat-composer">
          <div class="chat-composer__controls">
            <label class="chat-composer__agent">
              <span>应用</span>
              <select data-chat-app>
                <option value="">默认应用</option>
              </select>
            </label>
            <div class="chat-composer__scope" role="group" aria-label="\u641c\u7d22\u8303\u56f4">
              <button type="button" class="btn btn-secondary btn-inline is-active" data-chat-search-scope="local">\u5168\u5e93</button>
              <button type="button" class="btn btn-secondary btn-inline" data-chat-search-scope="web">\u5916\u7f51</button>
              <button type="button" class="btn btn-secondary btn-inline" data-chat-search-scope="both">\u4e24\u8005</button>
            </div>
          </div>
          <textarea id="chat-composer" class="input chat-composer__input" placeholder="\u8f93\u5165\u6d88\u606f..." rows="3"></textarea>
          <button id="chat-send" class="btn btn-primary chat-composer__send" type="submit">\u53d1\u9001</button>
        </form>
      </section>
    </div>
  `;

  const newConversationButton = container.querySelector<HTMLButtonElement>("#chat-new-conversation")!;
  const conversationList = container.querySelector<HTMLElement>("#chat-conversation-list")!;
  const messageList = container.querySelector<HTMLElement>("#chat-message-list")!;
  const articleRefs = container.querySelector<HTMLElement>("#chat-article-refs")!;
  const composerRefs = container.querySelector<HTMLElement>("#chat-composer-refs")!;
  const composer = container.querySelector<HTMLTextAreaElement>("#chat-composer")!;
  const composerForm = container.querySelector<HTMLFormElement>("#chat-composer-form")!;
  const threadTitle = container.querySelector<HTMLElement>("#chat-thread-title")!;
  const runtimeSummary = container.querySelector<HTMLElement>("#chat-runtime-summary")!;
  const workspace = container.querySelector<HTMLElement>(".chat-workspace")!;
  const sidebar = container.querySelector<HTMLElement>(".chat-sidebar")!;
  const sendButton = container.querySelector<HTMLButtonElement>("#chat-send")!;
  const sidebarToggleButton = container.querySelector<HTMLButtonElement>("[data-chat-sidebar-toggle]")!;
  const sidebarRailToggleButton = container.querySelector<HTMLButtonElement>("[data-chat-sidebar-rail-toggle]")!;
  const refsPanel = container.querySelector<HTMLElement>("[data-chat-refs-panel]")!;
  const refsToggleButton = container.querySelector<HTMLButtonElement>("[data-chat-refs-toggle]")!;
  const appSelect = container.querySelector<HTMLSelectElement>("[data-chat-app]")!;
  const searchScopeButtons = [...container.querySelectorAll<HTMLButtonElement>("[data-chat-search-scope]")];
  const resizeHandle = container.querySelector<HTMLElement>("[data-panel-handle='chat.sidebarWidth']")!;
  let currentThreadId: string | null = null;
  let searchScope: ChatSearchScope = "local";
  let expandedSidebarWidth = normalizeExpandedSidebarWidth(readPanelWidth("chat.sidebarWidth", CHAT_SIDEBAR_BOUNDS));
  let sidebarWidth = expandedSidebarWidth;
  let conversationSidebarCollapsed = readConversationSidebarCollapsed();
  let refsCollapsed = false;

  applyPanelWidth(workspace, "--chat-sidebar-width", sidebarWidth);
  syncConversationSidebar();
  syncRefsPanel();

  newConversationButton.addEventListener("click", () => {
    options.onCreateConversation?.();
  });

  const setConversationSidebarCollapsed = (collapsed: boolean): void => {
    conversationSidebarCollapsed = collapsed;
    writeConversationSidebarCollapsed(collapsed);
    if (!collapsed) {
      sidebarWidth = expandedSidebarWidth;
      applyPanelWidth(workspace, "--chat-sidebar-width", sidebarWidth);
    }
    syncConversationSidebar();
  };

  const toggleConversationSidebar = (): void => {
    if (conversationSidebarCollapsed) {
      expandedSidebarWidth = normalizeExpandedSidebarWidth(
        writePanelWidth("chat.sidebarWidth", expandedSidebarWidth, CHAT_SIDEBAR_BOUNDS),
      );
      setConversationSidebarCollapsed(false);
      return;
    }
    setConversationSidebarCollapsed(true);
  };

  sidebarToggleButton.addEventListener("click", toggleConversationSidebar);
  sidebarRailToggleButton.addEventListener("click", toggleConversationSidebar);

  refsToggleButton.addEventListener("click", () => {
    refsCollapsed = !refsCollapsed;
    syncRefsPanel();
  });

  const handleConversationListAction = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const deleteButton = target.closest<HTMLButtonElement>("[data-conversation-delete]");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      const id = deleteButton.dataset.conversationDelete;
      if (id) {
        options.onDeleteConversation?.(id);
      }
      return;
    }
    const item = target.closest<HTMLElement>("[data-conversation-id]");
    if (item?.dataset.conversationId) {
      options.onOpenConversation?.(item.dataset.conversationId);
    }
  };

  conversationList.addEventListener("click", handleConversationListAction);

  const bindArticleRefRemoval = (element: HTMLElement): void => {
    element.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const removeButton = target.closest<HTMLButtonElement>("[data-article-ref-remove]");
      if (!removeButton?.dataset.articleRefRemove) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      options.onRemoveArticleRef?.(removeButton.dataset.articleRefRemove);
    });
  };
  bindArticleRefRemoval(articleRefs);
  bindArticleRefRemoval(composerRefs);

  composer.addEventListener("input", () => {
    options.onComposerChange?.(composer.value);
  });

  composer.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    const content = composer.value.trim();
    if (content) {
      options.onSendMessage?.(content);
    }
  });

  composerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = composer.value.trim();
    if (!content) {
      return;
    }
    options.onSendMessage?.(content);
  });

  searchScopeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextScope = normalizeSearchScope(button.dataset.chatSearchScope);
      searchScope = nextScope;
      applySearchScopeState(searchScopeButtons, searchScope);
      options.onSearchScopeChange?.(searchScope);
    });
  });

  appSelect.addEventListener("change", () => {
    options.onAppChange?.(appSelect.value || null);
  });

  threadTitle.addEventListener("dblclick", () => {
    if (!currentThreadId) {
      return;
    }
    beginRename(threadTitle, currentThreadId, options.onRenameConversation);
  });

  attachResizeHandle({
    handle: resizeHandle,
    onMove(event) {
      const rect = workspace.getBoundingClientRect();
      sidebarWidth = clampPanelWidth(event.clientX - rect.left, CHAT_SIDEBAR_BOUNDS);
      applyPanelWidth(workspace, "--chat-sidebar-width", sidebarWidth);
    },
    onEnd() {
      if (sidebarWidth <= CHAT_SIDEBAR_AUTO_COLLAPSE_WIDTH) {
        setConversationSidebarCollapsed(true);
        return;
      }
      expandedSidebarWidth = writePanelWidth("chat.sidebarWidth", sidebarWidth, CHAT_SIDEBAR_BOUNDS);
      sidebarWidth = expandedSidebarWidth;
      applyPanelWidth(workspace, "--chat-sidebar-width", sidebarWidth);
    },
  });

  return {
    newConversationButton,
    conversationList,
    messageList,
    articleRefs,
    composer,
    composerForm,
    renderConversationList(items, selectedId) {
      if (items.length === 0) {
        conversationList.innerHTML = '<p class="muted">\u6682\u65e0\u5bf9\u8bdd</p>';
        return;
      }
      conversationList.innerHTML = items
        .map((item) => `
          <article class="chat-conversation-row${item.id === selectedId ? " active" : ""}">
            <button type="button" class="chat-conversation-item${item.id === selectedId ? " active" : ""}" data-conversation-id="${escapeHtml(item.id)}">
              <span class="chat-conversation-item__title">${escapeHtml(item.title)}</span>
            </button>
            <button type="button" class="icon-btn chat-conversation-item__delete" data-conversation-delete="${escapeHtml(item.id)}" aria-label="\u5220\u9664\u5bf9\u8bdd">
              <span aria-hidden="true">\u00d7</span>
            </button>
          </article>
        `)
        .join("");
    },
    renderThread(view) {
      if (!view) {
        currentThreadId = null;
        threadTitle.textContent = "\u5f00\u59cb\u65b0\u5bf9\u8bdd";
        messageList.innerHTML = `
          <div class="chat-empty-state">
            <p class="chat-empty-state__title">\u5f00\u59cb\u65b0\u5bf9\u8bdd</p>
            <p class="muted">\u70b9\u51fb\u300c+\u65b0\u5bf9\u8bdd\u300d\u5f00\u59cb</p>
          </div>
        `;
        articleRefs.innerHTML = "";
        syncRefsPanel();
        return;
      }

      currentThreadId = view.id ?? null;
      threadTitle.textContent = view.title;
      messageList.innerHTML = view.messages.length > 0
        ? view.messages
          .map((message) => `
            <article class="chat-message chat-message--${message.role}${isCompactMessage(message.content) ? " chat-message--compact" : ""}">
              <div class="chat-message__body markdown-rendered">${renderMessageHtml(message.content)}</div>
            </article>
          `)
          .join("")
        : `
          <div class="chat-empty-state">
            <p class="chat-empty-state__title">${escapeHtml(view.title)}</p>
            <p class="muted">\u8f93\u5165\u7b2c\u4e00\u6761\u6d88\u606f\u5f00\u59cb\u5bf9\u8bdd</p>
          </div>
        `;
      articleRefs.innerHTML = renderArticleRefChips(view.articleRefs);
      syncRefsPanel();
    },
    clearComposer() {
      composer.value = "";
      composer.dispatchEvent(new Event("input"));
    },
    setBusy(isBusy) {
      composer.disabled = isBusy;
      sendButton.disabled = isBusy;
    },
    setComposerArticleRefs(paths) {
      composerRefs.innerHTML = renderArticleRefChips(paths);
      syncRefsPanel();
    },
    setComposerDraft(content) {
      composer.value = content;
    },
    setWebSearchEnabled(_enabled) {
      return;
    },
    setSearchScope(scope) {
      searchScope = scope;
      applySearchScopeState(searchScopeButtons, searchScope);
    },
    setApps(apps, selectedAppId) {
      const enabledApps = apps.filter((app) => app.enabled);
      appSelect.innerHTML = enabledApps.length > 0
        ? enabledApps
          .map((app) => `<option value="${escapeHtml(app.id)}">${escapeHtml(formatAppLabel(app))}</option>`)
          .join("")
        : '<option value="">默认应用</option>';
      appSelect.disabled = enabledApps.length === 0;
      setSelectValue(appSelect, selectedAppId);
    },
    setApp(appId) {
      setSelectValue(appSelect, appId);
    },
    setRuntimeSummary(summary) {
      if (!summary) {
        runtimeSummary.innerHTML = "";
        runtimeSummary.classList.add("hidden");
        return;
      }
      runtimeSummary.innerHTML = `
        <div class="chat-runtime-summary__row">
          <span class="chat-runtime-summary__label">应用</span>
          <strong>${escapeHtml(summary.appLabel)}</strong>
        </div>
        <div class="chat-runtime-summary__row">
          <span class="chat-runtime-summary__label">\u6765\u6e90</span>
          <span>${escapeHtml(summary.sourceLabel)}</span>
        </div>
        <div class="chat-runtime-summary__row">
          <span class="chat-runtime-summary__label">\u63d0\u4f9b\u65b9 / \u6a21\u578b</span>
          <span>${escapeHtml(summary.providerLabel)} 路 ${escapeHtml(summary.modelLabel)}</span>
        </div>
      `;
      runtimeSummary.classList.remove("hidden");
    },
  };

  function syncConversationSidebar(): void {
    const collapsedValue = conversationSidebarCollapsed ? "true" : "false";
    workspace.dataset.chatSidebarCollapsed = collapsedValue;
    sidebar.dataset.chatSidebarCollapsed = collapsedValue;
    sidebarToggleButton.hidden = conversationSidebarCollapsed;
    sidebarToggleButton.setAttribute("aria-pressed", conversationSidebarCollapsed ? "true" : "false");
    sidebarRailToggleButton.hidden = !conversationSidebarCollapsed;
    sidebarRailToggleButton.classList.toggle("hidden", !conversationSidebarCollapsed);
    resizeHandle.toggleAttribute("hidden", conversationSidebarCollapsed);
  }

  function syncRefsPanel(): void {
    const hasThreadRefs = articleRefs.innerHTML.trim().length > 0;
    const hasComposerRefs = composerRefs.innerHTML.trim().length > 0;
    const hasAnyRefs = hasThreadRefs || hasComposerRefs;
    refsPanel.hidden = !hasAnyRefs;
    refsPanel.dataset.chatRefsCollapsed = refsCollapsed ? "true" : "false";
    refsToggleButton.textContent = refsCollapsed ? "展开" : "折叠";
    const hideThreadRefs = refsCollapsed || !hasThreadRefs;
    const hideComposerRefs = refsCollapsed || !hasComposerRefs;
    articleRefs.hidden = hideThreadRefs;
    composerRefs.hidden = hideComposerRefs;
    articleRefs.classList.toggle("hidden", hideThreadRefs);
    composerRefs.classList.toggle("hidden", hideComposerRefs);
  }
}

function beginRename(
  titleNode: HTMLElement,
  conversationId: string,
  onRenameConversation: ChatPageOptions["onRenameConversation"],
): void {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "input chat-thread__title-input";
  input.value = titleNode.textContent ?? "";

  const commit = () => {
    const nextTitle = input.value.trim();
    input.replaceWith(titleNode);
    if (nextTitle) {
      titleNode.textContent = nextTitle;
      onRenameConversation?.(conversationId, nextTitle);
    }
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      input.replaceWith(titleNode);
    }
  });
  input.addEventListener("blur", commit, { once: true });

  titleNode.replaceWith(input);
  input.focus();
  input.select();
}

function applySearchScopeState(buttons: HTMLButtonElement[], scope: ChatSearchScope): void {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", normalizeSearchScope(button.dataset.chatSearchScope) === scope);
  });
}

function normalizeSearchScope(value: string | undefined): ChatSearchScope {
  return value === "web" || value === "both" ? value : "local";
}

function setSelectValue(select: HTMLSelectElement, value: string | null): void {
  const nextValue = value ?? "";
  if ([...select.options].some((option) => option.value === nextValue)) {
    select.value = nextValue;
    return;
  }
  select.value = select.options[0]?.value ?? "";
}

function formatAppLabel(app: ChatAppOption): string {
  const mode = app.mode ? ` · ${formatAppMode(app.mode)}` : "";
  const provider = app.provider ? ` · ${app.provider}` : "";
  const model = app.model ? ` · ${app.model}` : "";
  return `${app.name}${mode}${provider}${model}`;
}

function formatAppMode(mode: string): string {
  switch (mode) {
    case "workflow":
      return "工作流";
    case "knowledge":
      return "知识";
    case "hybrid":
      return "混合";
    default:
      return "对话";
  }
}

function renderArticleRefChips(paths: string[]): string {
  return paths
    .map(
      (path) => `
        <span class="chip chip--removable" title="${escapeHtml(path)}">
          <span>${escapeHtml(path)}</span>
          <button type="button" class="chip__remove" data-article-ref-remove="${escapeHtml(path)}" aria-label="\u79fb\u9664\u5df2\u9009\u9875\u9762">×</button>
        </span>
      `,
    )
    .join("");
}

function readConversationSidebarCollapsed(): boolean {
  return window.localStorage.getItem(CHAT_CONVERSATION_SIDEBAR_COLLAPSED_KEY) === "1";
}

function writeConversationSidebarCollapsed(collapsed: boolean): void {
  window.localStorage.setItem(CHAT_CONVERSATION_SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
}

function normalizeExpandedSidebarWidth(width: number): number {
  const nextWidth = clampPanelWidth(width, CHAT_SIDEBAR_BOUNDS);
  return nextWidth <= CHAT_SIDEBAR_AUTO_COLLAPSE_WIDTH ? CHAT_SIDEBAR_BOUNDS.defaultWidth : nextWidth;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
