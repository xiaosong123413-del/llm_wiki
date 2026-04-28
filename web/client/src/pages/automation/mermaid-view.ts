/**
 * Mermaid detail rendering for automation workspace detail pages.
 *
 * The automation API still returns normalized flow data. This module converts
 * that flow into a compact Mermaid flowchart and renders it into the detail
 * canvas host while exposing a pin-ready surface for later comment features.
 */

import type { AutomationDetailResponse } from "./api.js";
import {
  clampPinToSurface,
  collectMermaidTargetAnchors,
  measureMermaidSurface,
  toSurfacePoint,
  type MermaidTargetAnchor,
} from "./mermaid-comments.js";
import { renderMermaidSvg } from "./mermaid-runtime.js";

type MermaidAutomation = AutomationDetailResponse["automation"];
type AutomationNode = MermaidAutomation["flow"]["nodes"][number];
type MermaidHostElement = HTMLElement & { __disposeCommentPinDrag?: () => void };

const COMPACT_MERMAID_INIT = "%%{init: {\"flowchart\":{\"nodeSpacing\":24,\"rankSpacing\":28,\"padding\":6},\"themeVariables\":{\"fontSize\":\"12px\"}}}%%";
const MAX_PRIMARY_LABEL_LENGTH = 30;
const MAX_DESCRIPTION_LABEL_LENGTH = 48;
const MAX_IMPLEMENTATION_LABEL_LENGTH = 72;
const COMMENT_PIN_DRAG_THRESHOLD = 3;

export interface RenderedMermaidSurface {
  svg: SVGSVGElement;
  anchors: MermaidTargetAnchor[];
  pinsHost: HTMLElement;
  surface: HTMLElement;
}

export interface MermaidPinDragPosition {
  x: number;
  y: number;
}

export interface MermaidPinDragHandlers {
  onMoveComment: (commentId: string, position: MermaidPinDragPosition) => Promise<void>;
}

