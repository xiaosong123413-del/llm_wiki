import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LLMMessage, LLMProvider } from "../src/utils/provider.js";
import { readFlashDiaryMemoryPage } from "../web/server/services/flash-diary-memory.js";
import * as llmChatService from "../web/server/services/llm-chat.js";

const tempRoots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("flash diary memory service", () => {
  it("builds memory from all historical diaries in ascending order on first open", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-19", "第 19 天");
    writeDiary(roots.sourceVaultRoot, "2026-04-21", "第 21 天");
    writeDiary(roots.sourceVaultRoot, "2026-04-20", "第 20 天");
    const appliedDates: string[] = [];

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 22, 12, 0, 0),
      provider: createFakeProvider(({ prompt }) => {
        const date = extractDiaryDate(prompt);
        appliedDates.push(date);
        return buildMemoryMarkdown(appliedDates, `最近一次处理：${date}`);
      }),
    });

    expect(appliedDates).toEqual(["2026-04-19", "2026-04-20", "2026-04-21"]);
    expect(page.path).toBe("wiki/journal-memory.md");
    expect(page.sourceEditable).toBe(true);
    expect(page.lastAppliedDiaryDate).toBe("2026-04-21");
    expect(fs.readFileSync(memoryFilePath(roots.sourceVaultRoot), "utf8")).toContain("最近一次处理：2026-04-21");
    expect(readMemoryState(roots.runtimeRoot)?.lastAppliedDiaryDate).toBe("2026-04-21");
  });

  it("skips same-day diaries for long-term application on initial build without an existing memory file", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-24", "昨天的闪念");
    writeDiary(roots.sourceVaultRoot, "2026-04-25", "今天的闪念");
    const appliedDates: string[] = [];

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 25, 10, 0, 0),
      provider: createFakeProvider(({ prompt }) => {
        const date = extractDiaryDate(prompt);
        appliedDates.push(date);
        return buildMemoryMarkdown(appliedDates, `最近一次处理：${date}`);
      }),
    });

    expect(appliedDates).toEqual(["2026-04-24"]);
    expect(page.lastAppliedDiaryDate).toBe("2026-04-24");
    expect(page.raw).toContain("2026-04-24");
    expect(page.raw).not.toContain("2026-04-25");
    expect(readMemoryState(roots.runtimeRoot)?.lastAppliedDiaryDate).toBe("2026-04-24");
  });

  it("replays eligible diaries when the memory file is missing even if stale state exists", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-20", "第 20 天");
    writeDiary(roots.sourceVaultRoot, "2026-04-21", "第 21 天");
    writeMemoryStateFixture(roots.runtimeRoot, "2026-04-21");
    const appliedDates: string[] = [];

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 22, 10, 0, 0),
      provider: createFakeProvider(({ prompt }) => {
        const date = extractDiaryDate(prompt);
        appliedDates.push(date);
        return buildMemoryMarkdown(appliedDates, `最近一次处理：${date}`);
      }),
    });

    expect(appliedDates).toEqual(["2026-04-20", "2026-04-21"]);
    expect(page.lastAppliedDiaryDate).toBe("2026-04-21");
    expect(page.raw).toContain("2026-04-20, 2026-04-21");
  });

  it("does not rewrite memory when there is no new eligible diary day", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-19", "第 19 天");
    writeDiary(roots.sourceVaultRoot, "2026-04-20", "第 20 天");

    await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 22, 12, 0, 0),
      provider: createFakeProvider(({ prompt }) => {
        const date = extractDiaryDate(prompt);
        return buildMemoryMarkdown([date], `最近一次处理：${date}`);
      }),
    });

    const before = fs.readFileSync(memoryFilePath(roots.sourceVaultRoot), "utf8");
    const provider = createFakeProvider(() => {
      throw new Error("provider should not be called");
    });

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 22, 18, 0, 0),
      provider,
    });

    expect(provider.complete).not.toHaveBeenCalled();
    expect(page.lastAppliedDiaryDate).toBe("2026-04-20");
    expect(fs.readFileSync(memoryFilePath(roots.sourceVaultRoot), "utf8")).toBe(before);
  });

  it("does not resolve the default provider when no diary application is needed", async () => {
    const roots = makeRoots();
    fs.mkdirSync(path.dirname(memoryFilePath(roots.sourceVaultRoot)), { recursive: true });
    fs.writeFileSync(
      memoryFilePath(roots.sourceVaultRoot),
      buildTieredMemoryMarkdown({
        shortTermBody: [
          "### 健康状态",
          "- 现有短期记忆",
        ],
        longTermPeopleBullet: "- 现有长期记忆",
      }),
      "utf8",
    );
    writeMemoryStateFixture(roots.runtimeRoot, "2026-04-24", "2026-04-25");
    const resolveProviderSpy = vi.spyOn(llmChatService, "resolveAgentRuntimeProvider").mockImplementation(() => {
      throw new Error("default provider should not be resolved");
    });

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 25, 18, 0, 0),
    });

    expect(resolveProviderSpy).not.toHaveBeenCalled();
    expect(page.raw).toContain("- 现有长期记忆");
  });

  it("applies only missing diary days through yesterday in ascending order", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-19", "第 19 天");
    writeDiary(roots.sourceVaultRoot, "2026-04-20", "第 20 天");

    await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 21, 12, 0, 0),
      provider: createFakeProvider(({ prompt }) => {
        const date = extractDiaryDate(prompt);
        return buildMemoryMarkdown([date], `最近一次处理：${date}`);
      }),
    });

    writeDiary(roots.sourceVaultRoot, "2026-04-21", "第 21 天");
    writeDiary(roots.sourceVaultRoot, "2026-04-22", "第 22 天");
    writeDiary(roots.sourceVaultRoot, "2026-04-23", "第 23 天");
    const appliedDates: string[] = [];

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 23, 12, 0, 0),
      provider: createFakeProvider(({ prompt }) => {
        const date = extractDiaryDate(prompt);
        appliedDates.push(date);
        return buildMemoryMarkdown(["2026-04-20", ...appliedDates], `最近一次处理：${date}`);
      }),
    });

    expect(appliedDates).toEqual(["2026-04-21", "2026-04-22"]);
    expect(page.lastAppliedDiaryDate).toBe("2026-04-22");
    expect(fs.readFileSync(memoryFilePath(roots.sourceVaultRoot), "utf8")).not.toContain("2026-04-23");
  });

  it("uses the current memory markdown as the base for later daily updates", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-19", "第 19 天");

    await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 20, 12, 0, 0),
      provider: createFakeProvider(() => buildMemoryMarkdown(["2026-04-19"], "初版")),
    });

    fs.writeFileSync(
      memoryFilePath(roots.sourceVaultRoot),
      buildMemoryMarkdown(["2026-04-19"], "人工修改保留"),
      "utf8",
    );
    writeDiary(roots.sourceVaultRoot, "2026-04-20", "第 20 天");

    const provider = createFakeProvider(({ prompt }) => {
      expect(prompt).toContain("人工修改保留");
      expect(prompt).toContain("Diary Date: 2026-04-20");
      return buildMemoryMarkdown(["2026-04-19", "2026-04-20"], "人工修改保留\n- 新增第 20 天");
    });

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 21, 12, 0, 0),
      provider,
    });

    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(page.raw).toContain("人工修改保留");
    expect(page.raw).toContain("新增第 20 天");
  });

  it("creates tiered memory with short-term above long-term and records refresh day on first build", async () => {
    const roots = makeRoots();
    const diaryDates = [
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
    ];

    for (const date of diaryDates) {
      writeDiary(roots.sourceVaultRoot, date, `${date} 的闪念`);
    }

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 25, 10, 0, 0),
      provider: createFakeProvider(({ system }) =>
        system.includes("最近 7 天短期记忆")
          ? buildShortTermSummaryMarkdown({
            health: "- 作息偏乱，但还在持续推进。",
            learning: "- 最近主要在围绕项目实现学习。",
            focus: "- 重点都集中在开发任务上。",
          })
          : buildMemoryMarkdown(diaryDates, "长期记忆基线"),
      ),
    });

    const shortTermHeadingIndex = page.raw.indexOf("## 短期记忆（最近 7 天）");
    const longTermHeadingIndex = page.raw.indexOf("## 长期记忆");
    const shortTermSection = extractShortTermSection(page.raw);

    expect(page.raw).toContain("## 短期记忆（最近 7 天）");
    expect(shortTermHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(longTermHeadingIndex).toBeGreaterThan(shortTermHeadingIndex);
    expect(shortTermSection).toContain("### 健康状态");
    expect(shortTermSection).toContain("### 学习状态");
    expect(shortTermSection).toContain("### 财富状态");
    expect(shortTermSection).toContain("开发任务");
    expect(shortTermSection).not.toContain("2026-04-17 的闪念");
    expect(shortTermSection).not.toContain("可见窗口");
    expect(readMemoryState(roots.runtimeRoot)).toMatchObject({
      lastAppliedDiaryDate: "2026-04-24",
      lastShortTermRefreshOn: "2026-04-25",
    });
  });

  it("refreshes only the short-term section while preserving long-term manual edits", async () => {
    const roots = makeRoots();
    const initialDates = [
      "2026-04-17",
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
    ];

    for (const date of initialDates) {
      writeDiary(roots.sourceVaultRoot, date, `${date} 的闪念`);
    }

    await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 25, 10, 0, 0),
      provider: createFakeProvider(({ system }) =>
        system.includes("最近 7 天短期记忆")
          ? buildShortTermSummaryMarkdown({
            health: "- 第一版短期总结",
            learning: "- 第一版学习状态",
            focus: "- 第一版重点",
          })
          : buildMemoryMarkdown(initialDates, "长期记忆基线"),
      ),
    });

    fs.writeFileSync(
      memoryFilePath(roots.sourceVaultRoot),
      buildTieredMemoryMarkdown({
        shortTermBody: [
          "### 健康状态",
          "- 会被覆盖",
          "",
          "### 学习状态",
          "- 会被覆盖",
        ],
        longTermPeopleBullet: "- 人工保留",
      }),
      "utf8",
    );
    writeDiary(roots.sourceVaultRoot, "2026-04-25", "2026-04-25 的闪念");

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 26, 10, 0, 0),
      provider: createFakeProvider(({ system }) =>
        system.includes("最近 7 天短期记忆")
          ? buildShortTermSummaryMarkdown({
            health: "- 第二版短期总结",
            learning: "- 最近仍在开发，学习时间减少。",
            focus: "- 新增 2026-04-25 的状态后重算。",
          })
          : buildMemoryMarkdown([...initialDates, "2026-04-25"], "长期记忆刷新"),
      ),
    });
    const shortTermSection = extractShortTermSection(page.raw);

    expect(shortTermSection).toContain("## 短期记忆（最近 7 天）");
    expect(page.raw).not.toContain("- 会被覆盖");
    expect(shortTermSection).not.toContain("2026-04-18 的闪念");
    expect(shortTermSection).toContain("最近仍在开发");
    expect(shortTermSection).toContain("新增 2026-04-25 的状态后重算");
    expect(page.raw).toContain("- 人工保留");
  });

  it("upgrades a legacy long-term memory file into tiered structure without discarding manual edits", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-24", "2026-04-24 的闪念");
    fs.mkdirSync(path.dirname(memoryFilePath(roots.sourceVaultRoot)), { recursive: true });
    fs.writeFileSync(
      memoryFilePath(roots.sourceVaultRoot),
      buildLegacyMemoryMarkdown("- 旧结构里的人工编辑"),
      "utf8",
    );
    writeMemoryStateFixture(roots.runtimeRoot, "2026-04-24");

    const provider = createFakeProvider(({ system }) => {
      if (system.includes("最近 7 天短期记忆")) {
        return buildShortTermSummaryMarkdown({
          health: "- 暂无明显信息",
          learning: "- 暂无明显信息",
          focus: "- 暂无明显信息",
        });
      }
      throw new Error("long-term provider should not be called");
    });

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 25, 10, 0, 0),
      provider,
    });

    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(page.raw).toContain("## 短期记忆（最近 7 天）");
    expect(page.raw).toContain("## 长期记忆");
    expect(page.raw).toContain("### 人物与关系");
    expect(page.raw).toContain("- 旧结构里的人工编辑");
  });

  it("returns the existing memory content when refresh needs a provider but provider resolution fails", async () => {
    const roots = makeRoots();
    writeDiary(roots.sourceVaultRoot, "2026-04-24", "昨天的闪念");
    fs.mkdirSync(path.dirname(memoryFilePath(roots.sourceVaultRoot)), { recursive: true });
    fs.writeFileSync(
      memoryFilePath(roots.sourceVaultRoot),
      buildTieredMemoryMarkdown({
        shortTermBody: [
          "### 健康状态",
          "- 现有短期记忆",
        ],
        longTermPeopleBullet: "- 现有长期记忆",
      }),
      "utf8",
    );
    writeMemoryStateFixture(roots.runtimeRoot, "2026-04-23", "2026-04-24");
    vi.spyOn(llmChatService, "resolveAgentRuntimeProvider").mockImplementation(() => {
      throw new Error("provider unavailable");
    });

    const page = await readFlashDiaryMemoryPage({
      ...roots,
      now: new Date(2026, 3, 25, 10, 0, 0),
    });

    expect(page.raw).toContain("## 短期记忆（最近 7 天）");
    expect(page.raw).toContain("- 现有短期记忆");
    expect(page.raw).toContain("- 现有长期记忆");
    expect(page.lastAppliedDiaryDate).toBe("2026-04-23");
  });
});

