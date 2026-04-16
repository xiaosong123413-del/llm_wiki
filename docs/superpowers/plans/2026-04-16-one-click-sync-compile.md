# One-Click Sync And Compile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop double-click workflow that remembers multiple source folders, syncs markdown into the target vault raw layer, prepares the next compile batch, and runs compile safely.

**Architecture:** Keep the desktop entrypoint thin. Put sync, config, batch-planning, and state logic in small Node modules under `src/sync-compile/`, then call them from a dedicated Node runner. Use a small PowerShell helper only for folder-picking because Windows folder dialogs are much simpler there. Preserve full raw content in `sources_full`, compile from `sources`, and persist progress in a state file inside the target vault.

**Tech Stack:** TypeScript, Vitest, Node.js, PowerShell, Windows `.cmd`

---

### Task 1: Add Tested Config And Batch Logic

**Files:**
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\types.ts`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\config.ts`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\batch-state.ts`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\batch-plan.ts`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\sync-compile-config.test.ts`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\sync-compile-batch-plan.test.ts`

- [ ] **Step 1: Write failing config and batch tests**

```ts
import { describe, expect, it } from "vitest";
import { loadSyncCompileConfig } from "../src/sync-compile/config.js";
import { selectNextBatch } from "../src/sync-compile/batch-plan.js";

describe("loadSyncCompileConfig", () => {
  it("fills defaults when optional fields are missing", async () => {
    const config = await loadSyncCompileConfig("C:/tmp/project", {
      target_vault: "C:/vault",
      compiler_root: "C:/compiler",
      source_folders: [],
    });

    expect(config.compile_mode).toBe("batch");
    expect(config.batch_limit).toBe(20);
    expect(config.exclude_dirs).toContain(".obsidian");
  });
});

describe("selectNextBatch", () => {
  it("prioritizes patterns and excludes completed files", () => {
    const files = [
      "ai知识库（第二大脑）__概念__A.md",
      "ai知识库（第二大脑）__项目__B.md",
      "00_inbox__C.md",
    ];
    const selected = selectNextBatch(files, {
      completedFiles: new Set(["ai知识库（第二大脑）__概念__A.md"]),
      batchLimit: 1,
      patternOrder: ["ai知识库（第二大脑）__项目__*", "*"],
    });

    expect(selected).toEqual(["ai知识库（第二大脑）__项目__B.md"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/sync-compile-config.test.ts test/sync-compile-batch-plan.test.ts`
Expected: FAIL with module-not-found errors for the new sync-compile modules.

- [ ] **Step 3: Write minimal config and batch modules**

```ts
// src/sync-compile/types.ts
export interface SyncCompileConfig {
  target_vault: string;
  compiler_root: string;
  source_folders: string[];
  compile_mode: "batch" | "full";
  batch_limit: number;
  batch_pattern_order: string[];
  exclude_dirs: string[];
}

export interface BatchSelectionOptions {
  completedFiles: Set<string>;
  batchLimit: number;
  patternOrder: string[];
}
```

```ts
// src/sync-compile/config.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SyncCompileConfig } from "./types.js";

const DEFAULT_PATTERNS = [
  "ai知识库（第二大脑）__概念__*",
  "ai知识库（第二大脑）__项目__*",
  "02_领域__*",
  "01_项目__*",
  "03_资源__*",
  "*",
];

const DEFAULT_EXCLUDES = [".obsidian", ".trash", ".claude", ".claudian"];

export async function loadSyncCompileConfig(
  compilerRoot: string,
  override?: Partial<SyncCompileConfig>,
): Promise<SyncCompileConfig> {
  const filePath = path.join(compilerRoot, "sync-compile-config.json");
  const raw = override ?? JSON.parse(await readFile(filePath, "utf8"));
  return {
    target_vault: raw.target_vault ?? "",
    compiler_root: raw.compiler_root ?? compilerRoot,
    source_folders: raw.source_folders ?? [],
    compile_mode: raw.compile_mode ?? "batch",
    batch_limit: raw.batch_limit ?? 20,
    batch_pattern_order: raw.batch_pattern_order ?? DEFAULT_PATTERNS,
    exclude_dirs: raw.exclude_dirs ?? DEFAULT_EXCLUDES,
  };
}
```

```ts
// src/sync-compile/batch-plan.ts
import type { BatchSelectionOptions } from "./types.js";

function matchesPattern(name: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "u").test(name);
}

export function selectNextBatch(files: string[], options: BatchSelectionOptions): string[] {
  const remaining = files.filter((file) => !options.completedFiles.has(file));
  const selected: string[] = [];

  for (const pattern of options.patternOrder) {
    for (const file of remaining) {
      if (selected.length >= options.batchLimit) return selected;
      if (selected.includes(file)) continue;
      if (matchesPattern(file, pattern)) selected.push(file);
    }
  }

  return selected;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/sync-compile-config.test.ts test/sync-compile-batch-plan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Not applicable: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main` is not a Git repository.

