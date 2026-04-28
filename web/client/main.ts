import { renderTree, type TreeNode } from "./tree.js";
import { createRouter, type Route, type RouteName } from "./src/router.js";
import { mountRail } from "./src/shell/rail.js";
import { mountBrowser, type BrowserRefs } from "./src/shell/browser.js";
import { createMainSlot } from "./src/shell/main-slot.js";
import { createDrawer, type DrawerHandle } from "./src/shell/drawer.js";
import {
  applyPanelWidth,
  clampPanelWidth,
  readPanelWidth,
  writePanelWidth,
  type PanelWidthBounds,
} from "./src/shell/panel-layout.js";
import { attachResizeHandle } from "./src/shell/resize-handle.js";
import {
  mountChatPage,
  type ChatAppOption,
  type ChatPageHandle,
  type ChatSearchScope,
} from "./src/pages/chat/index.js";
import {
  buildChatRuntimeSummary,
  type ChatAgentRuntimeApiAccount,
  type ChatAgentRuntimeOAuthAccount,
} from "./src/pages/chat/runtime.js";
import { parseSseMessages } from "./src/pages/chat/stream.js";
import { startBackgroundRun, type RunKind } from "./src/background-run.js";
import {
  createDraftConversation,
  getDraftConversationSummary,
  isDraftConversationId,
  type DraftConversation,
} from "./src/pages/chat/drafts.js";

type StartupState = "UNCONFIGURED" | "CONFIGURING" | "INITIALIZING" | "READY";

interface PageResponse {
  path: string;
  title: string | null;
  html: string;
  raw: string;
  frontmatter: Record<string, unknown> | null;
  aliases?: string[];
  sizeBytes?: number;
  modifiedAt?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  latestMessage: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  articleRefs?: string[];
}

interface ConversationResponse {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  webSearchEnabled: boolean;
  searchScope: "local" | "web" | "all";
  appId: string | null;
  articleRefs: string[];
  messages: ChatMessage[];
}

interface AppConfigResponse {
  apps: ChatAppOption[];
  defaultAppId: string | null;
}

interface LlmApiAccountsResponse {
  accounts: ChatAgentRuntimeApiAccount[];
}

interface CLIProxyAccountsResponse {
  accounts: ChatAgentRuntimeOAuthAccount[];
}

