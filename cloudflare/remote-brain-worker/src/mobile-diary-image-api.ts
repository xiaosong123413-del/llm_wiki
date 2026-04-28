/**
 * Scheduled diary cover image generation for mobile entries.
 *
 * The phone stores the active image provider in D1. The scheduled Worker reads
 * that provider at 23:30 China time and prepends a generated cover image to the
 * newest diary entry for the day when the day has text but no image.
 */

import type { MobileAiProviderRequest, MobileOwnerPayload } from "./mobile-shared.js";
import { parseStringArray } from "./mobile-shared.js";
import { json, safeJson } from "./worker-support.js";

interface MobileDiaryImageEnv {
  DB?: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  PUBLIC_MEDIA_BASE_URL?: string;
}

interface MobileProviderSavePayload extends MobileOwnerPayload {
  provider?: MobileAiProviderRequest | null;
}

interface StoredImageProvider {
  ownerUid: string;
  apiName: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

interface DiaryImageEntryRow {
  id: string;
  text: string;
  mediaFilesJson: string;
  createdAt: string;
}

interface ImageGenerationResponse {
  data?: Array<{
    b64_json?: unknown;
    url?: unknown;
  }>;
  error?: unknown;
}

interface GeneratedImage {
  bytes: Uint8Array;
  contentType: string;
}

export interface DailyDiaryImageResult {
  ownerCount: number;
  checkedCount: number;
  generatedCount: number;
  skippedCount: number;
}

export async function handleMobileProviderSave(request: Request, env: MobileDiaryImageEnv): Promise<Response> {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const payload = await safeJson<MobileProviderSavePayload>(request);
  const ownerUid = String(payload.ownerUid ?? "").trim();
  if (!ownerUid) return json({ ok: false, error: "missing_owner_uid" }, 400);

  const provider = payload.provider;
  if (!isApiImageProvider(provider)) {
    await db.prepare("DELETE FROM mobile_ai_providers WHERE owner_uid = ?").bind(ownerUid).run();
    return json({ ok: true, enabled: false });
  }

  const apiName = readText(provider.apiName);
  const apiBaseUrl = readText(provider.apiBaseUrl);
  const apiKey = readText(provider.apiKey);
  const model = readText(provider.model);
  await db.prepare(
    "INSERT INTO mobile_ai_providers (owner_uid, mode, api_name, api_base_url, api_key, image_model, updated_at) VALUES (?, 'api', ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(owner_uid) DO UPDATE SET mode = excluded.mode, api_name = excluded.api_name, api_base_url = excluded.api_base_url, api_key = excluded.api_key, image_model = excluded.image_model, updated_at = CURRENT_TIMESTAMP",
  ).bind(ownerUid, apiName, apiBaseUrl, apiKey, model).run();
  return json({ ok: true, enabled: true });
}

export async function writeDailyDiaryImages(
  env: MobileDiaryImageEnv,
  now = new Date(),
): Promise<DailyDiaryImageResult> {
  const result: DailyDiaryImageResult = {
    ownerCount: 0,
    checkedCount: 0,
    generatedCount: 0,
    skippedCount: 0,
  };
  if (!env.DB || !env.MEDIA_BUCKET || !readText(env.PUBLIC_MEDIA_BASE_URL)) {
    return result;
  }

  const providers = await readImageProviders(env.DB);
  result.ownerCount = providers.length;
  const targetDate = formatChinaDate(now);
  for (const provider of providers) {
    result.checkedCount += 1;
    try {
      const entries = await readDiaryEntriesForDate(env.DB, provider.ownerUid, targetDate);
      if (!entries.length || entries.some((entry) => hasImageMedia(parseStringArray(entry.mediaFilesJson)))) {
        result.skippedCount += 1;
        continue;
      }
      const diaryText = entries.map((entry) => entry.text.trim()).filter(Boolean).join("\n\n");
      if (!diaryText) {
        result.skippedCount += 1;
        continue;
      }
      const generatedImage = await generateDiaryImage(provider, diaryText);
      const mediaKey = `generated-diary/${provider.ownerUid}/${targetDate}/${crypto.randomUUID()}.png`;
      await env.MEDIA_BUCKET.put(mediaKey, generatedImage.bytes, {
        httpMetadata: { contentType: generatedImage.contentType },
      });
      const mediaUrl = buildMediaUrl(readText(env.PUBLIC_MEDIA_BASE_URL), mediaKey);
      const latestEntry = entries[0]!;
      const nextMediaFiles = [mediaUrl, ...parseStringArray(latestEntry.mediaFilesJson)];
      await env.DB.prepare(
        "UPDATE mobile_entries SET media_files_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(JSON.stringify(nextMediaFiles), latestEntry.id).run();
      result.generatedCount += 1;
    } catch (error) {
      console.error("daily_diary_image_failed", provider.ownerUid, error);
      result.skippedCount += 1;
    }
  }
  return result;
}

async function readImageProviders(db: D1Database): Promise<StoredImageProvider[]> {
  const response = await db.prepare(
    "SELECT owner_uid AS ownerUid, api_name AS apiName, api_base_url AS apiBaseUrl, api_key AS apiKey, image_model AS model FROM mobile_ai_providers WHERE mode = 'api' AND image_model <> ''",
  ).all();
  return (response.results ?? []).map((row) => ({
    ownerUid: readText(row.ownerUid),
    apiName: readText(row.apiName),
    apiBaseUrl: readText(row.apiBaseUrl),
    apiKey: readText(row.apiKey),
    model: readText(row.model),
  })).filter((provider) => provider.ownerUid && provider.apiBaseUrl && provider.apiKey && provider.model);
}

async function readDiaryEntriesForDate(
  db: D1Database,
  ownerUid: string,
  targetDate: string,
): Promise<DiaryImageEntryRow[]> {
  const response = await db.prepare(
    "SELECT id, text, media_files_json AS mediaFilesJson, created_at AS createdAt FROM mobile_entries WHERE owner_uid = ? AND type = 'flash_diary' AND target_date = ? ORDER BY created_at DESC LIMIT 50",
  ).bind(ownerUid, targetDate).all();
  return (response.results ?? []).map((row) => ({
    id: readText(row.id),
    text: readText(row.text),
    mediaFilesJson: readText(row.mediaFilesJson) || "[]",
    createdAt: readText(row.createdAt),
  })).filter((entry) => entry.id);
}

async function generateDiaryImage(provider: StoredImageProvider, diaryText: string): Promise<GeneratedImage> {
  const response = await fetch(createImagesUrl(provider.apiBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      prompt: buildDiaryImagePrompt(diaryText),
      size: "1536x1024",
    }),
  });
  const payload = await response.json().catch(() => ({})) as ImageGenerationResponse;
  if (!response.ok) {
    throw new Error(`Provider 生图失败：${readProviderError(payload) || response.status}`);
  }
  const firstImage = payload.data?.[0];
  if (typeof firstImage?.b64_json === "string" && firstImage.b64_json.trim()) {
    return {
      bytes: decodeBase64Image(firstImage.b64_json),
      contentType: "image/png",
    };
  }
  if (typeof firstImage?.url === "string" && firstImage.url.trim()) {
    return fetchGeneratedImage(firstImage.url);
  }
  throw new Error("Provider 没有返回图片。");
}

