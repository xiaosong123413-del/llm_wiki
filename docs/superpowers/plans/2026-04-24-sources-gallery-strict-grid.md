# Sources Gallery Strict Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the sources page into a strict gallery view with one fixed filter row, no title hero, no composer card, and six full equal-size cards visible at the `1920x1080 / 100%` desktop baseline.

**Architecture:** Keep the existing `renderSourcesPage()` fetch and card rendering flow, but simplify the page chrome to a filter-only shell and make the gallery viewport the only scroll container. Move the desktop two-row sizing rule into a small TypeScript helper that writes a CSS variable from the live viewport height, then let CSS enforce equal card frames and clipping.

**Tech Stack:** Vanilla TypeScript, existing `web/client/styles.css`, Vitest with jsdom, `rtk`-wrapped npm commands.

---

## File Map

- `web/client/src/pages/sources/index.ts`
  - Own the page markup, state, event binding, gallery rendering, and viewport row-height helper.
  - Remove all composer-only state, text keys, handlers, and rendering branches.
- `web/client/styles.css`
  - Own the `源料库` page shell, fixed filter row spacing, internal viewport scrolling, strict card row sizing, and clipping.
  - Delete the old `source-gallery-composer*` / `source-gallery-type*` selectors that become dead once the composer card is removed.
- `test/web-sources-page.test.ts`
  - Lock the strict gallery contract:
    - no title hero
    - no composer card
    - filter-only chrome
    - pure gallery grid
    - exported row-height helper applies the two-row desktop math

## Task 1: Remove the Title Hero and Composer Card

**Files:**
- Modify: `test/web-sources-page.test.ts:9-157`
- Modify: `web/client/src/pages/sources/index.ts:75-463`
- Modify: `web/client/styles.css:6424-6621`

- [ ] **Step 1: Write the failing DOM regression test**

Replace the import and the first two gallery-layout tests in `test/web-sources-page.test.ts` with this version:

```ts
import {
  renderSourcesPage,
} from "../web/client/src/pages/sources/index.js";

it("renders a filter-only chrome and a pure gallery grid", async () => {
  const page = renderSourcesPage();
  await flush();
  await flush();

  expect(page.querySelector(".source-gallery-page")).toBeTruthy();
  expect(page.querySelector(".source-gallery-page__filters")).toBeTruthy();
  expect(page.querySelector(".source-gallery-page__filters-head")).toBeNull();
  expect(page.querySelector(".source-gallery-composer")).toBeNull();
  expect(page.textContent).not.toContain("SOURCES GALLERY");
  expect(page.textContent).not.toContain("新增剪藏 / 日记");

  const grid = page.querySelector(".source-gallery-grid");
  const cells = page.querySelectorAll(".source-gallery-grid > .source-gallery-grid__cell");
  expect(grid?.getAttribute("data-layout")).toBe("gallery-3col");
  expect(cells.length).toBe(2);
});

it("keeps a dedicated internal gallery viewport for source cards only", async () => {
  const page = renderSourcesPage();
  await flush();
  await flush();

  const chrome = page.querySelector(".source-gallery-page__chrome");
  const viewport = page.querySelector(".source-gallery-page__viewport");
  const grid = page.querySelector(".source-gallery-grid");

  expect(chrome).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(viewport?.contains(grid as Node)).toBe(true);
  expect(chrome?.textContent).toContain("搜索");
  expect(chrome?.textContent).toContain("排序");
  expect(chrome?.textContent).toContain("来源");
  expect(chrome?.textContent).toContain("标签");
  expect(chrome?.textContent).toContain("状态");
});
```

- [ ] **Step 2: Run the gallery test file and verify it fails for the right reason**

Run:

```bash
rtk npm test -- test/web-sources-page.test.ts
```

Expected:

- FAIL
- one assertion says `.source-gallery-page__filters-head` still exists
- one assertion says `.source-gallery-composer` still exists

- [ ] **Step 3: Remove the title block and composer markup from `renderSourcesPage()`**

In `web/client/src/pages/sources/index.ts`, replace the current `PageState` shape and the `renderSourcesPage()` shell with this structure:

```ts
interface PageState {
  items: SourceGalleryItem[];
  selectedIds: Set<string>;
  refreshId: number;
  sort: SourceGallerySort;
}

export function renderSourcesPage(): HTMLElement {
  const root = document.createElement("section");
  root.className = "source-gallery-shell";
  root.innerHTML = `
    <div class="source-gallery-page">
      <div class="source-gallery-page__chrome">
        <section class="source-gallery-page__filters panel">
          <div class="source-gallery-filters">
            <label class="source-gallery-filter-pill source-gallery-filter-pill--search">
              <span>${TEXT.search}</span>
              <input data-source-gallery-query type="search" placeholder="${TEXT.searchPlaceholder}" />
            </label>
            <label class="source-gallery-filter-pill">
              <span>排序</span>
              <select data-source-gallery-sort>
                <option value="modified-desc">最近编辑</option>
                <option value="modified-asc">最早编辑</option>
                <option value="created-desc">最新创建</option>
                <option value="created-asc">最早创建</option>
              </select>
            </label>
            <button type="button" class="source-gallery-filter-chip is-placeholder">${TEXT.source}</button>
            <button type="button" class="source-gallery-filter-chip is-placeholder">${TEXT.tag}</button>
            <button type="button" class="source-gallery-filter-chip is-placeholder">${TEXT.status}</button>
          </div>
        </section>

        <section class="source-gallery-selectionbar hidden" data-source-gallery-selectionbar>
          <div class="source-gallery-selectionbar__summary" data-source-gallery-selection-count>${TEXT.selectedSummary(0)}</div>
          <div class="source-gallery-selectionbar__actions">
            <button type="button" class="btn btn-secondary btn-inline" data-source-gallery-batch="chat">${TEXT.importChat}</button>
            <button type="button" class="btn btn-secondary btn-inline" data-source-gallery-batch="ingest">${TEXT.batchIngest}</button>
            <button type="button" class="btn btn-secondary btn-inline" data-source-gallery-batch="inbox">${TEXT.toInbox}</button>
            <button type="button" class="btn btn-secondary btn-inline" data-source-gallery-batch="delete">${TEXT.batchDelete}</button>
            <button type="button" class="btn btn-secondary btn-inline" data-source-gallery-batch="clear">${TEXT.clearSelection}</button>
          </div>
        </section>
      </div>

      <div class="source-gallery-page__viewport">
        <section class="source-gallery-grid" data-layout="gallery-3col" data-source-gallery-grid></section>
      </div>

      <p class="source-gallery-page__status" data-source-gallery-status></p>
    </div>
  `;

  const state: PageState = {
    items: [],
    selectedIds: new Set(),
    refreshId: 0,
    sort: "modified-desc",
  };

  bindEvents(root, state);
  void refreshGallery(root, state);
  return root;
}
```

- [ ] **Step 4: Remove composer-only text, handlers, and rendering branches**

In `web/client/src/pages/sources/index.ts`, make the file internally consistent after the composer is gone:

1. shrink `TEXT` to the keys still used by the page
2. delete the `createType` field from `PageState`
3. delete the `[data-source-gallery-type]` branch from `bindEvents()`
4. delete the `[data-source-gallery-create-save]` branch from `bindEvents()`
5. change `renderCards()` so it renders only actual source cards
6. delete the unused helpers:
   - `renderComposerCard`
   - `syncComposerType`
   - `saveComposer`
   - `resolveComposerStatus`

The final `renderCards()` body should look like this:

```ts
function renderCards(grid: HTMLElement, state: PageState): void {
  const cards = state.items.map((item) => `
    <article class="source-gallery-card source-gallery-grid__cell panel">
      <label class="source-gallery-card__check">
        <input type="checkbox" data-source-gallery-select="${escapeHtml(item.id)}" ${state.selectedIds.has(item.id) ? "checked" : ""} />
      </label>
      <div class="source-gallery-card__media">
        ${item.previewImageUrl
          ? `<img src="${escapeHtml(item.previewImageUrl)}" alt="${escapeHtml(item.title)}" />`
          : `<div class="source-gallery-card__excerpt">${escapeHtml(buildCardExcerpt(item))}</div>`}
      </div>
      <div class="source-gallery-card__body">
        <h3 title="${escapeHtml(resolveCardTitle(item))}">${escapeHtml(resolveCardTitle(item))}</h3>
        <div class="source-gallery-card__meta">
          <span class="source-gallery-badge">${escapeHtml(item.layer === "source" ? "sources_full" : "raw")}</span>
          <span class="source-gallery-badge is-soft">${escapeHtml(item.bucket)}</span>
          ${item.mediaCount > 0 ? `<span class="source-gallery-badge is-soft">${escapeHtml(formatMediaKinds(item.mediaKinds))}</span>` : ""}
        </div>
        <div class="source-gallery-card__tags">
          ${item.tags.slice(0, 6).map((tag) => `<span class="source-gallery-tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <footer class="source-gallery-card__footer">
        <span>${escapeHtml(formatDate(item.modifiedAt))}</span>
        <div class="source-gallery-card__actions">
          <button type="button" class="icon-btn source-gallery-card__icon-action" aria-label="${TEXT.openOriginal}" title="${TEXT.openOriginal}" data-source-gallery-view="${escapeHtml(item.id)}"><span aria-hidden="true">↗</span></button>
          <button type="button" class="icon-btn source-gallery-card__icon-action" aria-label="${TEXT.toInbox}" title="${TEXT.toInbox}" data-source-gallery-card-inbox="${escapeHtml(item.id)}"><span aria-hidden="true">↪</span></button>
        </div>
      </footer>
    </article>
  `).join("");

  grid.innerHTML = cards;
}
```

- [ ] **Step 5: Delete the now-dead composer CSS selectors**

Remove these selectors from `web/client/styles.css` because the page no longer renders those elements:

```css
.source-gallery-composer,
.source-gallery-composer__types,
.source-gallery-type,
.source-gallery-type.is-active,
.source-gallery-composer__field,
.source-gallery-composer__field span,
.source-gallery-composer__field input,
.source-gallery-composer__field textarea,
.source-gallery-composer__save
```

Also remove `.source-gallery-page__filters-head` and `.source-gallery-page__filters-head h1` because the title layer is gone.

- [ ] **Step 6: Run the gallery test file and verify it passes**

Run:

```bash
rtk npm test -- test/web-sources-page.test.ts
```

Expected:

- PASS
- no test references the composer card anymore

- [ ] **Step 7: Commit the shell simplification**

Run:

```bash
git add test/web-sources-page.test.ts web/client/src/pages/sources/index.ts web/client/styles.css
git commit -m "refactor: make sources page a pure gallery shell"
```

## Task 2: Enforce the Desktop Two-Row Height Rule

**Files:**
- Modify: `test/web-sources-page.test.ts:9-180`
- Modify: `web/client/src/pages/sources/index.ts:152-430`
- Modify: `web/client/styles.css:6404-6686`

- [ ] **Step 1: Write the failing row-height helper tests**

Extend the `test/web-sources-page.test.ts` import and add these two tests:

```ts
import {
  applySourceGalleryRowHeight,
  computeSourceGalleryRowHeight,
  renderSourcesPage,
} from "../web/client/src/pages/sources/index.js";

it("computes a strict two-row height from the gallery viewport", () => {
  expect(computeSourceGalleryRowHeight(680, 16)).toBe(332);
  expect(computeSourceGalleryRowHeight(640, 16)).toBe(312);
});

it("stores the computed row height on the page shell", async () => {
  const page = renderSourcesPage();
  await flush();
  await flush();

  applySourceGalleryRowHeight(page, 680, 16);
  expect(page.style.getPropertyValue("--source-gallery-row-height")).toBe("332px");
});
```

- [ ] **Step 2: Run the gallery test file and verify it fails for the right reason**

Run:

```bash
rtk npm test -- test/web-sources-page.test.ts
```

Expected:

- FAIL
- import error or assertion failure because `computeSourceGalleryRowHeight` and `applySourceGalleryRowHeight` do not exist yet

- [ ] **Step 3: Add the exported row-height helpers and wire them into the page lifecycle**

In `web/client/src/pages/sources/index.ts`, add this helper block near `renderSourcesPage()`:

```ts
const SOURCE_GALLERY_ROW_GAP_PX = 16;
const SOURCE_GALLERY_MIN_ROW_HEIGHT_PX = 220;

export function computeSourceGalleryRowHeight(
  viewportHeight: number,
  rowGap: number = SOURCE_GALLERY_ROW_GAP_PX,
): number {
  return Math.max(SOURCE_GALLERY_MIN_ROW_HEIGHT_PX, Math.floor((viewportHeight - rowGap) / 2));
}

export function applySourceGalleryRowHeight(
  root: HTMLElement,
  viewportHeight: number,
  rowGap: number = SOURCE_GALLERY_ROW_GAP_PX,
): void {
  root.style.setProperty("--source-gallery-row-height", `${computeSourceGalleryRowHeight(viewportHeight, rowGap)}px`);
}

