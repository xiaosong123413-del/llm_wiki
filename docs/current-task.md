# Current Task Board

Updated: 2026-04-22

## Active Goal

Ship the visible bug fixes that are blocking daily use before starting new feature work.

## Current Bugs

- No current daily-use blocker remains from this pass.

## Completed In Current Pass

- Source gallery preview delete now waits for backend-confirmed deletion before closing the modal.
- Source gallery batch delete now reports the real deleted count and refreshes the gallery.
- Chat selected context/page chips expose a remove button and remove the selected page from chat context.
- Chat session hover delete now uses a dedicated delete action path instead of relying on the row body click.
- Wiki search result links now route to the selected wiki page instead of falling back to chat/home.
- Wiki article view strips BOM-prefixed frontmatter before rendering, so compiled pages display readable HTML.
- Wiki Edit opens a side annotation panel for selected text, with save/delete/close controls.
- Quick capture shortcut now lets the user choose Diary or Clipping before submit.
- Flash Diary page is editor-only again, matching the daily raw Markdown editing workflow.
- Settings Project Log nav opens the project log directly.
- Settings Workspace Sync nav shows local sync and cloud sync run content directly.
- Sync detection no longer treats today's diary or old diary files as new batch sources.
- Quick capture popup now loads as an explicit UTF-8 data URL, so Chinese text and CSS render normally in the Electron capture window.
- Workspace Sync now shows a visible sync/compile progress panel with pause/cancel controls and synced/compiled/not synced/not compiled status chips.
- Applied the local Windows Codex App PowerShell/rg setup: installed system ripgrep and PowerShell 7, updated PATH/current shell, and initialized RTK global rules.

## Local Reference

- Workspace: `D:\Desktop\llm-wiki-compiler-main`
- Vault: `D:\Desktop\ai的仓库`
- PowerShell/rg note: `D:\Desktop\ai的仓库\raw\剪藏\Windows 下 Codex App Powershell 乱码以及 rg 无法使用解决方案.md`

## Working Rules

- Use `rtk` before command chains.
- Use `karpathy-guidelines` for coding changes.
- Use `typescript-project-specifications` for TypeScript changes.
- Keep fixes surgical and verify with existing build/test commands where feasible.
