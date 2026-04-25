# Flash Diary Single Attempt Per Day Design

## Goal

Make flash diary auto compile behave as a single daily attempt.

If the system decides to auto compile yesterday's flash diary on a given day, later sync attempts on that same day must not select that diary again, even if the compile run fails.

## Confirmed Scope

In scope:

- flash diary auto compile attempt tracking
- same-day retry prevention for the auto-selected flash diary
- preserving the existing "only yesterday's flash diary" rule
- preserving the existing morning-only rule
- preserving `completed_files` as a success-only record

Out of scope:

- changing clipping batch behavior
- changing manual compile semantics outside the current sync flow
- changing provider failure handling in the compiler itself
- changing `sources_full` mirror behavior beyond the earlier incremental sync fix
- changing gallery date display

## Current Problem

The current flow decides whether flash diary auto compile is allowed by reading `flash_diary_auto_compile.last_run_on`.

Today that field is only persisted after a successful batch publish, or when there are zero batches.

That means:

1. morning sync decides yesterday's flash diary is eligible
2. compile starts
3. compile fails before publish
4. `last_run_on` is still not updated
5. another sync on the same day selects yesterday's flash diary again

This creates repeated same-day attempts after failure, which is not the intended product behavior.

## Required Behavior

### Daily Attempt Rule

Flash diary auto compile is attempt-based, not success-based.

If the system allows the flash diary auto compile path to run on a given date, that date is considered consumed immediately for flash diary auto compile purposes.

Consequences:

- the first eligible sync on a day may select yesterday's flash diary
- any later sync on that same day must not select yesterday's flash diary again
- this remains true whether the compile succeeds or fails

### Eligibility Rules That Must Stay Unchanged

The existing selection rules remain:

- only flash diary items are affected by this rule
- only yesterday's flash diary can be auto selected
- flash diary auto compile still runs only during the morning window
- non-flash sources keep their current behavior

### Success Tracking Must Stay Unchanged

`completed_files` must continue to mean "successfully compiled and published files".

Failed flash diary attempts must not be inserted into `completed_files`.

This keeps success semantics clean and avoids treating a failed compile as finished work.

## State Model

The existing state shape is sufficient.

Keep:

- `flash_diary_auto_compile.last_run_on`

Interpretation after this change:

- `last_run_on` means "the flash diary auto compile slot for this calendar day has already been consumed"

It no longer means "a flash diary compile finished successfully on this day".

No new fields are needed.

## Implementation Design

### State Write Timing

When sync determines that flash diary auto compile is allowed for the current day, it must persist `last_run_on = today` before any compile batches run.

This write happens once per eligible day and is not rolled back if compile fails.

### Batch Success Path

On success:

- keep writing `completed_files` as today
- keep the current publish flow
- do not add duplicate or compensating flash diary state writes beyond what is needed

### Batch Failure Path

On failure:

- preserve the earlier `last_run_on = today` write
- do not add the failed flash diary file to `completed_files`
- keep the final compile result marked as failed

## Files Affected

- `scripts/sync-compile.mjs`
- `test/flash-diary-auto-compile.test.ts`
- `test/sync-compile-runner.test.ts` or another focused sync runner test file if needed for state-write timing coverage

## Verification

Verification must prove:

1. yesterday's flash diary is still the only eligible flash diary candidate
2. the first eligible morning sync consumes the flash diary auto compile slot for that day
3. a failed compile on that day does not reopen the slot
4. a second sync on the same day does not select yesterday's flash diary again
5. `completed_files` still only records successful outputs
6. existing flash diary auto compile tests still pass
