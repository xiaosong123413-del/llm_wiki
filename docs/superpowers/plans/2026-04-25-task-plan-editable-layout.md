# Task Plan Editable Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the workspace `任务计划页` into a full-height editable planning surface with direct text input, editable recent status, scrollable task/schedule cards, explicit schedule editing, and a draggable vertical split between planner and roadmap.

**Architecture:** Extend the existing `task-plan` backend slice with direct text-save and recent-status refresh endpoints, keep schedule persistence on the existing schedule route, and refactor the client task-plan view away from the artboard-scale poster model into a full-height split layout with internal card scrolling. Persist planner/roadmap split ratio locally in the browser and keep all task-plan data in the existing external storage root.

**Tech Stack:** TypeScript, Express, Vitest, DOM-rendered client workspace page, existing task-plan store/service/routes, local browser storage, existing workspace resize utilities.

---

## File Structure

**Modify:**

- `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-store.ts`
  - Add persistent recent-status text to state.
- `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-service.ts`
  - Add direct text-save and recent-status refresh service functions.
- `D:\Desktop\llm-wiki-compiler-main\web\server\routes\task-plan.ts`
  - Add text-save and status-refresh APIs.
- `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\workspace\index.ts`
  - Replace voice-file interactions with text editing, add refresh and schedule-edit state, add split-drag logic, remove artboard scaling dependency.
- `D:\Desktop\llm-wiki-compiler-main\web\client\styles.css`
  - Refactor task-plan layout to full-height split layout and add internal scroll regions.
- `D:\Desktop\llm-wiki-compiler-main\test\task-plan-store.test.ts`
  - Verify recent-status persistence.
- `D:\Desktop\llm-wiki-compiler-main\test\task-plan-service.test.ts`
  - Verify text-save and status-refresh behavior.
- `D:\Desktop\llm-wiki-compiler-main\test\task-plan-routes.test.ts`
  - Verify new APIs and request validation.
- `D:\Desktop\llm-wiki-compiler-main\test\web-workspace-page.test.ts`
  - Verify textarea-based task-plan UI, refresh, schedule edit, and split behavior.

## Task 1: Extend Task-Plan Store State for Editable Status

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-store.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\task-plan-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("persists editable recent status text in task-plan state", async () => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-plan-store-"));
  const state = await readTaskPlanState({ storageRoot });

  await writeTaskPlanState(
    {
      ...state,
      statusSummary: "Today energy is stable and deep work fits the morning window.",
    },
    { storageRoot },
  );

  const nextState = await readTaskPlanState({ storageRoot });
  expect(nextState.statusSummary).toBe("Today energy is stable and deep work fits the morning window.");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-store.test.ts"
```

Expected: FAIL because `statusSummary` is not part of the store state yet.

- [ ] **Step 3: Write the minimal implementation**

Add `statusSummary` to `TaskPlanState` and seed it in `createDefaultTaskPlanState()`:

```ts
export interface TaskPlanState {
  voice: TaskPlanVoiceState;
  statusSummary: string;
  pool: TaskPlanPoolState;
  schedule: TaskPlanScheduleState;
  roadmap: TaskPlanRoadmapState;
  morningFlow: TaskPlanMorningFlowState;
  lastExecutionId: string | null;
}
```

```ts
statusSummary:
  "最近精力较好，睡眠充足，心情平稳，专注度较高。上午效率提升明显，适合处理需要深度思考的任务；下午更适合沟通和整理类工作。",
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-store.test.ts"
```

Expected: PASS with `statusSummary` preserved across writes.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/services/task-plan-store.ts" "test/task-plan-store.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: store editable recent status in task plan"
```

## Task 2: Add Direct Text Save and Recent-Status Refresh Services

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\task-plan-service.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\task-plan-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("saves direct planning text into task-plan state", async () => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-plan-service-"));

  const result = await saveTaskPlanTextInput(
    { text: "Today I need to finish the requirement draft first." },
    { storageRoot },
  );

  expect(result.state.voice.transcript).toBe("Today I need to finish the requirement draft first.");
  expect(result.state.morningFlow.voiceDone).toBe(true);
});

