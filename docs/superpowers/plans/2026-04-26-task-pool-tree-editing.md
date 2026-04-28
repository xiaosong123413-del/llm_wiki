# Task Pool Tree Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workspace `任务池` `树状图` view directly editable with inline node editing, `Enter`-based creation, task drag-to-project re-linking, wheel and pinch zoom, delete-without-task-loss semantics, and explicit save back to the shared task pool.

**Architecture:** Keep `TaskPlanPoolItem[]` as the only persisted source of truth and reuse the existing shared pool draft and save flow. Extract the current tree-specific rendering and mutation logic out of the oversized workspace page into focused helper modules, then wire selection, editing, drag, drop, zoom, and save behavior through the existing workspace page runtime.

**Tech Stack:** TypeScript, DOM-string rendering, browser drag-and-drop APIs, wheel and gesture-style input handling, Vitest + jsdom, shared workspace CSS

---

## File Structure

**Create**

- `web/client/src/pages/workspace/task-pool-tree-model.ts`
  Responsibility: tree-level types, hierarchy building, draft mutations for rename, add, delete, and drag re-linking.
- `web/client/src/pages/workspace/task-pool-tree-view.ts`
  Responsibility: render the editable task-pool tree layout, sidebar, nodes, and interactive data attributes.

**Modify**

- `web/client/src/pages/workspace/index.ts`
  Responsibility: own page state, enter tree edit mode, bind tree events, reuse shared pool save and cancel flow, and attach zoom handling to the tree canvas.
- `web/client/styles.css`
  Responsibility: selected-node state, inline edit inputs, draggable task affordances, project drop-target styling, unsaved-draft treatment, and tree zoom polish.
- `test/web-workspace-page.test.ts`
  Responsibility: jsdom coverage for tree editing, delete semantics, drag re-linking, and zoom state updates.
- `docs/project-log.md`
  Responsibility: record the completed user-visible tree-editing workflow.

No backend file changes are needed because the persisted shape remains `TaskPlanPoolItem[]` and the existing pool save route already accepts full item arrays.

### Task 1: Extract Tree Rendering And Mutation Logic Into Focused Helpers

**Files:**
- Create: `web/client/src/pages/workspace/task-pool-tree-model.ts`
- Create: `web/client/src/pages/workspace/task-pool-tree-view.ts`
- Modify: `web/client/src/pages/workspace/index.ts:84-177`
- Modify: `web/client/src/pages/workspace/index.ts:2642-2783`
- Test: `test/web-workspace-page.test.ts:387-439`

- [ ] **Step 1: Write the failing import-and-render test**

Add this test next to the existing tree-view smoke test in `test/web-workspace-page.test.ts`:

```ts
it("renders editable tree controls when the shared pool editor is enabled in tree mode", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.pool.items = [
    {
      id: "pool-1",
      title: "完成任务池树状图视图",
      priority: "high",
      source: "文字输入",
      domain: "产品设计",
      project: "工作台改版",
    },
  ];

  const page = renderWorkspacePage();
  document.body.appendChild(page);

  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
  await flush();

  expect(page.querySelector("[data-task-pool-tree-canvas]")).not.toBeNull();
  expect(page.querySelector("[data-task-pool-tree-root]")).not.toBeNull();
  expect(page.querySelector("[data-task-pool-tree-node-type='project']")).not.toBeNull();
  expect(page.querySelector("[data-task-pool-tree-save-indicator]")).not.toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "renders editable tree controls when the shared pool editor is enabled in tree mode"
```

Expected:

- the test fails
- current tree markup does not expose editable node data attributes or save indicator markup

- [ ] **Step 3: Create the shared tree model helper**

Create `web/client/src/pages/workspace/task-pool-tree-model.ts` with this foundation:

```ts
/**
 * Shared draft mutation and hierarchy helpers for the editable task-pool tree.
 */
import type { TaskPlanPoolItem } from "./index.js";

export type TaskPoolTreeLevel = "domain" | "project" | "task";
export type TaskPoolTreeNodeType = "domain" | "project" | "task";

export interface TaskPoolTreeNodeIdentity {
  readonly type: TaskPoolTreeNodeType;
  readonly domain: string;
  readonly project: string;
  readonly taskId: string | null;
}

export interface TaskPoolTreeTaskNode {
  readonly id: string;
  readonly title: string;
  readonly domain: string;
  readonly project: string;
}

export interface TaskPoolTreeProjectNode {
  readonly label: string;
  readonly domain: string;
  readonly tasks: readonly TaskPoolTreeTaskNode[];
}

export interface TaskPoolTreeDomainNode {
  readonly label: string;
  readonly projects: readonly TaskPoolTreeProjectNode[];
}

export const TASK_POOL_UNGROUPED_DOMAIN = "未归类";
export const TASK_POOL_UNGROUPED_PROJECT = "待分组";

export function getTaskPoolDomainName(item: TaskPlanPoolItem): string {
  return item.domain?.trim() || TASK_POOL_UNGROUPED_DOMAIN;
}

export function getTaskPoolProjectName(item: TaskPlanPoolItem): string {
  return item.project?.trim() || TASK_POOL_UNGROUPED_PROJECT;
}

export function buildTaskPoolTreeHierarchy(items: readonly TaskPlanPoolItem[]): TaskPoolTreeDomainNode[] {
  const domainMap = new Map<string, Map<string, TaskPoolTreeTaskNode[]>>();
  for (const item of items) {
    const domain = getTaskPoolDomainName(item);
    const project = getTaskPoolProjectName(item);
    const projectMap = domainMap.get(domain) ?? new Map<string, TaskPoolTreeTaskNode[]>();
    const tasks = projectMap.get(project) ?? [];
    tasks.push({
      id: item.id,
      title: item.title,
      domain,
      project,
    });
    projectMap.set(project, tasks);
    domainMap.set(domain, projectMap);
  }
  return Array.from(domainMap.entries()).map(([label, projects]) => ({
    label,
    projects: Array.from(projects.entries()).map(([projectLabel, tasks]) => ({
      label: projectLabel,
      domain: label,
      tasks,
    })),
  }));
}
```

- [ ] **Step 4: Create the shared tree view helper**

Create `web/client/src/pages/workspace/task-pool-tree-view.ts` with the render surface extracted from `index.ts`:

```ts
/**
 * Markup helpers for the editable task-pool tree view.
 */
import type { TaskPlanPoolItem } from "./index.js";
import {
  buildTaskPoolTreeHierarchy,
  type TaskPoolTreeLevel,
  type TaskPoolTreeNodeIdentity,
} from "./task-pool-tree-model.js";

export interface TaskPoolTreeRenderState {
  readonly level: TaskPoolTreeLevel;
  readonly zoomPercent: number;
  readonly isSidebarCollapsed: boolean;
  readonly selectedOptions: readonly string[];
  readonly selectedNode: TaskPoolTreeNodeIdentity | null;
  readonly editingNode: TaskPoolTreeNodeIdentity | null;
  readonly editValue: string;
  readonly draggingTaskId: string | null;
  readonly dropProjectKey: string | null;
  readonly dirty: boolean;
}

export function renderTaskPoolTreeLayout(
  items: readonly TaskPlanPoolItem[],
  renderState: TaskPoolTreeRenderState,
  optionsHtml: string,
): string {
  return `
    <section class="workspace-task-pool-tree" data-task-pool-tree-layout>
      <aside class="workspace-task-pool-tree__sidebar${renderState.isSidebarCollapsed ? " is-collapsed" : ""}" data-task-pool-tree-sidebar>
        <div class="workspace-task-pool-tree__sidebar-head">
          <span>筛选</span>
          <button type="button" class="workspace-task-pool-tree__toggle" data-task-pool-tree-sidebar-toggle>${renderState.isSidebarCollapsed ? "›" : "‹"}</button>
        </div>
        <div class="workspace-task-pool-tree__sidebar-body">${optionsHtml}</div>
      </aside>
      <div class="workspace-task-pool-tree__resize panel-resize-handle" data-task-pool-tree-resize ${renderState.isSidebarCollapsed ? "hidden" : ""}></div>
      <div class="workspace-task-pool-tree__stage">
        <div class="workspace-task-pool-tree__canvas-wrap" data-task-pool-tree-canvas-wrap>
          <div class="workspace-task-pool-tree__canvas" data-task-pool-tree-canvas style="--task-pool-zoom:${renderState.zoomPercent / 100};">
            <div class="workspace-task-pool-tree__save-indicator" data-task-pool-tree-save-indicator>${renderState.dirty ? "树状图有未保存更改" : "树状图已同步"}</div>
            ${renderTaskPoolTreeCanvas(items, renderState)}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTaskPoolTreeCanvas(
  items: readonly TaskPlanPoolItem[],
  renderState: TaskPoolTreeRenderState,
): string {
  const hierarchy = buildTaskPoolTreeHierarchy(items);
  return `
    <div class="workspace-task-pool-tree__map">
      <div class="workspace-task-pool-tree__root" data-task-pool-tree-root>共享任务池</div>
      <div class="workspace-task-pool-tree__branches">
        ${hierarchy.map((domain) => `<div class="workspace-task-pool-tree__domain-group"><div class="workspace-task-pool-tree__node workspace-task-pool-tree__node--domain" data-task-pool-tree-node-type="domain">${domain.label}</div></div>`).join("")}
      </div>
    </div>
  `;
}
```

- [ ] **Step 5: Wire the new helpers into the workspace page**

Update `web/client/src/pages/workspace/index.ts` imports and tree render call:

```ts
import {
  TASK_POOL_UNGROUPED_DOMAIN,
  TASK_POOL_UNGROUPED_PROJECT,
  buildTaskPoolTreeHierarchy,
  getTaskPoolDomainName,
  getTaskPoolProjectName,
  type TaskPoolTreeLevel,
  type TaskPoolTreeNodeIdentity,
} from "./task-pool-tree-model.js";
import {
  renderTaskPoolTreeLayout,
  type TaskPoolTreeRenderState,
} from "./task-pool-tree-view.js";
```

Replace the in-file tree render block with a call that prepares `TaskPoolTreeRenderState` and delegates to `renderTaskPoolTreeLayout(...)`.

- [ ] **Step 6: Run the focused test to verify it passes**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "renders editable tree controls when the shared pool editor is enabled in tree mode"
```

