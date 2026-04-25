# Workspace Shared Task-Plan Data Design

## Goal

Make the workspace pages read and write one shared source of truth for:

- the `项目推进页` `今日时间表`
- the `任务计划页` `今日建议时间表`
- the `任务计划页` `已有任务池`
- the `任务池页`

The user confirmed two critical rules:

1. `项目推进页` only shows the formal schedule, not the in-progress draft.
2. `任务池页` is an editable management page, not a read-only mirror.

## Confirmed Scope

In scope:

- wire `项目推进页` `今日时间表` to shared persisted task-plan schedule data
- show only the confirmed schedule in `项目推进页`
- replace the `任务池页` placeholder with a real editable page backed by shared pool data
- keep `任务计划页` and `任务池页` editing the same persisted `pool.items`
- keep using the existing `/api/task-plan/state`, `/api/task-plan/pool`, and `/api/task-plan/schedule` routes
- add focused workspace page tests for the new shared behavior
- update `docs/project-log.md` after the user-visible behavior change is complete

Out of scope:

- renaming `task-plan` storage to a more generic planner model
- introducing a new backend store or new routes
- real-time cross-tab or cross-page push updates
- changing roadmap, recent status, text input, or morning-flow behavior
- redesigning the `项目推进页` or `任务池页` beyond what is required to show and edit shared data

## Current State

The current implementation is split in three different maturity levels:

- `任务计划页` already uses persisted backend state through `/api/task-plan/state`
- `项目推进页` still renders a hard-coded `今日时间表`
- `任务池页` is still a placeholder page with no real data binding

This means the shared behavior the user wants does not exist yet. The shortest correct change is to treat the existing task-plan state as the one source of truth and let the other two pages consume it directly.

## Chosen Approach

Use the existing `TaskPlanState` as the only shared source of truth for both schedule and pool data.

Why this approach:

- it is the smallest change that matches the requested behavior
- the persistence and validation paths already exist
- it avoids front-end-only mirroring that would drift on refresh
- it avoids a premature store refactor that the user did not ask for

Rejected alternatives:

### 1. Frontend-only mirroring between pages

Do not copy state from one workspace tab into another in memory.

Reason:

- refresh breaks the illusion
- it creates two truth models
- it adds complexity without improving the user-visible result

### 2. New generic planner store

Do not extract `task-plan` into a new generalized workspace planner domain in this round.

Reason:

- too much churn for a narrow synchronization task
- touches backend naming, routes, tests, and likely docs beyond the request

## Data Model

Reuse the current backend state shape:

- `state.schedule.items`
- `state.schedule.confirmed`
- `state.pool.items`

No schema changes are required.

### Schedule Semantics

The same persisted schedule model serves two UI contexts:

- `任务计划页`
  - can display and edit draft rows before confirmation
- `项目推进页`
  - only displays the formal version

The confirmed flag defines what `项目推进页` is allowed to show.

Rule:

- if `state.schedule.confirmed === true`, `项目推进页` renders `state.schedule.items`
- if `state.schedule.confirmed === false`, `项目推进页` renders an explicit empty state instead of the draft

This preserves the user’s requirement that only the formal schedule should sync into `项目推进页`.

### Pool Semantics

`state.pool.items` is shared across:

- `任务计划页`
- `任务池页`

Both pages are equal editors of the same persisted list.

Rule:

- edits from either page save through `/api/task-plan/pool`
- after save, both pages read the same persisted `pool.items`

No separate task-pool persistence layer is introduced.

## User-Visible Behavior

### 1. Project Progress Page

`项目推进页` `今日时间表` stops using hard-coded demo tasks.

New behavior:

- the panel loads from shared task-plan state
- when the schedule is confirmed, it renders the confirmed `schedule.items`
- when the schedule is not confirmed, it shows a clear empty state message
- when the schedule is confirmed but contains no items, it also shows the empty state
- the page does not expose draft schedule rows

Recommended empty-state copy:

- `今日正式日程尚未确认，请先到任务计划页确认日程。`

This page is display-only in this round. It does not gain independent schedule editing controls.

### 2. Task Plan Page

`任务计划页` keeps its current role as the main planning editor.

Behavior remains:

- pool edits save through `/api/task-plan/pool`
- schedule edits save through `/api/task-plan/schedule`
- the schedule only becomes visible in `项目推进页` after confirmation

No extra sync button is needed because persistence is already the sync boundary.

### 3. Task Pool Page

`任务池页` becomes a real editable management page.

Required capabilities:

- list shared pool items
- create a new pool item
- edit title, source, and priority
- delete a pool item
- save back to `/api/task-plan/pool`

