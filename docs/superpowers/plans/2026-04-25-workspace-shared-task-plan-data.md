# Workspace Shared Task-Plan Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `项目推进页` and `任务池页` consume the same persisted `schedule` and `pool` data already used by `任务计划页`.

**Architecture:** Keep `TaskPlanState` as the only source of truth. Extend the existing workspace page runtime so `project-progress`, `task-plan`, and `task-pool` all read the same `/api/task-plan/state` payload, while `task-plan` and `task-pool` both write pool changes through `/api/task-plan/pool`. `项目推进页` remains read-only and only renders confirmed schedule rows.

**Tech Stack:** TypeScript, DOM-string rendering in `web/client/src/pages/workspace/index.ts`, Vitest + jsdom, shared workspace CSS in `web/client/styles.css`

---

## File Structure

**Modify**

- `web/client/src/pages/workspace/index.ts`
  Responsibility: shared workspace task-plan state loading, `项目推进页` schedule rendering, `任务池页` rendering, and pool-edit UI reuse.
- `web/client/styles.css`
  Responsibility: `任务池页` management layout and `项目推进页` schedule empty-state styling.
- `test/web-workspace-page.test.ts`
  Responsibility: jsdom coverage for shared schedule visibility and shared task-pool editing.
- `docs/project-log.md`
  Responsibility: append the completed user-visible change to the timeline.

No new runtime files are needed for this change.

### Task 1: Shared Confirmed Schedule On Project Progress Page

**Files:**
- Modify: `web/client/src/pages/workspace/index.ts:309-336`
- Modify: `web/client/src/pages/workspace/index.ts:1311-1460`
- Test: `test/web-workspace-page.test.ts:1-120`

- [ ] **Step 1: Write the failing tests**

Add these tests near the existing workspace page smoke tests in `test/web-workspace-page.test.ts`:

```ts
it("renders the confirmed shared schedule on the project progress page", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.schedule = {
    generationId: "task-plan-generation-confirmed",
    revisionId: "schedule-revision-confirmed",
    confirmed: true,
    items: [
      { id: "schedule-confirmed-1", title: "来自后端的正式日程 A", startTime: "09:00", priority: "high" },
      { id: "schedule-confirmed-2", title: "来自后端的正式日程 B", startTime: "14:30", priority: "mid" },
    ],
  };

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  await flush();

  expect(page.querySelector("[data-workspace-view='project-progress']")).not.toBeNull();
  expect(page.querySelector("[data-project-progress-schedule-list]")).not.toBeNull();
  expect(page.textContent).toContain("来自后端的正式日程 A");
  expect(page.textContent).toContain("来自后端的正式日程 B");
  expect(page.querySelector("[data-project-progress-schedule-empty]")).toBeNull();
});

it("shows an empty state on the project progress page when the shared schedule is not confirmed", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.schedule = {
    ...taskPlan.state.schedule,
    confirmed: false,
    items: [
      { id: "schedule-draft-1", title: "草稿日程不应出现在项目推进页", startTime: "09:00", priority: "high" },
    ],
  };

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  await flush();

  expect(page.querySelector("[data-project-progress-schedule-empty]")).not.toBeNull();
  expect(page.textContent).toContain("今日正式日程尚未确认，请先到任务计划页确认日程。");
  expect(page.textContent).not.toContain("草稿日程不应出现在项目推进页");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "renders the confirmed shared schedule on the project progress page"
npx vitest run test/web-workspace-page.test.ts -t "shows an empty state on the project progress page when the shared schedule is not confirmed"
```

Expected:

- both tests fail
- the first failure shows that `项目推进页` never renders backend-confirmed schedule rows
- the second failure shows that the page still renders the old hard-coded schedule instead of the empty state

- [ ] **Step 3: Write the minimal implementation**

In `web/client/src/pages/workspace/index.ts`, make the workspace tabs that depend on task-plan state explicit, pass `taskPlanState` into `renderProjectProgressView()`, and replace the hard-coded schedule list with a confirmed-only renderer.

Use this shape:

```ts
function tabNeedsTaskPlanState(tab: WorkspaceTab): boolean {
  return tab === "project-progress" || tab === "task-plan" || tab === "task-pool";
}

function renderWorkspaceView(
  tab: WorkspaceTab,
  workspaceDocsState: WorkspaceDocsState,
  options: {
    isEditing: boolean;
    isOutlineCollapsed: boolean;
    expandedDomains: ReadonlySet<string>;
    draftHtml: string;
    searchQuery: string;
    taskPlanState?: TaskPlanViewState;
    toolboxHtml?: string;
  },
): string {
  switch (tab) {
    case "task-plan":
      return renderTaskPlanView(options.taskPlanState ?? createDefaultTaskPlanViewState());
    case "task-pool":
      return renderTaskPoolView(options.taskPlanState ?? createDefaultTaskPlanViewState());
    case "toolbox":
      return options.toolboxHtml ?? "";
    case "work-log":
      return renderWorkLogView(workspaceDocsState, options);
    case "project-progress":
    default:
      return renderProjectProgressView(options.taskPlanState ?? createDefaultTaskPlanViewState());
  }
}

function renderProjectProgressSchedule(viewState: TaskPlanViewState): string {
  const schedule = viewState.state?.schedule ?? null;
  const confirmedItems = schedule?.confirmed ? schedule.items : [];
  if (confirmedItems.length === 0) {
    return `
      <div class="workspace-empty-card" data-project-progress-schedule-empty>
        <strong>今日正式日程尚未确认，请先到任务计划页确认日程。</strong>
        <p>任务计划页确认后的正式版时间表会自动同步到这里。</p>
      </div>
    `;
  }

  return `
    <div class="workspace-list" data-project-progress-schedule-list>
      ${confirmedItems.map((item) => renderScheduleItem(
        item.title,
        TASK_PLAN_PRIORITY_LABELS[item.priority],
        item.startTime,
      )).join("")}
    </div>
  `;
}

function renderProjectProgressView(viewState: TaskPlanViewState): string {
  return `
    <section class="workspace-view workspace-view--project-progress" data-workspace-view="project-progress">
      <div class="workspace-grid workspace-grid--project-progress">
        <section class="workspace-panel workspace-panel--todo">
          <header class="workspace-panel__header">
            <div><div class="eyebrow">TODAY</div><h2>今日时间表</h2></div>
            <button type="button" class="icon-btn" aria-label="更多">${renderIcon("search", { size: 16 })}</button>
          </header>
          <button type="button" class="workspace-page__action workspace-page__action--ghost">${renderIcon("plus", { size: 16 })}<span>添加任务</span></button>
          ${renderProjectProgressSchedule(viewState)}
          <footer class="workspace-panel__footer"><span>最近同步：5 分钟前</span><button type="button" class="icon-btn" aria-label="刷新">${renderIcon("refresh-cw", { size: 16 })}</button></footer>
        </section>
        <!-- keep the rest of the existing project-progress markup unchanged -->
      </div>
    </section>
  `;
}
```

Update the render trigger near the bottom of `renderWorkspacePage()`:

```ts
if (tabNeedsTaskPlanState(activeTab) && taskPlanState.status === "idle") {
  ensureTaskPlanLoaded();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "renders the confirmed shared schedule on the project progress page"
npx vitest run test/web-workspace-page.test.ts -t "shows an empty state on the project progress page when the shared schedule is not confirmed"
```

Expected:

- both tests pass
- no existing workspace page assertions regress

- [ ] **Step 5: Commit**

```bash
git add test/web-workspace-page.test.ts web/client/src/pages/workspace/index.ts
git commit -m "feat: share confirmed task-plan schedule with project progress"
```

### Task 2: Replace The Task Pool Placeholder With A Shared Editable Page

**Files:**
- Modify: `web/client/src/pages/workspace/index.ts:464-544`
- Modify: `web/client/src/pages/workspace/index.ts:1542-1594`
- Modify: `web/client/src/pages/workspace/index.ts:1722-1750`
- Modify: `web/client/styles.css:5986-6295`
- Test: `test/web-workspace-page.test.ts:68-120`

- [ ] **Step 1: Write the failing tests**

Replace the placeholder test and add a save-path test in `test/web-workspace-page.test.ts`:

```ts
it("renders shared pool items on the task pool page", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.pool.items = [
    { id: "pool-shared-1", title: "共享任务池任务 1", priority: "high", source: "文字输入" },
    { id: "pool-shared-2", title: "共享任务池任务 2", priority: "mid", source: "AI 生成" },
  ];

  const page = renderWorkspacePage();
  document.body.appendChild(page);

  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();

  expect(page.querySelector("[data-workspace-view='task-pool']")).not.toBeNull();
  expect(page.textContent).toContain("共享任务池任务 1");
  expect(page.textContent).toContain("共享任务池任务 2");
  expect(page.textContent).not.toContain("后续会在这里接入");
});

it("saves shared pool edits from the task pool page", async () => {
  const taskPlan = createMockTaskPlanFixture();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({ success: true, data: { state: taskPlan.state } });
    }
    if (url === "/api/task-plan/pool" && init?.method === "PUT") {
      const payload = JSON.parse(String(init.body)) as {
        items: Array<{ id: string; title: string; priority: MockTaskPlanPriority; source: MockTaskPlanSource }>;
      };
      taskPlan.state = {
        ...taskPlan.state,
        pool: {
          items: payload.items,
        },
      };
      return jsonResponse({ success: true, data: { state: taskPlan.state } });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const page = renderWorkspacePage();
  document.body.appendChild(page);

  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();

  const input = page.querySelector<HTMLInputElement>("[data-task-plan-pool-title-input='pool-1']")!;
  input.value = "任务池页改过的共享标题";
  input.dispatchEvent(new Event("input", { bubbles: true }));

  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
  await flush();

  expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/pool", expect.objectContaining({ method: "PUT" }));
  expect(page.textContent).toContain("任务池页改过的共享标题");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "renders shared pool items on the task pool page"
npx vitest run test/web-workspace-page.test.ts -t "saves shared pool edits from the task pool page"
```

