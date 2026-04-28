# Link Clipping Pipeline Plan

Date: 2026-04-23

## Steps

1. Add failing tests for the clip service, clip routes, Source Gallery composer, settings detection, and desktop quick capture endpoint selection.
2. Implement `clip-pipeline` with injected downloader support, task persistence, markdown rendering, media copy/download helpers, and yt-dlp binary detection.
3. Register `/api/clips`, `/api/clips/yt-dlp`, and `/api/clips/yt-dlp/install`.
4. Route Source Gallery URL clipping and Electron quick capture URL clipping to `/api/clips`.
5. Add Settings detection UI and run focused tests, TypeScript check, and builds.

## Success Criteria

- A Xiaohongshu/Douyin/Bilibili URL can be submitted through Source Gallery or the quick capture clipping target.
- A markdown source lands in `raw/剪藏` with frontmatter provenance.
- Local image/video references are indexed by the existing Source Media index scanner.
- Missing yt-dlp returns a clear failed task instead of silently writing a plain bookmark.