### Task 2: Add Batch State And Active Sources Preparation

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\batch-state.ts`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\batch-plan.ts`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\prepare-active-sources.ts`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\sync-compile-batch-plan.test.ts`

- [ ] **Step 1: Write failing state and source-preparation tests**

```ts
it("loads empty batch state when no state file exists", async () => {
  const state = await readBatchState("C:/tmp/vault");
  expect(state.completed_files).toEqual([]);
});

it("copies only selected files into active sources", async () => {
  const prepared = await prepareActiveSources("C:/tmp/vault", [
    "ai知识库（第二大脑）__概念__A.md",
  ]);
  expect(prepared).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/sync-compile-batch-plan.test.ts`
Expected: FAIL with missing exports for `readBatchState` and `prepareActiveSources`.

- [ ] **Step 3: Write minimal batch state and source-preparation code**

```ts
// src/sync-compile/batch-state.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STATE_FILE = ".llmwiki-batch-state.json";

export interface BatchState {
  completed_files: string[];
}

export async function readBatchState(vaultRoot: string): Promise<BatchState> {
  const filePath = path.join(vaultRoot, STATE_FILE);
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as BatchState;
  } catch {
    return { completed_files: [] };
  }
}

export async function writeBatchState(vaultRoot: string, state: BatchState): Promise<void> {
  await mkdir(vaultRoot, { recursive: true });
  await writeFile(path.join(vaultRoot, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
```

```ts
// src/sync-compile/prepare-active-sources.ts
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

export async function prepareActiveSources(vaultRoot: string, selectedFiles: string[]): Promise<number> {
  const activeDir = path.join(vaultRoot, "sources");
  const fullDir = path.join(vaultRoot, "sources_full");
  await mkdir(activeDir, { recursive: true });

  const existing = await readdir(activeDir).catch(() => []);
  await Promise.all(existing.map((file) => rm(path.join(activeDir, file), { force: true })));

  for (const file of selectedFiles) {
    await cp(path.join(fullDir, file), path.join(activeDir, file), { force: true });
  }

  return selectedFiles.length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/sync-compile-batch-plan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Not applicable: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main` is not a Git repository.

