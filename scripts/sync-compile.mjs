import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  loadSyncCompileConfig,
  saveSyncCompileConfig,
} from "./sync-compile/config.mjs";
import { readBatchState, writeBatchState } from "./sync-compile/batch-state.mjs";
import { selectNextBatch } from "./sync-compile/batch-plan.mjs";
import { prepareActiveSources } from "./sync-compile/prepare-active-sources.mjs";
import { syncMarkdownSources } from "./sync-compile/sync-files.mjs";
import { canClearStaleLock } from "./sync-compile/lock.mjs";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compilerRoot = path.resolve(__dirname, "..");

export function summarizeBatchProgress({
  importedCount,
  completedCount,
  activeBatchCount,
}) {
  return [
    `Imported raw files: ${importedCount}`,
    `Completed files: ${completedCount}`,
    `Active batch size: ${activeBatchCount}`,
  ].join("\n");
}

export async function clearStaleLockIfSafe(vaultRoot) {
  const lockPath = path.join(vaultRoot, ".llmwiki", "lock");
  if (!existsSync(lockPath)) return;

  const pidText = readFileSync(lockPath, "utf8").trim();
  if (await canClearStaleLock(pidText)) {
    rmSync(lockPath, { force: true });
    return;
  }

  throw new Error(`Compilation is already running with PID ${pidText}.`);
}

async function pickSourceFolders() {
  const scriptPath = path.join(compilerRoot, "scripts", "pick-source-folders.ps1");
  const { stdout } = await execFileAsync("powershell", [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
  ]);

  const parsed = JSON.parse(stdout || "[]");
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "string" && parsed) return [parsed];
  return [];
}

async function loadOrPromptSourceFolders(config) {
  if (config.source_folders.length > 0) return config;

  const folders = await pickSourceFolders();
  if (folders.length === 0) {
    throw new Error("No source folders selected.");
  }

  const nextConfig = {
    ...config,
    source_folders: folders,
  };
  await saveSyncCompileConfig(compilerRoot, nextConfig);
  return nextConfig;
}

async function listSourceFullFiles(vaultRoot) {
  const fullDir = path.join(vaultRoot, "sources_full");
  const files = await readdir(fullDir).catch(() => []);
  return files.filter((file) => file.endsWith(".md"));
}

async function runCompile(config) {
  await clearStaleLockIfSafe(config.target_vault);

  await new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      [path.join(config.compiler_root, "dist", "cli.js"), "compile"],
      {
        cwd: config.target_vault,
        stdio: "inherit",
        shell: false,
      },
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Compile exited with code ${code ?? "unknown"}.`));
    });

    child.on("error", reject);
  });
}

async function main() {
  const initialConfig = await loadSyncCompileConfig(compilerRoot);
  const config = await loadOrPromptSourceFolders(initialConfig);

  const importedCount = await syncMarkdownSources(
    config.source_folders,
    config.target_vault,
    config.exclude_dirs,
  );

  const state = await readBatchState(config.target_vault);
  const files = await listSourceFullFiles(config.target_vault);
  const batch = selectNextBatch(files, {
    completedFiles: new Set(state.completed_files),
    batchLimit: config.batch_limit,
    patternOrder: config.batch_pattern_order,
  });

  if (batch.length === 0) {
    console.log(
      summarizeBatchProgress({
        importedCount,
        completedCount: state.completed_files.length,
        activeBatchCount: 0,
      }),
    );
    console.log("No remaining files to compile.");
    return;
  }

  await prepareActiveSources(config.target_vault, batch);
  await runCompile(config);
  await writeBatchState(config.target_vault, {
    completed_files: [...state.completed_files, ...batch],
  });

  console.log(
    summarizeBatchProgress({
      importedCount,
      completedCount: state.completed_files.length + batch.length,
      activeBatchCount: batch.length,
    }),
  );
  console.log(`Output wiki: ${path.join(config.target_vault, "wiki")}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
