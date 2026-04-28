import fs from "node:fs";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { readCloudflareServicesConfig } from "../../../src/utils/cloudflare-services-config.js";
import {
  extractTextResponse,
  postWorkerJson,
  type CloudflareClientError,
} from "../../../src/utils/cloudflare-http.js";

const TRANSCRIPT_DIR = ".llmwiki/transcripts";

type CloudflareTranscriptResult =
  | { ok: true; path: string; text: string }
  | { ok: false; error: CloudflareClientError };

type CloudflareTranscriptTextResult =
  | { ok: true; text: string }
  | { ok: false; error: CloudflareClientError };

export async function writeSourceTranscriptSidecar(
  runtimeRoot: string,
  sourceId: string,
  text: string,
): Promise<{ path: string }> {
  const sidecarPath = getSourceTranscriptSidecarPath(sourceId);
  const file = path.join(runtimeRoot, ...sidecarPath.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${text.trim()}\n`, "utf8");
  return { path: sidecarPath };
}

export function readSourceTranscriptSidecar(runtimeRoot: string, sourceId: string): string {
  const file = path.join(runtimeRoot, ...getSourceTranscriptSidecarPath(sourceId).split("/"));
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8").trim();
}

function getSourceTranscriptSidecarPath(sourceId: string): string {
  return `${TRANSCRIPT_DIR}/${safeId(sourceId)}.txt`;
}

export async function runCloudflareTranscription(input: {
  runtimeRoot: string;
  sourceId: string;
  filePath: string;
}): Promise<CloudflareTranscriptResult> {
  const transcript = await transcribeFileWithCloudflare({ filePath: input.filePath });
  if (!transcript.ok) return transcript;
  const sidecar = await writeSourceTranscriptSidecar(input.runtimeRoot, input.sourceId, transcript.text);
  return { ok: true, path: sidecar.path, text: transcript.text };
}

export async function transcribeFileWithCloudflare(input: {
  filePath: string;
}): Promise<CloudflareTranscriptTextResult> {
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
  const result = await postWorkerJson<unknown>(cfg, "transcribe", {
    sourceId: path.basename(input.filePath),
    model: cfg.transcribeModel,
    filename: path.basename(input.filePath),
    contentBase64: fs.readFileSync(input.filePath).toString("base64"),
  });
  if (!result.ok) return result;
  const text = extractTextResponse(result.data).trim();
  return { ok: true, text };
}

function safeId(sourceId: string): string {
  return sourceId.trim().replace(/[\\/]+/g, "-") || "unknown";
}