### Task 3: Add Config Persistence And Folder Picker Support

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\src\sync-compile\config.ts`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\scripts\pick-source-folders.ps1`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\sync-compile-config.test.ts`

- [ ] **Step 1: Write failing tests for config persistence**

```ts
it("writes updated source folders back to config", async () => {
  await saveSyncCompileConfig("C:/tmp/project", {
    target_vault: "C:/vault",
    compiler_root: "C:/tmp/project",
    source_folders: ["C:/a", "C:/b"],
    compile_mode: "batch",
    batch_limit: 20,
    batch_pattern_order: ["*"],
    exclude_dirs: [],
  });

  const config = await loadSyncCompileConfig("C:/tmp/project");
  expect(config.source_folders).toEqual(["C:/a", "C:/b"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/sync-compile-config.test.ts`
Expected: FAIL with missing export `saveSyncCompileConfig`.

- [ ] **Step 3: Add config save support and folder picker**

```ts
// src/sync-compile/config.ts
import { readFile, writeFile } from "node:fs/promises";

export async function saveSyncCompileConfig(
  compilerRoot: string,
  config: SyncCompileConfig,
): Promise<void> {
  const filePath = path.join(compilerRoot, "sync-compile-config.json");
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
```

```powershell
# scripts/pick-source-folders.ps1
Add-Type -AssemblyName System.Windows.Forms
$folders = New-Object System.Collections.Generic.List[string]
while ($true) {
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = "选择一个同步源文件夹，取消则结束选择"
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { break }
  if (-not $folders.Contains($dialog.SelectedPath)) { $folders.Add($dialog.SelectedPath) | Out-Null }
}
$folders | ConvertTo-Json
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/sync-compile-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Not applicable: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main` is not a Git repository.

### Task 4: Add End-To-End Runner And Desktop Entrypoint

**Files:**
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\scripts\sync-compile.mjs`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\sync-compile-config.json`
- Create: `C:\Users\Administrator\Desktop\一键同步编译知识库.cmd`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\sync-compile-runner.test.ts`

- [ ] **Step 1: Write failing runner tests**

```ts
import { describe, expect, it } from "vitest";
import { chooseNextBatch } from "../scripts/sync-compile.mjs";

describe("chooseNextBatch", () => {
  it("returns empty when all files are completed", async () => {
    const result = await chooseNextBatch(["a.md"], new Set(["a.md"]), ["*"], 20);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/sync-compile-runner.test.ts`
Expected: FAIL with missing export `chooseNextBatch`.

- [ ] **Step 3: Write minimal runner, config file, and desktop entrypoint**

```js
// scripts/sync-compile.mjs
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadSyncCompileConfig, saveSyncCompileConfig } from "../src/sync-compile/config.js";
import { readBatchState, writeBatchState } from "../src/sync-compile/batch-state.js";
import { selectNextBatch } from "../src/sync-compile/batch-plan.js";
import { prepareActiveSources } from "../src/sync-compile/prepare-active-sources.js";

export async function chooseNextBatch(files, completed, patterns, limit) {
  return selectNextBatch(files, {
    completedFiles: completed,
    patternOrder: patterns,
    batchLimit: limit,
  });
}

async function run() {
  const compilerRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const config = await loadSyncCompileConfig(compilerRoot);
  if (config.source_folders.length === 0) {
    console.error("No source folders configured yet.");
    process.exit(1);
  }
  const files = await readdir(path.join(config.target_vault, "sources_full"));
  const state = await readBatchState(config.target_vault);
  const batch = await chooseNextBatch(files, new Set(state.completed_files), config.batch_pattern_order, config.batch_limit);
  if (batch.length === 0) {
    console.log("No remaining files to compile.");
    return;
  }
  await prepareActiveSources(config.target_vault, batch);
  await new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(config.compiler_root, "dist", "cli.js"), "compile"], {
      cwd: config.target_vault,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => code === 0 ? resolve(undefined) : reject(new Error(`compile exited ${code}`)));
  });
  await writeBatchState(config.target_vault, {
    completed_files: [...state.completed_files, ...batch],
  });
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

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

```bat
@echo off
cd /d "C:\Users\Administrator\Desktop\llm-wiki-compiler-main"
node "C:\Users\Administrator\Desktop\llm-wiki-compiler-main\scripts\sync-compile.mjs"
pause
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/sync-compile-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Not applicable: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main` is not a Git repository.

### Task 5: Integrate Full Sync, Folder Prompting, And Safe Lock Handling

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\scripts\sync-compile.mjs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\scripts\bulk-import-obsidian.ps1`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\sync-compile-runner.test.ts`

- [ ] **Step 1: Write failing tests for stale-lock cleanup and source-folder bootstrap**

```ts
it("treats a dead lock pid as removable", async () => {
  const result = await canClearStaleLock("C:/tmp/vault", "999999");
  expect(result).toBe(true);
});

it("uses pattern order after source bootstrap", async () => {
  const result = await chooseNextBatch(
    ["ai知识库（第二大脑）__项目__A.md", "00_inbox__B.md"],
    new Set(),
    ["ai知识库（第二大脑）__项目__*", "*"],
    1,
  );
  expect(result).toEqual(["ai知识库（第二大脑）__项目__A.md"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/sync-compile-runner.test.ts`
Expected: FAIL with missing export `canClearStaleLock`.

- [ ] **Step 3: Extend the runner to finish the workflow**

```js
// scripts/sync-compile.mjs
import { existsSync, readFileSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function canClearStaleLock(vaultRoot, pidText) {
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

async function pickFolders(compilerRoot) {
  const { stdout } = await exec("powershell", [
    "-ExecutionPolicy", "Bypass",
    "-File", path.join(compilerRoot, "scripts", "pick-source-folders.ps1"),
  ]);
  return JSON.parse(stdout || "[]");
}

async function clearStaleLock(vaultRoot) {
  const lockPath = path.join(vaultRoot, ".llmwiki", "lock");
  if (!existsSync(lockPath)) return;
  const pidText = readFileSync(lockPath, "utf8").trim();
  if (await canClearStaleLock(vaultRoot, pidText)) {
    rmSync(lockPath, { force: true });
  } else {
    throw new Error(`Compile already running with PID ${pidText}`);
  }
}

// in run():
// 1. pick and save folders when source_folders is empty
// 2. call bulk-import-obsidian.ps1 for each source root into target_vault
// 3. clear stale lock before compile
```

- [ ] **Step 4: Run the targeted tests**

Run: `npm test -- test/sync-compile-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Run an end-to-end manual verification**

Run: `node "C:\Users\Administrator\Desktop\llm-wiki-compiler-main\scripts\sync-compile.mjs"`
Expected: active batch prepared in `C:\Users\Administrator\Desktop\ai的仓库\sources`, compile starts in the target vault, and success updates `.llmwiki-batch-state.json`.

- [ ] **Step 6: Commit**

Not applicable: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main` is not a Git repository.