interface ServerConfigResponse {
  author?: string;
  wikiRoot?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AppConfig {
  targetRepoPath: string;
  sourceFolders: string[];
  initialized: boolean;
  keyboardShortcuts?: AppShortcuts;
  lastSyncAt?: string;
  lastCompileAt?: string;
}

interface AppShortcuts {
  flashDiaryCapture: string;
}

interface ShortcutStatus {
  shortcuts: AppShortcuts;
  registered: boolean;
  error?: string;
}

interface DesktopConfigResponse {
  projectRoot: string;
  targetVault: string;
  serverUrl: string;
  appConfigPath: string;
}

interface AppBootstrap {
  startupState: StartupState;
  appConfig: AppConfig | null;
  desktopConfig: DesktopConfigResponse;
  reason?: string;
}

interface InitializationProgressEvent {
  stage: string;
  message: string;
  at: string;
}

const CHAT_BROWSER_BOUNDS: PanelWidthBounds = {
  defaultWidth: 320,
  minWidth: 240,
  maxWidth: 520,
};

const CHAT_DRAWER_BOUNDS: PanelWidthBounds = {
  defaultWidth: 420,
  minWidth: 320,
  maxWidth: 720,
};

const CHAT_BROWSER_COLLAPSED_KEY = "llmWiki.chat.browserCollapsed";

declare global {
  interface Window {
    llmWikiDesktop?: {
      getDesktopConfig: () => Promise<DesktopConfigResponse>;
      getAppBootstrap: () => Promise<AppBootstrap>;
      getShortcuts: () => Promise<ShortcutStatus>;
      saveShortcut: (payload: { id: "flashDiaryCapture"; accelerator: string }) => Promise<ShortcutStatus>;
      chooseTargetVault: () => Promise<string | null>;
      chooseSourceFolders: () => Promise<string[]>;
      saveDesktopConfig: (targetVault: string) => Promise<DesktopConfigResponse>;
      saveAppConfig: (payload: { targetRepoPath: string; sourceFolders: string[] }) => Promise<AppConfig>;
      initializeApp: (payload: { targetRepoPath: string; sourceFolders: string[] }) => Promise<AppBootstrap>;
      onInitializationProgress: (listener: (payload: InitializationProgressEvent) => void) => () => void;
      onInstanceRedirected: (listener: () => void) => () => void;
      onFlashDiaryCapture: (listener: (payload: unknown) => void) => () => void;
      chooseFlashDiaryMedia: () => Promise<string[]>;
      submitFlashDiaryEntry: (payload: { target?: "flash-diary" | "clipping"; text: string; mediaPaths: string[] }) => Promise<unknown>;
      importXiaohongshuCookie?: () => Promise<{ ok: boolean; cookie: string; count: number; message: string }>;
      openXiaohongshuLogin?: () => Promise<{ ok: boolean; message: string }>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}

const state = {
  startupState: "UNCONFIGURED" as StartupState,
  previewPath: "wiki/index.md",
  author: "me",
  currentLayer: "wiki" as "wiki" | "raw",
  treeSearch: "",
  multiSelectEnabled: false,
  selectedArticleRefs: [] as string[],
  selectedConversationId: null as string | null,
  chatDrafts: {} as Record<string, DraftConversation>,
  currentChatSearchScope: "local" as ChatSearchScope,
  chatApps: [] as ChatAppOption[],
  chatDefaultAppId: null as string | null,
  chatApiAccounts: [] as ChatAgentRuntimeApiAccount[],
  chatOAuthAccounts: [] as ChatAgentRuntimeOAuthAccount[],
  currentChatAppId: null as string | null,
  desktopConfig: null as DesktopConfigResponse | null,
  appConfig: null as AppConfig | null,
  chatBrowserCollapsed: false,
};

const elements = {
  startupShell: document.getElementById("startup-shell") as HTMLElement,
  welcomeScreen: document.getElementById("welcome-screen") as HTMLElement,
  setupScreen: document.getElementById("setup-screen") as HTMLElement,
  workspaceShell: document.getElementById("workspace-shell") as HTMLElement,
  railSlot: document.getElementById("shell-rail-slot") as HTMLElement,
  browserRailToggle: document.getElementById("shell-browser-rail-toggle") as HTMLButtonElement,
  browserSlot: document.getElementById("shell-browser-slot") as HTMLElement,
  mainSlot: document.getElementById("shell-main-slot") as HTMLElement,
  drawerSlot: document.getElementById("shell-drawer-slot") as HTMLElement,
  chatLegacy: document.getElementById("chat-legacy") as HTMLElement,
  chatApp: document.getElementById("chat-app") as HTMLElement,
  welcomeNext: document.getElementById("welcome-next") as HTMLButtonElement,
  targetRepoPath: document.getElementById("target-repo-path") as HTMLInputElement,
  chooseTargetRepo: document.getElementById("choose-target-repo") as HTMLButtonElement,
  addSourceFolders: document.getElementById("add-source-folders") as HTMLButtonElement,
  sourceFolderList: document.getElementById("source-folder-list") as HTMLUListElement,
  initializeStatus: document.getElementById("initialize-status") as HTMLElement,
  initializeError: document.getElementById("initialize-error") as HTMLElement,
  startInitialize: document.getElementById("start-initialize") as HTMLButtonElement,
};

let browserRefs: BrowserRefs | null = null;
let drawerHandle: DrawerHandle | null = null;
let chatPage: ChatPageHandle | null = null;

function renderFatalScreen(title: string, error: unknown): void {
  const detail = error instanceof Error
    ? `${error.message}\n\n${error.stack ?? ""}`.trim()
    : String(error);
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#f7f7fb;">
      <section style="width:min(920px,100%);padding:28px;border-radius:24px;border:1px solid #e8e5f0;background:#fff;box-shadow:0 20px 60px rgba(15,23,42,.08);font-family:Inter,'Noto Sans SC','Microsoft YaHei UI',sans-serif;">
        <div style="margin-bottom:8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7c5cfc;">Runtime Error</div>
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;color:#1a1a1a;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 18px;color:#555;line-height:1.7;">当前页面渲染失败，已阻止继续显示空白界面。请把这块内容发给我，我会直接修。</p>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;padding:16px;border-radius:16px;background:#fcfbff;border:1px solid #e8e5f0;color:#222;font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;line-height:1.65;">${escapeHtml(detail || "Unknown error")}</pre>
      </section>
    </main>
  `;
}

window.addEventListener("error", (event) => {
  console.error("[llmwiki] window.error", event.error ?? event.message);
  renderFatalScreen("页面运行时错误", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[llmwiki] window.unhandledrejection", event.reason);
  renderFatalScreen("页面 Promise 未处理异常", event.reason);
});

async function main(): Promise<void> {
  mountShell();
  bindCommonEvents();
  await loadServerConfig();
  await loadChatApps();
  await loadChatRuntimeSources();
  await bootstrapApplication();
}

function mountShell(): void {
  bindShellPanelLayout();
  browserRefs = mountBrowser(elements.browserSlot);
  state.chatBrowserCollapsed = readChatBrowserCollapsed();
  chatPage = mountChatPage(elements.chatApp, {
    onCreateConversation: () => {
      void createConversation();
    },
    onOpenConversation: (id) => {
      navigateToConversation(id);
    },
    onDeleteConversation: (id) => {
      void deleteConversationById(id);
    },
    onSendMessage: (content) => {
      void sendConversationMessage(content);
    },
    onComposerChange: (content) => {
      syncConversationDraft(content);
    },
    onSearchScopeChange: (scope) => {
      void setConversationSearchScope(scope);
    },
    onAppChange: (appId) => {
      void setConversationApp(appId);
    },
    onRenameConversation: (id, title) => {
      void renameConversation(id, title);
    },
    onRemoveArticleRef: (path) => {
      removeArticleSelection(path);
    },
  });
  drawerHandle = createDrawer({
    shellRoot: elements.workspaceShell,
    container: elements.drawerSlot,
    onNavigate: (path: string) => {
      void openDrawerForPath(path);
    },
  });
  const mainSlotHandle = createMainSlot({
    container: elements.mainSlot,
    legacyChatNode: elements.chatLegacy,
    legacyBrowser: elements.browserSlot,
    isChatBrowserCollapsed: () => state.chatBrowserCollapsed,
  });
  const router = createRouter((route: Route) => {
    try {
      railHandle.update(route.name);
      mainSlotHandle.render(route);
      if (route.name !== "chat" && state.multiSelectEnabled) {
        state.multiSelectEnabled = false;
        updateMultiSelectToggle();
        void loadTree();
      }
      if (route.name !== "chat") {
        drawerHandle?.close();
      } else {
        void syncChatRoute(route.params.id ?? null);
      }
      syncChatBrowserUi();
    } catch (error) {
      renderFatalScreen("路由切换失败", error);
    }
  });
  const railHandle = mountRail(elements.railSlot, {
    current: "chat",
    onNavigate: (route: RouteName) => {
      if (route === "check" || route === "sync") {
        void startBackgroundRun(route, document.body, showToast);
        return;
      }
      router.navigate({ name: route });
    },
  });
  router.start();
  syncChatBrowserUi();
}

async function bootstrapApplication(): Promise<void> {
  if (!window.llmWikiDesktop) {
    state.startupState = "READY";
    renderStartupState();
    await enterReadyWorkspace();
    return;
  }

  const bootstrap = await window.llmWikiDesktop.getAppBootstrap();
  state.desktopConfig = bootstrap.desktopConfig;
  state.appConfig = bootstrap.appConfig;
  state.startupState = bootstrap.startupState;

  hydrateSetupFormFromConfig();
  renderStartupState();

  if (bootstrap.startupState === "READY") {
    await enterReadyWorkspace();
    return;
  }

  if (bootstrap.startupState === "CONFIGURING") {
    openSetupScreen();
  }
}

async function loadServerConfig(): Promise<void> {
  try {
    const config = (await fetch("/api/config").then((response) => response.json())) as ServerConfigResponse;
    if (config.author) state.author = config.author;
  } catch {
    state.author = "me";
  }
}

function showToast(message: string, tone: "info" | "error" = "info"): void {
  let host = document.getElementById("app-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "app-toast-host";
    host.className = "app-toast-host";
    document.body.appendChild(host);
  }

  const toast = document.createElement("div");
  toast.className = `app-toast app-toast--${tone}`;
  toast.textContent = message;
  host.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, 3600);
}

function bindCommonEvents(): void {
  elements.welcomeNext.addEventListener("click", () => {
    openSetupScreen();
  });

  elements.targetRepoPath.addEventListener("input", () => {
    syncSetupValidity();
  });

  elements.chooseTargetRepo.addEventListener("click", async () => {
    if (!window.llmWikiDesktop) return;
    const selectedFolder = await window.llmWikiDesktop.chooseTargetVault();
    if (selectedFolder) {
      elements.targetRepoPath.value = selectedFolder;
      syncSetupValidity();
    }
  });

  elements.addSourceFolders.addEventListener("click", async () => {
    if (!window.llmWikiDesktop) return;
    const selectedFolders = await window.llmWikiDesktop.chooseSourceFolders();
    if (selectedFolders.length === 0) return;
    const merged = new Set(getSourceFolders());
    for (const folder of selectedFolders) {
      merged.add(folder);
    }
    renderSourceFolders([...merged]);
    syncSetupValidity();
  });

  elements.startInitialize.addEventListener("click", async () => {
    await startInitialization();
  });

  window.llmWikiDesktop?.onInstanceRedirected(() => {
    showToast("\u68c0\u6d4b\u5230\u5df2\u6709\u8fd0\u884c\u4e2d\u7684 LLM Wiki\uff0c\u5df2\u5207\u56de\u5f53\u524d\u7a97\u53e3\u3002");
  });
  window.llmWikiDesktop?.onFlashDiaryCapture(() => {
    showToast("\u95ea\u5ff5\u65e5\u8bb0\u5df2\u63d0\u4ea4");
    window.dispatchEvent(new CustomEvent("llmwiki:flash-diary-refresh"));
  });

  bindWorkspaceEvents();
}

function bindWorkspaceEvents(): void {
  if (!browserRefs) return;

  browserRefs.layerToggle.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextLayer = (button.dataset.layer as "wiki" | "raw" | undefined) ?? "wiki";
      if (nextLayer === state.currentLayer) return;
      state.currentLayer = nextLayer;
      updateLayerToggle();
      if (state.startupState === "READY") {
        await loadTree();
      }
    });
  });

  browserRefs.searchInput.addEventListener("input", async () => {
    state.treeSearch = browserRefs!.searchInput.value.trim();
    if (state.startupState === "READY") {
      await loadTree();
    }
  });

  browserRefs.multiSelectButton.addEventListener("click", () => {
    state.multiSelectEnabled = !state.multiSelectEnabled;
    updateMultiSelectToggle();
    void loadTree();
  });

  browserRefs.toggleButton.addEventListener("click", () => {
    setChatBrowserCollapsed(!state.chatBrowserCollapsed);
  });

  elements.browserRailToggle.addEventListener("click", () => {
    setChatBrowserCollapsed(false);
  });

}

function bindShellPanelLayout(): void {
  const shellRoot = elements.workspaceShell;
  const browserHandle = document.getElementById("shell-browser-handle");
  const drawerHandle = document.getElementById("shell-drawer-handle");
  if (!browserHandle || !drawerHandle) {
    return;
  }

  let browserWidth = readPanelWidth("chat.browserWidth", CHAT_BROWSER_BOUNDS);
  let drawerWidth = readPanelWidth("chat.drawerWidth", CHAT_DRAWER_BOUNDS);

  const syncShellWidths = (): void => {
    const route = shellRoot.getAttribute("data-route");
    const browserHidden = shellRoot.hasAttribute("data-browser-hidden");
    const drawerOpen = shellRoot.getAttribute("data-drawer-open") === "true";
    const browserVisible = route === "chat" && !browserHidden;
    const drawerVisible = route === "chat" && drawerOpen;
    applyPanelWidth(shellRoot, "--shell-browser-width", browserVisible ? browserWidth : 0);
    applyPanelWidth(shellRoot, "--shell-browser-handle-width", browserVisible ? 12 : 0);
    applyPanelWidth(shellRoot, "--shell-drawer-width", drawerVisible ? drawerWidth : 0);
    applyPanelWidth(shellRoot, "--shell-drawer-handle-width", drawerVisible ? 12 : 0);
    browserHandle.toggleAttribute("hidden", !browserVisible);
    drawerHandle.toggleAttribute("hidden", !drawerVisible);
  };

  attachResizeHandle({
    handle: browserHandle,
    onMove(event) {
      const rect = shellRoot.getBoundingClientRect();
      browserWidth = clampPanelWidth(event.clientX - rect.left - 64, CHAT_BROWSER_BOUNDS);
      syncShellWidths();
    },
    onEnd() {
      browserWidth = writePanelWidth("chat.browserWidth", browserWidth, CHAT_BROWSER_BOUNDS);
      syncShellWidths();
    },
  });

  attachResizeHandle({
    handle: drawerHandle,
    onMove(event) {
      const rect = shellRoot.getBoundingClientRect();
      drawerWidth = clampPanelWidth(rect.right - event.clientX, CHAT_DRAWER_BOUNDS);
      syncShellWidths();
    },
    onEnd() {
      drawerWidth = writePanelWidth("chat.drawerWidth", drawerWidth, CHAT_DRAWER_BOUNDS);
      syncShellWidths();
    },
  });

  new MutationObserver(() => {
    syncShellWidths();
  }).observe(shellRoot, {
    attributes: true,
    attributeFilter: ["data-route", "data-browser-hidden", "data-drawer-open"],
  });
  syncShellWidths();
}

function renderStartupState(): void {
  const isReady = state.startupState === "READY";
  elements.workspaceShell.classList.toggle("hidden", !isReady);
  elements.startupShell.classList.toggle("hidden", isReady);

  if (isReady) {
    elements.welcomeScreen.classList.add("hidden");
    elements.setupScreen.classList.add("hidden");
    return;
  }

  if (state.startupState === "UNCONFIGURED") {
    elements.welcomeScreen.classList.remove("hidden");
    elements.setupScreen.classList.add("hidden");
    return;
  }

  openSetupScreen();
}

function openSetupScreen(): void {
  elements.welcomeScreen.classList.add("hidden");
  elements.setupScreen.classList.remove("hidden");
}

function hydrateSetupFormFromConfig(): void {
  elements.targetRepoPath.value = state.appConfig?.targetRepoPath ?? state.desktopConfig?.targetVault ?? "";
  renderSourceFolders(state.appConfig?.sourceFolders ?? []);
  syncSetupValidity();
}

function getSourceFolders(): string[] {
  return Array.from(elements.sourceFolderList.querySelectorAll<HTMLLIElement>("[data-folder]")).map(
    (item) => item.dataset.folder ?? "",
  ).filter(Boolean);
}

function renderSourceFolders(folders: string[]): void {
  elements.sourceFolderList.innerHTML = "";
  if (folders.length === 0) {
    const placeholder = document.createElement("li");
    placeholder.className = "source-folder-empty";
    placeholder.textContent = "\u6682\u672a\u6dfb\u52a0\u540c\u6b65\u6e90\u6587\u4ef6\u5939";
    elements.sourceFolderList.appendChild(placeholder);
    return;
  }

  for (const folder of folders) {
    const item = document.createElement("li");
    item.className = "source-folder-item";
    item.dataset.folder = folder;
    item.innerHTML = `
      <span class="source-folder-path">${escapeHtml(folder)}</span>
      <button type="button" class="btn btn-secondary btn-inline remove-source-folder">\u5220\u9664</button>
    `;
    item.querySelector<HTMLButtonElement>(".remove-source-folder")!.addEventListener("click", () => {
      item.remove();
      if (elements.sourceFolderList.children.length === 0) {
        renderSourceFolders([]);
      }
      syncSetupValidity();
    });
    elements.sourceFolderList.appendChild(item);
  }
}

function syncSetupValidity(): void {
  const isValid = elements.targetRepoPath.value.trim().length > 0 && getSourceFolders().length > 0;
  elements.startInitialize.disabled = !isValid || state.startupState === "INITIALIZING";
}

async function startInitialization(): Promise<void> {
  if (!window.llmWikiDesktop) return;

  const payload = {
    targetRepoPath: elements.targetRepoPath.value.trim(),
    sourceFolders: getSourceFolders(),
  };
  if (!payload.targetRepoPath || payload.sourceFolders.length === 0) {
    syncSetupValidity();
    return;
  }

  state.startupState = "INITIALIZING";
  elements.initializeError.classList.add("hidden");
  elements.initializeError.textContent = "";
  elements.initializeStatus.textContent = "\u6b63\u5728\u8fdb\u5165\u4e3b\u9875\u9762...";
  syncSetupValidity();

  try {
    const draftConfig = await window.llmWikiDesktop.saveAppConfig(payload);
    state.appConfig = draftConfig;
    state.desktopConfig = state.desktopConfig
      ? { ...state.desktopConfig, targetVault: payload.targetRepoPath }
      : state.desktopConfig;
    state.startupState = "READY";
    renderStartupState();
    applyDesktopConfig(state.desktopConfig);

    void window.llmWikiDesktop.initializeApp(payload)
      .then(async (bootstrap) => {
        state.desktopConfig = bootstrap.desktopConfig;
        state.appConfig = bootstrap.appConfig;
        state.startupState = "READY";
        applyDesktopConfig(state.desktopConfig);
        renderStartupState();
        await enterReadyWorkspace();
      })
      .catch((error) => {
        state.startupState = "CONFIGURING";
        elements.initializeStatus.textContent = "";
        elements.initializeError.textContent =
          error instanceof Error ? error.message : String(error);
        elements.initializeError.classList.remove("hidden");
        syncSetupValidity();
        renderStartupState();
      });
  } catch (error) {
    state.startupState = "CONFIGURING";
    elements.initializeStatus.textContent = "";
    elements.initializeError.textContent =
      error instanceof Error ? error.message : String(error);
    elements.initializeError.classList.remove("hidden");
    syncSetupValidity();
    renderStartupState();
  }
}

async function enterReadyWorkspace(): Promise<void> {
  state.startupState = "READY";
  renderStartupState();
  applyDesktopConfig(state.desktopConfig);
  updateLayerToggle();
  updateMultiSelectToggle();
  await loadTree();
  await loadConversationSummaries();
}

function applyDesktopConfig(config: DesktopConfigResponse | null): void {
  if (!config) return;
  state.desktopConfig = config;
}

async function loadTree(): Promise<void> {
  if (!browserRefs) return;

  const query = new URLSearchParams({ layer: state.currentLayer });
  if (state.treeSearch) {
    query.set("q", state.treeSearch);
  }

  const tree = (await fetch(`/api/tree?${query.toString()}`).then((response) => response.json())) as TreeNode;
  renderTree(browserRefs.treeContainer, tree, (path) => {
    void openDrawerForPath(path);
  }, {
    activePath: state.previewPath,
    multiSelectEnabled: state.multiSelectEnabled,
    selectedPaths: state.selectedArticleRefs,
    onToggleSelect: toggleArticleSelection,
  });
}

async function openDrawerForPath(pathArg: string): Promise<void> {
  if (!drawerHandle) return;

  drawerHandle.showLoading(pathArg);
  try {
    const response = await fetch(`/api/page?path=${encodeURIComponent(pathArg)}`);
    if (!response.ok) {
      drawerHandle.open({
        path: pathArg,
        title: "Failed to load",
        html: `<p class="loading">Failed to load <code>${escapeHtml(pathArg)}</code>.</p>`,
      });
      return;
    }

    const data = (await response.json()) as PageResponse;
    state.previewPath = data.path;
    drawerHandle.open({
      path: data.path,
      title: data.title ?? data.path,
      html: data.html,
      rawMarkdown: data.raw,
      aliases: data.aliases,
      sizeBytes: data.sizeBytes,
      modifiedAt: data.modifiedAt,
    });
    updateTreeActivePath();
  } catch {
    drawerHandle.open({
      path: pathArg,
      title: "Error",
      html: '<p class="loading">Error loading page.</p>',
    });
  }
}

async function loadConversationSummaries(selectedId: string | null = state.selectedConversationId): Promise<void> {
  if (!chatPage) return;

  const response = await fetch("/api/chat");
  const payload = (await response.json()) as { data: ConversationSummary[] };
  const items = payload.data ?? [];
  const draft = getActiveDraftConversation();
  chatPage.renderConversationList(draft ? [getDraftConversationSummary(draft), ...items] : items, selectedId);
}

async function loadChatApps(): Promise<void> {
  if (!chatPage) return;
  try {
    const response = await fetch("/api/app-config");
    const payload = (await response.json()) as ApiResponse<AppConfigResponse>;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "app config load failed");
    }
    state.chatApps = payload.data.apps;
    state.chatDefaultAppId = payload.data.defaultAppId;
    state.currentChatAppId = state.currentChatAppId ?? payload.data.defaultAppId;
    chatPage.setApps(state.chatApps, state.currentChatAppId);
    refreshChatRuntimeSummary();
  } catch {
    state.chatApps = [];
    state.chatDefaultAppId = null;
    state.currentChatAppId = null;
    chatPage.setApps([], null);
    refreshChatRuntimeSummary();
  }
}

function resolveCurrentChatAppId(): string | null {
  return state.currentChatAppId ?? state.chatDefaultAppId ?? null;
}

async function loadChatRuntimeSources(): Promise<void> {
  const [apiAccounts, oauthAccounts] = await Promise.all([
    loadChatApiAccounts(),
    loadChatOAuthAccounts(),
  ]);
  state.chatApiAccounts = apiAccounts;
  state.chatOAuthAccounts = oauthAccounts;
  refreshChatRuntimeSummary();
}

async function loadChatApiAccounts(): Promise<ChatAgentRuntimeApiAccount[]> {
  try {
    const response = await fetch("/api/llm/accounts");
    const payload = (await response.json()) as ApiResponse<LlmApiAccountsResponse>;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "llm accounts load failed");
    }
    return payload.data.accounts;
  } catch {
    return [];
  }
}

async function loadChatOAuthAccounts(): Promise<ChatAgentRuntimeOAuthAccount[]> {
  try {
    const response = await fetch("/api/cliproxy/accounts");
    const payload = (await response.json()) as ApiResponse<CLIProxyAccountsResponse>;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "oauth accounts load failed");
    }
    return payload.data.accounts;
  } catch {
    return [];
  }
}

async function syncChatRoute(conversationId: string | null): Promise<void> {
  await applyPendingChatArticleRefs();
  await applyPendingGuidedInboxRef();
  state.selectedConversationId = conversationId;
  chatPage?.setComposerArticleRefs(state.selectedArticleRefs);
  await loadConversationSummaries(conversationId);
  if (!conversationId) {
    chatPage?.renderThread(null);
    chatPage?.setComposerDraft("");
    chatPage?.setWebSearchEnabled(false);
    state.currentChatSearchScope = "local";
    chatPage?.setSearchScope("local");
    chatPage?.setApp(state.currentChatAppId);
    refreshChatRuntimeSummary();
    return;
  }
  if (isDraftConversationId(conversationId)) {
    const draft = ensureDraftConversation(conversationId);
    state.currentChatSearchScope = draft.searchScope;
    state.currentChatAppId = draft.appId;
    chatPage?.renderThread({
      id: draft.id,
      title: draft.title,
      messages: [],
      articleRefs: [],
    });
    chatPage?.setComposerDraft(draft.draft);
    chatPage?.setWebSearchEnabled(draft.webSearchEnabled);
    chatPage?.setSearchScope(draft.searchScope);
    chatPage?.setApp(draft.appId);
    refreshChatRuntimeSummary();
    return;
  }
  await loadConversation(conversationId);
}

async function applyPendingChatArticleRefs(): Promise<void> {
  const raw = window.localStorage.getItem("llmWiki.pendingChatArticleRefs");
  if (!raw) return;
  window.localStorage.removeItem("llmWiki.pendingChatArticleRefs");
  try {
    const refs = JSON.parse(raw) as string[];
    if (!Array.isArray(refs) || refs.length === 0) return;
    state.selectedArticleRefs = refs.map((item) => String(item)).filter(Boolean);
    state.multiSelectEnabled = true;
    if (state.selectedArticleRefs.every((item) => item.startsWith("raw/"))) {
      state.currentLayer = "raw";
      updateLayerToggle();
      await loadTree();
    }
    updateMultiSelectToggle();
  } catch {
    // Ignore invalid bridge payloads.
  }
}

async function applyPendingGuidedInboxRef(): Promise<void> {
  const ref = window.localStorage.getItem("llmWiki.guidedInboxRef");
  if (!ref) return;
  window.localStorage.removeItem("llmWiki.guidedInboxRef");
  state.currentLayer = "raw";
  state.multiSelectEnabled = true;
  state.selectedArticleRefs = [ref];
  updateLayerToggle();
  updateMultiSelectToggle();
  await loadTree();
}

async function loadConversation(conversationId: string): Promise<void> {
  if (!chatPage) return;
  const response = await fetch(`/api/chat/${encodeURIComponent(conversationId)}`);
  if (!response.ok) {
    chatPage.renderThread(null);
    return;
  }
  const payload = (await response.json()) as { data: ConversationResponse };
  chatPage.renderThread({
    id: payload.data.id,
    title: payload.data.title,
    messages: payload.data.messages,
    articleRefs: payload.data.articleRefs,
  });
  chatPage.setComposerDraft("");
  chatPage.setWebSearchEnabled(payload.data.webSearchEnabled);
  state.currentChatSearchScope = fromConversationSearchScope(payload.data.searchScope);
  state.currentChatAppId = payload.data.appId;
  chatPage.setSearchScope(state.currentChatSearchScope);
  chatPage.setApp(state.currentChatAppId);
  refreshChatRuntimeSummary();
}

async function createConversation(): Promise<void> {
  const draft = createDraftConversation({ appId: state.currentChatAppId });
  state.chatDrafts[draft.id] = draft;
  navigateToConversation(draft.id);
}

async function sendConversationMessage(content: string): Promise<void> {
  if (!chatPage) return;

  let conversationId = state.selectedConversationId;
  if (!conversationId || isDraftConversationId(conversationId)) {
    const draft = conversationId
      ? ensureDraftConversation(conversationId)
      : createDraftConversation({ appId: state.currentChatAppId });
    const appId = draft.appId ?? state.chatDefaultAppId;
    if (!appId) {
      showToast("请先在设置页创建并启用应用。", "error");
      return;
    }
    const createResponse = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        webSearchEnabled: draft.webSearchEnabled,
        searchScope: toConversationSearchScope(draft.searchScope),
        appId,
        articleRefs: state.selectedArticleRefs,
      }),
    });
    const createPayload = (await createResponse.json()) as { data: ConversationResponse };
    conversationId = createPayload.data.id;
    state.selectedConversationId = conversationId;
    delete state.chatDrafts[draft.id];
    navigateToConversation(conversationId);
  }

  chatPage.setBusy(true);
  const response = await fetch(`/api/chat/${encodeURIComponent(conversationId!)}/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      appId: resolveCurrentChatAppId(),
      articleRefs: state.selectedArticleRefs,
    }),
  });

  if (!response.ok) {
    chatPage.setBusy(false);
    return;
  }

  chatPage.clearComposer();
  await consumeConversationStream(response, conversationId!);
  chatPage.setBusy(false);
  await loadConversationSummaries(conversationId!);
}

