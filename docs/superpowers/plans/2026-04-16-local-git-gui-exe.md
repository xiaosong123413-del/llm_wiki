# Local Git And GUI EXE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the desktop copy into a distinct local Git repository and add a double-clickable Windows GUI `.exe` for sync + batch compile.

**Architecture:** Keep the Node CLI and existing `scripts/sync-compile.mjs` as the execution engine. Add a small C# WinForms launcher that edits `sync-compile-config.json`, starts Node without a PowerShell window, and streams output to a text panel.

**Tech Stack:** Git, Node.js/Vitest, C# WinForms on .NET SDK if available.

---

### Task 1: Local Git Repository

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\.gitignore`
- Use: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main`

- [ ] Verify no existing `.git` directory.
- [ ] Update `.gitignore` so `.env`, `node_modules`, `dist/gui`, `gui/bin`, `gui/obj`, local vault content, and generated wiki/source folders are not committed.
- [ ] Run `git init -b codex/local-llm-wiki-gui`.
- [ ] Run `git status --short` and confirm secrets are excluded.
- [ ] Commit the current sync-compile baseline with message `chore: initialize local gui repo`.

### Task 2: GUI Launcher Project

**Files:**
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\LlmWikiGui.csproj`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\Program.cs`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.cs`

- [ ] Check `dotnet --info`; if missing, stop and report that .NET SDK is required for native exe build.
- [ ] Create a WinForms project targeting Windows.
- [ ] Build a single form with target vault display, source folder list, add/remove/save buttons, start button, progress status, and log textbox.
- [ ] Load and save `sync-compile-config.json` with `System.Text.Json`.
- [ ] Start `node scripts/sync-compile.mjs` with `UseShellExecute=false` and `CreateNoWindow=true` so no PowerShell panel appears.
- [ ] Stream stdout/stderr into the log textbox.

### Task 3: Packaging And Verification

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\package.json`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\scripts\build-gui.ps1`
- Output: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\dist\gui\LlmWikiCompilerPanel.exe`

- [ ] Add an npm script `gui:build` that runs `scripts/build-gui.ps1`.
- [ ] Publish the WinForms app into `dist/gui`.
- [ ] Copy or create a desktop shortcut/launcher for the exe.
- [ ] Run existing sync-compile tests.
- [ ] Run `dotnet build` or `dotnet publish` and confirm the exe exists.
- [ ] Commit GUI implementation with message `feat: add windows gui launcher`.
