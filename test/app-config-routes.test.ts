import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import type { ServerConfig } from "../web/server/config.js";
import { handleAppConfig, handleAppConfigSave } from "../web/server/routes/app-config.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("app config routes", () => {
  it("scaffolds and reads the local app config file", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleAppConfig(cfg)({} as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.path).toBe("agents/agents.json");
    expect(response.body.data.defaultAppId).toBe("wiki-general");
    expect(response.body.data.apps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "wiki-general",
        name: "Wiki 通用助手",
        mode: "chat",
        enabled: true,
      }),
    ]));
  });

  it("saves app definitions with explicit modes", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleAppConfigSave(cfg)({
      body: {
        defaultAppId: "workflow-app",
        apps: [{
          id: "workflow-app",
          name: "内容编排应用",
          mode: "workflow",
          purpose: "接收自动化并串行执行工作流",
          provider: "openai",
          accountRef: "api:relay-work",
          model: "gpt-5-codex",
          workflow: "读取触发数据\n执行工作流\n输出结果",
          prompt: "保持结果结构稳定",
          enabled: true,
        }],
      },
    } as unknown as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.defaultAppId).toBe("workflow-app");
    expect(response.body.data.apps[0]).toMatchObject({
      id: "workflow-app",
      name: "内容编排应用",
      mode: "workflow",
      accountRef: "api:relay-work",
      model: "gpt-5-codex",
    });
    const saved = fs.readFileSync(path.join(cfg.projectRoot, "agents", "agents.json"), "utf8");
    expect(saved).toContain("\"apps\"");
    expect(saved).toContain("\"defaultAppId\"");
    expect(saved).toContain("\"workflow\"");
  });

  it("prefers a valid legacy activeAgentId and otherwise falls back to the first enabled app", async () => {
    const cfg = makeConfig();
    const legacyResponse = createResponse();
    const fallbackResponse = createResponse();

    await handleAppConfigSave(cfg)({
      body: {
        activeAgentId: "legacy-enabled",
        agents: [
          {
            id: "legacy-disabled",
            name: "旧禁用助手",
            enabled: false,
          },
          {
            id: "legacy-enabled",
            name: "旧启用助手",
            enabled: true,
          },
        ],
      },
    } as unknown as Request, legacyResponse as Response);

    await handleAppConfigSave(cfg)({
      body: {
        defaultAppId: "missing-app",
        apps: [
          {
            id: "disabled-app",
            name: "禁用助手",
            enabled: false,
          },
          {
            id: "enabled-app",
            name: "启用助手",
            enabled: true,
          },
        ],
      },
    } as unknown as Request, fallbackResponse as Response);

    expect(legacyResponse.statusCode).toBe(200);
    expect(legacyResponse.body.data.defaultAppId).toBe("legacy-enabled");
    expect(legacyResponse.body.data.apps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "legacy-enabled", enabled: true }),
    ]));
    expect(fallbackResponse.statusCode).toBe(200);
    expect(fallbackResponse.body.data.defaultAppId).toBe("enabled-app");
  });
});

function makeConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-app-config-"));
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
