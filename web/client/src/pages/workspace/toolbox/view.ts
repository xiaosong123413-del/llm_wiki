/**
 * Toolbox page rendering helpers.
 *
 * This file renders the reference-style toolbox dashboard and its lightweight
 * management overlay from normalized client state. It intentionally contains
 * no side effects or fetch logic.
 */

import { renderIcon } from "../../../components/icon.js";
import {
  filterToolboxAssets,
  filterToolboxWorkflows,
  getManagerRecords,
  isEditableDraft,
} from "./model.js";
import type {
  ToolboxAccent,
  ToolboxAssetRecord,
  ToolboxEntityType,
  ToolboxFavoriteRecord,
  ToolboxRecentRunRecord,
  ToolboxState,
  ToolboxWorkflowRecord,
} from "./types.js";

export function renderToolboxView(state: ToolboxState): string {
  if (state.status === "loading") {
    return renderToolboxStatus("正在读取工具箱工作流、工具资产与快捷入口...");
  }
  if (state.status === "error") {
    return renderToolboxStatus(state.error ?? "工具箱读取失败");
  }
  if (!state.data) {
    return renderToolboxStatus("工具箱数据尚未准备好");
  }
  if (state.manager.openSection && state.manager.draft) {
    return renderManagerPage(state);
  }

  const workflows = filterToolboxWorkflows(state);
  const assets = filterToolboxAssets(state);
  return `
    <section class="workspace-view workspace-view--toolbox workspace-toolbox-page" data-workspace-view="toolbox">
      <header class="workspace-toolbox-page__hero">
        <div class="workspace-toolbox-page__hero-copy">
          <h1>${escapeHtml(state.data.page.title)}</h1>
          <p>${escapeHtml(state.data.page.subtitle)}</p>
        </div>
        <div class="workspace-toolbox-page__hero-actions">
          <label class="workspace-toolbox-page__search">
            ${renderIcon("search", { size: 18 })}
            <input
              type="search"
              value="${escapeHtml(state.search)}"
              placeholder="搜索工具 / 工作流"
              aria-label="搜索工具 / 工作流"
              data-toolbox-search
            />
          </label>
          <button type="button" class="workspace-toolbox-page__notice" aria-label="提醒">
            ${renderIcon("message-square", { size: 18 })}
          </button>
          <div class="workspace-toolbox-page__profile">
            <span class="workspace-toolbox-page__avatar">项</span>
            <strong>你的项目</strong>
          </div>
        </div>
      </header>

      <div class="workspace-toolbox-page__layout">
        <div class="workspace-toolbox-page__main">
          <section class="workspace-toolbox-surface workspace-toolbox-surface--workflows">
            <header class="workspace-toolbox-surface__header">
              <div>
                <h2>工作流</h2>
                <p>工作流 = 场景，应用 = 执行能力</p>
              </div>
              <div class="workspace-toolbox-surface__meta">
                <span class="workspace-toolbox-surface__pill">每条工作流都绑定一个应用</span>
                <button type="button" class="workspace-toolbox-surface__manage" data-toolbox-manage="workflows">管理</button>
              </div>
            </header>
            <div class="workspace-toolbox-workflows">
              ${workflows.map((workflow) => renderWorkflowCard(workflow)).join("") || renderEmptyBlock("当前筛选下没有匹配的工作流。")}
            </div>
          </section>

          <section class="workspace-toolbox-surface workspace-toolbox-surface--assets">
            <header class="workspace-toolbox-surface__header workspace-toolbox-surface__header--stacked">
              <div>
                <h2>工具资产</h2>
                <p>把软件、模板、检查清单和自动化入口组织成可直接调用的资产面板。</p>
              </div>
              <button type="button" class="workspace-toolbox-surface__manage" data-toolbox-manage="assets">管理</button>
            </header>
            <div class="workspace-toolbox-assets__filters">
              ${state.data.page.assetCategories.map((category) => `
                <button
                  type="button"
                  class="workspace-toolbox-assets__filter${category === state.activeAssetCategory ? " is-active" : ""}"
                  data-toolbox-asset-category="${escapeHtml(category)}"
                >${escapeHtml(category)}</button>
              `).join("")}
            </div>
            <div class="workspace-toolbox-assets" data-toolbox-assets-grid>
              ${assets.map((asset) => renderAssetCard(asset)).join("") || renderEmptyBlock("当前筛选下没有匹配的工具资产。")}
            </div>
          </section>
        </div>

        <aside class="workspace-toolbox-rail">
          <section class="workspace-toolbox-rail__panel">
            <header class="workspace-toolbox-rail__header">
              <h3>最近运行的应用</h3>
              <button type="button" class="workspace-toolbox-rail__link">查看全部</button>
            </header>
            <div class="workspace-toolbox-rail__list">
              ${state.data.recentRuns.map((record) => renderRecentRun(record)).join("")}
            </div>
          </section>

          <section class="workspace-toolbox-rail__panel">
            <header class="workspace-toolbox-rail__header">
              <h3>收藏夹 / 快捷入口</h3>
            </header>
            <div class="workspace-toolbox-rail__list">
              ${state.data.favorites.map((favorite) => renderFavorite(favorite)).join("")}
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderToolboxStatus(message: string): string {
  return `
    <section class="workspace-view workspace-view--toolbox workspace-toolbox-page" data-workspace-view="toolbox">
      <section class="workspace-panel workspace-panel--pool-placeholder">
        <div class="eyebrow">TOOLBOX</div>
        <h2>工具箱</h2>
        <p class="workspace-page__subtitle">${escapeHtml(message)}</p>
      </section>
    </section>
  `;
}

function renderWorkflowCard(workflow: ToolboxWorkflowRecord): string {
  return `
    <article class="workspace-toolbox-workflow" data-accent="${workflow.accent}">
      <div class="workspace-toolbox-workflow__icon">${renderAccentBadge(workflow.accent, renderIcon("copy", { size: 16 }))}</div>
      <div class="workspace-toolbox-workflow__copy">
        <strong>${escapeHtml(workflow.title)}</strong>
        <p>${escapeHtml(workflow.summary)}</p>
      </div>
      <span class="workspace-toolbox-workflow__ratio">${escapeHtml(workflow.ratioLabel)}</span>
      <span class="workspace-toolbox-workflow__arrow">→</span>
      <strong class="workspace-toolbox-workflow__agent">${escapeHtml(workflow.agentName)}</strong>
    </article>
  `;
}

function renderAssetCard(asset: ToolboxAssetRecord): string {
  const sourceLabel = asset.source.type === "legacy-markdown" ? "Legacy" : asset.badge;
  return `
    <article class="workspace-toolbox-asset" data-category="${escapeHtml(asset.category)}">
      <div class="workspace-toolbox-asset__icon">${renderAccentBadge("blue", renderIcon("folder-open", { size: 18 }))}</div>
      <div class="workspace-toolbox-asset__copy">
        <div class="workspace-toolbox-asset__title-row">
          <strong>${escapeHtml(asset.title)}</strong>
          <span class="workspace-toolbox-asset__badge">${escapeHtml(sourceLabel)}</span>
        </div>
        <p>${escapeHtml(asset.summary)}</p>
      </div>
    </article>
  `;
}

function renderRecentRun(record: ToolboxRecentRunRecord): string {
  return `
    <article class="workspace-toolbox-rail__row">
      <span class="workspace-toolbox-rail__dot" data-accent="${record.accent}"></span>
      <strong>${escapeHtml(record.agentName)}</strong>
      <span>${escapeHtml(record.ranAtLabel)}</span>
    </article>
  `;
}

function renderFavorite(record: ToolboxFavoriteRecord): string {
  return `
    <article class="workspace-toolbox-rail__row">
      <span class="workspace-toolbox-rail__dot" data-accent="${record.accent}"></span>
      <strong>${escapeHtml(record.title)}</strong>
      <span>☆</span>
    </article>
  `;
}

function renderManagerPage(state: ToolboxState): string {
  if (!state.data || !state.manager.openSection || !state.manager.draft) {
    return renderToolboxStatus("工具箱管理页数据尚未准备好");
  }
  const section = state.manager.openSection;
  const records = getManagerRecords(state.data, section);
  const editable = isEditableDraft(state.manager.draft);
  const managerName = section === "workflow" ? "工作流" : "工具资产";
  const managerDataAttr = getManagerDataAttr(section);
  const description = section === "workflow"
    ? "集中维护工作流标题、摘要、应用和展示比例。"
    : "集中维护工具资产条目，并区分 legacy 只读资产与可编辑受管资产。";
  return `
    <section class="workspace-view workspace-view--toolbox workspace-toolbox-page workspace-toolbox-page--manager" data-workspace-view="toolbox">
      <header class="workspace-toolbox-manager-page__header">
        <button type="button" class="workspace-toolbox-manager-page__back" data-toolbox-manager-back>
          <span aria-hidden="true">←</span>
          <span>返回</span>
        </button>
        <div class="workspace-toolbox-manager-page__intro">
          <div>
            <div class="workspace-toolbox-manager__eyebrow">MANAGE</div>
            <h2>管理${managerName}</h2>
            <p>${description}</p>
          </div>
        </div>
      </header>
      <section class="workspace-toolbox-manager workspace-toolbox-manager--page" data-toolbox-manager-page="${managerDataAttr}">
        <div class="workspace-toolbox-manager__body">
          <aside class="workspace-toolbox-manager__list">
            <button type="button" class="workspace-toolbox-manager__create" data-toolbox-manager-create>
              ${renderIcon("plus", { size: 16 })}
              <span>新增${managerName}</span>
            </button>
            ${records.map((record) => `
              <button
                type="button"
                class="workspace-toolbox-manager__record${record.id === state.manager.selectedId ? " is-active" : ""}"
                data-toolbox-manager-record="${escapeHtml(record.id)}"
              >
                <strong>${escapeHtml(record.title)}</strong>
                <span>${escapeHtml(record.entityType === "workflow" ? record.agentName : record.category)}</span>
              </button>
            `).join("")}
          </aside>
          <div class="workspace-toolbox-manager__form">
            ${editable ? "" : `<p class="workspace-toolbox-manager__hint">Legacy Markdown 资产只读。新建受管记录后即可在这里编辑。</p>`}
            <label class="workspace-toolbox-manager__field">
              <span>标题</span>
              <input type="text" value="${escapeHtml(state.manager.draft.title)}" data-toolbox-manager-field="title" />
            </label>
            <label class="workspace-toolbox-manager__field">
              <span>摘要</span>
              <input type="text" value="${escapeHtml(state.manager.draft.summary)}" data-toolbox-manager-field="summary" />
            </label>
            ${section === "asset" ? `
              <label class="workspace-toolbox-manager__field">
                <span>分类</span>
                <input type="text" value="${escapeHtml(state.manager.draft.category)}" data-toolbox-manager-field="category" />
              </label>
              <label class="workspace-toolbox-manager__field">
                <span>徽标</span>
                <input type="text" value="${escapeHtml(state.manager.draft.badge)}" data-toolbox-manager-field="badge" />
              </label>
              <label class="workspace-toolbox-manager__field">
                <span>链接</span>
                <input type="url" value="${escapeHtml(state.manager.draft.href)}" data-toolbox-manager-field="href" />
              </label>
            ` : `
              <label class="workspace-toolbox-manager__field">
                <span>应用</span>
                <input type="text" value="${escapeHtml(state.manager.draft.agentName)}" data-toolbox-manager-field="agentName" />
              </label>
              <label class="workspace-toolbox-manager__field">
                <span>比例</span>
                <input type="text" value="${escapeHtml(state.manager.draft.ratioLabel)}" data-toolbox-manager-field="ratioLabel" />
              </label>
            `}
            <div class="workspace-toolbox-manager__actions">
              <button type="button" class="btn btn-secondary btn-inline" data-toolbox-manager-delete ${editable ? "" : "disabled"}>
                删除
              </button>
              <button type="button" class="btn btn-primary btn-inline" data-toolbox-manager-save ${editable ? "" : "disabled"}>
                保存
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  `;
}

function renderEmptyBlock(message: string): string {
  return `<div class="workspace-toolbox-empty">${escapeHtml(message)}</div>`;
}

function renderAccentBadge(accent: ToolboxAccent, icon: string): string {
  return `<span class="workspace-toolbox-accent-badge" data-accent="${accent}">${icon}</span>`;
}

function getManagerDataAttr(section: ToolboxEntityType): "workflows" | "assets" {
  return section === "workflow" ? "workflows" : "assets";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
    };
    return escaped[character] ?? character;
  });
}
