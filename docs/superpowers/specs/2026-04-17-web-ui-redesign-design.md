# Web UI Redesign — Design Spec

- **Date**: 2026-04-17
- **Target**: `web/client/` + `web/server/` (the Electron-wrapped web UI)
- **Out of scope**: WinForms `gui/LlmWikiGui/` (left untouched)

## 1. Goal

Replace the current single-article-view workspace in `web/client/` with a four-zone app shell that exposes four primary views — **Chat, Check, Sync, Review** — plus a Settings view and a Page Drawer for file detail. Ship a new visual system (palette, typography, elevation) built on top of the existing `#7c5cfc` brand color but tuned toward a calm, Notion/Linear-like paper feel.

## 2. Non-Goals

- No dark mode this iteration (tokens are themable, but only one theme ships).
- No WinForms GUI changes.
- No removal of `particles.ts` / `graph.ts` — they are dormant now and will be reintegrated in a later effort.
- No migration to a JS framework (React/Vue). We stay on vanilla TS + CSS variables, matching the current codebase.

## 3. Shell & Navigation Model

Four zones from left to right:

1. **Rail** (~64px). Pure icon column with tooltip. Top: `对话`, `检查`, `同步`, `审查`. Bottom: `设置`. Active item has a 2px `--primary` vertical indicator on the left; icon tinted `--primary`.
2. **Browser** (~280px, draggable 220–360). `wiki` / `raw` pill toggle + search input + tool row (`+ new`, multi-select toggle `⊜`) + folder tree. **Always present across every view except Settings.** State (current layer, search query, expansion, selected file) is shared across views.
3. **Main** (fills remaining width). Content depends on the active view.
4. **Page Drawer** (~420px, draggable 320–600, collapsible). Slides in when a file is opened. Never stacks — opening another file replaces content.

### Routing

Hash-based:
- `#/chat`, `#/chat/:conversationId`
- `#/check`, `#/sync`
- `#/review`, `#/review/:itemId`
- `#/settings`, `#/settings/:section`

Browser state and Drawer state are orthogonal to the route and live in memory (reset on reload).

### Multi-select mode

Toggled from the Browser tool row (`⊜` icon). While active:
- Tree rows show a checkbox; clicking a file toggles selection instead of opening the drawer.
- Selected files appear as chips above the Chat composer (`articleRefs`).
- Leaving the Chat view auto-disables multi-select.

### Responsiveness

- Default Electron window 1440×900.
- `< 1200px`: Drawer becomes an overlay floating over the Main area.
- `< 900px`: Browser collapses into a toggle button.

## 4. Visual System

### Color tokens

```css
/* Brand */
--primary:        #6D57FF;
--primary-hover:  #5B46E8;
--primary-soft:   #EFEBFF;
--primary-ring:   rgba(109, 87, 255, 0.22);

/* Neutrals */
--bg-app:         #F7F7FB;
--bg-panel:       #FFFFFF;
--bg-muted:       #F2F2F7;
--bg-hover:       #EDEDF4;
--bg-selected:    #E8E5F7;

/* Borders */
--border:         #EAEAF0;
--border-strong:  #D8D8E2;

/* Text */
--text:           #18181B;
--text-secondary: #52525B;
--text-muted:     #8A8A93;
--text-on-primary:#FFFFFF;

/* Semantic */
--success:        #10B981;
--warn:           #F59E0B;
--danger:         #EF4444;
--info:           #3B82F6;
```

### Typography

Font stack:
```
Inter, "Noto Sans SC", "HarmonyOS Sans SC", "PingFang SC",
"Microsoft YaHei UI", system-ui, sans-serif
```
- Latin: Inter (already preconnected via `rsms.me/inter`).
- CJK: Noto Sans SC fetched via Google Fonts link with offline fallback to system fonts.
- Mono: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`.
- Tabular numerals for metrics: `font-feature-settings: "tnum"`.

Type scale (8pt rhythm, 15px body):

| token    | size / line | usage |
| -------- | ----------- | ----- |
| xs       | 12 / 16     | meta labels, eyebrows |
| sm       | 13 / 18     | tree rows, chips |
| base     | 15 / 22     | body, inputs, buttons |
| lg       | 17 / 24     | panel titles |
| xl       | 20 / 28     | page titles |
| display  | 28 / 36     | welcome / init |

Weights: 400 / 500 / 600 / 700. Titles default 600.

### Radius / spacing / elevation

```css
--radius-xs: 6px;   /* chips, tags */
--radius-sm: 10px;  /* buttons, inputs */
--radius-md: 14px;  /* cards, internal tiles */
--radius-lg: 20px;  /* panels, chat bubbles */
--radius-xl: 28px;  /* dialogs */