function makeRoots(): { projectRoot: string; sourceVaultRoot: string; runtimeRoot: string } {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-project-"));
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-runtime-"));
  tempRoots.push(projectRoot, sourceVaultRoot, runtimeRoot);
  return { projectRoot, sourceVaultRoot, runtimeRoot };
}

function writeDiary(sourceVaultRoot: string, date: string, body: string): void {
  const filePath = path.join(sourceVaultRoot, "raw", "闪念日记", `${date}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `# ${date}\n\n## 08:00:00\n\n${body}\n\n---\n`, "utf8");
}

function buildMemoryMarkdown(dates: string[], recentChange: string): string {
  return [
    "# Memory",
    "",
    "## 人物与关系",
    "- 暂无",
    "",
    "## 项目与系统",
    "- 暂无",
    "",
    "## 方法论与偏好",
    "- 暂无",
    "",
    "## 长期问题与矛盾",
    "- 暂无",
    "",
    "## 近期变化",
    `- ${recentChange}`,
    "",
    "## 来源范围",
    `- ${dates.join(", ")}`,
    "",
  ].join("\n");
}

function memoryFilePath(sourceVaultRoot: string): string {
  return path.join(sourceVaultRoot, "wiki", "journal-memory.md");
}

function readMemoryState(runtimeRoot: string): {
  lastAppliedDiaryDate?: string;
  lastShortTermRefreshOn?: string;
} | null {
  const filePath = path.join(runtimeRoot, ".llmwiki", "flash-diary-memory.json");
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    lastAppliedDiaryDate?: string;
    lastShortTermRefreshOn?: string;
  };
}

