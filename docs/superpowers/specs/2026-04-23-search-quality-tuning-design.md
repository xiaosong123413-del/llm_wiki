# Search Quality Tuning Design

Date: 2026-04-23

## Scope

This design covers only the following work:

1. Expand the local search evaluation corpus and qrels.
2. Tune local hybrid ranking quality for wiki, sources_full, and raw layers.
3. Update the pending-task list to match the current product direction:
   - remove flash diary audio transcription
   - remove mobile Codex subscription login
   - remove mobile offline chat
   - add desktop Codex subscription login

This design does not include:

- embedding/publish performance optimization
- mobile feature implementation
- Codex desktop login implementation itself
- remote web search UI changes beyond existing work

## Problem

Vector search and embedding are already connected end to end, but the remaining gap is not connectivity. The remaining gap is quality control.

Current local search has two weaknesses:

1. The evaluation corpus is too small to justify ranking changes.
2. The hybrid ranking logic is still coarse:
   - wiki pages should usually outrank raw noise for explicit knowledge queries
   - procedures and concept pages need better priority separation
   - sources_full should remain visible as supporting evidence without displacing the main wiki target

Because the current sample corpus is narrow, changing ranking weights without new evaluation cases would be guesswork.

## Goals

1. Give search evaluation enough coverage to catch ranking regressions.
2. Improve hybrid ranking so top results better match actual wiki usage.
3. Keep the implementation local, explicit, and easy to verify.
4. Align the backlog with the product direction the user has now chosen.

## Non-Goals

1. Do not redesign the search architecture.
2. Do not add a new retrieval provider.
3. Do not add speculative configuration knobs in the UI.
4. Do not refactor unrelated search files.

## Approach Options

### Option A: Corpus-only expansion

Add more queries and qrels, but do not change ranking.

Pros:
- lowest risk
- better evaluation coverage

Cons:
- does not improve actual results
- leaves the ranking problem untouched

### Option B: Ranking-only tuning

Adjust hybrid ranking and keep the current small evaluation corpus.

Pros:
- improves visible search behavior quickly

Cons:
- weak proof that tuning is correct
- easy to overfit to intuition

### Option C: Corpus expansion plus ranking tuning

Expand the evaluation set first, then tune ranking against that corpus.

Pros:
- shortest closed loop with evidence
- improves both measurement and behavior
- smallest sound path to “quality tuning”

Cons:
- slightly more work than either partial option

Recommendation: Option C.

## Design

### 1. Evaluation Corpus Expansion

Update the sample evaluation assets:

- `search/queries.sample.json`
- `search/qrels.sample.json`

Add more cases across these categories:

1. explicit concept lookups
2. explicit procedure/workflow lookups
3. entity lookups with multiple candidate layers
4. temporal/episode lookups
5. supporting-source retrieval from `sources_full`
6. raw-layer distractor/noise suppression

The expanded corpus should force the ranking logic to prove these behaviors:

- exact wiki targets win when intent is clear
- relevant `sources_full` documents can appear near the top
- `raw/` entries do not crowd out stronger wiki matches
- episode pages only rise when the query is actually temporal or event-like

### 2. Hybrid Ranking Tuning

Update only the existing local ranking path:

- `web/server/services/search-hybrid.ts`
- `web/server/services/search-router.ts`

The tuning strategy is:

1. keep the current RRF structure
2. make layer weighting more intentional
3. reward stronger title/path matches for concept and procedure pages
4. reduce raw-layer accidental token matches
5. keep vector results as a supplement rather than a dominant override

Expected behavioral changes:

- clear wiki concept queries return concept pages ahead of raw/source noise
- clear procedure queries return procedures ahead of retros/episodes
- `sources_full` can outrank unrelated wiki pages when it is genuinely relevant, but should not displace the primary wiki page for an exact target query
- vector matches should enrich recall, not destabilize obvious top-1 cases

No new UI settings or runtime knobs will be added.

### 3. Backlog Update

Update `docs/project-pending.json` to reflect the current roadmap.

Remove:

- `flash-diary-audio-transcription`
- `mobile-codex-subscription-login`
- `mobile-offline-chat`

Add:

- `desktop-codex-subscription-login`

The new desktop Codex item should describe desktop-side subscription login as a future task, without promising a specific unsupported auth flow.

## File Changes

Expected touched files:

- `search/queries.sample.json`
- `search/qrels.sample.json`
- `scripts/search-eval.mjs`
- `web/server/services/search-hybrid.ts`
- `web/server/services/search-router.ts`
- `docs/project-pending.json`
- relevant tests in `test/`

## Testing

Follow test-first behavior changes.

1. Add failing tests for ranking expectations before changing ranking code.
2. Update evaluation tests so the expanded corpus is asserted.
3. Run targeted tests for:
   - search hybrid
   - search router
   - search eval
4. Run TypeScript compile checks if any typed search code changes.

Verification standard:

- tests pass
- evaluation corpus expands meaningfully
- adjusted ranking behavior matches the new assertions
- no unrelated regressions are introduced

## Risks

1. Overfitting ranking logic to the sample corpus.
   - Mitigation: keep the tuning narrow and behavior-based.
2. Letting vector matches dominate exact wiki targets.
   - Mitigation: preserve vector as a secondary signal.
3. Turning `sources_full` into a stronger layer than wiki for explicit knowledge queries.
   - Mitigation: keep wiki-preferred weighting for clear concept/procedure intent.

## Success Criteria

This work is complete when:

1. the sample evaluation corpus is broader and checks more real ranking cases
2. hybrid ranking tests demonstrate better ordering for concept/procedure/source/raw competition
3. `docs/project-pending.json` matches the current roadmap
4. the changed test suite passes
