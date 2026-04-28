/**
 * Internal traversal primitives for sync-compile file walkers.
 *
 * The public file-listing module stays small because many scripts import it.
 * This file owns the recursive directory traversal and low-level fs behavior.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

export function createListSettings(options) {
  return {
    excludeDirs: new Set(options.excludeDirs ?? []),
    ignoreMissing: options.ignoreMissing === true,
    normalizeSlashes: options.normalizeSlashes === true,
    predicate: typeof options.predicate === "function" ? options.predicate : () => true,
  };
}

export async function listFilesFromDir(root, relativeDir, settings) {
  const currentDir = relativeDir ? path.join(root, relativeDir) : root;
  const entries = await readDirEntries(currentDir, settings.ignoreMissing);
  const files = [];
  for (const entry of entries) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (settings.excludeDirs.has(entry.name)) continue;
      files.push(...await listFilesFromDir(root, relativePath, settings));
      continue;
    }
    if (!entry.isFile() || !settings.predicate(entry.name, relativePath)) continue;
    files.push(settings.normalizeSlashes ? toSlash(relativePath) : relativePath);
  }
  return files;
}

async function readDirEntries(currentDir, ignoreMissing) {
  try {
    return await readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    if (ignoreMissing && isMissingDirectoryError(error)) return [];
    throw error;
  }
}

function isMissingDirectoryError(error) {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error.code === "ENOENT" || error.code === "ENOTDIR"),
  );
}

function toSlash(value) {
  return value.replace(/\\/g, "/");
}