function createFakeProvider(
  responder: (input: { system: string; prompt: string; messages: LLMMessage[] }) => string,
): LLMProvider {
  const complete = vi.fn(async (system: string, messages: LLMMessage[]) => {
    const prompt = messages.map((message) => message.content).join("\n\n");
    try {
      return responder({ system, prompt, messages });
    } catch (error) {
      if (system.includes("最近 7 天短期记忆") && error instanceof Error && error.message.startsWith("missing diary date")) {
        return buildShortTermSummaryMarkdown({
          health: "- 暂无明显信息",
          learning: "- 暂无明显信息",
          focus: "- 暂无明显信息",
        });
      }
      throw error;
    }
  });
  return {
    complete,
    stream: vi.fn(async () => ""),
    toolCall: vi.fn(async () => ""),
  };
}

function extractDiaryDate(prompt: string): string {
  const match = prompt.match(/Diary Date:\s*(\d{4}-\d{2}-\d{2})/);
  if (!match?.[1]) {
    throw new Error(`missing diary date in prompt: ${prompt}`);
  }
  return match[1];
}

function buildTieredMemoryMarkdown(input: {
  shortTermBody: readonly string[];
  longTermPeopleBullet: string;
}): string {
  return [
    "# Memory",
    "",
    "## 短期记忆（最近 7 天）",
    ...input.shortTermBody,
    "",
    "## 长期记忆",
    "",
    "### 人物与关系",
    input.longTermPeopleBullet,
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
    "",
  ].join("\n");
}

