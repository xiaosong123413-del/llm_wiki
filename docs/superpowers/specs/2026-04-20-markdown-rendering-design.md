# Markdown Rendering Sharing Design

- **Date**: 2026-04-20
- **Target**: `web/server/render/markdown.ts` + `web/client/src/pages/flash-diary/` + `web/client/src/pages/sources/`
- **Out of scope**: `wiki-clone/` and any changes to the standalone wiki reader app

## 1. Goal

Add shared Markdown rendering to the Flash Diary page and the Sources Library page, while keeping Chat preview on the same renderer path. The shared renderer must continue to support GFM-style tables, code blocks, and `[[wikilink]]` resolution consistently across the app.

Flash Diary must default to preview mode and allow switching into editing mode. Sources detail content must move from raw `<pre>` display to rendered HTML.

## 2. Non-Goals

- No changes to `wiki-clone/`.
- No new Markdown parser.
- No page-specific renderer forks.
- No schema or storage redesign for flash diary or sources metadata.
- No change to the existing Chat routing model beyond continuing to reuse the same renderer.

## 3. Single Renderer Contract

The only approved Markdown renderer entry point is `web/server/render/markdown.ts`.

That module already owns:
- `markdown-it`
- anchor generation
- attribute parsing
- KaTeX / math support
- `[[wikilink]]` resolution

The implementation rule is:
- server routes and services may prepare raw Markdown and call the shared renderer
- client pages must consume rendered HTML from the server
- no page may introduce a second markdown parsing path

## 4. Current Display Chain

### Chat preview

Chat already uses the shared HTML path:
- `web/client/main.ts` opens a page drawer
- `web/server/routes/pages.ts` reads Markdown and calls `web/server/render/markdown.ts`
- `web/client/src/shell/drawer.ts` displays the returned HTML

This chain must remain unchanged in behavior.

### Flash Diary

Flash Diary currently loads `/api/flash-diary/page` and stores both `raw` and `html`, but the page renders only the textarea/editor surface.

Required behavior:
- open in preview mode by default
- show rendered HTML in the main reading pane
- allow explicit switch to edit mode
- preserve save flow for raw Markdown editing

### Sources Library

Sources detail currently shows the Markdown body as raw text in a `<pre>` block.

Required behavior:
- keep metadata controls
- replace the raw body block with rendered HTML
- continue to allow metadata edits, OCR, highlights, archive, and AI tagging

## 5. Page-Specific Requirements

### Flash Diary

- Default state: preview
- Editing must be an explicit toggle
- Preview uses the shared renderer output
- Editing uses the existing raw Markdown source
- Saving writes raw content back to the same diary file

### Sources Library

- The detail pane body must render HTML instead of raw `<pre>` Markdown
- The rendered body must show GFM tables, fenced code blocks, and wikilinks
- Metadata controls remain in place

### Chat

- Continue using the same renderer contract already used by the page drawer
- Do not change the chat route shape or drawer behavior

## 6. Minimal Integration Points

### Server

- `web/server/render/markdown.ts`
  - shared renderer contract stays here
- `web/server/routes/pages.ts`
  - keep existing page drawer rendering path as the reference implementation
- `web/server/routes/flash-diary.ts`
  - ensure the page response continues to return rendered HTML for preview mode
- `web/server/routes/sources.ts`
  - ensure source detail responses can expose HTML for the detail body

### Client

- `web/client/src/pages/flash-diary/index.ts`
  - add preview/edit mode switching
  - render HTML preview by default
- `web/client/src/pages/sources/view.ts`
  - replace raw `<pre>` detail body with an HTML container
- `web/client/src/pages/sources/index.ts`
  - keep list/detail loading flow; only the detail rendering target changes
- `web/client/main.ts`
  - no renderer rewrite; continue to rely on `/api/page` for chat preview

## 7. Constraints That Shape the Design

- `wiki-clone/` is intentionally excluded, so the standalone wiki reader does not need to be synchronized with this change.
- Flash Diary is a mixed preview/edit page, so the UI needs a mode toggle instead of forcing all content into one renderer surface.
- Sources Library is an archive and metadata management page, so only the content body changes from raw display to rendered HTML.
- The shared renderer already exists; the shortest path is to reuse it, not replace it.
- Existing Chat preview already proves the renderer contract, so the work here should align with that path instead of inventing new one-off behavior.

## 8. Acceptance Criteria

- Flash Diary opens in preview mode and can switch to edit mode.
- Sources detail body renders Markdown HTML instead of raw text.
- GFM tables render correctly in both Flash Diary preview and Sources detail.
- Fenced code blocks render correctly in both pages.
- `[[wikilink]]` resolution matches the existing shared renderer behavior.
- Chat preview still uses the same renderer path and does not regress.
- No code path is added under `wiki-clone/`.
