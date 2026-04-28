import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const desktopRoot = path.join(root, "desktop-webui");

describe("desktop webui migration scaffold", () => {
  it("adds root scripts for the Electron desktop shell", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["desktop:webui:install"]).toBe(
      "npm --prefix desktop-webui install",
    );
    expect(packageJson.scripts?.["desktop:webui:dev"]).toContain(
      "npm --prefix desktop-webui run dev",
    );
    expect(packageJson.scripts?.["desktop:webui:start"]).toContain(
      "npm --prefix desktop-webui run start",
    );
    expect(packageJson.scripts?.["desktop:webui:build"]).toContain(
      "npm --prefix desktop-webui run build",
    );
    expect(packageJson.scripts?.["desktop:webui:launch"]).toBe(
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-desktop-webui.ps1",
    );
  });

  it("defines an Electron app package instead of another WinForms entrypoint", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(desktopRoot, "package.json"), "utf8"),
    ) as {
      main?: string;
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.main).toBe("dist/main.js");
    expect(packageJson.scripts?.dev).toContain("tsx watch src/main.ts");
    expect(packageJson.scripts?.start).toContain("electron .");
    expect(packageJson.scripts?.build).toContain("tsc -p tsconfig.json");
    expect(packageJson.devDependencies?.electron).toBeTruthy();
  });

  it("boots a BrowserWindow and starts the local wiki web server automatically", async () => {
    const mainSource = await readFile(path.join(desktopRoot, "src", "main.ts"), "utf8");
    const submitSource = await readFile(path.join(desktopRoot, "src", "flash-diary-submit.ts"), "utf8");

    expect(mainSource).toContain("import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Notification, session, shell } from \"electron\";");
    expect(mainSource).toContain("createWindow()");
    expect(mainSource).toContain("new BrowserWindow(");
    expect(mainSource).toContain("startWebServer(");
    expect(mainSource).toContain("server/index.ts");
    expect(mainSource).toContain("\"--source-vault\"");
    expect(mainSource).toContain("\"--runtime-root\"");
    expect(mainSource).not.toContain("\"--wiki\"");
    expect(mainSource).toContain("fs.mkdirSync(serverRoots.runtimeRoot, { recursive: true });");
    expect(mainSource).toContain("loadURL(serverUrl)");
    expect(mainSource).toContain("icon: resolveDesktopIconPath()");
    expect(mainSource).toContain("sync-compile-config.json");
    expect(mainSource).toContain("chooseTargetVault");
    expect(mainSource).toContain("whenReady()");
    expect(mainSource).toContain("requestSingleInstanceLock()");
    expect(mainSource).toContain("second-instance");
    expect(mainSource).toContain("clearCache()");
    expect(mainSource).toContain("clearStorageData(");
    expect(mainSource).toContain("desktop:instance-redirected");
    expect(mainSource).toContain("registerConfiguredShortcuts()");
    expect(mainSource).toContain("CommandOrControl+Shift+J");
    expect(mainSource).toContain("desktop:save-shortcut");
    expect(mainSource).toContain("desktop:flash-diary-capture");
    expect(mainSource).toContain("desktop:import-xiaohongshu-cookie");
    expect(mainSource).toContain("desktop:open-xiaohongshu-login");
    expect(mainSource).toContain("desktop:import-douyin-cookie");
    expect(mainSource).toContain("desktop:open-douyin-login");
    expect(mainSource).toContain("collectDouyinDesktopCapture");
    expect(mainSource).toContain("desktopCapture");
    expect(mainSource).toContain("desktop:fetch-xiaohongshu-favorites");
    expect(mainSource).toContain("persist:llm-wiki-xiaohongshu");
    expect(mainSource).toContain("persist:llm-wiki-douyin");
    expect(mainSource).toContain("session.fromPartition");
    expect(mainSource).toContain("document.cookie");
    expect(mainSource).toContain("douyinSession().cookies.get({})");
    expect(mainSource).toContain("含 HttpOnly");
    expect(mainSource).toContain("api/import/xiaohongshu/progress");
    expect(mainSource).toContain("findAvailablePort");
    expect(mainSource).toContain("await stopWebServer();");
    expect(mainSource).toContain("waitForPortToClose(DEFAULT_WEB_PORT)");
    expect(mainSource).toContain("async function stopWebServer(): Promise<void>");
    expect(mainSource).toContain("buildFlashDiarySubmission");
    expect(submitSource).toContain("api/clips");
    expect(submitSource).toContain("api/xhs-sync/extract");
  });

  it("uses a preload bridge for desktop capabilities instead of Node integration in the page", async () => {
    const mainSource = await readFile(path.join(desktopRoot, "src", "main.ts"), "utf8");
    const preloadSource = await readFile(
      path.join(desktopRoot, "src", "preload.ts"),
      "utf8",
    );

    expect(mainSource).toContain("preload: path.join(__dirname, \"preload.js\")");
    expect(mainSource).toContain("contextIsolation: true");
    expect(mainSource).toContain("nodeIntegration: false");
    expect(preloadSource).toContain("contextBridge.exposeInMainWorld");
    expect(preloadSource).toContain("chooseTargetVault");
    expect(preloadSource).toContain("getDesktopConfig");
    expect(preloadSource).toContain("onInstanceRedirected");
    expect(preloadSource).toContain("onFlashDiaryCapture");
    expect(preloadSource).toContain("submitFlashDiaryEntry");
    expect(preloadSource).toContain("chooseFlashDiaryMedia");
    expect(preloadSource).toContain("importXiaohongshuCookie");
    expect(preloadSource).toContain("openXiaohongshuLogin");
    expect(preloadSource).toContain("importDouyinCookie");
    expect(preloadSource).toContain("openDouyinLogin");
    expect(preloadSource).toContain("fetchXiaohongshuFavorites");
  });

  it("provides a hidden launcher script and a desktop double-click entry", async () => {
    const launcherSource = await readFile(
      path.join(root, "scripts", "start-desktop-webui.ps1"),
      "utf8",
    );

    expect(launcherSource).toContain("desktop-webui");
    expect(launcherSource).toContain("Start-Process");
    expect(launcherSource).toContain("npm.cmd");
    expect(launcherSource).toContain("WindowStyle Hidden");
    expect(launcherSource).toContain("E:\\electron");
    expect(launcherSource).toContain("CreateShortcut");
    expect(launcherSource).toContain("IconLocation");
    expect(launcherSource).toContain("LLM Wiki WebUI.lnk");
    expect(launcherSource).toContain("llm-wiki.ico");
  });
});
