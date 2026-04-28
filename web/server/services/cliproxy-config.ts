/**
 * Shared persistence helpers for the locally managed CLIProxyAPI config.
 *
 * The process-management service owns runtime behavior, but several services
 * only need the stored OpenAI-compatible route. Keeping the config reader in a
 * tiny module avoids import cycles with the full CLIProxy service.
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const DEFAULT_PORT = 8317;
const DEFAULT_MODEL = "gpt-5-codex";
const CLIPROXY_CONFIG_FILE = "wiki-cliproxy.json";

export interface CLIProxyConfigInput {
  port?: number;
  managementKey?: string;
  clientKey?: string;
  model?: string;
  proxyUrl?: string;
  sourceDir?: string;
}

export interface CLIProxyConfig {
  port: number;
  managementKey: string;
  clientKey: string;
  model: string;
  proxyUrl?: string;
  sourceDir?: string;
}

export function cliproxyConfigDir(projectRoot: string): string {
  return path.join(projectRoot, ".llmwiki", "cliproxyapi");
}

export function cliproxySourceDir(projectRoot: string): string {
  return path.join(projectRoot, "tools", "CLIProxyAPI");
}

export function readCLIProxyConfig(projectRoot: string): CLIProxyConfig {
  const configPath = path.join(cliproxyConfigDir(projectRoot), CLIPROXY_CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    const config = {
      port: DEFAULT_PORT,
      managementKey: generateSecret("mgmt"),
      clientKey: generateSecret("wiki"),
      model: DEFAULT_MODEL,
      proxyUrl: defaultProxyUrl(),
      sourceDir: cliproxySourceDir(projectRoot),
    };
    writeCLIProxyConfigState(projectRoot, config);
    return config;
  }
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<CLIProxyConfig>;
  return {
    ...normalizeCLIProxyConfig(parsed),
    sourceDir: cliproxySourceDir(projectRoot),
  };
}

export function serializeCLIProxyConfig(config: CLIProxyConfig): CLIProxyConfig {
  const serialized: CLIProxyConfig = {
    port: config.port,
    managementKey: config.managementKey,
    clientKey: config.clientKey,
    model: config.model,
  };
  if (config.proxyUrl) {
    serialized.proxyUrl = config.proxyUrl;
  }
  return serialized;
}

export function normalizeCLIProxyConfig(input: Partial<CLIProxyConfig> = {}): CLIProxyConfig {
  const port = Number.isInteger(input.port) && input.port > 0 ? input.port : DEFAULT_PORT;
  const config: CLIProxyConfig = {
    port,
    managementKey: readText(input.managementKey) ?? generateSecret("mgmt"),
    clientKey: readText(input.clientKey) ?? generateSecret("wiki"),
    model: readText(input.model) ?? DEFAULT_MODEL,
  };
  const proxyUrl = readText(input.proxyUrl);
  const sourceDir = readText(input.sourceDir);
  if (proxyUrl) {
    config.proxyUrl = proxyUrl;
  }
  if (sourceDir) {
    config.sourceDir = sourceDir;
  }
  return config;
}

function writeCLIProxyConfigState(projectRoot: string, config: CLIProxyConfig): void {
  const dir = cliproxyConfigDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, CLIPROXY_CONFIG_FILE),
    `${JSON.stringify(serializeCLIProxyConfig(config), null, 2)}\n`,
    "utf8",
  );
}

function generateSecret(prefix: string): string {
  return `${prefix}-${randomBytes(18).toString("hex")}`;
}

function defaultProxyUrl(): string | undefined {
  return readText(process.env.GLOBAL_AGENT_HTTPS_PROXY)
    ?? readText(process.env.GLOBAL_AGENT_HTTP_PROXY)
    ?? readText(process.env.HTTPS_PROXY)
    ?? readText(process.env.HTTP_PROXY)
    ?? readText(process.env.ALL_PROXY)
    ?? undefined;
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
