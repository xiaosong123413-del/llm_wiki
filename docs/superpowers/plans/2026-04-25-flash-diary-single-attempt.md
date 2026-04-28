# Flash Diary Single Attempt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make flash diary auto compile consume the day's single attempt as soon as the run decides yesterday's diary is eligible, so same-day sync retries do not select that diary again after a failure.

**Architecture:** Keep the existing `flash_diary_auto_compile.last_run_on` state shape and move only its write timing earlier in `scripts/sync-compile.mjs`. Add one focused runner helper that persists the consumed daily slot before compile batches start, then reuse that returned state in the no-batch, success, and failure paths without polluting `completed_files`.

**Tech Stack:** Node.js ESM `.mjs` scripts, existing batch-state helpers, Vitest, `rtk`-wrapped npm commands.

---

## File Map

- `scripts/sync-compile.mjs`
  - Own the timing change for when the flash diary daily slot is consumed.
  - Export one small helper that persists the consumed `last_run_on` state before compile starts.
  - Reuse the consumed state in later result-writing branches.
- `test/sync-compile-runner.test.ts`
  - Lock the new state-write timing with focused temp-dir tests.
  - Prove same-day consumption is persisted before compile and that `completed_files` stays untouched.
- `test/flash-diary-auto-compile.test.ts`
  - No behavior rewrite expected here, but rerun it to confirm the existing candidate filter still works unchanged.

## Task 1: Lock the New Daily Attempt Semantics with Failing Tests

**Files:**
- Modify: `test/sync-compile-runner.test.ts`
- Test: `test/sync-compile-runner.test.ts`

- [ ] **Step 1: Write the failing runner helper tests**

Update the import block in `test/sync-compile-runner.test.ts` so it includes the new helper:

```ts
import {
  assertSourceInventoryHasContent,
  clearStaleLockIfSafe,
  consumeFlashDiaryAutoCompileAttempt,
  summarizeBatchProgress,
} from "../scripts/sync-compile.mjs";
```

Then append these two tests inside the existing `describe("sync compile runner helpers", ...)` block:

```ts
  it("persists the flash diary daily slot before compile batches start", async () => {
    tempDir = await makeTempDir("sync-runner-flash-attempt-");
    const state = {
      completed_files: ["clip.md"],
      flash_diary_auto_compile: { last_run_on: null },
    };

    const nextState = await consumeFlashDiaryAutoCompileAttempt({
      runtimeRoot: tempDir,
      state,
      now: new Date("2026-04-25T08:00:00"),
      shouldConsume: true,
    });

    expect(nextState.flash_diary_auto_compile.last_run_on).toBe("2026-04-25");
    expect(nextState.completed_files).toEqual(["clip.md"]);

    const stored = JSON.parse(
      await readFile(path.join(tempDir, ".llmwiki-batch-state.json"), "utf8"),
    ) as {
      completed_files: string[];
      flash_diary_auto_compile: { last_run_on: string | null };
    };

    expect(stored.completed_files).toEqual(["clip.md"]);
    expect(stored.flash_diary_auto_compile.last_run_on).toBe("2026-04-25");
  });

  it("does not write batch state when the flash diary daily slot is not consumed", async () => {
    tempDir = await makeTempDir("sync-runner-flash-skip-");
    const state = {
      completed_files: ["clip.md"],
      flash_diary_auto_compile: { last_run_on: "2026-04-24" },
    };

    const nextState = await consumeFlashDiaryAutoCompileAttempt({
      runtimeRoot: tempDir,
      state,
      now: new Date("2026-04-25T13:00:00"),
      shouldConsume: false,
    });

    expect(nextState).toEqual(state);
    await expect(
      readFile(path.join(tempDir, ".llmwiki-batch-state.json"), "utf8"),
    ).rejects.toThrow();
  });
```

- [ ] **Step 2: Run the focused runner test file and verify it fails**

Run:

```bash
rtk npm test -- test/sync-compile-runner.test.ts
```

Expected:

- FAIL
- import error or assertion failure because `consumeFlashDiaryAutoCompileAttempt` does not exist yet

- [ ] **Step 3: Commit the red test state**

Run:

```bash
git add test/sync-compile-runner.test.ts
git commit -m "test: cover flash diary daily attempt consumption"
```

## Task 2: Persist the Attempt Before Compile and Reuse That State Everywhere

**Files:**
- Modify: `scripts/sync-compile.mjs`
- Modify: `test/sync-compile-runner.test.ts`
- Test: `test/sync-compile-runner.test.ts`
- Test: `test/flash-diary-auto-compile.test.ts`

- [ ] **Step 1: Add the minimal helper to persist the consumed daily slot**

In `scripts/sync-compile.mjs`, export this helper near the other top-level exported helpers:

```js
export async function consumeFlashDiaryAutoCompileAttempt({
  runtimeRoot,
  state,
  now = new Date(),
  shouldConsume,
}) {
  if (!shouldConsume) return state;
  const nextState = markFlashDiaryAutoCompile(state, now);
  await writeBatchState(runtimeRoot, nextState);
  return nextState;
}
```

