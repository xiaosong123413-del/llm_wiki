import fs from "node:fs";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { readCloudflareServicesConfig } from "../../../src/utils/cloudflare-services-config.js";
import {
  extractTextResponse,
  postWorkerJson,
  type CloudflareClientError,
} from "../../../src/utils/cloudflare-http.js";

const OCR_DIR = ".llmwiki/ocr";

type CloudflareOcrResult =
  | { ok: true; path: string; text: string }
  | { ok: false; error: CloudflareClientError };

export async function writeSourceOcrSidecar(
  runtimeRoot: string,
  sourceId: string,
  text: string,
): Promise<{ path: string }> {
  const sidecarPath = getSourceOcrSidecarPath(sourceId);
  const file = path.join(runtimeRoot, ...sidecarPath.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${text.trim()}\n`, "utf8");
  return { path: sidecarPath };
}

export function readSourceOcrSidecar(runtimeRoot: string, sourceId: string): string {
  const file = path.join(runtimeRoot, ...getSourceOcrSidecarPath(sourceId).split("/"));
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8").trim();
}

export function getSourceOcrSidecarPath(sourceId: string): string {
  return `${OCR_DIR}/${safeId(sourceId)}.txt`;
}

export async function runCloudflareOcr(input: {
  runtimeRoot: string;
  sourceId: string;
  filePath: string;
}): Promise<CloudflareOcrResult> {
  const cfg = readCloudflareServicesConfig();
  if (!cfg.workerUrl || !cfg.remoteToken) {
    return {
      ok: false,
      error: {
        type: "cloudflare-unconfigured",
        message: "Missing CLOUDFLARE_WORKER_URL or CLOUDFLARE_REMOTE_TOKEN",
      },
    };
  }
  const result = await postWorkerJson<unknown>(cfg, "ocr", {
    sourceId: input.sourceId,
    model: cfg.ocrModel,
    filename: path.basename(input.filePath),
    contentBase64: fs.readFileSync(input.filePath).toString("base64"),
  });
  if (!result.ok) return result;
  const text = extractTextResponse(result.data).trim();
  const sidecar = await writeSourceOcrSidecar(input.runtimeRoot, input.sourceId, text);
  return { ok: true, path: sidecar.path, text };
}

function safeId(sourceId: string): string {
  return sourceId.trim().replace(/[\\/]+/g, "-") || "unknown";
}
