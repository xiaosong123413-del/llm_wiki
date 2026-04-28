# Toolbox Page Replica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `workspace -> toolbox` editor with a reference-style toolbox dashboard that uses a new primary page model and imports legacy Markdown toolbox entries as tool assets.

**Architecture:** Keep the existing workspace route and shell, but extract toolbox-specific state/rendering/binding into focused modules under the workspace page folder. The server keeps `/api/toolbox`, but upgrades it to serve and persist a richer `工具箱/toolbox.json` page model while importing legacy Markdown files into asset cards.

**Tech Stack:** TypeScript, Vitest, existing web client DOM renderer, Express routes, CSS in `web/client/styles.css`

---

## File Structure

- Modify: `D:/Desktop/llm-wiki-compiler-main/web/server/routes/toolbox.ts`
  - Replace the flat item list response with a normalized toolbox page model.
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/types.ts`
  - Toolbox page contracts shared inside the client toolbox modules.
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/model.ts`
  - Pure helpers for filtering, selection, draft conversion, and display grouping.
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/view.ts`
  - Markup generation for the replica page and management surface.
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/controller.ts`
  - Toolbox fetch/save/create/delete flows and DOM bindings.
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts`
  - Remove inline toolbox implementation and delegate to the new toolbox modules.
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/styles.css`
  - Remove conflicting old toolbox editor styles and add replica dashboard styling.
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/toolbox-routes.test.ts`
  - Lock the new API model and legacy migration behavior.
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts`
  - Lock the new toolbox layout, tab behavior, and management hooks.
- Modify: `D:/Desktop/llm-wiki-compiler-main/docs/project-log.md`
  - Record the user-visible toolbox interface rewrite.

### Task 1: Lock The New API Contract First

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/toolbox-routes.test.ts`

- [ ] **Step 1: Write the failing API expectations**

Add assertions that `GET /api/toolbox` returns a richer model:

```ts
expect(response.body.data).toEqual(
  expect.objectContaining({
    page: expect.objectContaining({
      modes: ["工作流", "工具资产"],
      defaultMode: "工作流",
    }),
    workflows: expect.arrayContaining([
      expect.objectContaining({
        title: expect.any(String),
        agentName: expect.any(String),
      }),
    ]),
    assets: expect.arrayContaining([
      expect.objectContaining({
        title: expect.any(String),
        category: expect.any(String),
      }),
    ]),
    recentRuns: expect.any(Array),
    favorites: expect.any(Array),
  }),
);
```

- [ ] **Step 2: Run the focused route test to verify it fails**

Run: `rtk test npm test -- test/toolbox-routes.test.ts`

Expected: FAIL because the current route only returns `categories` and `items`.

- [ ] **Step 3: Add a legacy import expectation**

Use a Markdown-only toolbox root and assert that a legacy entry appears inside `assets`:

```ts
expect(response.body.data.assets).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      title: "Figma",
      source: expect.objectContaining({ type: "legacy-markdown" }),
    }),
  ]),
);
```

- [ ] **Step 4: Re-run the same focused route test**

Run: `rtk test npm test -- test/toolbox-routes.test.ts`

Expected: FAIL with the legacy import assertion still unmet.

### Task 2: Lock The Workspace Replica Surface

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts`

- [ ] **Step 1: Replace the old toolbox assertions with replica-specific expectations**

Add checks like:

```ts
expect(page.querySelector("[data-workspace-view='toolbox']")).not.toBeNull();
expect(page.textContent).toContain("最近运行的 Agent");
expect(page.textContent).toContain("收藏夹 / 快捷入口");
expect(page.textContent).toContain("工作流");
expect(page.textContent).toContain("工具资产");
expect(page.textContent).toContain("资料收集流");
expect(page.textContent).toContain("Figma");
```

- [ ] **Step 2: Assert the new management entry points exist**

```ts
expect(page.querySelector("[data-toolbox-manage='workflows']")).not.toBeNull();
expect(page.querySelector("[data-toolbox-manage='assets']")).not.toBeNull();
```

- [ ] **Step 3: Run the focused workspace test to verify it fails**

Run: `rtk test npm test -- test/web-workspace-page.test.ts`

Expected: FAIL because the current page still renders the old CRUD editor.

