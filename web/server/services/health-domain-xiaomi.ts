/**
 * Xiaomi Health bridge runner for the workspace health domain.
 *
 * The Node server delegates login and data sync to a small Python bridge so we
 * can reuse the unofficial `mi-fitness` SDK without pulling Python-specific
 * concerns into the TypeScript request handlers.
 */

import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { XiaomiHealthSyncSnapshot } from "./health-domain.js";

const execFileAsync = promisify(execFile);
const BRIDGE_SCRIPT_PATH = path.join("scripts", "mi-fitness-bridge.py");
const BRIDGE_TEMP_PREFIX = "mi-fitness-bridge-";
const BRIDGE_RESPONSE_MAX_BUFFER = 1024 * 1024;
const QR_LOGIN_READY_TIMEOUT_MS = 10_000;

interface XiaomiBridgeResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorData?: Record<string, unknown>;
}

interface XiaomiHealthVerificationStartInput {
  username: string;
}

interface XiaomiHealthAccountConnectInput {
  username: string;
  password: string;
  verificationCode: string;
  captchaCode?: string;
}

interface XiaomiHealthAccountConnectResult {
  tokenJson: string;
  userId: string | null;
}

interface XiaomiHealthQrLoginStartResult {
  sessionId: string;
  qrImageUrl: string;
  loginUrl: string | null;
}

type XiaomiHealthQrLoginPollResult =
  | { status: "pending" }
  | { status: "connected"; tokenJson: string; userId: string | null };

interface XiaomiHealthVerificationStartResult {
  maskedPhone: string;
  ticketReady?: boolean;
  message?: string;
}

interface XiaomiHealthSyncBridgeInput {
  tokenJson: string;
  apiBaseUrl: string | null;
  relativeUid: string | null;
}

interface QrLoginStatusFile {
  qrImageUrl?: string;
  loginUrl?: string;
}

interface QrLoginSession {
  process: ChildProcessWithoutNullStreams;
  tempDir: string;
  statusPath: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const qrLoginSessions = new Map<string, QrLoginSession>();

export class XiaomiBridgeError extends Error {
  readonly code: string | null;
  readonly details: Record<string, unknown> | null;

  constructor(
    message: string,
    code: string | null,
    details: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "XiaomiBridgeError";
    this.code = code;
    this.details = details;
  }
}

export async function startXiaomiHealthVerification(
  projectRoot: string,
  input: XiaomiHealthVerificationStartInput & { captchaCode?: string },
): Promise<XiaomiHealthVerificationStartResult> {
  return runXiaomiBridge(projectRoot, "send-code", input);
}

export async function connectXiaomiHealthAccount(
  projectRoot: string,
  input: XiaomiHealthAccountConnectInput,
): Promise<XiaomiHealthAccountConnectResult> {
  return runXiaomiBridge(projectRoot, "connect-account", input);
}

export async function startXiaomiHealthQrLogin(
  projectRoot: string,
): Promise<XiaomiHealthQrLoginStartResult> {
  const sessionId = randomUUID();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), BRIDGE_TEMP_PREFIX));
  const requestPath = path.join(tempDir, "request.json");
  const statusPath = path.join(tempDir, "qr-status.json");
  const scriptPath = path.join(projectRoot, BRIDGE_SCRIPT_PATH);
  await writeFile(
    requestPath,
    `${JSON.stringify({ projectRoot, statusPath }, null, 2)}\n`,
    "utf8",
  );
  const session = spawnQrLoginProcess(projectRoot, scriptPath, requestPath, tempDir);
  qrLoginSessions.set(sessionId, session);
  try {
    const qrStatus = await waitForQrLoginStatus(session);
    return {
      sessionId,
      qrImageUrl: qrStatus.qrImageUrl,
      loginUrl: qrStatus.loginUrl || null,
    };
  } catch (error) {
    qrLoginSessions.delete(sessionId);
    stopQrLoginSession(session);
    throw error;
  }
}

export async function pollXiaomiHealthQrLogin(
  sessionId: string,
): Promise<XiaomiHealthQrLoginPollResult> {
  const session = qrLoginSessions.get(sessionId);
  if (!session) {
    throw new Error("二维码登录会话不存在或已过期，请重新获取二维码。");
  }
  if (session.exitCode === null) {
    return { status: "pending" };
  }
  qrLoginSessions.delete(sessionId);
  await rm(session.tempDir, { recursive: true, force: true });
  if (session.exitCode === 0) {
    const result = parseBridgeResponse<XiaomiHealthAccountConnectResult>(
      session.stdout,
    );
    return { status: "connected", ...result };
  }
  throw readBridgeProcessFailure(session);
}

