/**
 * Verifies the server-side flash diary memory scheduler catches up once on
 * startup, waits for the next local midnight, and can be disposed cleanly.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "../web/server/config.js";
import { startFlashDiaryMemoryScheduler } from "../web/server/services/flash-diary-memory-scheduler.js";

const tempRoots: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("flash diary memory scheduler", () => {
  it("runs one startup catch-up refresh when today is due and schedules the next local midnight refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(createLocalDate(2026, 4, 25, 0, 10, 0));
    const refreshIfDue = vi.fn(async () => undefined);

    const scheduler = startFlashDiaryMemoryScheduler({
      cfg: createConfig(),
      refreshIfDue,
    });

    await Promise.resolve();
    expect(refreshIfDue).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 50 * 60 * 1000 - 1);
    await Promise.resolve();
    expect(refreshIfDue).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(refreshIfDue).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });

  it("keeps the next midnight timer armed when the startup refresh rejects", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(createLocalDate(2026, 4, 25, 0, 10, 0));
    const refreshIfDue = vi.fn(async () => {
      if (refreshIfDue.mock.calls.length === 1) {
        throw new Error("startup refresh failed");
      }
    });

    const scheduler = startFlashDiaryMemoryScheduler({
      cfg: createConfig(),
      refreshIfDue,
    });

    await Promise.resolve();
    expect(refreshIfDue).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 50 * 60 * 1000);
    await Promise.resolve();
    expect(refreshIfDue).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });
});

function createLocalDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  return new Date(year, month - 1, day, hour, minute, second);
}

function createConfig(): ServerConfig {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-scheduler-"));
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-scheduler-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flash-diary-memory-scheduler-runtime-"));
  tempRoots.push(projectRoot, sourceVaultRoot, runtimeRoot);
  return {
    projectRoot,
    sourceVaultRoot,
    runtimeRoot,
    host: "127.0.0.1",
    port: 4175,
    author: "tester",
  };
}
