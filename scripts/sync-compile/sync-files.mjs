import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

function sanitizePart(value, maxLength = 80) {
  const safe = value
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return "untitled";
  if (safe.length > maxLength) return safe.slice(0, maxLength).trim();
  return safe;
}

function quoteCsv(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

async function listMarkdownFiles(root, excludeDirs, relativeDir = "") {
  const currentDir = relativeDir ? path.join(root, relativeDir) : root;
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDir
      ? path.join(relativeDir, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue;
      files.push(...await listMarkdownFiles(root, excludeDirs, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(relativePath);
    }
  }

  return files;
}

export function buildImportedFilename(relativePath) {
  const relativeUnix = relativePath.replace(/\\/g, "/");
  const hash = createHash("sha1").update(relativeUnix).digest("hex").slice(0, 8);
  const baseName = sanitizePart(path.basename(relativePath, path.extname(relativePath)));
  const parentDir = path.dirname(relativePath);

  if (!parentDir || parentDir === ".") {
    return `${baseName}__${hash}.md`;
  }

  const prefix = sanitizePart(parentDir.replace(/\\/g, "__"));
  return `${prefix}__${baseName}__${hash}.md`;
}

export async function syncMarkdownSources(sourceFolders, vaultRoot, excludeDirs) {
  const fullDir = path.join(vaultRoot, "sources_full");
  const manifestPath = path.join(vaultRoot, "raw_import_manifest.csv");

  await mkdir(fullDir, { recursive: true });
  const existing = await readdir(fullDir).catch(() => []);
  await Promise.all(
    existing.map((file) => rm(path.join(fullDir, file), { force: true, recursive: true })),
  );

  const rows = [
    ["source_root", "source_relative_path", "imported_filename", "size", "last_write_time"],
  ];

  let imported = 0;
  for (const sourceRoot of sourceFolders) {
    const markdownFiles = await listMarkdownFiles(sourceRoot, excludeDirs);
    for (const relativePath of markdownFiles) {
      const sourcePath = path.join(sourceRoot, relativePath);
      const destinationName = buildImportedFilename(relativePath);
      const destinationPath = path.join(fullDir, destinationName);
      const fileStat = await stat(sourcePath);
      await copyFile(sourcePath, destinationPath);
      rows.push([
        sourceRoot,
        relativePath.replace(/\\/g, "/"),
        destinationName,
        String(fileStat.size),
        fileStat.mtime.toISOString(),
      ]);
      imported += 1;
    }
  }

  const csv = `${rows.map((row) => row.map(quoteCsv).join(",")).join("\n")}\n`;
  await writeFile(manifestPath, csv, "utf8");
  return imported;
}