it("refreshes recent status from provider output", async () => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-plan-service-"));
  await writeTaskPlanState(
    {
      ...(await readTaskPlanState({ storageRoot })),
      voice: { transcript: "Need to confirm product logic and sort user feedback.", audioPath: null, updatedAt: null },
    },
    { storageRoot },
  );

  const provider = {
    complete: vi.fn(async () => "Morning focus is strong. Use the first half of the day for writing and confirmation."),
  } as unknown as LLMProvider;

  const result = await refreshTaskPlanStatus({
    projectRoot: "D:\\Desktop\\llm-wiki-compiler-main",
    wikiRoot: "D:\\Desktop\\llm-wiki-compiler-main\\wiki",
    storageRoot,
    provider,
  });

  expect(result.state.statusSummary).toContain("Morning focus is strong");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-service.test.ts"
```

Expected: FAIL because the two new service functions do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add two focused service functions:

```ts
export async function saveTaskPlanTextInput(
  input: { text: string },
  options: TaskPlanStoreOptions = {},
): Promise<{ state: TaskPlanState }> {
  const storageRoot = resolveStorageRoot(options);
  return enqueueTaskPlanMutation(storageRoot, async () => {
    const state = await readTaskPlanState({ storageRoot });
    const nextState: TaskPlanState = {
      ...state,
      voice: {
        transcript: input.text.trim(),
        audioPath: null,
        updatedAt: new Date().toISOString(),
      },
      morningFlow: {
        ...state.morningFlow,
        voiceDone: input.text.trim().length > 0,
      },
    };
    await writeTaskPlanState(nextState, { storageRoot });
    return { state: nextState };
  });
}
```

```ts
export async function refreshTaskPlanStatus(
  input: GenerateTaskPlanInput,
): Promise<{ state: TaskPlanState }> {
  const storageRoot = resolveStorageRoot(input);
  const state = await readTaskPlanState({ storageRoot });
  const voiceTranscript = state.voice.transcript.trim();
  if (!voiceTranscript) {
    throw new TaskPlanServiceError("missing_text_input", "planning text is required", 400);
  }
  const diaryContext = await readPlanningContext(input.projectRoot, input.wikiRoot);
  if (!diaryContext) {
    throw new TaskPlanServiceError("missing_diary_context", "recent diary or work-log context is required", 400);
  }
  const provider = input.provider ?? await resolveTaskPlanProvider(input.projectRoot);
  if (!provider) {
    throw new TaskPlanServiceError("task-plan-agent-not-found", "task-plan-assistant is not configured", 503);
  }
  const text = (await provider.complete(
    "Return only the recent status summary text.",
    buildTaskPlanMessages(voiceTranscript, diaryContext, state.pool.items),
    500,
  )).trim();
  return enqueueTaskPlanMutation(storageRoot, async () => {
    const latest = await readTaskPlanState({ storageRoot });
    const nextState: TaskPlanState = { ...latest, statusSummary: text };
    await writeTaskPlanState(nextState, { storageRoot });
    return { state: nextState };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-service.test.ts"
```

Expected: PASS with direct text save and refresh behavior covered.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/services/task-plan-service.ts" "test/task-plan-service.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: add task plan text save and status refresh"
```

## Task 3: Expose Text-Save and Status-Refresh APIs

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\task-plan.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\task-plan-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("saves direct planning text through the task-plan route", async () => {
  const req = { body: { text: "Finish the draft before lunch." } } as Request;
  const res = createResponse();

  await handleTaskPlanTextSave(makeConfig(), makeOptions())(req, res as Response);

  expect(res.statusCode).toBe(200);
  expect(res.body.data.state.voice.transcript).toBe("Finish the draft before lunch.");
});

it("refreshes recent status through the task-plan route", async () => {
  const res = createResponse();

  await handleTaskPlanStatusRefresh(makeConfig(), makeOptions())({ body: {} } as Request, res as Response);

  expect(res.statusCode).toBe(200);
  expect(res.body.data.state.statusSummary).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-routes.test.ts"
```

Expected: FAIL because the new route handlers and route registration do not exist.

- [ ] **Step 3: Write the minimal implementation**

Register two new endpoints:

```ts
app.put("/api/task-plan/text", handleTaskPlanTextSave(cfg, options));
app.post("/api/task-plan/status/refresh", handleTaskPlanStatusRefresh(cfg, options));
```

Add validation helpers:

```ts
function parseTextInput(input: unknown): { text: string } {
  if (!isRecord(input) || typeof input.text !== "string") {
    throw new TaskPlanServiceError("invalid_request", "text is required", 400);
  }
  return { text: input.text.trim() };
}
```

Wire handlers to the new service functions and keep route errors on the existing `TaskPlanServiceError` path.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-routes.test.ts"
```

Expected: PASS with text-save and status-refresh endpoints returning updated state.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/routes/task-plan.ts" "test/task-plan-routes.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: expose task plan text and status routes"
```

## Task 4: Rewrite Task-Plan Frontend State and Interaction Tests

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\test\web-workspace-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("renders editable task-plan controls and sends text/status actions to backend", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({
        success: true,
        data: {
          state: createMockTaskPlanFixture().state,
        },
      });
    }
    if (url === "/api/task-plan/text" && init?.method === "PUT") {
      return jsonResponse({
        success: true,
        data: {
          state: {
            ...createMockTaskPlanFixture().state,
            voice: {
              transcript: "Typed planning text",
              audioPath: null,
              updatedAt: "2026-04-25T01:00:00.000Z",
            },
          },
        },
      });
    }
    if (url === "/api/task-plan/status/refresh" && init?.method === "POST") {
      return jsonResponse({
        success: true,
        data: {
          state: {
            ...createMockTaskPlanFixture().state,
            statusSummary: "Refreshed recent status",
          },
        },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
  await flush();

  const input = page.querySelector<HTMLTextAreaElement>("[data-task-plan-textarea='input']");
  const status = page.querySelector<HTMLTextAreaElement>("[data-task-plan-textarea='status']");
  expect(input).not.toBeNull();
  expect(status).not.toBeNull();

  input!.value = "Typed planning text";
  input!.dispatchEvent(new Event("input", { bubbles: true }));
  page.querySelector<HTMLButtonElement>("[data-task-plan-save-input]")?.click();
  await flush();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/task-plan/text",
    expect.objectContaining({ method: "PUT" }),
  );

  page.querySelector<HTMLButtonElement>("[data-task-plan-refresh-status]")?.click();
  await flush();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/task-plan/status/refresh",
    expect.objectContaining({ method: "POST" }),
  );
  expect(page.textContent).toContain("Refreshed recent status");
});

it("renders scroll regions and supports schedule edit mode", async () => {
  installTaskPlanFetchMock();
  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
  await flush();

  expect(page.querySelector("[data-task-plan-scroll='pool']")).not.toBeNull();
  expect(page.querySelector("[data-task-plan-scroll='schedule']")).not.toBeNull();
  page.querySelector<HTMLButtonElement>("[data-task-plan-edit-schedule]")?.click();
  expect(page.querySelector("[data-task-plan-schedule-editor]")).not.toBeNull();
  expect(page.querySelector("[data-task-plan-split-handle]")).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/web-workspace-page.test.ts"
```

Expected: FAIL because the current page still renders voice/file controls and poster markup.

- [ ] **Step 3: Keep the failing assertions and remove outdated voice-file expectations**

Update the existing task-plan test block so it stops asserting:

```ts
"[data-task-plan-voice-file]"
"[data-task-plan-voice-trigger]"
```

and instead asserts the new textarea/save/refresh/edit controls shown above.

- [ ] **Step 4: Run test to verify it still fails for the right reason**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/web-workspace-page.test.ts"
```

Expected: FAIL because the UI has not been rewritten yet, not because the test setup is broken.

- [ ] **Step 5: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "test/web-workspace-page.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "test: define editable task plan workspace behavior"
```

## Task 5: Implement Editable Task-Plan Client State and Layout

**Files:**

- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\workspace\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\styles.css`

- [ ] **Step 1: Add client state for editable text, editable status, schedule edit mode, and split ratio**

Add explicit fields to `TaskPlanViewState`:

```ts
interface TaskPlanViewState {
  status: TaskPlanLoadStatus;
  state: TaskPlanState | null;
  roadmapWindow: TaskPlanRoadmapWindow;
  roadmapView: TaskPlanRoadmapView;
  busyAction: "save-input" | "refresh-status" | "generate" | "save" | "roadmap" | "execute" | null;
  feedback: string | null;
  error: string | null;
  inputDraft: string;
  statusDraft: string;
  scheduleEditMode: boolean;
  scheduleDraft: TaskPlanScheduleItem[];
  splitRatio: number;
}
```

Initialize `inputDraft`, `statusDraft`, and `scheduleDraft` from loaded state in `loadTaskPlanState()`.

- [ ] **Step 2: Replace voice-file flow with text-save and status-refresh actions**

Add client helpers:

```ts
async function putTaskPlanText(text: string): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/text", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = (await response.json()) as TaskPlanStatePayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "任务输入保存失败"));
  }
  return payload.data.state;
}

async function postTaskPlanStatusRefresh(): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/status/refresh", { method: "POST" });
  const payload = (await response.json()) as TaskPlanStatePayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "近日状态刷新失败"));
  }
  return payload.data.state;
}
```

Remove:

```ts
selectTaskPlanVoiceFile
postTaskPlanVoice
readFileAsBase64
data-task-plan-voice-trigger listeners
data-task-plan-voice-file listeners
```

- [ ] **Step 3: Rewrite `renderTaskPlanView()` to full-height split layout**

Render:

```ts
<section class="workspace-view workspace-view--task-plan" data-workspace-view="task-plan">
  <div class="workspace-task-plan-shell" style="--task-plan-split:${viewState.splitRatio};">
    <section class="workspace-task-plan-top">...</section>
    <div class="workspace-task-plan-split-handle" data-task-plan-split-handle></div>
    <section class="workspace-task-plan-bottom">...</section>
  </div>
