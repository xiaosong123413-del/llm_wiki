/**
 * Live change stream for the automation workspace.
 *
 * The workspace page only needs a lightweight "something changed" signal.
 * This service watches source-owned flow modules, their audited source files,
 * and relevant config files, then publishes SSE-friendly change snapshots.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listCodeDerivedAutomationWatchPaths } from "./code-derived-automations.js";

interface AutomationWorkspaceChangeEvent {
  version: number;
  changedAt: string;
  files: string[];
}

export interface AutomationWorkspaceEventStream {
  snapshot(): AutomationWorkspaceChangeEvent;
  subscribe(listener: (event: AutomationWorkspaceChangeEvent) => void): () => void;
}

type EventListener = (event: AutomationWorkspaceChangeEvent) => void;

const CODEBASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const STREAMS = new Map<string, AutomationWorkspaceEventBus>();

export function getAutomationWorkspaceEventStream(projectRoot: string): AutomationWorkspaceEventStream {
  const cached = STREAMS.get(projectRoot);
  if (cached) {
    return cached;
  }
  const created = new AutomationWorkspaceEventBus(projectRoot);
  STREAMS.set(projectRoot, created);
  return created;
}

class AutomationWorkspaceEventBus implements AutomationWorkspaceEventStream {
  private readonly listeners = new Set<EventListener>();
  private readonly watchers = new Map<string, fs.FSWatcher>();
  private readonly pendingFiles = new Set<string>();
  private lastEvent: AutomationWorkspaceChangeEvent = {
    version: 1,
    changedAt: new Date().toISOString(),
    files: [],
  };
  private syncPromise: Promise<void> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly projectRoot: string) {
    void this.syncWatchers();
  }

  snapshot(): AutomationWorkspaceChangeEvent {
    return this.lastEvent;
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    void this.syncWatchers();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async syncWatchers(): Promise<void> {
    if (this.syncPromise) {
      await this.syncPromise;
      return;
    }
    this.syncPromise = this.refreshWatchers();
    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  private async refreshWatchers(): Promise<void> {
    const nextPaths = new Set(await listCodeDerivedAutomationWatchPaths(this.projectRoot));
    for (const watchedPath of this.watchers.keys()) {
      if (nextPaths.has(watchedPath)) {
        continue;
      }
      this.watchers.get(watchedPath)?.close();
      this.watchers.delete(watchedPath);
    }
    for (const watchedPath of nextPaths) {
      if (this.watchers.has(watchedPath)) {
        continue;
      }
      this.watchers.set(watchedPath, this.createWatcher(watchedPath));
    }
  }

  private createWatcher(watchedPath: string): fs.FSWatcher {
    const watcher = fs.watch(watchedPath, () => {
      this.pendingFiles.add(toEventPath(this.projectRoot, watchedPath));
      this.scheduleFlush();
    });
    watcher.on("error", () => {
      this.watchers.delete(watchedPath);
    });
    return watcher;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const files = [...this.pendingFiles].sort();
      this.pendingFiles.clear();
      this.lastEvent = {
        version: this.lastEvent.version + 1,
        changedAt: new Date().toISOString(),
        files,
      };
      for (const listener of this.listeners) {
        listener(this.lastEvent);
      }
      void this.syncWatchers();
    }, 40);
  }
}

function toEventPath(projectRoot: string, filePath: string): string {
  if (isInsidePath(filePath, projectRoot)) {
    return path.relative(projectRoot, filePath).replace(/\\/g, "/");
  }
  if (isInsidePath(filePath, CODEBASE_ROOT)) {
    return path.relative(CODEBASE_ROOT, filePath).replace(/\\/g, "/");
  }
  return path.basename(filePath);
}

function isInsidePath(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