--space-1: 4px;  --space-2: 8px;  --space-3: 12px;
--space-4: 16px; --space-5: 20px; --space-6: 24px;
--space-8: 32px; --space-10: 40px;

--shadow-sm: 0 1px 2px rgba(24,24,27,0.04);
--shadow-md: 0 4px 16px rgba(24,24,27,0.06), 0 2px 4px rgba(24,24,27,0.04);
--shadow-lg: 0 20px 48px rgba(109,87,255,0.12), 0 4px 12px rgba(24,24,27,0.06);
```

### Component conventions

- **Primary button**: `--primary` fill + `--shadow-md`; hover → `--primary-hover` + 1px lift.
- **Secondary button**: transparent + `--border` + `--text`; hover → `--bg-hover`.
- **Ghost button**: text only; hover reveals background.
- **Input**: `--bg-muted` fill, no border; focus → `--bg-panel` + 2px `--primary-ring`.
- **Selected row** (conversation, file, review item): `--bg-selected` + left 2px `--primary` bar.
- **Dividers**: only at panel boundaries; avoid grid-like borders.
- **Icons**: Lucide, stroke-width 1.75. 20px default, 24px in the rail.
- **Motion**: `cubic-bezier(0.2, 0.8, 0.2, 1)` 180ms for hovers / expand / drawer slide. Avoid large position animations.

## 5. Chat View

Two-pane layout.

### Conversation list (~260px)

- Top: full-width `+ New Chat` primary button.
- Each item: two rows — title (single-line truncate) + latest-message snippet (two-line truncate, `--text-muted`). Relative timestamp at top-right (`2h`, `昨天`, `3月前`).
- Current conversation highlighted via `--bg-selected` + left bar.
- Empty state: "No conversations yet".

### Thread pane

Top bar:
- Conversation title (double-click to rename).
- Right: three icon buttons:
  - `Globe` — web search toggle (active: icon tinted + `--primary-soft` background).
  - `CheckSquare` — multi-select toggle (same active styling).
  - `⋯` — rename / duplicate / delete / export md.

Message list:
- **Empty state**: Lucide `MessageSquare` + "Start a new conversation / Click "New Chat" to begin", muted.
- **User bubble**: right-aligned, `--bg-selected` fill, `--radius-lg`, max-width 72%.
- **Assistant bubble**: left-aligned, `--bg-panel` + `--border` + `--shadow-sm`, max-width 72%.
- `[[wikilink]]` renders purple with dashed underline; click opens the Page Drawer and scrolls to the section.
- Web sources collapse block at the end (favicon + title + host per line).
- Streaming: 3-dot pulse loader at the bubble tail; fades on completion.
- Hover reveals timestamp and token counts (if provider reports them).

Attachment chip row (above composer):
- Each `articleRef` as a chip with `×`. Row disappears when empty.
- Multi-select additions arrive as chips live.

Composer:
- `--bg-muted` fill, `--radius-lg`, multi-line autosize (up to 8 rows then scroll).
- Enter sends, Shift+Enter adds newline.
- Bottom-right: circular primary send button (`Send` icon), disabled when empty.
- Bottom-left: "Web on" badge when web search is enabled.

### Interaction rules

- Drafts per-conversation, persisted in memory while app is open.
- Send flow: optimistic user-message append → `POST /api/chat/:id/messages` → SSE stream of assistant tokens → concat in place → persist on `done`.
- Send failure: red dot on the user message + "Retry"; the input content is not lost.
- New conversation: `+ New Chat` generates a client-side UUID, routes to `#/chat/:id`, shows empty thread. First message send is when the server actually writes the JSON file (avoids orphan files).
- Auto-title: after the first assistant reply completes, if the title is still the default, `POST /api/chat/:id/title` runs the title generator (Chinese, ≤20 chars).
- Delete: `⋯` → confirm dialog → navigate to previous conversation or `#/chat`.

### Web search toggle

Boolean on the conversation. Sent with every message. Server behavior: if true, call Tavily top-N → extract readable content via existing `src/ingest/web.ts` → inject into system prompt as a `<web_context>` block → return `sources[]` on the assistant message.

