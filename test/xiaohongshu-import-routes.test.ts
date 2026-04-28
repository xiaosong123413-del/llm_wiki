import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerConfig } from "../web/server/config.js";
import {
  handleXiaohongshuImportConfigDelete,
  handleXiaohongshuImportConfigGet,
  handleXiaohongshuImportConfigSave,
  handleXiaohongshuCookieSave,
  handleXiaohongshuImportProgress,
  handleXiaohongshuImportStart,
} from "../web/server/routes/xiaohongshu-import.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
  delete process.env.LLM_WIKI_XHS_COOKIE_PATH;
});

describe("xiaohongshu import routes", () => {
  it("saves, reads, and deletes import directory config", async () => {
    const cfg = makeConfig();
    const saveResponse = createResponse();

    await handleXiaohongshuImportConfigSave(cfg)({
      body: { importDirPath: path.join(cfg.projectRoot, "imports", "xiaohongshu") },
    } as Request, saveResponse as Response);

    expect(saveResponse.statusCode).toBe(200);
    expect(saveResponse.body.data.importDirPath).toContain(path.join("imports", "xiaohongshu"));

    const getResponse = createResponse();
    handleXiaohongshuImportConfigGet(cfg)({} as Request, getResponse as Response);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body.data.importDirPath).toBe(saveResponse.body.data.importDirPath);

    const deleteResponse = createResponse();
    await handleXiaohongshuImportConfigDelete(cfg)({} as Request, deleteResponse as Response);
    expect(deleteResponse.statusCode).toBe(200);

    const getAfterDeleteResponse = createResponse();
    handleXiaohongshuImportConfigGet(cfg)({} as Request, getAfterDeleteResponse as Response);
    expect(getAfterDeleteResponse.body.data.importDirPath).toBe("");
  });

  it("saves cookie and starts import progress task", async () => {
    const cfg = makeConfig();
    process.env.LLM_WIKI_XHS_COOKIE_PATH = path.join(cfg.projectRoot, "cookies.json");
    const cookieResponse = createResponse();

    await handleXiaohongshuCookieSave(cfg)({
      body: { cookie: "a=1; web_session=2" },
    } as Request, cookieResponse as Response);

    expect(cookieResponse.statusCode).toBe(200);
    expect(cookieResponse.body.message).toBe("cookie 保存成功");

    const startResponse = createResponse();
    await handleXiaohongshuImportStart(cfg, {
      runInline: true,
      fetcher: async () => new Response("<script>window.__INITIAL_STATE__={}</script>", { status: 200 }),
    })({} as Request, startResponse as Response);

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.body.taskId).toBeTruthy();

    const progressResponse = createResponse();
    handleXiaohongshuImportProgress(cfg)({
      query: { taskId: startResponse.body.taskId },
    } as unknown as Request, progressResponse as Response);

    expect(progressResponse.statusCode).toBe(200);
    expect(progressResponse.body.status).toBe("success");
    expect(progressResponse.body.progress).toBe(100);
  });
});

function makeConfig(): ServerConfig {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xhs-import-routes-"));
  roots.push(root);
  return {
    wikiRoot: root,
    port: 4175,
    host: "127.0.0.1",
    author: "test",
    projectRoot: root,
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
