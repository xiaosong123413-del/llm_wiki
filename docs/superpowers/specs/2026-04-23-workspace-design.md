# Workspace Design

## Goal

Add a new first-position global rail entry named `工作台` to the current LLM Wiki WebUI and render a new full-page workspace with a horizontal secondary nav:

- `项目推进页`
- `任务计划页`
- `任务池`

The default secondary page is `项目推进页`.

This round only builds static, high-fidelity frontend views. No backend APIs, persistence, voice, or task execution are introduced.

## Scope

In scope:

- Add a new top-level hash route: `#/workspace`
- Add `工作台` as the first top rail button
- Render a new full-page workspace shell with horizontal secondary navigation
- Build static first versions of:
  - `项目推进页`
  - `任务计划页`
- Build a switchable placeholder for:
  - `任务池`

Out of scope:

- New server routes
- Real task/project data
- Real audio capture or sync
- Deep-link child routes for secondary tabs
- Any changes to chat/search/wiki behavior outside routing and shell visibility

## Route And Navigation Model

The existing router stays minimal.

- Add `workspace` to `RouteName`
- Add `workspace` to `ROUTE_TABLE`
- Use `#/workspace` as the only top-level route for the new area
- Keep secondary navigation as page-local state inside the workspace page
- Default secondary tab is `project-progress`

This preserves the current lightweight hash router and avoids expanding into nested route parsing for a purely static first pass.

## Shell Integration

The workspace page is a full-page route, like settings/sources/wiki/project-log.

Expected shell behavior when `route.name === "workspace"`:

- hide the legacy browser pane
- hide the legacy chat node
- set `data-route="workspace"` on `#workspace-shell`
- set `data-full-page`
- mount a new workspace page element into the main slot

The rail button order becomes:

1. `workspace`
2. `chat`
3. `flash-diary`
4. `sources`
5. `wiki`
6. `check`
7. `sync`
8. `review`
9. `graph`
10. `settings`

## Workspace Page Structure

The new page is a standalone full-page surface with a calm operational dashboard feel:

- restrained white/light panel layout
- dense but readable information
- no decorative hero sections
- no nested cards
- no purple-only palette dominance

Top structure:

1. header block with eyebrow, page title, and short copy
2. horizontal secondary nav pills/tabs
3. secondary page body

## Secondary Tabs

Internal tab ids:

- `project-progress`
- `task-plan`
- `task-pool`

Visible labels:

- `项目推进页`
- `任务计划页`
- `任务池`

Default:

- `project-progress`

## 项目推进页

Reference comes from the user-provided “专心·高效工作台” image. The implementation should adapt that layout to the existing LLM Wiki visual language rather than copy pixel-for-pixel.

Three-column layout:

### Left column

- 今日时间表 / to do list card
- add-task button
- stacked to-do rows with time and category chips
- bottom sync hint row

### Center column

- current task workspace panel
- status chips for date / focus / progress
- task goal summary
- three checklist columns:
  - 完成标准
  - 今日行动
  - 后续行动
- two main action buttons
- risk/reminder card
- workflow chain card
- milestone card
- bottom tool drawer strip

### Right column

- 今日完成表 card
- completion celebration area
- vertical list of completed items
- analysis CTA

## 任务计划页

Reference comes from the user-provided “任务计划页” image.

Three-column layout:

### Left column

- 晚间规划 / 今日想做 card
- segmented switch
- voice capture card
- mobile sync status card
- 最近状态 card with several status rows
- four life-area stat rows

### Center column

- 项目进度 card
- top mode tabs:
  - 时间推进图
  - 交付物图
- gantt-like progress visualization
- 项目选择 chips
- 交付物面板 grid

### Right column

- 建议时间表 card
- primary AI timetable button
- day timeline list
- 生成原则 card

## 任务池

This remains a switchable placeholder for now.

It still needs to feel like part of the same workspace, so it should render:

- matching page title
- short explanatory copy
- one muted empty-state panel saying the pool view will be connected later

## Styling Strategy

Keep changes localized:

- add one new page module: `workspace-page`
- add only the icon(s) needed by the rail/page
- add CSS blocks to the shared client stylesheet rather than creating a separate runtime stylesheet pipeline

The layout should use:

- CSS grid for page columns
- fixed panel heights only where interaction stability matters
- responsive collapse to one column on narrow widths
- stable chip/button sizes so labels do not shift layout

## Testing

Add focused frontend tests for:

- router parses and navigates `workspace`
- rail includes `workspace` first and marks it active
- main slot mounts workspace as a full page and hides browser/chat
- workspace page defaults to `项目推进页`
- workspace page can switch to `任务计划页` and `任务池`
- both designed pages expose their expected headline anchors/content

## Acceptance Criteria

- `工作台` appears as the first top rail button
- `#/workspace` opens a dedicated full-page workspace
- secondary nav shows `项目推进页 / 任务计划页 / 任务池`
- default subpage is `项目推进页`
- `项目推进页` and `任务计划页` are both rendered as static high-fidelity dashboards
- `任务池` is switchable and visibly placeholder-only
- router, rail, main-slot, page tests pass
