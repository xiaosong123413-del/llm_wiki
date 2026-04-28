# Source Gallery Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add working source-gallery filters for `来源` (bucket), `标签` (match any selected tag), and `状态` (raw/source layer) with a single backend contract and minimal page wiring.

**Architecture:** Extend the existing `GET /api/source-gallery` contract so one response returns both filtered items and the current filter options derived from the real gallery scan. Keep filtering logic in `web/server/services/source-gallery.ts`, keep query parsing in `web/server/routes/source-gallery.ts`, and keep the source page as a thin client that sends selected values back to the same list endpoint.

**Tech Stack:** TypeScript, Express routes, Vitest, DOM page tests

---

### Task 1: Lock the Backend Contract with Failing Tests

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\sources-routes.test.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\sources-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("filters source gallery items by bucket, tag, and layer and returns filter metadata", async () => {
  const cfg = makeConfig();
  write(cfg.sourceVaultRoot, "raw/剪藏/demo.md", "---\ntags: [AI, 收藏]\n---\n# Clip");
  write(cfg.sourceVaultRoot, "raw/闪念日记/day.md", "---\ntags: [复盘]\n---\n# Diary");
  write(cfg.runtimeRoot, "sources_full/archive.md", "---\ntags: [Archive]\n---\n# Source");
  const response = createResponse();

  await handleSourceGalleryList(cfg)({
    query: {
      buckets: "剪藏,sources_full",
      tags: "Archive,AI",
      layers: "source",
    },
  } as Request, response as Response);

  expect(response.statusCode).toBe(200);
  expect(response.body.data.items.map((item: { path: string }) => item.path)).toEqual(["sources_full/archive.md"]);
  expect(response.body.data.filters.buckets).toEqual(["sources_full", "剪藏", "闪念日记"]);
  expect(response.body.data.filters.layers).toEqual(["raw", "source"]);
  expect(response.body.data.filters.tags).toEqual(["AI", "Archive", "复盘", "收藏"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk test -- npm test -- test/sources-routes.test.ts`
Expected: FAIL because `filters` is missing and bucket/tag/layer filtering is not applied.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface SourceGalleryFilters {
  buckets?: string[];
  tags?: string[];
  layers?: Array<"raw" | "source">;
}

export interface SourceGalleryFilterOptions {
  buckets: string[];
  tags: string[];
  layers: Array<"raw" | "source">;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk test -- npm test -- test/sources-routes.test.ts`
Expected: PASS for the new route contract and existing route tests stay green.

- [ ] **Step 5: Commit**

```bash
git add test/sources-routes.test.ts web/server/routes/source-gallery.ts web/server/services/source-gallery.ts
git commit -m "feat: add source gallery filter contract"
```

### Task 2: Lock the Page Behavior with Failing Tests

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\web-sources-page.test.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-sources-page.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("renders live source, tag, and status filters from the source gallery payload", async () => {
  const page = renderTestSourcesPage();
  await flush();
  await flush();

  expect(page.querySelector("[data-source-gallery-filter='bucket'] option[value='剪藏']")).toBeTruthy();
  expect(page.querySelector("[data-source-gallery-filter='tag'] option[value='Archive']")).toBeTruthy();
  expect(page.querySelector("[data-source-gallery-filter='layer'] option[value='source']")).toBeTruthy();
});

it("sends selected bucket, tag, and layer filters back to the source gallery API", async () => {
  const fetchMock = vi.mocked(fetch);
  const page = renderTestSourcesPage();
  await flush();
  await flush();

  page.querySelector<HTMLSelectElement>("[data-source-gallery-filter='bucket']")!.value = "sources_full";
  page.querySelector<HTMLSelectElement>("[data-source-gallery-filter='bucket']")!
    .dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  await flush();

  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("buckets=sources_full"))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk test -- npm test -- test/web-sources-page.test.ts`
Expected: FAIL because the three filter controls are still placeholder buttons and no new query parameters are sent.

- [ ] **Step 3: Write minimal implementation**

```ts
interface SourceGalleryFilterOptions {
  buckets: string[];
  tags: string[];
  layers: Array<"raw" | "source">;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk test -- npm test -- test/web-sources-page.test.ts`
Expected: PASS for the new filter rendering and request assertions, with existing page tests still green.

- [ ] **Step 5: Commit**

```bash
git add test/web-sources-page.test.ts web/client/src/pages/sources/index.ts
git commit -m "feat: wire source gallery filters"
```

### Task 3: Implement Filter Parsing and Service Filtering

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\source-gallery.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\source-gallery.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\sources-routes.test.ts`

- [ ] **Step 1: Add typed filter parsing in the route**

```ts
function listBody(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
```

- [ ] **Step 2: Pass parsed filters into the service**

```ts
const data = await listSourceGalleryItems(
  cfg.sourceVaultRoot,
  cfg.runtimeRoot,
  stringValue(req.query.query),
  parseSort(req.query.sort),
  {
    buckets: listBody(req.query.buckets),
    tags: listBody(req.query.tags),
    layers: listBody(req.query.layers).filter((value): value is "raw" | "source" => value === "raw" || value === "source"),
  },
);
```

- [ ] **Step 3: Filter scanned records and derive option lists**

```ts
const records = scanGallery(sourceVaultRoot, runtimeRoot, mediaIndex);
const filters = buildSourceGalleryFilterOptions(records);
const items = records
  .filter((item) => matchesSourceGalleryFilters(item, requestedFilters))
  .filter((item) => matchesQuery(sourceVaultRoot, runtimeRoot, item, query))
  .sort(compareGalleryRecords(sort));
```

- [ ] **Step 4: Verify the route test stays green**

Run: `rtk test -- npm test -- test/sources-routes.test.ts`
Expected: PASS with one filtered item and stable filter metadata ordering.

- [ ] **Step 5: Commit**

```bash
git add web/server/routes/source-gallery.ts web/server/services/source-gallery.ts test/sources-routes.test.ts
git commit -m "feat: add source gallery service filters"
```

### Task 4: Replace Placeholder Chips with Real Filter Controls

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\client\src\pages\sources\index.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\web-sources-page.test.ts`

- [ ] **Step 1: Add page state for selected filters**

```ts
interface PageState {
  items: SourceGalleryItem[];
  selectedIds: Set<string>;
  selectedPaths: Map<string, string>;
  refreshId: number;
  sort: SourceGallerySort;
  filters: SourceGalleryFilterOptions;
  selectedBuckets: string[];
  selectedTags: string[];
  selectedLayers: Array<"raw" | "source">;
}
```

- [ ] **Step 2: Render real selects instead of placeholder buttons**

```ts
<label class="source-gallery-filter-pill">
  <span>${TEXT.source}</span>
  <select multiple data-source-gallery-filter="bucket"></select>
</label>
```

- [ ] **Step 3: Serialize selected filter values into the existing list request**

```ts
const url = new URL("/api/source-gallery", window.location.origin);
url.searchParams.set("sort", state.sort);
if (query) url.searchParams.set("query", query);
if (state.selectedBuckets.length > 0) url.searchParams.set("buckets", state.selectedBuckets.join(","));
if (state.selectedTags.length > 0) url.searchParams.set("tags", state.selectedTags.join(","));
if (state.selectedLayers.length > 0) url.searchParams.set("layers", state.selectedLayers.join(","));
```

- [ ] **Step 4: Verify the page test stays green**

Run: `rtk test -- npm test -- test/web-sources-page.test.ts`
Expected: PASS and the new filter controls keep existing gallery behavior intact.

- [ ] **Step 5: Commit**

```bash
git add web/client/src/pages/sources/index.ts test/web-sources-page.test.ts
git commit -m "feat: activate source gallery page filters"
```

### Task 5: Final Verification and User-Visible Documentation

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`

- [ ] **Step 1: Update the project log only if the page behavior is now user-visible**

```md
- 修改内容：源料库顶部“来源 / 标签 / 状态”筛选不再只是占位入口，现已通过同一条 `/api/source-gallery` 合同返回动态选项并支持真实筛选。
```

- [ ] **Step 2: Run focused verification**

Run: `rtk test -- npm test -- test/sources-routes.test.ts test/web-sources-page.test.ts`
Expected: PASS with 0 failures.

- [ ] **Step 3: Run required repository checks**

Run: `rtk tsc --noEmit`
Expected: PASS

Run: `rtk npm run build`
Expected: PASS

Run: `rtk test -- npm test`
Expected: PASS

Run: `rtk proxy fallow`
Expected: PASS, or clear evidence if `fallow` is unavailable in this environment.

- [ ] **Step 4: Review changed files before reporting completion**

Run: `rtk git diff -- web/server/routes/source-gallery.ts web/server/services/source-gallery.ts web/client/src/pages/sources/index.ts test/sources-routes.test.ts test/web-sources-page.test.ts docs/project-log.md`
Expected: Only the filter contract, filter UI wiring, tests, and log entry are changed.

- [ ] **Step 5: Commit**

```bash
git add docs/project-log.md web/server/routes/source-gallery.ts web/server/services/source-gallery.ts web/client/src/pages/sources/index.ts test/sources-routes.test.ts test/web-sources-page.test.ts
git commit -m "feat: add source gallery filters"
```