Expected:

- the new test passes
- the existing tree-level checkbox filtering test still passes

- [ ] **Step 7: Commit**

```bash
git add test/web-workspace-page.test.ts web/client/src/pages/workspace/index.ts web/client/src/pages/workspace/task-pool-tree-model.ts web/client/src/pages/workspace/task-pool-tree-view.ts
git commit -m "refactor: extract editable task pool tree helpers"
```

### Task 2: Add Tree Edit State And Shared Draft Save Controls

**Files:**
- Modify: `web/client/src/pages/workspace/index.ts:165-177`
- Modify: `web/client/src/pages/workspace/index.ts:990-1085`
- Modify: `web/client/src/pages/workspace/index.ts:1595-1660`
- Modify: `test/web-workspace-page.test.ts:387-470`

- [ ] **Step 1: Write the failing draft-state tests**

Add these tests:

```ts
it("keeps tree edits local until the shared pool save button is clicked", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.pool.items = [
    {
      id: "pool-1",
      title: "完成任务池树状图视图",
      priority: "high",
      source: "文字输入",
      domain: "产品设计",
      project: "工作台改版",
    },
  ];

  const page = renderWorkspacePage();
  document.body.appendChild(page);

  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
  await flush();

  page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='task']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='task']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
  expect(input).not.toBeNull();
  input!.value = "树状图草稿任务";
  input!.dispatchEvent(new Event("input", { bubbles: true }));
  input!.dispatchEvent(new Event("blur", { bubbles: true }));
  await flush();

  expect(page.textContent).toContain("树状图有未保存更改");
  expect(taskPlan.state.pool.items[0]?.title).toBe("完成任务池树状图视图");
});

it("persists tree edits through the shared pool save action", async () => {
  const taskPlan = createMockTaskPlanFixture();
  taskPlan.state.pool.items = [
    {
      id: "pool-1",
      title: "完成任务池树状图视图",
      priority: "high",
      source: "文字输入",
      domain: "产品设计",
      project: "工作台改版",
    },
  ];
  installTaskPlanPoolSaveFetchMock(taskPlan);

  const page = renderWorkspacePage();
  document.body.appendChild(page);

  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
  await flush();

  page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='task']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='task']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
  input!.value = "树状图已保存任务";
  input!.dispatchEvent(new Event("input", { bubbles: true }));
  input!.dispatchEvent(new Event("blur", { bubbles: true }));
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
  await flush();

  expect(taskPlan.state.pool.items[0]?.title).toBe("树状图已保存任务");
  expect(page.textContent).not.toContain("树状图有未保存更改");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "keeps tree edits local until the shared pool save button is clicked"
npx vitest run test/web-workspace-page.test.ts -t "persists tree edits through the shared pool save action"
```

Expected:

- both tests fail
- current tree mode cannot edit task titles or expose unsaved draft state

- [ ] **Step 3: Extend `TaskPoolViewState` for local tree interactions**

In `web/client/src/pages/workspace/index.ts`, extend the state shape:

```ts
interface TaskPoolViewState {
  mode: TaskPoolViewMode;
  treeLevel: TaskPoolTreeLevel;
  selectedOptions: string[];
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  zoomPercent: number;
  selectedNode: TaskPoolTreeNodeIdentity | null;
  editingNode: TaskPoolTreeNodeIdentity | null;
  editValue: string;
  draggingTaskId: string | null;
  dropProjectKey: string | null;
}
```

Update `createDefaultTaskPoolViewState()`:

```ts
function createDefaultTaskPoolViewState(): TaskPoolViewState {
  return {
    mode: "list",
    treeLevel: "domain",
    selectedOptions: [],
    isSidebarCollapsed: false,
    sidebarWidth: TASK_POOL_TREE_BOUNDS.defaultWidth,
    zoomPercent: 90,
    selectedNode: null,
    editingNode: null,
    editValue: "",
    draggingTaskId: null,
    dropProjectKey: null,
  };
}
```

- [ ] **Step 4: Keep tree mode on the shared pool draft**

Update the pool-edit toggles so list and tree share the same draft:

```ts
const toggleTaskPlanPoolEditMode = (): void => {
  const currentItems = taskPlanState.state?.pool.items ?? [];
  const nextEditMode = !taskPlanState.poolEditMode;
  taskPlanState = {
    ...taskPlanState,
    poolEditMode: nextEditMode,
    poolDraft: nextEditMode ? currentItems.map((item) => ({ ...item })) : currentItems.map((item) => ({ ...item })),
    poolFilter: "全部",
    pendingPoolFocusId: null,
    error: null,
  };
  taskPoolState = {
    ...taskPoolState,
    selectedNode: null,
    editingNode: null,
    editValue: "",
    draggingTaskId: null,
    dropProjectKey: null,
  };
  render();
};
```

Expose the existing `保存` and `取消` actions in tree mode by reusing the same `renderTaskPoolActions(...)` output at the page header.

- [ ] **Step 5: Implement simple dirty-state derivation**

Add a local helper in `index.ts`:

```ts
function isTaskPoolDraftDirty(viewState: TaskPlanViewState): boolean {
  const persisted = JSON.stringify(viewState.state?.pool.items ?? []);
  const draft = JSON.stringify(viewState.poolDraft);
  return persisted !== draft;
}
```

Pass this value into the new tree render state and show the unsaved indicator.

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "keeps tree edits local until the shared pool save button is clicked"
npx vitest run test/web-workspace-page.test.ts -t "persists tree edits through the shared pool save action"
```

Expected:

- both tests pass
- tree edits remain draft-only until save

- [ ] **Step 7: Commit**

```bash
git add test/web-workspace-page.test.ts web/client/src/pages/workspace/index.ts
git commit -m "feat: reuse shared pool draft flow in task tree editing"
```

### Task 3: Implement Inline Rename, `Enter` Creation, And Delete-To-Bucket Semantics

**Files:**
- Modify: `web/client/src/pages/workspace/task-pool-tree-model.ts`
- Modify: `web/client/src/pages/workspace/task-pool-tree-view.ts`
- Modify: `web/client/src/pages/workspace/index.ts:1508-1660`
- Test: `test/web-workspace-page.test.ts:387-560`

- [ ] **Step 1: Write the failing interaction tests**

Add these tests:

```ts
it("adds a child task when pressing Enter on a project node", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.pool.items = [
    {
      id: "pool-1",
      title: "完成任务池树状图视图",
      priority: "high",
      source: "文字输入",
      domain: "产品设计",
      project: "工作台改版",
    },
  ];

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
  await flush();

  const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='project']");
  projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  projectNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await flush();

  const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
  expect(input).not.toBeNull();
  expect(input?.value).toBe("");
  expect(page.textContent).toContain("树状图有未保存更改");
});

it("moves project tasks into the same domain's 待分组 bucket when deleting a project", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.pool.items = [
    {
      id: "pool-1",
      title: "完成任务池树状图视图",
      priority: "high",
      source: "文字输入",
      domain: "产品设计",
      project: "工作台改版",
    },
  ];

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
  await flush();

  const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='project']");
  projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  projectNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
  await flush();

  expect(page.textContent).toContain("待分组");
  expect(page.textContent).toContain("完成任务池树状图视图");
});

