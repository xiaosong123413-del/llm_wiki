# Deterministic System-Check Autofix Design

## Goal

Make the app automatically write back only deterministic system-check fixes before showing review results, so the user no longer needs Codex for:

- alias backfills
- example-syntax escaping
- bridge-page creation for already-known page migrations

The target is narrow on purpose. The app should not invent new concept content, guess ambiguous targets, or perform freeform rewrites.

## Confirmed Scope

In scope:

- run deterministic autofix before `llmwiki lint` produces final diagnostics
- auto-backfill aliases only when a missing wikilink maps to one unique existing page
- auto-escape example syntax that is being misread as a real wikilink or image reference
- auto-create bridge pages only from an explicit migration table controlled by the app
- surface an autofix summary in system-check output
- keep all fixes local, deterministic, and offline

Out of scope:

- LLM-based repair
- network search
- semantic guessing across multiple candidate pages
- generating new concept pages from scratch without an explicit migration record
- rewriting page bodies beyond the exact deterministic line or frontmatter edits needed for repair
- expanding this round into warning cleanup such as orphan pages or missing outlinks

## Current State

The current architecture splits system checks into two independent paths:

1. `src/linter/*`
   - runs `llmwiki lint`
   - prints broken wikilinks, image reference failures, stale claims, and similar diagnostics
   - exits with code 1 when any error remains

2. `web/server/services/rules/*`
   - powers a small deterministic rule-engine for review-page items
   - currently only includes asset and image provenance rules

The important limitation is that `broken-wikilink` and related deterministic text fixes exist only as lint diagnostics. They are not currently modeled as executable repairs. As a result, the app can detect these issues but cannot resolve them automatically before presenting them to the user.

## Product Rule

The app may automatically modify wiki content only when the repair is mechanically provable from local state.

That means a fix is allowed only if:

- the target page is uniquely identified
- the change shape is predefined
- the modified region is narrow and local
- a post-fix lint pass can verify the exact error disappeared

If any of these conditions fail, the app must skip the fix and leave the original diagnostic in place.

## Chosen Approach

Add a deterministic autofix phase inside the lint pipeline:

`collect candidate diagnostics -> run deterministic repairs -> rerun lint -> print final diagnostics + autofix summary`

This is the smallest change that matches the requested behavior because:

- the existing `检查` button already executes `dist/cli.js lint`
- the run manager and review page already consume lint output
- the alias extraction logic already exists in `src/wiki/aliases.ts`
- the system-check result remains the source of truth

Rejected alternatives:

### 1. Review-page-only autofix button

Do not require the user to click a second “auto repair” button.

Reason:

- it keeps deterministic fixes in the manual review queue
- it does not solve the “don’t rely on Codex” problem
- it adds one more UI branch when the backend can resolve the issue during check

### 2. Background watcher that edits the wiki continuously

Do not mutate wiki files opportunistically whenever the vault changes.

Reason:

- too hard to reason about
- easy to create surprising edits
- unnecessary when the user already has an explicit “检查” workflow boundary

## Repair Categories

The autofix phase only supports three repairers.

### 1. Alias Backfill Repairer

Input:

- a `broken-wikilink` diagnostic
- all existing pages in `wiki/concepts` and `wiki/queries`

Behavior:

- normalize the missing target with the same slug rules used by lint
- scan existing pages for an exact unique absorbable target using:
  - page filename slug
  - frontmatter title slug
  - existing aliases
  - deterministic alias candidates extracted by `src/wiki/aliases.ts`
- if and only if one page is the unique target, append the missing visible text into that page’s `aliases`

Allowed example:

- page links `[[素材捕获]]`
- existing page `web-clipper.md` clearly resolves to that same concept
- autofix writes `素材捕获` into `web-clipper.md` frontmatter aliases

Skip conditions:

- zero candidates
- more than one candidate
- target page has no frontmatter block
- alias already exists

### 2. Example Syntax Escaping Repairer

Input:

- a `broken-wikilink` or `untraceable image reference` diagnostic caused by documentation examples

Behavior:

- edit only the exact offending line
- convert example syntax into non-linking text
- use one of two deterministic patterns:
  - escape the token sequence
  - replace the sample with descriptive prose

Allowed examples:

- `` `![[图片文件.jpg]]` `` becomes prose such as “感叹号 + 双中括号 + 图片文件名”
- a fenced or inline sample that still contains raw image reference tokens becomes escaped text

Skip conditions:

- the line appears to be real content rather than an example
- the same token appears outside an example context on that line
- the repair would require rewriting multiple unrelated sentences

### 3. Bridge Page Repairer

Input:

- a `broken-wikilink` diagnostic
- a migration mapping file maintained by the app, for example `.llmwiki/link-migrations.json`

Behavior:

- if the missing link target exists as an explicit old title in the migration mapping
- and the canonical target page still exists
- create a minimal bridge page at the old title path
- bridge page content points to the canonical page and preserves old links

Important rule:

This repairer does not guess migrations. It only acts on explicit app-owned mappings created during rename, merge, or split flows.

Skip conditions:

- no migration entry
- canonical page missing
- bridge page already exists

## Data Model

Introduce one runtime summary object for lint execution:

- `attempted`
- `applied`
- `skipped`
- `failures`
- `details[]`

Each detail entry should include:

- `repairer`
- `kind`
- `target`
- `reason`
- `status`: `applied` | `skipped` | `failed`

For bridge-page creation, introduce one persisted mapping file:

- `.llmwiki/link-migrations.json`

Recommended shape:

```json
{
  "migrations": [
    {
      "oldTitle": "旧页面名",
      "canonicalPath": "wiki/concepts/new-page.md",
      "createdAt": "2026-04-25T00:00:00.000Z",
      "reason": "rename"
    }
  ]
}
```

No fuzzy metadata is needed in this round.

## Execution Order

The autofix stage must run before final lint output is computed.

Recommended flow inside `src/linter/index.ts`:

1. run only the deterministic error-producing checks needed by autofix:
   - broken wikilinks
   - untraceable media references
2. derive repair candidates
3. apply deterministic repairs
4. rerun the full lint rule set
5. return:
   - final diagnostics
   - autofix summary

Reason for two-pass execution:

- the first pass finds concrete fix targets
- the second pass proves whether the repair actually removed the error

## File Ownership

### [src/linter/index.ts](D:/Desktop/llm-wiki-compiler-main/src/linter/index.ts)

Modify to:

- orchestrate the autofix pre-pass
- rerun lint after repairs
- include autofix summary in the returned lint summary object

### [src/commands/lint.ts](D:/Desktop/llm-wiki-compiler-main/src/commands/lint.ts)

Modify to:

- print an “autofix summary” block before final counts
- preserve the current exit rule: only exit 1 if errors remain after autofix

### New file: `src/linter/autofix.ts`

Create a focused deterministic repair orchestrator that:

- groups candidate diagnostics by repairer
- applies edits
- records applied/skipped/failed results

### New file: `src/linter/autofix/alias-backfill.ts`

Create to:

- resolve unique page targets
- append missing aliases using existing frontmatter helpers

### New file: `src/linter/autofix/example-escaping.ts`

Create to:

- detect example-only lines
- rewrite offending lines into escaped or descriptive text

### New file: `src/linter/autofix/bridge-pages.ts`

Create to:

- read `.llmwiki/link-migrations.json`
- generate minimal bridge pages when mappings are explicit

### [src/wiki/aliases.ts](D:/Desktop/llm-wiki-compiler-main/src/wiki/aliases.ts)

Reuse from the alias repairer.

Do not turn this file into a mutating repairer itself. Keep extraction and normalization separate from writeback.

## Write Rules

All repairers must obey the same write discipline:

- read the target file immediately before editing
- apply the smallest possible edit
- do not touch unrelated formatting
- do not reorder existing aliases unless required for deduplication
- use existing frontmatter builders for metadata writes
- create new files only in the bridge-page repairer

## Verification Rules

A repair only counts as applied if the corresponding error disappears in the post-repair lint pass.

If the file was edited but the error still exists:

- count it as failed
- keep the final diagnostic
- include the failure in the autofix summary

This prevents “silent cosmetic edits” from being reported as successful repairs.

## Review-Page Behavior

The review page does not need a new control path in this phase.

Required visible change:

- when `检查` finishes, the run log should include a short autofix summary
- the final review list should reflect only the remaining unresolved items

This keeps the user-facing workflow unchanged:

- click `检查`
- app auto-repairs what is deterministic
- user reviews only the true remainder

## Testing Strategy

Add focused tests around each repairer plus the lint integration.

### Unit Tests

- alias repairer adds a new alias when there is exactly one target page
- alias repairer skips ambiguous matches
- example repairer escapes a sample image/wikilink line and leaves real content untouched
- bridge-page repairer creates a bridge page only when a migration record exists

### Integration Tests

- running lint on a fixture with one deterministic alias miss reduces error count after autofix
- running lint on a fixture with one documentation-only image example removes the image error
- running lint on a fixture with an explicit migration creates the bridge page and clears the broken link
- final lint still exits with failure when unresolved errors remain

### Regression Tests

- existing linter behavior for stale claims, missing citations, and general diagnostics is unchanged
- no autofix runs for warnings-only cases

## Risks

### 1. False Positive Alias Writes

Risk:

- a missing term may appear to match more than one page semantically

Mitigation:

- require exactly one deterministic target
- otherwise skip

### 2. Over-editing Example Pages

Risk:

- the example repairer may alter real content if the heuristic is too broad

Mitigation:

- restrict edits to the exact flagged line
- only run on line shapes recognized as examples

### 3. Bridge Page Sprawl

Risk:

- generating bridge pages without strong provenance could create junk pages

Mitigation:

- allow bridge creation only from explicit migration records

## Out of Scope Safeguards

The implementation must explicitly refuse to:

- synthesize new concept prose from a missing wikilink
- infer migrations from string similarity
- rename pages automatically
- rewrite multiple sections of a page to resolve one lint error
- auto-resolve stale claims, missing citations, or Deep Research items through this deterministic path

## Success Criteria

The feature is complete when all of the following are true:

- `检查` automatically fixes deterministic alias misses before final system-check output
- `检查` automatically removes documentation-only wikilink or image-example false positives
- `检查` can create a bridge page only from an explicit migration mapping
- final lint output reports remaining errors after autofix, not before
- the user no longer needs Codex to resolve these deterministic classes of system-check error
- tests cover applied and skipped behavior for all three repairers
