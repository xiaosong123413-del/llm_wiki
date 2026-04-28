# Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `工作台` full-page route with a first-position rail button, horizontal secondary navigation, and static first versions of `项目推进页` and `任务计划页`.

**Architecture:** Extend the existing hash router and shell routing tables with a single new `workspace` route, then mount a dedicated `renderWorkspacePage()` frontend page that owns its internal secondary-tab state. Keep all behavior client-side and static for this first pass.

**Tech Stack:** TypeScript, DOM rendering, existing shell router/rail/main-slot, Vitest + jsdom, shared client stylesheet

---

### Task 1: Route Coverage

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/web-router.test.ts`
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/router.ts`

- [ ] **Step 1: Write the failing test**

Add assertions for:

- `parseHash("#/workspace") -> { name: "workspace", params: {} }`
- `router.navigate({ name: "workspace" }) -> "#/workspace"`

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- test/web-router.test.ts`
Expected: FAIL because `workspace` is not a valid route yet.

- [ ] **Step 3: Write minimal implementation**

Update `RouteName` and `ROUTE_TABLE` in `web/client/src/router.ts` to include `workspace`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- test/web-router.test.ts`
Expected: PASS

### Task 2: Rail Integration

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/web-rail.test.ts`
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/shell/rail.ts`
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/components/icon.ts`

- [ ] **Step 1: Write the failing test**

Update rail expectations so:

- `workspace` is first
- clicking the `workspace` button calls `onNavigate("workspace")`

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- test/web-rail.test.ts`
Expected: FAIL because the rail does not include `workspace`.

- [ ] **Step 3: Write minimal implementation**

Add a new rail item for `workspace` at index 0 and add one icon entry if the page uses a new icon.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- test/web-rail.test.ts`
Expected: PASS

### Task 3: Main Slot Mounting

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/web-main-slot.test.ts`
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/shell/main-slot.ts`
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts`

- [ ] **Step 1: Write the failing test**

Add a `workspace` main-slot test that verifies:

- legacy chat is hidden
- browser is hidden
- shell route becomes `workspace`
- full-page flag is set
- workspace page root mounts

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- test/web-main-slot.test.ts`
Expected: FAIL because `workspace` is not mounted yet.

- [ ] **Step 3: Write minimal implementation**

Import `renderWorkspacePage()` and include `workspace` in the full-page/hide-browser logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- test/web-main-slot.test.ts`
Expected: PASS

### Task 4: Workspace Page Rendering

**Files:**
- Create: `D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts`
- Create: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts`

- [ ] **Step 1: Write the failing test**

Cover:

- default tab is `项目推进页`
- clicking secondary nav switches to `任务计划页`
- clicking secondary nav switches to `任务池`
- page contains expected section headings for each state

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- test/web-workspace-page.test.ts`
Expected: FAIL because the page does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Build one focused `renderWorkspacePage()` module that:

- renders header + secondary tabs
- uses page-local state
- re-renders body on tab switch
- contains static content for `项目推进页` and `任务计划页`
- contains placeholder content for `任务池`

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- test/web-workspace-page.test.ts`
Expected: PASS

### Task 5: Styling

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/styles.css`

- [ ] **Step 1: Add the minimal page styles**

Add scoped `.workspace-page*` rules for:

- page shell
- secondary nav
- responsive three-column layouts
- cards, chips, timeline rows, gantt mock blocks, and placeholder pool panel

- [ ] **Step 2: Run focused page tests**

Run: `rtk npm test -- test/web-workspace-page.test.ts test/web-main-slot.test.ts`
Expected: PASS

### Task 6: Focused Verification

**Files:**
- Verify only

- [ ] **Step 1: Run route/shell/page tests**

Run:

`rtk npm test -- test/web-router.test.ts test/web-rail.test.ts test/web-main-slot.test.ts test/web-workspace-page.test.ts`

Expected: PASS

- [ ] **Step 2: Run TypeScript verification**

Run:

`rtk npx tsc --noEmit`

Expected: PASS

- [ ] **Step 3: Run client build verification**

Run:

`rtk npm --prefix web run build`

Expected: PASS