it("moves domain tasks into 未归类 / 待分组 when deleting a domain", async () => {
  const { taskPlan } = installTaskPlanFetchMock();
  taskPlan.state.pool.items = [
    {
      id: "pool-1",
      title: "完成任务池树状图视图",
      priority: "high",
      source: "文字输入",
      domain: "产品设计",
      project: "工作台改版",
    },
  ];

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
  await flush();

  const domainNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='domain']");
  domainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  domainNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  await flush();

  expect(page.textContent).toContain("未归类");
  expect(page.textContent).toContain("待分组");
  expect(page.textContent).toContain("完成任务池树状图视图");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "adds a child task when pressing Enter on a project node"
npx vitest run test/web-workspace-page.test.ts -t "moves project tasks into the same domain's 待分组 bucket when deleting a project"
npx vitest run test/web-workspace-page.test.ts -t "moves domain tasks into 未归类 / 待分组 when deleting a domain"
```

Expected:

- all three tests fail
- current tree nodes do not accept keyboard editing, creation, or delete behavior

- [ ] **Step 3: Add the draft mutation helpers**

Expand `web/client/src/pages/workspace/task-pool-tree-model.ts` with these pure helpers:

```ts
function createDraftTask(id: string, domain: string | undefined, project: string | undefined): TaskPlanPoolItem {
  return {
    id,
    title: "",
    priority: "neutral",
    source: "手动新增",
    domain,
    project,
  };
}

export function renameTaskPoolTreeNode(
  items: readonly TaskPlanPoolItem[],
  node: TaskPoolTreeNodeIdentity,
  nextValue: string,
): TaskPlanPoolItem[] {
  const value = nextValue.trim();
  if (node.type === "task" && node.taskId) {
    return items.map((item) => (item.id === node.taskId ? { ...item, title: value } : item));
  }
  if (node.type === "project") {
    return items.map((item) =>
      getTaskPoolDomainName(item) === node.domain && getTaskPoolProjectName(item) === node.project
        ? { ...item, project: value || undefined }
        : item,
    );
  }
  return items.map((item) =>
    getTaskPoolDomainName(item) === node.domain
      ? { ...item, domain: value || undefined }
      : item,
  );
}

export function deleteTaskPoolTreeNode(
  items: readonly TaskPlanPoolItem[],
  node: TaskPoolTreeNodeIdentity,
): TaskPlanPoolItem[] {
  if (node.type === "task" && node.taskId) {
    return items.filter((item) => item.id !== node.taskId);
  }
  if (node.type === "project") {
    return items.map((item) =>
      getTaskPoolDomainName(item) === node.domain && getTaskPoolProjectName(item) === node.project
        ? { ...item, project: undefined }
        : item,
    );
  }
  return items.map((item) =>
    getTaskPoolDomainName(item) === node.domain
      ? { ...item, domain: undefined, project: undefined }
      : item,
  );
}
```

- [ ] **Step 4: Add `Enter` creation helpers**

Continue in `task-pool-tree-model.ts`:

```ts
export function addTaskPoolTreeChild(
  items: readonly TaskPlanPoolItem[],
  node: TaskPoolTreeNodeIdentity,
  nextId: string,
): { items: TaskPlanPoolItem[]; focus: TaskPoolTreeNodeIdentity } {
  if (node.type === "domain") {
    const nextTask = createDraftTask(nextId, node.domain === TASK_POOL_UNGROUPED_DOMAIN ? undefined : node.domain, undefined);
    return {
      items: [...items, nextTask],
      focus: { type: "project", domain: getTaskPoolDomainName(nextTask), project: TASK_POOL_UNGROUPED_PROJECT, taskId: null },
    };
  }
  if (node.type === "project") {
    const nextTask = createDraftTask(
      nextId,
      node.domain === TASK_POOL_UNGROUPED_DOMAIN ? undefined : node.domain,
      node.project === TASK_POOL_UNGROUPED_PROJECT ? undefined : node.project,
    );
    return {
      items: [...items, nextTask],
      focus: { type: "task", domain: getTaskPoolDomainName(nextTask), project: getTaskPoolProjectName(nextTask), taskId: nextTask.id },
    };
  }
  const currentTask = items.find((item) => item.id === node.taskId);
  const nextTask = createDraftTask(nextId, currentTask?.domain, currentTask?.project);
  return {
    items: [...items, nextTask],
    focus: { type: "task", domain: getTaskPoolDomainName(nextTask), project: getTaskPoolProjectName(nextTask), taskId: nextTask.id },
  };
}
```

- [ ] **Step 5: Wire node selection, inline editing, `Enter`, and delete**

In `web/client/src/pages/workspace/index.ts`, bind node events from `[data-task-pool-tree-node]` and `[data-task-pool-tree-edit-input]`:

```ts
root.querySelectorAll<HTMLElement>("[data-task-pool-tree-node]").forEach((node) => {
  node.addEventListener("click", () => {
    const treeNode = readTaskPoolTreeNodeIdentity(node);
    if (!treeNode) {
      return;
    }
    const sameNode = isSameTaskPoolTreeNode(taskPoolState.selectedNode, treeNode);
    taskPoolState = {
      ...taskPoolState,
      selectedNode: treeNode,
      editingNode: sameNode ? treeNode : null,
      editValue: sameNode ? readTaskPoolTreeNodeLabel(node) : "",
    };
    render();
  });
  node.addEventListener("keydown", (event) => {
    const treeNode = readTaskPoolTreeNodeIdentity(node);
    if (!treeNode || !taskPlanState.poolEditMode || isTaskPlanPoolBusy(taskPlanState)) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const nextId = createTaskPlanPoolDraftId();
      const result = addTaskPoolTreeChild(taskPlanState.poolDraft, treeNode, nextId);
      taskPlanState = { ...taskPlanState, poolDraft: result.items };
      taskPoolState = { ...taskPoolState, selectedNode: result.focus, editingNode: result.focus, editValue: "" };
      render();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      taskPlanState = {
        ...taskPlanState,
        poolDraft: deleteTaskPoolTreeNode(taskPlanState.poolDraft, treeNode),
      };
      taskPoolState = { ...taskPoolState, selectedNode: null, editingNode: null, editValue: "" };
      render();
    }
  });
});
```

Bind the editor:

```ts
root.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]")?.addEventListener("input", (event) => {
  taskPoolState = {
    ...taskPoolState,
    editValue: (event.currentTarget as HTMLInputElement).value,
  };
});

