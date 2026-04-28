# Task Plan Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build real backend behavior for the workspace `任务计划页`, including dedicated agent binding, persisted task-plan state, schedule generation, manual fine-tune persistence, roadmap window switching, voice transcription, and execution handoff.

**Architecture:** Add a dedicated `task-plan` backend slice to the existing Express server. Persist page state under `D:\Desktop\ai的仓库\task plan\`, resolve runtime LLM behavior through a dedicated `task-plan-assistant` agent that can bind to a saved account or fall back to the global default LLM config, and wire the existing task-plan page buttons to these APIs without changing the visual design.

**Tech Stack:** TypeScript, Express, Vitest, existing `LLMProvider` abstraction, existing `agent-config`/`llm-config`/`llm-accounts` services, existing Cloudflare transcription helper, existing web workspace page.

---

## File Structure

**Create:**

- `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-store.ts`
  Stores and bootstraps task-plan state from `D:\Desktop\ai的仓库\task plan\`.
- `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-service.ts`
  Owns generation, schedule save, roadmap windowing, and execution snapshot logic.
- `D:\Desktop\llm-wiki-compiler-main\web\server\routes\task-plan.ts`
  Exposes `GET/POST/PUT` APIs for the task-plan page.
- `D:\Desktop\llm-wiki-compiler-main\test\task-plan-store.test.ts`
  Verifies bootstrap, external storage path handling, and persistence.
- `D:\Desktop\llm-wiki-compiler-main\test\task-plan-routes.test.ts`
  Verifies route payloads and error handling.
- `D:\Desktop\llm-wiki-compiler-main\test\task-plan-service.test.ts`
  Verifies generation, missing-context blocking, roadmap navigation, and execution snapshot behavior.

**Modify:**

- `D:\Desktop\llm-wiki-compiler-main\web\server\services\agent-config.ts`
  Add default `task-plan-assistant` agent scaffold.
- `D:\Desktop\llm-wiki-compiler-main\web\server\index.ts`
  Register task-plan APIs.
- `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\workspace\index.ts`
  Add task-plan fetch state, button handlers, microphone capture, and hydration.
- `D:\Desktop\llm-wiki-compiler-main\test\agent-config-routes.test.ts`
  Expect the new default agent.
- `D:\Desktop\llm-wiki-compiler-main\test\web-workspace-page.test.ts`
  Verify task-plan buttons call the new APIs and update the rendered page state.

## Task 1: Add the Dedicated Task-Plan Agent Scaffold

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\agent-config.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\agent-config-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("scaffolds the dedicated task-plan assistant agent", async () => {
  const cfg = makeConfig();
  const response = createResponse();

  await handleAgentConfig(cfg)({} as Request, response as Response);

  expect(response.statusCode).toBe(200);
  expect(response.body.data.agents).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: "task-plan-assistant",
      name: "任务计划助手",
      provider: "openai",
      accountRef: "",
      enabled: true,
    }),
  ]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/agent-config-routes.test.ts"
```

Expected: FAIL because `task-plan-assistant` is not yet scaffolded.

- [ ] **Step 3: Write the minimal implementation**

Add one more default agent inside `createDefaultAgentConfig()`:

```ts
{
  id: "task-plan-assistant",
  name: "任务计划助手",
  purpose: "处理任务计划页的语音整理、排期生成、微调落盘与执行确认",
  provider: "openai",
  accountRef: "",
  model: "",
  workflow: "读取任务计划页状态\n读取最近语音输入、任务池和工作日志上下文\n输出严格 JSON 计划结果\n在人工微调后只做结构校正，不改用户意图",
  prompt: "你是任务计划页专用助手。你的输出必须是严格 JSON，不要输出 Markdown，不要补充解释，不要虚构缺失上下文。",
  enabled: true,
  updatedAt: now,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/agent-config-routes.test.ts"
```

