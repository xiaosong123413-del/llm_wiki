import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleWorkspaceDocs, handleWorkspaceDocsSave } from "../web/server/routes/pages.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("workspace docs route", () => {
  it("creates and returns the default domain document scaffold", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-workspace-docs-"));
    tempDirs.push(root);
    const json = vi.fn();
    const handler = handleWorkspaceDocs({
      projectRoot: root,
      wikiRoot: root,
      host: "127.0.0.1",
      port: 4175,
      author: "me",
    });

    handler({} as never, { json } as never);

    expect(fs.existsSync(path.join(root, "领域.md"))).toBe(true);
    expect(fs.existsSync(path.join(root, "领域", "产品.md"))).toBe(true);
    expect(fs.existsSync(path.join(root, "领域", "产品", "LLM Wiki WebUI.md"))).toBe(true);
    expect(fs.existsSync(path.join(root, "领域", "产品", "LLM Wiki WebUI", "工作日志.md"))).toBe(true);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        documents: expect.arrayContaining([
          expect.objectContaining({
            kind: "root",
            path: "领域.md",
            html: expect.stringContaining("<h1"),
          }),
          expect.objectContaining({
            kind: "domain",
            path: "领域/产品.md",
          }),
          expect.objectContaining({
            kind: "project",
            path: "领域/产品/LLM Wiki WebUI.md",
          }),
          expect.objectContaining({
            kind: "work-log",
            path: "领域/产品/LLM Wiki WebUI/工作日志.md",
          }),
        ]),
      },
    });
  });

  it("renders existing markdown documents in hierarchy order", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-workspace-docs-existing-"));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, "领域", "产品", "LLM Wiki WebUI"), { recursive: true });
    fs.writeFileSync(path.join(root, "领域.md"), "# 领域\n\n总览。\n", "utf8");
    fs.writeFileSync(path.join(root, "领域", "产品.md"), "# 产品\n\n领域说明。\n", "utf8");
    fs.writeFileSync(path.join(root, "领域", "产品", "LLM Wiki WebUI.md"), "# LLM Wiki WebUI\n\n项目文档。\n", "utf8");
    fs.writeFileSync(
      path.join(root, "领域", "产品", "LLM Wiki WebUI", "工作日志.md"),
      "# 工作日志\n\n- 完成工作日志文档视图\n",
      "utf8",
    );
    const json = vi.fn();
    const handler = handleWorkspaceDocs({
      projectRoot: root,
      wikiRoot: root,
      host: "127.0.0.1",
      port: 4175,
      author: "me",
    });

    handler({} as never, { json } as never);

    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        documents: [
          expect.objectContaining({
            kind: "root",
            path: "领域.md",
          }),
          expect.objectContaining({
            kind: "domain",
            path: "领域/产品.md",
          }),
          expect.objectContaining({
            kind: "project",
            path: "领域/产品/LLM Wiki WebUI.md",
          }),
          expect.objectContaining({
            kind: "work-log",
            path: "领域/产品/LLM Wiki WebUI/工作日志.md",
            html: expect.stringContaining("完成工作日志文档视图"),
          }),
        ],
      },
    });
  });

  it("saves edited workspace markdown back to the selected file", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-workspace-docs-save-"));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, "领域", "产品", "LLM Wiki WebUI"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "领域", "产品", "LLM Wiki WebUI", "工作日志.md"),
      "# 工作日志\n\n旧内容\n",
      "utf8",
    );
    const json = vi.fn();
    const status = vi.fn().mockReturnThis();
    const handler = handleWorkspaceDocsSave({
      projectRoot: root,
      wikiRoot: root,
      host: "127.0.0.1",
      port: 4175,
      author: "me",
    });

    await handler(
      {
        body: {
          path: "领域/产品/LLM Wiki WebUI/工作日志.md",
          raw: "# 工作日志\n\n新内容\n",
        },
      } as never,
      { json, status } as never,
    );

    expect(fs.readFileSync(path.join(root, "领域", "产品", "LLM Wiki WebUI", "工作日志.md"), "utf8")).toContain(
      "新内容",
    );
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});
