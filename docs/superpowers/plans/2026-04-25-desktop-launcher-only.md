# Desktop Launcher Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the packaged desktop release path so the repository supports one Windows desktop `.exe` route only: the local launcher that opens the current workspace.

**Architecture:** Keep `desktop-webui/` as the Electron runtime that the launcher builds and starts, but strip `desktop-webui/package.json` and the root `package.json` of all packaging-only entrypoints and dependencies. Replace the old packaging contract test with launcher-only assertions, then update `docs/project-log.md` so the documented desktop story matches the new single-entry behavior.

**Tech Stack:** Node.js, npm, Electron, TypeScript, Vitest, PowerShell, JSON package manifests

---

**Repository note:** As of 2026-04-25, the full-repo `npm test` gate is already red on unrelated suites outside this feature. Use targeted TDD for the launcher-only change, but do not claim completion or create a commit unless the full repo gates are green again.

## File Map

- `D:\Desktop\llm-wiki-compiler-main\package.json`
  - Root repo scripts. Remove the public `desktop:webui:package` entrypoint here.
- `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package.json`
  - Electron runtime manifest. Keep runtime scripts, remove packaging-only script/dependency/config.
- `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package-lock.json`
  - Desktop runtime lockfile. Must stop pinning `electron-builder`.
- `D:\Desktop\llm-wiki-compiler-main\test\desktop-packaging.test.ts`
  - Legacy contract test for the packaged desktop route. Delete it.
- `D:\Desktop\llm-wiki-compiler-main\test\desktop-launcher-only.test.ts`
  - New contract test for the launcher-only desktop story. Create it.
- `D:\Desktop\llm-wiki-compiler-main\test\project-log-doc.test.ts`
  - Project-log document contract tests. Add one assertion for the launcher-only wording.
- `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
  - User-facing project history and current-flow documentation. Record the launcher-only desktop contract here.

### Task 1: Replace The Desktop Packaging Contract With A Launcher-Only Contract

**Files:**
- Delete: `D:\Desktop\llm-wiki-compiler-main\test\desktop-packaging.test.ts`
- Create: `D:\Desktop\llm-wiki-compiler-main\test\desktop-launcher-only.test.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\package.json`
- Modify: `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package.json`
- Modify: `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package-lock.json`

- [ ] **Step 1: Write the failing launcher-only contract test**

Create `D:\Desktop\llm-wiki-compiler-main\test\desktop-launcher-only.test.ts` with this exact content:

```ts
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
```

- [ ] **Step 2: Run the new test to verify it fails against the current package route**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/desktop-launcher-only.test.ts"
```

Expected:

- FAIL because `package.json` still exposes `desktop:webui:package`
- FAIL because `desktop-webui/package.json` still defines `scripts.package`, `electron-builder`, and `build`
- FAIL because `desktop-webui/package-lock.json` still contains `electron-builder`

- [ ] **Step 3: Remove the public packaged-desktop entrypoint from the root manifest**

Edit `D:\Desktop\llm-wiki-compiler-main\package.json` so the `scripts` block removes only the packaged desktop entry:

```diff
   "desktop:webui:install": "npm --prefix desktop-webui install",
   "desktop:webui:dev": "npm --prefix desktop-webui run dev",
   "desktop:webui:start": "npm --prefix desktop-webui run start",
   "desktop:webui:build": "npm --prefix desktop-webui run build",
-  "desktop:webui:package": "npm --prefix desktop-webui run package",
   "desktop:webui:launch": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-desktop-webui.ps1",
   "desktop:webui:launcher:build": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-desktop-webui-launcher.ps1",
```

- [ ] **Step 4: Strip packaging-only configuration from the Electron runtime manifest**

Delete `D:\Desktop\llm-wiki-compiler-main\test\desktop-packaging.test.ts`, then update `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package.json` to this exact content:

```json
{
  "name": "llm-wiki-desktop-webui",
  "version": "0.1.0",
  "private": true,
  "description": "Electron desktop shell for the LLM Wiki web UI.",
  "author": "Administrator",
  "main": "dist/main.js",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "start": "npm run build && electron .",
    "prepare:runtime": "node scripts/write-runtime-config.mjs",
    "build": "npm run prepare:runtime && tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "^24.7.0",
    "electron": "^37.2.0",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 5: Regenerate the desktop runtime lockfile without `electron-builder`**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' --prefix desktop-webui install --package-lock-only"
```

Expected:

- `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package-lock.json` updates
- the lockfile no longer contains `electron-builder`