Expected: PASS with the new default agent included.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/services/agent-config.ts" "test/agent-config-routes.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: scaffold task plan assistant agent"
```

## Task 2: Add External Task-Plan State Storage and Seed Data

**Files:**

- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-store.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\task-plan-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("bootstraps task-plan state inside the external storage root", async () => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-plan-store-"));

  const state = readTaskPlanState({ storageRoot });

  expect(state.voice.transcript).toContain("今天要先完成需求文档");
  expect(state.pool.items).toHaveLength(11);
  expect(state.schedule.items).toHaveLength(5);
  expect(fs.existsSync(path.join(storageRoot, "state.json"))).toBe(true);
});

it("writes execution history as append-only snapshots", async () => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-plan-store-"));
  appendTaskPlanExecution(
    { storageRoot },
    {
      id: "exec-1",
      createdAt: "2026-04-24T10:00:00.000Z",
      status: "ready",
      scheduleSnapshot: [{ id: "item-1", title: "完成需求文档初稿", start: "09:00", end: "10:30", priority: "high", source: "seed", notes: "" }],
      generationId: "gen-1",
      revisionId: "rev-1",
      runId: null,
    },
  );

  const executions = readTaskPlanExecutions({ storageRoot });
  expect(executions).toHaveLength(1);
  expect(executions[0]?.id).toBe("exec-1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-store.test.ts"
```

Expected: FAIL because the store module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create a store with explicit typed state and the external root constant:

```ts
export const DEFAULT_TASK_PLAN_STORAGE_ROOT = "D:\\Desktop\\ai的仓库\\task plan";

export interface TaskPlanStoreOptions {
  storageRoot?: string;
}

export interface TaskPlanState {
  voice: { transcript: string; audioPath: string | null; updatedAt: string | null };
  pool: { items: TaskPlanPoolItem[] };
  schedule: { generationId: string | null; revisionId: string | null; items: TaskPlanScheduleItem[]; confirmed: boolean };
  roadmap: { view: "week"; windowStart: string; groups: TaskPlanRoadmapGroup[] };
  morningFlow: { voiceDone: boolean; diaryDone: boolean; planningDone: boolean; fineTuneDone: boolean };
  lastExecutionId: string | null;
}

export function readTaskPlanState(options: TaskPlanStoreOptions = {}): TaskPlanState {
  const root = ensureTaskPlanStorageRoot(options.storageRoot ?? DEFAULT_TASK_PLAN_STORAGE_ROOT);
  const filePath = path.join(root, "state.json");
  if (!fs.existsSync(filePath)) {
    const seeded = createDefaultTaskPlanState();
    fs.writeFileSync(filePath, `${JSON.stringify(seeded, null, 2)}\n`, "utf8");
    return seeded;
  }
  return normalizeTaskPlanState(JSON.parse(fs.readFileSync(filePath, "utf8")));
}
```

Seed `pool.items`, `schedule.items`, and roadmap rows from the values already rendered in the current task-plan page so the first backend read matches the current UI.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-store.test.ts"
```

Expected: PASS with `state.json` and `executions.json` created under the injected temp root.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/services/task-plan-store.ts" "test/task-plan-store.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: add task plan external state store"
```

## Task 3: Add Read/Save/Roadmap/Execute Routes

**Files:**

- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\task-plan.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-service.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\index.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\task-plan-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("returns task-plan state from the external store", async () => {
  const cfg = makeConfig();
  const response = createResponse();

  await handleTaskPlanState(cfg)({ query: {} } as unknown as Request, response as Response);

  expect(response.statusCode).toBe(200);
  expect(response.body.data.state.pool.items[0].title).toBe("完成需求文档初稿");
});