async function consumeConversationStream(response: Response, conversationId: string): Promise<void> {
  if (!chatPage || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  let streamedConversation: ConversationResponse | null = null;
  let assistantContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    const parsed = parseSseMessages(rest + decoder.decode(value, { stream: true }));
    rest = parsed.rest;
    for (const message of parsed.messages) {
      const payload = JSON.parse(message.data) as {
        token?: string;
        conversation?: ConversationResponse;
        error?: string;
      };
      if (message.event === "user" && payload.conversation) {
        streamedConversation = payload.conversation;
        renderStreamingConversation(streamedConversation, assistantContent);
      }
      if (message.event === "token" && typeof payload.token === "string") {
        assistantContent += payload.token;
        if (streamedConversation) {
          renderStreamingConversation(streamedConversation, assistantContent);
        }
      }
      if (message.event === "done" && payload.conversation) {
        streamedConversation = payload.conversation;
        chatPage.renderThread({
          id: payload.conversation.id,
          title: payload.conversation.title,
          messages: payload.conversation.messages,
          articleRefs: payload.conversation.articleRefs,
        });
        chatPage.setWebSearchEnabled(payload.conversation.webSearchEnabled);
      }
      if (message.event === "error") {
        renderStreamingConversation(streamedConversation, payload.error ?? "Assistant stream failed.");
      }
    }
  }

  if (!streamedConversation) {
    await loadConversation(conversationId);
  }
}

