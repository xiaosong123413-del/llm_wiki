import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STATE_FILE = ".llmwiki-batch-state.json";

export function getBatchStatePath(vaultRoot) {
  return path.join(vaultRoot, STATE_FILE);
}

export async function readBatchState(vaultRoot) {
  try {
    return normalizeBatchState(JSON.parse(await readFile(getBatchStatePath(vaultRoot), "utf8")));
  } catch {
    return normalizeBatchState({});
  }
}

export async function writeBatchState(vaultRoot, state) {
  await mkdir(vaultRoot, { recursive: true });
  await writeFile(
    getBatchStatePath(vaultRoot),
    `${JSON.stringify(normalizeBatchState(state), null, 2)}\n`,
    "utf8",
  );
}

function normalizeBatchState(state) {
  const completedFiles = Array.isArray(state?.completed_files) ? state.completed_files : [];
  const flashDiaryAutoCompile = typeof state?.flash_diary_auto_compile === "object" && state.flash_diary_auto_compile
    ? state.flash_diary_auto_compile
    : {};
  return {
    completed_files: completedFiles,
    flash_diary_auto_compile: {
      last_run_on: typeof flashDiaryAutoCompile.last_run_on === "string"
        ? flashDiaryAutoCompile.last_run_on
        : null,
    },
  };
}
