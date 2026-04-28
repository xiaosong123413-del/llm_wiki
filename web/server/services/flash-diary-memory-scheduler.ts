/**
 * Schedules one server-side flash diary memory catch-up run on startup and
 * then re-runs the due-refresh check at each local midnight boundary.
 */
import type { ServerConfig } from "../config.js";
import { refreshFlashDiaryMemoryIfDue } from "./flash-diary-memory.js";

interface FlashDiaryMemoryScheduler {
  dispose(): void;
}

interface StartFlashDiaryMemorySchedulerOptions {
  cfg: ServerConfig;
  refreshIfDue?: (now: Date) => Promise<void>;
}

export function startFlashDiaryMemoryScheduler(
  options: StartFlashDiaryMemorySchedulerOptions,
): FlashDiaryMemoryScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleNextRun = (): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      void runScheduledRefresh();
    }, millisecondsUntilNextMidnight(new Date()));
  };

  const runScheduledRefresh = async (): Promise<void> => {
    try {
      await (options.refreshIfDue ?? ((now) => refreshFlashDiaryMemoryIfDue({ ...options.cfg, now })))(new Date());
    } catch {
      // Keep the scheduler alive even if one refresh run fails.
    } finally {
      scheduleNextRun();
    }
  };

  void runScheduledRefresh();

  return {
    dispose(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

function millisecondsUntilNextMidnight(now: Date): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1, nextMidnight.getTime() - now.getTime());
}