</section>
```

Inside the top flow:

- first card uses `<textarea data-task-plan-textarea="input">`
- second card uses `<textarea data-task-plan-textarea="status">`
- third card wraps the pool list in `<div data-task-plan-scroll="pool">`
- fourth card wraps rows in `<div data-task-plan-scroll="schedule">`
- fourth card header includes `<button data-task-plan-edit-schedule>`

- [ ] **Step 4: Add split-drag and local persistence**

Use local storage with a single key:

```ts
const TASK_PLAN_SPLIT_STORAGE_KEY = "workspace.taskPlan.splitRatio";
```

Attach pointer drag to `[data-task-plan-split-handle]` and clamp ratio:

```ts
const nextRatio = Math.min(0.72, Math.max(0.35, candidateRatio));
```

Persist on drag end and restore during `createDefaultTaskPlanViewState()`.

- [ ] **Step 5: Add styles for full-height occupancy, internal scroll, and editable schedule**

In `styles.css`, replace the artboard assumptions with:

```css
.workspace-view--task-plan {
  min-height: 100%;
  height: 100%;
}

.workspace-task-plan-shell {
  height: 100%;
  display: grid;
  grid-template-rows: minmax(360px, calc(var(--task-plan-split, 0.56) * 100%)) 14px minmax(260px, 1fr);
}

