/**
 * Automation workspace list, detail, and log pages.
 *
 * The list page mirrors the white-card overview from the approved mockup.
 * Detail and log routes stay independent full-page views so the shell router
 * can mount them without reusing the settings editor surface.
 */

import {
  fetchAutomationDetail,
  fetchAutomationList,
  type AutomationCommentDraftTarget,
  type AutomationDetailResponse,
  type AutomationListItem,
} from "./api.js";
import {
  pickSelectedAutomationCommentId,
  renderAutomationDetailComments,
  type AutomationDetailCommentState,
} from "./detail-comments.js";
import { bindAutomationWorkspaceLiveRefresh } from "./live-events.js";
import {
  createAutomationListSectionHtml,
  getSourceLabel,
  isCodeItem,
} from "./rendering.js";
import { loadAutomationLogs } from "./panels.js";

type AutomationFilter = "running" | "stopped" | "all";
type DisposableAutomationRoute = HTMLElement & { __dispose?: () => void };

const WORKFLOW_LABEL = "Workflow";
const WORKFLOW_LOG_EYEBROW = "WORKFLOW LOG";
const WORKFLOW_LIST_EYEBROW = "WORKFLOW";
const WORKFLOW_DETAIL_EYEBROW = "WORKFLOW DETAIL";

export function renderAutomationWorkspacePage(automationId?: string): HTMLElement {
  return automationId ? renderAutomationDetailPage(automationId) : renderAutomationListPage();
}

export function renderAutomationLogPage(automationId = ""): HTMLElement {
  const root = document.createElement("section") as DisposableAutomationRoute;
  root.className = "automation-route";
  root.dataset.automationScroll = "";
  root.innerHTML = `
    <section class="automation-log-page">
      <header class="automation-log-page__header">
        <div>
          <div class="automation-page__eyebrow">${WORKFLOW_LOG_EYEBROW}</div>
          <h1>运行日志</h1>
        </div>
        <button type="button" class="btn btn-secondary" data-automation-log-back>返回 ${WORKFLOW_LABEL}</button>
      </header>
      <div class="automation-log-page__status" data-automation-log-status>正在读取日志...</div>
      <div class="automation-log-page__list" data-automation-log-list></div>
    </section>
  `;
  root.querySelector<HTMLButtonElement>("[data-automation-log-back]")?.addEventListener("click", () => {
    window.location.hash = automationId ? `#/automation/${encodeURIComponent(automationId)}` : "#/automation";
  });
  void loadAutomationLogs(root, automationId);
  return root;
}

function renderAutomationListPage(): HTMLElement {
  const root = document.createElement("section") as DisposableAutomationRoute;
  root.className = "automation-route";
  root.dataset.automationScroll = "";
  root.innerHTML = `
    <section class="automation-page automation-page--list">
      <header class="automation-page__header">
        <div>
          <div class="automation-page__eyebrow">${WORKFLOW_LIST_EYEBROW}</div>
          <h1>${WORKFLOW_LABEL}</h1>
          <p>查看并管理所有 workflow。</p>
        </div>
        <label class="automation-page__search">
          <input type="search" placeholder="搜索 Workflow 名称 / 流程说明" data-automation-search />
        </label>
      </header>
      <div class="automation-page__filters">
        <button type="button" class="btn btn-secondary" data-automation-filter="running">运行中</button>
        <button type="button" class="btn btn-secondary" data-automation-filter="stopped">未启动</button>
        <button type="button" class="btn btn-primary" data-automation-filter="all">全部 Workflow</button>
      </div>
      <div class="automation-page__status" data-automation-status>正在读取 Workflow...</div>
      <div class="automation-page__list" data-automation-list></div>
    </section>
  `;
  bindAutomationListPage(root);
  return root;
}

