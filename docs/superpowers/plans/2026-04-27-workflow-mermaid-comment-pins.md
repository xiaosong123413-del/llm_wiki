# Workflow Mermaid Comment Pins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent, draggable comment pins to the Workflow Mermaid detail page so comments stay attached to the diagram, survive redraws, and only disappear when the user explicitly deletes them.

**Architecture:** Keep the current raw Mermaid rendering path intact and layer comment pins above the rendered SVG. Extend the existing automation comment store and routes so each comment persists both its logical target and its last known diagram coordinates. Reuse the existing Workflow detail page and comment panel, but reconnect them to the Mermaid surface instead of reviving the old DAG canvas.

**Tech Stack:** TypeScript, Express, Vitest, native Mermaid SVG rendering, existing `.llmwiki` runtime JSON stores

---

## File Structure

### Existing files to modify

- `D:\Desktop\llm-wiki-compiler-main\web\server\services\automation-workspace-store.ts`
  - Extend automation comment persistence with coordinate and update fields.
- `D:\Desktop\llm-wiki-compiler-main\web\server\routes\automation-workspace.ts`
  - Add comment patch route and request parsing for coordinate/text updates.
- `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\api.ts`
  - Extend comment DTOs and add `PATCH` helper for automation comments.
- `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\index.ts`
  - Restore detail-page state for comment mode, selected comment, and rerender wiring.
- `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\mermaid-view.ts`
  - Render the Mermaid SVG inside a pin-enabled host and expose clickable geometry for nodes, edges, and canvas points.
- `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\panels.ts`
  - Upgrade the existing comment panel from save/delete-only to full pin-aware editing and selection.
- `D:\Desktop\llm-wiki-compiler-main\web\client\styles.css`
  - Add Mermaid pin-layer layout, comment-mode affordances, and draggable pin visuals.
- `D:\Desktop\llm-wiki-compiler-main\test\automation-workspace-routes.test.ts`
  - Cover comment create/update/delete persistence and orphan-safe behavior.
- `D:\Desktop\llm-wiki-compiler-main\test\web-automation-detail-page.test.ts`
  - Cover comment-mode UI, pin rendering, and redraw persistence.
- `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
  - Document the new Workflow detail comment-pin behavior after implementation.

### New files to create

- `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\mermaid-comments.ts`
  - Focused browser-side helpers for SVG geometry, pin placement, drag math, and target matching so `mermaid-view.ts` stays under file-size limits.

---

### Task 1: Extend the automation comment model and persistence

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\automation-workspace-store.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\automation-workspace.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\api.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\automation-workspace-routes.test.ts`

- [ ] **Step 1: Write the failing route test for coordinate-aware comments**

Add a new route test that creates a comment, patches its text and coordinates, then reloads detail and verifies the updated payload is returned intact.

```ts
it("updates automation comments with pinned and manual coordinates", async () => {
  const cfg = makeConfig();
  seedAutomationConfig(cfg.projectRoot);
  seedAppConfig(cfg.projectRoot);

  const created = createResponse();
  await handleAutomationWorkspaceCommentCreate(cfg)({
    params: { id: "daily-sync" },
    body: {
      targetType: "node",
      targetId: "action-with-app-model",
      text: "初始评论",
      pinnedX: 320,
      pinnedY: 180,
    },
  } as never, created as never);

  const patched = createResponse();
  await handleAutomationWorkspaceCommentPatch(cfg)({
    params: { id: "daily-sync", commentId: created.body.data.id },
    body: {
      text: "已拖动后的评论",
      manualX: 360,
      manualY: 212,
      pinnedX: 360,
      pinnedY: 212,
      targetType: "canvas",
      targetId: "canvas",
    },
  } as never, patched as never);

  expect(patched.body.data).toEqual(expect.objectContaining({
    text: "已拖动后的评论",
    manualX: 360,
    manualY: 212,
    pinnedX: 360,
    pinnedY: 212,
    targetType: "canvas",
    targetId: "canvas",
  }));
});
```

