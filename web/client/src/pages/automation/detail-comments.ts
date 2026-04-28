/**
 * Workflow detail comment integration for Mermaid-based automation pages.
 *
 * This module owns the wiring between rendered Mermaid surfaces, persisted
 * comments, and the existing side-panel controls so the page entry module can
 * stay focused on route-level state and layout concerns.
 */

import {
  patchAutomationComment,
  type AutomationCommentDraftTarget,
  type AutomationCommentResponse,
  type AutomationDetailResponse,
} from "./api.js";
import {
  bindAutomationCommentTargets,
  createAutomationDraftComment,
  removeAutomationComment,
  renderAutomationCommentPanel,
  renderAutomationCommentPins,
  type AutomationCommentPanelState,
} from "./panels.js";
import { bindAutomationCommentPinDragging, renderAutomationMermaidView } from "./mermaid-view.js";

export interface AutomationDetailCommentState {
  detail: AutomationDetailResponse | null;
  commentMode: boolean;
  draftTarget: AutomationCommentDraftTarget | null;
  selectedCommentId: string | null;
}

export interface AutomationDetailCommentElements {
  canvasWrap: HTMLElement;
  commentPanel: HTMLElement;
}

export async function renderAutomationDetailComments(
  elements: AutomationDetailCommentElements,
  automationId: string,
  state: AutomationDetailCommentState,
  rerender: () => void,
): Promise<void> {
  if (!state.detail) {
    return;
  }
  const automation = state.detail.automation;
  const surface = await renderAutomationMermaidView(elements.canvasWrap, automation);
  if (!surface || state.detail?.automation.id !== automation.id) {
    return;
  }
  const orphanedCommentIds = renderAutomationCommentPins(surface, state.detail.comments, state.selectedCommentId, (commentId) => {
    state.selectedCommentId = commentId;
    state.draftTarget = null;
    rerender();
  });
  bindAutomationCommentPinDragging(elements.canvasWrap, surface, {
    onMoveComment: async (commentId, position) => {
      const nextDetail = await moveAutomationComment(state.detail, automationId, commentId, position.x, position.y);
      state.detail = nextDetail;
      rerender();
    },
  });
  bindAutomationCommentTargets(surface, state.commentMode, (draftTarget) => {
    state.draftTarget = draftTarget;
    state.selectedCommentId = null;
    rerender();
  });
  renderAutomationCommentPanel(elements.commentPanel, createCommentPanelState(state, orphanedCommentIds), {
    onToggleCommentMode: () => {
      state.commentMode = !state.commentMode;
      if (!state.commentMode) {
        state.draftTarget = null;
      }
      rerender();
    },
    onSaveDraft: async (text) => {
      if (!state.detail || !state.draftTarget) {
        return;
      }
      const created = await createAutomationDraftComment(automationId, state.draftTarget, text);
      if (!created) {
        return;
      }
      state.detail = { ...state.detail, comments: [...state.detail.comments, created] };
      state.selectedCommentId = created.id;
      state.draftTarget = null;
      rerender();
    },
    onDeleteComment: async (commentId) => {
      if (!state.detail) {
        return;
      }
      await removeAutomationComment(automationId, commentId);
      state.detail = {
        ...state.detail,
        comments: state.detail.comments.filter((comment) => comment.id !== commentId),
      };
      state.selectedCommentId = state.selectedCommentId === commentId ? null : state.selectedCommentId;
      rerender();
    },
    onSelectComment: (commentId) => {
      state.selectedCommentId = commentId;
      state.draftTarget = null;
      rerender();
    },
  });
}

export function pickSelectedAutomationCommentId(
  comments: AutomationDetailResponse["comments"],
  selectedCommentId: string | null,
): string | null {
  if (!selectedCommentId) {
    return null;
  }
  return comments.some((comment) => comment.id === selectedCommentId) ? selectedCommentId : null;
}

function createCommentPanelState(
  state: {
    detail: AutomationDetailResponse;
    commentMode: boolean;
    draftTarget: AutomationCommentDraftTarget | null;
    selectedCommentId: string | null;
  },
  orphanedCommentIds: ReadonlySet<string>,
): AutomationCommentPanelState {
  return {
    comments: state.detail.comments,
    commentMode: state.commentMode,
    selectedCommentId: state.selectedCommentId,
    draft: state.draftTarget,
    orphanedCommentIds,
  };
}

async function moveAutomationComment(
  detail: AutomationDetailResponse,
  automationId: string,
  commentId: string,
  x: number,
  y: number,
): Promise<AutomationDetailResponse> {
  const updatedComment = await patchAutomationComment(automationId, commentId, {
    manualX: x,
    manualY: y,
    pinnedX: x,
    pinnedY: y,
  });
  return {
    ...detail,
    comments: detail.comments.map((comment) => replaceUpdatedComment(comment, updatedComment)),
  };
}

function replaceUpdatedComment(
  comment: AutomationCommentResponse,
  updatedComment: AutomationCommentResponse,
): AutomationCommentResponse {
  return comment.id === updatedComment.id ? updatedComment : comment;
}
