import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  IMPORT_MANIFEST_JSON,
  addSourceHeader,
  resolveSourceMetadata,
} from "./intake.mjs";
import { listFilesRecursive } from "./file-listing.mjs";

export const MARKDOWN_GUIDE_FILENAME = "00-\u5168\u91cf\u539f\u6599\u4ed3\u8bf4\u660e.txt";
export const ASSET_MIRROR_DIR_NAME = "\u9644\u4ef6\u526f\u672c\uff08\u975eMarkdown\uff09";
export const ASSET_GUIDE_FILENAME = "00-\u9644\u4ef6\u8bf4\u660e.txt";

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

function buildMarkdownGuide() {
  return [
    "\u8fd9\u91cc\u662f sources_full\uff08\u5168\u91cf Markdown \u539f\u6599\u4ed3\uff09\u3002",
    "",
    "1. \u8fd9\u4e2a\u76ee\u5f55\u4fdd\u5b58\u4ece\u6e90\u77e5\u8bc6\u5e93\u540c\u6b65\u8fc7\u6765\u7684\u5168\u90e8 Markdown \u526f\u672c\u3002",
    "2. \u6587\u4ef6\u540d\u662f\u201c\u539f\u8def\u5f84\u6458\u8981 + \u54c8\u5e0c\u201d\uff0c\u7528\u6765\u907f\u514d\u91cd\u540d\u5e76\u652f\u6301\u5206\u6279\u7f16\u8bd1\u3002",
    "3. \u771f\u6b63\u9001\u53bb compile \u7684\u53ea\u6709 sources \u76ee\u5f55\u4e2d\u7684\u5f53\u524d\u6279\u6b21\u6587\u4ef6\uff1bsources_full \u662f\u5b8c\u6574\u539f\u6599\u5e93\u3002",
    `4. \u975e Markdown \u9644\u4ef6\u5df2\u5355\u72ec\u653e\u5728 .\\${ASSET_MIRROR_DIR_NAME} \u4e2d\uff0c\u4e0d\u4f1a\u8fdb\u5165 compile\u3002`,
  ].join("\n");
}

function buildAssetGuide() {
  return [
    "\u8fd9\u91cc\u662f\u9644\u4ef6\u526f\u672c\u533a\uff0c\u4fdd\u5b58 png\u3001jpg\u3001pdf\u3001docx\u3001mp4 \u7b49\u975e Markdown \u6587\u4ef6\u3002",
    "",
    "1. \u6bcf\u4e2a\u5b50\u6587\u4ef6\u5939\u5bf9\u5e94\u4e00\u4e2a\u6e90\u77e5\u8bc6\u5e93\u3002",
    "2. \u5b50\u6587\u4ef6\u5939\u5185\u90e8\u4fdd\u7559\u539f\u59cb\u76ee\u5f55\u7ed3\u6784\uff0c\u65b9\u4fbf\u4f60\u627e\u56de\u56fe\u7247\u3001PDF \u548c\u5176\u4ed6\u9644\u4ef6\u3002",
    "3. \u8fd9\u4e9b\u6587\u4ef6\u53ea\u505a\u672c\u5730\u955c\u50cf\u5907\u4efd\uff0c\u4e0d\u4f1a\u8fdb\u5165 compile\uff0c\u4e5f\u4e0d\u4f1a\u6d88\u8017 LLM token\u3002",
  ].join("\n");
}

async function resetDirectory(targetDir) {
  const existing = await readdir(targetDir).catch(() => []);
  await Promise.all(
    existing.map((name) => rm(path.join(targetDir, name), { force: true, recursive: true })),
  );
}

async function pruneMirroredMarkdownFiles(targetDir, expectedFiles) {
  const entries = await readdir(targetDir, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile()) return;
    if (entry.name === MARKDOWN_GUIDE_FILENAME) return;
    if (expectedFiles.has(entry.name)) return;
    await rm(path.join(targetDir, entry.name), { force: true });
  }));
}

async function writeMirroredMarkdownIfChanged(destinationPath, content) {
  const existing = await readFile(destinationPath, "utf8").catch(() => null);
  if (existing === content) return false;
  await writeFile(destinationPath, content, "utf8");
  return true;
}

export async function inspectSourceFolders(sourceFolders, excludeDirs) {
  let markdownCount = 0;
  let assetCount = 0;

  for (const sourceRoot of sourceFolders) {
    const markdownFiles = await listFilesRecursive(sourceRoot, {
      excludeDirs,
      predicate: (entryName) => entryName.toLowerCase().endsWith(".md"),
    });
    const assetFiles = await listFilesRecursive(sourceRoot, {
      excludeDirs,
      predicate: (entryName) => !entryName.toLowerCase().endsWith(".md"),
    });

    markdownCount += markdownFiles.length;
    assetCount += assetFiles.length;
  }

  return { markdownCount, assetCount };
}

