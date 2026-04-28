import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerConfig } from "../web/server/config.js";
import {
  handleAutomationWorkspaceCommentCreate,
  handleAutomationWorkspaceCommentDelete,
  handleAutomationWorkspaceCommentPatch,
  handleAutomationWorkspaceDetail,
  handleAutomationWorkspaceEvents,
  handleAutomationWorkspaceLayoutGet,
  handleAutomationWorkspaceLayoutSave,
  handleAutomationWorkspaceList,
  handleAutomationWorkspaceLogs,
} from "../web/server/routes/automation-workspace.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("automation workspace routes", () => {
  it("lists automations and resolves node models from app config or the default LLM config", async () => {
    const cfg = makeConfig();
    seedAutomationConfig(cfg.projectRoot);
    seedAppConfig(cfg.projectRoot);
    seedEnv(cfg.projectRoot, [
      "LLMWIKI_PROVIDER=openai",
      "LLMWIKI_MODEL=gpt-5-default",
    ]);
    const list = createResponse();
    const detail = createResponse();

    await handleAutomationWorkspaceList(cfg)({ query: {} } as Request, list as Response);
    await handleAutomationWorkspaceDetail(cfg)({ params: { id: "daily-sync" } } as unknown as Request, detail as Response);

    expect(list.statusCode).toBe(200);
    expect(list.body.data.automations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "daily-sync",
        name: "Daily Sync",
        enabled: true,
        sourceKind: "automation",
      }),
      expect.objectContaining({
        id: "publish-hook",
        name: "Publish Hook",
        enabled: false,
        sourceKind: "automation",
      }),
    ]));

    expect(detail.statusCode).toBe(200);
    expect(detail.body.data.automation.id).toBe("daily-sync");
    expect(detail.body.data.automation.flow.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "action-with-app-model",
        app: expect.objectContaining({
          id: "writer-app",
          workflow: "读取内容\\n整理摘要",
        }),
        effectiveModel: {
          provider: "openai",
          model: "gpt-5-writer",
          source: "app",
          label: "应用模型 · openai / gpt-5-writer",
        },
      }),
      expect.objectContaining({
        id: "action-fallback-model",
        app: expect.objectContaining({
          id: "fallback-app",
          prompt: "当内容缺模型时回退默认模型。",
        }),
        effectiveModel: {
          provider: "openai",
          model: "gpt-5-default",
          source: "default",
          label: "跟随默认模型 · openai / gpt-5-default",
        },
      }),
    ]));
  });

  it("falls back to app workflows when explicit automation config is empty", async () => {
    const cfg = makeConfig();
    seedAppConfig(cfg.projectRoot);
    seedEnv(cfg.projectRoot, [
      "LLMWIKI_PROVIDER=openai",
      "LLMWIKI_MODEL=gpt-5-default",
    ]);
    const list = createResponse();
    const detail = createResponse();

    await handleAutomationWorkspaceList(cfg)({ query: {} } as Request, list as Response);
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: "app-workflow-writer-app" },
    } as unknown as Request, detail as Response);

    expect(list.statusCode).toBe(200);
    expect(list.body.data.automations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "app-workflow-writer-app",
        name: "Writer App",
        summary: "整理摘要",
        enabled: true,
        sourceKind: "app",
      }),
      expect.objectContaining({
        id: "app-workflow-fallback-app",
        name: "Fallback App",
        summary: "补充标签",
        enabled: true,
        sourceKind: "app",
      }),
    ]));

    expect(detail.statusCode).toBe(200);
    expect(detail.body.data.automation.name).toBe("Writer App");
    expect(detail.body.data.automation.flow.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "trigger",
        title: "调用应用时触发",
      }),
      expect.objectContaining({
        title: "读取内容",
        app: expect.objectContaining({
          id: "writer-app",
          name: "Writer App",
        }),
        effectiveModel: {
          provider: "openai",
          model: "gpt-5-writer",
          source: "app",
          label: "应用模型 · openai / gpt-5-writer",
        },
      }),
      expect.objectContaining({
        title: "整理摘要",
        effectiveModel: {
          provider: "openai",
          model: "gpt-5-writer",
          source: "app",
          label: "应用模型 · openai / gpt-5-writer",
        },
      }),
    ]));
  });

  it("derives code-backed automation entries from audited source flows only", async () => {
    const cfg = makeConfig();
    seedAppConfig(cfg.projectRoot);
    seedEnv(cfg.projectRoot, [
      "LLMWIKI_PROVIDER=openai",
      "LLMWIKI_MODEL=gpt-5-default",
    ]);
    const list = createResponse();

    await handleAutomationWorkspaceList(cfg)({ query: {} } as Request, list as Response);

    expect(list.statusCode).toBe(200);
    expect(list.body.data.automations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "code-flow-sync-entry",
        name: "同步入口",
        enabled: true,
        sourceKind: "code",
      }),
      expect.objectContaining({
        id: "code-flow-sync-compile-overview",
        name: "同步编译总览",
        enabled: true,
        sourceKind: "code",
      }),
      expect.objectContaining({
        id: "code-flow-compile-chain",
        name: "编译链路",
        enabled: true,
        sourceKind: "code",
      }),
      expect.objectContaining({
        id: "code-flow-automation-workspace",
        name: "Workflow 工作区",
        enabled: true,
        sourceKind: "code",
      }),
    ]));
    expect(list.body.data.automations.some((automation: { sourceKind: string }) => automation.sourceKind === "document")).toBe(false);

    const syncEntry = list.body.data.automations.find((automation: { name: string }) => automation.name === "同步入口");
    expect(syncEntry).toBeDefined();
    expect(syncEntry.id).toBe("code-flow-sync-entry");

    const detail = createResponse();
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: syncEntry.id },
    } as unknown as Request, detail as Response);

    expect(detail.statusCode).toBe(200);
    expect(detail.body.data.automation.name).toBe("同步入口");
    expect(detail.body.data.automation.sourceKind).toBe("code");
    expect(detail.body.data.automation.viewMode).toBe("flow");
    expect(detail.body.data.automation.flow.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "trigger",
        title: "点击同步按钮",
        implementation: "bindRunPage() startButton.click",
      }),
      expect.objectContaining({
        type: "action",
        title: "confirmSyncPlan()",
        implementation: "confirmSyncPlan()",
      }),
      expect.objectContaining({
        type: "branch",
        title: "scan.items.length 是否为 0",
        implementation: "if (scan.items.length === 0)",
      }),
      expect.objectContaining({
        title: "attachRunStream()",
        implementation: "attachRunStream()",
      }),
    ]));
    expect(detail.body.data.automation.flow.branches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "sync-items",
        nodeIds: ["sync-none", "sync-branch-plan"],
      }),
    ]));
    expect(detail.body.data.automation.mermaid).toContain("A[\"点击同步按钮<br/>bindRunPage() startButton.click\"]");
    expect(detail.body.data.automation.mermaid).toContain("D -->|是| E");
    expect(detail.body.data.automation.mermaid).toContain("I -->|是| K");

    const reviewBoardDetail = createResponse();
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: "code-flow-review-board" },
    } as unknown as Request, reviewBoardDetail as Response);
    expect(reviewBoardDetail.statusCode).toBe(200);
    expect(reviewBoardDetail.body.data.automation.name).toBe("审查与运行结果");
    expect(reviewBoardDetail.body.data.automation.mermaid).toContain("I -->|单条推进| J");
    expect(reviewBoardDetail.body.data.automation.mermaid).toContain("I -->|确认写入| W");
    expect(reviewBoardDetail.body.data.automation.mermaid).toContain("I -->|批量录入 inbox| AK");
    expect(reviewBoardDetail.body.data.automation.mermaid).toContain("AQ --> AU");

    const quickCapture = list.body.data.automations.find((automation: { name: string }) => automation.name === "闪念日记快速记录");
    expect(quickCapture).toBeDefined();
    const quickCaptureDetail = createResponse();
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: quickCapture.id },
    } as unknown as Request, quickCaptureDetail as Response);
    expect(quickCaptureDetail.body.data.automation.sourceKind).toBe("code");
    expect(quickCaptureDetail.body.data.automation.viewMode).toBe("flow");
    expect(quickCaptureDetail.body.data.automation.mermaid).toContain("A[\"全局快捷键触发<br/>globalShortcut.register()\"]");
    expect(quickCaptureDetail.body.data.automation.mermaid).toContain("G -->|否| H");
    expect(quickCaptureDetail.body.data.automation.mermaid).toContain("L -->|是| N");
    expect(quickCaptureDetail.body.data.automation.flow.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "全局快捷键触发",
        implementation: "globalShortcut.register()",
      }),
      expect.objectContaining({
        title: "当天日记文件是否已存在",
        implementation: "fs.existsSync(diaryPath)",
      }),
      expect.objectContaining({
        title: "prependDiaryBlock()",
        implementation: "prependDiaryBlock()",
      }),
    ]));

    const compileDetail = createResponse();
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: "code-flow-compile-chain" },
    } as unknown as Request, compileDetail as Response);
    expect(compileDetail.statusCode).toBe(200);
    expect(compileDetail.body.data.automation.name).toBe("编译链路");
    expect(compileDetail.body.data.automation.mermaid).toContain("I -->|是| J");
    expect(compileDetail.body.data.automation.mermaid).toContain("P -->|否| R");
    expect(compileDetail.body.data.automation.mermaid).toContain("W --> X");
    expect(compileDetail.body.data.automation.flow.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "读取配置和运行根目录",
        implementation: "loadSyncCompileConfig() + resolveCompileRootsFromConfig()",
      }),
      expect.objectContaining({
        type: "branch",
        title: "toCompile / deleted 是否为空",
        implementation: "if (toCompile.length === 0 && deleted.length === 0)",
      }),
      expect.objectContaining({
        title: "更新 tiered memory",
        implementation: "updateTieredMemory()",
      }),
    ]));

    const compileOverviewDetail = createResponse();
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: "code-flow-sync-compile-overview" },
    } as unknown as Request, compileOverviewDetail as Response);
    expect(compileOverviewDetail.statusCode).toBe(200);
    expect(compileOverviewDetail.body.data.automation.name).toBe("同步编译总览");
    expect(compileOverviewDetail.body.data.automation.mermaid).toContain("A[\"用户点击同步<br/>bindRunPage() startButton.click\"]");
    expect(compileOverviewDetail.body.data.automation.mermaid).toContain("E -->|没有| F");
    expect(compileOverviewDetail.body.data.automation.mermaid).toContain("E -->|有| G");
    expect(compileOverviewDetail.body.data.automation.mermaid).toContain("L --> M");
    expect(compileOverviewDetail.body.data.automation.flow.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "点击同步按钮",
        implementation: "bindRunPage() startButton.click",
      }),
      expect.objectContaining({
        type: "branch",
        title: "batches.length 是否为 0",
        implementation: "if (batches.length === 0)",
      }),
      expect.objectContaining({
        title: "按批次执行 llmwiki compile",
        implementation: "prepareActiveSources() + runCompile()",
      }),
      expect.objectContaining({
        title: "发布 staging 结果",
        implementation: "publishStagingRun() + writeBatchState() + writeFinalCompileResult()",
      }),
    ]));

    const automationWorkspaceDetail = createResponse();
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: "code-flow-automation-workspace" },
    } as unknown as Request, automationWorkspaceDetail as Response);
    expect(automationWorkspaceDetail.statusCode).toBe(200);
    expect(automationWorkspaceDetail.body.data.automation.mermaid).toContain("A[\"打开 #/automation<br/>renderAutomationWorkspacePage()\"]");
    expect(automationWorkspaceDetail.body.data.automation.mermaid).toContain("E -->|打开详情| G");
    expect(automationWorkspaceDetail.body.data.automation.mermaid).toContain("K -->|查看日志| L");

    const sourceGalleryDetail = createResponse();
    await handleAutomationWorkspaceDetail(cfg)({
      params: { id: "code-flow-source-gallery" },
    } as unknown as Request, sourceGalleryDetail as Response);
    expect(sourceGalleryDetail.statusCode).toBe(200);
    expect(sourceGalleryDetail.body.data.automation.mermaid).toContain("A[\"打开 #/sources<br/>renderSourcesPage()\"]");
    expect(sourceGalleryDetail.body.data.automation.mermaid).toContain("E -->|送入 inbox| F");
    expect(sourceGalleryDetail.body.data.automation.mermaid).toContain("K --> L");
  });

  it("creates and deletes comments anchored to nodes or edges", async () => {
    const cfg = makeConfig();
    seedAutomationConfig(cfg.projectRoot);
    seedAppConfig(cfg.projectRoot);
    const created = createResponse();
    const removed = createResponse();
    const detail = createResponse();

    await handleAutomationWorkspaceCommentCreate(cfg)({
      params: { id: "daily-sync" },
      body: {
        targetType: "node",
        targetId: "action-with-app-model",
        text: "这里要明确展示应用。",
        pinnedX: 120,
        pinnedY: 84,
      },
    } as unknown as Request, created as Response);

    expect(created.statusCode).toBe(200);
    expect(created.body.data).toEqual(expect.objectContaining({
      automationId: "daily-sync",
      targetType: "node",
      targetId: "action-with-app-model",
      text: "这里要明确展示应用。",
      pinnedX: 120,
      pinnedY: 84,
      updatedAt: expect.any(String),
    }));
    expect(created.body.data.createdAt).toBe(created.body.data.updatedAt);

    await handleAutomationWorkspaceDetail(cfg)({ params: { id: "daily-sync" } } as unknown as Request, detail as Response);
    expect(detail.body.data.comments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetType: "node",
        targetId: "action-with-app-model",
      }),
    ]));

    await handleAutomationWorkspaceCommentDelete(cfg)({
      params: { id: "daily-sync", commentId: created.body.data.id },
    } as unknown as Request, removed as Response);

    expect(removed.statusCode).toBe(200);
    expect(removed.body).toEqual({ success: true });
  });

  it("rejects comment creation when required target metadata is missing", async () => {
    const cfg = makeConfig();
    seedAutomationConfig(cfg.projectRoot);
    seedAppConfig(cfg.projectRoot);
    const missingType = createResponse();
    const missingPins = createResponse();

    await handleAutomationWorkspaceCommentCreate(cfg)({
      params: { id: "daily-sync" },
      body: {
        targetId: "action-with-app-model",
        text: "缺少类型",
        pinnedX: 12,
        pinnedY: 18,
      },
    } as unknown as Request, missingType as Response);

    expect(missingType.statusCode).toBe(400);
    expect(missingType.body).toEqual({
      success: false,
      error: "Comment targetType is required.",
    });

    await handleAutomationWorkspaceCommentCreate(cfg)({
      params: { id: "daily-sync" },
      body: {
        targetType: "node",
        targetId: "action-with-app-model",
        text: "缺少坐标",
      },
    } as unknown as Request, missingPins as Response);

    expect(missingPins.statusCode).toBe(400);
    expect(missingPins.body).toEqual({
      success: false,
      error: "Comment pinnedX and pinnedY are required.",
    });
  });

  it("updates automation comments with pinned and manual coordinates", async () => {
    const cfg = makeConfig();
    seedAutomationConfig(cfg.projectRoot);
    seedAppConfig(cfg.projectRoot);
    const created = createResponse();
    const patched = createResponse();
    const detail = createResponse();

    await handleAutomationWorkspaceCommentCreate(cfg)({
      params: { id: "daily-sync" },
      body: {
        targetType: "node",
        targetId: "action-with-app-model",
        text: "初始评论",
        pinnedX: 320,
        pinnedY: 180,
      },
    } as unknown as Request, created as Response);
    const createdUpdatedAt = created.body.data.updatedAt;
    await waitForClockTick();

    await handleAutomationWorkspaceCommentPatch(cfg)({
      params: { id: "daily-sync", commentId: created.body.data.id },
      body: {
        text: "已拖动后的评论",
        manualX: 360,
        manualY: 212,
        pinnedX: 360,
        pinnedY: 212,
        targetType: "canvas",
        targetId: "canvas",
      },
    } as unknown as Request, patched as Response);

    expect(patched.statusCode).toBe(200);
    expect(patched.body.data).toEqual(expect.objectContaining({
      text: "已拖动后的评论",
      manualX: 360,
      manualY: 212,
      pinnedX: 360,
      pinnedY: 212,
      targetType: "canvas",
      targetId: "canvas",
      updatedAt: expect.any(String),
    }));
    expect(patched.body.data.updatedAt).not.toBe(createdUpdatedAt);

    const cleared = createResponse();
    await handleAutomationWorkspaceCommentPatch(cfg)({
      params: { id: "daily-sync", commentId: created.body.data.id },
      body: {
        manualX: null,
        manualY: null,
      },
    } as unknown as Request, cleared as Response);

    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.data.manualX).toBeUndefined();
    expect(cleared.body.data.manualY).toBeUndefined();

    await handleAutomationWorkspaceDetail(cfg)({ params: { id: "daily-sync" } } as unknown as Request, detail as Response);
    expect(detail.body.data.comments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: created.body.data.id,
        text: "已拖动后的评论",
        pinnedX: 360,
        pinnedY: 212,
        targetType: "canvas",
        targetId: "canvas",
      }),
    ]));
  });

  it("reads and saves branch layout offsets and exposes automation logs", async () => {
    const cfg = makeConfig();
    seedAutomationConfig(cfg.projectRoot);
    seedAppConfig(cfg.projectRoot);
    seedLogs(cfg.runtimeRoot);
    const initialLayout = createResponse();
    const savedLayout = createResponse();
    const logs = createResponse();

    await handleAutomationWorkspaceLayoutGet(cfg)({
      params: { id: "daily-sync" },
    } as unknown as Request, initialLayout as Response);
    await handleAutomationWorkspaceLayoutSave(cfg)({
      params: { id: "daily-sync" },
      body: {
        branchOffsets: {
          "content-branches": { x: 36, y: 18 },
        },
      },
    } as unknown as Request, savedLayout as Response);
    await handleAutomationWorkspaceLogs(cfg)({
      params: { id: "daily-sync" },
    } as unknown as Request, logs as Response);

    expect(initialLayout.body.data).toEqual({ automationId: "daily-sync", branchOffsets: {} });
    expect(savedLayout.body.data).toEqual({
      automationId: "daily-sync",
      branchOffsets: {
        "content-branches": { x: 36, y: 18 },
      },
    });
    expect(logs.body.data.logs).toEqual([
      expect.objectContaining({
        id: "log-1",
        status: "success",
        summary: "同步完成",
      }),
    ]);
  });

  it("streams automation workspace change events over SSE", async () => {
    const response = createStreamResponse();
    const request = createEventRequest();
    const events = createAutomationWorkspaceEventStub();

    handleAutomationWorkspaceEvents(events)(request as Request, response as unknown as Response);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    expect(response.output).toContain("event: change");
    expect(response.output).toContain("\"version\":1");

    events.publish({
      version: 2,
      changedAt: "2026-04-25T10:00:00.000Z",
      files: ["web/client/src/pages/runs/automation-flow.ts"],
    });

    expect(response.output).toContain("\"version\":2");
    expect(response.output).toContain("web/client/src/pages/runs/automation-flow.ts");

    request.close();
    expect(events.listenerCount()).toBe(0);
  });
});

function makeConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-automation-workspace-project-"));
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-automation-workspace-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-automation-workspace-runtime-"));
  roots.push(projectRoot, sourceVaultRoot, runtimeRoot);
  fs.mkdirSync(path.join(projectRoot, "automations"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "agents"), { recursive: true });
  return {
    sourceVaultRoot,
    runtimeRoot,
    projectRoot,
    host: "127.0.0.1",
    port: 4175,
    author: "tester",
  };
}

async function waitForClockTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 2));
}

function seedAutomationConfig(projectRoot: string): void {
  fs.writeFileSync(path.join(projectRoot, "automations", "automations.json"), JSON.stringify({
    automations: [
      {
        id: "daily-sync",
        name: "Daily Sync",
        summary: "同步昨日新增内容。",
        icon: "calendar",
        trigger: "schedule",
        appId: "writer-app",
        enabled: true,
        schedule: "0 9 * * *",
        webhookPath: "",
        updatedAt: "2026-04-25T00:00:00.000Z",
        flow: {
          nodes: [
            {
              id: "trigger-daily-sync",
              type: "trigger",
              title: "每日 09:00 触发",
              description: "按计划触发。",
              modelMode: "default",
            },
            {
              id: "branch-content",
              type: "branch",
              title: "并行处理",
              description: "并行拆分内容处理。",
              modelMode: "default",
            },
            {
              id: "action-with-app-model",
              type: "action",
              title: "摘要整理",
              description: "调用写作应用整理摘要。",
              appId: "writer-app",
              modelMode: "default",
            },
            {
              id: "action-fallback-model",
              type: "action",
              title: "补充标签",
              description: "调用标签应用补充标签。",
              appId: "fallback-app",
              modelMode: "default",
            },
            {
              id: "merge-content",
              type: "merge",
              title: "汇总结果",
              description: "汇总并写回结果。",
              modelMode: "default",
            },
          ],
          edges: [
            { id: "edge-trigger-branch", source: "trigger-daily-sync", target: "branch-content" },
            { id: "edge-branch-left", source: "branch-content", target: "action-with-app-model" },
            { id: "edge-branch-right", source: "branch-content", target: "action-fallback-model" },
            { id: "edge-left-merge", source: "action-with-app-model", target: "merge-content" },
            { id: "edge-right-merge", source: "action-fallback-model", target: "merge-content" },
          ],
          branches: [
            {
              id: "content-branches",
              title: "内容处理",
              sourceNodeId: "branch-content",
              mergeNodeId: "merge-content",
              nodeIds: ["action-with-app-model", "action-fallback-model"],
            },
          ],
        },
      },
      {
        id: "publish-hook",
        name: "Publish Hook",
        summary: "发布后同步回调。",
        icon: "rocket",
        trigger: "webhook",
        appId: "fallback-app",
        enabled: false,
        schedule: "",
        webhookPath: "/hooks/publish",
        updatedAt: "2026-04-25T00:00:00.000Z",
        flow: {
          nodes: [
            {
              id: "trigger-publish-hook",
              type: "trigger",
              title: "收到发布回调",
              description: "接收外部回调。",
              modelMode: "default",
            },
          ],
          edges: [],
          branches: [],
        },
      },
    ],
  }, null, 2), "utf8");
}

