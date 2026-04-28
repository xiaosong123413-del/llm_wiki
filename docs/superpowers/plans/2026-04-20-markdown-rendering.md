# Markdown Rendering Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Flash Diary and Sources Library render Markdown through the shared server-side renderer while keeping Chat preview on the same renderer path.

**Architecture:** Reuse `web/server/render/markdown.ts` as the single Markdown rendering contract for all in-scope pages. Flash Diary will become a preview-first page with an explicit edit toggle, Sources detail will switch from raw `<pre>` to rendered HTML, and Chat preview will remain on the existing drawer path without any renderer fork. Project documentation will be updated after the UX behavior changes land.

**Tech Stack:** TypeScript, Express, markdown-it, KaTeX, vanilla DOM, existing WebUI route/page modules, project-log markdown.

---

### Task 1: Lock the shared renderer contract and route expectations

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\render\markdown.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\pages.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\flash-diary.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\sources.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-page-renderer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { createRenderer } from "../web/server/render/markdown";

test("shared renderer renders wikilinks, table, and code fence", () => {
  const renderer = createRenderer({ wikiRoot: "C:/wiki" });
  const rendered = renderer.render(`# Title\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n\n[[wiki/index.md]]`);
  expect(rendered.html).toContain("<table>");
  expect(rendered.html).toContain("<code");
  expect(rendered.html).toContain("wikilink");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/web-page-renderer.test.ts -v`
Expected: the test fails until the existing route/renderer contract is confirmed in the codebase.

- [ ] **Step 3: Confirm the minimal contract**

```ts
// Keep markdown-it, KaTeX, and wikilinks in web/server/render/markdown.ts.
// Keep /api/page using the same renderer for the drawer preview.
// Keep flash-diary and sources routes returning data that can be rendered by the same renderer path.
```

- [ ] **Step 4: Run the focused verification command**

Run: `npm test -- test/web-page-renderer.test.ts -v`
Expected: PASS after the shared renderer contract is validated.

### Task 2: Make Flash Diary preview-first with explicit edit mode

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\flash-diary\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\assets\styles\pages\flash-diary.css`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\flash-diary.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-flash-diary-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { renderFlashDiaryPage } from "../web/client/src/pages/flash-diary/index";

test("flash diary defaults to preview mode and can switch to edit mode", () => {
  const page = renderFlashDiaryPage();
  expect(page.querySelector("[data-flash-diary-preview]")).toBeTruthy();
  expect(page.querySelector("[data-flash-diary-edit]")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/web-flash-diary-page.test.ts -v`
Expected: FAIL until the preview/edit split is implemented.

- [ ] **Step 3: Implement the preview-first surface**

```ts
// Add a preview container that consumes response.html by default.
// Keep the existing raw editor, but hide it behind an explicit edit toggle.
// Keep save writing the raw Markdown back to the same diary file.
```

- [ ] **Step 4: Run the focused verification command**

Run: `npm test -- test/web-flash-diary-page.test.ts -v`
Expected: PASS with preview and edit controls both present.

### Task 3: Render Sources detail body through the shared HTML path

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\sources\view.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\sources\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\sources.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\sources-full.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-sources-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { renderDetail } from "../web/client/src/pages/sources/view";

test("sources detail body no longer uses raw preformatted markdown", () => {
  const html = renderDetail({
    id: "1",
    path: "sources_full/example.md",
    title: "Example",
    kind: "source",
    tags: [],
    lists: [],
    compiled: false,
    concepts: [],
    attachments: [],
    modifiedAt: "2026-04-20T00:00:00.000Z",
    excerpt: "x",
    raw: "# Title",
    ocrText: "",
    highlights: [],
  });
  expect(html).not.toContain("sources-detail__raw");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/web-sources-page.test.ts -v`
Expected: FAIL until the detail body stops rendering raw `<pre>`.

- [ ] **Step 3: Switch the detail body to rendered HTML**

```ts
// Keep metadata inputs and actions.
// Replace the raw `<pre>` body with a rendered HTML container.
// Preserve GFM table, code fence, and wikilink rendering in the detail body.
```

- [ ] **Step 4: Run the focused verification command**

Run: `npm test -- test/web-sources-page.test.ts -v`
Expected: PASS after the body is HTML-rendered.

### Task 4: Keep Chat preview on the same renderer path

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\main.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\shell\drawer.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\pages.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-drawer-integration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { createDrawer } from "../web/client/src/shell/drawer";

test("chat preview keeps consuming html from the shared page route", () => {
  const drawer = createDrawer({
    shellRoot: document.createElement("div"),
    container: document.createElement("div"),
    onNavigate: () => {},
  });
  drawer.open({ path: "wiki/index.md", title: "Wiki", html: "<p>ok</p>" });
  expect(document.querySelector(".shell-drawer__body")?.innerHTML).toContain("<p>ok</p>");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/web-drawer-integration.test.ts -v`
Expected: FAIL until the drawer integration is verified.

- [ ] **Step 3: Preserve the existing drawer renderer path**

```ts
// Do not add a second markdown parser in the client.
// Continue requesting /api/page for preview content.
// Continue rendering the returned html in the drawer.
```

- [ ] **Step 4: Run the focused verification command**

Run: `npm test -- test/web-drawer-integration.test.ts -v`
Expected: PASS with no route or drawer regressions.

### Task 5: Update project log and validate the final spec

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\superpowers\plans\2026-04-20-markdown-rendering.md`

- [ ] **Step 1: Write the project-log update**

```md
- Flash Diary now defaults to preview mode and exposes an explicit edit toggle.
- Sources Library detail bodies render through the shared Markdown renderer.
- Chat preview continues to reuse the same renderer path through the page drawer.
```

- [ ] **Step 2: Run self-review against the spec**

Run: `Get-Content -Raw D:\Desktop\llm-wiki-compiler-main\docs\superpowers\plans\2026-04-20-markdown-rendering.md`
Expected: The plan covers renderer contract, flash diary preview/edit, sources HTML body, chat reuse, tests, and project-log update.

- [ ] **Step 3: Commit handoff only after implementation is complete**

```bash
git add docs/project-log.md docs/superpowers/plans/2026-04-20-markdown-rendering.md
git commit -m "docs: plan shared markdown rendering"
```