This page should stay intentionally simple. It is a second editor for the same pool data, not a separate workflow.

## Frontend Architecture

### State Loading

Use the existing task-plan view state already loaded in the workspace page runtime.

Recommended change:

- make `project-progress` and `task-pool` render paths consume `taskPlanState`
- trigger `ensureTaskPlanLoaded()` not only for `task-plan`, but also for `project-progress` and `task-pool` when their render depends on shared planner data

This avoids introducing a second fetch or state model for the same payload.

## Rendering Strategy

### Project Progress

Change `renderProjectProgressView()` so it accepts `TaskPlanViewState`.

Inside that view:

- derive `confirmedScheduleItems` from `taskPlanState.state?.schedule`
- render the list only if `confirmed === true`
- otherwise render the empty-state card or copy

### Task Pool

Replace the placeholder `renderTaskPoolView()` with a real page that accepts `TaskPlanViewState`.

Prefer reusing existing task-plan helper behavior where it already exists:

- item ids
- priority labels
- source labels
- save request shape

Do not duplicate a second set of enum-like constants if existing ones can be reused locally in the same module.

## Interaction Model

### Save Boundary

Persistence remains explicit.

Rules:

- local draft edits stay local until save
- save writes through existing backend routes
- rerender reflects persisted shared state

### No Speculative Live Sync

Do not add:

- debounced auto-save
- optimistic cross-page broadcasts
- WebSocket or polling refresh

Those behaviors are beyond the request and would expand the scope unnecessarily.

## Backend Impact

No new routes are required.

Existing routes already cover the needed persistence:

- `GET /api/task-plan/state`
- `PUT /api/task-plan/pool`
- `PUT /api/task-plan/schedule`

No backend schema change is required because the current `TaskPlanState` already contains the two shared domains:

- `schedule`
- `pool`

## Files To Modify

### [web/client/src/pages/workspace/index.ts](D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts)

Modify to:

- pass `taskPlanState` into `renderProjectProgressView()`
- replace the static `今日时间表` list with confirmed shared schedule rendering
- replace the `任务池页` placeholder with a real editable pool page
- extend shared task-plan loading to tabs that now depend on task-plan state

### [web/client/styles.css](D:/Desktop/llm-wiki-compiler-main/web/client/styles.css)

Modify to:

- style the `任务池页` editable management layout
- style the `项目推进页` schedule empty state if needed
- keep the visual system aligned with the existing workspace page

### [test/web-workspace-page.test.ts](D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts)

Modify to cover:

- confirmed schedule appears in `项目推进页`
- unconfirmed schedule stays hidden in `项目推进页`
- `任务池页` reads shared pool data
- `任务池页` save writes through `/api/task-plan/pool`

### [docs/project-log.md](D:/Desktop/llm-wiki-compiler-main/docs/project-log.md)

Update after implementation to record the user-visible shared-data behavior.

## Testing Strategy

Use focused front-end page tests first.

Primary tests:

1. `项目推进页` renders confirmed shared schedule rows from task-plan state
2. `项目推进页` renders empty-state copy when schedule is not confirmed
3. `任务池页` renders shared `pool.items`
4. editing and saving from `任务池页` calls `/api/task-plan/pool` and rerenders persisted items

Secondary verification:

- run the existing workspace page test file
- run TypeScript compile
- run build

Known repo-level limitation:

- full `npm test` and `fallow` already have unrelated failures in the current repository state, so success for this change should be judged against focused workspace tests plus required verification commands, with unrelated existing failures reported explicitly

## Risks

### 1. Loading Semantics Drift

If `project-progress` does not trigger task-plan state loading, it will keep rendering before data exists and may show misleading empty output.

Mitigation:

- load task-plan state for any tab that depends on shared planner data

### 2. Draft Leakage Into Project Progress

If the `confirmed` flag is ignored, `项目推进页` would accidentally show in-progress edits.

Mitigation:

- guard rendering strictly on `schedule.confirmed`

### 3. Duplicate Editing Logic

If `任务池页` reimplements pool editing with different labels or payload rules, the two pages will drift.

Mitigation:

- reuse the existing task-plan pool item shape and save route
- keep the UI simple and aligned with the current task-plan editor

## Success Criteria

This change is complete when all of the following are true:

- `项目推进页` no longer shows hard-coded schedule items
- `项目推进页` displays confirmed shared schedule items from task-plan state
- unconfirmed schedule items do not appear in `项目推进页`
- `任务池页` is no longer a placeholder
- `任务池页` edits save to the same `pool.items` used by `任务计划页`
- `任务计划页` and `任务池页` visibly converge on the same persisted pool data
- focused workspace tests pass
- TypeScript and build verification pass