Expected:

- the first test fails because `任务池页` is still a placeholder
- the second test fails because the page does not render pool edit controls at all

- [ ] **Step 3: Write the minimal implementation**

Keep the existing pool draft handlers and save path. Reuse them by rendering `任务池页` with the same `data-task-plan-pool-*` attributes already used inside `任务计划页`.

Extract a pool-row helper and use it in both pages:

```ts
function renderTaskPlanPoolRows(items: readonly TaskPlanPoolItem[], editMode: boolean): string {
  return items.map((item) => `
    ${editMode
      ? `
        <div class="workspace-task-plan-poster__pool-row workspace-task-plan-poster__pool-row--edit" data-task-plan-pool-row="${escapeHtml(item.id)}">
          <input class="workspace-task-plan-poster__timeline-input" data-task-plan-pool-title-input="${escapeHtml(item.id)}" value="${escapeHtml(item.title)}" />
          <select class="workspace-task-plan-poster__timeline-select" data-task-plan-pool-source-input="${escapeHtml(item.id)}">
            ${TASK_PLAN_SOURCE_LABELS.filter((source) => source !== "全部").map((source) => `
              <option value="${source}" ${item.source === source ? "selected" : ""}>${source}</option>
            `).join("")}
          </select>
          <select class="workspace-task-plan-poster__timeline-select" data-task-plan-pool-priority-input="${escapeHtml(item.id)}">
            ${(["high", "mid", "low", "cool", "neutral"] as const).map((priority) => `
              <option value="${priority}" ${item.priority === priority ? "selected" : ""}>${TASK_PLAN_PRIORITY_LABELS[priority]}</option>
            `).join("")}
          </select>
          <button type="button" class="workspace-task-plan-poster__timeline-remove" data-task-plan-pool-remove="${escapeHtml(item.id)}">删除</button>
        </div>
      `
      : `
        <div class="workspace-task-plan-poster__pool-row">
          <span class="workspace-task-plan-poster__pool-caret">▸</span>
          <span class="workspace-task-plan-poster__pool-text">${escapeHtml(item.title)}</span>
          <span class="workspace-task-plan-poster__pool-meta">
            <span class="workspace-task-plan-poster__source-pill">${escapeHtml(item.source)}</span>
            <span class="workspace-task-plan-poster__pill workspace-task-plan-poster__pill--${item.priority}">${TASK_PLAN_PRIORITY_LABELS[item.priority]}</span>
          </span>
        </div>
      `}
  `).join("");
}

function renderTaskPoolView(viewState: TaskPlanViewState): string {
  if (viewState.status === "loading" && !viewState.state) {
    return `
      <section class="workspace-view workspace-view--task-pool" data-workspace-view="task-pool">
        <section class="workspace-panel workspace-panel--task-pool">
          <div class="eyebrow">TASK POOL</div>
          <h2>任务池</h2>
          <p class="workspace-page__subtitle">正在读取共享任务池...</p>
        </section>
      </section>
    `;
  }

  if (viewState.status === "error") {
    return `
      <section class="workspace-view workspace-view--task-pool" data-workspace-view="task-pool">
        <section class="workspace-panel workspace-panel--task-pool">
          <div class="eyebrow">TASK POOL</div>
          <h2>任务池</h2>
          <p class="workspace-page__subtitle">${escapeHtml(viewState.error ?? "任务池读取失败")}</p>
        </section>
      </section>
    `;
  }

  const persistedItems = viewState.state?.pool.items ?? [];
  const visibleItems = viewState.poolEditMode
    ? viewState.poolDraft
    : persistedItems.filter((item) => viewState.poolFilter === "全部" || item.source === viewState.poolFilter);

  return `
    <section class="workspace-view workspace-view--task-pool" data-workspace-view="task-pool">
      <section class="workspace-panel workspace-panel--task-pool">
        <header class="workspace-panel__header">
          <div><div class="eyebrow">TASK POOL</div><h2>任务池</h2></div>
          <div class="workspace-task-pool__actions">
            ${viewState.poolEditMode ? '<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-add>新增</button>' : ""}
            ${viewState.poolEditMode ? `<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-save ${viewState.busyAction === "pool" ? "disabled" : ""}>保存</button>` : ""}
            <button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-edit-toggle>${viewState.poolEditMode ? "取消" : "编辑"}</button>
          </div>
        </header>
        <p class="workspace-page__subtitle">这里直接编辑与任务计划页共享的任务池数据。</p>
        <div class="workspace-task-plan-poster__pool-filters">
          ${TASK_PLAN_SOURCE_LABELS.map((source) => `
            <button
              type="button"
              class="workspace-task-plan-poster__pool-filter${viewState.poolFilter === source ? " is-active" : ""}"
              data-task-plan-pool-filter="${source}"
            >${source}</button>
          `).join("")}
        </div>
        <div class="workspace-task-pool__list">
          ${renderTaskPlanPoolRows(visibleItems, viewState.poolEditMode)}
        </div>
      </section>
    </section>
  `;
}
```

