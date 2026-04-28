# Workspace Work Log Design

## Goal

Extend the existing `工作台` page with a fourth secondary tab named `工作日志`.

This round is intentionally static-only:

- no real `领域/` scanning
- no real file creation
- no backend routes

The page should visually establish the future information architecture:

- `领域/<领域名>/<项目名>/工作日志.md`

and present a static aggregated work-log view across all projects.

## Scope

In scope:

- add `工作日志` to the workspace secondary nav
- add a new static `工作日志` view
- represent multiple domains and projects in a single aggregated UI
- keep current `项目推进页 / 任务计划页 / 任务池` intact

Out of scope:

- creating `领域/` on disk
- scanning the real repository
- editing `工作日志.md`
- wiring project information extraction

## Information Model For The UI

The new page should reflect the future structure even though data is static:

- Domain
- Project
- Work log file path
- Summary
- Last updated time

This means the UI must group and label items as if they came from:

- `领域/产品/LLM Wiki WebUI/工作日志.md`
- `领域/个人品牌/内容系统搭建/工作日志.md`
- `领域/健康/训练计划/工作日志.md`

## Page Layout

The `工作日志` tab is a three-column operational view:

### Left column

- page-local filters
- domain chips or grouped filters
- quick counters

### Center column

- aggregated project work-log cards
- each card shows:
  - domain name
  - project name
  - future path to `工作日志.md`
  - summary excerpt
  - recent update

### Right column

- selected-log detail panel
- project metadata
- latest focus items
- next extraction note / status note

## Interaction

This first pass remains client-only:

- click a work-log card to mark it selected
- selected card updates the right detail panel
- the first card is selected by default

No editing, saving, or fetching is introduced.

## Acceptance Criteria

- workspace secondary nav now includes `工作日志`
- clicking it renders a distinct aggregated work-log page
- the page clearly expresses the future `领域/<领域名>/<项目名>/工作日志.md` structure
- content is static mock data only
- existing workspace tabs still work
