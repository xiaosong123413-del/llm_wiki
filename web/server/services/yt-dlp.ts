import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import type {
  ClipCollectInput,
  ClipCollection,
  ClipDownloadedMedia,
  ClipMetadata,
  ClipRunner,
} from "./clip-pipeline.js";
import { detectClipPlatform } from "./clip-platform.js";

type YtDlpSource = "project" | "path" | "missing";

export interface YtDlpStatus {
  installed: boolean;
  source: YtDlpSource;
  path?: string;
  version?: string;
  message?: string;
}

interface YtDlpRawMetadata {
  title?: unknown;
  description?: unknown;
  uploader?: unknown;
  channel?: unknown;
  webpage_url?: unknown;
  extractor?: unknown;
  extractor_key?: unknown;
  duration?: unknown;
  formats?: unknown;
}

const LOCAL_YT_DLP_CANDIDATES = [
  ["tools", "yt-dlp.exe"],
  ["tools", "yt-dlp"],
  ["bin", "yt-dlp.exe"],
  ["bin", "yt-dlp"],
];

export async function detectYtDlp(projectRoot: string): Promise<YtDlpStatus> {
  for (const segments of LOCAL_YT_DLP_CANDIDATES) {
    const candidate = path.join(projectRoot, ...segments);
    if (!fs.existsSync(candidate)) continue;
    const version = await readYtDlpVersion(candidate);
    if (version) return { installed: true, source: "project", path: candidate, version };
  }
  for (const command of process.platform === "win32" ? ["yt-dlp.exe", "yt-dlp"] : ["yt-dlp"]) {
    const version = await readYtDlpVersion(command);
    if (version) return { installed: true, source: "path", path: command, version };
  }
  return { installed: false, source: "missing", message: "yt-dlp not found" };
}

export async function installYtDlp(projectRoot: string): Promise<YtDlpStatus> {
  const toolsDir = path.join(projectRoot, "tools");
  await mkdir(toolsDir, { recursive: true });
  const target = path.join(toolsDir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  const response = await fetch(resolveDownloadUrl());
  if (!response.ok) throw new Error(`yt-dlp download failed: ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  if (process.platform !== "win32") fs.chmodSync(target, 0o755);
  const detected = await detectYtDlp(projectRoot);
  return { ...detected, message: detected.installed ? "yt-dlp installed" : "yt-dlp downloaded but not executable" };
}

export function createYtDlpRunner(projectRoot: string): ClipRunner {
  return {
    async collect(input: ClipCollectInput): Promise<ClipCollection> {
      const status = await detectYtDlp(projectRoot);
      if (!status.installed || !status.path) throw new Error("yt-dlp not found");
      await mkdir(input.outputDir, { recursive: true });
      const metadata = await readYtDlpMetadata(status.path, input.url);
      const warnings: string[] = [];
      const media = await downloadYtDlpMedia(status.path, input, metadata, warnings);
      return { metadata, media, warnings };
    },
  };
}

async function readYtDlpMetadata(binary: string, url: string): Promise<ClipMetadata> {
  const raw = await execFileText(binary, ["--dump-single-json", "--skip-download", "--no-warnings", url]);
  const parsed = JSON.parse(raw) as YtDlpRawMetadata;
  const webpageUrl = stringField(parsed.webpage_url) ?? url;
  return {
    title: stringField(parsed.title) ?? "未命名剪藏",
    description: stringField(parsed.description),
    author: stringField(parsed.uploader) ?? stringField(parsed.channel),
    webpageUrl,
    platform: detectClipPlatform(webpageUrl),
    siteName: stringField(parsed.extractor) ?? stringField(parsed.extractor_key),
    contentType: hasVideoSignals(parsed) ? "video" : "article",
  };
}

async function downloadYtDlpMedia(
  binary: string,
  input: ClipCollectInput,
  metadata: ClipMetadata,
  warnings: string[],
): Promise<ClipDownloadedMedia[]> {
  const before = await listFiles(input.outputDir);
  try {
    await execFileText(binary, buildYtDlpDownloadArgs(input));
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }
  return collectNewMedia(await listFiles(input.outputDir), before, metadata.title);
}

function collectNewMedia(after: Set<string>, before: Set<string>, title: string): ClipDownloadedMedia[] {
  return [...after]
    .filter((file) => !before.has(file))
    .filter((file) => /\.(jpe?g|png|webp|gif|mp4|mkv|webm|mov|m4v)$/i.test(file))
    .map((file) => ({ kind: isVideoFile(file) ? "video" : "image", path: file, title }));
}

function buildYtDlpDownloadArgs(input: ClipCollectInput): string[] {
  return [
    "-f",
    "bv*[height<=720]+ba/b[height<=720]/best[height<=720]/best",
    "--merge-output-format",
    "mp4",
    "--write-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "-o",
    path.join(input.outputDir, "%(title).80s.%(ext)s"),
    input.url,
  ];
}

async function listFiles(dir: string): Promise<Set<string>> {
  if (!fs.existsSync(dir)) return new Set();
  const entries = await readdir(dir, { withFileTypes: true });
  return new Set(entries.filter((entry) => entry.isFile()).map((entry) => path.join(dir, entry.name)));
}

async function readYtDlpVersion(binary: string): Promise<string | undefined> {
  try {
    return (await execFileText(binary, ["--version"])).trim();
  } catch {
    return undefined;
  }
}

function execFileText(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message).trim()));
        return;
      }
      resolve(String(stdout));
    });
  });
}

function resolveDownloadUrl(): string {
  const base = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
  return process.platform === "win32" ? `${base}/yt-dlp.exe` : `${base}/yt-dlp`;
}

function hasVideoSignals(value: YtDlpRawMetadata): boolean {
  return typeof value.duration === "number" || Array.isArray(value.formats);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isVideoFile(file: string): boolean {
  return /\.(mp4|mkv|webm|mov|m4v)$/i.test(file);
}
