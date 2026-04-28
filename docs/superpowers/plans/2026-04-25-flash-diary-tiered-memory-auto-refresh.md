# Flash Diary Tiered Memory Auto Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make flash-diary `Memory` write both short-term and long-term memory into `wiki/journal-memory.md`, keep short-term above long-term, refresh short-term automatically every local midnight, and catch up on startup or page read if midnight was missed.

**Architecture:** Keep `web/server/services/flash-diary-memory.ts` as the single source of truth for Memory generation, but extend it to normalize one tiered markdown document, rebuild the short-term section from the most recent 7 eligible diary days, and incrementally update the long-term section while preserving manual edits. Add a small server-side scheduler helper that runs the same due-refresh path at startup and every next local midnight, then keep the route and page thin by reusing the existing `GET /api/flash-diary/memory` boundary.

**Tech Stack:** TypeScript, Express, Vitest, JSDOM page tests

---

### Task 1: Lock Tiered Memory Structure with Failing Service Tests

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory.test.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory.test.ts`

- [ ] **Step 1: Write the failing test for first-build tiered Memory**

```ts
it("builds one tiered memory document with short-term above long-term and records the refresh day", async () => {
  const roots = makeRoots();
  writeDiary(roots.sourceVaultRoot, "2026-04-17", "第 17 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-18", "第 18 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-19", "第 19 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-20", "第 20 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-21", "第 21 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-22", "第 22 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-23", "第 23 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-24", "第 24 天");

  const page = await readFlashDiaryMemoryPage({
    ...roots,
    now: new Date("2026-04-25T10:00:00+08:00"),
    provider: createTieredProvider(),
  });

  expect(page.raw.indexOf("## 短期记忆（最近 7 天）")).toBeGreaterThan(-1);
  expect(page.raw.indexOf("## 长期记忆")).toBeGreaterThan(page.raw.indexOf("## 短期记忆（最近 7 天）"));
  expect(page.raw).toContain("2026-04-18, 2026-04-19, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24");
  expect(readMemoryState(roots.runtimeRoot)).toMatchObject({
    lastAppliedDiaryDate: "2026-04-24",
    lastShortTermRefreshOn: "2026-04-25",
  });
});
```

- [ ] **Step 2: Write the failing test for rolling short-term refresh without losing long-term manual edits**

```ts
it("rebuilds only the short-term section for the latest 7 eligible days while preserving long-term manual edits", async () => {
  const roots = makeRoots();
  writeDiary(roots.sourceVaultRoot, "2026-04-18", "第 18 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-19", "第 19 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-20", "第 20 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-21", "第 21 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-22", "第 22 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-23", "第 23 天");
  writeDiary(roots.sourceVaultRoot, "2026-04-24", "第 24 天");

  await readFlashDiaryMemoryPage({
    ...roots,
    now: new Date("2026-04-25T10:00:00+08:00"),
    provider: createTieredProvider(),
  });

  fs.writeFileSync(
    memoryFilePath(roots.sourceVaultRoot),
    [
      "# Memory",
      "",
      "## 短期记忆（最近 7 天）",
      "- 会被覆盖",
      "",
      "## 长期记忆",
      "",
      "### 人物与关系",
      "- 人工保留",
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
      "- 2026-04-24",
      "",
    ].join("\n"),
    "utf8",
  );
  writeDiary(roots.sourceVaultRoot, "2026-04-25", "第 25 天");

  const page = await readFlashDiaryMemoryPage({
    ...roots,
    now: new Date("2026-04-26T10:00:00+08:00"),
    provider: createTieredProvider(),
  });

  expect(page.raw).not.toContain("- 会被覆盖");
  expect(page.raw).not.toContain("2026-04-18");
  expect(page.raw).toContain("2026-04-19, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-25");
  expect(page.raw).toContain("- 人工保留");
});
```

- [ ] **Step 3: Run the service test to verify RED**

Run: `rtk test -- npm test -- test/flash-diary-memory.test.ts`
Expected: FAIL because the current service only writes one long-term block, has no `lastShortTermRefreshOn`, and cannot roll the visible short-term window.

- [ ] **Step 4: Write the minimal shared test helper for tiered provider output**

```ts
function createTieredProvider(): LLMProvider {
  return createFakeProvider(({ prompt }) => {
    const date = extractDiaryDate(prompt);
    return [
      "# Memory",
      "",
      "## 短期记忆（最近 7 天）",
      `- 短期窗口: ${extractRecentDates(prompt).join(", ")}`,
      "",
      "## 长期记忆",
      "",
      "### 人物与关系",
      readLongTermSection(prompt, "### 人物与关系", "- 暂无"),
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
      `- 最近一次处理：${date}`,
      "",
      "### 来源范围",
      `- ${extractAppliedDates(prompt).join(", ")}`,
      "",
    ].join("\n");
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add test/flash-diary-memory.test.ts
git commit -m "test: lock tiered flash diary memory behavior"
```

### Task 2: Lock Legacy Normalization and Daily Due-Check Behavior

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory.test.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory-scheduler.test.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory.test.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory-scheduler.test.ts`

- [ ] **Step 1: Write the failing test for upgrading an existing legacy long-term Memory file**

```ts
it("wraps an existing legacy memory file into the new long-term section instead of discarding manual edits", async () => {
  const roots = makeRoots();
  writeDiary(roots.sourceVaultRoot, "2026-04-24", "第 24 天");
  fs.mkdirSync(path.dirname(memoryFilePath(roots.sourceVaultRoot)), { recursive: true });
  fs.writeFileSync(
    memoryFilePath(roots.sourceVaultRoot),
    [
      "# Memory",
      "",
      "## 人物与关系",
      "- 旧结构里的人工编辑",
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
      "- 2026-04-24",
      "",
    ].join("\n"),
    "utf8",
  );

  const page = await readFlashDiaryMemoryPage({
    ...roots,
    now: new Date("2026-04-25T10:00:00+08:00"),
    provider: createTieredProvider(),
  });

  expect(page.raw).toContain("## 长期记忆");
  expect(page.raw).toContain("### 人物与关系");
  expect(page.raw).toContain("- 旧结构里的人工编辑");
});
```

- [ ] **Step 2: Write the failing scheduler test for startup catch-up and same-day dedupe**

```ts
it("runs one startup catch-up refresh when today is due and schedules the next local midnight refresh", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-25T00:10:00+08:00"));
  const refreshIfDue = vi.fn(async () => undefined);

  const scheduler = startFlashDiaryMemoryScheduler({
    cfg: createConfig(),
    refreshIfDue,
  });

  await Promise.resolve();
  expect(refreshIfDue).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 50 * 60 * 1000);
  await Promise.resolve();
  expect(refreshIfDue).toHaveBeenCalledTimes(2);

  scheduler.dispose();
});
```

- [ ] **Step 3: Run the focused tests to verify RED**

Run: `rtk test -- npm test -- test/flash-diary-memory.test.ts test/flash-diary-memory-scheduler.test.ts`
Expected: FAIL because the current service does not normalize the old markdown structure and there is no scheduler helper yet.

- [ ] **Step 4: Add the minimal scheduler test harness utilities**

```ts
afterEach(() => {
  vi.useRealTimers();
});

function createConfig(): ServerConfig {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-scheduler-"));
  return {
    projectRoot: root,
    sourceVaultRoot: root,
    runtimeRoot: fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-scheduler-runtime-")),
    host: "127.0.0.1",
    port: 4175,
    author: "tester",
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add test/flash-diary-memory.test.ts test/flash-diary-memory-scheduler.test.ts
git commit -m "test: lock flash diary memory refresh scheduling"
```

### Task 3: Implement Tiered Memory Generation in the Service

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\flash-diary-memory.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory.test.ts`

- [ ] **Step 1: Expand the persisted state shape**

```ts
interface FlashDiaryMemoryState {
  version: number;
  memoryPath: string;
  lastAppliedDiaryDate: string | null;
  lastShortTermRefreshOn: string | null;
  builtAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Normalize the single markdown file into short-term and long-term sections**

```ts
function normalizeTieredMemoryMarkdown(raw: string): string {
  const longTermBody = extractOrUpgradeLongTermBody(raw);
  return [
    "# Memory",
    "",
    "## 短期记忆（最近 7 天）",
    "- 暂无",
    "",
    "## 长期记忆",
    "",
    longTermBody,
    "",
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}
```

- [ ] **Step 3: Rebuild short-term from the most recent 7 eligible diary days and keep long-term incremental**

```ts
const eligibleDiaries = diaries.filter((diary) => diary.date <= formatLocalDate(addDays(now, -1)));
const shortTermDiaries = eligibleDiaries.slice(-7);
const normalizedBase = normalizeTieredMemoryMarkdown(baseRaw);
const nextShortTerm = await buildShortTermSection(provider, shortTermDiaries, normalizedBase);
const pendingLongTerm = eligibleDiaries.filter((diary) =>
  shouldApplyDiaryDay(diary.date, state?.lastAppliedDiaryDate ?? null, now),
);
const nextLongTerm = pendingLongTerm.length > 0
  ? await applyLongTermDiaryInputs(provider, normalizedBase, pendingLongTerm)
  : normalizedBase;
const effectiveRaw = mergeTieredSections(nextShortTerm, nextLongTerm);
```

- [ ] **Step 4: Persist both `lastAppliedDiaryDate` and `lastShortTermRefreshOn`**

```ts
await writeMemoryState(options.runtimeRoot, {
  version: STATE_VERSION,
  memoryPath: MEMORY_PATH,
  lastAppliedDiaryDate,
  lastShortTermRefreshOn: formatLocalDate(now),
  builtAt: state?.builtAt ?? now.toISOString(),
  updatedAt: now.toISOString(),
});
```

- [ ] **Step 5: Run the service tests to verify GREEN**

Run: `rtk test -- npm test -- test/flash-diary-memory.test.ts`
Expected: PASS with the new tiered structure, rolling 7-day short-term window, preserved long-term manual edits, and upgraded legacy markdown.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/flash-diary-memory.ts test/flash-diary-memory.test.ts
git commit -m "feat: add tiered flash diary memory generation"
```

### Task 4: Add the Server-Side Midnight Scheduler and Catch-Up Hook

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\flash-diary-memory-scheduler.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\flash-diary-memory.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\index.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-memory-scheduler.test.ts`

- [ ] **Step 1: Create a small scheduler helper with an injectable refresh function**

```ts
export function startFlashDiaryMemoryScheduler(options: {
  cfg: ServerConfig;
  refreshIfDue?: (now?: Date) => Promise<void>;
}): { dispose(): void } {
  let timer: NodeJS.Timeout | null = null;
  const run = async () => {
    await (options.refreshIfDue ?? ((now) => refreshFlashDiaryMemoryIfDue({ ...options.cfg, now })))(new Date());
    scheduleNext();
  };
  const scheduleNext = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), millisecondsUntilNextMidnight(new Date()));
  };
  void run();
  return { dispose() { if (timer) clearTimeout(timer); } };
}
```

- [ ] **Step 2: Add an explicit due-refresh API inside the Memory service**

```ts
export async function refreshFlashDiaryMemoryIfDue(options: FlashDiaryMemoryOptions): Promise<void> {
  const today = formatLocalDate(options.now ?? new Date());
  const state = readMemoryState(options.runtimeRoot);
  if (state?.lastShortTermRefreshOn === today) {
    return;
  }
  await readFlashDiaryMemoryPage(options);
}
```

- [ ] **Step 3: Start the scheduler from the server bootstrap**

```ts
const memoryScheduler = startFlashDiaryMemoryScheduler({ cfg });

app.listen(cfg.port, cfg.host, () => {
  console.log(`llm-wiki web server listening on http://${cfg.host}:${cfg.port}`);
});

process.on("exit", () => {
  memoryScheduler.dispose();
});
```

- [ ] **Step 4: Run the scheduler test to verify GREEN**

Run: `rtk test -- npm test -- test/flash-diary-memory-scheduler.test.ts`
Expected: PASS with one startup catch-up run and one next-midnight run under fake timers.

- [ ] **Step 5: Commit**

```bash
git add web/server/services/flash-diary-memory-scheduler.ts web/server/services/flash-diary-memory.ts web/server/index.ts test/flash-diary-memory-scheduler.test.ts
git commit -m "feat: schedule midnight flash diary memory refresh"
```

### Task 5: Keep the Route and Page Thin While Surfacing the New Memory Content

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\flash-diary.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\flash-diary\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\flash-diary-routes.test.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\web-flash-diary-page.test.ts`

- [ ] **Step 1: Write the failing route and page assertions for tiered Memory**

```ts
expect(payload.data.html).toContain("短期记忆（最近 7 天）");
expect(payload.data.html).toContain("长期记忆");
```

```ts
expect(page.querySelector("[data-flash-diary-memory-body]")?.textContent).toContain("短期记忆（最近 7 天）");
expect(page.querySelector("[data-flash-diary-memory-body]")?.textContent).toContain("长期记忆");
expect(page.querySelector("[data-flash-diary-memory]")?.textContent).toContain("短期与长期记忆");
```

- [ ] **Step 2: Run the route and page tests to verify RED**

Run: `rtk test -- npm test -- test/flash-diary-routes.test.ts test/web-flash-diary-page.test.ts`
Expected: FAIL because the current fixtures still use the old single-block Memory wording and do not assert the tiered output.

- [ ] **Step 3: Update the route to use the due-refresh path and update the UI copy only where it is now inaccurate**

```ts
const page = await readFlashDiaryMemoryPage({
  projectRoot: cfg.projectRoot,
  sourceVaultRoot: cfg.sourceVaultRoot,
  runtimeRoot: cfg.runtimeRoot,
  now: options.now,
  provider: options.provider,
});
```

```ts
description: "根据日记沉淀的短期与长期记忆",
```

- [ ] **Step 4: Run the route and page tests to verify GREEN**

Run: `rtk test -- npm test -- test/flash-diary-routes.test.ts test/web-flash-diary-page.test.ts`
Expected: PASS with the same Memory path and interaction model, but with the new tiered content visible.

- [ ] **Step 5: Commit**

```bash
git add web/server/routes/flash-diary.ts web/client/src/pages/flash-diary/index.ts test/flash-diary-routes.test.ts test/web-flash-diary-page.test.ts
git commit -m "feat: surface tiered flash diary memory"
```

### Task 6: Update User-Facing Documentation and Run Full Verification

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`

- [ ] **Step 1: Update the flash-diary section in the project log**

```md
- `Memory` 现在继续使用单一真实文件 `wiki/journal-memory.md`，上半部分为“短期记忆（最近 7 天）”，下半部分为“长期记忆”
- 短期记忆每天本地时间 00:00 自动刷新；如果应用错过 00:00，则会在下次启动或打开 Memory 时补刷
- 评论区仍然直接绑定 `wiki/journal-memory.md`
```

- [ ] **Step 2: Run the focused Memory verification suite**

Run: `rtk test -- npm test -- test/flash-diary-memory.test.ts test/flash-diary-memory-scheduler.test.ts test/flash-diary-routes.test.ts test/web-flash-diary-page.test.ts`
Expected: PASS with 0 failures.

- [ ] **Step 3: Run the required repository checks**

Run: `rtk tsc --noEmit`
Expected: PASS

Run: `rtk npm run build`
Expected: PASS

Run: `rtk test -- npm test`
Expected: PASS

Run: `fallow`
Expected: PASS with no new dead code, duplication, or complexity issues; if it fails because of pre-existing repository-wide issues, capture the exact counts and confirm this change did not add new failures.

- [ ] **Step 4: Review the final diff before reporting completion**

Run: `rtk git diff -- web/server/services/flash-diary-memory.ts web/server/services/flash-diary-memory-scheduler.ts web/server/routes/flash-diary.ts web/server/index.ts web/client/src/pages/flash-diary/index.ts test/flash-diary-memory.test.ts test/flash-diary-memory-scheduler.test.ts test/flash-diary-routes.test.ts test/web-flash-diary-page.test.ts docs/project-log.md`
Expected: Only the tiered Memory service, scheduler, route/page adjustments, tests, and project log changes are present.

- [ ] **Step 5: Commit**

```bash
git add docs/project-log.md web/server/services/flash-diary-memory.ts web/server/services/flash-diary-memory-scheduler.ts web/server/routes/flash-diary.ts web/server/index.ts web/client/src/pages/flash-diary/index.ts test/flash-diary-memory.test.ts test/flash-diary-memory-scheduler.test.ts test/flash-diary-routes.test.ts test/web-flash-diary-page.test.ts
git commit -m "feat: add auto-refreshing tiered flash diary memory"
```