function renderStreamingConversation(conversation: ConversationResponse | null, assistantContent: string): void {
  if (!chatPage || !conversation) {
    return;
  }
  chatPage.renderThread({
    id: conversation.id,
    title: conversation.title,
    messages: [
      ...conversation.messages,
      {
        id: "streaming-assistant",
        role: "assistant",
        content: assistantContent || "\u6b63\u5728\u601d\u8003...",
        createdAt: new Date().toISOString(),
      },
    ],
    articleRefs: conversation.articleRefs,
  });
}

function navigateToConversation(conversationId: string): void {
  window.location.hash = `#/chat/${conversationId}`;
}

function updateLayerToggle(): void {
  if (!browserRefs) return;

  browserRefs.layerToggle.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
    button.classList.toggle("active", button.dataset.layer === state.currentLayer);
  });
}

function setChatBrowserCollapsed(collapsed: boolean): void {
  state.chatBrowserCollapsed = collapsed;
  window.localStorage.setItem(CHAT_BROWSER_COLLAPSED_KEY, collapsed ? "1" : "0");
  if (elements.workspaceShell.getAttribute("data-route") === "chat") {
    elements.workspaceShell.toggleAttribute("data-browser-hidden", collapsed);
  }
  syncChatBrowserUi();
}

function syncChatBrowserUi(): void {
  const collapsed = state.chatBrowserCollapsed;
  const shouldShowRailToggle = collapsed && elements.workspaceShell.getAttribute("data-route") === "chat";
  if (browserRefs) {
    browserRefs.toggleButton.setAttribute("aria-pressed", collapsed ? "true" : "false");
    browserRefs.toggleButton.textContent = collapsed ? "展开目录" : "折叠";
  }
  elements.browserRailToggle.hidden = !shouldShowRailToggle;
  elements.browserRailToggle.classList.toggle("hidden", !shouldShowRailToggle);
}

