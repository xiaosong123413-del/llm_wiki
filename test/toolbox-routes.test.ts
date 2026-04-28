/**
 * Toolbox route regression tests.
 *
 * These tests lock the richer toolbox page model returned by `/api/toolbox`
 * and the primary JSON persistence used by the redesigned workspace toolbox
 * page. Legacy Markdown toolbox entries must still surface as imported assets.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import type { ServerConfig } from "../web/server/config.js";
import {
  handleToolboxCreate,
  handleToolboxDelete,
  handleToolboxList,
  handleToolboxSave,
} from "../web/server/routes/toolbox.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("toolbox routes", () => {
  it("returns the toolbox page model and imports legacy markdown items as assets", async () => {
    const cfg = makeConfig();
    const response = createResponse();

    await handleToolboxList(cfg)({ query: {} } as unknown as Request, response as Response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        page: expect.objectContaining({
          title: "工具箱",
          defaultMode: "工作流",
          modes: ["工作流", "工具资产"],
        }),
        workflows: expect.arrayContaining([
          expect.objectContaining({
            title: "资料收集流",
            agentName: "收集 Agent",
          }),
        ]),
        recentRuns: expect.arrayContaining([
          expect.objectContaining({
            agentName: expect.any(String),
          }),
        ]),
        favorites: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
          }),
        ]),
        assets: expect.arrayContaining([
          expect.objectContaining({
            title: "Figma",
            category: "软件",
            source: expect.objectContaining({
              type: "legacy-markdown",
              path: "工具箱/网站软件/Figma.md",
            }),
          }),
        ]),
      }),
    );

    expect(fs.existsSync(path.join(cfg.projectRoot, "工具箱", "toolbox.json"))).toBe(true);
  });

  it("creates, saves, and deletes managed toolbox assets in toolbox.json", async () => {
    const cfg = makeConfig();
    const createPayload = createResponse();

    await handleToolboxCreate(cfg)({
      body: {
        entityType: "asset",
        title: "周报模板",
        category: "模板",
      },
    } as unknown as Request, createPayload as Response);

    expect(createPayload.statusCode).toBe(200);
    expect(createPayload.body.data.record).toEqual(
      expect.objectContaining({
        entityType: "asset",
        title: "周报模板",
        category: "模板",
      }),
    );

    const assetId = createPayload.body.data.record.id as string;
    const savePayload = createResponse();
    await handleToolboxSave(cfg)({
      body: {
        entityType: "asset",
        id: assetId,
        title: "周报模板",
        category: "模板",
        summary: "快速复用每周项目同步与复盘结构",
        badge: "模板",
        href: "",
      },
    } as unknown as Request, savePayload as Response);

    expect(savePayload.statusCode).toBe(200);

    const primaryModel = JSON.parse(
      fs.readFileSync(path.join(cfg.projectRoot, "工具箱", "toolbox.json"), "utf8"),
    ) as {
      assets: Array<{ id: string; title: string; summary: string; category: string }>;
    };

    expect(primaryModel.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: assetId,
          title: "周报模板",
          category: "模板",
          summary: "快速复用每周项目同步与复盘结构",
        }),
      ]),
    );

    const deletePayload = createResponse();
    await handleToolboxDelete(cfg)({
      body: {
        entityType: "asset",
        id: assetId,
      },
    } as unknown as Request, deletePayload as Response);

    expect(deletePayload.statusCode).toBe(200);

    const nextPrimaryModel = JSON.parse(
      fs.readFileSync(path.join(cfg.projectRoot, "工具箱", "toolbox.json"), "utf8"),
    ) as {
      assets: Array<{ id: string }>;
    };
    expect(nextPrimaryModel.assets.some((item) => item.id === assetId)).toBe(false);
  });
});

function makeConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-toolbox-"));
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
