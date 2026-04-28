# Task Plan Static Replica Plan

> Goal: replace the current `任务计划页` body with a static content-region replica of the user reference image.

## Task 1: Lock The Current Surface

Files:

- modify `D:/Desktop/llm-wiki-compiler-main/test/web-workspace-page.test.ts`

Steps:

- update the task-plan assertions so they look for replica-specific text
- verify the current implementation fails those assertions

## Task 2: Rewrite Task Plan Markup

Files:

- modify `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/workspace/index.ts`

Steps:

- replace the existing `renderTaskPlanView()` output
- keep the rewrite static
- preserve only the content-region boundary and the existing `data-workspace-view="task-plan"`

## Task 3: Rewrite Task Plan Styling

Files:

- modify `D:/Desktop/llm-wiki-compiler-main/web/client/styles.css`

Steps:

- remove dependence on the current generic task-plan layout styling where it conflicts
- add focused styles for:
  - top assistant zone
  - right-side recommendation panel
  - lower gantt board
  - timeline rows
  - gantt labels / bars / markers

## Task 4: Verify

Commands:

- focused tests for workspace task-plan rendering
- `tsc --noEmit`
- web build

Success criteria:

- workspace page still switches to `任务计划页`
- replica-specific text is rendered
- no TypeScript/build regressions