## 6. Check & Sync Views

Shared layout: top task card + log panel below.

### Top card (`--bg-panel`, `--radius-lg`, `--shadow-sm`, padding 24px)

- **Check**: title "运行检查 (lint)", two-line description of rules in scope, primary button `运行检查`, secondary `仅扫不落盘` (dry-run). Metadata row: last run time / duration / issue count (from maintenance log).
- **Sync**: title "同步源目录 → 编译 wiki", description shows current vault and source folders, primary `开始同步`, secondary `仅预览变更`. Same metadata shape.

### Triggering

Clicking the rail icon only switches the view; **the confirm dialog is triggered by the primary action button**, not by entering the view. Dialog body: operation name + what changes (check: read-only; sync: writes to target vault) + `取消` / `确认运行`.

### Running state

- Button becomes `运行中…` with a purple spinner and is disabled. A red `Abort` button appears in the card's top-right.
- Log panel below: each line timestamped (`HH:mm:ss`, `font-mono`, muted) with level color (info muted, warn orange, error red, success green).
- Log panel top-right: clear and pin-to-bottom toggles. Auto-unpin when user scrolls up; clicking back to the bottom re-pins.

### Completion

A bottom-right toast appears (non-blocking): e.g. "检查完成，发现 12 个问题，已写入 `wiki/.audit/…`" — clicking jumps to `#/review`. Sync toast: `同步完成 · 新增 3, 更新 12, 删除 0`.

### Failure

Final log line red + top-of-card red banner "运行失败：<short>"; button becomes clickable again. Failure metadata flows into the Review view (`kind: "sync"`).

### Constraints

- At most one long task runs at a time. If a task is in progress, the other action's button is disabled with a tooltip "当前有任务运行中".
- Leaving the view does not abort the task. Returning re-attaches to the SSE stream and replays a **2000-line ring buffer**.

## 7. Review View

### Layout

- **Item list** (~380px).
- **Detail pane** (fills remaining width).

### List toolbar

- Tabs: `全部` / `待处理` / `已处理` (each with a count chip).
- Filter chips: `lint` / `sync` / `系统检查` + severity (multi-select).
- Right `⋯`: `批量忽略` / `批量接受建议` / `导出 CSV`.

### List row (~80px, hover `--bg-hover`, selected `--bg-selected` + left bar)

- Row 1: source badge (`lint` purple / `sync` orange / `system` cyan) + severity dot + title (single-line truncate).
- Row 2: summary (muted, two-line truncate).
- Row 3: file path (if any) + relative time + state (`pending` / `accepted` / `rejected` / `dismissed` / `resolved`).

### Detail pane

1. **Header**: source badge + severity + title + close `×`.
2. **Metadata card**: file path (click → Page Drawer), rule id (lint only), discovered-at, source run id.
3. **Body** — per-kind:
   - `lint`: rule description + offending snippet (code block, violating line highlighted) + fix suggestion if the rule provides one.
   - `sync`: command name + exception type + raw stderr (collapsible, first 20 lines expanded).
   - `system.gap`: red hairline card titled "需要网络搜索补证" with reason / suggested keywords / affected pages.
   - `system.suggestion`: cyan hairline card titled "新问题 / 新来源建议" with proposal / origin / rationale.
4. **Action bar** (sticky bottom, per-kind):

| kind                 | actions |
| -------------------- | ------- |
| `lint`               | `已修复` (resolved), `忽略`, `打开文件` |
| `sync`               | `重试同步` (navigates to sync and triggers run), `忽略` |
| `system.gap`         | `进一步网络搜索补证`, `接受`, `拒绝`, `忽略` |
| `system.suggestion`  | `接受`, `拒绝`, `忽略` |

After a successful action: item state updates, list refreshes, detail advances to the next pending item.

### Web search补证 flow

Clicking `进一步网络搜索补证`:
- A "搜索运行" panel injects below the body.
- Shows the Tavily query (editable, re-runnable), progress, and the result list.
- Each result has a checkbox `采纳为新来源`.
- Selected results are posted as `evidence[]` to the item; item remains `pending` — user still decides `接受` / `拒绝`.

### Empty state

Lucide `ClipboardCheck` + "当前没有待审查的项目" + secondary buttons `运行检查` / `运行同步`.

### Data sourcing