function readChatBrowserCollapsed(): boolean {
  return window.localStorage.getItem(CHAT_BROWSER_COLLAPSED_KEY) === "1";
}

function updateMultiSelectToggle(): void {
  if (!browserRefs) return;

  browserRefs.multiSelectButton.setAttribute("aria-pressed", state.multiSelectEnabled ? "true" : "false");
  browserRefs.multiSelectButton.classList.toggle("active", state.multiSelectEnabled);
  browserRefs.selectionStatus.classList.toggle("hidden", !state.multiSelectEnabled);
  browserRefs.selectionStatus.textContent = state.multiSelectEnabled
    ? `\u5df2\u9009 ${state.selectedArticleRefs.length} \u7bc7`
    : "";
  chatPage?.setComposerArticleRefs(state.selectedArticleRefs);
}

function updateTreeActivePath(): void {
  if (!browserRefs) return;

  browserRefs.treeContainer.querySelectorAll("a.active").forEach((item) => item.classList.remove("active"));
  const activeLink = browserRefs.treeContainer.querySelector<HTMLElement>(
    `a[data-path="${cssEscape(state.previewPath)}"]`,
  );
  activeLink?.classList.add("active");
}

function toggleArticleSelection(path: string): void {
  if (state.selectedArticleRefs.includes(path)) {
    state.selectedArticleRefs = state.selectedArticleRefs.filter((item) => item !== path);
  } else {
    state.selectedArticleRefs = [...state.selectedArticleRefs, path];
  }
  updateMultiSelectToggle();
  void loadTree();
}