- [ ] **Step 2: Move the flash diary state write to the moment the run claims the daily slot**

In `main()` inside `scripts/sync-compile.mjs`, replace the current state setup:

```js
    const state = await readBatchState(roots.runtimeRoot);
    const completedFiles = new Set(state.completed_files);
    const files = await readAutoCompileFiles(
      roots.runtimeRoot,
      completedFiles,
      now,
      state,
    );
    const shouldMarkFlashDiaryRun = shouldRunFlashDiaryAutoCompile(now, state);
```

with:

```js
    const initialState = await readBatchState(roots.runtimeRoot);
    const completedFiles = new Set(initialState.completed_files);
    const files = await readAutoCompileFiles(
      roots.runtimeRoot,
      completedFiles,
      now,
      initialState,
    );
    const shouldConsumeFlashDiaryAttempt = shouldRunFlashDiaryAutoCompile(now, initialState);
    const runState = await consumeFlashDiaryAutoCompileAttempt({
      runtimeRoot: roots.runtimeRoot,
      state: initialState,
      now,
      shouldConsume: shouldConsumeFlashDiaryAttempt,
    });
```

- [ ] **Step 3: Remove the old delayed write branches and use `runState` consistently**

Still in `scripts/sync-compile.mjs`, make these replacements.

For the no-batch branch, replace:

```js
    if (batches.length === 0) {
      if (shouldMarkFlashDiaryRun) {
        await writeBatchState(roots.runtimeRoot, markFlashDiaryAutoCompile(state, now));
      }
      await writeFinalCompileResult(roots.runtimeRoot, {
        status: "succeeded",
        syncedMarkdownCount: importedCount,
        syncedAssetCount: assetCount,
        completedFilesCount: state.completed_files.length,
```

with:

```js
    if (batches.length === 0) {
      await writeFinalCompileResult(roots.runtimeRoot, {
        status: "succeeded",
        syncedMarkdownCount: importedCount,
        syncedAssetCount: assetCount,
        completedFilesCount: runState.completed_files.length,
```

and later in the same branch replace:

```js
          completedCount: state.completed_files.length,
```

with:

```js
          completedCount: runState.completed_files.length,
```

For the publish success branch, replace:

```js
      await writeBatchState(roots.runtimeRoot, shouldMarkFlashDiaryRun ? markFlashDiaryAutoCompile({
        completed_files: [...state.completed_files, ...compiledFiles],
      }, now) : {
        completed_files: [...state.completed_files, ...compiledFiles],
        flash_diary_auto_compile: state.flash_diary_auto_compile,
      });
```

with:

```js
      await writeBatchState(roots.runtimeRoot, {
        completed_files: [...runState.completed_files, ...compiledFiles],
        flash_diary_auto_compile: runState.flash_diary_auto_compile,
      });
```

Then replace the success/failure result counts:

```js
        completedFilesCount: state.completed_files.length + compiledFiles.length,
```

with:

```js
        completedFilesCount: runState.completed_files.length + compiledFiles.length,
```

and replace:

```js
        completedCount: state.completed_files.length + compiledFiles.length,
```

with:

```js
        completedCount: runState.completed_files.length + compiledFiles.length,
```

and replace:

```js
        completedFilesCount: state.completed_files.length,
```

with:

```js
        completedFilesCount: runState.completed_files.length,
```

This keeps the consumed daily slot on both success and failure while leaving `completed_files` success-only.

- [ ] **Step 4: Run the targeted regression suite and verify it passes**

Run:

```bash
rtk npm test -- test/sync-compile-runner.test.ts test/flash-diary-auto-compile.test.ts test/sync-compile-sync.test.ts
```

Expected:

- PASS
- the new runner helper tests pass
- the existing flash diary filter tests still pass without changes
- the earlier incremental `sources_full` sync tests still pass

- [ ] **Step 5: Commit the implementation**

Run:

```bash
git add scripts/sync-compile.mjs test/sync-compile-runner.test.ts
git commit -m "fix: consume flash diary auto-compile slot on first attempt"
```

## Self-Review

### Spec coverage

- same-day retry prevention after failure: Task 1 and Task 2
- keep only-yesterday rule: Task 2 Step 4 reruns `test/flash-diary-auto-compile.test.ts`
- keep morning-only rule: Task 2 Step 4 reruns the existing morning-window tests
- keep `completed_files` success-only: Task 1 Step 1 and Task 2 Step 3
- no new state field: Task 2 uses existing `last_run_on`

### Placeholder scan

- no `TODO` / `TBD` markers remain
- every code-changing step includes the exact code to add or replace
- every verification step includes an exact command and expected result

### Type consistency

- helper name is used consistently as `consumeFlashDiaryAutoCompileAttempt`
- runtime root parameter is consistently named `runtimeRoot`
- `runState` always represents the post-consumption state reused by later branches
