import { execFile } from "node:child_process";

export interface RelayBalanceInput {
  url: string;
  key?: string;
  balancePath?: string;
  usedPath?: string;
}

interface RelayBalanceResult {
  ok: boolean;
  currentBalance: string | null;
  usedBalance: string | null;
  message: string;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>;

interface CodexCliStatus {
  ok: boolean;
  installed: boolean;
  version: string | null;
  balance: string | null;
  message: string;
}

const DEFAULT_BALANCE_PATHS = ["data.balance", "balance", "data.quota", "quota", "current_balance"];
const DEFAULT_USED_PATHS = ["data.used", "used", "data.usage.total", "usage.total", "total_used"];

export async function fetchRelayBalance(
  input: RelayBalanceInput,
  fetcher: typeof fetch = fetch,
): Promise<RelayBalanceResult> {
  const url = input.url.trim();
  if (!url) {
    return {
      ok: false,
      currentBalance: null,
      usedBalance: null,
      message: "\u9700\u8981\u5148\u586b\u5199\u4f59\u989d\u67e5\u8be2 URL\u3002",
    };
  }

  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: buildRelayHeaders(input.key),
    });
    if (!response.ok) {
      return relayFailure(`\u4e2d\u8f6c\u7ad9\u4f59\u989d\u8bfb\u53d6\u5931\u8d25\uff1aHTTP ${response.status}`);
    }

    const payload = await response.json() as unknown;
    const current = pickPath(payload, input.balancePath, DEFAULT_BALANCE_PATHS);
    const used = pickPath(payload, input.usedPath, DEFAULT_USED_PATHS);

    return {
      ok: current !== null || used !== null,
      currentBalance: formatBalance(current),
      usedBalance: formatBalance(used),
      message: current !== null || used !== null
        ? "\u4e2d\u8f6c\u7ad9\u4f59\u989d\u8bfb\u53d6\u6210\u529f\u3002"
        : "\u5df2\u8fde\u63a5\u4f59\u989d URL\uff0c\u4f46\u672a\u6309\u5b57\u6bb5\u8def\u5f84\u8bfb\u5230\u4f59\u989d\u3002",
    };
  } catch (error) {
    return relayFailure(describeRelayBalanceError(error));
  }
}

export async function getCodexCliStatus(
  runner: CommandRunner = runCommand,
): Promise<CodexCliStatus> {
  try {
    const result = await runner("codex", ["--version"]);
    const version = (result.stdout || result.stderr).trim() || "codex";
    return {
      ok: true,
      installed: true,
      version,
      balance: null,
      message: "Codex CLI \u53ef\u7528\uff1bCLI \u5f53\u524d\u6ca1\u6709\u7a33\u5b9a\u4f59\u989d\u67e5\u8be2\u63a5\u53e3\u3002",
    };
  } catch {
    return {
      ok: false,
      installed: false,
      version: null,
      balance: null,
      message: "\u672a\u68c0\u6d4b\u5230 Codex CLI\u3002",
    };
  }
}

function buildRelayHeaders(key: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const normalizedKey = key?.trim();
  if (normalizedKey) {
    headers.Authorization = `Bearer ${normalizedKey}`;
  }
  return headers;
}

function pickPath(payload: unknown, preferredPath: string | undefined, fallbackPaths: readonly string[]): unknown | null {
  const paths = preferredPath?.trim() ? [preferredPath.trim()] : fallbackPaths;
  for (const itemPath of paths) {
    const value = readPath(payload, itemPath);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function readPath(payload: unknown, itemPath: string): unknown | null {
  const parts = itemPath.replace(/^\$\./, "").split(".").map((part) => part.trim()).filter(Boolean);
  let current: unknown = payload;
  for (const part of parts) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[part];
  }
  return current ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relayFailure(message: string): RelayBalanceResult {
  return {
    ok: false,
    currentBalance: null,
    usedBalance: null,
    message,
  };
}

function describeRelayBalanceError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("unexpected token '<'") || normalized.includes("<!doctype") || normalized.includes("<html")) {
    return "\u4e2d\u8f6c\u7ad9\u4f59\u989d\u63a5\u53e3\u8fd4\u56de\u4e86\u975e JSON \u5185\u5bb9\u3002";
  }
  return `\u4e2d\u8f6c\u7ad9\u4f59\u989d\u8bfb\u53d6\u5931\u8d25\uff1a${message}`;
}

function formatBalance(value: unknown | null): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `$${value.toFixed(2)}`;
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function runCommand(command: string, args: readonly string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(command, [...args], { shell: true, windowsHide: true, timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: String(stdout),
        stderr: String(stderr),
      });
    });
  });
}
