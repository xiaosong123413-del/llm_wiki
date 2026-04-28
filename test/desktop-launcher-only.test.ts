import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const desktopRoot = path.join(root, "desktop-webui");

describe("desktop launcher-only contract", () => {
  it("does not expose a packaged desktop build script from the repo root", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["desktop:webui:package"]).toBeUndefined();
    expect(packageJson.scripts?.["desktop:webui:launch"]).toBe(
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-desktop-webui.ps1",
    );
    expect(packageJson.scripts?.["desktop:webui:launcher:build"]).toBe(
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-desktop-webui-launcher.ps1",
    );
  });

  it("keeps desktop-webui as a launcher-run Electron runtime instead of a packaged product", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(desktopRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      build?: unknown;
    };

    expect(packageJson.scripts?.package).toBeUndefined();
    expect(packageJson.devDependencies?.["electron-builder"]).toBeUndefined();
    expect(packageJson.build).toBeUndefined();
    expect(packageJson.scripts?.build).toContain("tsc -p tsconfig.json");
    expect(packageJson.scripts?.start).toContain("electron .");
  });

  it("removes electron-builder from the desktop runtime lockfile", async () => {
    const lockText = await readFile(
      path.join(desktopRoot, "package-lock.json"),
      "utf8",
    );

    expect(lockText).not.toContain("\"electron-builder\"");
  });
});
