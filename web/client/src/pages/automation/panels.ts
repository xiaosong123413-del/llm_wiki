/**
 * Comment and log panel helpers for the automation workspace.
 *
 * These helpers keep DOM template code out of the page entry module while
 * preserving the page's state-driven interactions.
 */

import {
  createAutomationComment,
  deleteAutomationComment,
  fetchAutomationLogs,
  type AutomationCommentDraftTarget,
  type AutomationCommentResponse,
} from "./api.js";
import { resolveCommentPinPosition } from "./mermaid-comments.js";
import type { RenderedMermaidSurface } from "./mermaid-view.js";

export interface AutomationCommentPanelState {
  comments: AutomationCommentResponse[];
  commentMode: boolean;
  selectedCommentId: string | null;
  draft: AutomationCommentDraftTarget | null;
  orphanedCommentIds: ReadonlySet<string>;
}

interface AutomationCommentPanelHandlers {
  onToggleCommentMode: () => void;
  onSaveDraft: (text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onSelectComment: (commentId: string) => void;
}

export async function loadAutomationLogs(root: HTMLElement, automationId: string): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-automation-log-status]");
  const list = root.querySelector<HTMLElement>("[data-automation-log-list]");
  if (!status || !list) {
    return;
  }
  try {
    const logs = await fetchAutomationLogs(automationId);
    status.textContent = logs.length === 0 ? "暂无运行记录。" : `最近 ${logs.length} 条运行记录`;
    list.innerHTML = logs.map((log) => `
      <article class="automation-log-page__item">
        <strong>${escapeHtml(log.summary)}</strong>
        <span>${escapeHtml(log.status)}</span>
      </article>
    `).join("");
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

export function renderAutomationCommentPanel(
  panel: HTMLElement,
  state: AutomationCommentPanelState,
  handlers: AutomationCommentPanelHandlers,
): void {
  panel.innerHTML = `
    <button
      type="button"
      class="btn ${state.commentMode ? "btn-primary" : "btn-secondary"}"
      data-automation-comment-toggle
      aria-pressed="${state.commentMode ? "true" : "false"}"
    >${state.commentMode ? "退出评论模式" : "评论模式"}</button>
    <div class="automation-detail__comment-hint">${getCommentHint(state)}</div>
    <div data-automation-comment-error hidden></div>
    ${state.draft ? `
      <div class="automation-detail__comment-item">
        <strong>${escapeHtml(getDraftLabel(state.draft))}</strong>
        <textarea class="automation-detail__comment-input" data-automation-comment-input placeholder="输入评论"></textarea>
        <button type="button" class="btn btn-primary" data-automation-comment-save>保存评论</button>
      </div>
    ` : ""}
    <div class="automation-detail__comment-list">
      ${state.comments.map((comment) => `
        <article class="automation-detail__comment-item" data-selected="${comment.id === state.selectedCommentId ? "true" : "false"}">
          <button type="button" class="btn btn-secondary" data-automation-comment-select="${escapeAttr(comment.id)}">${escapeHtml(getCommentTitle(comment))}</button>
          <div>${escapeHtml(comment.text)}</div>
          ${state.orphanedCommentIds.has(comment.id) ? `<div>原目标已不存在，当前显示为保留图钉。</div>` : ""}
          <button type="button" class="btn btn-secondary" data-automation-comment-delete="${escapeAttr(comment.id)}">删除</button>
        </article>
      `).join("")}
    </div>
  `;
  bindCommentPanel(panel, state, handlers);
}

function bindCommentPanel(
  panel: HTMLElement,
  state: AutomationCommentPanelState,
  handlers: AutomationCommentPanelHandlers,
): void {
  panel.querySelector<HTMLButtonElement>("[data-automation-comment-toggle]")?.addEventListener("click", () => {
    clearCommentPanelError(panel);
    handlers.onToggleCommentMode();
  });
  panel.querySelector<HTMLButtonElement>("[data-automation-comment-save]")?.addEventListener("click", async () => {
    const input = panel.querySelector<HTMLTextAreaElement>("[data-automation-comment-input]");
    if (!state.draft || !input) {
      return;
    }
    clearCommentPanelError(panel);
    try {
      await handlers.onSaveDraft(input.value.trim());
    } catch (error) {
      showCommentPanelError(panel, error);
    }
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-automation-comment-select]").forEach((button) => {
    button.addEventListener("click", () => {
      clearCommentPanelError(panel);
      handlers.onSelectComment(button.dataset.automationCommentSelect ?? "");
    });
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-automation-comment-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      clearCommentPanelError(panel);
      try {
        await handlers.onDeleteComment(button.dataset.automationCommentDelete ?? "");
      } catch (error) {
        showCommentPanelError(panel, error);
      }
    });
  });
}

