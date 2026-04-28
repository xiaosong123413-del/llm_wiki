# Task Plan Static Replica Design

## Goal

Rewrite only the `任务计划页` content region inside the existing workspace page so that it follows the user-provided reference image as closely as possible.

This round is a static replica, not a data-driven dashboard.

## Confirmed Scope

In scope:

- only the `任务计划页` content region
- keep the existing workspace shell, left navigation, and top workspace header structure untouched
- replace the current `任务计划页` body with a static layout that mirrors the reference image
- copy the visible reference content as static text:
  - page title and subtitle
  - `AI 智能排期助手`
  - voice / regenerate buttons
  - `语音输入 / 最近的日记 / 已有任务池`
  - `AI 优先级判断 + 时间排序`
  - `今日建议时间表`
  - `晨间流程建议`
  - `领域与项目推进`
  - gantt-like timeline rows and controls

Out of scope:

- changing any content outside the `任务计划页` body
- dynamic data binding
- voice input behavior
- interactive scheduling logic
- backend APIs
- adding new routes

## Design Intent

The existing implementation is a same-theme dashboard. That is no longer the target.

The new target is a strict static visual replica:

- same section order as the reference
- same major panel grouping
- same left / center / right spatial relationship in the top half
- same lower gantt board structure
- same visible copy and labels from the reference image
- only minimal responsive adaptation where necessary to avoid breakage on narrower widths

## Layout Structure

The `任务计划页` body is split into two stacked zones.

### Top Zone

Top zone contains:

1. page title: `任务计划页`
2. subtitle: `每天早上通过语音快速生成今日计划，再进行微调`
3. a large main assistant panel on the left
4. a narrow side panel on the right for `晨间流程建议`

Inside the main assistant panel:

1. section title: `AI 智能排期助手`
2. control row:
   - circular microphone button
   - `开始语音输入`
   - `重新生成计划`
3. horizontal process strip:
   - `语音输入`
   - `最近的日记`
   - `已有任务池`
   - `AI 优先级判断 + 时间排序`
   - `今日建议时间表`

The process strip keeps the visual arrow flow from left to right.

The right-side top panel contains:

- title: `晨间流程建议`
- four numbered rows:
  - `语音倾倒想法`
  - `AI 自动排期`
  - `手动微调`
  - `开始执行`

### Bottom Zone

Bottom zone contains one large board titled:

- `领域与项目推进`

This board mirrors the reference image:

- title and subtitle
- right-aligned small controls:
  - `本周`
  - previous / next controls
  - `两周视图`
- left tree column with three groups:
  - `1. 产品设计`
  - `2. 用户研究`
  - `3. 个人成长`
- sub-items under each group
- right gantt grid with day headers
- colored progress bars and milestone markers

## Content Rules

All visible content should match the reference image rather than reuse the current dashboard copy.

That means the existing `任务计划页` text and pseudo-data should be removed and replaced with the reference text.

Representative examples that must be copied:

- `AI 智能排期助手`
- `开始语音输入`
- `重新生成计划`
- `语音输入`
- `最近的日记`
- `已有任务池`
- `AI 优先级判断 + 时间排序`
- `今日建议时间表`
- `晨间流程建议`
- `进入微调`
- `领域与项目推进`

Times, task names, labels, and status chips should also be statically copied from the reference image.

## Styling Rules

The page should look like a polished light productivity dashboard.

Required characteristics:

- pale blue-white background surfaces
- thin blue-grey borders
- soft shadow, not heavy elevation
- rounded cards with large radii
- dark navy headline text
- blue as the only accent family
- warm severity chips for high / medium / low emphasis

Do not introduce:

- purple accents
- dark mode styling
- new decorative illustrations
- visual reinterpretations that depart from the reference

## Responsiveness

Desktop is the priority because the reference is desktop.

Allowed responsive adaptation:

- top zone may collapse vertically on narrow widths
- bottom board may become horizontally scrollable instead of reflowing into a different structure
- controls may wrap when space is constrained

Not allowed:

- changing the information hierarchy
- removing panels
- replacing the gantt board with a simplified mobile card list

## Implementation Strategy

Keep the change surgical:

- replace `renderTaskPlanView()` markup only
- add or adjust only the CSS selectors required for the replica
- avoid changing project-progress, task-pool, work-log, or toolbox content

The implementation should stay static and direct.

No abstraction should be added unless the same markup fragment is repeated and becomes materially clearer as a helper.

## Verification

Verification should prove:

- `任务计划页` still renders in the workspace page
- expected anchor text from the replica is present
- switching to `任务计划页` still works
- the page builds without TypeScript or CSS regressions
