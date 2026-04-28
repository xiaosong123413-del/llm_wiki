/**
 * Shared recursive file walkers for sync-compile scripts.
 *
 * Intake scanning, source mirroring, and Cloudflare publish flows all traverse
 * the same vault trees. These helpers keep directory exclusion, missing-root
 * handling, and slash normalization aligned without coupling script modules.
 */

import { createListSettings, listFilesFromDir } from "./file-listing-core.mjs";

export async function listFilesRecursive(root, options = {}) {
  const settings = createListSettings(options);
  return listFilesFromDir(root, "", settings);
}

export function listMarkdownFilesRecursive(root, options = {}) {
  return listFilesRecursive(root, {
    ...options,
    predicate: (entryName) => entryName.toLowerCase().endsWith(".md"),
  });
}