export async function createAutomationDraftComment(
  automationId: string,
  draft: AutomationCommentDraftTarget,
  text: string,
): Promise<AutomationCommentResponse | null> {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  return createAutomationComment(automationId, {
    targetType: draft.targetType,
    targetId: draft.targetId,
    text: trimmed,
    pinnedX: draft.pinnedX,
    pinnedY: draft.pinnedY,
  });
}

async function deleteAutomationExistingComment(automationId: string, commentId: string): Promise<void> {
  if (commentId === "") {
    return;
  }
  await deleteAutomationComment(automationId, commentId);
}

function getCommentHint(state: AutomationCommentPanelState): string {
  if (state.draft) {
    return "已选择图上目标，输入评论后保存。";
  }
  if (state.commentMode) {
    return "评论模式已开启，点击节点、连线或空白处落点。";
  }
  if (state.comments.length > 0) {
    return "可从列表选择已有评论，或进入评论模式继续添加。";
  }
  return "进入评论模式后，再点击节点、连线或空白处添加评论。";
}

function getDraftLabel(draft: AutomationCommentDraftTarget): string {
  if (draft.targetType === "canvas") {
    return "当前草稿: 画布空白处";
  }
  return `当前草稿: ${draft.targetType} / ${draft.targetId}`;
}

function getCommentTitle(comment: AutomationCommentResponse): string {
  const targetLabel = comment.targetType === "canvas" ? "画布" : comment.targetId;
  return `${targetLabel}${comment.id ? ` · ${comment.id}` : ""}`;
}

export async function removeAutomationComment(
  automationId: string,
  commentId: string,
): Promise<void> {
  await deleteAutomationExistingComment(automationId, commentId);
}

export function renderAutomationCommentPins(
  surface: RenderedMermaidSurface,
  comments: AutomationCommentResponse[],
  selectedCommentId: string | null,
  onSelectComment: (commentId: string) => void,
): ReadonlySet<string> {
  const orphanedCommentIds = new Set<string>();
  surface.pinsHost.innerHTML = comments.map((comment) => {
    const position = resolveCommentPinPosition(comment, surface.anchors);
    if (position.orphaned) {
      orphanedCommentIds.add(comment.id);
    }
    return `
      <button
        type="button"
        class="automation-detail__comment-pin"
        data-automation-comment-pin="${escapeHtml(comment.id)}"
        data-selected="${comment.id === selectedCommentId ? "true" : "false"}"
        data-orphaned="${position.orphaned ? "true" : "false"}"
        style="left:${position.x}px;top:${position.y}px"
        title="${escapeHtml(comment.text)}"
      ></button>
    `;
  }).join("");
  surface.pinsHost.querySelectorAll<HTMLButtonElement>("[data-automation-comment-pin]").forEach((button) => {
    button.addEventListener("click", () => {
      onSelectComment(button.dataset.automationCommentPin ?? "");
    });
  });
  return orphanedCommentIds;
}

export function bindAutomationCommentTargets(
  surface: RenderedMermaidSurface,
  commentMode: boolean,
  onCreateDraft: (draftTarget: AutomationCommentDraftTarget) => void,
): void {
  for (const anchor of surface.anchors) {
    const target = anchor.targetType === "canvas"
      ? surface.surface.querySelector<HTMLElement>("[data-automation-canvas-target]")
      : surface.svg.querySelector<HTMLElement>(`#${escapeSelector(anchor.targetId)}`);
    if (!target) {
      continue;
    }
    target.dataset.automationCommentTarget = anchor.targetId;
    target.dataset.automationCommentTargetType = anchor.targetType;
    if (anchor.targetType === "canvas") {
      target.hidden = !commentMode;
    }
    if (!commentMode) {
      continue;
    }
    target.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onCreateDraft({
        targetType: anchor.targetType,
        targetId: anchor.targetId,
        pinnedX: anchor.x,
        pinnedY: anchor.y,
      });
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character] ?? character));
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function escapeSelector(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function clearCommentPanelError(panel: HTMLElement): void {
  const error = panel.querySelector<HTMLElement>("[data-automation-comment-error]");
  if (!error) {
    return;
  }
  error.hidden = true;
  error.textContent = "";
}

function showCommentPanelError(panel: HTMLElement, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorBanner = panel.querySelector<HTMLElement>("[data-automation-comment-error]");
  if (!errorBanner) {
    return;
  }
  errorBanner.hidden = false;
  errorBanner.textContent = errorMessage || "评论操作失败。";
}
