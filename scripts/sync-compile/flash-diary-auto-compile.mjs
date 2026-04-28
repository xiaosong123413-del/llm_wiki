import path from "node:path";
import { readFile } from "node:fs/promises";
import { IMPORT_MANIFEST_JSON } from "./intake.mjs";

const FLASH_DIARY_KIND = "flash";
const MORNING_END_HOUR = 12;

export function selectAutoCompileFiles(imports, completedFiles, options = {}) {
  const now = options.now ?? new Date();
  const batchState = options.batchState ?? {};
  const allowFlashDiary = shouldRunFlashDiaryAutoCompile(now, batchState);
  const yesterday = formatDate(addDays(now, -1));
  const selected = [];

  for (const item of imports) {
    if (!isEligibleImport(item, yesterday, allowFlashDiary)) continue;
    if (completedFiles.has(item.imported_filename)) continue;
    selected.push(item.imported_filename);
  }

  return selected;
}

export async function readAutoCompileFiles(vaultRoot, completedFiles, now = new Date(), batchState = {}) {
  const manifestPath = path.join(vaultRoot, IMPORT_MANIFEST_JSON);
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  return selectAutoCompileFiles(Array.isArray(parsed.imports) ? parsed.imports : [], completedFiles, {
    now,
    batchState,
  });
}

export function shouldRunFlashDiaryAutoCompile(now, batchState = {}) {
  if (!isMorning(now)) {
    return false;
  }
  return batchState?.flash_diary_auto_compile?.last_run_on !== formatDate(now);
}

export function markFlashDiaryAutoCompile(batchState = {}, now = new Date()) {
  return {
    ...batchState,
    flash_diary_auto_compile: {
      ...(batchState?.flash_diary_auto_compile ?? {}),
      last_run_on: formatDate(now),
    },
  };
}

function isEligibleImport(item, yesterday, allowFlashDiary) {
  if (item.source_kind !== FLASH_DIARY_KIND) return true;
  if (!allowFlashDiary) return false;
  return getDiaryDate(item.source_relative_path) === yesterday;
}

function getDiaryDate(relativePath) {
  const match = path.basename(String(relativePath)).match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  return match ? match[1] : null;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isMorning(date) {
  return date.getHours() < MORNING_END_HOUR;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
