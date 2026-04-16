# One-Click Sync And Compile Design

## Goal

Provide a desktop double-click entrypoint that:

1. Reads configuration from the compiler project directory.
2. Supports multiple source vault folders.
3. Prompts for source folders when configuration is empty.
4. Syncs markdown files from the selected source folders into the target vault raw layer.
5. Compiles the target vault in batch mode by default.
6. Persists progress so repeated runs continue from later batches instead of restarting from the first batch.

## Fixed Paths

- Compiler root: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main`
- Config file: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\sync-compile-config.json`
- Desktop entrypoint: `C:\Users\Administrator\Desktop\一键同步编译知识库.cmd`
- Target vault: `C:\Users\Administrator\Desktop\ai的仓库`

## User Experience

### First Run

1. User double-clicks the desktop script.
2. Script loads `sync-compile-config.json`.
3. If `source_folders` is empty, the script opens a folder picker that supports selecting multiple folders one by one.
4. Selected folders are written back to config for future runs.
5. Script synchronizes markdown files into the target vault raw layer.
6. Script prepares the next batch and runs compile.
7. Console window stays open with a clear summary.

### Later Runs

1. User double-clicks the same desktop script.
2. Script reuses saved `source_folders`.
3. Script refreshes `sources_full`.
4. Script restores the next batch into `sources`.
5. Script runs compile and advances progress if successful.

## Data Layout

### In Target Vault

- `sources_full/`
  - Full synced raw markdown corpus from all selected source folders.
- `sources/`
  - Active compile batch only.
- `wiki/`
  - Compiled wiki output.
- `raw_import_manifest.csv`
  - Mapping from original relative source path to imported filename.
- `.llmwiki-batch-state.json`
  - Persistent batch progress state.

### In Compiler Root

- `sync-compile-config.json`
  - Main configuration file.
- `scripts\bulk-import-obsidian.ps1`
  - Existing bulk raw import helper.
- `scripts\prepare-batch-sources.ps1`
  - Existing active batch helper.
- New orchestration scripts for config loading, folder prompting, state advancement, and compile execution.

## Configuration Format

```json
{
  "target_vault": "C:\\Users\\Administrator\\Desktop\\ai的仓库",
  "compiler_root": "C:\\Users\\Administrator\\Desktop\\llm-wiki-compiler-main",
  "source_folders": [],
  "compile_mode": "batch",
  "batch_limit": 20,
  "batch_pattern_order": [
    "ai知识库（第二大脑）__概念__*",
    "ai知识库（第二大脑）__项目__*",
    "02_领域__*",
    "01_项目__*",
    "03_资源__*",
    "*"
  ],
  "exclude_dirs": [
    ".obsidian",
    ".trash",
    ".claude",
    ".claudian"
  ]
}
```

## Batch Strategy

### Default Policy

- Always sync full raw content into `sources_full`.
- Always compile from `sources`.
- Default compile mode is `batch`.

### Batch Selection

1. Read all files from `sources_full`.
2. Remove files already marked as completed in `.llmwiki-batch-state.json`.
3. Apply `batch_pattern_order` from top to bottom.
4. Fill the active batch up to `batch_limit`.
5. Copy selected files into `sources/`.

### Batch Completion

- A batch is only marked complete after `compile` exits successfully.
- Completed filenames are appended to the state file.
- Next run skips completed files.

## Failure Handling

### Sync Failure

- Stop immediately.
- Do not modify batch progress state.
- Preserve previous `sources_full`, `sources`, and `wiki`.

### Compile Failure

- Preserve `sources/` so the same batch can be retried.
- Do not advance `.llmwiki-batch-state.json`.
- Leave `wiki/` untouched except for anything the compiler already committed.
- Clear stale `.llmwiki\lock` only if no matching compile process is alive.

### Stale Lock Handling

Before compile:

1. Read `.llmwiki\lock` if present.
2. Check whether the referenced PID still exists.
3. If no such process exists, delete the stale lock.
4. If a live compile process exists, stop and report that compilation is already running.

## Multi-Source Sync Rules

### Input

- Multiple Obsidian or markdown source folders.
- Each folder is treated as an independent root for relative path mapping.

### Import Naming

- Imported filenames must remain collision-safe.
- Continue using relative-path-derived names plus a stable short hash.
- Include all source folders in `raw_import_manifest.csv`.

### Manifest Fields

- `source_root`
- `source_relative_path`
- `imported_filename`
- `size`
- `last_write_time`

## Implementation Units

### 1. Config Loader

Responsibilities:

- Read `sync-compile-config.json`.
- Validate required paths and defaults.
- Persist updated `source_folders`.

### 2. Source Folder Picker

Responsibilities:

- Prompt for folder selection if config has no sources.
- Support repeated folder picking to build a multi-folder list.
- Save selected folders back to config.

Recommended implementation:

- PowerShell with .NET `System.Windows.Forms.FolderBrowserDialog` in a loop.

### 3. Full Sync Runner

Responsibilities:

- Clear and rebuild `sources_full`.
- Import markdown from all configured source folders.
- Write `raw_import_manifest.csv`.

### 4. Batch Planner

Responsibilities:

- Read `sources_full`.
- Read `.llmwiki-batch-state.json`.
- Pick the next batch using configured pattern priority and limit.
- Rebuild active `sources`.

### 5. Compile Runner

Responsibilities:

- Clear stale lock if safe.
- Launch `node dist/cli.js compile` in the target vault.
- Return exit status.

### 6. Progress Updater

Responsibilities:

- Mark batch files complete on successful compile only.
- Leave progress unchanged on failure.

### 7. Desktop Entrypoint

Responsibilities:

- Invoke the orchestration pipeline in the correct order.
- Keep the console open and print a readable summary.

## Execution Flow

1. Load config.
2. If `source_folders` is empty, prompt user to choose one or more folders and save them.
3. Sync all selected roots into `sources_full`.
4. Load batch progress.
5. Build the next active batch into `sources`.
6. If no files remain, report completion and exit.
7. Validate or clear stale lock.
8. Run compile in target vault.
9. On success, update batch progress.
10. Print summary including batch count, total completed count, and output location.

## Testing Plan

### Manual Checks

1. Empty config triggers folder picker and saves choices.
2. Existing config skips picker and reuses saved sources.
3. Multiple source folders import into one combined `sources_full`.
4. First run creates `sources_full`, `sources`, manifest, and batch state.
5. Successful compile advances batch progress.
6. Failed compile leaves the same batch active.
7. Stale lock is removed only when its PID is dead.
8. Live compile lock prevents duplicate run.

### Non-Goals

- Real-time file watching.
- Full automatic background scheduling.
- Direct parsing of non-markdown attachments in this first version.
- Automatic merge conflict resolution between compiled wiki articles.

## Open Decisions Resolved

- Source folder location is configurable, not hard-coded.
- Config file lives in the compiler project root.
- Desktop entrypoint is the primary user interface.
- Default mode is batch, not full compile.
- Multiple source folders are supported.
- Progress persistence is required so repeated runs do not restart from batch one.