function seedAppConfig(projectRoot: string): void {
  fs.writeFileSync(path.join(projectRoot, "agents", "agents.json"), JSON.stringify({
    defaultAppId: "writer-app",
    apps: [
      {
        id: "writer-app",
        name: "Writer App",
        mode: "chat",
        purpose: "整理摘要",
        provider: "openai",
        accountRef: "",
        model: "gpt-5-writer",
        workflow: "读取内容\\n整理摘要",
        prompt: "整理摘要并回写。",
        enabled: true,
        updatedAt: "2026-04-25T00:00:00.000Z",
      },
      {
        id: "fallback-app",
        name: "Fallback App",
        mode: "chat",
        purpose: "补充标签",
        provider: "openai",
        accountRef: "",
        model: "",
        workflow: "读取上下文\\n补充标签",
        prompt: "当内容缺模型时回退默认模型。",
        enabled: true,
        updatedAt: "2026-04-25T00:00:00.000Z",
      },
    ],
  }, null, 2), "utf8");
}

function seedLogs(runtimeRoot: string): void {
  const folder = path.join(runtimeRoot, ".llmwiki");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "automation-logs.json"), JSON.stringify({
    logsByAutomationId: {
      "daily-sync": [
        {
          id: "log-1",
          automationId: "daily-sync",
          status: "success",
          summary: "同步完成",
          startedAt: "2026-04-25T09:00:00.000Z",
          endedAt: "2026-04-25T09:01:00.000Z",
        },
      ],
    },
  }, null, 2), "utf8");
}