export async function renderAutomationMermaidView(
  host: HTMLElement,
  automation: MermaidAutomation,
): Promise<RenderedMermaidSurface | null> {
  disposeCommentPinDrag(host as MermaidHostElement);
  const key = `${automation.id}:${Date.now()}`;
  host.dataset.automationMermaidKey = key;
  host.innerHTML = `<div class="automation-detail__mermaid-loading">正在渲染流程图...</div>`;
  try {
    const svg = await renderMermaidSvg(createMermaidRenderId(automation.id), buildAutomationMermaidDiagram(automation));
    if (host.dataset.automationMermaidKey !== key) {
      return null;
    }
    host.innerHTML = `
      <div class="automation-detail__mermaid-diagram" data-automation-mermaid-diagram>
        <div class="automation-detail__mermaid-surface" data-automation-mermaid-surface>
          ${svg}
          <div class="automation-detail__comment-pins" data-automation-comment-pins></div>
          <button type="button" class="automation-detail__canvas-target" data-automation-canvas-target hidden></button>
        </div>
      </div>
    `;
    return getRenderedMermaidSurface(host);
  } catch (error) {
    if (host.dataset.automationMermaidKey !== key) {
      return null;
    }
    host.innerHTML = `<div class="automation-detail__mermaid-error">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
    return null;
  }
}

function getRenderedMermaidSurface(host: HTMLElement): RenderedMermaidSurface | null {
  const surface = host.querySelector<HTMLElement>("[data-automation-mermaid-surface]");
  const svg = surface?.querySelector<SVGSVGElement>("svg");
  const pinsHost = host.querySelector<HTMLElement>("[data-automation-comment-pins]");
  if (!surface || !svg || !pinsHost) {
    return null;
  }
  return {
    svg,
    anchors: collectMermaidTargetAnchors(svg),
    pinsHost,
    surface,
  };
}

export function bindAutomationCommentPinDragging(
  host: MermaidHostElement,
  surface: RenderedMermaidSurface,
  handlers: MermaidPinDragHandlers,
): void {
  let dragState: {
    commentId: string;
    pin: HTMLButtonElement;
    originalX: number;
    originalY: number;
    moved: boolean;
  } | null = null;

  const handlePointerDown = (event: PointerEvent): void => {
    const pin = getCommentPin(event.target);
    if (!pin || event.button !== 0) {
      return;
    }
    const point = readClampedSurfacePoint(surface, event);
    dragState = {
      commentId: pin.dataset.automationCommentPin ?? "",
      pin,
      originalX: readPinCoordinate(pin.style.left),
      originalY: readPinCoordinate(pin.style.top),
      moved: false,
    };
    pin.dataset.dragging = "true";
    updatePinPosition(pin, point.x, point.y);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!dragState) {
      return;
    }
    const point = readClampedSurfacePoint(surface, event);
    dragState.moved = dragState.moved || hasMovedPastThreshold(dragState.originalX, dragState.originalY, point.x, point.y);
    updatePinPosition(dragState.pin, point.x, point.y);
    event.preventDefault();
  };

  const handlePointerUp = (event: PointerEvent): void => {
    const state = dragState;
    if (!state) {
      return;
    }
    dragState = null;
    state.pin.removeAttribute("data-dragging");
    if (!state.moved || state.commentId === "") {
      restorePinPosition(state.pin, state.originalX, state.originalY);
      return;
    }
    state.pin.dataset.dragSuppressClick = "true";
    const point = readClampedSurfacePoint(surface, event);
    updatePinPosition(state.pin, point.x, point.y);
    void persistDraggedPin(state, point, handlers);
  };

  const handlePointerCancel = (): void => {
    const state = dragState;
    if (!state) {
      return;
    }
    restorePinPosition(state.pin, state.originalX, state.originalY);
    state.pin.removeAttribute("data-dragging");
    dragState = null;
  };

  const handleClickCapture = (event: Event): void => {
    const pin = getCommentPin(event.target);
    if (!pin || pin.dataset.dragSuppressClick !== "true") {
      return;
    }
    delete pin.dataset.dragSuppressClick;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  surface.pinsHost.addEventListener("pointerdown", handlePointerDown as EventListener);
  surface.pinsHost.addEventListener("click", handleClickCapture, true);
  window.addEventListener("pointermove", handlePointerMove as EventListener);
  window.addEventListener("pointerup", handlePointerUp as EventListener);
  window.addEventListener("pointercancel", handlePointerCancel);

  host.__disposeCommentPinDrag = () => {
    surface.pinsHost.removeEventListener("pointerdown", handlePointerDown as EventListener);
    surface.pinsHost.removeEventListener("click", handleClickCapture, true);
    window.removeEventListener("pointermove", handlePointerMove as EventListener);
    window.removeEventListener("pointerup", handlePointerUp as EventListener);
    window.removeEventListener("pointercancel", handlePointerCancel);
  };
}

function disposeCommentPinDrag(host: MermaidHostElement): void {
  host.__disposeCommentPinDrag?.();
  delete host.__disposeCommentPinDrag;
}

function getCommentPin(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest<HTMLButtonElement>("[data-automation-comment-pin]");
}

function readClampedSurfacePoint(
  surface: RenderedMermaidSurface,
  event: Pick<PointerEvent, "clientX" | "clientY">,
): { x: number; y: number } {
  const bounds = measureMermaidSurface(surface.surface, surface.svg);
  return clampPinToSurface(toSurfacePoint(event, bounds), bounds);
}

function hasMovedPastThreshold(startX: number, startY: number, nextX: number, nextY: number): boolean {
  return Math.abs(nextX - startX) > COMMENT_PIN_DRAG_THRESHOLD || Math.abs(nextY - startY) > COMMENT_PIN_DRAG_THRESHOLD;
}

function updatePinPosition(pin: HTMLButtonElement, x: number, y: number): void {
  pin.style.left = `${x}px`;
  pin.style.top = `${y}px`;
}

async function persistDraggedPin(
  state: {
    commentId: string;
    pin: HTMLButtonElement;
    originalX: number;
    originalY: number;
  },
  point: MermaidPinDragPosition,
  handlers: MermaidPinDragHandlers,
): Promise<void> {
  try {
    await handlers.onMoveComment(state.commentId, point);
  } catch {
    restorePinPosition(state.pin, state.originalX, state.originalY);
  }
}

function restorePinPosition(pin: HTMLButtonElement, x: number, y: number): void {
  updatePinPosition(pin, x, y);
}

function readPinCoordinate(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildAutomationMermaidDiagram(automation: MermaidAutomation): string {
  const customMermaid = normalizeCustomMermaid(automation.mermaid);
  if (customMermaid) {
    return customMermaid;
  }
  return [
    COMPACT_MERMAID_INIT,
    "flowchart TD",
    ...automation.flow.nodes.map(renderMermaidNode),
    ...renderMermaidEdges(automation),
  ].filter(Boolean).join("\n");
}

function createMermaidRenderId(automationId: string): string {
  return `automation-mermaid-${automationId.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function normalizeCustomMermaid(input: string | undefined): string | null {
  const source = String(input ?? "");
  if (source.trim() === "") {
    return null;
  }
  return source;
}

function renderMermaidNode(node: AutomationNode): string {
  const label = `"${escapeMermaidText(buildNodeLabel(node))}"`;
  if (node.type === "branch") {
    return `${node.id}{${label}}`;
  }
  return `${node.id}[${label}]`;
}

function renderMermaidEdges(automation: MermaidAutomation): string[] {
  return automation.flow.edges.map((edge) => `${edge.source} --> ${edge.target}`);
}

function buildNodeLabel(node: AutomationNode): string {
  const lines = [
    shortenLabelLine(node.title, MAX_PRIMARY_LABEL_LENGTH),
    buildSecondaryLabel(node),
  ];
  return lines.filter(Boolean).join("<br/>");
}

function buildSecondaryLabel(node: AutomationNode): string {
  const implementation = normalizeLabelText(node.implementation ?? "");
  if (implementation !== "") {
    return shortenLabelLine(implementation, MAX_IMPLEMENTATION_LABEL_LENGTH);
  }
  const description = normalizeLabelText(node.description);
  if (description === "" || description.length > MAX_DESCRIPTION_LABEL_LENGTH) {
    return "";
  }
  return description;
}

function shortenLabelLine(value: string, maxLength: number): string {
  const normalized = normalizeLabelText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function normalizeLabelText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeMermaidText(value: string): string {
  return value.replace(/"/g, "&quot;");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character] ?? character));
}