root.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]")?.addEventListener("blur", () => {
  if (!taskPoolState.editingNode) {
    return;
  }
  taskPlanState = {
    ...taskPlanState,
    poolDraft: renameTaskPoolTreeNode(taskPlanState.poolDraft, taskPoolState.editingNode, taskPoolState.editValue),
  };
  taskPoolState = {
    ...taskPoolState,
    editingNode: null,
  };
  render();
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "adds a child task when pressing Enter on a project node"
npx vitest run test/web-workspace-page.test.ts -t "moves project tasks into the same domain's 待分组 bucket when deleting a project"
npx vitest run test/web-workspace-page.test.ts -t "moves domain tasks into 未归类 / 待分组 when deleting a domain"
```

Expected:

- all three tests pass
- no pre-existing tree filter test regresses

- [ ] **Step 7: Commit**

```bash
git add test/web-workspace-page.test.ts web/client/src/pages/workspace/index.ts web/client/src/pages/workspace/task-pool-tree-model.ts web/client/src/pages/workspace/task-pool-tree-view.ts
git commit -m "feat: add tree editing, enter creation, and safe delete rules"
```

### Task 4: Implement Task Drag-To-Project Re-Linking And Wheel/Pinch Zoom

**Files:**
- Modify: `web/client/src/pages/workspace/task-pool-tree-model.ts`
- Modify: `web/client/src/pages/workspace/task-pool-tree-view.ts`
- Modify: `web/client/src/pages/workspace/index.ts:1595-1660`
- Modify: `web/client/styles.css:5613-5865`
- Test: `test/web-workspace-page.test.ts:560-700`

- [ ] **Step 1: Write the failing drag and zoom tests**

Add these tests:

```ts
it("relinks a task to the drop target project when dragging a task node onto another project", async () => {
  const taskPlan = createMockTaskPlanFixture();
  taskPlan.state.pool.items = [
    {
      id: "pool-1",
      title: "完成任务池树状图视图",
      priority: "high",
      source: "文字输入",
      domain: "产品设计",
      project: "工作台改版",
    },
    {
      id: "pool-2",
      title: "联通项目推进页同步",
      priority: "mid",
      source: "AI 生成",
      domain: "产品设计",
      project: "任务同步",
    },
  ];
  installTaskPlanPoolSaveFetchMock(taskPlan);

  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
  await flush();

  const taskNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']");
  const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-project='任务同步']");
  const transfer = new DataTransfer();
  taskNode?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
  projectNode?.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: transfer }));
  projectNode?.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  await flush();

  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
  await flush();

  const moved = taskPlan.state.pool.items.find((item) => item.id === "pool-1");
  expect(moved?.project).toBe("任务同步");
  expect(moved?.domain).toBe("产品设计");
});

it("updates the tree zoom percentage when wheeling over the canvas", async () => {
  const page = renderWorkspacePage();
  document.body.appendChild(page);
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
  await flush();

  const canvas = page.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]");
  canvas?.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: -120 }));
  await flush();

  expect(page.textContent).toContain("100%");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "relinks a task to the drop target project when dragging a task node onto another project"