function buildShortTermSummaryMarkdown(input: {
  health: string;
  learning: string;
  focus: string;
}): string {
  return [
    "### 健康状态",
    input.health,
    "",
    "### 学习状态",
    input.learning,
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
    "- 整体能量波动较大，但推进意愿仍在。",
    "",
    "### 近期重点与风险",
    input.focus,
  ].join("\n");
}

function buildLegacyMemoryMarkdown(peopleBullet: string): string {
  return [
    "# Memory",
    "",
    "## 人物与关系",
    peopleBullet,
    "",
    "## 项目与系统",
    "- 暂无",
    "",
    "## 方法论与偏好",
    "- 暂无",
    "",
    "## 长期问题与矛盾",
    "- 暂无",
    "",
    "## 近期变化",
    "- 暂无",
    "",
    "## 来源范围",
    "- 暂无",
    "",
  ].join("\n");
}

function writeMemoryStateFixture(
  runtimeRoot: string,
  lastAppliedDiaryDate: string,
  lastShortTermRefreshOn: string | null = null,
): void {
  const filePath = path.join(runtimeRoot, ".llmwiki", "flash-diary-memory.json");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({
      version: 1,
      memoryPath: "wiki/journal-memory.md",
      lastAppliedDiaryDate,
      lastShortTermRefreshOn,
      builtAt: "2026-04-24T10:00:00.000Z",
      updatedAt: "2026-04-24T10:00:00.000Z",
    }, null, 2)}\n`,
    "utf8",
  );
}

function extractShortTermSection(raw: string): string {
  const shortTermHeading = "## 短期记忆（最近 7 天）";
  const longTermHeading = "## 长期记忆";
  const startIndex = raw.indexOf(shortTermHeading);
  if (startIndex < 0) {
    return "";
  }
  const endIndex = raw.indexOf(longTermHeading, startIndex);
  return endIndex < 0 ? raw.slice(startIndex) : raw.slice(startIndex, endIndex);
}
