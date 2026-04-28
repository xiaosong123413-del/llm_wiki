# Project Log Selection Comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move project-log comment creation from the top toolbar to a floating `评论` button that appears beside selected text and still opens the existing right-side comment editor.

**Architecture:** Keep the project-log page as a single DOM-driven module. Add one floating button element and minimal selection state in `web/client/src/pages/project-log/index.ts`, style it in the shared stylesheet, and update the existing page test to drive the new selection flow first.

**Tech Stack:** TypeScript, DOM APIs, shared CSS, Vitest with jsdom

---

### Task 1: Lock the new interaction with a failing test

**Files:**
- Modify: `test/web-project-log-page.test.ts`
- Test: `test/web-project-log-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("shows a floating comment trigger for a text selection and uses it to create comments", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/project-log") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              path: "docs/project-log.md",
              html: "<h1>Project Log</h1><p id=\"target-text\">Commentable sentence.</p>",
              raw: "# Project Log",
              modifiedAt: "2026-04-20T13:00:00.000Z",
            },
          }),
        } as Response;
      }

      throw new Error(`unexpected fetch ${url}`);
    }),
  );

  const page = renderProjectLogPage();
  document.body.appendChild(page);
  await flush();

  const selectedText = page.querySelector("#target-text")?.firstChild;
  const range = document.createRange();
  range.selectNodeContents(selectedText!);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));

  const floatingButton = page.querySelector<HTMLButtonElement>("[data-project-log-selection-comment]");
  expect(floatingButton?.hidden).toBe(false);
  expect(page.querySelector("[data-project-log-comment]")).toBeNull();

  floatingButton?.click();

  expect(page.querySelector("[data-project-log-comment-highlight]")?.textContent).toContain("Commentable sentence.");
  expect(page.querySelector("[data-project-log-comments-panel]")?.hasAttribute("hidden")).toBe(false);
  expect(document.activeElement).toBe(page.querySelector("[data-project-log-comment-input]"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk test npx vitest run test/web-project-log-page.test.ts`
Expected: FAIL because the page does not render `[data-project-log-selection-comment]`, the old toolbar comment button still exists, and the new focus assertion cannot pass.

- [ ] **Step 3: Keep the old assertions that still matter**

```ts
expect(toolbar?.className).toContain("project-log-page__toolbar");
expect(page.getAttribute("style") ?? "").toContain("--project-log-comments-width");
expect(page.querySelector("[data-project-log-comments-resize]")).not.toBeNull();
```

- [ ] **Step 4: Run test again after merging the test edits**

Run: `rtk test npx vitest run test/web-project-log-page.test.ts`
Expected: FAIL for the new interaction only.

- [ ] **Step 5: Commit checkpoint**

```bash
git add test/web-project-log-page.test.ts
git commit -m "test: cover project log selection comment trigger"
```

### Task 2: Implement the floating selection trigger in the page module

**Files:**
- Modify: `web/client/src/pages/project-log/index.ts`
- Test: `test/web-project-log-page.test.ts`

- [ ] **Step 1: Add the floating trigger element to the page markup**

```ts
<button
  type="button"
  class="btn btn-primary btn-inline project-log-page__selection-comment"
  data-project-log-selection-comment
  hidden
>评论</button>
```

- [ ] **Step 2: Remove the old toolbar create button from the template**

```ts
<button type="button" class="btn btn-secondary btn-inline" data-project-log-toc-toggle>目录</button>
<span class="project-log-page__toolbar-separator"></span>
<button type="button" class="btn btn-secondary btn-inline is-active" data-project-log-filter="all">全部评论</button>
```

- [ ] **Step 3: Add minimal helpers for visibility, position, and selection validation**

```ts
function getCommentableSelection(root: HTMLElement): Range | null {
  const content = root.querySelector<HTMLElement>("[data-project-log-content]")!;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) return null;
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) return null;
  return range;
}
```

- [ ] **Step 4: Wire events in `bindProjectLogTools`**

```ts
document.addEventListener("selectionchange", syncSelectionCommentButton);
root.addEventListener("scroll", hideSelectionCommentButton, { passive: true });
root.addEventListener("click", (event) => {
  if (!(event.target as HTMLElement).closest("[data-project-log-selection-comment]")) {
    hideSelectionCommentButton();
  }
});
```

- [ ] **Step 5: Reuse the current comment creation flow and focus the new textarea**

```ts
selectionCommentButton.addEventListener("click", () => {
  const comment = createCommentFromSelection(root);
  if (!comment) {
    status.textContent = "需要先选中项目日志正文里的文字。";
    hideSelectionCommentButton();
    return;
  }
  comments.unshift(comment);
  setCommentsVisible(true);
  renderComments(root, comments, filter);
  const input = root.querySelector<HTMLTextAreaElement>("[data-project-log-comment-input]");
  input?.focus();
  hideSelectionCommentButton();
});
```

- [ ] **Step 6: Run the focused page test**

Run: `rtk test npx vitest run test/web-project-log-page.test.ts`
Expected: PASS

- [ ] **Step 7: Commit checkpoint**

```bash
git add web/client/src/pages/project-log/index.ts test/web-project-log-page.test.ts
git commit -m "feat: add project log selection comment trigger"
```

### Task 3: Style the floating button without disturbing page scroll or side panels

**Files:**
- Modify: `web/client/styles.css`
- Test: `test/web-project-log-page.test.ts`

- [ ] **Step 1: Add the floating trigger style block**

```css
.project-log-page__selection-comment {
  position: fixed;
  z-index: 30;
  pointer-events: auto;
  box-shadow: 0 18px 40px rgba(90, 79, 255, 0.18);
}

.project-log-page__selection-comment[hidden] {
  display: none;
}
```

- [ ] **Step 2: Keep existing comment-card and scroll-container rules intact**

```css
.project-log-page {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}
```

- [ ] **Step 3: Run the focused page test**

Run: `rtk test npx vitest run test/web-project-log-page.test.ts`
Expected: PASS

- [ ] **Step 4: Commit checkpoint**

```bash
git add web/client/styles.css test/web-project-log-page.test.ts
git commit -m "style: position project log selection comment trigger"
```

### Task 4: Update the project-log document and verify the real build

**Files:**
- Modify: `docs/project-log.md`
- Test: `test/project-log-doc.test.ts`

- [ ] **Step 1: Add the new timeline entry**

```md
### [2026-04-24 23:xx] 项目日志评论入口改为选区旁浮动按钮

- 修改内容：项目日志页正文选中文字后，会在选区附近显示浮动“评论”按钮，不再依赖顶部工具栏创建评论。
- 修改内容：点击浮动按钮后，继续展开右侧评论栏，并聚焦到新评论输入框，保留保存、删除、解决操作。
- 影响范围：项目日志页评论创建交互、前端页面测试、项目日志文档。
```

- [ ] **Step 2: Run the focused verification set**

Run: `rtk test npx vitest run test/web-project-log-page.test.ts test/web-project-log-route.test.ts test/project-log-doc.test.ts`
Expected: PASS

- [ ] **Step 3: Run TypeScript verification**

Run: `rtk tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Build the actual served WebUI bundle**

Run: `rtk proxy npm --prefix web run build`
Expected: PASS and output includes `client bundled to D:\Desktop\llm-wiki-compiler-main\web\dist\client`

- [ ] **Step 5: Commit checkpoint**

```bash
git add docs/project-log.md web/client/src/pages/project-log/index.ts web/client/styles.css test/web-project-log-page.test.ts
git commit -m "feat: move project log comments to selection trigger"
```
