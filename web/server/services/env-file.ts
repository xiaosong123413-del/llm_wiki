/**
 * Shared helpers for reading and updating project-local `.env` files.
 *
 * Multiple settings services persist credentials and endpoints through the
 * same file. Keeping the update logic here prevents drift between those
 * services while preserving their own validation rules.
 */

import fs from "node:fs";
import path from "node:path";

export function updateEnvFile(projectRoot: string, updates: Record<string, string | null>): void {
  const envPath = path.join(projectRoot, ".env");
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "")
    : "";
  const nextLines = existing.length > 0
    ? existing.split(/\r?\n/).filter((line) => !shouldReplaceLine(line, updates))
    : [];

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      continue;
    }
    nextLines.push(`${key}=${formatEnvValue(value)}`);
  }

  const content = nextLines.join("\n").trim();
  if (!content && !fs.existsSync(envPath)) {
    return;
  }

  fs.writeFileSync(envPath, content ? `${content}\n` : "", "utf8");
}

export function assignEnvValue(env: NodeJS.ProcessEnv, key: string, value: string | null): void {
  if (value) {
    env[key] = value;
    return;
  }
  delete env[key];
}

function shouldReplaceLine(line: string, updates: Record<string, string | null>): boolean {
  const trimmed = line.trimStart();
  return Object.keys(updates).some((key) => trimmed.startsWith(`${key}=`));
}

function formatEnvValue(value: string): string {
  return /^[A-Za-z0-9_./:@-]+$/.test(value) ? value : JSON.stringify(value);
}
