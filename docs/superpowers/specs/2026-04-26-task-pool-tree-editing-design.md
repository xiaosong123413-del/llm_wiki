# Task Pool Tree Editing Design

## Goal

Turn the current `任务池` `树状图` view from a read-only projection into a lightweight editor that supports:

- mouse-wheel zoom while hovering the tree canvas
- trackpad pinch zoom
- direct node editing inside the tree
- `Enter`-driven child or sibling creation
- drag-and-drop task re-linking from one project to another
- level deletion that preserves tasks instead of deleting them accidentally
- explicit save back to the shared task pool

The target is not a free-form mind-map tool. It is an editable tree view over the existing shared `任务池`.

## Confirmed Scope

In scope:

- keep the existing `列表视图 / 树状图` split
- keep the current left-to-right hierarchy: `领域 -> 项目 -> 任务`
- make the tree canvas editable in the `任务池` page
- allow task drag-and-drop onto project nodes
- allow `Enter` to create the next level based on the selected node
- allow deleting domain and project levels without deleting the underlying tasks
- keep an explicit save boundary instead of live persistence
- keep using the existing shared task-pool save route
- add focused workspace-page tests for tree editing behavior
- update `docs/project-log.md` after the user-visible implementation is complete

Out of scope:

- replacing the DOM tree with an SVG or canvas editor
- introducing a second backend store for tree nodes
- adding free-form spatial node placement
- adding auto-save, optimistic sync, or cross-tab live sync
- changing the `健康` domain page in this round
- turning projects or domains into separately persisted entities outside the current task items

## Current State

The current `树状图` mode is a filtered visual projection of `pool.items`.

Today it already supports:

- domain chips
- tree-level switching (`领域 / 项目 / 任务`)
- checkbox filtering in the sidebar
- sidebar collapse and resize
- button-based zoom

But it does not support:

- direct editing
- node creation
- node deletion
- drag-and-drop re-linking
- wheel or pinch zoom

The shortest correct change is to keep the current DOM-based structure and extend it into an editor, instead of replacing it with a new rendering model.

## Chosen Approach

Use the existing HTML tree structure as the editable surface and reuse the shared task-pool draft and save flow.

Why this approach:

- it is the smallest change that matches the requested behavior
- the current tree already renders from shared task-pool data
- the existing `poolDraft` and `PUT /api/task-plan/pool` flow already define the correct save boundary
- it avoids building a second editor model that would drift from the list view

Rejected alternatives:

### 1. Rebuild the tree as SVG or a free-form canvas editor

Do not replace the existing DOM tree with a separate visual editor engine.

Reason:

- much larger interaction surface
- requires new hit-testing, editing overlays, and drag logic
- expands far beyond the requested behavior

### 2. Keep the tree read-only and push all edits into side forms or dialogs

Do not make the tree a navigation-only shell with modal editing.

Reason:

- the user explicitly wants editing on the tree itself
- it adds more clicks without improving correctness

## Core Product Rules

### 1. The Shared Task Pool Remains the Source of Truth

The editable tree is still only a view over `TaskPlanPoolItem[]`.

There is no separate persisted structure for:

- domains
- projects
- tree nodes

Those levels continue to be derived from item fields:

- `domain`
- `project`
- `title`

### 2. Tasks Are the Real Persisted Records

Domains and projects remain grouping labels, not standalone records.

This means:

- creating a domain or project really means creating or reassigning task items
- deleting a domain or project never forces task deletion unless the user explicitly deletes tasks themselves

### 3. Tree Editing Uses an Explicit Save Boundary

All tree edits apply to the local shared task-pool draft first.

Nothing writes to persisted shared state until the user clicks `保存`.

This matches the user’s confirmed preference and reduces accidental persistence from drag or delete actions.

## Editing Model

## Draft Model

Tree editing should reuse the same draft collection already used by the list view:

- `taskPlanState.poolDraft`
- `taskPlanState.poolEditMode`

Recommended rule:

- entering tree mode does not create a second draft model
- tree editing is available only while the shared task-pool editor is in edit mode
- `保存` and `取消` continue to act on the same shared draft whether the user is in list view or tree view

This keeps list and tree editing consistent and prevents two unsynchronized draft states.

## Node Types

The editable tree has three logical node types:

- `domain`
- `project`
- `task`

Only `task` corresponds to a directly persisted row.

`domain` and `project` nodes are derived group labels and must be edited by mutating the tasks under them.

## Selection and Text Editing

Interaction rules:

- single click selects a node
- clicking the selected node title enters single-line inline edit mode
- blur commits the edit
- `Enter` commits the current edit and then performs the level-creation rule for that node type

Text edit semantics:

- editing a `task` node changes that task item’s `title`
- editing a `project` node renames the `project` field for every task currently grouped under that project
- editing a `domain` node renames the `domain` field for every task currently grouped under that domain

Fallback buckets are not directly renamable:

- `未归类`
- `待分组`

Those labels are structural placeholders that come from missing fields and should stay derived.

## Enter Behavior

The user confirmed the following behavior:

- pressing `Enter` on a `领域` node creates a child `项目`
- pressing `Enter` on a `项目` node creates a child `任务`
- pressing `Enter` on a `任务` node creates a same-level sibling `任务`

Concrete draft mutations:

### Domain node

Create a new empty task item under that domain with:

- `domain = selected domain`
- `project = ""`
- `title = ""`

The UI should immediately focus the new `项目` label editor. Until the user enters a real project name, that task belongs to the domain’s `待分组` bucket.

### Project node

Create a new empty task item under that project with:

- `domain = selected domain`
- `project = selected project`
- `title = ""`

The UI should immediately focus the new task title input.

### Task node

Create a new task item as a sibling task with:

- `domain = current task domain`
- `project = current task project`
- `title = ""`

The UI should immediately focus the new task title input.

## Deletion Model

The user explicitly rejected subtree deletion.

Deletion semantics are therefore:

### Delete task

- remove that single task item from the draft

### Delete project

- remove the project grouping label
- do not remove its tasks
- every task that belonged to that project stays in the same domain
- each affected task gets `project = ""`
- those tasks immediately appear under that domain’s `待分组`

### Delete domain

- remove the domain grouping label
- do not remove its tasks
- each affected task gets:
  - `domain = ""`
  - `project = ""`
- those tasks immediately appear under `未归类 / 待分组`

Virtual fallback groups are not deletable:

- `未归类`
- `待分组`

They are derived from empty fields and only disappear when no remaining task resolves into them.

## Drag-and-Drop Model

Only task nodes are draggable in this round.

The user’s requested re-link behavior is:

- a task can be dragged onto a project node
- dropping the task onto a project reassigns the task to that project

Drop semantics:

- `task.project = target project`
- `task.domain = target domain`

This ensures the task moves as a real linked task under the chosen project and domain.

Unsupported drops in this round:

- domain onto domain
- project onto project
- task onto task
- project onto task

This keeps drag behavior narrow and predictable.

### Re-linking Tasks From Deleted Projects

After a project is deleted, its tasks remain visible under `待分组`.

The intended recovery path is:

1. delete the project
2. the tasks fall into the current domain’s `待分组`
3. drag each task onto another project node to relink it

This matches the user’s stated goal that tasks should remain tasks and be reconnectable by drag-and-drop.

## Zoom and Scroll Model

The user confirmed two input rules:

- mouse wheel while hovering the canvas should zoom directly
- trackpad pinch should zoom

The tree still also needs normal scrolling.

To preserve both, the editor should distinguish wheel input sources:

- mouse-wheel style wheel events over the canvas adjust zoom
- trackpad pinch events adjust zoom
- ordinary touchpad two-finger scroll keeps native canvas scrolling

Implementation rule:

- preserve native scrolling on the scroll container
- intercept only zoom-intent wheel input
- continue clamping zoom to the existing bounds

Reuse current zoom bounds unless testing shows they are too tight:

- min `70%`
- max `130%`
- reset `90%`

Button-based `- / + / 重置` zoom controls remain.

## Rendering Model

Do not replace the current left-to-right layout.

The tree should keep:

- one root label
- domain column
- project column
- task column

But nodes become interactive in edit mode:

- selected state
- editable title state
- drag source state for tasks
- drop-target highlight state for projects
- unsaved-draft status

The current sidebar remains and continues to control:

- tree level
- option filtering
- color legend

## Filtering Behavior

The current filter model stays valid:

- selected tree level decides what appears in the sidebar checkbox list
- checked options decide which parts of the tree are visible

Tree editing must work against the currently visible subset without breaking hidden data.

Rules:

- edits mutate the underlying draft items, not only the rendered subset
- hiding a node through filter does not discard its draft changes
- delete and drag operations act on the selected draft items even if the filter changes immediately afterward

## Save and Cancel Behavior

Reuse the existing shared task-pool actions.

Behavior:

- `编辑` enters shared pool edit mode
- tree becomes editable
- `保存` persists the current `poolDraft` through the existing save route
- `取消` discards all unsaved tree edits and restores persisted `pool.items`

The page should show a clear unsaved-draft indicator while the draft differs from persisted state.

Recommended copy:

- `树状图有未保存更改`

## Data Model Impact

No backend schema change is required.

The existing item shape remains sufficient:

- `id`
- `title`
- `priority`
- `source`
- `domain`
- `project`

Tree editing works by mutating `title`, `domain`, and `project` in the draft.

No new persisted `parentId`, `order`, or node table is needed in this round.

## Frontend Architecture

### Shared Draft Helpers

Add focused task-pool tree helpers inside the workspace page module or a nearby workspace helper module.

Needed responsibilities:

- derive editable tree nodes from `poolDraft`
- resolve selected node identity
- create draft rows for `Enter`
- rename grouped tasks for domain or project edits
- convert delete actions into task field rewrites
- reassign dragged task items to target projects

### Tree Edit State

Extend `TaskPoolViewState` with only the local interaction state needed for the editor.

Expected additions:

- selected node identity
- editing node identity
- dragging task id
- pending focus id for new nodes
- draft dirty indicator if needed locally

Do not introduce a second long-lived draft collection in `TaskPoolViewState`.

### Save Path

Tree save should call the same shared pool save path already used by list editing.

This keeps:

- server validation
- persistence shape
- cross-page synchronization semantics

identical across both views.

## Files To Modify

### [D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts](D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts)

Modify to:

- extend `TaskPoolViewState` for tree editing interaction state
- reuse shared pool draft editing in tree mode
- add wheel and pinch zoom handling for the tree canvas
- render editable node states
- bind inline text editing, `Enter`, delete, drag, and drop handlers
- route tree save and cancel through the existing shared pool persistence flow

### [D:/Desktop/llm-wiki-compiler-main/web/client/styles.css](D:/Desktop/llm-wiki-compiler-main/web/client/styles.css)

Modify to:

- style selected nodes
- style inline edit inputs
- style draggable task nodes
- style project drop targets
- style unsaved-draft state
- preserve current tree spacing while remaining readable under zoom

### [D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts](D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts)

Modify to cover:

- tree edit mode entry
- `Enter` creation rules
- project deletion preserving tasks in `待分组`
- domain deletion preserving tasks in `未归类 / 待分组`
- task drag-and-drop onto a project
- tree save through the shared pool route
- wheel or pinch zoom state updates where practical in DOM tests

### [D:/Desktop/llm-wiki-compiler-main/docs/project-log.md](D:/Desktop/llm-wiki-compiler-main/docs/project-log.md)

Update after implementation is complete to document:

- editable tree behavior
- drag-to-relink task behavior
- wheel and pinch zoom support

## Testing

Verification must cover the observable user behavior, not internal helper trivia.

Minimum test cases:

1. switching to tree mode and entering edit mode exposes editable nodes
2. pressing `Enter` on a project creates a new task draft under that project
3. pressing `Enter` on a task creates a sibling task draft
4. deleting a project does not remove its tasks and instead moves them under `待分组`
5. deleting a domain does not remove its tasks and instead moves them under `未归类 / 待分组`
6. dragging a task onto another project reassigns its `project` and `domain`
7. saving the tree persists the mutated shared task pool
8. canceling edits restores the persisted shared task pool

## Risks and Constraints

### 1. Group Renames Affect Multiple Tasks

Editing a domain or project label mutates multiple task items at once.

This is intentional, but the implementation must make that scope explicit in the code and UI behavior.

### 2. Filtered Views Can Hide Side Effects

When a rename, delete, or drag changes grouping fields, the visible subset may change immediately.

The implementation must keep selection and focus behavior stable enough that this does not feel like a disappearing-node bug.

### 3. Wheel Input Is Device-Sensitive

Trackpad scroll versus pinch needs careful event handling so normal scrolling does not get hijacked.

The implementation should favor predictable native scrolling and only intercept clear zoom-intent input.

## Success Criteria

This feature is complete when:

- the tree can be edited without leaving the tree view
- `Enter` creates the correct next level
- deleting a project or domain never destroys tasks unexpectedly
- tasks can be re-linked to projects by drag-and-drop
- mouse-wheel and pinch zoom both work on the tree canvas
- all changes stay local until the user explicitly saves
- the saved result remains synchronized with the shared task pool used by the other workspace pages