function seedEnv(projectRoot: string, lines: string[]): void {
  fs.writeFileSync(path.join(projectRoot, ".env"), `${lines.join("\n")}\n`, "utf8");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    process.env[key!] = rest.join("=");
  }
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function createStreamResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    output: "",
    writeHead(code: number, headers: Record<string, string>) {
      this.statusCode = code;
      this.headers = headers;
      return this;
    },
    write(chunk: string) {
      this.output += chunk;
      return true;
    },
  };
}

function createEventRequest() {
  const listeners = new Map<string, Array<() => void>>();
  return {
    on(event: string, handler: () => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      return this;
    },
    close() {
      for (const handler of listeners.get("close") ?? []) {
        handler();
      }
    },
  };
}

function createAutomationWorkspaceEventStub(): {
  snapshot: () => { version: number; changedAt: string; files: string[] };
  subscribe: (listener: (event: { version: number; changedAt: string; files: string[] }) => void) => () => void;
  publish: (event: { version: number; changedAt: string; files: string[] }) => void;
  listenerCount: () => number;
} {
  const listeners = new Set<(event: { version: number; changedAt: string; files: string[] }) => void>();
  return {
    snapshot: () => ({
      version: 1,
      changedAt: "2026-04-25T09:00:00.000Z",
      files: [],
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(event) {
      for (const listener of listeners) {
        listener(event);
      }
    },
    listenerCount() {
      return listeners.size;
    },
  };
}
