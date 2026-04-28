export interface PanelWidthBounds {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

const STORAGE_PREFIX = "llmWiki.panel.";

export function clampPanelWidth(width: number, bounds: PanelWidthBounds): number {
  if (!Number.isFinite(width)) {
    return bounds.defaultWidth;
  }
  return Math.min(bounds.maxWidth, Math.max(bounds.minWidth, Math.round(width)));
}

export function readPanelWidth(key: string, bounds: PanelWidthBounds): number {
  try {
    const stored = window.localStorage.getItem(storageKey(key));
    if (!stored) {
      return bounds.defaultWidth;
    }
    return clampPanelWidth(Number(stored), bounds);
  } catch {
    return bounds.defaultWidth;
  }
}

export function writePanelWidth(key: string, width: number, bounds: PanelWidthBounds): number {
  const next = clampPanelWidth(width, bounds);
  try {
    window.localStorage.setItem(storageKey(key), String(next));
  } catch {
    return next;
  }
  return next;
}

export function applyPanelWidth(target: HTMLElement, variableName: string, width: number): void {
  target.style.setProperty(variableName, `${Math.round(width)}px`);
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}