async function fetchGeneratedImage(url: string): Promise<GeneratedImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Provider 图片读取失败：${response.status}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
  };
}

function isApiImageProvider(provider: MobileAiProviderRequest | null | undefined): provider is MobileAiProviderRequest {
  return provider?.mode === "api"
    && Boolean(readText(provider.apiBaseUrl))
    && Boolean(readText(provider.apiKey))
    && Boolean(readText(provider.model));
}

function buildDiaryImagePrompt(diaryText: string): string {
  const clippedText = diaryText.replace(/\s+/g, " ").trim().slice(0, 1200);
  return `根据以下日记内容生成一张温暖、真实、无文字的日记封面图，适合横向时间线卡片展示。不要生成任何文字、标志或水印。\n\n${clippedText}`;
}

function hasImageMedia(mediaFiles: string[]): boolean {
  return mediaFiles.some((file) => /^data:image\//i.test(file) || /\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|#|$)/i.test(file));
}

function createImagesUrl(apiBaseUrl: string): string {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  return baseUrl.endsWith("/v1") ? `${baseUrl}/images/generations` : `${baseUrl}/v1/images/generations`;
}

function buildMediaUrl(baseUrl: string, mediaKey: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/media/${mediaKey.split("/").map(encodeURIComponent).join("/")}`;
}

function decodeBase64Image(content: string): Uint8Array {
  const base64 = content.includes(",") ? content.split(",").pop() ?? "" : content;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function formatChinaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = readDatePart(parts, "year");
  const month = readDatePart(parts, "month");
  const day = readDatePart(parts, "day");
  return `${year}-${month}-${day}`;
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function readProviderError(payload: ImageGenerationResponse): string {
  const error = payload.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