- [ ] **Step 6: Run the launcher-only contract tests and the existing desktop runtime tests**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/desktop-launcher-only.test.ts test/desktop-webui.test.ts"
```

Expected:

- PASS for the new launcher-only test
- PASS for `test/desktop-webui.test.ts`
- no remaining reference to `desktop:webui:package` or `electron-builder` in the desktop contract tests

### Task 2: Update The Project Log To Match The Launcher-Only Desktop Contract

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\test\project-log-doc.test.ts`
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`

- [ ] **Step 1: Add a failing project-log test that locks the launcher-only wording**

Append this test to `D:\Desktop\llm-wiki-compiler-main\test\project-log-doc.test.ts`:

```ts
  it("documents the desktop flow as launcher-only", () => {
    const root = process.cwd();
    const doc = fs.readFileSync(path.join(root, "docs", "project-log.md"), "utf8");

    expect(doc).toContain("桌面入口当前只支持 launcher 路线");
    expect(doc).toContain("desktop-webui-launcher/");
    expect(doc).toContain("desktop-webui/ 只作为 launcher 启动的 Electron 运行时");
    expect(doc).not.toContain("desktop:webui:package");
  });
```

- [ ] **Step 2: Run the project-log test to verify it fails before the documentation update**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/project-log-doc.test.ts"
```

Expected:

- FAIL because `docs/project-log.md` does not yet state the launcher-only contract

- [ ] **Step 3: Update the current-interface text and add a top timeline entry to the project log**

Make these exact documentation edits in `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`.

In the opening paragraph under `## 现有界面`, insert this sentence after `当前应用是 **Electron 桌面壳 + 本地 WebUI**。`:

```md
桌面入口当前只支持 launcher 路线：桌面双击入口来自 `desktop-webui-launcher/`；`desktop-webui/` 只作为 launcher 启动的 Electron 运行时，不再承担正式打包发布。
```

At the top of the `## 时间线` section, prepend this new entry:

```md
### [2026-04-25 15:30] 桌面入口收口为 launcher-only

- 修改内容：删除 root `desktop:webui:package` 入口，以及 `desktop-webui/package.json` 中的 `package` 脚本、`electron-builder` 依赖和打包 `build` 配置。
- 修改内容：保留 `desktop-webui-launcher/` 作为当前开发机唯一支持的桌面 `.exe` 入口；`desktop-webui/` 仅保留 Electron 运行时角色。
- 影响范围：桌面启动链路、Electron runtime package 配置、桌面 contract tests、项目日志。
```

- [ ] **Step 4: Run the project-log tests again**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/project-log-doc.test.ts"
```

Expected:

- PASS for the new launcher-only wording assertion
- PASS for the existing project-log structure tests

### Task 3: Run Launcher-Focused Verification And Then The Required Repo Gates

**Files:**
- Modify: `D:\Desktop\llm-wiki-compiler-main\package.json`
- Modify: `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package.json`
- Modify: `D:\Desktop\llm-wiki-compiler-main\desktop-webui\package-lock.json`
- Modify: `D:\Desktop\llm-wiki-compiler-main\docs\project-log.md`
- Create: `D:\Desktop\llm-wiki-compiler-main\test\desktop-launcher-only.test.ts`
- Delete: `D:\Desktop\llm-wiki-compiler-main\test\desktop-packaging.test.ts`

- [ ] **Step 1: Run the focused desktop checks together**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test -- test/desktop-launcher-only.test.ts test/desktop-webui.test.ts test/project-log-doc.test.ts"
```

Expected:

- PASS for all three targeted suites

- [ ] **Step 2: Build the Electron runtime that the launcher depends on**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' --prefix desktop-webui run build"
```

Expected:

- PASS
- `desktop-webui/dist/main.js` remains buildable without any packaging script

- [ ] **Step 3: Build the launcher exe**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' run desktop:webui:launcher:build"
```

Expected:

- PASS
- output mentions `LLM-Wiki-WebUI-Launcher.exe`
- the launcher build still copies the exe to the Desktop as designed

- [ ] **Step 4: Run the repository-required gates in order**

Run:

```powershell
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npx.cmd' tsc --noEmit"
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' run build"
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\npm.cmd' test"
rtk proxy powershell -NoProfile -Command "& 'C:\nvm4w\nodejs\fallow.ps1'"
```

Expected:

- `tsc --noEmit` PASS
- `npm run build` PASS
- `npm test` PASS
- `fallow` reports no issues

- [ ] **Step 5: Handle the known baseline-risk honestly before any commit**

If `npm test` is still red on the same unrelated pre-existing suites, stop here and report the exact failing files instead of committing. If the full gate is green, commit only the launcher-only feature files:

```powershell
git add package.json desktop-webui/package.json desktop-webui/package-lock.json test/desktop-launcher-only.test.ts test/project-log-doc.test.ts docs/project-log.md
git rm test/desktop-packaging.test.ts
git commit -m "chore: make desktop launcher the only supported exe path"
```
