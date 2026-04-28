import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import type { ServerConfig } from "../web/server/config.js";
import { handleAutomationConfig, handleAutomationConfigSave } from "../web/server/routes/automation-config.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("automation config routes", () => {
  it("scaffolds an empty automation config", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleAutomationConfig(cfg)({} as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.path).toBe("automations/automations.json");
    expect(response.body.data.automations).toEqual([]);
  });

  it("saves schedule, webhook, and message automations bound to apps", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleAutomationConfigSave(cfg)({
      body: {
        automations: [
          {
            id: "daily-sync",
            name: "每日同步",
            summary: "每天早上同步昨日新增内容。",
            icon: "calendar",
            trigger: "schedule",
            appId: "wiki-general",
            schedule: "0 9 * * *",
            enabled: true,
            flow: {
              nodes: [
                {
                  id: "trigger-daily-sync",
                  type: "trigger",
                  title: "每日 09:00 触发",
                  description: "按计划任务触发自动化。",
                  modelMode: "default",
                },
                {
                  id: "action-sync-content",
                  type: "action",
                  title: "同步昨日内容",
                  description: "读取新增内容并整理。",
                  appId: "wiki-general",
                  modelMode: "default",
                },
              ],
              edges: [
                { id: "edge-trigger-to-sync", source: "trigger-daily-sync", target: "action-sync-content" },
              ],
              branches: [],
            },
          },
          {
            id: "publish-hook",
            name: "发布回调",
            summary: "收到发布通知后同步执行。",
            icon: "rocket",
            trigger: "webhook",
            appId: "workflow-app",
            webhookPath: "/hooks/publish",
            enabled: true,
            flow: {
              nodes: [
                {
                  id: "trigger-publish-hook",
                  type: "trigger",
                  title: "收到发布 Webhook",
                  description: "收到外部系统发布回调。",
                  modelMode: "default",
                },
                {
                  id: "action-workflow-app",
                  type: "action",
                  title: "执行工作流应用",
                  description: "调用工作流应用写回页面。",
                  appId: "workflow-app",
                  modelMode: "default",
                },
              ],
              edges: [
                { id: "edge-trigger-to-workflow", source: "trigger-publish-hook", target: "action-workflow-app" },
              ],
              branches: [],
            },
          },
          {
            id: "mention-bot",
            name: "消息触发",
            summary: "收到 @ 机器人消息时触发问答。",
            icon: "message-circle",
            trigger: "message",
            appId: "chat-app",
            enabled: false,
            flow: {
              nodes: [
                {
                  id: "trigger-message-bot",
                  type: "trigger",
                  title: "收到消息",
                  description: "收到群消息中的机器人 mention。",
                  modelMode: "default",
                },
                {
                  id: "action-chat-app",
                  type: "action",
                  title: "执行问答应用",
                  description: "调用问答应用回复。",
                  appId: "chat-app",
                  modelMode: "default",
                },
              ],
              edges: [
                { id: "edge-trigger-to-chat", source: "trigger-message-bot", target: "action-chat-app" },
              ],
              branches: [],
            },
          },
        ],
      },
    } as unknown as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.automations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "daily-sync",
        trigger: "schedule",
        appId: "wiki-general",
        schedule: "0 9 * * *",
        flow: expect.objectContaining({
          nodes: expect.arrayContaining([expect.objectContaining({ id: "trigger-daily-sync", type: "trigger" })]),
        }),
      }),
      expect.objectContaining({
        id: "publish-hook",
        trigger: "webhook",
        appId: "workflow-app",
        webhookPath: "/hooks/publish",
      }),
      expect.objectContaining({ id: "mention-bot", trigger: "message", appId: "chat-app", enabled: false }),
    ]));
  });

  it("rejects automations missing summary, icon, or flow", async () => {
    const cfg = makeConfig();
    await expectInvalidAutomationSave(cfg, {
      id: "broken",
      name: "Broken",
      trigger: "schedule",
      appId: "wiki-general",
      enabled: true,
    }, "summary");
  });

  it("rejects invalid branch graphs with missing merge targets", async () => {
    const cfg = makeConfig();
    await expectInvalidAutomationSave(cfg, {
      id: "broken-branch",
      name: "Broken Branch",
      summary: "无效分支",
      icon: "git-branch",
      trigger: "message",
      appId: "wiki-general",
      enabled: true,
      schedule: "",
      webhookPath: "",
      flow: {
        nodes: [
          {
            id: "trigger",
            type: "trigger",
            title: "收到消息",
            description: "收到消息后触发。",
            modelMode: "default",
          },
          {
            id: "branch",
            type: "branch",
            title: "并行分支",
            description: "分流。",
            modelMode: "default",
          },
          {
            id: "left",
            type: "action",
            title: "左侧分支",
            description: "左侧处理。",
            appId: "wiki-general",
            modelMode: "default",
          },
        ],
        edges: [
          { id: "edge-a", source: "trigger", target: "branch" },
          { id: "edge-b", source: "branch", target: "left" },
        ],
        branches: [
          {
            id: "branch-left",
            title: "左侧",
            sourceNodeId: "branch",
            mergeNodeId: "missing-merge",
            nodeIds: ["left"],
          },
        ],
      },
    }, "merge");
  });

  it("accepts branch groups without merge nodes when branch paths do not rejoin", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleAutomationConfigSave(cfg)({
      body: {
        automations: [
          {
            id: "sync-entry",
            name: "同步入口",
            summary: "真实同步入口分叉。",
            icon: "rocket",
            trigger: "message",
            appId: "system-sync",
            enabled: true,
            schedule: "",
            webhookPath: "",
            flow: {
              nodes: [
                { id: "trigger", type: "trigger", title: "点击同步按钮", description: "入口。", modelMode: "default" },
                { id: "branch", type: "branch", title: "是否检测到待处理项", description: "按 scan.items 判断。", modelMode: "default" },
                { id: "end", type: "action", title: "提示未检测到新源料并结束", description: "终止本次同步。", modelMode: "default" },
                { id: "next", type: "action", title: "继续检查批量计划", description: "进入下一层判断。", modelMode: "default" },
              ],
              edges: [
                { id: "edge-a", source: "trigger", target: "branch" },
                { id: "edge-b", source: "branch", target: "end" },
                { id: "edge-c", source: "branch", target: "next" },
              ],
              branches: [
                {
                  id: "sync-branches",
                  title: "同步入口分支",
                  sourceNodeId: "branch",
                  nodeIds: ["end", "next"],
                },
              ],
            },
          },
        ],
      },
    } as unknown as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.automations[0].flow.branches).toEqual([
      expect.objectContaining({
        id: "sync-branches",
        nodeIds: ["end", "next"],
      }),
    ]);
  });
});

function makeConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-automation-config-"));
  roots.push(projectRoot);
  return {
    wikiRoot: projectRoot,
    projectRoot,
    host: "127.0.0.1",
    port: 4175,
    author: "test",
  };
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

async function expectInvalidAutomationSave(
  cfg: ServerConfig,
  automation: Record<string, unknown>,
  errorPart: string,
): Promise<void> {
  const response = createResponse();
  await handleAutomationConfigSave(cfg)({
    body: { automations: [automation] },
  } as unknown as Request, response as Response);
  expect(response.statusCode).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toContain(errorPart);
}
