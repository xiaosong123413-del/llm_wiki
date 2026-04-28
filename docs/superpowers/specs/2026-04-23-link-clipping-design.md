# Link Clipping Pipeline Design

Date: 2026-04-23

## Goal

LLM Wiki needs a first-party clipping path for links from Xiaohongshu, Douyin, Bilibili, and generic pages. A captured link should become a raw source note under `raw/剪藏`, keep provenance, store downloaded media beside the markdown, and appear in Source Gallery.

## Scope

- Entrypoints: Source Gallery composer and Electron quick capture window.
- Downloader: project-local `yt-dlp` first, then `PATH`.
- Default video format: 720p or lower.
- Output: one markdown file plus local media files under `raw/剪藏/assets/<task-id>/`.
- State: append/update `.llmwiki/clip-tasks.json` for audit and retry visibility.
- Settings: show yt-dlp detection state and expose a detection refresh.

## Non-Goals

- No reverse engineering of proprietary Snapnote binaries.
- No background scheduler in this pass.
- No platform-specific private API scraping outside `yt-dlp` and public page metadata.
- No compile pipeline changes.

## Data Contract

`POST /api/clips` accepts:

```json
{
  "url": "https://example.com/post",
  "title": "optional override",
  "body": "optional note",
  "quality": "720"
}
```

It returns the task and markdown path. A task is `completed`, `partial`, or `failed`. Partial means markdown was written but some media could not be downloaded.

## Verification

- Backend service tests use an injected fake downloader.
- Route tests cover `/api/clips` and `/api/clips/yt-dlp`.
- UI tests verify Source Gallery posts clipping URLs to `/api/clips`.
- Desktop tests verify quick capture clipping uses `/api/clips`.
