import {
  locateSelection,
  type WikiCommentSelection,
  type WikiCommentSurfaceController,
} from "./wiki-comments.js";

const WIKI_SELECTION_TOOLBAR_GUTTER = 12;
const WIKI_SELECTION_TOOLBAR_FALLBACK_WIDTH = 160;

export interface WikiSelectionToolbarController {
  reset(): void;
  dispose(): void;
}

interface WikiSelectionToolbarPlacement {
  left: number;
  top: number;
}

interface WikiSelectionToolbarOptions {
  article: HTMLElement;
  toolbar: HTMLElement;
  commentButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  comments: WikiCommentSurfaceController;
  beforeCreateComment?: () => void;
}

export function createWikiSelectionToolbar(options: WikiSelectionToolbarOptions): WikiSelectionToolbarController {
  let selectionSnapshot: WikiCommentSelection | null = null;

  const reset = (): void => {
    selectionSnapshot = null;
    options.toolbar.style.removeProperty("left");
    options.toolbar.style.removeProperty("top");
    options.toolbar.style.removeProperty("visibility");
    options.toolbar.hidden = true;
  };

  const dismissToolbar = (clearSelection: boolean): void => {
    if (clearSelection) {
      window.getSelection()?.removeAllRanges();
    }
    reset();
  };

  const syncSelectionToolbar = (): void => {
    const liveState = readSelectionState(options.article);
    if (liveState.kind === "inside") {
      selectionSnapshot = liveState.selection;
      if (options.toolbar.hidden) {
        options.toolbar.style.visibility = "hidden";
        options.toolbar.hidden = false;
      }
      options.toolbar.style.left = `${Math.round(clampSelectionToolbarLeft(liveState.placement.left, options.toolbar))}px`;
      options.toolbar.style.top = `${Math.round(liveState.placement.top)}px`;
      options.toolbar.style.removeProperty("visibility");
      options.toolbar.hidden = false;
      return;
    }
    if (liveState.kind === "outside") {
      selectionSnapshot = null;
    }
    options.toolbar.style.removeProperty("left");
    options.toolbar.style.removeProperty("top");
    options.toolbar.style.removeProperty("visibility");
    options.toolbar.hidden = true;
  };

  const onCreateComment = (): void => {
    const preservedSelection = selectionSnapshot;
    dismissToolbar(true);
    options.beforeCreateComment?.();
    void options.comments.createFromSelection(preservedSelection);
  };

  const onCopySelection = async (): Promise<void> => {
    try {
      if (!selectionSnapshot) {
        return;
      }
      await navigator.clipboard?.writeText?.(selectionSnapshot.quote);
    } catch {
      // Clipboard access can fail in browser privacy contexts. Closing the
      // toolbar keeps the selection flow consistent without surfacing an
      // unhandled rejection.
    } finally {
      dismissToolbar(true);
    }
  };

  const onCancelSelection = (): void => {
    dismissToolbar(true);
  };

  const onCopySelectionClick = (): void => {
    void onCopySelection();
  };

  document.addEventListener("selectionchange", syncSelectionToolbar);
  options.commentButton.addEventListener("click", onCreateComment);
  options.copyButton.addEventListener("click", onCopySelectionClick);
  options.cancelButton.addEventListener("click", onCancelSelection);
  syncSelectionToolbar();

  return {
    reset,
    dispose() {
      document.removeEventListener("selectionchange", syncSelectionToolbar);
      options.commentButton.removeEventListener("click", onCreateComment);
      options.copyButton.removeEventListener("click", onCopySelectionClick);
      options.cancelButton.removeEventListener("click", onCancelSelection);
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
