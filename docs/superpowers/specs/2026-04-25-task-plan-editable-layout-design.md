# Task Plan Editable Layout Design

## Goal

Turn the current `任务计划页` from a mostly poster-like replica into a usable one-screen planning workspace.

This round keeps the existing overall visual direction, but changes the interaction model so the top planning area and the bottom roadmap area behave like an editable tool instead of a static mockup.

## Confirmed Scope

In scope:

- replace `语音输入` with direct text input
- make `近日状态` editable and refreshable
- make `已有任务池` internally scrollable
- make `今日建议时间表` internally scrollable
- add an explicit edit action for `今日建议时间表`
- allow the height split between the top assistant block and bottom roadmap block to be adjusted by drag
- remove the unused blank area below the task plan page and make the page fill the available content region

Out of scope:

- redesigning the left workspace shell or secondary navigation
- changing non-task-plan tabs
- introducing new provider configuration concepts
- mobile-first redesign
- speculative workflow automation beyond the visible controls

## Product Direction

The old task-plan page was built as a strict visual replica with an artboard-scale model.

That is no longer the right interaction model for the page.

The new target is:

- still visually close to the current light productivity reference
- but no longer a fixed poster
- fully editable inside one screen
- with internal scrolling inside cards instead of outer-page blank space
- and with user-controlled vertical space allocation between the top planner and bottom roadmap

This means the implementation should stop treating the task-plan page as a single scaled image-like board.

## User-Visible Behavior

### 1. Text Input Replaces Voice Input

The first card keeps the same position in the top flow, but changes from upload-driven voice transcription to direct text entry.

New behavior:

- the user can type directly into a multiline input area
- the input represents the current planning thought dump for the day
- the primary action becomes a text-save action, not an audio-pick action

The visible copy can still keep the general planning-assistant framing, but the control model must clearly be text-based.

The previous hidden file input and microphone-trigger flow should be removed from this page.

### 2. Recent Status Becomes Editable and Refreshable

The second card, `近日状态`, becomes a writable planning field with a refresh affordance.

New behavior:

- the main content is editable directly in the card
- the card header includes a refresh button
- clicking refresh asks the backend to regenerate the status summary from current task-plan context
- after refresh, the returned text replaces the editable field content
- the user may then keep editing it manually and save it as the current state

The backend-generated version is an assistant suggestion, not a locked value.

### 3. Task Pool Supports Internal Vertical Scroll

The `已有任务池` card should not grow the entire page.

New behavior:

- card height is fixed by the layout
- the task list area scrolls internally with `overflow-y`
- long task pools remain usable without pushing the roadmap off-screen

### 4. Suggested Schedule Supports Internal Vertical Scroll and Explicit Edit Entry

The `今日建议时间表` card should support long schedules and explicit user editing.

New behavior:

- the schedule list area scrolls internally
- the header includes a `修改` button
- clicking `修改` enters schedule edit mode
- in edit mode, each row can be changed directly:
  - time
  - title
  - priority
- saving still persists through the task-plan schedule backend

The current `进入微调` action is not removed, but the schedule card itself must now expose an explicit local edit affordance.

### 5. Top Planner and Bottom Roadmap Support Height Dragging

The main task-plan page is split into:

- top planning assistant region
- bottom roadmap region

Between them there should be a visible drag handle.

New behavior:

- dragging changes the vertical split ratio
- the top region can become taller
- the bottom region can become taller
- each region keeps its own internal overflow behavior
- the chosen split should persist locally for the current browser environment

The drag interaction should feel like a workspace split pane, not a decorative separator.

### 6. Task Plan Page Must Fill the Available Content Height

The current page leaves blank space at the bottom because the scaled artboard does not truly participate in the workspace layout.

New behavior:

- the task-plan root fills the available workspace content height
- the viewport no longer depends on global scale math to determine visual occupancy
- blank space below the roadmap should disappear under normal desktop conditions

