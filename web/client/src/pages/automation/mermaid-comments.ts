/**
 * Mermaid geometry helpers for workflow comment pins.
 *
 * This module only reads SVG structure and resolves pin coordinates. It keeps
 * DOM mutation out of the rendering path so the Mermaid source passthrough can
 * stay unchanged while later tasks add interactive comment wiring.
 */

import type { AutomationCommentResponse } from "./api.js";

export interface MermaidTargetAnchor {
  targetType: "node" | "edge" | "canvas";
  targetId: string;
  x: number;
  y: number;
}

export interface MermaidCommentPinPosition {
  targetType: AutomationCommentResponse["targetType"] | "canvas";
  targetId: string;
  pinnedX?: number;
  pinnedY?: number;
  manualX?: number;
  manualY?: number;
}

export interface MermaidSurfacePoint {
  x: number;
  y: number;
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function collectMermaidTargetAnchors(svg: SVGSVGElement): MermaidTargetAnchor[] {
  const anchors = [
    ...collectNodeAnchors(svg),
    ...collectEdgeAnchors(svg),
  ];
  const canvasAnchor = collectCanvasAnchor(svg);
  return canvasAnchor ? [...anchors, canvasAnchor] : anchors;
}

export function resolveCommentPinPosition(
  comment: MermaidCommentPinPosition,
  anchors: MermaidTargetAnchor[],
): { x: number; y: number; orphaned: boolean } {
  const targetAnchor = anchors.find((anchor) => anchor.targetType === comment.targetType && anchor.targetId === comment.targetId);
  const manual = pickPoint(comment.manualX, comment.manualY);
  if (manual) {
    return { ...manual, orphaned: targetAnchor === undefined && comment.targetType !== "canvas" };
  }
  if (targetAnchor) {
    return { x: targetAnchor.x, y: targetAnchor.y, orphaned: false };
  }
  const pinned = pickPoint(comment.pinnedX, comment.pinnedY);
  if (pinned) {
    return { ...pinned, orphaned: true };
  }
  const canvasAnchor = anchors.find((anchor) => anchor.targetType === "canvas");
  if (canvasAnchor) {
    return { x: canvasAnchor.x, y: canvasAnchor.y, orphaned: true };
  }
  return { x: 0, y: 0, orphaned: true };
}

export function toSurfacePoint(
  event: Pick<PointerEvent, "clientX" | "clientY">,
  surfaceRect: Pick<DOMRect, "left" | "top">,
): MermaidSurfacePoint {
  return {
    x: event.clientX - surfaceRect.left,
    y: event.clientY - surfaceRect.top,
  };
}

export function clampPinToSurface(
  point: MermaidSurfacePoint,
  size: { width: number; height: number },
): MermaidSurfacePoint {
  return {
    x: Math.max(0, Math.min(size.width, point.x)),
    y: Math.max(0, Math.min(size.height, point.y)),
  };
}

export function measureMermaidSurface(
  surface: HTMLElement,
  svg: SVGSVGElement,
): { left: number; top: number; width: number; height: number } {
  const rect = surface.getBoundingClientRect();
  const fallbackSize = readSvgViewportSize(svg);
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width > 0 ? rect.width : fallbackSize.width,
    height: rect.height > 0 ? rect.height : fallbackSize.height,
  };
}

function collectNodeAnchors(svg: SVGSVGElement): MermaidTargetAnchor[] {
  return Array.from(svg.querySelectorAll<SVGGElement>("g.node[id]"))
    .map((node) => createAnchor("node", node.id, getElementCenter(node)))
    .filter((anchor): anchor is MermaidTargetAnchor => anchor !== null);
}

function collectEdgeAnchors(svg: SVGSVGElement): MermaidTargetAnchor[] {
  const edgeGroups = Array.from(svg.querySelectorAll<SVGGElement>("g.edgePath[id]"));
  if (edgeGroups.length > 0) {
    return edgeGroups
      .map((edge) => createAnchor("edge", edge.id, getPathCenter(edge.querySelector("path")) ?? getElementCenter(edge)))
      .filter((anchor): anchor is MermaidTargetAnchor => anchor !== null);
  }
  return Array.from(svg.querySelectorAll<SVGPathElement>("path.flowchart-link[id], path[class*='flowchart-link'][id]"))
    .map((path) => createAnchor("edge", path.id, getPathCenter(path)))
    .filter((anchor): anchor is MermaidTargetAnchor => anchor !== null);
}

function collectCanvasAnchor(svg: SVGSVGElement): MermaidTargetAnchor | null {
  const parsedViewBox = parseViewBox(svg.getAttribute("viewBox"));
  if (parsedViewBox) {
    return {
      targetType: "canvas",
      targetId: "canvas",
      x: parsedViewBox.x + (parsedViewBox.width / 2),
      y: parsedViewBox.y + (parsedViewBox.height / 2),
    };
  }
  const width = parseCoordinate(svg.getAttribute("width"));
  const height = parseCoordinate(svg.getAttribute("height"));
  if (!isFiniteNumber(width) || !isFiniteNumber(height)) {
    return null;
  }
  return {
    targetType: "canvas",
    targetId: "canvas",
    x: width / 2,
    y: height / 2,
  };
}

