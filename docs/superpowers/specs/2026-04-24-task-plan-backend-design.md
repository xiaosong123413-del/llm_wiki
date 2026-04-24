# Task Plan Backend Design

## Goal

Give the `任务计划页` real backend capabilities so that its visible controls no longer act as static UI only.

The page must support:

- real voice transcription
- real LLM-based plan generation
- real manual fine-tune persistence
- real schedule window switching
- real execution handoff

The backend must follow the existing project architecture instead of introducing a parallel stack.

## Confirmed Product Direction

This work is for the existing `workspace -> 任务计划页`.

The task plan page will use a dedicated agent configuration instead of an ambiguous global runtime.

Binding rule:

- first read the dedicated task-plan agent
- if that agent has `accountRef`, use that bound account
- if `accountRef` is empty, fall back to the global default LLM configuration

This matches the current settings model:

- global default LLM config in `设置 -> LLM 大模型`
- per-agent binding in `设置 -> Agent 配置`

## Out of Scope

Out of scope for this backend phase:

- redesigning the page layout
- replacing the current visual replica
- mobile-first adaptations
- general-purpose workflow engine refactors
- changing work-log, toolbox, chat, or source-gallery behavior
- multi-user synchronization
- long-running distributed execution

## Existing Project Constraints

The current repo already has usable building blocks:

- Express JSON API routing in `web/server/index.ts`
- local file-backed persistence patterns in `web/server/routes/*` and `web/server/services/*`
- LLM provider config in `/api/llm/config`
- saved API accounts in `/api/llm/accounts`
- agent config in `/api/agent-config`
- Cloudflare transcription helpers in `web/server/services/transcript-service.ts`
- existing run lifecycle primitives in `/api/runs/*`

The task-plan backend should reuse these patterns instead of inventing a new runtime abstraction.

## Recommended Architecture

Use a dedicated `task-plan` backend slice with four responsibilities:

1. page state persistence
2. voice transcription intake
3. plan generation and fine-tune updates
4. execution handoff

This should be implemented as:

- new route module under `web/server/routes/task-plan.ts`
- new service module(s) under `web/server/services/task-plan*.ts`
- file-backed state under `.llmwiki/task-plan/`

The frontend should call these APIs directly from `workspace/index.ts` when the user clicks task-plan controls.

## Dedicated Agent

Add one dedicated agent in `agents/agents.json`:

- id: `task-plan-assistant`
- purpose: generate and refine daily plans for the task plan page

This agent owns:

- plan generation prompt
- fine-tune prompt
- execution handoff prompt, if an LLM summary is needed
- provider/account/model selection

Runtime resolution rule:

1. load `task-plan-assistant`
2. if `accountRef` is set, resolve that account
3. otherwise use global LLM default config
4. use explicit agent model if provided, otherwise inherit the resolved account or default model

This keeps task-plan behavior observable and user-configurable from Settings.

## Button-to-Backend Mapping

The current task plan page has several visible controls. The backend contract should be explicit for each one.

### 1. `开始语音输入`

Expected behavior:

- accept an audio upload or desktop-recorded audio blob
- transcribe it
- persist the transcript as the latest voice input
- mark the first step as complete

Backend result:

- transcript text
- audio metadata
- updated page state

### 2. `AI 优先级判断 - 时间排序`

Expected behavior:

- take latest voice transcript
- read recent diary context
- read task pool context
- ask the dedicated task-plan agent to produce a ranked daily schedule
- persist the generated result as the current editable schedule

Backend result:

- structured schedule entries
- supporting rationale summary
- updated morning-flow step state

### 3. `进入微调`

Expected behavior:

- persist manual edits the user made to the generated schedule
- optionally re-run the dedicated task-plan agent to normalize times / priorities if needed
- mark the plan as user-confirmed

Backend result:

- saved editable schedule
- revision timestamp
- optional normalized schedule

### 4. `本周`

Expected behavior:

- load the current weekly planning window for the roadmap section

Backend result:

- current window metadata
- tree groups
- gantt rows for that week

### 5. previous / next controls

Expected behavior:

- shift the roadmap window backward or forward
- return the updated weekly dataset

Backend result:

- next visible roadmap payload only

### 6. `周视图`

Expected behavior:

- persist the selected roadmap view mode
- return roadmap data in that mode

Initial supported mode in scope:

- week view only

The button still needs backend persistence even if only one real mode ships first, so that future view expansion does not require schema churn.

### 7. `开始执行`

Expected behavior:

- take the confirmed schedule
- write an execution snapshot
- create an execution run record using the existing `runs` infrastructure where appropriate
- return an execution id and status

Backend result:

- immutable execution snapshot
- linked run metadata if a run is created
- execution state visible to the page

## Data Model

Persist task-plan state under `.llmwiki/task-plan/`.

Recommended files:

- `.llmwiki/task-plan/state.json`
- `.llmwiki/task-plan/executions.json`
- `.llmwiki/task-plan/audio/` for raw recordings if retained

### `state.json`

Owns the current editable page state:

- latest voice transcript
- latest transcript metadata
- morning-flow completion state
- current generated schedule
- current fine-tuned schedule
- roadmap view state
- selected roadmap window
- last generation metadata
- last execution reference

### `executions.json`

Append-only execution history:

- execution id
- created at
- schedule snapshot
- source generation id
- source fine-tune revision id
- linked run id if created
- status

This separation keeps mutable page state distinct from immutable execution history.

## Context Inputs for Planning

Plan generation must combine three context sources, mirroring the page copy:

1. latest voice input
2. recent diary context
3. task pool context

Source rules:

- latest voice input comes from task-plan state
- recent diary context comes from the existing workspace docs / work-log source
- task pool context comes from the existing task pool source once wired, or from the current static task-pool placeholder replacement path defined during implementation

The backend must not silently fabricate these inputs.

If one source is missing:

- return a structured incomplete-context response
- do not pretend planning succeeded

## API Design

Recommended endpoints:

- `GET /api/task-plan/state`
- `POST /api/task-plan/voice`
- `POST /api/task-plan/generate`
- `PUT /api/task-plan/schedule`
- `GET /api/task-plan/roadmap`
- `POST /api/task-plan/execute`

### `GET /api/task-plan/state`

Returns the current page state needed to hydrate the task-plan UI.

### `POST /api/task-plan/voice`

Accepts recorded audio and returns:

- transcript
- transcript metadata
- updated state summary

### `POST /api/task-plan/generate`

Triggers schedule generation from available context and returns:

- generated schedule
- rationale summary
- missing-context diagnostics if generation is blocked

### `PUT /api/task-plan/schedule`

Saves manual edits to the current schedule and returns:

- saved schedule
- revision info

### `GET /api/task-plan/roadmap`

Query params:

- `windowStart`
- `direction`
- `view`

Returns roadmap data for the requested window.

### `POST /api/task-plan/execute`

Consumes the confirmed schedule and returns:

- execution id
- execution status
- optional linked run id

## LLM Service Contract

The task-plan service should not call provider SDKs directly inside route handlers.

Instead:

- add a task-plan service that resolves the runtime LLM account from the dedicated agent
- build one prompt for initial plan generation
- build one prompt for schedule normalization after manual edits if needed

Prompt outputs should be strict JSON, not markdown.

Minimum schedule schema:

- item id
- title
- start time
- end time or duration
- priority
- source
- notes

This avoids brittle string parsing in the UI.

## Voice Transcription Contract

Voice input should reuse the existing transcription capability pattern already present in the repo.

Preferred order:

1. Cloudflare transcription if configured
2. explicit structured failure if transcription is unavailable

This phase should not add a second fallback transcription stack unless the existing repository already exposes one cleanly to the web server.

## Execution Handoff

`开始执行` should not merely toggle a UI flag.

It must:

- freeze the confirmed schedule into an execution snapshot
- optionally create a run record through the run manager when execution semantics require it
- return enough metadata for the UI to show that the schedule entered execution state

The first implementation can keep execution lightweight:

- create execution snapshot
- create run only if there is a concrete executable workflow attached

But the API contract must already support both cases.

## Error Handling

The backend should return structured, user-facing failure states instead of generic 500 strings.

Important failure classes:

- missing voice input
- missing diary context
- missing task-pool context
- task-plan agent not found
- bound account not resolvable
- default LLM config missing
- transcription unavailable
- LLM generation failed
- execution snapshot write failed

Each should map to a stable error code so the frontend can render useful messages.

## Testing Strategy

Tests should be added before implementation for the backend slice.

Required coverage:

- task-plan state file bootstrap and persistence
- agent resolution with explicit `accountRef`
- fallback to global default LLM config
- generation blocked when required context is missing
- roadmap window query behavior
- execution snapshot creation
- route-level success and failure payloads

Frontend integration tests for the task-plan page should then verify:

- clicking each wired button issues the correct API call
- task-plan state hydrates on page load
- generation results update the rendered schedule
- collapse / resize behavior does not affect task-plan API wiring

## Recommended Implementation Order

Implementation should proceed in this order:

1. dedicated task-plan state service
2. dedicated agent binding resolution
3. `GET /api/task-plan/state`
4. `POST /api/task-plan/generate`
5. `PUT /api/task-plan/schedule`
6. `GET /api/task-plan/roadmap`
7. `POST /api/task-plan/execute`
8. `POST /api/task-plan/voice`
9. frontend button wiring

This order keeps the planning loop usable early while leaving transcription as the only media boundary added later.

## Acceptance Criteria

This backend design is considered complete when implementation can satisfy all of these:

- task plan page loads real state from backend
- dedicated `task-plan-assistant` agent controls planning runtime
- changing that agent in Settings changes task-plan backend behavior
- voice input persists a real transcript
- plan generation produces structured schedule data
- fine-tune saves revised schedule data
- roadmap controls load persisted window data
- execute creates a durable execution snapshot

## Implementation Note

This spec intentionally chooses a dedicated task-plan backend slice instead of overloading chat, workspace docs, or generic run APIs.

That is the shortest path that still keeps the logic correct, testable, and understandable.
