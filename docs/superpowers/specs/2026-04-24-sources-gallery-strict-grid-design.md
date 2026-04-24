# Sources Gallery Strict Grid Design

## Goal

Rewrite only the `源料库` page so that it behaves like a strict gallery view instead of a mixed dashboard.

The target is a fixed desktop layout whose behavior is defined by hard visual rules, not by content growth.

## Confirmed Scope

In scope:

- only the `源料库` page in `web/client/src/pages/sources/`
- remove the top title layer that shows `SOURCES GALLERY / 源料库`
- keep only one fixed filter row at the top:
  - `搜索`
  - `排序`
  - `来源`
  - `标签`
  - `状态`
- remove the `新增剪藏 / 日记` composer card from the gallery
- turn the page into a pure gallery grid
- make the gallery area the only scrolling region
- make all gallery cards use the exact same outer size
- ensure desktop can show a complete `3 x 2` grid of six cards at once

Out of scope:

- changing routes outside `源料库`
- adding new filters or new actions
- redesigning card content semantics
- changing source detail workspace behavior
- changing backend APIs
- preserving the old composer inside the gallery view

## Baseline

Desktop baseline is fixed:

- viewport: `1920 x 1080`
- browser zoom: `100%`

This baseline is the success target for the strict gallery layout.

## Final Design Intent

The page is no longer a mixed page with a title block, utility block, and content-driven cards.

The new target is a strict fixed-shell gallery:

- one compact fixed filter row at the top
- one gallery viewport below it
- no title hero
- no composer card
- no page-level scrolling
- card size determined by viewport math, not by content length

This means image cards and text cards both accept partial display. The layout stays correct even when content is longer than the visible window.

## Layout Structure

The page is split into two vertical zones.

### Top Fixed Filter Row

The top row is fixed and minimal.

It contains only:

1. search pill
2. sort pill
3. source chip
4. tag chip
5. status chip

Rules:

- remove the old title block entirely
- reduce vertical height as much as possible without breaking readability
- keep this row visible while the gallery scrolls
- this row is the only fixed header chrome on the page

### Gallery Viewport

The area under the filter row is the gallery viewport.

Rules:

- this is the only region allowed to scroll
- the viewport must contain a strict `3`-column desktop grid
- the first visible screen must fully show exactly `2` rows
- that means `6` full cards must be completely visible at once

## Card System

All cards share one strict outer frame.

Required behavior:

- all cards must have identical outer width
- all cards must have identical outer height
- no title, excerpt, image, tags, or metadata may increase card height
- image cards and text cards must align perfectly in the same row

### Image Cards

Image cards use a fixed media window.

Rules:

- image area uses a fixed ratio within the card
- image content may be cropped
- full image visibility is not required
- cropping is preferred over changing the card size

### Text Cards

Text cards also use a fixed preview window.

Rules:

- excerpt area uses a fixed preview height
- text may be truncated or clipped
- full body visibility is not required
- text cards must not grow taller than image cards

### Shared Card Rules

- title is limited to two lines
- tags and badges stay in fixed slots
- footer date and actions stay in fixed slots
- action buttons keep the same position on every card

## Content Rules

The page is a pure gallery page.

Required consequences:

- the old `新增剪藏 / 日记` card is removed from the grid
- the page no longer reserves one grid slot for creation
- all visible slots are actual source cards
- create / ingest entry should not reappear as a card-shaped exception in this page

## Scrolling Rules

The scrolling model is strict:

- the page shell does not scroll
- the top filter row does not scroll
- only the gallery viewport scrolls
- source detail fullscreen workspace remains separate and is unaffected by this rule

## Desktop Sizing Rule

The implementation must size the gallery from the available viewport height after subtracting:

- app shell padding
- fixed filter row height
- grid gaps
- status line if retained

The remaining height is then divided into exactly two visible card rows.

That rule is more important than maximizing preview content.

## Responsive Behavior

Desktop is the priority.

Allowed on narrower widths:

- reduce from `3` columns to `2`
- then to `1` on small screens
- keep the fixed filter row behavior where practical

Not allowed on desktop baseline:

- partial sixth card visibility
- a third visible row fragment pushing below the fold
- any card becoming taller than others

## Implementation Strategy

Keep the change surgical:

- update `renderSourcesPage()` markup only where needed to support:
  - fixed filter row shell
  - gallery viewport shell
  - pure gallery grid with no composer card
- adjust only the `源料库` CSS selectors needed for:
  - fixed top row
  - internal viewport scrolling
  - strict card sizing
  - removal of title-layer spacing

Do not add new abstractions unless they directly reduce repeated gallery markup.

## Verification

Verification should prove:

1. the top title layer is gone
2. the filter row remains visible while the gallery scrolls
3. the composer card is gone
4. the first desktop screen shows six complete cards
5. image and text cards share the same outer dimensions
6. long content is clipped instead of stretching the card
7. the existing `源料库` page tests still pass after the layout change