- **Raw, read-only**:
  - `<vault>/.audit/lint-<runId>.json` (new — lint command emits this).
  - `<vault>/.audit/system-<runId>.json` (new — from `src/linter/system-check-guidance.ts`).
  - maintenance log (existing `src/utils/maintenance-log.ts`, sync failures).
- **State overlay**: `<vault>/.audit/state.json` = `{ [itemId]: { state, resolvedAt, evidence[] } }`.
- `itemId` = `hash(kind + source_file + rule_id + lineRange)` — stable across reruns so state carries over.
- Server merges the three sources + state overlay in `GET /api/review`.

## 8. Page Drawer

### Triggers

- Browser click on a file (non-multi-select mode) opens / highlights.
- Click a `[[wikilink]]` in chat or review.
- Click "打开文件" in a review item.
- Repeated click or `×` closes.
- Clicking a different file replaces content (no stacking).

### Structure

1. **Top bar**: breadcrumb (`wiki / concepts / 量子纠缠`, each segment clickable in the tree) + three icon buttons: `在浏览器外打开` (Electron `shell.openPath`), `复制 wikilink`, close `×`.
2. **Body**: rendered markdown via existing `render/markdown.ts` + `wikilinks.ts` + KaTeX. Code blocks use JetBrains Mono on `--bg-muted`. `[[wikilink]]` replaces drawer content in place (no nested drawer).
3. **Footer** (sticky): file size, last modified, alias chips.

### Keyboard

- `Esc` closes drawer.
- `Ctrl/Cmd+P` focuses browser search (global).

## 9. Settings View

Promoted from the current `<dialog>` to a full view. Entering Settings hides the Browser so the Main area is wider.

### Layout

Left secondary nav (~200px) + right form. Four sections:

1. **仓库 (Vault)** — target vault path (folder picker), source folders (add / remove), reinitialize (danger, double-confirm).
2. **模型 (LLM)** — provider dropdown (`Claude` / `OpenAI`), model dropdown filtered by provider, API key (password, `***` when saved, "update" to replace), max tokens, temperature.
3. **搜索 (Web Search)** — Tavily API key, default top-N (slider 3–10, default 5), depth (`basic` / `advanced`).
4. **外观 (Appearance)** — locale (`中文` / `English` disabled "即将支持"), density (`紧凑 / 标准 / 舒适`).

### Save semantics

- Per-section `保存` + `还原`. Unsaved changes show a yellow top banner "有未保存的更改" and prompt when navigating away.
- API keys and vault config go to the runtime config file (extended `desktop-runtime.json`). File written with `0600` where supported. Never committed to git.

### Validation

- Vault path must exist; otherwise inline error + disabled save.
- Tavily key has a `测试连通性` button that pings a minimum-cost endpoint and reports latency / error inline.
- Provider change shows a banner "重启生效"; reload via Electron IPC (no hard exit).

## 10. Backend

All new responses follow `{ success, data, error, meta? }` except SSE streams.

### Conversation storage

Location: `<targetVault>/.chat/<conversationId>.json` — created lazily on first write.

```ts
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  webSearchEnabled: boolean;
  articleRefs: string[];
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  sources?: WebSource[];
  articleRefs?: string[];
  tokens?: { in: number; out: number };
}

interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}
```

### Chat endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/chat` | List metadata, no messages, sorted by `updatedAt` desc |
| GET    | `/api/chat/:id` | Full conversation |
| POST   | `/api/chat` | Create (optional `{ title? }`) |
| PATCH  | `/api/chat/:id` | Update `title` / `webSearchEnabled` / `articleRefs` |
| DELETE | `/api/chat/:id` | Delete file |
| POST   | `/api/chat/:id/messages` (SSE) | Body: `{ content, articleRefs, webSearchEnabled }`. Events: `token` / `sources` / `done` / `error`. Persist on `done`. |
| POST   | `/api/chat/:id/title` | Auto-generate title if default |
| POST   | `/api/chat/:id/abort` | Stop in-flight stream (MVP: terminate and discard) |

Chat SSE does **not** support cross-disconnect resume in this iteration. On disconnect the user sees "回答被中断" and may resend.

### Runs endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST   | `/api/run/check` (SSE) | `{ dryRun?: boolean }`. Spawns lint pipeline. End event `{ exitCode, summary, auditRunId }` |
| POST   | `/api/run/sync` (SSE)  | `{ dryRun?: boolean }`. Spawns sync-compile pipeline. Same end shape |
| GET    | `/api/run/:id/tail` | Ring buffer replay (last 2000 lines) |
| POST   | `/api/run/:id/abort` | SIGTERM the child |