export async function syncXiaomiHealthSnapshot(
  projectRoot: string,
  input: XiaomiHealthSyncBridgeInput,
): Promise<XiaomiHealthSyncSnapshot> {
  return runXiaomiBridge(projectRoot, "sync", input);
}

async function runXiaomiBridge<T>(
  projectRoot: string,
  command: "send-code" | "connect-account" | "sync" | "qr-login",
  payload: Record<string, unknown>,
): Promise<T> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), BRIDGE_TEMP_PREFIX));
  const requestPath = path.join(tempDir, "request.json");
  const scriptPath = path.join(projectRoot, BRIDGE_SCRIPT_PATH);
  await writeFile(
    requestPath,
    `${JSON.stringify({ projectRoot, ...payload }, null, 2)}\n`,
    "utf8",
  );
  try {
    const { stdout } = await execFileAsync(
      "python",
      [scriptPath, command, requestPath],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
        windowsHide: true,
        maxBuffer: BRIDGE_RESPONSE_MAX_BUFFER,
      },
    );
    return parseBridgeResponse<T>(stdout);
  } catch (error) {
    throw readBridgeFailure(error);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function spawnQrLoginProcess(
  projectRoot: string,
  scriptPath: string,
  requestPath: string,
  tempDir: string,
): QrLoginSession {
  const child = spawn("python", [scriptPath, "qr-login", requestPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    },
    windowsHide: true,
  });
  const session: QrLoginSession = {
    process: child,
    tempDir,
    statusPath: path.join(tempDir, "qr-status.json"),
    stdout: "",
    stderr: "",
    exitCode: null,
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    session.stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    session.stderr += chunk;
  });
  child.on("exit", (code) => {
    session.exitCode = code ?? 1;
  });
  return session;
}

async function waitForQrLoginStatus(
  session: QrLoginSession,
): Promise<{ qrImageUrl: string; loginUrl: string }> {
  const deadline = Date.now() + QR_LOGIN_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await readQrLoginStatus(session.statusPath);
    if (status?.qrImageUrl) {
      return {
        qrImageUrl: status.qrImageUrl,
        loginUrl: status.loginUrl ?? "",
      };
    }
    if (session.exitCode !== null) {
      throw readBridgeProcessFailure(session);
    }
    await delay(200);
  }
  throw new Error("二维码生成超时，请重试。");
}

async function readQrLoginStatus(
  statusPath: string,
): Promise<QrLoginStatusFile | null> {
  try {
    return JSON.parse(await readFile(statusPath, "utf8")) as QrLoginStatusFile;
  } catch {
    return null;
  }
}

function stopQrLoginSession(session: QrLoginSession): void {
  if (session.exitCode === null) {
    session.process.kill();
  }
  void rm(session.tempDir, { recursive: true, force: true });
}

function readBridgeProcessFailure(session: QrLoginSession): Error {
  const payloadError = session.stdout
    ? readBridgePayloadError(session.stdout.trim())
    : null;
  if (payloadError) {
    return payloadError;
  }
  const stderr = readBridgeStreamText(session.stderr);
  if (stderr) {
    return new Error(stderr);
  }
  const stdout = readBridgeStreamText(session.stdout);
  return new Error(stdout ?? "二维码登录失败，请重新获取二维码。");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parseBridgeResponse<T>(stdout: string): T {
  const payload = JSON.parse(stdout.trim()) as XiaomiBridgeResponse<T>;
  if (!payload.success || payload.data === undefined) {
    throw new XiaomiBridgeError(
      payload.error ?? "小米运动健康桥接失败",
      payload.errorCode ?? null,
      payload.errorData ?? null,
    );
  }
  return payload.data;
}

function readBridgeFailure(error: unknown): Error {
  if (!isExecFileError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }
  const stdout = readBridgeStreamText(error.stdout);
  const payloadError = stdout ? readBridgePayloadError(stdout) : null;
  if (payloadError) {
    return payloadError;
  }
  const stderr = readBridgeStreamText(error.stderr);
  if (stderr) {
    return new Error(stderr);
  }
  if (stdout) {
    return new Error(stdout);
  }
  return error;
}

function isExecFileError(
  value: unknown,
): value is Error & { stdout?: string; stderr?: string } {
  return value instanceof Error;
}

function readBridgeStreamText(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function readBridgePayloadError(stdout: string): XiaomiBridgeError | null {
  try {
    const payload = JSON.parse(stdout) as XiaomiBridgeResponse<unknown>;
    if (!payload.error && !payload.errorCode && !payload.errorData) {
      return null;
    }
    return new XiaomiBridgeError(
      payload.error ?? "小米运动健康桥接失败",
      payload.errorCode ?? null,
      payload.errorData ?? null,
    );
  } catch {
    return null;
  }
}