function renderAutomationDetailPage(automationId: string): HTMLElement {
  const root = document.createElement("section") as DisposableAutomationRoute;
  root.className = "automation-route";
  root.dataset.automationScroll = "";
  root.innerHTML = `
    <section class="automation-page automation-page--detail">
      <header class="automation-detail__header" data-automation-detail-header>
        <div class="automation-detail__header-main">
          <div class="automation-page__eyebrow">${WORKFLOW_DETAIL_EYEBROW}</div>
          <div class="automation-page__status" data-automation-detail-status>正在读取 Workflow 详情...</div>
        </div>
        <div class="automation-detail__header-actions">
          <button type="button" class="btn btn-secondary" data-automation-back>返回 ${WORKFLOW_LABEL}</button>
        </div>
      </header>
      <section class="automation-detail__body">
        <div class="automation-detail__canvas" data-automation-canvas-wrap></div>
        <aside class="automation-detail__comment-panel" data-automation-comment-panel></aside>
      </section>
    </section>
  `;
  root.querySelector<HTMLButtonElement>("[data-automation-back]")?.addEventListener("click", () => {
    window.location.hash = "#/automation";
  });
  bindAutomationDetailPage(root, automationId);
  return root;
}

function bindAutomationListPage(root: DisposableAutomationRoute): void {
  const state = { filter: "all" as AutomationFilter, query: "", items: [] as AutomationListItem[] };
  const refresh = async () => {
    try {
      state.items = await fetchAutomationList();
      renderAutomationList(root, state);
    } catch (error) {
      const status = root.querySelector<HTMLElement>("[data-automation-status]");
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    }
  };
  root.querySelectorAll<HTMLButtonElement>("[data-automation-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = (button.dataset.automationFilter as AutomationFilter) || "all";
      renderAutomationList(root, state);
    });
  });
  root.querySelector<HTMLInputElement>("[data-automation-search]")?.addEventListener("input", (event) => {
    state.query = (event.currentTarget as HTMLInputElement).value.trim();
    renderAutomationList(root, state);
  });
  root.__dispose = bindAutomationWorkspaceLiveRefresh(refresh);
  void refresh();
}

function renderAutomationList(
  root: HTMLElement,
  state: { filter: AutomationFilter; query: string; items: AutomationListItem[] },
): void {
  const list = root.querySelector<HTMLElement>("[data-automation-list]");
  const status = root.querySelector<HTMLElement>("[data-automation-status]");
  if (!list || !status) return;
  const filteredItems = state.items.filter((item) => matchesAutomationQuery(item, state.query));
  const executableItems = filteredItems.filter((item) => !isCodeItem(item)).filter((item) => matchesAutomationFilter(item, state.filter));
  const codeItems = state.filter === "all" ? filteredItems.filter(isCodeItem) : [];
  const sections = createAutomationListSections(executableItems, codeItems);
  const visibleCount = executableItems.length + codeItems.length;

  status.textContent = visibleCount === 0 ? "没有匹配的 Workflow。" : `共 ${visibleCount} 项`;
  list.innerHTML = sections.map(createAutomationListSectionHtml).join("");
  bindAutomationListActions(list);
}

function matchesAutomationQuery(item: AutomationListItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return `${item.name} ${item.summary} ${item.trigger}`.toLowerCase().includes(normalizedQuery);
}

function matchesAutomationFilter(item: AutomationListItem, filter: AutomationFilter): boolean {
  if (filter === "running") {
    return item.enabled;
  }
  if (filter === "stopped") {
    return !item.enabled;
  }
  return true;
}

function createAutomationListSections(
  executableItems: AutomationListItem[],
  codeItems: AutomationListItem[],
): Array<{ title: string; description: string; items: AutomationListItem[] }> {
  const sections: Array<{ title: string; description: string; items: AutomationListItem[] }> = [];
  if (executableItems.length > 0) {
    sections.push({
      title: "真实 Workflow",
      description: "这里展示当前可执行的显式 workflow 和应用内流程。",
      items: executableItems,
    });
  }
  if (codeItems.length > 0) {
    sections.push({
      title: "源码真实流程",
      description: "这里展示能直接追溯到当前源码入口函数和分支条件的真实 DAG。",
      items: codeItems,
    });
  }
  return sections;
}