function removeArticleSelection(path: string): void {
  state.selectedArticleRefs = state.selectedArticleRefs.filter((item) => item !== path);
  updateMultiSelectToggle();
  void loadTree();
}

function getActiveDraftConversation(): DraftConversation | null {
  if (!state.selectedConversationId || !isDraftConversationId(state.selectedConversationId)) {
    return null;
  }
  return state.chatDrafts[state.selectedConversationId] ?? null;
}

function ensureDraftConversation(id: string): DraftConversation {
  const existing = state.chatDrafts[id];
  if (existing) {
    return existing;
  }
  const draft = createDraftConversation({ id, appId: state.currentChatAppId });
  state.chatDrafts[id] = draft;
  return draft;
}

function syncConversationDraft(content: string): void {
  const draft = getActiveDraftConversation();
  if (!draft) {
    return;
  }
  draft.draft = content;
  draft.updatedAt = new Date().toISOString();
  void loadConversationSummaries(draft.id);
}

async function setConversationSearchScope(scope: ChatSearchScope): Promise<void> {
  state.currentChatSearchScope = scope;
  const webSearchEnabled = scope !== "local";
  chatPage?.setWebSearchEnabled(webSearchEnabled);
  chatPage?.setSearchScope(scope);
  const draft = getActiveDraftConversation();
  if (draft) {
    draft.searchScope = scope;
    draft.webSearchEnabled = webSearchEnabled;
    draft.updatedAt = new Date().toISOString();
    void loadConversationSummaries(draft.id);
    return;
  }
  if (!state.selectedConversationId) {
    return;
  }
  const response = await fetch(`/api/chat/${encodeURIComponent(state.selectedConversationId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webSearchEnabled,
      searchScope: toConversationSearchScope(scope),
    }),
  });
  if (!response.ok) {
    return;
  }
  await loadConversation(state.selectedConversationId);
  await loadConversationSummaries(state.selectedConversationId);
}

async function setConversationApp(appId: string | null): Promise<void> {
  state.currentChatAppId = appId;
  chatPage?.setApp(appId);
  refreshChatRuntimeSummary();
  const draft = getActiveDraftConversation();
  if (draft) {
    draft.appId = appId;
    draft.updatedAt = new Date().toISOString();
    void loadConversationSummaries(draft.id);
    return;
  }
  if (!state.selectedConversationId) {
    return;
  }
  const response = await fetch(`/api/chat/${encodeURIComponent(state.selectedConversationId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId }),
  });
  if (!response.ok) {
    return;
  }
  await loadConversation(state.selectedConversationId);
  await loadConversationSummaries(state.selectedConversationId);
}

