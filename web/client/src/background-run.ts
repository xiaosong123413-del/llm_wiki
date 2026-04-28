/**
 * Background run startup helpers for the desktop shell.
 *
 * The shell can launch check/sync runs without navigating to the dedicated
 * runs page. This module keeps that flow testable by isolating the intake
 * confirmation step and the run-start request from the rest of `main.ts`.
 */

import {
  loadIntakeScan,
  showIntakeDetectionDialog,
} from "./intake-sync.js";

type RunKind = "check" | "sync";
type RunStatus = "running" | "succeeded" | "failed" | "stopped";
type ToastTone = "info" | "error";

interface RunSnapshot {
  id: string;
  kind: RunKind;
  status: RunStatus;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface BackgroundRunDependencies {
  confirmSync?: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

interface ConfirmSyncDependencies {
  loadScan?: typeof loadIntakeScan;
  showDialog?: typeof showIntakeDetectionDialog;
}

type ToastPresenter = (message: string, tone?: ToastTone) => void;

export async function startBackgroundRun(
  kind: RunKind,
  root: HTMLElement,
  showToast: ToastPresenter,
  dependencies: BackgroundRunDependencies = {},
): Promise<void> {
  const confirmSync = dependencies.confirmSync ?? (() => confirmBackgroundSync(root, showToast));
  if (kind === "sync" && !(await confirmSync())) return;
  showToast(readRunStartingMessage(kind));
  try {
    await startRunRequest(kind, dependencies.fetchImpl ?? fetch);
    showToast(readRunStartedMessage(kind));
  } catch (error) {
    showToast(`启动失败：${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

export async function confirmBackgroundSync(
  root: HTMLElement,
  showToast: ToastPresenter,
  dependencies: ConfirmSyncDependencies = {},
): Promise<boolean> {
  const loadScan = dependencies.loadScan ?? loadIntakeScan;
  const showDialog = dependencies.showDialog ?? showIntakeDetectionDialog;
  try {
    const scan = await loadScan();
    if (scan.items.length === 0) {
      showToast("未检测到新源料");
      return false;
    }
    return await showDialog(root, scan);
  } catch (error) {
    showToast(`新源料检测失败：${error instanceof Error ? error.message : String(error)}`, "error");
    return false;
  }
}

async function startRunRequest(kind: RunKind, fetchImpl: typeof fetch): Promise<RunSnapshot> {
  const response = await fetchImpl(`/api/runs/${kind}`, { method: "POST" });
  const payload = (await response.json()) as ApiResponse<RunSnapshot>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? "run start failed");
  }
  return payload.data;
}

function readRunStartingMessage(kind: RunKind): string {
  return kind === "sync" ? "正在启动同步编译..." : "正在启动系统检查...";
}

function readRunStartedMessage(kind: RunKind): string {
  return kind === "sync"
    ? "同步编译已在后台运行，结果会进入运行日志和审查。"
    : "系统检查已在后台运行，结果会进入运行日志和审查。";
}
