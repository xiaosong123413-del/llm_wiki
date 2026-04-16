import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STATE_FILE = ".llmwiki-batch-state.json";

export function getBatchStatePath(vaultRoot) {
  return path.join(vaultRoot, STATE_FILE);
}

export async function readBatchState(vaultRoot) {
  try {
    return JSON.parse(await readFile(getBatchStatePath(vaultRoot), "utf8"));
  } catch {
    return { completed_files: [] };
  }
}

export async function writeBatchState(vaultRoot, state) {
  await mkdir(vaultRoot, { recursive: true });
  await writeFile(
    getBatchStatePath(vaultRoot),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}
