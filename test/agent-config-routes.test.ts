import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import type { ServerConfig } from "../web/server/config.js";
import { handleAgentConfig, handleAgentConfigSave } from "../web/server/routes/agent-config.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("agent config routes", () => {
  it("scaffolds and reads the local agent config file", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleAgentConfig(cfg)({} as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.path).toBe("agents/agents.json");
    expect(response.body.data.agents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "wiki-general",
        name: "Wiki 通用助手",
        enabled: true,
      }),
      expect.objectContaining({
        id: "xhs-decision-note",
        name: "小红书决策笔记助手",
        enabled: true,
      }),
    ]));
    expect(fs.existsSync(path.join(cfg.projectRoot, "agents", "agents.json"))).toBe(true);
  });

  it("saves agent prompt, workflow, provider, and model choices", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleAgentConfigSave(cfg)({
      body: {
        activeAgentId: "image-agent",
        agents: [{
          id: "image-agent",
          name: "绘图 Agent",
          purpose: "生成视觉素材",
          provider: "minimax",
          accountRef: "api:minimax",
          model: "image-large",
          workflow: "理解画面需求\n生成提示词\n返回素材说明",
          prompt: "输出可直接用于画图模型的提示词",
          enabled: true,
        }],
      },
    } as unknown as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.activeAgentId).toBe("image-agent");
    expect(response.body.data.agents[0]).toMatchObject({
      id: "image-agent",
      provider: "minimax",
      accountRef: "api:minimax",
      model: "image-large",
      workflow: expect.stringContaining("生成提示词"),
      prompt: expect.stringContaining("画图模型"),
    });
    const saved = fs.readFileSync(path.join(cfg.projectRoot, "agents", "agents.json"), "utf8");
    expect(saved).toContain("\"image-agent\"");
    expect(saved).toContain("\"minimax\"");
  });
});

function makeConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-agent-config-"));
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
