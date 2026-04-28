/**
 * Read-only Claude settings file parser.
 *
 * This module isolates the filesystem and JSON parsing work needed to read
 * `~/.claude/settings.json`, so higher-level env resolution helpers can stay
 * focused on precedence and validation.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CLAUDE_SETTINGS_PATH_ENV = "LLMWIKI_CLAUDE_SETTINGS_PATH";

export interface ClaudeSettingsEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_AUTH_TOKEN?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
}

export function readClaudeSettingsEnv(env: NodeJS.ProcessEnv = process.env): ClaudeSettingsEnv | undefined {
  const settingsPath = resolveClaudeSettingsPath(env);
  const raw = readClaudeSettingsFile(settingsPath);
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Claude settings at "${settingsPath}": ${message}`);
  }

  if (!isRecord(parsed) || !isRecord(parsed.env)) {
    return undefined;
  }

  const values: ClaudeSettingsEnv = {
    ANTHROPIC_API_KEY: normalizeSettingValue(parsed.env.ANTHROPIC_API_KEY),
    ANTHROPIC_AUTH_TOKEN: normalizeSettingValue(parsed.env.ANTHROPIC_AUTH_TOKEN),
    ANTHROPIC_BASE_URL: normalizeSettingValue(parsed.env.ANTHROPIC_BASE_URL),
    ANTHROPIC_MODEL: normalizeSettingValue(parsed.env.ANTHROPIC_MODEL),
  };

  if (hasNoAnthropicValues(values)) {
    return undefined;
  }
  return values;
}

function resolveClaudeSettingsPath(env: NodeJS.ProcessEnv): string {
  return env[CLAUDE_SETTINGS_PATH_ENV] ?? path.join(homedir(), ".claude", "settings.json");
}

function readClaudeSettingsFile(settingsPath: string): string | undefined {
  try {
    return readFileSync(settingsPath, "utf8");
  } catch (err) {
    if (isRecord(err) && err.code === "ENOENT") {
      return undefined;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read Claude settings at "${settingsPath}": ${message}`);
  }
}

function hasNoAnthropicValues(values: ClaudeSettingsEnv): boolean {
  return !values.ANTHROPIC_API_KEY
    && !values.ANTHROPIC_AUTH_TOKEN
    && !values.ANTHROPIC_BASE_URL
    && !values.ANTHROPIC_MODEL;
}

function normalizeSettingValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
