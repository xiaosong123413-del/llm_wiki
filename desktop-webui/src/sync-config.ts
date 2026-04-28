import path from "node:path";

export interface SyncCompileConfig {
  source_vault_root?: string;
  runtime_output_root?: string;
  compiler_root?: string;
  source_folders?: string[];
  compile_mode?: string;
  batch_limit?: number;
  batch_pattern_order?: string[];
  exclude_dirs?: string[];
  [key: string]: unknown;
}

export function getDefaultDesktopRuntimeRoot(projectRoot: string): string {
  return path.join(projectRoot, ".runtime", "ai-vault");
}

export function normalizeDesktopSyncCompileConfig(
  projectRoot: string,
  existingConfig: SyncCompileConfig,
  sourceVaultRoot: string,
): SyncCompileConfig {
  const runtimeOutputRoot = existingConfig.runtime_output_root?.trim()
    || getDefaultDesktopRuntimeRoot(projectRoot);

  return {
    ...existingConfig,
    source_vault_root: sourceVaultRoot.trim(),
    runtime_output_root: runtimeOutputRoot,
  };
}
