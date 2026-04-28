/**
 * Append-only runtime maintenance log for wiki operations.
 *
 * Header format is intentionally stable so simple tools can parse it:
 *   grep "^## \[" log.md | tail -5
 */

import { appendFile, mkdir } from "fs/promises";
import path from "path";
import { LOG_FILE } from "./constants.js";

type MaintenanceLogDetail =
  | string
  | number
  | boolean
  | string[]
  | undefined
  | null;

interface MaintenanceLogEntry {
  action: string;
  title: string;
  timestamp?: Date;
  details?: Record<string, MaintenanceLogDetail>;
}

function oneLine(value: unknown, fallback = "-"): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : fallback;
}

function formatDetail(value: MaintenanceLogDetail): string {
  if (Array.isArray(value)) {
    return value.map((item) => oneLine(item)).join(", ");
  }
  return oneLine(value);
}

export function formatMaintenanceLogEntry(entry: MaintenanceLogEntry): string {
  const timestamp = entry.timestamp ?? new Date();
  const iso = timestamp.toISOString();
  const date = iso.slice(0, 10);
  const header = `## [${date}] ${oneLine(entry.action)} | ${oneLine(entry.title)}`;
  const lines = [header, "", `- time: ${iso}`];

  for (const [key, value] of Object.entries(entry.details ?? {})) {
    if (value === undefined || value === null) continue;
    lines.push(`- ${oneLine(key)}: ${formatDetail(value)}`);
  }

  return `${lines.join("\n")}\n\n`;
}

export async function appendMaintenanceLog(
  root: string,
  entry: MaintenanceLogEntry,
): Promise<void> {
  const logPath = path.join(root, LOG_FILE);
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, formatMaintenanceLogEntry(entry), "utf-8");
}
