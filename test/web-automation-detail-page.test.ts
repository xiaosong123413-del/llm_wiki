// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mermaidRuntimeMocks = vi.hoisted(() => ({
  renderMermaidSvg: vi.fn(async () => `
    <svg data-mermaid="true" viewBox="0 0 200 120">
      <g class="node" id="trigger">
        <rect x="10" y="20" width="60" height="24"></rect>
      </g>
      <g class="node" id="action">
        <rect x="110" y="58" width="72" height="24"></rect>
      </g>
      <g class="edgePath" id="edge-trigger-action">
        <path d="M70,32 L110,70"></path>
      </g>
    </svg>
  `),
}));

vi.mock("../web/client/src/pages/automation/mermaid-runtime.js", () => ({
  renderMermaidSvg: mermaidRuntimeMocks.renderMermaidSvg,
}));

import { renderAutomationWorkspacePage } from "../web/client/src/pages/automation/index.js";

const automationWorkspaceEvents = createEventSourceHarness();

afterEach(() => {
  automationWorkspaceEvents.reset();
  mermaidRuntimeMocks.renderMermaidSvg.mockClear();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  window.location.hash = "";
});

describe("automation workspace detail mermaid view", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", automationWorkspaceEvents.EventSource);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/automation-workspace/daily-sync") {
        return jsonResponse(buildDailySyncPayload(
          mermaidRuntimeMocks.renderMermaidSvg.mock.calls.length === 0 ? "同步内容" : "同步内容 v2",
        ));
      }
      if (url === "/api/automation-workspace/code-flow-sync-entry") {
        return jsonResponse(buildCodeFlowPayload());
      }
      throw new Error(`unexpected fetch ${url}`);
    }));
  });

  it("renders configured automation details as a Mermaid diagram", async () => {
    const page = renderAutomationWorkspacePage("daily-sync");
    document.body.appendChild(page);
    await flush();
    await flush();

    expect(page.getAttribute("data-automation-scroll")).toBe("");
    expect(page.querySelector("[data-automation-mermaid-diagram]")).not.toBeNull();
    expect(page.querySelector("[data-automation-mermaid-surface]")).not.toBeNull();
    expect(page.querySelector("[data-automation-comment-pins]")).not.toBeNull();
    expect(page.querySelector("[data-automation-canvas-target]")).not.toBeNull();
    expect(page.querySelector("[data-automation-edge-svg]")).toBeNull();
    expect(page.querySelector("[data-automation-canvas-scroll]")).toBeNull();
    expect(mermaidRuntimeMocks.renderMermaidSvg).toHaveBeenCalledTimes(1);
    const source = String(mermaidRuntimeMocks.renderMermaidSvg.mock.calls[0]?.[1] ?? "");
    expect(source).toContain("flowchart TD");
    expect(source).not.toContain("subgraph");
    expect(source).not.toContain("用户触发");
    expect(source).toContain("trigger[\"每日 09:00 触发<br/>按计划触发。\"]");
    expect(source).toContain("action[\"同步内容<br/>执行应用同步。\"]");
    expect(source).toContain("trigger --> action");
  });

  it("renders code-derived automation details as a Mermaid diagram", async () => {
    const page = renderAutomationWorkspacePage("code-flow-sync-entry");
    document.body.appendChild(page);
    await flush();
    await flush();

    expect(page.textContent).toContain("源码真实流程");
    expect(page.querySelector("[data-automation-mermaid-diagram]")).not.toBeNull();
    const source = String(mermaidRuntimeMocks.renderMermaidSvg.mock.calls.at(-1)?.[1] ?? "");
    expect(source).toContain("branch-sync{\"是否检测到待处理项");
    expect(source).toContain("sync-run[\"POST /api/runs/sync 并订阅事件");
    expect(source).toContain("attachRunStream(await startRun('sync'))");
    expect(source).toContain("trigger-sync[\"点击同步按钮<br/>bindRunPage() startButton.click\"]");
    expect(source).not.toContain("源码入口：web/client/src/pages/runs/index.ts -> bindRunPage()");
  });

  it("refreshes the Mermaid diagram when automation workspace change events arrive", async () => {
    const page = renderAutomationWorkspacePage("daily-sync");
    document.body.appendChild(page);
    await flush();
    await flush();
    expect(String(mermaidRuntimeMocks.renderMermaidSvg.mock.calls[0]?.[1] ?? "")).toContain("同步内容");
    expect(String(mermaidRuntimeMocks.renderMermaidSvg.mock.calls[0]?.[1] ?? "")).not.toContain("同步内容 v2");
    automationWorkspaceEvents.emit("/api/automation-workspace/events", "change", {
      version: 2,
      changedAt: "2026-04-25T10:00:00.000Z",
      files: ["web/client/src/pages/automation/automation-flow.ts"],
    });
    await flush();
    await flush();

    expect(String(mermaidRuntimeMocks.renderMermaidSvg.mock.calls.at(-1)?.[1] ?? "")).toContain("同步内容 v2");
  });
});