npx vitest run test/web-workspace-page.test.ts -t "updates the tree zoom percentage when wheeling over the canvas"
```

Expected:

- both tests fail
- current tree nodes cannot drag or drop tasks
- canvas wheel input does not change zoom state

- [ ] **Step 3: Add the task re-link mutation helper**

In `web/client/src/pages/workspace/task-pool-tree-model.ts`:

```ts
export function moveTaskPoolTaskToProject(
  items: readonly TaskPlanPoolItem[],
  taskId: string,
  targetDomain: string,
  targetProject: string,
): TaskPlanPoolItem[] {
  return items.map((item) =>
    item.id === taskId
      ? {
          ...item,
          domain: targetDomain === TASK_POOL_UNGROUPED_DOMAIN ? undefined : targetDomain,
          project: targetProject === TASK_POOL_UNGROUPED_PROJECT ? undefined : targetProject,
        }
      : item,
  );
}
```

- [ ] **Step 4: Render drag and drop attributes**

Update `web/client/src/pages/workspace/task-pool-tree-view.ts` so task and project nodes expose drag and drop attributes:

```ts
<div
  class="workspace-task-pool-tree__node workspace-task-pool-tree__node--project${isDropTarget ? " is-drop-target" : ""}"
  data-task-pool-tree-node
  data-task-pool-tree-node-type="project"
  data-task-pool-tree-node-domain="${escapeHtml(project.domain)}"
  data-task-pool-tree-node-project="${escapeHtml(project.label)}"
  tabindex="0"
>
  ${escapeHtml(project.label)}
</div>

<div
  class="workspace-task-pool-tree__task${isDragging ? " is-dragging" : ""}"
  data-task-pool-tree-node
  data-task-pool-tree-node-type="task"
  data-task-pool-tree-node-domain="${escapeHtml(task.domain)}"
  data-task-pool-tree-node-project="${escapeHtml(task.project)}"
  data-task-pool-tree-node-task-id="${escapeHtml(task.id)}"
  draggable="true"
  tabindex="0"
>
  ${escapeHtml(task.title)}
</div>
```

- [ ] **Step 5: Bind drag and drop plus wheel zoom**

In `web/client/src/pages/workspace/index.ts`, add handlers:

```ts
root.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='task']").forEach((node) => {
  node.addEventListener("dragstart", (event) => {
    const taskId = node.dataset.taskPoolTreeNodeTaskId;
    if (!taskId) {
      return;
    }
    event.dataTransfer?.setData("text/plain", taskId);
    taskPoolState = { ...taskPoolState, draggingTaskId: taskId };
  });
  node.addEventListener("dragend", () => {
    taskPoolState = { ...taskPoolState, draggingTaskId: null, dropProjectKey: null };
    render();
  });
});

root.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='project']").forEach((node) => {
  node.addEventListener("dragover", (event) => {
    if (!taskPoolState.draggingTaskId) {
      return;
    }
    event.preventDefault();
    taskPoolState = {
      ...taskPoolState,
      dropProjectKey: `${node.dataset.taskPoolTreeNodeDomain ?? ""}::${node.dataset.taskPoolTreeNodeProject ?? ""}`,
    };
    render();
  });
  node.addEventListener("drop", (event) => {
    event.preventDefault();
    const taskId = event.dataTransfer?.getData("text/plain") || taskPoolState.draggingTaskId;
    const targetDomain = node.dataset.taskPoolTreeNodeDomain ?? "";
    const targetProject = node.dataset.taskPoolTreeNodeProject ?? "";
    if (!taskId || !targetDomain || !targetProject) {
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      poolDraft: moveTaskPoolTaskToProject(taskPlanState.poolDraft, taskId, targetDomain, targetProject),
    };
    taskPoolState = {
      ...taskPoolState,
      draggingTaskId: null,
      dropProjectKey: null,
    };
    render();
  });
});

root.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]")?.addEventListener("wheel", (event) => {
  event.preventDefault();
  const nextPercent = event.deltaY < 0 ? taskPoolState.zoomPercent + TASK_POOL_ZOOM_STEP : taskPoolState.zoomPercent - TASK_POOL_ZOOM_STEP;
  setTaskPoolZoomPercent(nextPercent);
});
```

- [ ] **Step 6: Add the minimal styles**

In `web/client/styles.css`, add:

```css
.workspace-task-pool-tree__task.is-dragging {
  opacity: 0.45;
}

