// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmBackgroundSync,
  startBackgroundRun,
} from "../web/client/src/background-run.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("background run helpers", () => {
  it("starts a check run and reports success toasts", async () => {
    const showToast = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: "run-1", kind: "check", status: "running" },
      }),
    }));

    await startBackgroundRun("check", document.body, showToast, { fetchImpl: fetchImpl as typeof fetch });

    expect(fetchImpl).toHaveBeenCalledWith("/api/runs/check", { method: "POST" });
    expect(showToast).toHaveBeenNthCalledWith(1, "正在启动系统检查...");
    expect(showToast).toHaveBeenNthCalledWith(2, "系统检查已在后台运行，结果会进入运行日志和审查。");
  });

  it("does not start sync when the confirmation step declines", async () => {
    const showToast = vi.fn();
    const confirmSync = vi.fn(async () => false);
    const fetchImpl = vi.fn();

    await startBackgroundRun("sync", document.body, showToast, {
      confirmSync,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(confirmSync).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("reports start failures as error toasts", async () => {
    const showToast = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, error: "backend down" }),
    }));

    await startBackgroundRun("sync", document.body, showToast, {
      confirmSync: async () => true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(showToast).toHaveBeenNthCalledWith(1, "正在启动同步编译...");
    expect(showToast).toHaveBeenNthCalledWith(2, "启动失败：backend down", "error");
  });

  it("stops sync when no new intake items are found", async () => {
    const showToast = vi.fn();
    const loadScan = vi.fn(async () => ({ items: [], plan: [] }));
    const showDialog = vi.fn();

    await expect(confirmBackgroundSync(document.body, showToast, {
      loadScan: loadScan as never,
      showDialog: showDialog as never,
    })).resolves.toBe(false);

    expect(showToast).toHaveBeenCalledWith("未检测到新源料");
    expect(showDialog).not.toHaveBeenCalled();
  });

  it("reports intake scan errors", async () => {
    const showToast = vi.fn();

    await expect(confirmBackgroundSync(document.body, showToast, {
      loadScan: async () => {
        throw new Error("scan failed");
      },
    })).resolves.toBe(false);

    expect(showToast).toHaveBeenCalledWith("新源料检测失败：scan failed", "error");
  });
});