### Task 3: Upgrade The Server Model With Legacy Migration

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/server/routes/toolbox.ts`

- [ ] **Step 1: Add explicit route-level types for the page model**

Introduce stable contracts for:

```ts
interface ToolboxWorkflowRecord { id: string; title: string; agentName: string; accent: string; }
interface ToolboxAssetRecord { id: string; title: string; category: string; source: { type: "managed" | "legacy-markdown"; path?: string }; }
interface ToolboxPageModel { defaultMode: "工作流" | "工具资产"; workflows: ToolboxWorkflowRecord[]; assets: ToolboxAssetRecord[]; recentRuns: ToolboxRecentRunRecord[]; favorites: ToolboxFavoriteRecord[]; }
```

- [ ] **Step 2: Load or bootstrap `工具箱/toolbox.json`**

Implement the minimal loader pattern:

```ts
const primaryPath = path.join(projectRoot, "工具箱", "toolbox.json");
const primaryModel = fs.existsSync(primaryPath)
  ? parseToolboxPrimaryModel(fs.readFileSync(primaryPath, "utf-8"))
  : buildDefaultPrimaryModel();
```

- [ ] **Step 3: Import legacy Markdown entries into asset cards**

Merge legacy entries that are not already represented:

```ts
const legacyAssets = listLegacyMarkdownItems(projectRoot)
  .filter((item) => !managedAssetPaths.has(item.path))
  .map(toLegacyAssetRecord);
const assets = [...primaryModel.assets, ...legacyAssets];
```

- [ ] **Step 4: Save managed edits back into `工具箱/toolbox.json`**

Keep save/create/delete operating on the primary model only, with normalized writes:

```ts
fs.writeFileSync(primaryPath, JSON.stringify(nextModel, null, 2), "utf-8");
```

- [ ] **Step 5: Run the focused route test to verify it passes**

Run: `rtk test npm test -- test/toolbox-routes.test.ts`

Expected: PASS

### Task 4: Extract The Client Toolbox Into Focused Modules

**Files:**
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/types.ts`
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/model.ts`
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/view.ts`
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/toolbox/controller.ts`
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts`

- [ ] **Step 1: Move toolbox state contracts out of `workspace/index.ts`**

Create `types.ts` with explicit page payload/state interfaces used by the client.

- [ ] **Step 2: Move filtering and draft helpers into `model.ts`**

Extract pure functions such as:

```ts
export function filterToolboxAssets(state: ToolboxClientState): ToolboxAssetView[] { ... }
export function findSelectedToolboxEntity(state: ToolboxClientState): ToolboxManagedEntity | null { ... }
```

- [ ] **Step 3: Build the new replica markup in `view.ts`**

Render:

```ts
<section data-workspace-view="toolbox">
  <header>...</header>
  <section data-toolbox-mode-switch>...</section>
  <section data-toolbox-workflows>...</section>
  <aside data-toolbox-rail>...</aside>
  <section data-toolbox-assets>...</section>
</section>
```

- [ ] **Step 4: Move fetch/save/create/delete and DOM binding into `controller.ts`**

Keep the public surface small:

```ts
export interface WorkspaceToolboxController {
  render(): string;
  bind(root: HTMLElement): void;
  ensureLoaded(): void;
}
```

- [ ] **Step 5: Shrink `workspace/index.ts` so it delegates to the toolbox controller**

The workspace file should stop containing inline toolbox rendering logic and event bindings.

- [ ] **Step 6: Run the focused workspace page test to verify the new structure**

Run: `rtk test npm test -- test/web-workspace-page.test.ts`

Expected: PASS

### Task 5: Apply Replica Styling

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/styles.css`

- [ ] **Step 1: Remove or isolate styles that only support the old CRUD toolbox**

Delete or stop using selectors tied only to:

```css
.workspace-toolbox-form
.workspace-toolbox-field
.workspace-toolbox-list
```

- [ ] **Step 2: Add new replica selectors**

Add focused styles for:

```css
.workspace-toolbox-page
.workspace-toolbox-hero
.workspace-toolbox-mode-switch
.workspace-toolbox-workflows
.workspace-toolbox-rail
.workspace-toolbox-assets
.workspace-toolbox-manage
```

- [ ] **Step 3: Add responsive rules without changing hierarchy**

Keep desktop-first layout and allow the right rail to stack below on narrow widths.

- [ ] **Step 4: Run the workspace page test again**

Run: `rtk test npm test -- test/web-workspace-page.test.ts`

Expected: PASS

### Task 6: Update Documentation And Verify End To End

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/docs/project-log.md`

- [ ] **Step 1: Record the user-visible toolbox page rewrite**

Document that the toolbox page now uses a reference-style dashboard with workflow/asset modes and a right rail.

- [ ] **Step 2: Run focused toolbox tests**

Run: `rtk test npm test -- test/toolbox-routes.test.ts test/web-workspace-page.test.ts`

Expected: PASS

- [ ] **Step 3: Run type-check**

Run: `rtk tsc`

Expected: PASS

- [ ] **Step 4: Run web build**

Run: `rtk npm --prefix web run build`

Expected: PASS
