# Deep Research Review Flow Design

## Goal

Replace the current generic Deep Research cards with actionable review tasks that identify a concrete page or claim, run background work from the review page, and require explicit user confirmation before writing results into the wiki.

## Problems To Fix

- The current cards are too generic. They show category labels, but not which page or fact needs work.
- The current cards are too dense on the main list and do not separate summary from detail.
- The current flow is passive. It tells the user to do something elsewhere instead of letting the user trigger the task directly.
- The current Deep Research extraction collapses different issues into a few broad cards, which removes the exact object the user needs to inspect.

## Product Rules

- Deep Research review items must be shown as multiple concrete cards, not four aggregate cards.
- The preferred unit is one fact per card.
- If lint cannot identify a concrete fact but can identify a page, use one page-level card.
- If lint cannot identify either a concrete fact or a page, do not create a Deep Research card. Leave that information in the run log only.
- Background work started from review cards must not write into the wiki immediately.
- Finished work must move to a "done, waiting for confirmation" state. Only an explicit user confirmation writes the result into the wiki.
- If background work fails, the failure reason must be displayed on the original card.

## Review List UX

### Left List

The review list remains the main queue. Each list card becomes a compact summary row-sized card instead of a long narrative block.

Each Deep Research summary card shows:

- issue category
- status and progress percentage
- page path
- one-line fact or gap summary
- one-line trigger summary
- quick actions in the bottom-right corner

Quick action placement:

- All card actions sit in the bottom-right corner of the list card.
- Clicking the card body opens the detail panel.
- Clicking an action button does not open the detail panel unless that action itself requires it.

### Right Detail Panel

Clicking a review card opens a persistent right-side detail panel, not a modal.

The detail panel shows:

- issue category
- current status
- progress percentage
- page path
- line number when available
- fact text or missing-evidence description
- trigger evidence from lint
- background task log summary
- draft result preview when available
- failure reason when failed
- confirmation controls when the task is finished

The list stays visible while the panel is open so the user can compare several items quickly.

## Deep Research Categories And Actions

The four categories remain fixed, but each has its own action labels.

### New Source Replaces Outdated Statement

Buttons:

- Ignore
- Start Rewrite
- Chat

### Missing Citation

Buttons:

- Ignore
- Add Citation
- Chat

### Network Research Needed For Evidence Gap

Buttons:

- Ignore
- Deep Research
- Chat

### New Question Or New Source Suggestion

Buttons:

- Ignore
- Accept Suggestion
- Chat

### Shared Post-Run Action

When a background task completes successfully, replace the main action button with:

- Confirm Write

This action writes the prepared draft into the wiki and marks the review item complete.

## Item State Model

Each Deep Research item uses a minimal explicit state machine:

- `pending`
- `running`
- `done-await-confirm`
- `failed`
- `ignored`
- `completed`

Rules:

- `pending`: default after lint/check creates the item.
- `running`: background task has started from a card action.
- `done-await-confirm`: background task produced a draft and is waiting for user confirmation.
- `failed`: background task stopped with an error and stores the failure reason.
- `ignored`: user explicitly removed it from the queue.
- `completed`: user confirmed write and the result was committed into the wiki.

Display rules:

- `ignored` and `completed` are hidden from the default pending list.
- `failed` remains visible until ignored or rerun.
- `done-await-confirm` remains visible and visually prominent.

## Data Model

The current Deep Research item shape is too small. It must expand from generic text fields into a structured task record.

Required fields:

- `id`
- `kind`
- `category`
- `scope`: `claim` or `page`
- `pagePath`
- `line`
- `factText`
- `gapText`
- `triggerReason`
- `sourceExcerpt`
- `status`
- `progress`
- `selectedAction`
- `draftResult`
- `errorMessage`
- `chatId`
- `createdAt`
- `updatedAt`

`draftResult` should contain the exact pending write payload needed for confirmation, not just a prose summary. It must be enough to render a preview and perform a later write without recomputing the task.

## Extraction Rules

Deep Research extraction must stop treating broad run-summary phrases as standalone tasks unless they can be mapped to a concrete subject.

Priority order:

1. Claim-level extraction
2. Page-level extraction
3. No card

### Claim-Level Extraction

Create a claim-level item when lint provides:

- page path
- optional line number
- claim text, citation text, or a concrete missing-evidence statement

Examples:

- low-confidence claim with original sentence
- missing citation attached to a sentence
- outdated source reference attached to a statement

### Page-Level Extraction

Create a page-level item only when lint identifies the page but not the specific statement.

The detail panel must clearly label this as page-level and say that human review is still needed to locate the exact sentence.

### No Card

Do not create a Deep Research card from:

- generic check footer prompts without a page or fact
- orphaned page warnings
- generic broken-link noise that does not imply external evidence work
- any line that only contains a category banner with no actionable target

## Background Task Model

The review page starts tasks directly from the card.

### Task Types

- `Start Rewrite`
- `Add Citation`
- `Deep Research`
- `Accept Suggestion`

### Execution Behavior

- Starting an action creates or updates a task record for that review item.
- The task runs in the background and updates `progress`.
- Progress is coarse but explicit, for example:
  - 10% collecting context
  - 35% searching sources
  - 65% drafting result
  - 90% preparing preview
  - 100% ready for confirmation

### Failure Behavior

- The task writes a short, user-readable failure reason into `errorMessage`.
- The original card becomes `failed`.
- The detail panel shows the failure reason inline.

## Confirmation Flow

Successful background tasks must not write into the wiki immediately.

Instead:

1. task finishes
2. item enters `done-await-confirm`
3. detail panel shows a preview of the pending write
4. user clicks `Confirm Write`
5. backend applies the prepared write
6. item moves to `completed`

This keeps review work reversible up to the final user confirmation step.

## Chat Flow

`Chat` is a side path, not the main execution path.

When the user clicks `Chat`:

- create or reuse a chat conversation tied to this review item
- seed the first message with category, page, line, fact, and trigger reason
- include draft output or failure reason when available
- navigate to `#/chat`

This preserves context without making chat the default place where all work happens.

## Backend Surface

The review backend needs explicit action endpoints for Deep Research items.

Minimum route surface:

- `GET /api/review`
- `POST /api/review/deep-research/:id/actions`
- `POST /api/review/deep-research/:id/confirm`
- `POST /api/review/deep-research/:id/chat`

The action endpoint accepts one concrete action and returns the updated item state.

## Frontend Surface

The review page needs these changes:

- compact summary cards for Deep Research items
- bottom-right quick actions on list cards
- selectable active card state
- persistent right detail panel
- progress rendering on both summary and detail views
- preview rendering for `done-await-confirm`
- failure rendering for `failed`

## Out Of Scope

- building a general workflow engine for every review item type
- automatic wiki writes without confirmation
- deduplicating semantically similar Deep Research items across unrelated pages
- adding bulk actions for Deep Research tasks in this phase

## Verification

The implementation is successful when:

- a check run produces multiple concrete Deep Research cards instead of four aggregate cards
- each card identifies a page or fact
- actions appear in the bottom-right of the summary card
- clicking the card opens a right-side detail panel
- action buttons start background work and update percentage in place
- completed tasks wait for confirmation before writing
- failed tasks show the failure reason on the original card
