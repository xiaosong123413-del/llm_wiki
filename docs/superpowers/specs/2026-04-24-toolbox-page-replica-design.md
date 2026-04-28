# Toolbox Page Replica Design

## Goal

Replace the existing `workspace -> toolbox` subpage with a data-driven page that closely mirrors the user-provided reference image while staying grounded in this project's real toolbox concepts.

The visual target is the reference page structure, not the current three-column editor.

## Confirmed Scope

In scope:

- keep the existing `workspace` route and left workspace navigation entry
- replace only the `toolbox` content region inside the workspace page
- preserve the reference page's top-level information architecture:
  - page header
  - search box
  - mode switch: `工作流 / 工具资产`
  - workflow board
  - right rail with `最近运行的 Agent`
  - right rail with `收藏夹 / 快捷入口`
  - lower tool-assets section
- rewrite visible titles and item names so they map to this project's real toolbox semantics rather than copying the screenshot literally
- introduce a new primary toolbox page model that can represent workflows, tool assets, recent runs, and favorites
- keep a migration layer so existing legacy Markdown files under `工具箱/*/*.md` still appear as tool assets
- keep editable management capability in the new page via section-level management entry points rather than the old always-open editor form

Out of scope:

- changing the workspace shell outside the toolbox view
- adding a new top-level route
- introducing a database
- redesigning unrelated workspace tabs
- cloud sync or permissions

## Design Intent

The current toolbox implementation is a CRUD editor. That is no longer the target.

The new target is a dashboard-style operating page:

- visually close to the reference image
- still driven by real project data
- structured so the page can grow without keeping all toolbox logic inside the already oversized `workspace/index.ts`

The page should feel like a light productivity console:

- white and pale-blue surfaces
- deep navy text
- one blue accent family
- large rounded panels
- soft shadow only
- no purple or dark-mode reinterpretation

## Information Architecture

The page keeps one main shell but exposes two top content modes:

1. `工作流`
2. `工具资产`

Both modes still share the same right rail.

### Header

Header contains:

- page title `工具箱`
- short subtitle describing the page purpose
- large search input for workflows and assets
- notification stub and project/account stub for visual parity

### Mode Switch

The first large segmented control switches between:

- `工作流`
- `工具资产`

`工作流` is the default mode because it matches the reference emphasis.

### Workflow Mode

Main left content shows:

- section title `工作流`
- supporting copy explaining workflow and agent relationship
- a grid of workflow cards

Each workflow row shows:

- workflow title
- `1:1` relation marker
- assigned agent name
- small icon or color accent

The content is project-specific. Representative mappings:

- `资料收集流 -> 收集 Agent`
- `内容整理流 -> 整理 Agent`
- `检索问答流 -> 检索 Agent`
- `编译发布流 -> 发布 Agent`

### Tool Asset Mode

Main left content shows:

- section title `工具资产`
- category chips such as `全部 / 软件 / 模板 / 检查清单 / 提示词 / 自动化 / 标准资料`
- a responsive asset card grid

Each asset card shows:

- title
- one-line purpose
- a kind badge
- optional source marker if imported from legacy Markdown

Legacy Markdown items are surfaced here through the migration layer.

### Right Rail

The right rail is always visible on desktop and contains two stacked panels:

1. `最近运行的 Agent`
2. `收藏夹 / 快捷入口`

Recent runs show:

- agent name
- relative time
- small icon/color marker

Favorites show:

- shortcut title
- optional star or quick-open affordance

## Data Model

The old Markdown-per-item structure is not enough to represent workflows, recent runs, and favorites. A new primary page model is required.

Primary storage file:

- `工具箱/toolbox.json`

This file is the source of truth for:

- page modes
- workflow definitions
- asset ordering/category
- recent runs
- favorites

Legacy support:

- existing files under `工具箱/*/*.md` remain valid legacy source material
- on read, the server imports Markdown toolbox entries into asset cards when they are not already represented in `toolbox.json`
- the UI may label these as imported/legacy-backed entries

This keeps old content visible without forcing the dashboard model to be encoded into Markdown frontmatter.

## API Shape

Keep the same `/api/toolbox` endpoint family, but change the payload from a flat CRUD list into a page-model response.

`GET /api/toolbox` returns:

- page metadata
- workflow collection
- asset categories
- tool asset entries
- recent runs
- favorites
- management-ready editable records

`PUT /api/toolbox` saves the toolbox page model and item edits back into `工具箱/toolbox.json`.

`POST /api/toolbox` creates a new managed record in the new page model.

`DELETE /api/toolbox` removes a managed record from the new page model.

The server remains responsible for:

- bootstrapping `工具箱/toolbox.json`
- importing legacy Markdown entries
- validating paths for legacy sources
- keeping the returned model safe and normalized

## Frontend Structure

The current `web/client/src/pages/workspace/index.ts` is already too large. The toolbox rewrite should not add more inline complexity there.

Required decomposition:

- keep `renderWorkspacePage()` as the entry point
- move toolbox-specific rendering and behavior into focused workspace toolbox modules
- keep toolbox state, rendering, and event binding out of the main workspace file

Expected split:

- toolbox view model types
- toolbox rendering helpers
- toolbox DOM binding / controller logic
- toolbox management modal or drawer helpers

## Editable Management

The page should not show the old permanent three-column editor by default.

Instead:

- each section gets a `管理` action
- `管理` opens a focused management surface for that section
- users can create, edit, save, and delete records there

The first round can use one shared modal or slide-over rather than separate complex managers for each section.

## Responsiveness

Desktop fidelity is the priority.

Allowed responsive behavior:

- right rail stacks below main content on narrow widths
- workflow rows and asset cards compress but keep the same hierarchy
- asset area can reflow into fewer columns

Not allowed:

- collapsing the dashboard into the old CRUD form
- removing the right rail
- replacing the segmented switch with unrelated navigation

## Verification

Verification should prove:

- `workspace -> toolbox` still opens the toolbox page
- the new replica-specific page text is rendered
- the right rail and lower assets section are present
- the new toolbox API returns the richer page model
- legacy Markdown entries still appear as migrated asset cards
- save/create/delete still operate through `/api/toolbox`