function buildDailySyncPayload(actionTitle: string) {
  return {
    success: true,
    data: {
      automation: {
        id: "daily-sync",
        name: "每日同步",
        summary: "同步昨日新增内容。",
        icon: "calendar",
        enabled: true,
        trigger: "schedule",
        sourceKind: "automation",
        viewMode: "flow",
        flow: {
          nodes: [
            { id: "trigger", type: "trigger", title: "每日 09:00 触发", description: "按计划触发。", effectiveModel: { provider: "", model: "", source: "none", label: "" } },
            { id: "action", type: "action", title: actionTitle, description: "执行应用同步。", app: { id: "writer-app", name: "Writer App", workflow: "读取内容\\n整理摘要", prompt: "整理摘要并回写" }, effectiveModel: { provider: "openai", model: "gpt-5-writer", source: "app", label: "应用模型 · openai / gpt-5-writer" } },
          ],
          edges: [{ id: "edge-trigger-action", source: "trigger", target: "action" }],
          branches: [],
        },
      },
      comments: [],
      layout: { automationId: "daily-sync", branchOffsets: {} },
    },
  };
}

function buildCodeFlowPayload() {
  return {
    success: true,
    data: {
      automation: {
        id: "code-flow-sync-entry",
        name: "同步入口",
        summary: "真实同步入口分支。",
        icon: "rocket",
        enabled: true,
        trigger: "message",
        sourceKind: "code",
        viewMode: "flow",
        flow: {
          nodes: [
            { id: "trigger-sync", type: "trigger", title: "点击同步按钮", description: "源码入口：web/client/src/pages/runs/index.ts -> bindRunPage()", implementation: "bindRunPage() startButton.click", effectiveModel: { provider: "", model: "", source: "none", label: "" } },
            { id: "scan-sync", type: "action", title: "调用 /api/intake/scan", description: "confirmSyncPlan() -> loadIntakeScan()", implementation: "loadIntakeScan()", effectiveModel: { provider: "", model: "", source: "none", label: "" } },
            { id: "branch-sync", type: "branch", title: "是否检测到待处理项", description: "if (scan.items.length === 0) return 'none'", implementation: "if (scan.items.length === 0)", effectiveModel: { provider: "", model: "", source: "none", label: "" } },
            { id: "sync-none", type: "action", title: "提示未检测到新源料并结束", description: "syncDecision === 'none'", effectiveModel: { provider: "", model: "", source: "none", label: "" } },
            { id: "sync-run", type: "action", title: "POST /api/runs/sync 并订阅事件", description: "attachRunStream(await startRun('sync'))", implementation: "attachRunStream(await startRun('sync'))", effectiveModel: { provider: "", model: "", source: "none", label: "" } },
          ],
          edges: [
            { id: "edge-1", source: "trigger-sync", target: "scan-sync" },
            { id: "edge-2", source: "scan-sync", target: "branch-sync" },
            { id: "edge-3", source: "branch-sync", target: "sync-none" },
            { id: "edge-4", source: "branch-sync", target: "sync-run" },
          ],
          branches: [{ id: "sync-entry-items", title: "scan.items 分支", sourceNodeId: "branch-sync", nodeIds: ["sync-none", "sync-run"] }],
        },
        documentSteps: [],
      },
      comments: [],
      layout: { automationId: "code-flow-sync-entry", branchOffsets: {} },
    },
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function createEventSourceHarness(): {
  EventSource: typeof EventSource;
  emit: (url: string, event: string, payload: unknown) => void;
  reset: () => void;
} {
  const instances = new Map<string, Set<{ listeners: Map<string, Array<(event: MessageEvent) => void>>; close: () => void }>>();

  class FakeEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    readonly url: string;
    readonly withCredentials = false;
    readyState = FakeEventSource.OPEN;
    private readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();

    constructor(url: string | URL) {
      this.url = String(url);
      const group = instances.get(this.url) ?? new Set();
      group.add(this);
      instances.set(this.url, group);
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      const callback = typeof listener === "function"
        ? listener as (event: MessageEvent) => void
        : ((event: MessageEvent) => listener.handleEvent(event));
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      const callback = typeof listener === "function"
        ? listener as (event: MessageEvent) => void
        : ((event: MessageEvent) => listener.handleEvent(event));
      this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== callback));
    }

    close(): void {
      this.readyState = FakeEventSource.CLOSED;
      instances.get(this.url)?.delete(this);
    }

    dispatch(type: string, payload: unknown): void {
      const event = new MessageEvent(type, { data: JSON.stringify(payload) });
      for (const listener of this.listeners.get(type) ?? []) {
        listener(event);
      }
    }
  }

  return {
    EventSource: FakeEventSource as unknown as typeof EventSource,
    emit(url, event, payload) {
      for (const instance of instances.get(url) ?? []) {
        instance.dispatch(event, payload);
      }
    },
    reset() {
      instances.clear();
    },
  };
}
