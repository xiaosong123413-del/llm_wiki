# llmwiki

A knowledge compiler CLI. Raw sources in, interlinked wiki out.

## Development Guidelines

### Mandatory Karpathy Guidelines Gate

- Before running any command in this project, first apply the `karpathy-guidelines` skill.
- Treat this as a command gate for shell, npm, git, build, test, packaging, and process-management commands.
- The required pre-command check is: state the immediate goal, surface assumptions or uncertainty, choose the smallest safe action, and define what output will verify success.
- Do not run speculative or broad commands when a narrower command can answer the question.
- If the command can affect running apps, files, git state, or generated artifacts, prefer the least destructive option and verify current state first.

### Mandatory RTK Command-Output Gate

- Before running commands that may produce large output, first consider whether `rtk` can reduce the output. RTK reference: https://github.com/rtk-ai/rtk
- Prefer RTK wrappers for supported commands: `rtk ls`, `rtk read`, `rtk grep`, `rtk find`, `rtk git status`, `rtk git diff`, `rtk test <cmd>`, `rtk tsc`, `rtk next build`, and `rtk err <cmd>`.
- Use RTK especially for recursive listings, file reads, grep/search, git diff/status/log, test output, build output, lint output, and logs.
- If `rtk` is not installed or a command is not supported, state that briefly and use the narrowest normal command that can answer the question.
- Do not use RTK as a substitute for careful scoping. A narrow normal command is still better than a broad RTK command.

### Subagent Scheduler Mode

- Only enter subagent scheduler mode when the user explicitly authorizes subagents, delegation, or parallel agent work.
- In subagent scheduler mode, the main agent acts as a task scheduler and progress tracker. It should avoid doing implementation work itself unless needed to integrate, verify, or unblock the schedule.
- Each subagent must receive a self-contained task prompt. Do not write prompts such as "continue from the previous analysis" or "fix the remaining tests". Include the relevant file paths, observed errors, expected behavior, constraints, and verification command.
- Decompose broad work before dispatch. For example, scan failing tests first, group them by directory or module, and create bounded batches of roughly 15-30 related failures per subtask.
- Keep subagent write scopes disjoint whenever possible. State which files or modules each subagent owns, and tell subagents not to revert or overwrite edits made by others.
- Maintain `progress.json` in the project root during scheduler-mode work. It is the persistent source of truth for recovery after compaction or interruption.
- `progress.json` must include `pending`, `completed`, and `failed` lists. Each task entry should include an id, title, scope, owner/subagent id if any, status, attempts, lastError, and verification notes where applicable.
- Before each scheduling round, read `progress.json` and dispatch only tasks that are still pending or explicitly retriable.
- After a subagent completes, update the corresponding `progress.json` entry before dispatching more work.
- Failure strategy: if a subagent returns a fixable local error, send a follow-up message to the same subagent so it keeps the useful context.
- Failure strategy: if a subagent is anchored in the wrong direction or its assumptions are clearly bad, stop using that subagent for the task and start a new one with a corrected self-contained prompt.
- Failure strategy: after repeated failures on the same task, stop retrying, mark the task as failed in `progress.json`, and report the blocker to the user with concrete evidence.
- Do not retry indefinitely and do not burn tokens on vague subagent prompts.

### Project Log Maintenance

- Maintain `docs/project-log.md` whenever a user-visible change alters the LLM Wiki app's interface, workflow, sync/ingest/review behavior, or desktop/WebUI entry flow.
- Treat compile as a top-level workflow: any change to compile architecture, staging/final publish semantics, tiered memory, claim lifecycle, or final result reporting must be reflected in `docs/project-log.md`.
- Do not update the project log after every shell command. Update it only after a coherent user-visible change is completed.
- In `docs/project-log.md`, the "Current Interface" and "Current Workflow" sections may be rewritten to reflect the latest true state.
- In `docs/project-log.md`, the timeline section is append-only. Add new entries at the top in reverse chronological order; do not edit old timeline entries except to fix obvious typos introduced in the same change.
- Keep this project log separate from the user's wiki vault maintenance log. `docs/project-log.md` describes building and maintaining the LLM Wiki application itself.
- Store project-log interface images in the project-root `project-log-assets/` directory.
- Maintain one image per independent DOM page in the "Current Interface" section: chat, flash-diary, wiki, review, graph, and settings. When a new independent page is added, add one image for it too.
- Do not keep a single overview image, and do not include a screenshot for the project-log page itself.
- Refresh those page images when the documented current interface changes in a user-visible way.

### Code Style & Standards

- Files must be smaller than 400 lines excluding comments. Once 400 is exceeded, initiate a refactor.
- Functions must be smaller than 40 lines excluding comments and the catch/finally blocks of try/catch sections. If a function exceeds that, refactor it.

### clean code rules

- Meaningful Names: Name variables and functions to reveal their purpose, not just their value.
- One Function, One Responsibility: Functions should do one thing.
- Avoid Magic Numbers: Replace hard-code values with named constants to give them meaning.
- Use Descriptive Booleans: Boolean names should state a condition, not just its value.
- Keep Code DRY: Duplicate code means duplicate bugs. Try and reuse logic where it makes sense.
- Avoid Deep Nesting: Flatten your code flow to improve clarity and reduce cognitive load.
- Comment Why, Not What: Explain the intention behind your code, not the obvious mechanics.
- Limit Function Arguments: Too many parameters confuse. Group related data into objects.
- Code Should Be Self-Explanatory: Well-written code needs fewer comments because it reads like a story.

### Comments and Documentation

- include a substantial JSDoc comment at the top of each file. For python files, use google style docstrings
- Write clear comments for complex logic
- Document public APIs and functions
- Use JSDoc comments for functions
- Keep comments up-to-date with code changes
- Document any non-obvious behavior

### Pre-Commit Checks

Before committing any work, and before considering any task complete, you must:

1. `npx tsc --noEmit` — type-check passes
2. `npm run build` — build succeeds
3. `npm test` — all tests pass
4. `fallow` — run the fallow codebase health analyzer. Fix all issues it reports (dead code, duplication, complexity). Use `fallow fix --dry-run` to preview auto-fixes, then `fallow fix --yes` to apply. Fix any remaining issues manually. Do not commit until fallow reports no issues.

## General Rules

- First think through the problem, read the codebase for relevant files.
- Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
- Never speculate about code you have not opened. If the user references a specific file, you MUST read the file before answering. Make sure to investigate and read relevant files BEFORE answering questions about the codebase. Never make any claims about code before investigating unless you are certain of the correct answer - give grounded and hallucination-free answers.

@RTK.md