- [ ] **Step 2: Run the focused route test to verify it fails**

Run: `rtk test "npm test -- test/automation-workspace-routes.test.ts"`

Expected: FAIL because `handleAutomationWorkspaceCommentPatch` does not exist and the store rejects the new fields.

- [ ] **Step 3: Extend the comment store type and persistence format**

Update `AutomationWorkspaceComment` and its normalization logic so comments can persist both target identity and diagram coordinates.

```ts
export interface AutomationWorkspaceComment {
  id: string;
  automationId: string;
  targetType: "node" | "edge" | "canvas";
  targetId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  pinnedX: number;
  pinnedY: number;
  manualX?: number;
  manualY?: number;
}
```

Add a store updater:

```ts
export function updateAutomationWorkspaceComment(
  runtimeRoot: string,
  automationId: string,
  commentId: string,
  input: Partial<Pick<AutomationWorkspaceComment, "text" | "targetType" | "targetId" | "pinnedX" | "pinnedY" | "manualX" | "manualY">>,
  now: Date = new Date(),
): AutomationWorkspaceComment | null {
  // locate comment, merge allowed fields, bump updatedAt, write file, return updated comment
}
```

- [ ] **Step 4: Add the patch route and client DTO support**

In `automation-workspace.ts`, add:

```ts
app.patch("/api/automation-workspace/:id/comments/:commentId", handleAutomationWorkspaceCommentPatch(cfg));
```

Parse the allowed patch body:

```ts
function parseCommentPatch(body: unknown): {
  text?: string;
  targetType?: "node" | "edge" | "canvas";
  targetId?: string;
  pinnedX?: number;
  pinnedY?: number;
  manualX?: number;
  manualY?: number;
} {
  // read only known fields, reject invalid numbers or invalid targetType
}
```

In `api.ts`, extend the response type and add:

```ts
export async function patchAutomationComment(
  automationId: string,
  commentId: string,
  input: Partial<Pick<AutomationCommentResponse, "text" | "targetType" | "targetId" | "pinnedX" | "pinnedY" | "manualX" | "manualY">>,
): Promise<AutomationCommentResponse> {
  return requestJson<AutomationCommentResponse>(`/api/automation-workspace/${encodeURIComponent(automationId)}/comments/${encodeURIComponent(commentId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 5: Run the route test again**

Run: `rtk test "npm test -- test/automation-workspace-routes.test.ts"`

Expected: PASS, including create, patch, and delete flows for coordinate-aware comments.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/automation-workspace-store.ts web/server/routes/automation-workspace.ts web/client/src/pages/automation/api.ts test/automation-workspace-routes.test.ts
git commit -m "feat: persist workflow mermaid comment pin coordinates"
```

---

### Task 2: Add Mermaid comment geometry helpers without disturbing raw Mermaid rendering

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\mermaid-comments.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\mermaid-view.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-automation-detail-page.test.ts`

- [ ] **Step 1: Write the failing detail-page test for node pin creation**

Add a UI test that mounts a Workflow detail payload with one existing comment, enters comment mode, clicks a node hotspot, saves a new comment, and expects a pin marker in the diagram host.

```ts
it("creates a new pin when comment mode is active and the user clicks a Mermaid target", async () => {
  const page = renderAutomationWorkspacePage("daily-sync");
  document.body.appendChild(page);
  await flush();
  await flush();

  page.querySelector<HTMLButtonElement>("[data-automation-comment-toggle]")?.click();
  page.querySelector<HTMLElement>("[data-automation-comment-target='action']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flush();

  const input = page.querySelector<HTMLTextAreaElement>("[data-automation-comment-input]");
  input!.value = "这里要收紧节点间距";
  page.querySelector<HTMLButtonElement>("[data-automation-comment-save]")?.click();
  await flush();

  expect(page.querySelectorAll("[data-automation-comment-pin]").length).toBe(1);
});
```

- [ ] **Step 2: Run the detail-page test to verify it fails**

Run: `rtk test "npm test -- test/web-automation-detail-page.test.ts"`

Expected: FAIL because the Mermaid detail page currently exposes no comment-mode controls and no clickable target overlay.

- [ ] **Step 3: Create a focused Mermaid comment helper module**

In `mermaid-comments.ts`, add helpers for:

```ts
export interface MermaidTargetAnchor {
  targetType: "node" | "edge" | "canvas";
  targetId: string;
  x: number;
  y: number;
}

export function collectMermaidTargetAnchors(svg: SVGSVGElement): MermaidTargetAnchor[] {
  // collect node boxes, approximate edge midpoints, and expose a canvas fallback
}

export function resolveCommentPinPosition(
  comment: AutomationCommentResponse,
  anchors: MermaidTargetAnchor[],
): { x: number; y: number; orphaned: boolean } {
  // prefer manual coords, else target anchor, else pinned coords
}
```

Keep this file narrowly responsible for geometry and pin placement, not DOM mutation.

- [ ] **Step 4: Upgrade Mermaid view rendering to expose a pin-ready host**

Keep `renderMermaidSvg()` unchanged, but wrap the SVG in a comment-capable host:

```ts
host.innerHTML = `
  <div class="automation-detail__mermaid-diagram" data-automation-mermaid-diagram>
    <div class="automation-detail__mermaid-surface" data-automation-mermaid-surface>
      ${svg}
      <div class="automation-detail__comment-pins" data-automation-comment-pins></div>
      <button type="button" class="automation-detail__canvas-target" data-automation-canvas-target hidden></button>
    </div>
  </div>
`;
```

Also expose helper exports so `index.ts` can ask Mermaid view for:

```ts
export interface RenderedMermaidSurface {
  svg: SVGSVGElement;
  anchors: MermaidTargetAnchor[];
  pinsHost: HTMLElement;
  surface: HTMLElement;
}
```

- [ ] **Step 5: Re-run the detail-page test**

Run: `rtk test "npm test -- test/web-automation-detail-page.test.ts"`

Expected: FAIL again, but now for missing comment-state wiring rather than missing Mermaid host structure.

- [ ] **Step 6: Commit**

```bash
git add web/client/src/pages/automation/mermaid-comments.ts web/client/src/pages/automation/mermaid-view.ts test/web-automation-detail-page.test.ts
git commit -m "feat: expose mermaid geometry for workflow comment pins"
```

---

### Task 3: Restore comment mode and pin creation in the Workflow detail page

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\panels.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\api.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-automation-detail-page.test.ts`

- [ ] **Step 1: Extend the detail-page state in a failing test-first way**

Add a second UI test that proves comments survive a detail reload and that comment mode toggles without losing the rendered pins.

```ts
it("keeps existing pins after detail refresh and comment-mode toggles", async () => {
  const page = renderAutomationWorkspacePage("daily-sync");
  document.body.appendChild(page);
  await flush();
  await flush();

  expect(page.querySelectorAll("[data-automation-comment-pin]").length).toBe(1);
  page.querySelector<HTMLButtonElement>("[data-automation-comment-toggle]")?.click();
  page.querySelector<HTMLButtonElement>("[data-automation-comment-toggle]")?.click();
  await flush();

  automationWorkspaceEvents.emit("/api/automation-workspace/events", "change", {
    version: 2,
    changedAt: "2026-04-27T12:00:00.000Z",
    files: ["web/client/src/pages/automation/automation-flow.ts"],
  });
  await flush();
  await flush();

  expect(page.querySelectorAll("[data-automation-comment-pin]").length).toBe(1);
});
```

- [ ] **Step 2: Run the detail-page test to verify the new expectation fails**

Run: `rtk test "npm test -- test/web-automation-detail-page.test.ts"`

Expected: FAIL because the detail page still ignores `comments` in Mermaid mode.

- [ ] **Step 3: Add comment-mode state and rerender wiring to `index.ts`**

Extend the detail state:

```ts
const state = {
  detail: null as AutomationDetailResponse | null,
  commentMode: false,
  draftTarget: null as { targetType: "node" | "edge" | "canvas"; targetId: string; pinnedX: number; pinnedY: number } | null,
  selectedCommentId: null as string | null,
};
```

After rendering Mermaid, wire:

```ts
const surface = await renderAutomationMermaidView(elements.canvasWrap, automation, {
  comments: state.detail.comments,
  commentMode: state.commentMode,
  selectedCommentId: state.selectedCommentId,
  onCreateDraft: (draftTarget) => {
    state.draftTarget = draftTarget;
    renderAutomationDetail(root, automationId, state);
  },
  onSelectComment: (commentId) => {
    state.selectedCommentId = commentId;
    renderAutomationDetail(root, automationId, state);
  },
  onMoveComment: async (commentId, position) => {
    await patchAutomationComment(automation.id, commentId, position);
    await refresh();
  },
});
```

- [ ] **Step 4: Upgrade the comment panel to work with pin drafts and existing comments**

In `panels.ts`, replace the old local-only state with pin-aware data:

```ts
interface AutomationCommentPanelState {
  comments: AutomationCommentResponse[];
  commentMode: boolean;
  selectedCommentId: string | null;
  draft: {
    targetType: "node" | "edge" | "canvas";
    targetId: string;
    pinnedX: number;
    pinnedY: number;
  } | null;
}
```

The panel must render:

- a `评论模式` toggle button
- draft input when a draft target exists
- existing comment cards
- orphan hint when a comment target no longer exists

Save flow:

```ts
const created = await createAutomationComment(automationId, {
  targetType: state.draft.targetType,
  targetId: state.draft.targetId,
  text: input.value.trim(),
  pinnedX: state.draft.pinnedX,
  pinnedY: state.draft.pinnedY,
});
```

- [ ] **Step 5: Re-run the detail-page test**

Run: `rtk test "npm test -- test/web-automation-detail-page.test.ts"`

Expected: PASS for comment-mode toggle, draft creation, and redraw persistence.

- [ ] **Step 6: Commit**

```bash
git add web/client/src/pages/automation/index.ts web/client/src/pages/automation/panels.ts web/client/src/pages/automation/api.ts test/web-automation-detail-page.test.ts
git commit -m "feat: add workflow mermaid comment mode and pin creation"
```

---

### Task 4: Add draggable pins and orphan-safe positioning

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\mermaid-comments.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\automation\mermaid-view.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\styles.css`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-automation-detail-page.test.ts`

- [ ] **Step 1: Write the failing detail-page test for drag persistence and orphan survival**

Add a UI test that patches an existing comment after a simulated drag and then refreshes detail with the original target removed.

```ts
it("keeps a pin visible after its target disappears and preserves the dragged coordinates", async () => {
  const page = renderAutomationWorkspacePage("daily-sync");
  document.body.appendChild(page);
  await flush();
  await flush();

  const pin = page.querySelector<HTMLElement>("[data-automation-comment-pin='comment-1']");
  pin?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 220, clientY: 180 }));
  window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 280, clientY: 220 }));
  window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 280, clientY: 220 }));
  await flush();

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/automation-workspace/daily-sync/comments/comment-1",
    expect.objectContaining({ method: "PATCH" }),
  );
});
```

- [ ] **Step 2: Run the focused detail test to verify drag support is missing**

Run: `rtk test "npm test -- test/web-automation-detail-page.test.ts"`

Expected: FAIL because pins are not draggable and no patch request is sent.

- [ ] **Step 3: Implement drag math in the Mermaid comment helper**

Add drag-safe coordinate helpers:

```ts
export function clampPinToSurface(
  point: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(size.width, point.x)),
    y: Math.max(0, Math.min(size.height, point.y)),
  };
}