function createAnchor(
  targetType: MermaidTargetAnchor["targetType"],
  targetId: string,
  point: { x: number; y: number } | null,
): MermaidTargetAnchor | null {
  if (!targetId || !point) {
    return null;
  }
  return { targetType, targetId, x: point.x, y: point.y };
}

function getElementCenter(element: Element | null): { x: number; y: number } | null {
  if (!element) {
    return null;
  }
  const graphic = element as SVGGraphicsElement;
  if (typeof graphic.getBBox === "function") {
    const box = graphic.getBBox();
    if (isFiniteNumber(box.width) && isFiniteNumber(box.height) && (box.width > 0 || box.height > 0)) {
      return { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
    }
  }
  const bounds = getElementBounds(element);
  if (!bounds) {
    return null;
  }
  return {
    x: bounds.left + ((bounds.right - bounds.left) / 2),
    y: bounds.top + ((bounds.bottom - bounds.top) / 2),
  };
}

function getElementBounds(element: Element): Bounds | null {
  const ownBounds = getShapeBounds(element);
  const childBounds = Array.from(element.children).map(getElementBounds).filter((value): value is Bounds => value !== null);
  return mergeBounds(ownBounds ? [ownBounds, ...childBounds] : childBounds);
}

function getShapeBounds(element: Element): Bounds | null {
  if (matchesSvgTag(element, "rect")) {
    const x = parseCoordinate(element.getAttribute("x")) ?? 0;
    const y = parseCoordinate(element.getAttribute("y")) ?? 0;
    const width = parseCoordinate(element.getAttribute("width"));
    const height = parseCoordinate(element.getAttribute("height"));
    if (isFiniteNumber(width) && isFiniteNumber(height)) {
      return { left: x, top: y, right: x + width, bottom: y + height };
    }
  }
  if (matchesSvgTag(element, "circle")) {
    const cx = parseCoordinate(element.getAttribute("cx"));
    const cy = parseCoordinate(element.getAttribute("cy"));
    const radius = parseCoordinate(element.getAttribute("r"));
    if (isFiniteNumber(cx) && isFiniteNumber(cy) && isFiniteNumber(radius)) {
      return { left: cx - radius, top: cy - radius, right: cx + radius, bottom: cy + radius };
    }
  }
  if (matchesSvgTag(element, "ellipse")) {
    const cx = parseCoordinate(element.getAttribute("cx"));
    const cy = parseCoordinate(element.getAttribute("cy"));
    const rx = parseCoordinate(element.getAttribute("rx"));
    const ry = parseCoordinate(element.getAttribute("ry"));
    if (isFiniteNumber(cx) && isFiniteNumber(cy) && isFiniteNumber(rx) && isFiniteNumber(ry)) {
      return { left: cx - rx, top: cy - ry, right: cx + rx, bottom: cy + ry };
    }
  }
  return null;
}

function getPathCenter(path: SVGPathElement | null): { x: number; y: number } | null {
  if (!path) {
    return null;
  }
  if (typeof path.getTotalLength === "function" && typeof path.getPointAtLength === "function") {
    const midpoint = path.getPointAtLength(path.getTotalLength() / 2);
    if (isFiniteNumber(midpoint.x) && isFiniteNumber(midpoint.y)) {
      return { x: midpoint.x, y: midpoint.y };
    }
  }
  const points = extractPathPoints(path.getAttribute("d") ?? "");
  if (points.length === 0) {
    return null;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return {
    x: (first.x + last.x) / 2,
    y: (first.y + last.y) / 2,
  };
}

function extractPathPoints(value: string): Array<{ x: number; y: number }> {
  const matches = value.match(/-?\d*\.?\d+/g) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < matches.length - 1; index += 2) {
    const x = Number(matches[index]);
    const y = Number(matches[index + 1]);
    if (isFiniteNumber(x) && isFiniteNumber(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

function mergeBounds(boundsList: Bounds[]): Bounds | null {
  if (boundsList.length === 0) {
    return null;
  }
  return boundsList.reduce((merged, bounds) => ({
    left: Math.min(merged.left, bounds.left),
    top: Math.min(merged.top, bounds.top),
    right: Math.max(merged.right, bounds.right),
    bottom: Math.max(merged.bottom, bounds.bottom),
  }));
}

function pickPoint(x: number | undefined, y: number | undefined): { x: number; y: number } | null {
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return null;
  }
  return { x, y };
}

function parseCoordinate(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseViewBox(value: string | null): { x: number; y: number; width: number; height: number } | null {
  if (!value) {
    return null;
  }
  const parts = value.trim().split(/[\s,]+/).map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function readSvgViewportSize(svg: SVGSVGElement): { width: number; height: number } {
  const parsedViewBox = parseViewBox(svg.getAttribute("viewBox"));
  if (parsedViewBox) {
    return { width: parsedViewBox.width, height: parsedViewBox.height };
  }
  const width = parseCoordinate(svg.getAttribute("width")) ?? 0;
  const height = parseCoordinate(svg.getAttribute("height")) ?? 0;
  return { width, height };
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function matchesSvgTag(element: Element, tagName: string): boolean {
  return element.tagName.toLowerCase() === tagName;
}
