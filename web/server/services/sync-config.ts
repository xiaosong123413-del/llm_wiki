import fs from "node:fs";
import path from "node:path";
import { writeFile } from "node:fs/promises";

interface SyncRepoConfig {
  sourceVaultRoot: string;
  runtimeOutputRoot: string;
  sourceRepoPaths: string[];
}

interface SyncCompileConfigShape {
  source_vault_root?: string;
  runtime_output_root?: string;
  source_folders?: string[];
  compiler_root?: string;
  compile_mode?: string;
  batch_limit?: number;
  batch_pattern_order?: string[];
  exclude_dirs?: string[];
}

const SYNC_COMPILE_CONFIG_FILE = "sync-compile-config.json";

export function readSyncRepoConfig(projectRoot: string): SyncRepoConfig {
  const raw = readSyncCompileConfig(projectRoot);
  return {
    sourceVaultRoot: typeof raw.source_vault_root === "string" ? raw.source_vault_root.trim() : "",
    runtimeOutputRoot: typeof raw.runtime_output_root === "string" ? raw.runtime_output_root.trim() : "",
    sourceRepoPaths: Array.isArray(raw.source_folders)
      ? raw.source_folders.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

export async function saveSyncRepoConfig(projectRoot: string, input: SyncRepoConfig): Promise<SyncRepoConfig> {
  const config = normalizeSyncRepoConfig(input);
  validateSyncRepoConfig(config);
  const raw = readSyncCompileConfig(projectRoot);
  const next: SyncCompileConfigShape = {
    compiler_root: typeof raw.compiler_root === "string" ? raw.compiler_root : undefined,
    compile_mode: typeof raw.compile_mode === "string" ? raw.compile_mode : undefined,
    batch_limit: typeof raw.batch_limit === "number" ? raw.batch_limit : undefined,
    batch_pattern_order: Array.isArray(raw.batch_pattern_order)
      ? raw.batch_pattern_order.map((item) => String(item))
      : undefined,
    exclude_dirs: Array.isArray(raw.exclude_dirs)
      ? raw.exclude_dirs.map((item) => String(item))
      : undefined,
    source_vault_root: config.sourceVaultRoot,
    runtime_output_root: config.runtimeOutputRoot,
    source_folders: config.sourceRepoPaths,
  };
  const file = path.join(projectRoot, SYNC_COMPILE_CONFIG_FILE);
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return config;
}

function readSyncCompileConfig(projectRoot: string): SyncCompileConfigShape {
  const file = path.join(projectRoot, SYNC_COMPILE_CONFIG_FILE);
  if (!fs.existsSync(file)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed as SyncCompileConfigShape : {};
  } catch {
    return {};
  }
}

function normalizeSyncRepoConfig(input: SyncRepoConfig): SyncRepoConfig {
  return {
    sourceVaultRoot: input.sourceVaultRoot.trim(),
    runtimeOutputRoot: input.runtimeOutputRoot.trim(),
    sourceRepoPaths: [...new Set(input.sourceRepoPaths.map((item) => item.trim()).filter(Boolean))],
  };
}

function validateSyncRepoConfig(config: SyncRepoConfig): void {
  const sourceVaultRoot = validateExistingAbsoluteDirectory(config.sourceVaultRoot, "source vault root");
  const runtimeOutputRoot = validateExistingAbsoluteDirectory(config.runtimeOutputRoot, "runtime output root");
  validateDistinctRoots(sourceVaultRoot, runtimeOutputRoot);

  if (config.sourceRepoPaths.length === 0) {
    throw new Error("sync config must include at least one source repository path.");
  }

  const missing = config.sourceRepoPaths.find((item) => !fs.existsSync(item));
  if (missing) {
    throw new Error(`Path does not exist: ${missing}`);
  }
}

function validateExistingAbsoluteDirectory(rootPath: string, label: string): string {
  if (!rootPath) {
    throw new Error(`${label} is required.`);
  }
  if (!path.isAbsolute(rootPath)) {
    throw new Error(`${label} must be an absolute path.`);
  }
  if (!fs.existsSync(rootPath)) {
    throw new Error(`${label} must exist.`);
  }
  if (!fs.statSync(rootPath).isDirectory()) {
    throw new Error(`${label} must be an existing directory.`);
  }
  return canonicalizeRoot(rootPath);
}

function validateDistinctRoots(sourceVaultRoot: string, runtimeOutputRoot: string): void {
  if (sourceVaultRoot === runtimeOutputRoot) {
    throw new Error("source vault root and runtime output root must not be the same directory.");
  }
  if (isPathInside(runtimeOutputRoot, sourceVaultRoot)) {
    throw new Error("runtime output root must not be inside source vault root.");
  }
  if (isPathInside(sourceVaultRoot, runtimeOutputRoot)) {
    throw new Error("source vault root must not be inside runtime output root.");
  }
}

function canonicalizeRoot(rootPath: string): string {
  const realPath = fs.realpathSync.native(rootPath);
  return process.platform === "win32" ? realPath.toLowerCase() : realPath;
}

function isPathInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
