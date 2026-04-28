/**
 * Automation configuration persistence and validation.
 *
 * This module owns the persisted `automations/automations.json` shape. Reads
 * are migration-aware so existing flat automation entries can still load into
 * a valid workspace model. Saves are strict: required fields and DAG integrity
 * must be present before configuration is written back to disk.
 */

import fs from "node:fs";
import path from "node:path";
import { normalizeAutomationFlow, type AutomationFlow } from "./automation-flow.js";

const AUTOMATION_CONFIG_PATH = path.join("automations", "automations.json");
const TRIGGER_TYPES = new Set(["schedule", "webhook", "message"]);

type AutomationTrigger = "schedule" | "webhook" | "message";

export interface AutomationDefinition {
  id: string;
  name: string;
  summary: string;
  icon: string;
  trigger: AutomationTrigger;
  appId: string;
  enabled: boolean;
  schedule: string;
  webhookPath: string;
  updatedAt: string;
  flow: AutomationFlow;
}

interface AutomationConfig {
  automations: AutomationDefinition[];
}

interface AutomationConfigInput {
  automations?: unknown;
}

type NormalizeMode = "read" | "save";

export function readAutomationConfig(projectRoot: string): AutomationConfig {
  ensureAutomationConfig(projectRoot);
  const raw = fs.readFileSync(getAutomationConfigPath(projectRoot), "utf8").replace(/^\uFEFF/, "");
  return normalizeAutomationConfig(JSON.parse(raw), "read");
}

export function saveAutomationConfig(projectRoot: string, input: AutomationConfigInput): AutomationConfig {
  const config = normalizeAutomationConfig(input, "save");
  const configPath = getAutomationConfigPath(projectRoot);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function getAutomationConfigRelativePath(): string {
  return AUTOMATION_CONFIG_PATH.split(path.sep).join("/");
}

function ensureAutomationConfig(projectRoot: string): void {
  const configPath = getAutomationConfigPath(projectRoot);
  if (fs.existsSync(configPath)) {
    return;
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify({ automations: [] }, null, 2)}\n`, "utf8");
}

function getAutomationConfigPath(projectRoot: string): string {
  return path.join(projectRoot, AUTOMATION_CONFIG_PATH);
}

function normalizeAutomationConfig(input: unknown, mode: NormalizeMode): AutomationConfig {
  const record = isRecord(input) ? input : {};
  const automations = Array.isArray(record.automations)
    ? record.automations.map((automation, index) => normalizeAutomation(automation, index, mode))
    : [];
  return { automations };
}

function normalizeAutomation(input: unknown, index: number, mode: NormalizeMode): AutomationDefinition {
  if (!isRecord(input)) {
    throw new Error(`Automation ${index + 1} must be an object.`);
  }
  const base = normalizeAutomationBase(input, index);
  const metadata = normalizeAutomationMetadata(input, base.name, base.trigger, mode);
  return {
    ...base,
    ...metadata,
    enabled: input.enabled !== false,
    schedule: normalizeText(input.schedule) ?? "",
    webhookPath: normalizeText(input.webhookPath) ?? "",
    updatedAt: normalizeAutomationUpdatedAt(input.updatedAt),
    flow: normalizeAutomationFlow(input.flow, {
      id: base.id,
      name: base.name,
      summary: metadata.summary,
      trigger: base.trigger,
      appId: base.appId,
      mode,
    }),
  };
}

function normalizeAutomationBase(
  input: Record<string, unknown>,
  index: number,
): Pick<AutomationDefinition, "id" | "name" | "trigger" | "appId"> {
  const name = requireText(input.name, `Automation ${index + 1} is missing name.`);
  return {
    id: normalizeId(input.id) ?? createAutomationId(name, index),
    name,
    trigger: normalizeTrigger(input.trigger, name),
    appId: requireText(input.appId, `Automation ${name} is missing appId.`),
  };
}

function normalizeAutomationMetadata(
  input: Record<string, unknown>,
  name: string,
  trigger: AutomationTrigger,
  mode: NormalizeMode,
): Pick<AutomationDefinition, "summary" | "icon"> {
  return {
    summary: normalizeAutomationSummary(input.summary, name, trigger, mode),
    icon: normalizeAutomationIcon(input.icon, name, trigger, mode),
  };
}

function normalizeAutomationSummary(
  value: unknown,
  name: string,
  trigger: AutomationTrigger,
  mode: NormalizeMode,
): string {
  if (mode === "save") {
    return requireText(value, `Automation ${name} is missing summary.`);
  }
  return normalizeText(value) ?? createLegacySummary(name, trigger);
}

function normalizeAutomationIcon(
  value: unknown,
  name: string,
  trigger: AutomationTrigger,
  mode: NormalizeMode,
): string {
  if (mode === "save") {
    return requireText(value, `Automation ${name} is missing icon.`);
  }
  return normalizeText(value) ?? defaultIconForTrigger(trigger);
}

function normalizeAutomationUpdatedAt(value: unknown): string {
  return normalizeText(value) ?? new Date().toISOString();
}

function createLegacySummary(name: string, trigger: AutomationTrigger): string {
  return `${createLegacyTriggerTitle(trigger)}后执行 ${name}。`;
}

function createLegacyTriggerTitle(trigger: AutomationTrigger): string {
  switch (trigger) {
    case "schedule":
      return "定时触发";
    case "webhook":
      return "Webhook 触发";
    default:
      return "消息触发";
  }
}

function defaultIconForTrigger(trigger: AutomationTrigger): string {
  switch (trigger) {
    case "schedule":
      return "calendar";
    case "webhook":
      return "rocket";
    default:
      return "message-circle";
  }
}

function normalizeTrigger(input: unknown, automationName: string): AutomationTrigger {
  if (!TRIGGER_TYPES.has(String(input ?? ""))) {
    throw new Error(`Automation ${automationName} has an invalid trigger.`);
  }
  return input as AutomationTrigger;
}

function normalizeId(input: unknown): string | null {
  const text = normalizeText(input);
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || null;
}

function createAutomationId(name: string, index: number): string {
  return `${normalizeId(name) ?? "automation"}-${index + 1}`;
}

function requireText(value: unknown, message: string): string {
  const text = normalizeText(value);
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