function bindAutomationListActions(list: HTMLElement): void {
  list.querySelectorAll<HTMLButtonElement>("[data-automation-open]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = `#/automation/${encodeURIComponent(button.dataset.automationOpen ?? "")}`;
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-automation-log]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = `#/automation-log/${encodeURIComponent(button.dataset.automationLog ?? "")}`;
    });
  });
}

function bindAutomationDetailPage(root: DisposableAutomationRoute, automationId: string): void {
  const state: AutomationDetailCommentState = {
    detail: null as AutomationDetailResponse | null,
    commentMode: false,
    draftTarget: null as AutomationCommentDraftTarget | null,
    selectedCommentId: null as string | null,
  };
  const refresh = async () => {
    try {
      const detail = await fetchAutomationDetail(automationId);
      state.detail = detail;
      state.selectedCommentId = pickSelectedAutomationCommentId(detail.comments, state.selectedCommentId);
      renderAutomationDetail(root, automationId, state);
    } catch (error) {
      const status = root.querySelector<HTMLElement>("[data-automation-detail-status]");
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    }
  };
  root.__dispose = bindAutomationWorkspaceLiveRefresh(refresh);
  void refresh();
}

function renderAutomationDetail(
  root: HTMLElement,
  automationId: string,
  state: AutomationDetailCommentState,
): void {
  const elements = getAutomationDetailElements(root);
  if (!elements || !state.detail) {
    return;
  }

  const automation = state.detail.automation;
  elements.body.dataset.automationViewMode = "mermaid";
  renderAutomationDetailHeader(elements.header, automation, automationId);
  void renderAutomationDetailComments(
    { canvasWrap: elements.canvasWrap, commentPanel: elements.commentPanel },
    automationId,
    state,
    () => renderAutomationDetail(root, automationId, state),
  );
}

function getAutomationDetailElements(root: HTMLElement): {
  header: HTMLElement;
  body: HTMLElement;
  canvasWrap: HTMLElement;
  commentPanel: HTMLElement;
} | null {
  const header = root.querySelector<HTMLElement>("[data-automation-detail-header]");
  const body = root.querySelector<HTMLElement>(".automation-detail__body");
  const canvasWrap = root.querySelector<HTMLElement>("[data-automation-canvas-wrap]");
  const commentPanel = root.querySelector<HTMLElement>("[data-automation-comment-panel]");
  if (!header || !body || !canvasWrap || !commentPanel) {
    return null;
  }
  return { header, body, canvasWrap, commentPanel };
}

function renderAutomationDetailHeader(
  header: HTMLElement,
  automation: AutomationDetailResponse["automation"],
  automationId: string,
): void {
  const supportsExecutionControls = automation.sourceKind !== "code";
  header.innerHTML = `
    <div class="automation-detail__header-main">
      <div class="automation-page__eyebrow">${WORKFLOW_DETAIL_EYEBROW}</div>
      <h1>${escapeHtml(automation.name)}</h1>
      <p>${escapeHtml(automation.summary)}</p>
    </div>
    <div class="automation-detail__header-actions">
      <button type="button" class="btn btn-secondary" data-automation-back>返回 ${WORKFLOW_LABEL}</button>
      ${supportsExecutionControls ? `<button type="button" class="btn btn-secondary" data-automation-open-logs>运行日志</button>` : ""}
      <span class="automation-list-card__source" data-source-kind="${automation.sourceKind}">${escapeHtml(getSourceLabel(automation.sourceKind))}</span>
      ${supportsExecutionControls ? `<span class="automation-list-card__status" data-enabled="${automation.enabled ? "true" : "false"}">${automation.enabled ? "运行中" : "未启动"}</span>` : ""}
    </div>
  `;
  bindAutomationDetailHeader(header, automationId);
}

function bindAutomationDetailHeader(header: HTMLElement, automationId: string): void {
  header.querySelector<HTMLButtonElement>("[data-automation-back]")?.addEventListener("click", () => {
    window.location.hash = "#/automation";
  });
  header.querySelector<HTMLButtonElement>("[data-automation-open-logs]")?.addEventListener("click", () => {
    window.location.hash = `#/automation-log/${encodeURIComponent(automationId)}`;
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character] ?? character));
}
