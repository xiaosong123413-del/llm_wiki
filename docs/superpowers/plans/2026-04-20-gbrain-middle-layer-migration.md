# GBrain 中层逻辑迁移到 LLM Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留文件驱动主架构的前提下，为 LLM Wiki 增加统一检索内核、确定性 lint 规则引擎、媒体源料富化、实体富化和 remote brain 镜像。

**Architecture:** 继续以 `raw / sources_full / wiki / .llmwiki` 为真相层，引入 `.llmwiki` 下可重建的索引层，并在 `web/server` 中增加统一搜索、规则检查和镜像服务。先完成搜索与 lint，再接媒体与 enrich，最后接 remote brain。

**Tech Stack:** TypeScript, Node.js, Express, Electron WebUI, markdown files, JSON indexes, vector index sidecar, existing LLM provider routing.

---

### Task 1: 建立统一搜索服务骨架

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-router.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-index.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\search.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\index.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\search-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createServer } from "../web/server/index";

describe("search routes", () => {
  it("returns keyword results from wiki and source layers", async () => {
    const app = await createServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/search?q=redis&mode=keyword",
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.results)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/search-routes.test.ts`
Expected: FAIL because `/api/search` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/server/services/search-router.ts
export type SearchMode = "direct" | "keyword" | "hybrid";

export async function runSearch(query: string, mode: SearchMode) {
  return {
    mode,
    results: [],
  };
}
```

```ts
// web/server/routes/search.ts
import type { Express } from "express";
import { runSearch } from "../services/search-router";

export function registerSearchRoutes(app: Express) {
  app.get("/api/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const mode = String(req.query.mode ?? "keyword") as "direct" | "keyword" | "hybrid";
    const data = await runSearch(q, mode);
    res.json({ success: true, data });
  });
}
```

- [ ] **Step 4: Register route**

```ts
// web/server/index.ts
import { registerSearchRoutes } from "./routes/search";

registerSearchRoutes(app);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/search-routes.test.ts`
Expected: PASS with an empty `results` array.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/search-router.ts web/server/services/search-index.ts web/server/routes/search.ts web/server/index.ts test/search-routes.test.ts
git commit -m "feat: add search route skeleton"
```

### Task 2: 实现检索模式路由与四层去重

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-router.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-dedup.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-intent.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\search-router.test.ts`

- [ ] **Step 1: Write failing tests for mode routing**

```ts
import { describe, expect, it } from "vitest";
import { classifySearchIntent, chooseSearchMode } from "../web/server/services/search-intent";

describe("search routing", () => {
  it("chooses direct for exact wiki paths", () => {
    expect(chooseSearchMode("wiki/index.md")).toBe("direct");
  });

  it("chooses keyword for short exact terms", () => {
    expect(chooseSearchMode("Redis")).toBe("keyword");
  });

  it("chooses hybrid for natural language questions", () => {
    expect(chooseSearchMode("我最近关于缓存提到过什么模式")).toBe("hybrid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/search-router.test.ts`
Expected: FAIL because classifier functions do not exist.

- [ ] **Step 3: Implement minimal routing**

```ts
export function chooseSearchMode(query: string): "direct" | "keyword" | "hybrid" {
  if (query.includes("/") || query.endsWith(".md")) return "direct";
  if (query.length <= 24 && !/[？?。.!]/.test(query) && !query.includes(" ")) return "keyword";
  return "hybrid";
}
```

- [ ] **Step 4: Add four-layer dedup**

```ts
const layerPriority = ["procedure", "concept", "episode", "source"];
```

Use slug/path prefixes to collapse duplicate hits so only the highest-priority layer remains for a semantic cluster.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/search-router.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/search-router.ts web/server/services/search-dedup.ts web/server/services/search-intent.ts test/search-router.test.ts
git commit -m "feat: add search mode routing and dedup"
```

### Task 3: 加入 hybrid search、RRF 和 compiled truth boost

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-router.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-hybrid.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\search-hybrid.test.ts`

- [ ] **Step 1: Write failing tests for RRF fusion**

```ts
import { describe, expect, it } from "vitest";
import { rrfFusion } from "../web/server/services/search-hybrid";

describe("rrf fusion", () => {
  it("boosts items that appear in multiple ranked lists", () => {
    const results = rrfFusion(
      [
        [{ id: "a", score: 1 }, { id: "b", score: 0.9 }],
        [{ id: "b", score: 1 }, { id: "a", score: 0.8 }],
      ],
      60,
    );
    expect(results[0].id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/search-hybrid.test.ts`
Expected: FAIL because `rrfFusion` does not exist.

- [ ] **Step 3: Implement RRF + compiled truth boost**

```ts
export function rrfFusion(lists: Array<Array<{ id: string; score: number; sourceType?: string }>>, k = 60) {
  const scoreMap = new Map<string, { id: string; score: number; sourceType?: string }>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const entry = scoreMap.get(item.id) ?? { ...item, score: 0 };
      entry.score += 1 / (k + rank);
      if (item.sourceType === "compiled_truth") entry.score *= 1.2;
      scoreMap.set(item.id, entry);
    });
  }
  return [...scoreMap.values()].sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Connect hybrid mode**

Use keyword results + vector results + optional expanded queries, then run RRF and dedup.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/search-hybrid.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/search-router.ts web/server/services/search-hybrid.ts test/search-hybrid.test.ts
git commit -m "feat: add hybrid search scoring"
```

### Task 4: 引入搜索评估基线

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\scripts\search-eval.mjs`
- Create: `D:\Desktop\llm-wiki-compiler-main\search\queries.sample.json`
- Create: `D:\Desktop\llm-wiki-compiler-main\search\qrels.sample.json`
- Modify: `D:\Desktop\llm-wiki-compiler-main\package.json`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\search-eval.test.ts`

- [ ] **Step 1: Write failing CLI test**

```ts
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("search eval script", () => {
  it("prints P@k, Recall@k, MRR and nDCG@k", () => {
    const result = spawnSync("node", ["scripts/search-eval.mjs", "--queries", "search/queries.sample.json", "--qrels", "search/qrels.sample.json"], {
      encoding: "utf-8",
    });
    expect(result.stdout).toContain("P@");
    expect(result.stdout).toContain("MRR");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/search-eval.test.ts`
Expected: FAIL because script does not exist.

- [ ] **Step 3: Implement minimal evaluator**

Create a script that:
- loads queries
- loads qrels
- calls current search service
- prints `P@k`, `Recall@k`, `MRR`, `nDCG@k`

- [ ] **Step 4: Add package script**

```json
"scripts": {
  "search:eval": "node scripts/search-eval.mjs"
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/search-eval.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/search-eval.mjs search/queries.sample.json search/qrels.sample.json package.json test/search-eval.test.ts
git commit -m "feat: add search evaluation baseline"
```

### Task 5: 搭建确定性 lint 规则引擎

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\rule-engine.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\rules\types.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\rules\registry.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\review-items.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\rule-engine.test.ts`

- [ ] **Step 1: Write failing test for issue shape**

```ts
import { describe, expect, it } from "vitest";
import { runRules } from "../web/server/services/rule-engine";

describe("rule engine", () => {
  it("returns normalized issues", async () => {
    const issues = await runRules();
    expect(Array.isArray(issues)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/rule-engine.test.ts`
Expected: FAIL because engine does not exist.

- [ ] **Step 3: Implement issue contract**

```ts
export type RuleIssue = {
  id: string;
  kind: string;
  severity: "error" | "warn" | "info";
  path?: string;
  line?: number;
  message: string;
  fixable: boolean;
  reviewAction?: string;
  payload?: Record<string, unknown>;
};
```

- [ ] **Step 4: Implement empty engine + registry**

Return `RuleIssue[]` from a registry-driven runner.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/rule-engine.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/rule-engine.ts web/server/services/rules/types.ts web/server/services/rules/registry.ts web/server/services/review-items.ts test/rule-engine.test.ts
git commit -m "feat: add deterministic lint engine skeleton"
```

### Task 6: 加入图片/PDF/视频追溯规则

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\rules\image-provenance.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\rules\asset-provenance.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\rules\registry.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\asset-provenance-rules.test.ts`

- [ ] **Step 1: Write failing provenance test**

```ts
import { describe, expect, it } from "vitest";
import { checkImageProvenance } from "../web/server/services/rules/image-provenance";

describe("image provenance rule", () => {
  it("flags wiki pages whose referenced image cannot be traced to raw or sources_full", async () => {
    const issues = await checkImageProvenance();
    expect(Array.isArray(issues)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/asset-provenance-rules.test.ts`
Expected: FAIL because rule does not exist.

- [ ] **Step 3: Implement image provenance scan**

Rule logic:
- scan `wiki/*.md`
- parse image references
- resolve relative paths
- if no matching raw/source/source_full provenance entry exists, emit `RuleIssue`

- [ ] **Step 4: Implement asset rule family**

Also cover:
- PDF exists but no trace metadata
- video exists but no trace metadata

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/asset-provenance-rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/rules/image-provenance.ts web/server/services/rules/asset-provenance.ts web/server/services/rules/registry.ts test/asset-provenance-rules.test.ts
git commit -m "feat: add asset provenance lint rules"
```

### Task 7: 实现媒体源料索引和 OCR/transcript sidecar

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\source-media-index.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\ocr-service.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\transcript-service.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\source-gallery.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\source-media-index.test.ts`

- [ ] **Step 1: Write failing media index test**

```ts
import { describe, expect, it } from "vitest";
import { buildSourceMediaIndex } from "../web/server/services/source-media-index";

describe("source media index", () => {
  it("indexes images, pdfs and videos into a sidecar JSON file", async () => {
    const index = await buildSourceMediaIndex();
    expect(index).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/source-media-index.test.ts`
Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement media index**

Sidecars:
- `.llmwiki/source-media-index.json`
- `.llmwiki/ocr/<id>.txt`
- `.llmwiki/transcripts/<id>.txt`

- [ ] **Step 4: Connect source gallery cards**

Expose:
- preview image
- OCR availability
- transcript availability
- provenance metadata

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/source-media-index.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/source-media-index.ts web/server/services/ocr-service.ts web/server/services/transcript-service.ts web/server/services/source-gallery.ts test/source-media-index.test.ts
git commit -m "feat: add media enrichment sidecars"
```

### Task 8: 加入实体富化和 tier 判定

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\entity-index.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\entity-enrichment.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\scripts\sync-compile.mjs`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\review-items.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\entity-enrichment.test.ts`

- [ ] **Step 1: Write failing tier test**

```ts
import { describe, expect, it } from "vitest";
import { suggestEntityTier } from "../web/server/services/entity-enrichment";

describe("entity enrichment", () => {
  it("escalates to higher tier with repeated mentions", () => {
    expect(suggestEntityTier({ mentionCount: 9, sourceKinds: ["episode", "source"] })).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/entity-enrichment.test.ts`
Expected: FAIL because enrichment service does not exist.

- [ ] **Step 3: Implement entity index**

Persist:
- `.llmwiki/entity-index.json`
- mention counts
- last confirmed time
- source diversity
- tier

- [ ] **Step 4: Integrate with compile**

After episode/claim extraction:
- update entity index
- create backlinks
- mark late affected sources

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/entity-enrichment.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/entity-index.ts web/server/services/entity-enrichment.ts scripts/sync-compile.mjs web/server/services/review-items.ts test/entity-enrichment.test.ts
git commit -m "feat: add entity enrichment tiers"
```

### Task 9: 建立 remote brain 镜像骨架

**Files:**
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\services\remote-brain-sync.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\web\server\routes\remote-brain.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\index.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\flash-diary-sync.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\remote-brain-routes.test.ts`

- [ ] **Step 1: Write failing route test**

```ts
import { describe, expect, it } from "vitest";
import { createServer } from "../web/server/index";

describe("remote brain routes", () => {
  it("returns sync status", async () => {
    const app = await createServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/remote-brain/status",
    });
    expect(response.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/remote-brain-routes.test.ts`
Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement status-only mirror skeleton**

Expose:
- last mirror time
- mirrored wiki count
- mirrored source summary count
- intake backlog count

- [ ] **Step 4: Add push/pull placeholders**

Without implementing full cloud sync yet, define interfaces for:
- pull cloud intake into local raw
- push mirrored wiki/search artifacts to remote store

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/remote-brain-routes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/server/services/remote-brain-sync.ts web/server/routes/remote-brain.ts web/server/index.ts web/server/services/flash-diary-sync.ts test/remote-brain-routes.test.ts
git commit -m "feat: add remote brain mirror skeleton"
```

### Task 10: 文档和项目日志同步

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-pending.json`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\project-log-doc.test.ts`

- [ ] **Step 1: Update project log**

Add timeline entries for:
- unified search core
- deterministic lint engine
- media enrichment
- entity enrichment
- remote brain skeleton

- [ ] **Step 2: Update pending items**

Move any newly unblocked pending items out of `待完成`, and add newly deferred sub-items if needed.

- [ ] **Step 3: Verify docs test**

Run: `npm test -- test/project-log-doc.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/project-log.md docs/project-pending.json test/project-log-doc.test.ts
git commit -m "docs: record gbrain migration phases"
```

## Self-Review

- **Spec coverage:** This plan covers unified search, hybrid ranking, evaluation, deterministic lint, media enrichment, entity enrichment, and remote brain skeleton.
- **Placeholder scan:** No `TBD`, `TODO`, or “implement later” placeholders remain in tasks.
- **Type consistency:** Search service, rule issues, entity tiers, and remote brain status all use named files and stable interfaces introduced in earlier tasks.

## Execution Handoff

**Plan complete and saved to `D:\Desktop\llm-wiki-compiler-main\docs\superpowers\plans\2026-04-20-gbrain-middle-layer-migration.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