.workspace-task-plan-scroll {
  min-height: 0;
  overflow-y: auto;
}
```

Add separate selectors for:

- editable textareas
- refresh/edit buttons
- schedule editor rows
- split handle hover/drag state
- bottom roadmap fill behavior

- [ ] **Step 6: Run the workspace tests to verify the new UI passes**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/web-workspace-page.test.ts"
```

Expected: PASS with textarea/save/refresh/scroll/split behavior covered.

- [ ] **Step 7: Commit**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/client/src/pages/workspace/index.ts" "web/client/styles.css" "test/web-workspace-page.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: make task plan workspace editable"
```

## Task 6: Verify the Full Feature Slice

**Files:**

- Modify: none

- [ ] **Step 1: Run backend task-plan tests**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/task-plan-store.test.ts test/task-plan-service.test.ts test/task-plan-routes.test.ts"
```

Expected: PASS with all backend behavior green.

- [ ] **Step 2: Run workspace page regression**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/web-workspace-page.test.ts"
```

Expected: PASS with the updated task-plan UI behavior.

- [ ] **Step 3: Run TypeScript verification**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npx.cmd' tsc --noEmit"
```

Expected: PASS with no type errors.

- [ ] **Step 4: Run the web build**

Run:

```bash
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' --prefix web run build"
```

Expected: PASS and emit a new client bundle in `web/dist/client`.

- [ ] **Step 5: Commit the final verified slice**

```bash
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" add -- "web/server/services/task-plan-store.ts" "web/server/services/task-plan-service.ts" "web/server/routes/task-plan.ts" "web/client/src/pages/workspace/index.ts" "web/client/styles.css" "test/task-plan-store.test.ts" "test/task-plan-service.test.ts" "test/task-plan-routes.test.ts" "test/web-workspace-page.test.ts"
rtk proxy git -C "D:\Desktop\llm-wiki-compiler-main" commit -m "feat: deliver editable task plan workspace"
```

