import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LLMMessage, LLMProvider } from "../src/utils/provider.js";
import type { ServerConfig } from "../web/server/config.js";
import {
  handleFlashDiaryList,
  handleFlashDiaryMemory,
  handleFlashDiaryPage,
  handleFlashDiarySave,
} from "../web/server/routes/flash-diary.js";

const tempRoots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LLMWIKI_REMOTE_PROVIDER;
  delete process.env.CLOUDFLARE_WORKER_URL;
  delete process.env.CLOUDFLARE_REMOTE_TOKEN;
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("flash diary routes", () => {
  it("returns the memory summary together with diary files", async () => {
    const cfg = createConfig();
    writeDiary(cfg.sourceVaultRoot, "2026-04-20", "hello");
    writeMemory(cfg.sourceVaultRoot, "# Memory\n");
    writeMemoryState(cfg.runtimeRoot, "2026-04-20");
    const json = vi.fn();

    await handleFlashDiaryList(cfg)({} as never, { json } as never);

    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        items: [
          expect.objectContaining({
            path: "raw/闪念日记/2026-04-20.md",
            date: "2026-04-20",
          }),
        ],
        memory: expect.objectContaining({
          kind: "memory",
          path: "wiki/journal-memory.md",
          exists: true,
          lastAppliedDiaryDate: "2026-04-20",
        }),
        twelveQuestions: expect.objectContaining({
          kind: "document",
          title: "十二个问题",
          path: "wiki/journal-twelve-questions.md",
        }),
      },
    });
  });

  it("reads the twelve-questions document as a markdown page", async () => {
    const cfg = createConfig();
    writeTwelveQuestions(cfg.sourceVaultRoot, "# 十二个问题\n\n- 最近在逃避什么？\n");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await handleFlashDiaryPage(cfg)(
      { query: { path: "wiki/journal-twelve-questions.md" } } as never,
      { json, status } as never,
    );

    const payload = json.mock.calls[0]?.[0];
    expect(payload.success).toBe(true);
    expect(payload.data.path).toBe("wiki/journal-twelve-questions.md");
    expect(payload.data.title).toBe("十二个问题");
    expect(payload.data.raw).toContain("最近在逃避什么");
  });

  it("uses the synced cloud document for twelve questions when the local file is missing", async () => {
    const cfg = createConfig();
    process.env.LLMWIKI_REMOTE_PROVIDER = "cloudflare";
    process.env.CLOUDFLARE_WORKER_URL = "https://example.workers.dev/";
    process.env.CLOUDFLARE_REMOTE_TOKEN = "token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        ok: true,
        document: {
          path: "wiki/journal-twelve-questions.md",
          raw: "# 十二个问题\n\n- 云端同步内容\n",
          updatedAt: "2026-04-26T06:20:00.000Z",
        },
      }),
    }));
    const listJson = vi.fn();
    const pageJson = vi.fn();
    const status = vi.fn(() => ({ json: pageJson }));

    await handleFlashDiaryList(cfg)({} as never, { json: listJson } as never);
    await handleFlashDiaryPage(cfg)(
      { query: { path: "wiki/journal-twelve-questions.md" } } as never,
      { json: pageJson, status } as never,
    );

    expect(listJson.mock.calls[0]?.[0]?.data?.twelveQuestions).toMatchObject({
      path: "wiki/journal-twelve-questions.md",
      exists: true,
      modifiedAt: "2026-04-26T06:20:00.000Z",
    });
    expect(pageJson.mock.calls[0]?.[0]?.data?.raw).toContain("云端同步内容");
  });

  it("saves twelve questions to cloud first and mirrors the content locally", async () => {
    const cfg = createConfig();
    process.env.LLMWIKI_REMOTE_PROVIDER = "cloudflare";
    process.env.CLOUDFLARE_WORKER_URL = "https://example.workers.dev/";
    process.env.CLOUDFLARE_REMOTE_TOKEN = "token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const json = vi.fn();
    const statusJson = vi.fn();
    const status = vi.fn(() => ({ json: statusJson }));
    const raw = "# 十二个问题\n\n- 本周最重要的一件事是什么？\n";

    await handleFlashDiarySave(cfg)(
      {
        body: {
          path: "wiki/journal-twelve-questions.md",
          raw,
        },
      } as never,
      { json, status } as never,
    );

    expect(json).toHaveBeenCalledWith({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.workers.dev/mobile/documents/save");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      path: "wiki/journal-twelve-questions.md",
      title: "十二个问题",
      raw,
    });
    expect(fs.readFileSync(path.join(cfg.sourceVaultRoot, "wiki", "journal-twelve-questions.md"), "utf8")).toBe(raw);
    expect(status).not.toHaveBeenCalled();
    expect(statusJson).not.toHaveBeenCalled();
  });

  it("does not mirror twelve questions locally when the cloud save fails", async () => {
    const cfg = createConfig();
    process.env.LLMWIKI_REMOTE_PROVIDER = "cloudflare";
    process.env.CLOUDFLARE_WORKER_URL = "https://example.workers.dev/";
    process.env.CLOUDFLARE_REMOTE_TOKEN = "token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "save failed",
    }));
    const json = vi.fn();
    const statusJson = vi.fn();
    const status = vi.fn(() => ({ json: statusJson }));

    await handleFlashDiarySave(cfg)(
      {
        body: {
          path: "wiki/journal-twelve-questions.md",
          raw: "# 十二个问题\n\n- 失败时不能写本地\n",
        },
      } as never,
      { json, status } as never,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(statusJson).toHaveBeenCalledWith({
      success: false,
      error: "cloud save failed: save failed",
    });
    expect(fs.existsSync(path.join(cfg.sourceVaultRoot, "wiki", "journal-twelve-questions.md"))).toBe(false);
  });

  it("builds and returns the rendered memory page payload", async () => {
    const cfg = createConfig();
    writeDiary(cfg.sourceVaultRoot, "2026-04-19", "hello");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await handleFlashDiaryMemory(cfg, {
      now: new Date(2026, 3, 20, 12, 0, 0),
      provider: createFakeProvider(({ system, prompt }) => {
        if (system.includes("最近 7 天短期记忆")) {
          expect(prompt).toContain("2026-04-19");
          return [
            "### 健康状态",
            "- 暂无明显信息",
            "",
            "### 学习状态",
            "- 最近在推进功能实现。",
            "",
            "### 人际关系",
            "- 暂无明显信息",
            "",
            "### 爱情状态",
            "- 暂无明显信息",
            "",
            "### 财富状态",
            "- 暂无明显信息",
            "",
            "### 情绪与能量",
            "- 整体投入感较强。",
            "",
            "### 近期重点与风险",
            "- 当前重心在开发推进。",
          ].join("\n");
        }
        expect(prompt).toContain("Diary Date: 2026-04-19");
        return [
          "# Memory",
          "",
          "## 短期记忆（最近 7 天）",
          "- 旧占位",
          "",
          "## 长期记忆",
          "- hello",
        ].join("\n");
      }),
    })({} as never, { json, status } as never);

    const payload = json.mock.calls[0]?.[0];
    expect(payload.success).toBe(true);
    expect(payload.data.path).toBe("wiki/journal-memory.md");
    expect(payload.data.sourceEditable).toBe(true);
    expect(payload.data.lastAppliedDiaryDate).toBe("2026-04-19");
    expect(payload.data.html).toContain("短期记忆（最近 7 天）");
    expect(payload.data.html).toContain("健康状态");
    expect(payload.data.html).toContain("长期记忆");
  });

  it("returns the existing memory page without waiting for a hanging refresh provider", async () => {
    const cfg = createConfig();
    writeDiary(cfg.sourceVaultRoot, "2026-04-25", "hello");
    writeMemory(
      cfg.sourceVaultRoot,
      [
        "# Memory",
        "",
        "## 短期记忆（最近 7 天）",
        "- 已有短期记忆",
        "",
        "## 长期记忆",
        "- 已有长期记忆",
      ].join("\n"),
    );
    writeMemoryState(cfg.runtimeRoot, "2026-04-22");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    const result = await Promise.race([
      handleFlashDiaryMemory(cfg, {
        now: new Date(2026, 3, 26, 12, 0, 0),
        provider: createHangingProvider(),
      })({} as never, { json, status } as never).then(() => "completed"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 50)),
    ]);

    expect(result).toBe("completed");
    const payload = json.mock.calls[0]?.[0];
    expect(payload.success).toBe(true);
    expect(payload.data.html).toContain("已有短期记忆");
    expect(payload.data.html).toContain("已有长期记忆");
  });

  it("refreshes legacy short-term placeholder content before returning the memory page", async () => {
    const cfg = createConfig();
    writeDiary(cfg.sourceVaultRoot, "2026-04-24", "昨天状态");
    writeMemory(
      cfg.sourceVaultRoot,
      [
        "# Memory",
        "",
        "## 短期记忆（最近 7 天）",
        "- 可见窗口：2026-04-24",
        "",
        "## 长期记忆",
        "",
        "### 人物与关系",
        "- 已有长期记忆",
        "",
        "### 项目与系统",
        "- 暂无",
        "",
        "### 方法论与偏好",
        "- 暂无",
        "",
        "### 长期问题与矛盾",
        "- 暂无",
        "",
        "### 近期变化",
        "- 暂无",
        "",
        "### 来源范围",
        "- 暂无",
      ].join("\n"),
    );
    writeMemoryState(cfg.runtimeRoot, "2026-04-24", "2026-04-26");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await handleFlashDiaryMemory(cfg, {
      now: new Date(2026, 3, 26, 12, 0, 0),
      provider: createFakeProvider(({ system }) => {
        if (system.includes("最近 7 天短期记忆")) {
          return [
            "### 健康状态",
            "- 暂无明显信息",
            "",
            "### 学习状态",
            "- 昨天状态里有可提炼的近况。",
            "",
            "### 人际关系",
            "- 暂无明显信息",
            "",
            "### 爱情状态",
            "- 暂无明显信息",
            "",
            "### 财富状态",
            "- 暂无明显信息",
            "",
            "### 情绪与能量",
            "- 状态有波动。",
            "",
            "### 近期重点与风险",
            "- 昨天状态",
          ].join("\n");
        }
        throw new Error("long-term provider should not be called for short-term refresh");
      }),
    })({} as never, { json, status } as never);

    const payload = json.mock.calls[0]?.[0];
    expect(payload.success).toBe(true);
    expect(payload.data.html).toContain("昨天状态");
    expect(payload.data.html).not.toContain("可见窗口");
  });

  it("returns the stored page immediately even when legacy short-term refresh would hang", async () => {
    const cfg = createConfig();
    writeDiary(cfg.sourceVaultRoot, "2026-04-24", "昨天状态");
    writeDiary(cfg.sourceVaultRoot, "2026-04-25", "今天先记下来");
    writeMemory(
      cfg.sourceVaultRoot,
      [
        "# Memory",
        "",
        "## 短期记忆（最近 7 天）",
        "- 可见窗口：2026-04-24",
        "",
        "## 长期记忆",
        "",
        "### 人物与关系",
        "- 已有长期记忆",
        "",
        "### 项目与系统",
        "- 暂无",
        "",
        "### 方法论与偏好",
        "- 暂无",
        "",
        "### 长期问题与矛盾",
        "- 暂无",
        "",
        "### 近期变化",
        "- 暂无",
        "",
        "### 来源范围",
        "- 暂无",
      ].join("\n"),
    );
    writeMemoryState(cfg.runtimeRoot, "2026-04-22", "2026-04-26");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    const result = await Promise.race([
      handleFlashDiaryMemory(cfg, {
        now: new Date(2026, 3, 26, 12, 0, 0),
        provider: createHangingProvider(),
      })({} as never, { json, status } as never).then(() => "completed"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 50)),
    ]);

    expect(result).toBe("completed");
    const payload = json.mock.calls[0]?.[0];
    expect(payload.success).toBe(true);
    expect(payload.data.html).toContain("可见窗口");
  });
});

function createConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-route-project-"));
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-route-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-route-runtime-"));
  tempRoots.push(projectRoot, sourceVaultRoot, runtimeRoot);
  return {
    projectRoot,
    sourceVaultRoot,
    runtimeRoot,
    host: "127.0.0.1",
    port: 4175,
    author: "tester",
  };
}

function writeDiary(sourceVaultRoot: string, date: string, body: string): void {
  const filePath = path.join(sourceVaultRoot, "raw", "闪念日记", `${date}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `# ${date}\n\n## 08:00:00\n\n${body}\n`, "utf8");
}

function writeMemory(sourceVaultRoot: string, raw: string): void {
  const filePath = path.join(sourceVaultRoot, "wiki", "journal-memory.md");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, raw, "utf8");
}

function writeMemoryState(
  runtimeRoot: string,
  lastAppliedDiaryDate: string,
  lastShortTermRefreshOn: string | null = null,
): void {
  const filePath = path.join(runtimeRoot, ".llmwiki", "flash-diary-memory.json");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    memoryPath: "wiki/journal-memory.md",
    lastAppliedDiaryDate,
    lastShortTermRefreshOn,
    builtAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z",
  }), "utf8");
}

function createFakeProvider(
  responder: (input: { system: string; prompt: string; messages: LLMMessage[] }) => string,
): LLMProvider {
  return {
    complete: vi.fn(async (system: string, messages: LLMMessage[]) => {
      const prompt = messages.map((message) => message.content).join("\n\n");
      return responder({ system, prompt, messages });
    }),
    stream: vi.fn(async () => ""),
    toolCall: vi.fn(async () => ""),
  };
}

function writeTwelveQuestions(sourceVaultRoot: string, raw: string): void {
  const filePath = path.join(sourceVaultRoot, "wiki", "journal-twelve-questions.md");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, raw, "utf8");
}

function createHangingProvider(): LLMProvider {
  return {
    complete: vi.fn(() => new Promise<string>(() => {})),
    stream: vi.fn(async () => ""),
    toolCall: vi.fn(async () => ""),
  };
}