it("saves schedule revisions and creates execution snapshots", async () => {
  const cfg = makeConfig();
  const saveResponse = createResponse();

  await handleTaskPlanScheduleSave(cfg)({
    body: {
      items: [
        { id: "sched-1", title: "完成需求文档初稿", start: "09:00", end: "10:30", priority: "high", source: "manual", notes: "保持不变" },
      ],
      confirmed: true,
    },
  } as unknown as Request, saveResponse as Response);

  expect(saveResponse.statusCode).toBe(200);
  expect(saveResponse.body.data.schedule.confirmed).toBe(true);

  const executeResponse = createResponse();
  await handleTaskPlanExecute(cfg)({ body: {} } as unknown as Request, executeResponse as Response);
  expect(executeResponse.statusCode).toBe(200);
  expect(executeResponse.body.data.execution.id).toContain("task-plan-exec-");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-routes.test.ts"
```

Expected: FAIL because route handlers do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement route handlers and register them:

```ts
app.get("/api/task-plan/state", handleTaskPlanState(cfg));
app.get("/api/task-plan/roadmap", handleTaskPlanRoadmap(cfg));
app.put("/api/task-plan/schedule", handleTaskPlanScheduleSave(cfg));
app.post("/api/task-plan/execute", handleTaskPlanExecute(cfg));
```

Inside `task-plan-service.ts`:

```ts
export function saveTaskPlanSchedule(input: {
  storageRoot?: string;
  items: TaskPlanScheduleItem[];
  confirmed: boolean;
}): { schedule: TaskPlanState["schedule"] } {
  const state = readTaskPlanState({ storageRoot: input.storageRoot });
  const next = {
    ...state,
    schedule: {
      ...state.schedule,
      revisionId: `rev-${Date.now()}`,
      items: input.items,
      confirmed: input.confirmed,
    },
    morningFlow: {
      ...state.morningFlow,
      fineTuneDone: input.confirmed,
    },
  };
  writeTaskPlanState({ storageRoot: input.storageRoot }, next);
  return { schedule: next.schedule };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-routes.test.ts test/task-plan-store.test.ts"
```

Expected: PASS with state hydration, schedule save, roadmap response, and execution snapshot creation.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/routes/task-plan.ts" "web/server/services/task-plan-service.ts" "web/server/index.ts" "test/task-plan-routes.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: add task plan state and execution routes"
```

## Task 4: Add LLM Generation with Dedicated Agent Resolution

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-service.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\task-plan.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\task-plan-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("blocks generation when required context is missing", async () => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-plan-service-"));
  writeTaskPlanState({ storageRoot }, {
    ...createDefaultTaskPlanState(),
    voice: { transcript: "", audioPath: null, updatedAt: null },
  });

  const result = await generateTaskPlan({
    projectRoot: storageRoot,
    wikiRoot: storageRoot,
    storageRoot,
  });

  expect(result.ok).toBe(false);
  expect(result.error.code).toBe("missing-voice-input");
});

it("uses the dedicated task-plan agent runtime and persists structured schedule output", async () => {
  const provider = { complete: vi.fn(async () => JSON.stringify({
    items: [
      { id: "sched-1", title: "完成需求文档初稿", start: "09:00", end: "10:30", priority: "high", source: "llm", notes: "深度工作" },
    ],
    summary: ["先写文档，再确认逻辑"],
  })) } as unknown as LLMProvider;

  const result = await generateTaskPlan({
    projectRoot,
    wikiRoot,
    storageRoot,
    provider,
  });

  expect(result.ok).toBe(true);
  expect(result.data.schedule.items[0]?.source).toBe("llm");
  expect(result.data.schedule.generationId).toContain("gen-");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-service.test.ts"
```

Expected: FAIL because generation logic and error codes do not exist.

- [ ] **Step 3: Write minimal implementation**

Reuse the existing runtime resolver instead of inventing a second one:

```ts
const agent = readAgentConfig(projectRoot).agents.find((item) => item.id === "task-plan-assistant" && item.enabled) ?? null;
const runtimeProvider = input.provider ?? resolveAgentRuntimeProvider(projectRoot, agent, "task-plan:generate");
```

Build context from:

- persisted voice transcript
- seeded or saved task pool items from `state.pool.items`
- recent work-log excerpts from existing workspace docs

Parse strict JSON and persist:

```ts
const raw = await runtimeProvider.complete(system, [{ role: "user", content: buildTaskPlanPrompt(context) }], 1200);
const parsed = normalizeGeneratedSchedule(JSON.parse(raw));
const nextState = {
  ...state,
  schedule: {
    generationId: `gen-${Date.now()}`,
    revisionId: state.schedule.revisionId,
    items: parsed.items,
    confirmed: false,
  },
  morningFlow: {
    ...state.morningFlow,
    diaryDone: true,
    planningDone: true,
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-service.test.ts test/task-plan-routes.test.ts"
```

Expected: PASS with missing-context failure codes and successful generated schedule persistence.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/services/task-plan-service.ts" "web/server/routes/task-plan.ts" "test/task-plan-service.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: add task plan generation service"
```

## Task 5: Add Voice Transcription Intake

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\task-plan.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-service.ts`
- Reuse: `D:\Desktop\llm-wiki-compiler-main\web\server\services\transcript-service.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\task-plan-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("stores a transcribed voice recording and marks the voice step complete", async () => {
  const cfg = makeConfig();
  vi.spyOn(transcriptService, "transcribeFileWithCloudflare").mockResolvedValue({
    ok: true,
    text: "今天先完成需求文档，再确认功能逻辑。",
  });

  const response = createResponse();
  await handleTaskPlanVoice(cfg)({
    body: {
      filename: "voice.webm",
      mimeType: "audio/webm",
      audioBase64: Buffer.from("fake-audio").toString("base64"),
    },
  } as unknown as Request, response as Response);

  expect(response.statusCode).toBe(200);
  expect(response.body.data.state.voice.transcript).toContain("今天先完成需求文档");
  expect(response.body.data.state.morningFlow.voiceDone).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-routes.test.ts"
```

Expected: FAIL because `/api/task-plan/voice` is not implemented.

- [ ] **Step 3: Write minimal implementation**

Decode base64, persist audio under the external root, then call the existing transcription helper:

```ts
export async function saveTaskPlanVoice(input: {
  storageRoot?: string;
  filename: string;
  mimeType: string;
  audioBase64: string;
}): Promise<{ state: TaskPlanState }> {
  const root = ensureTaskPlanStorageRoot(input.storageRoot ?? DEFAULT_TASK_PLAN_STORAGE_ROOT);
  const audioDir = path.join(root, "audio");
  await mkdir(audioDir, { recursive: true });
  const filePath = path.join(audioDir, `${Date.now()}-${safeFileName(input.filename)}`);
  await writeFile(filePath, Buffer.from(input.audioBase64, "base64"));
  const transcript = await transcribeFileWithCloudflare({ filePath });
  if (!transcript.ok) {
    return Promise.reject(new Error(`transcription-unavailable:${transcript.error.message}`));
  }
  const state = readTaskPlanState({ storageRoot: root });
  const nextState = {
    ...state,
    voice: { transcript: transcript.text, audioPath: filePath, updatedAt: new Date().toISOString() },
    morningFlow: { ...state.morningFlow, voiceDone: true },
  };
  writeTaskPlanState({ storageRoot: root }, nextState);
  return { state: nextState };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-routes.test.ts"
```

Expected: PASS with voice transcript persisted and morning flow updated.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/routes/task-plan.ts" "web/server/services/task-plan-service.ts" "test/task-plan-routes.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: add task plan voice transcription route"
```

## Task 6: Wire the Task-Plan Frontend Buttons to the Backend

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\workspace\index.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-workspace-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("hydrates task-plan state and calls backend APIs from task-plan controls", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/task-plan/state" && (!init || init.method === undefined)) {
      return jsonResponse({
        success: true,
        data: {
          state: {
            voice: { transcript: "今天先完成需求文档，再确认功能逻辑。", audioPath: null, updatedAt: "2026-04-24T08:00:00.000Z" },
            pool: { items: [{ id: "pool-1", title: "完成需求文档初稿", priority: "high" }] },
            schedule: { generationId: "gen-1", revisionId: null, confirmed: false, items: [{ id: "sched-1", title: "完成需求文档初稿", start: "09:00", end: "10:30", priority: "high", source: "llm", notes: "" }] },
            roadmap: { view: "week", windowStart: "2026-04-21", groups: [] },
            morningFlow: { voiceDone: true, diaryDone: true, planningDone: true, fineTuneDone: false },
            lastExecutionId: null,
          },
        },
      });
    }
    if (url === "/api/task-plan/generate" && init?.method === "POST") return jsonResponse({ success: true, data: { schedule: { generationId: "gen-2", revisionId: null, confirmed: false, items: [] } } });
    if (url === "/api/task-plan/schedule" && init?.method === "PUT") return jsonResponse({ success: true, data: { schedule: { generationId: "gen-2", revisionId: "rev-2", confirmed: true, items: [] } } });
    if (url === "/api/task-plan/execute" && init?.method === "POST") return jsonResponse({ success: true, data: { execution: { id: "task-plan-exec-1", status: "ready", runId: null } } });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-plan-generate]")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-plan-fine-tune]")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-plan-execute]")?.click();
  await flush();

  expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/state");
  expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/generate", expect.objectContaining({ method: "POST" }));
  expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/schedule", expect.objectContaining({ method: "PUT" }));
  expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/execute", expect.objectContaining({ method: "POST" }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/web-workspace-page.test.ts"
```

Expected: FAIL because the task-plan page has no API wiring or `data-task-plan-*` hooks.

- [ ] **Step 3: Write minimal implementation**

Add task-plan UI state and selectors:

```ts
interface TaskPlanClientState {
  status: "idle" | "loading" | "ready" | "error";
  state: TaskPlanStateResponse | null;
  error: string | null;
}
```

Hydrate on tab switch:

```ts
if (nextTab === "task-plan" && taskPlanState.status === "idle") {
  void loadTaskPlanState();
}
```

Add button hooks in `renderTaskPlanView()`:

```ts
<button type="button" class="workspace-task-plan-poster__action workspace-task-plan-poster__action--primary" data-task-plan-voice-start>开始语音输入</button>
<button type="button" class="workspace-task-plan-poster__action" data-task-plan-generate>...</button>
<button type="button" class="workspace-task-plan-poster__fine-tune" data-task-plan-fine-tune>...</button>
<button type="button" class="workspace-task-plan-poster__control-chip workspace-task-plan-poster__control-chip--active" data-task-plan-roadmap-window="current">本周</button>
<button type="button" class="workspace-task-plan-poster__control-arrow" data-task-plan-roadmap-nav="prev">‹</button>
<button type="button" class="workspace-task-plan-poster__control-arrow" data-task-plan-roadmap-nav="next">›</button>
<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-roadmap-view="week">周视图 ⌄</button>
<button type="button" class="workspace-task-plan-poster__action workspace-task-plan-poster__action--primary" data-task-plan-execute>开始执行</button>
```

Wire fetch handlers and update rendered text from hydrated state instead of hard-coded copies.

- [ ] **Step 4: Run tests and verification**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/web-workspace-page.test.ts test/task-plan-routes.test.ts test/task-plan-service.test.ts test/task-plan-store.test.ts test/agent-config-routes.test.ts"
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npx.cmd' tsc --noEmit"
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' --prefix web run build"
```

Expected:

- all listed tests PASS
- TypeScript compile succeeds
- web bundle build succeeds

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/client/src/pages/workspace/index.ts" "test/web-workspace-page.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: wire task plan page to backend"
```

## Self-Review

- Spec coverage:
  - dedicated agent binding: Task 1 and Task 4
  - external storage root: Task 2
  - state / roadmap / schedule / execute APIs: Task 3
  - LLM generation: Task 4
  - voice transcription: Task 5
  - frontend button wiring: Task 6
- Placeholder scan:
  - no `TODO`, `TBD`, or “implement later” placeholders remain
  - task pool source is explicitly defined as seeded persisted state for this first backend phase
- Type consistency:
  - `task-plan-assistant`, `generationId`, `revisionId`, `schedule.items`, `windowStart`, `confirmed`, and `execution.id` are used consistently across tasks
