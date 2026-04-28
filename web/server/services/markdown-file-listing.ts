/**
 * Shared synchronous markdown file walkers for server-side services.
 *
 * Several server modules need the same "scan a tree of .md files" behavior.
 * This helper keeps recursive traversal, optional missing-root handling, and
 * relative-path output aligned without changing module-specific filtering.
 */

import fs from "node:fs";
import path from "node:path";

interface MarkdownFileListingOptions {
  excludeDirs?: string[];
  ignoreMissing?: boolean;
  relative?: boolean;
  skipHidden?: boolean;
}

interface MarkdownFileListingSettings {
  excludeDirs: Set<string>;
  ignoreMissing: boolean;
  relative: boolean;
  skipHidden: boolean;
}

export function listMarkdownFilesRecursive(
  root: string,
  options: MarkdownFileListingOptions = {},
): string[] {
  const settings = createListingSettings(options);
  return walkMarkdownFiles(root, "", settings);
}

function createListingSettings(options: MarkdownFileListingOptions): MarkdownFileListingSettings {
  return {
    excludeDirs: new Set(options.excludeDirs ?? []),
    ignoreMissing: options.ignoreMissing === true,
    relative: options.relative === true,
    skipHidden: options.skipHidden === true,
  };
}

function walkMarkdownFiles(
  root: string,
  relativeDir: string,
  settings: MarkdownFileListingSettings,
): string[] {
  const current = relativeDir ? path.join(root, relativeDir) : root;
  const entries = readDirectoryEntries(current, settings.ignoreMissing);
  return entries.flatMap((entry) => {
    if (settings.skipHidden && entry.name.startsWith(".")) {
      return [];
    }
    const nextRelativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (settings.excludeDirs.has(entry.name)) {
        return [];
      }
      return walkMarkdownFiles(root, nextRelativePath, settings);
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
      return [];
    }
    return [settings.relative ? nextRelativePath : path.join(root, nextRelativePath)];
  });
}

function readDirectoryEntries(current: string, ignoreMissing: boolean): fs.Dirent[] {
  try {
    return fs.readdirSync(current, { withFileTypes: true });
  } catch (error) {
    if (ignoreMissing && isMissingDirectoryError(error)) {
      return [];
    }
    throw error;
  }
}

function isMissingDirectoryError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error.code === "ENOENT" || error.code === "ENOTDIR"),
  );
}