The correct fix is layout-based, not padding-based.

## Recommended Architecture

Use the existing task-plan state and route slice, but extend it with writable textual fields and status regeneration.

Recommended shape:

1. keep the existing task-plan backend module family
2. add new state fields for editable text content
3. add dedicated endpoints for direct text updates and status regeneration
4. refactor the task-plan frontend rendering away from artboard scaling and into full-height split layout

This is the shortest path that preserves the current backend investment while aligning the page with the new interaction model.

## Backend Changes

### New or Expanded State

The task-plan state should explicitly own:

- `voice.transcript`
  - now treated as the direct planning text input, even if the property name remains temporarily unchanged internally
- `statusSummary`
  - editable recent-status text
- existing `pool.items`
- existing `schedule`
- existing `roadmap`

If a rename would cause unnecessary churn, keep the stored field names stable and reinterpret them at the UI layer for now.

### New Endpoints

The page needs two new backend capabilities.

#### 1. Save direct text input

Purpose:

- persist the first card’s current multiline text

Expected contract:

- request includes plain text content
- response returns updated task-plan state

#### 2. Refresh recent status

Purpose:

- regenerate `近日状态` from current planning input, recent diary context, and task pool context

Expected contract:

- backend resolves the same task-plan assistant provider path already used for schedule generation
- response returns the refreshed recent-status text and updated task-plan state

### Expanded Schedule Editing

The existing schedule save route already persists edited rows.

This can remain the persistence boundary for:

- row edits from the new `修改` interaction
- final confirmation after fine-tune

No new schedule persistence route is needed if the current one already covers the full row payload.

## Frontend Changes

## Layout Model

Replace the current artboard-scaling behavior with a full-height column layout.

Recommended structure:

- task-plan root fills parent height
- top morning-flow strip remains fixed height
- main content area becomes a two-row split layout
- row 1: planning assistant
- row 2: roadmap board
- a drag handle sits between row 1 and row 2

This split should be implemented through layout sizing, not transform scaling.

### Card Interaction Model

#### Text input card

- use a real `textarea`
- support direct typing and save action
- preserve visual card styling from the reference

#### Recent status card

- use a real `textarea` or content-editable text area with predictable form semantics
- add a refresh button in the header
- allow save after manual edits

#### Task pool card

- keep list rendering
- wrap list area in a scroll container

#### Schedule card

- wrap rows in a scroll container
- add `修改` button in header
- show editable fields in edit mode
- preserve existing priority chip styling where possible

### Persistence of Split Height

Persist the user’s chosen top/bottom split ratio in local browser storage.

This setting is view-local and should not require backend storage.

It only needs to restore for the same desktop environment.

## Error Handling

- direct text save failure should show inline feedback in the task-plan page
- status refresh failure should keep the current edited text intact
- schedule edit failure should keep the user in edit mode with current draft values
- split-drag is local-only and should fail silently back to defaults if stored ratio cannot be read

## Testing

Verification must cover both backend and frontend behavior.

### Backend

- saving direct text input updates task-plan state
- refreshing recent status returns regenerated text
- schedule save still works with edited rows

### Frontend

- task-plan page renders textarea-based first card
- recent-status card exposes refresh action
- task pool and schedule card expose internal scroll containers
- schedule edit button enters editable mode
- drag handle updates top/bottom split state
- task-plan page fills available workspace height without artboard-scale dependency

## Implementation Notes

- keep changes surgical to the existing task-plan route and workspace page
- do not refactor unrelated workspace tabs
- do not preserve the old hidden file-input voice path on this page
- do not add fallback interaction models that were not requested

## Success Criteria

This work is complete when:

- the first card is direct text input, not audio upload
- the second card can both refresh and be edited manually
- the third and fourth cards scroll internally
- the fourth card has an explicit modify action
- the top and bottom sections resize vertically via drag
- the task-plan page uses the full available content height with no unused blank region underneath