export function toSurfacePoint(
  event: PointerEvent,
  surfaceRect: DOMRect,
): { x: number; y: number } {
  return { x: event.clientX - surfaceRect.left, y: event.clientY - surfaceRect.top };
}
```

Use these helpers in `mermaid-view.ts` to patch comments with:

```ts
await onMoveComment(comment.id, {
  manualX: next.x,
  manualY: next.y,
  pinnedX: next.x,
  pinnedY: next.y,
});
```

- [ ] **Step 4: Add the pin visuals and drag affordances**

In `styles.css`, add the pin layer and selected/orphan styling:

```css
.automation-detail__comment-pins {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.automation-detail__comment-pin {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 3px solid #fff;
  background: #6b6ff4;
  box-shadow: 0 10px 24px rgba(107, 111, 244, 0.28);
  transform: translate(-50%, -50%);
  pointer-events: auto;
  cursor: grab;
}

.automation-detail__comment-pin[data-orphaned="true"] {
  background: #f59e0b;
}
```

- [ ] **Step 5: Re-run the detail-page test**

Run: `rtk test "npm test -- test/web-automation-detail-page.test.ts"`

Expected: PASS, including dragged pin persistence and orphan-safe rendering after redraw.

- [ ] **Step 6: Commit**

```bash
git add web/client/src/pages/automation/mermaid-comments.ts web/client/src/pages/automation/mermaid-view.ts web/client/styles.css test/web-automation-detail-page.test.ts
git commit -m "feat: make workflow mermaid comment pins draggable"
```

---

### Task 5: Final verification and project log update

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\automation-workspace-routes.test.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-automation-detail-page.test.ts`

- [ ] **Step 1: Update the project log only after the feature is working**

Add one current-interface bullet under the Workflow page and one new timeline entry documenting:

```md
- Workflow 详情页现在支持 Mermaid 图钉评论：进入评论模式后，可直接在图上的节点、边或空白处落评论图钉；图形变化后图钉仍保留，只有显式删除才会移除。
```

And a timeline entry summarizing:

```md
### [2026-04-27 HH:MM] Workflow Mermaid 图新增持久图钉评论

- 修改内容：Workflow 详情页增加 Mermaid 图钉评论层，支持节点 / 边 / 空白区域评论、拖动图钉、图形变化后保留评论。
- 验证结果：...
```

- [ ] **Step 2: Run the focused route and UI tests**

Run: `rtk test "npm test -- test/automation-workspace-routes.test.ts test/web-automation-detail-page.test.ts"`

Expected: PASS.

- [ ] **Step 3: Run type-check**

Run: `rtk tsc --noEmit`

Expected: `TypeScript: No errors found`

- [ ] **Step 4: Run build**

Run: `rtk err "npm run build"`

Expected: `[ok] Command completed successfully (no errors)`

- [ ] **Step 5: Run full test suite**

Run: `rtk test "npm test"`

Expected: PASS.

- [ ] **Step 6: Run fallow**

Run: `rtk err "npx fallow"`

Expected: PASS with no dead-code, duplication, or complexity failures.

- [ ] **Step 7: Commit**

```bash
git add docs/project-log.md test/automation-workspace-routes.test.ts test/web-automation-detail-page.test.ts
git commit -m "feat: add workflow mermaid comment pins"
```

---

## Self-Review

- Spec coverage: the plan covers pinned comment creation, persistence, drag behavior, orphan-safe retention, right-side comment editing, tests, and project-log updates. The intentionally removed “submit to Codex” path is not implemented anywhere in this plan.
- Placeholder scan: no `TODO`, `TBD`, or deferred “later” tasks remain.
- Type consistency: the plan consistently uses `AutomationWorkspaceComment`, `targetType: "node" | "edge" | "canvas"`, `pinnedX/pinnedY`, and `manualX/manualY` across store, routes, client API, and tests.