function buildSourceMirrorName(sourceRoot) {
  const hash = createHash("sha1")
    .update(path.resolve(sourceRoot))
    .digest("hex")
    .slice(0, 8);
  const baseName = sanitizePart(path.basename(sourceRoot), 40);
  return `${baseName}__${hash}`;
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
  const manifestJsonPath = path.join(vaultRoot, IMPORT_MANIFEST_JSON);

  await mkdir(fullDir, { recursive: true });

  const rows = [
    [
      "source_root",
      "source_relative_path",
      "imported_filename",
      "size",
      "last_write_time",
      "source_kind",
      "source_channel",
      "source_title",
      "source_url",
    ],
  ];
  const imports = [];
  const expectedFiles = new Set();

  let imported = 0;
  for (const sourceRoot of sourceFolders) {
    const markdownFiles = await listFilesRecursive(sourceRoot, {
      excludeDirs,
      predicate: (entryName) => entryName.toLowerCase().endsWith(".md"),
    });

    for (const relativePath of markdownFiles) {
      const sourcePath = path.join(sourceRoot, relativePath);
      const destinationName = buildImportedFilename(relativePath);
      const destinationPath = path.join(fullDir, destinationName);
      const fileStat = await stat(sourcePath);
      const originalContent = await readFile(sourcePath, "utf8");
      const metadata = resolveSourceMetadata(sourceRoot, relativePath, sourcePath, originalContent);
      const mirroredContent = addSourceHeader(originalContent, metadata);
      expectedFiles.add(destinationName);
      await writeMirroredMarkdownIfChanged(destinationPath, mirroredContent);
      rows.push([
        sourceRoot,
        relativePath.replace(/\\/g, "/"),
        destinationName,
        String(fileStat.size),
        fileStat.mtime.toISOString(),
        metadata.source_kind,
        metadata.source_channel,
        metadata.source_title,
        metadata.source_url,
      ]);
      imports.push({
        source_root: sourceRoot,
        source_relative_path: relativePath.replace(/\\/g, "/"),
        source_path: sourcePath,
        imported_filename: destinationName,
        size: fileStat.size,
        last_write_time: fileStat.mtime.toISOString(),
        ...metadata,
      });
      imported += 1;
    }
  }

  await pruneMirroredMarkdownFiles(fullDir, expectedFiles);

  const csv = `${rows.map((row) => row.map(quoteCsv).join(",")).join("\n")}\n`;
  await writeFile(manifestPath, csv, "utf8");
  await writeFile(manifestJsonPath, `${JSON.stringify({ imports }, null, 2)}\n`, "utf8");
  await writeFile(path.join(fullDir, MARKDOWN_GUIDE_FILENAME), buildMarkdownGuide(), "utf8");
  return imported;
}

export async function syncNonMarkdownAssets(sourceFolders, vaultRoot, excludeDirs) {
  const attachmentsRoot = path.join(vaultRoot, "sources_full", ASSET_MIRROR_DIR_NAME);
  const manifestPath = path.join(vaultRoot, "raw_asset_manifest.csv");

  await mkdir(attachmentsRoot, { recursive: true });
  await resetDirectory(attachmentsRoot);

  const rows = [
    [
      "source_root",
      "source_relative_path",
      "destination_relative_path",
      "size",
      "last_write_time",
    ],
  ];

  let copied = 0;
  for (const sourceRoot of sourceFolders) {
    const sourceMirrorName = buildSourceMirrorName(sourceRoot);
    const assetFiles = await listFilesRecursive(sourceRoot, {
      excludeDirs,
      predicate: (entryName) => !entryName.toLowerCase().endsWith(".md"),
    });

    for (const relativePath of assetFiles) {
      const sourcePath = path.join(sourceRoot, relativePath);
      const destinationRelativePath = path.join(sourceMirrorName, relativePath);
      const destinationPath = path.join(attachmentsRoot, destinationRelativePath);
      const fileStat = await stat(sourcePath);

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
      rows.push([
        sourceRoot,
        relativePath.replace(/\\/g, "/"),
        destinationRelativePath.replace(/\\/g, "/"),
        String(fileStat.size),
        fileStat.mtime.toISOString(),
      ]);
      copied += 1;
    }
  }

  const csv = `${rows.map((row) => row.map(quoteCsv).join(",")).join("\n")}\n`;
  await writeFile(manifestPath, csv, "utf8");
  await writeFile(path.join(attachmentsRoot, ASSET_GUIDE_FILENAME), buildAssetGuide(), "utf8");
  return copied;
}
