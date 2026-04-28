import fs from "node:fs";
import path from "node:path";

export function resolveSyncRoots(config, compilerRoot) {
  const sourceVaultRoot = resolveRequiredRoot(config.source_vault_root, "source_vault_root");
  const runtimeRoot = resolveRequiredRoot(config.runtime_output_root, "runtime_output_root");

  validateDistinctRoots(sourceVaultRoot, runtimeRoot);

  return {
    sourceVaultRoot,
    runtimeRoot,
    runtimeWikiDir: path.join(runtimeRoot, "wiki"),
    runtimeStateDir: path.join(runtimeRoot, ".llmwiki"),
    runtimeSystemDir: path.join(runtimeRoot, ".wiki-system"),
    runtimeAuditDir: path.join(runtimeRoot, "audit"),
    runtimeSourcesDir: path.join(runtimeRoot, "sources"),
    runtimeSourcesFullDir: path.join(runtimeRoot, "sources_full"),
    compilerRoot: path.resolve(config.compiler_root ?? compilerRoot),
  };
}

function resolveRequiredRoot(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`sync-compile config must define ${fieldName}.`);
  }

  const trimmedValue = value.trim();
  if (!path.isAbsolute(trimmedValue)) {
    throw new Error(`sync-compile config ${fieldName} must be an absolute path.`);
  }
  if (!fs.existsSync(trimmedValue)) {
    throw new Error(`sync-compile config ${fieldName} must exist.`);
  }
  if (!fs.statSync(trimmedValue).isDirectory()) {
    throw new Error(`sync-compile config ${fieldName} must be an existing directory.`);
  }

  return canonicalizeRoot(trimmedValue);
}

function validateDistinctRoots(sourceVaultRoot, runtimeRoot) {
  if (sourceVaultRoot === runtimeRoot) {
    throw new Error("sync-compile source_vault_root and runtime_output_root must not be the same directory.");
  }
  if (isPathInside(runtimeRoot, sourceVaultRoot)) {
    throw new Error("sync-compile runtime_output_root must not be inside source_vault_root.");
  }
  if (isPathInside(sourceVaultRoot, runtimeRoot)) {
    throw new Error("sync-compile source_vault_root must not be inside runtime_output_root.");
  }
}

function canonicalizeRoot(rootPath) {
  const realPath = fs.realpathSync.native(rootPath);
  return process.platform === "win32" ? realPath.toLowerCase() : realPath;
}

function isPathInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}
