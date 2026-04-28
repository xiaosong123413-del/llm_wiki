# Search Quality Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand search evaluation coverage, tune local hybrid ranking quality, and align the pending-task list with the current desktop-first roadmap.

**Architecture:** Keep the existing local search stack and RRF-based hybrid retrieval. Add broader sample evaluation coverage first, then adjust ranking heuristics in the current local search files so wiki concepts/procedures outrank weaker raw noise while `sources_full` remains visible as supporting evidence.

**Tech Stack:** Node.js, Vitest, TypeScript, JSON fixtures

---

### Task 1: Expand Search Evaluation Fixtures

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\search\queries.sample.json`
- Modify: `D:\Desktop\llm-wiki-compiler-main\search\qrels.sample.json`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\search-eval.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions in `test/search-eval.test.ts` that the sample corpus includes more than six queries, includes `raw/`, `sources_full/`, `wiki/concepts/`, `wiki/procedures/`, `wiki/episodes/`, and contains at least one qrel where raw is present in the corpus but not the top relevant target.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/search-eval.test.ts`
Expected: FAIL because the old corpus is too small and does not satisfy the new assertions.

- [ ] **Step 3: Write minimal fixture updates**

Expand `search/queries.sample.json` and `search/qrels.sample.json` with additional concept, procedure, temporal, entity, and supporting-source cases, keeping fixtures compact and readable.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/search-eval.test.ts`
Expected: PASS

### Task 2: Lock Ranking Expectations With Tests

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\search-hybrid.test.ts`
- Create or Modify: `D:\Desktop\llm-wiki-compiler-main\test\search-router-hybrid.test.ts` if needed
- Read: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-hybrid.ts`
- Read: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-router.ts`

- [ ] **Step 1: Write the failing tests**

Add focused tests for:
- procedure pages outrank episode/raw noise for explicit workflow queries
- concept pages outrank raw/source noise for concept queries
- `sources_full` remains visible for supporting evidence cases
- raw-only weak matches stay below clearer wiki targets

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/search-hybrid.test.ts`
Expected: FAIL on at least one new ordering assertion.

- [ ] **Step 3: Keep tests minimal**

Use small in-memory fixtures only. Do not pull in real indexes or unrelated service setup.

- [ ] **Step 4: Re-run failing tests**

Run: `npm test -- test/search-hybrid.test.ts`
Expected: still FAIL for the intended missing ranking behavior and not for fixture mistakes.

### Task 3: Tune Local Hybrid Ranking

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-hybrid.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\web\server\services\search-router.ts`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\search-hybrid.test.ts`

- [ ] **Step 1: Write minimal implementation**

Adjust ranking heuristics only where the new tests require:
- strengthen exact or near-exact title/path matches for wiki concept/procedure pages
- reduce raw-layer weak token scoring
- keep `sources_full` useful but secondary to clear wiki targets
- keep vector fusion supplementary rather than dominant

- [ ] **Step 2: Run ranking tests**

Run: `npm test -- test/search-hybrid.test.ts`
Expected: PASS

- [ ] **Step 3: Run router-adjacent tests**

Run: `npm test -- test/search-router.test.ts`
Expected: PASS

### Task 4: Verify Evaluation Output Still Works

**Files:**
- Read or Modify: `D:\Desktop\llm-wiki-compiler-main\scripts\search-eval.mjs`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\search-eval.test.ts`

- [ ] **Step 1: Run the evaluation script tests**

Run: `npm test -- test/search-eval.test.ts`
Expected: PASS

- [ ] **Step 2: Check script output manually**

Run: `node scripts/search-eval.mjs --queries search/queries.sample.json --qrels search/qrels.sample.json`
Expected: prints `P@`, `Recall@`, `MRR`, and `nDCG@` lines without crashing.

### Task 5: Update Pending Tasks

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-pending.json`
- Test: `D:\Desktop\llm-wiki-compiler-main\test\project-log-doc.test.ts`

- [ ] **Step 1: Write the failing test**

Update `test/project-log-doc.test.ts` to assert:
- removed ids are absent
- new `desktop-codex-subscription-login` id is present

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/project-log-doc.test.ts`
Expected: FAIL because the old pending list still contains the removed items and lacks the new desktop item.

- [ ] **Step 3: Write minimal pending-list update**

Edit `docs/project-pending.json` to remove:
- `flash-diary-audio-transcription`
- `mobile-codex-subscription-login`
- `mobile-offline-chat`

Add:
- `desktop-codex-subscription-login`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/project-log-doc.test.ts`
Expected: PASS

### Task 6: Final Verification

**Files:**
- Verify changed files only

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- test/search-eval.test.ts test/search-hybrid.test.ts test/search-router.test.ts test/project-log-doc.test.ts`
Expected: PASS

- [ ] **Step 2: Run TypeScript compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Summarize results**

Record which ranking behaviors changed, which pending items were removed, and which new pending item was added.
