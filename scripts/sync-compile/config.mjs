import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BATCH_PATTERNS = [
  "ai知识库（第二大脑）__概念__*",
  "ai知识库（第二大脑）__项目__*",
  "02_领域__*",
  "01_项目__*",
  "03_资源__*",
  "*",
];

export const DEFAULT_EXCLUDE_DIRS = [
  ".obsidian",
  ".trash",
  ".claude",
  ".claudian",
];

export function getConfigPath(compilerRoot) {
  return path.join(compilerRoot, "sync-compile-config.json");
}

export async function loadSyncCompileConfig(compilerRoot) {
  const configPath = getConfigPath(compilerRoot);
  const content = await readFile(configPath, "utf8");
  const raw = JSON.parse(content.replace(/^\uFEFF/, ""));

  return {
    target_vault: raw.target_vault ?? "",
    compiler_root: raw.compiler_root ?? compilerRoot,
    source_folders: raw.source_folders ?? [],
    compile_mode: raw.compile_mode ?? "batch",
    batch_limit: raw.batch_limit ?? 20,
    batch_pattern_order: raw.batch_pattern_order ?? DEFAULT_BATCH_PATTERNS,
    exclude_dirs: raw.exclude_dirs ?? DEFAULT_EXCLUDE_DIRS,
  };
}

export async function saveSyncCompileConfig(compilerRoot, config) {
  const configPath = getConfigPath(compilerRoot);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
