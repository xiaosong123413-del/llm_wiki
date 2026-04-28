# Workspace Work Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static `工作日志` secondary tab to the existing workspace page and render an aggregated work-log dashboard based on the future `领域/<领域名>/<项目名>/工作日志.md` structure.

**Architecture:** Keep the top-level `workspace` route unchanged and extend the page-local tab state in `renderWorkspacePage()`. The new tab renders static mock records and a client-side selected-detail panel only.

**Tech Stack:** TypeScript, DOM rendering, existing workspace page module, shared client stylesheet, Vitest + jsdom

---

### Task 1: Expand Workspace Page Test Coverage

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts`

- [ ] **Step 1: Write the failing test**

Add coverage that:

- the workspace nav contains `工作日志`
- clicking `工作日志` activates a `work-log` view
- the view contains aggregated work-log content and a selected detail panel

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- test/web-workspace-page.test.ts`
Expected: FAIL because the tab and view do not exist yet.

- [ ] **Step 3: Implement the minimal UI changes**

Extend the workspace tab union and add the new render branch.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- test/web-workspace-page.test.ts`
Expected: PASS

### Task 2: Implement Static Work-Log View

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts`
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/styles.css`

- [ ] **Step 1: Add static mock records**

Represent multiple domains and projects with:

- domain
- project
- path
- summary
- updatedAt
- focus bullets

- [ ] **Step 2: Render the aggregated view**

Add:

- left-side filters and counters
- center card list
- right-side selected detail panel

- [ ] **Step 3: Add card selection behavior**

Keep it client-only with first-card default selection.

- [ ] **Step 4: Add the required styles**

Scope them under `.workspace-worklog*` or equivalent `.workspace-page*` selectors only.

### Task 3: Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused workspace tests**

Run:

`rtk npm test -- test/web-workspace-page.test.ts test/web-main-slot.test.ts`

Expected: PASS

- [ ] **Step 2: Run route/rail regression tests**

Run:

`rtk npm test -- test/web-router.test.ts test/web-rail.test.ts`

Expected: PASS

- [ ] **Step 3: Run TypeScript and build verification**

Run:

`rtk npx tsc --noEmit`

`rtk npm --prefix web run build`

Expected: PASS