Add minimal CSS in `web/client/styles.css`:

```css
.workspace-panel--task-pool {
  display: grid;
  gap: 16px;
  align-content: start;
}

.workspace-task-pool__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.workspace-task-pool__list {
  display: grid;
  gap: 8px;
  align-content: start;
}
```

Also replace the inline task-plan pool row mapping in `renderTaskPlanView()` with:

```ts
${renderTaskPlanPoolRows(poolItems, viewState.poolEditMode)}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "renders shared pool items on the task pool page"
npx vitest run test/web-workspace-page.test.ts -t "saves shared pool edits from the task pool page"
```

Expected:

- both tests pass
- the task pool page renders real shared data
- saving from `任务池页` calls the existing `/api/task-plan/pool` route

- [ ] **Step 5: Commit**

```bash
git add test/web-workspace-page.test.ts web/client/src/pages/workspace/index.ts web/client/styles.css
git commit -m "feat: share task-plan pool data with task pool page"
```

### Task 3: Document The Behavior Change And Run Verification

**Files:**
- Modify: `docs/project-log.md`
- Verify: `test/web-workspace-page.test.ts`
- Verify: `web/client/src/pages/workspace/index.ts`
- Verify: `web/client/styles.css`

- [ ] **Step 1: Append the project log entry**

Add a top-of-timeline entry to `docs/project-log.md` in the same style as the existing timeline section:

```md
### [2026-04-25 21:05] 工作台三页共用 task-plan 日程与任务池

- 修改内容：`项目推进页` 的 `今日时间表` 不再使用硬编码演示数据，改为只读展示 `任务计划页` 已确认的正式版日程；未确认时显示明确空状态。
- 修改内容：`任务池页` 不再是占位页，改为直接读取并编辑与 `任务计划页` 共用的 `pool.items`，保存继续走现有 `/api/task-plan/pool`。
- 影响范围：工作台 `project-progress / task-plan / task-pool` 三页的数据一致性、对应 workspace 页面测试。
```

- [ ] **Step 2: Run the focused workspace page regression file**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts
```

Expected:

- the workspace page file passes
- the new project-progress and task-pool tests pass alongside the existing task-plan tests

- [ ] **Step 3: Run TypeScript verification**

Run:

```bash
npx tsc --noEmit
```

Expected:

- exit code `0`
- no TypeScript errors

- [ ] **Step 4: Run the build**

Run:

```bash
npm run build
```

Expected:

- exit code `0`
- build completes without introducing workspace-page build errors

- [ ] **Step 5: Run the repo-level commands required by the project rules and record their current status**

Run:

```bash
npm test
fallow
```

Expected:

- capture whether the current pre-existing unrelated failures in `clip-*`, `cloudflare-service-adapters`, `douyin-sync-service`, `provider-factory`, and repo-wide `fallow` health remain unchanged
- if new workspace-related failures appear, stop and fix them before proceeding
- if only the known unrelated failures remain, report them explicitly instead of claiming a clean full-suite result

- [ ] **Step 6: Commit**

```bash
git add docs/project-log.md test/web-workspace-page.test.ts web/client/src/pages/workspace/index.ts web/client/styles.css
git commit -m "docs: log shared workspace task-plan data behavior"
```

## Plan Self-Review

- Spec coverage: the plan covers confirmed schedule sync into `项目推进页`, shared pool editing in `任务池页`, reuse of existing task-plan persistence routes, focused tests, and project-log maintenance.
- Placeholder scan: no `TODO`, `TBD`, or implicit “write tests later” steps remain.
- Type consistency: the plan uses the existing `TaskPlanViewState`, `TaskPlanPoolItem`, `TaskPlanScheduleState`, `TaskPlanPriority`, and `TaskPlanTaskSource` names consistently across tasks.