Single-slot mutex; second concurrent request → HTTP 409 `BUSY`.

### Review endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/review?state=&kind=&severity=` | Merged items |
| GET    | `/api/review/:id` | Full detail |
| POST   | `/api/review/:id/action` | `{ action: "accept"|"reject"|"dismiss"|"resolve" }` — persisted to `state.json` |
| POST   | `/api/review/:id/websearch` (SSE) | `{ query }` — Tavily + readable extraction, streams `result` events |
| POST   | `/api/review/:id/evidence` | `{ sources: WebSource[] }` — append to evidence |

```ts
interface ReviewItem {
  id: string;
  kind: "lint" | "sync" | "system.gap" | "system.suggestion";
  severity: "error" | "warn" | "info";
  title: string;
  summary: string;
  filePath?: string;
  rule?: string;
  runId?: string;
  createdAt: string;
  state: "pending" | "accepted" | "rejected" | "resolved" | "dismissed";
  payload: unknown;
  evidence?: WebSource[];
}
```

### Config endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/config` | Current config; secrets returned as `"***"` + `hasKey: boolean` |
| PATCH  | `/api/config` | Merge update; `***` values are ignored (use explicit `null` to clear) |
| POST   | `/api/config/test-tavily` | Ping with current key; returns `{ ok, latencyMs, error? }` |

Config extension:
```ts
interface RuntimeConfig {
  vault: string;
  sources: string[];
  llm: {
    provider: "claude" | "openai";
    model: string;
    apiKey: string;
    maxTokens?: number;
    temperature?: number;
  };
  tavily: { apiKey: string; topN: number; depth: "basic" | "advanced" };
  appearance: { locale: "zh-CN" | "en-US"; density: "compact" | "comfortable" | "roomy" };
}
```

### Internal search module

`src/search/tavily.ts` — `searchTavily(query, { topN, depth })`. Consumed by chat SSE (web context) and review websearch; not exposed as an HTTP route.

### Error conventions

- 4xx/5xx → `{ success: false, error: <string> }`; details logged server-side only.
- SSE error → `event: error\ndata: {"message": "..."}` then close.
- Missing Tavily / LLM keys → `400 CONFIG_MISSING`. The chat and review views surface an inline notice with a "去设置" button.

## 11. File / Module Breakdown

### Frontend (`web/client/`)

```
web/client/
├── index.html
├── assets/
│   └── styles/
│       ├── tokens.css
│       ├── base.css
│       ├── shell.css
│       ├── components.css
│       └── pages/
│           ├── chat.css
│           ├── runs.css
│           ├── review.css
│           └── settings.css
└── src/
    ├── main.ts
    ├── router.ts
    ├── store/
    │   ├── shell.ts
    │   ├── chat.ts
    │   ├── review.ts
    │   └── runs.ts
    ├── api/
    │   ├── client.ts
    │   ├── chat.ts
    │   ├── review.ts
    │   ├── runs.ts
    │   └── config.ts
    ├── components/
    │   ├── icon.ts
    │   ├── button.ts
    │   ├── input.ts
    │   ├── chip.ts
    │   ├── toast.ts
    │   ├── dialog.ts
    │   └── skeleton.ts
    ├── shell/
    │   ├── rail.ts
    │   ├── browser.ts
    │   ├── drawer.ts
    │   └── tree.ts
    ├── pages/
    │   ├── chat/
    │   │   ├── index.ts
    │   │   ├── conversation-list.ts
    │   │   ├── thread.ts
    │   │   ├── message.ts
    │   │   ├── composer.ts
    │   │   └── wikilink.ts
    │   ├── runs/
    │   │   ├── check.ts
    │   │   ├── sync.ts
    │   │   └── log-view.ts
    │   ├── review/
    │   │   ├── index.ts
    │   │   ├── item-list.ts
    │   │   ├── item-detail.ts
    │   │   └── websearch-panel.ts
    │   └── settings/
    │       ├── index.ts
    │       ├── vault.ts
    │       ├── llm.ts
    │       ├── search.ts
    │       └── appearance.ts
    └── util/
        ├── dom.ts
        ├── time.ts
        └── markdown.ts
```