function syncSourceGalleryLayout(root: HTMLElement): void {
  const viewport = root.querySelector<HTMLElement>(".source-gallery-page__viewport");
  if (!viewport) return;
  applySourceGalleryRowHeight(root, viewport.clientHeight);
}
```

Then wire it into the page:

```ts
export function renderSourcesPage(): HTMLElement {
  const root = document.createElement("section");
  root.className = "source-gallery-shell";
  // ...existing innerHTML...

  const state: PageState = {
    items: [],
    selectedIds: new Set(),
    refreshId: 0,
    sort: "modified-desc",
  };

  const resizeHandler = () => syncSourceGalleryLayout(root);
  window.addEventListener("resize", resizeHandler);
  (root as HTMLElement & { __dispose?: () => void }).__dispose = () => {
    window.removeEventListener("resize", resizeHandler);
  };

  bindEvents(root, state);
  void refreshGallery(root, state).then(() => syncSourceGalleryLayout(root));
  return root;
}
```

And call the sync helper after DOM-affecting updates:

```ts
state.items = items;
renderCards(grid, state);
syncSelectionBar(root, state);
syncSourceGalleryLayout(root);
setStatus(root, TEXT.itemCount(state.items.length));
```

```ts
function syncSelectionBar(root: HTMLElement, state: PageState): void {
  const selectionBar = root.querySelector<HTMLElement>("[data-source-gallery-selectionbar]");
  const count = root.querySelector<HTMLElement>("[data-source-gallery-selection-count]");
  if (!selectionBar || !count) return;
  selectionBar.classList.toggle("hidden", state.selectedIds.size === 0);
  count.textContent = TEXT.selectedSummary(state.selectedIds.size);
  syncSourceGalleryLayout(root);
}
```

- [ ] **Step 4: Tighten the CSS so the desktop shell is filter-row + viewport only**

In `web/client/styles.css`, replace the current `源料库` shell block with this tighter version:

```css
.source-gallery-shell {
  height: 100%;
  box-sizing: border-box;
  min-height: 0;
  overflow: hidden;
}

.source-gallery-page {
  --source-gallery-row-height: 320px;
  height: 100%;
  box-sizing: border-box;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 8px;
  padding: 8px 12px 10px;
  overflow: hidden;
  overflow-x: clip;
}

.source-gallery-page__chrome {
  display: grid;
  gap: 8px;
  min-height: 0;
}

.source-gallery-page__filters {
  padding: 8px 12px;
}

.source-gallery-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.source-gallery-page__viewport {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-right: 4px;
}

.source-gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: var(--source-gallery-row-height);
  gap: 16px;
  align-items: stretch;
}

.source-gallery-grid__cell {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.source-gallery-card {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  gap: 10px;
  padding: 14px;
  overflow: hidden;
}

.source-gallery-card__media {
  min-height: 0;
  height: 100%;
  display: flex;
  overflow: hidden;
  border-radius: 16px;
  background: var(--surface);
}

.source-gallery-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.source-gallery-card__excerpt {
  display: -webkit-box;
  height: 100%;
  overflow: hidden;
  padding: 18px;
  color: var(--text-secondary);
  line-height: 1.72;
  word-break: break-word;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 8;
}

.source-gallery-card__body {
  display: grid;
  gap: 8px;
  align-content: start;
  min-height: 0;
}

.source-gallery-card__body h3 {
  display: -webkit-box;
  overflow: hidden;
  font-size: 18px;
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
```

Keep the existing mobile breakpoints, but remove any remaining composer-specific selector branches under those breakpoints too.

- [ ] **Step 5: Run the targeted test file and then the build**

Run:

```bash
rtk npm test -- test/web-sources-page.test.ts
rtk npm run build
```

Expected:

- gallery test file PASS
- `npm run build` exits `0`

- [ ] **Step 6: Commit the strict gallery sizing work**

Run:

```bash
git add test/web-sources-page.test.ts web/client/src/pages/sources/index.ts web/client/styles.css
git commit -m "feat: enforce strict sources gallery grid"
```

## Self-Review

### Spec coverage

- remove top title layer: Task 1, Steps 1-6
- keep only fixed filter row: Task 1, Step 3 and Task 2, Step 4
- remove composer card: Task 1, Steps 3-5
- pure gallery grid: Task 1, Steps 1-4
- gallery-only scrolling: Task 2, Step 4
- equal card outer size: Task 2, Steps 3-4
- six complete cards at desktop baseline: Task 2, Steps 1-4
- crop images and clip text instead of stretching: Task 2, Step 4

### Placeholder scan

- no placeholder markers remain in the plan
- every code-changing step includes concrete code
- every verification step includes an exact command and expected outcome

### Type consistency

- `PageState` no longer contains `createType`
- exported helpers are named consistently across tests and implementation:
  - `computeSourceGalleryRowHeight`
  - `applySourceGalleryRowHeight`
  - `syncSourceGalleryLayout`