function refreshChatRuntimeSummary(): void {
  if (!chatPage) return;
  chatPage.setRuntimeSummary(buildChatRuntimeSummary({
    appId: state.currentChatAppId,
    defaultAppId: state.chatDefaultAppId,
    apps: state.chatApps,
    apiAccounts: state.chatApiAccounts,
    oauthAccounts: state.chatOAuthAccounts,
  }));
}

async function renameConversation(conversationId: string, title: string): Promise<void> {
  const nextTitle = title.trim();
  if (!nextTitle) {
    return;
  }
  if (isDraftConversationId(conversationId)) {
    const draft = ensureDraftConversation(conversationId);
    draft.title = nextTitle;
    draft.updatedAt = new Date().toISOString();
    if (state.selectedConversationId === conversationId) {
      chatPage?.renderThread({
        id: draft.id,
        title: draft.title,
        messages: [],
        articleRefs: [],
      });
    }
    await loadConversationSummaries(conversationId);
    return;
  }
  const response = await fetch(`/api/chat/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: nextTitle }),
  });
  if (!response.ok) {
    return;
  }
  if (state.selectedConversationId === conversationId) {
    await loadConversation(conversationId);
  }
  await loadConversationSummaries(conversationId);
}

async function deleteConversationById(conversationId: string): Promise<void> {
  if (isDraftConversationId(conversationId)) {
    delete state.chatDrafts[conversationId];
  } else {
    const response = await fetch(`/api/chat/${encodeURIComponent(conversationId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      return;
    }
  }
  if (state.selectedConversationId === conversationId) {
    state.selectedConversationId = null;
    state.currentChatSearchScope = "local";
    chatPage?.renderThread(null);
    chatPage?.setComposerDraft("");
    chatPage?.setWebSearchEnabled(false);
    chatPage?.setSearchScope("local");
    window.location.hash = "#/chat";
  }
  await loadConversationSummaries();
}

function toConversationSearchScope(scope: ChatSearchScope): "local" | "web" | "all" {
  return scope === "both" ? "all" : scope;
}

function fromConversationSearchScope(scope: ConversationResponse["searchScope"]): ChatSearchScope {
  return scope === "all" ? "both" : scope;
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
  return value.replace(/["\\]/g, "\\$&");
}

void main().catch((error) => {
  renderFatalScreen("应用启动失败", error);
});