Legacy files:
- `main.ts` (573 lines) — split across new `pages/` entries, shell, and router.
- `tree.ts` — folded into `shell/tree.ts` and extended for multi-select.
- `feedback.ts` — migrated into `pages/review/` as the feedback/audit surface.
- `graph.ts`, `particles.ts` — **left in place, unchanged**. They are not mounted in the new shell but remain on disk for later reintegration.
- Welcome / setup screens in `index.html` — preserved; only the `#workspace-shell` region is rewritten.

### Backend (`web/server/`)

```
web/server/
├── index.ts                    # registers new routes
├── routes/
│   ├── pages.ts                # existing
│   ├── tree.ts                 # existing
│   ├── audit.ts                # folded into review.ts; remove after migration
│   ├── graph.ts                # existing, retained
│   ├── chat.ts                 # new
│   ├── review.ts               # new
│   ├── runs.ts                 # new
│   └── config.ts               # new
├── services/
│   ├── chat-store.ts
│   ├── review-aggregator.ts
│   ├── run-manager.ts
│   ├── tavily-search.ts
│   └── llm-chat.ts
└── sse.ts
```

### Shared types

`web/shared/types.ts` — exported interfaces: `Conversation`, `ChatMessage`, `WebSource`, `ReviewItem`, `RunEvent`, `RuntimeConfig`. Imported by both client and server via a `tsconfig` path alias.

### File size policy

All files must stay under 400 lines excluding comments (project rule). Every function under 40 lines. The module layout above is designed so no file approaches the limit.

## 12. Delivery Phasing

Each phase leaves the product runnable and demoable.

1. **Phase 1 — Visual system + shell skeleton.** Introduce `tokens.css`, the new font stack, Lucide icons. Add `rail.ts`, `browser.ts`, `router.ts`. `#/chat` temporarily hosts the existing article view; other tabs show "即将推出". Welcome / init screens repainted. No behavior change.
2. **Phase 2 — Page Drawer + browser enhancements.** Wiki/raw toggle, search, multi-select, drawer open/close, wikilink navigation.
3. **Phase 3 — Chat view (core).** Backend `chat.ts` + `chat-store.ts` + `llm-chat.ts` + Tavily hookup + SSE. All `pages/chat/` modules. Web search toggle and multi-article context land here.
4. **Phase 4 — Check / Sync views.** `run-manager.ts`, runs SSE routes, `pages/runs/` shared `log-view`. Completion toasts jump to review.
5. **Phase 5 — Review view.** `review-aggregator.ts` + `state.json` + `pages/review/` + `websearch-panel`.
6. **Phase 6 — Settings view.** Promote dialog to full view, four sections, runtime-config wiring, Tavily test-connectivity button.
7. **Phase 7 — Cleanup & polish.** Remove confirmed-dead code (**not** `particles.ts` / `graph.ts`). Validate responsive breakpoints. Playwright smoke tests per view. `fallow`, `npx tsc --noEmit`, `npm run build`, `npm test` all green.

## 13. Testing Strategy

### Unit (vitest, existing runner)
- `chat-store.ts` — read/write, concurrent-safe, directory auto-create.
- `review-aggregator.ts` — three-source merge, stable id, state overlay.
- `run-manager.ts` — mutex, ring buffer, abort propagation.
- `tavily-search.ts` — HTTP mocked, success + failure paths.

### Integration
- Chat SSE happy path + mid-stream abort + missing-key error.

### E2E (Playwright, newly introduced)
- P1: rail switches across all four tabs (placeholders acceptable).
- P3: send a user message → assistant streams → reload shows persistence.
- P4: start sync → confirm → logs scroll → completion toast.
- P5: review list shows ≥1 item → accept persists across reload.
- P6: edit vault path → save → reread config.

## 14. Risks & Open Questions

- **Rewriting `main.ts` in parallel with existing routing.** Mitigation: Phase 1 keeps the current article view alive under `#/chat`; nothing removed until the replacement is proven.
- **Noto Sans SC CDN** may be slow on some networks. Mitigation: system-font fallback covers all CJK rendering; the web font is an enhancement.
- **Tavily quota** — free tier is generous but not unlimited. Mitigation: show clear errors and require explicit opt-in (toggle off by default per new conversation).
- **Electron shell.openPath** cross-platform behavior — tested on Windows (primary target), should be verified on macOS before any mac build.
- **SSE on Electron / Express** — requires disabling compression middleware for the streaming routes. Verified in Phase 3.