.workspace-task-pool-tree__node--project.is-drop-target {
  box-shadow: 0 0 0 2px rgba(76, 124, 255, 0.22);
  background: #eef4ff;
}

.workspace-task-pool-tree__canvas-wrap {
  overscroll-behavior: contain;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts -t "relinks a task to the drop target project when dragging a task node onto another project"
npx vitest run test/web-workspace-page.test.ts -t "updates the tree zoom percentage when wheeling over the canvas"
```

Expected:

- both tests pass
- the page still respects the existing `- / + / 重置` zoom controls

- [ ] **Step 8: Commit**

```bash
git add test/web-workspace-page.test.ts web/client/src/pages/workspace/index.ts web/client/src/pages/workspace/task-pool-tree-model.ts web/client/src/pages/workspace/task-pool-tree-view.ts web/client/styles.css
git commit -m "feat: add task relinking drag and wheel zoom to task tree"
```

### Task 5: Polish Tree Styling, Update Project Log, And Run Full Verification

**Files:**
- Modify: `web/client/styles.css`
- Modify: `docs/project-log.md`
- Test: `test/web-workspace-page.test.ts`

- [ ] **Step 1: Finish selected, editing, and unsaved styling**

Add these styles in `web/client/styles.css`:

```css
.workspace-task-pool-tree__node.is-selected,
.workspace-task-pool-tree__task.is-selected {
  box-shadow: 0 0 0 2px rgba(76, 124, 255, 0.18);
}

.workspace-task-pool-tree__edit-input {
  width: 100%;
  border: 1px solid rgba(76, 124, 255, 0.22);
  border-radius: 14px;
  background: #fff;
  color: #233a67;
  font: inherit;
  padding: 8px 12px;
}

.workspace-task-pool-tree__save-indicator {
  position: sticky;
  top: 0;
  z-index: 2;
  margin-bottom: 16px;
  color: #4c63d8;
  font-weight: 700;
}
```

- [ ] **Step 2: Update the project log**

Add a new top timeline entry in `docs/project-log.md` that says:

```md
### [2026-04-26 15:xx] 任务池树状图支持直接编辑、拖拽挂接与缩放

- 修改内容：工作台 `任务池` 的 `树状图` 视图从只读投影升级为可编辑视图；支持节点选中、原地改单行文本、`Enter` 新增下一子级、删除项目/领域时任务保留并落入 `待分组` / `未归类`、把任务拖到项目节点上重新挂接、悬停画布滚轮缩放与保留显式保存。
- 影响范围：`任务池` 页与 `任务计划页` 继续共享同一份 `pool.items` 草稿和保存链路；项目推进页与健康领域页无数据协议变更。
- 验证：补充 `web-workspace-page` 树状图编辑用例，并运行 TypeScript、build 与全量测试。
```

- [ ] **Step 3: Run the focused workspace tests**

Run:

```bash
npx vitest run test/web-workspace-page.test.ts
```

Expected:

- all workspace page tests pass
- tree filtering, health import, and previous shared task-pool tests all remain green

- [ ] **Step 4: Run type-check, build, full test suite, and fallow**

Run:

```bash
npx tsc --noEmit
npm run build
npm test
fallow
```

Expected:

- `npx tsc --noEmit` exits `0`
- `npm run build` exits `0`
- `npm test` exits `0`
- `fallow` exits `0`

- [ ] **Step 5: Commit**

```bash
git add docs/project-log.md web/client/styles.css
git commit -m "docs: record editable task pool tree workflow"
```

## Self-Review

### Spec coverage

This plan covers every confirmed requirement from `docs/superpowers/specs/2026-04-26-task-pool-tree-editing-design.md`:

- direct tree editing: Task 2 and Task 3
- `Enter` creation: Task 3
- delete without deleting underlying tasks: Task 3
- drag task to project: Task 4
- wheel and pinch-style zoom integration: Task 4
- explicit save boundary: Task 2
- project log update and verification: Task 5

No spec section is left without an implementation task.

### Placeholder scan

This plan contains:

- exact file paths
- concrete code snippets
- concrete test snippets
- explicit commands and expected results

There are no `TODO`, `TBD`, or deferred “implement later” placeholders.

### Type consistency

Names used consistently across tasks:

- `TaskPoolTreeNodeIdentity`
- `TaskPoolTreeRenderState`
- `renameTaskPoolTreeNode`
- `deleteTaskPoolTreeNode`
- `addTaskPoolTreeChild`
- `moveTaskPoolTaskToProject`

The plan keeps the persisted model as `TaskPlanPoolItem[]` throughout and does not introduce conflicting parallel types for saved data.
