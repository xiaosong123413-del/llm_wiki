# Flash Diary Tiered Memory Auto Refresh Design

## Goal

Make flash diary `Memory` maintain both short-term and long-term memory in a single real file.

Short-term memory must appear above long-term memory, must summarize the most recent 7 days, and must refresh automatically every local day at `00:00` without depending on the user clicking the refresh button.

## Confirmed Scope

In scope:

- `wiki/journal-memory.md` structure changes for short-term + long-term memory
- short-term memory generation from the most recent 7 diary days
- daily automatic refresh at local `00:00`
- catch-up refresh when the midnight run was missed because the app/server was not running
- preserving long-term memory as the editable, accumulated record
- route and page behavior needed to surface the new memory content
- tests for service, route, startup scheduling, and page rendering expectations
- `docs/project-log.md` updates for the new Memory workflow

Out of scope:

- changing flash diary entry writing
- changing wiki comments storage or AI resolve behavior
- splitting Memory into multiple files
- changing the current flash diary list ordering or editor layout
- removing the existing manual refresh entry point unless requested separately

## Current Problem

The current Memory flow only maintains one long-term summary.

Today the system:

1. stores Memory in `wiki/journal-memory.md`
2. incrementally applies diary days through yesterday
3. preserves manual edits by using the current markdown as the long-term update base
4. refreshes only when the Memory route is opened or the user clicks the current refresh control

That does not satisfy the desired behavior because:

- there is no dedicated short-term memory layer
- the document order cannot show short-term memory above long-term memory
- freshness depends on a user action instead of a daily automatic refresh

## Required Behavior

### Single Real File

Memory continues to use one real markdown file:

- `wiki/journal-memory.md`

Comments, AI resolve, and manual editing continue to target this same file.

### Document Structure

The Memory document must have this top-level structure:

- `# Memory`
- `## 短期记忆（最近 7 天）`
- `## 长期记忆`

The short-term section is above the long-term section.

The long-term section keeps the existing long-term categories, nested under `## 长期记忆`:

- `### 人物与关系`
- `### 项目与系统`
- `### 方法论与偏好`
- `### 长期问题与矛盾`
- `### 近期变化`
- `### 来源范围`

### Short-Term Memory Rules

Short-term memory is a rolling 7-day view.

Rules:

- every refresh recalculates the short-term section from scratch
- the source window is the most recent 7 eligible diary dates up to yesterday
- if fewer than 7 eligible diary dates exist, use all available eligible diary dates
- short-term memory may overwrite prior manual edits inside the short-term section
- short-term refresh must not overwrite the long-term section

### Long-Term Memory Rules

Long-term memory remains incremental.

Rules:

- it keeps using the current long-term markdown as the base
- it applies only newly eligible diary dates through yesterday
- it preserves manual edits in the long-term section unless new diary content clearly changes them
- it continues to track the last applied diary date

### Daily Refresh Trigger

Automatic refresh must be time-based, not button-dependent.

Rules:

- schedule a background refresh for local `00:00` each day
- `24:00` is interpreted as the next calendar day's `00:00` in the machine's local timezone
- the refresh updates the short-term section for the new day window and applies any newly eligible long-term diary dates through yesterday

### Missed Midnight Catch-Up

The automatic refresh must be reliable even if the app/server was not running at midnight.

Rules:

- on server startup, check whether today's short-term refresh has already been completed
- on Memory page read, perform the same due-check before returning the page
- if the midnight run was missed, run one catch-up refresh immediately
- once today's refresh is recorded, startup or page access on the same day must not repeat it unnecessarily

### Manual Refresh Semantics

The existing manual refresh entry point may remain as an explicit override, but Memory correctness and freshness must no longer depend on the user using it.

## State Model

The existing Memory state file remains the persistence boundary:

- `.llmwiki/flash-diary-memory.json`

Keep the current long-term progress field:

- `lastAppliedDiaryDate`

Add one daily freshness field:

- `lastShortTermRefreshOn`

Interpretation after this change:

- `lastAppliedDiaryDate` means the latest diary date already absorbed into long-term memory
- `lastShortTermRefreshOn` means the local calendar date whose short-term window has already been generated

No second markdown file and no separate short-term comment file are introduced.

## Implementation Design

### Memory Service Boundary

Keep one service as the source of truth for Memory generation.

Refactor the service so it can:

- normalize or initialize the tiered Memory document structure
- read the current Memory file
- rebuild only the short-term section
- incrementally update only the long-term section
- persist the combined markdown and state atomically for one refresh pass

### Generation Order

Each refresh pass uses this order:

1. load all eligible diary inputs through yesterday
2. derive the most recent 7 eligible diary dates for short-term memory
3. rebuild the short-term section from those 7 days
4. apply any missing eligible diary dates to the long-term section
5. write the combined markdown back to `wiki/journal-memory.md`
6. update `lastShortTermRefreshOn = today`
7. update `lastAppliedDiaryDate` if new long-term diary days were absorbed

This keeps short-term deterministic and long-term additive.

### Scheduler Boundary

The daily timer belongs to the server process, not the browser page.

The server startup path must:

- create a small Memory refresh scheduler after config is loaded
- compute the delay until the next local midnight
- run the due refresh once that timer fires
- reschedule the next midnight after each run

The scheduler must call the same Memory refresh function used by the Memory route, so there is only one refresh implementation.

### Route Behavior

`GET /api/flash-diary/memory` continues to return the single Memory page, but before rendering it must ensure the daily refresh is up to date.

The list route may continue to expose the existing summary fields unless additional freshness fields are required by the current page.

## Files Affected

- `web/server/services/flash-diary-memory.ts`
- `web/server/routes/flash-diary.ts`
- `web/server/index.ts`
- `test/flash-diary-memory.test.ts`
- `test/flash-diary-routes.test.ts`
- `test/web-flash-diary-page.test.ts`
- `docs/project-log.md`

## Verification

Verification must prove:

1. Memory is still stored in exactly one real file: `wiki/journal-memory.md`
2. the generated document renders `短期记忆（最近 7 天）` above `长期记忆`
3. short-term memory uses only the most recent 7 eligible diary days through yesterday
4. short-term memory is fully regenerated and can evict day 8 from the visible short-term section
5. long-term memory still preserves manual edits and applies only newly eligible diary days
6. the service records `lastShortTermRefreshOn` for the local refresh day
7. a due refresh happens on startup or page read when midnight was missed
8. the same day is not refreshed repeatedly once the daily refresh is already recorded
9. the Memory route still returns rendered HTML for the same single page path
10. the flash diary page can render the tiered Memory content without breaking its current interaction model
