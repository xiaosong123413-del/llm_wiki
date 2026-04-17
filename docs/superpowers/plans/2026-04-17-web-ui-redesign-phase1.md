# Web UI Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the new visual system and the app shell skeleton (rail + browser + main + router) in `web/client/` with zero behavior change. Existing article view keeps working under `#/chat`; other rail tabs show "即将推出" placeholders. Welcome / setup screens repainted with new tokens.

**Architecture:** Vanilla TypeScript + CSS variables, built via existing `esbuild` bundler in `web/build-client.mjs`. Introduce a CSS token layer (`tokens.css`) and a small shell composed of three pure modules (`router.ts`, `rail.ts`, `browser.ts`). Lucide icons via `lucide-static` package (SVG strings, no runtime deps). Existing `main.ts` is restructured so the old article/audit/log panels become the contents of `#/chat`. All other new rail routes render a shared placeholder component.

**Tech Stack:** TypeScript, esbuild, CSS custom properties, Lucide (via `lucide-static`), Inter + Noto Sans SC, Vitest (jsdom environment) for module unit tests.

**Reference spec:** `docs/superpowers/specs/2026-04-17-web-ui-redesign-design.md` §3 (shell) and §4 (visual system) are the authoritative source for all numeric values in this plan.

---

## File Structure

**Create:**
- `web/client/assets/styles/tokens.css` — CSS custom properties (color / type / radius / spacing / shadow).
- `web/client/assets/styles/base.css` — reset, body, font loading.
- `web/client/assets/styles/shell.css` — four-zone grid, rail, browser panel, main, placeholder, drawer slot.
- `web/client/assets/styles/components.css` — button, input, chip, badge (minimal, extended in later phases).
- `web/client/src/router.ts` — hash router (pure logic, no DOM).
- `web/client/src/shell/rail.ts` — rail renderer + active-state binding.
- `web/client/src/shell/browser.ts` — thin extraction of existing layer toggle + tree search (no behavior change yet).
- `web/client/src/shell/main-slot.ts` — a switcher that routes `#/chat` to the existing workspace DOM and other routes to a placeholder element.
- `web/client/src/shell/placeholder.ts` — "即将推出 · Coming soon" view used by non-chat routes in Phase 1.
- `web/client/src/components/icon.ts` — renders a Lucide SVG string by name with size and stroke-width.
- `test/web-router.test.ts` — router unit tests.
- `test/web-rail.test.ts` — rail render / active-state tests (jsdom).
- `test/web-icon.test.ts` — icon renderer output tests.

**Modify:**
- `web/client/index.html` — replace `#workspace-shell` content with the new four-zone shell markup; keep `#startup-shell` (welcome/setup) intact; swap the single stylesheet link for the new split imports.
- `web/client/main.ts` — remove the hard-coded workspace layout injection; instead, mount rail + browser + main slot, and let the existing bootstrap continue to populate the legacy DOM nodes that now live inside the `#/chat` slot.
- `web/client/styles.css` — trimmed to legacy selectors still referenced (startup / setup / dialog / audit / log); most bulk styles move to the new files or are deleted if unused.
- `web/build-client.mjs` — copy the new split CSS files into `dist/client/assets/styles/` and the `lucide-static` icons if we decide to copy (MVP: we inline SVG strings at bundle time, no copy needed).
- `web/package.json` — add `lucide-static` as dependency.
- `web/tsconfig.json` — no change expected; `include` already covers `client/**/*.ts`.

**Not touched in Phase 1:**
- `web/client/feedback.ts` — continues to work against the legacy audit panel, which is still rendered inside `#/chat`.
- `web/client/graph.ts`, `web/client/particles.ts` — untouched per spec §11.
- `web/server/**` — no backend changes.

---

## Task 1: Icon component (inlined Lucide SVGs)

**Files:**
- Create: `web/client/src/components/icon.ts`
- Create: `test/web-icon.test.ts`

Rationale: Phase 1 needs only ~10 icons. Inlining their SVG markup from the MIT-licensed Lucide set removes a dependency and avoids any runtime-resolution question (tests run from the repo root and need the module reachable without extra npm installs in `web/`). Later phases extend the map in place.

- [ ] **Step 1: Write failing test for the icon renderer**

Create `test/web-icon.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderIcon, ICON_NAMES } from "../web/client/src/components/icon.js";

describe("renderIcon", () => {
  it("returns an <svg> string with the requested size and stroke width", () => {
    const svg = renderIcon("message-square", { size: 20, strokeWidth: 1.75 });
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toMatch(/width="20"/);
    expect(svg).toMatch(/height="20"/);
    expect(svg).toMatch(/stroke-width="1.75"/);
    expect(svg).toMatch(/class="lucide-icon"/);
  });

  it("falls back to the default size when omitted", () => {
    const svg = renderIcon("settings");
    expect(svg).toMatch(/width="20"/);
    expect(svg).toMatch(/stroke-width="1.75"/);
  });

  it("throws for an unknown icon name", () => {
    expect(() => renderIcon("definitely-not-a-real-icon")).toThrow(/unknown icon/i);
  });

  it("exports every Phase 1 icon used by the shell", () => {
    for (const name of [
      "message-square",
      "check-circle-2",
      "refresh-cw",
      "clipboard-list",
      "settings",
      "search",
      "hammer",
    ]) {
      expect(ICON_NAMES).toContain(name);
      expect(() => renderIcon(name)).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/web-icon.test.ts`
Expected: FAIL with "Cannot find module '../web/client/src/components/icon.js'".

- [ ] **Step 3: Implement the icon renderer**

Create `web/client/src/components/icon.ts`:

```ts
/**
 * Lucide-derived icon renderer.
 *
 * Returns inline SVG markup for a named icon. Icons below are copied from the
 * Lucide icon set (MIT License, https://lucide.dev). Extend ICONS as later
 * phases need more; ICON_NAMES is exported for test coverage.
 *
 * Consumers embed the result via `element.innerHTML = renderIcon(name)`.
 * Default size 20, default stroke-width 1.75, matching the visual system.
 */

interface IconOptions {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const DEFAULT_SIZE = 20;
const DEFAULT_STROKE_WIDTH = 1.75;

/** Inner paths only — the outer <svg> is generated in renderIcon. */
const ICONS: Record<string, string> = {
  "message-square":
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  "check-circle-2":
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  "refresh-cw":
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>' +
    '<path d="M21 3v5h-5"/>' +
    '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>' +
    '<path d="M8 16H3v5"/>',
  "clipboard-list":
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>' +
    '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
    '<path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  "settings":
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
    '<circle cx="12" cy="12" r="3"/>',
  "search":
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  "hammer":
    '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/>' +
    '<path d="m18 15 4-4"/>' +
    '<path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
};

export const ICON_NAMES: readonly string[] = Object.keys(ICONS);

export function renderIcon(name: string, options: IconOptions = {}): string {
  const inner = ICONS[name];
  if (!inner) {
    throw new Error(`unknown icon: ${name}`);
  }
  const size = options.size ?? DEFAULT_SIZE;
  const stroke = options.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const className = options.className ? `lucide-icon ${options.className}` : "lucide-icon";
  return (
    `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" ` +
    `width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="${stroke}" ` +
    `stroke-linecap="round" stroke-linejoin="round">` +
    inner +
    `</svg>`
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/web-icon.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/client/src/components/icon.ts test/web-icon.test.ts
git commit -m "feat(web): add inlined lucide icon renderer"
```

---

## Task 2: Hash router module

**Files:**
- Create: `web/client/src/router.ts`
- Create: `test/web-router.test.ts`

- [ ] **Step 1: Write failing test for the router**

Create `test/web-router.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouter, parseHash, type Route } from "../web/client/src/router.js";

describe("parseHash", () => {
  it("parses a simple route", () => {
    expect(parseHash("#/chat")).toEqual({ name: "chat", params: {} });
  });

  it("extracts a single path parameter", () => {
    expect(parseHash("#/chat/abc-123")).toEqual({ name: "chat", params: { id: "abc-123" } });
  });

  it("extracts a settings section", () => {
    expect(parseHash("#/settings/llm")).toEqual({ name: "settings", params: { section: "llm" } });
  });

  it("falls back to the default route for empty or unknown hashes", () => {
    expect(parseHash("")).toEqual({ name: "chat", params: {} });
    expect(parseHash("#/nope")).toEqual({ name: "chat", params: {} });
  });
});

describe("createRouter", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("calls onChange with the current route on start", () => {
    const onChange = vi.fn();
    window.location.hash = "#/review";
    const router = createRouter(onChange);
    router.start();
    expect(onChange).toHaveBeenCalledWith({ name: "review", params: {} });
  });

  it("calls onChange on hashchange", () => {
    const onChange = vi.fn();
    const router = createRouter(onChange);
    router.start();
    onChange.mockClear();
    window.location.hash = "#/sync";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(onChange).toHaveBeenCalledWith({ name: "sync", params: {} });
  });

  it("navigate() updates the hash", () => {
    const onChange = vi.fn();
    const router = createRouter(onChange);
    router.start();
    router.navigate({ name: "check" });
    expect(window.location.hash).toBe("#/check");
  });
});

// Type-level sanity check — ensures the Route union covers all planned names.
const sample: Route = { name: "chat", params: {} };
void sample;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/web-router.test.ts`
Expected: FAIL with "Cannot find module '../web/client/src/router.js'".

- [ ] **Step 3: Implement the router**

Create `web/client/src/router.ts`:

```ts
/**
 * Hash-based router for the web client.
 *
 * Routes are represented as `{ name, params }`. Unknown or empty hashes fall
 * back to the default route (`chat`). The router is intentionally minimal —
 * it does no DOM manipulation; view mounting lives in `shell/main-slot.ts`.
 */

export type RouteName = "chat" | "check" | "sync" | "review" | "settings";

export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

interface RouteSpec {
  name: RouteName;
  paramKey?: string;
}

const ROUTE_TABLE: Record<string, RouteSpec> = {
  chat: { name: "chat", paramKey: "id" },
  check: { name: "check" },
  sync: { name: "sync" },
  review: { name: "review", paramKey: "id" },
  settings: { name: "settings", paramKey: "section" },
};

const DEFAULT_ROUTE: Route = { name: "chat", params: {} };

export function parseHash(hash: string): Route {
  if (!hash || hash === "#" || hash === "#/") {
    return { ...DEFAULT_ROUTE, params: {} };
  }
  const trimmed = hash.startsWith("#/") ? hash.slice(2) : hash.replace(/^#/, "");
  const [head, tail] = trimmed.split("/", 2);
  const spec = ROUTE_TABLE[head];
  if (!spec) {
    return { ...DEFAULT_ROUTE, params: {} };
  }
  const params: Record<string, string> = {};
  if (tail && spec.paramKey) {
    params[spec.paramKey] = tail;
  }
  return { name: spec.name, params };
}

function formatRoute(route: { name: RouteName; params?: Record<string, string> }): string {
  const spec = ROUTE_TABLE[route.name];
  const key = spec?.paramKey;
  const value = key ? route.params?.[key] : undefined;
  return value ? `#/${route.name}/${value}` : `#/${route.name}`;
}

export interface Router {
  start(): void;
  navigate(route: { name: RouteName; params?: Record<string, string> }): void;
  current(): Route;
}

export function createRouter(onChange: (route: Route) => void): Router {
  let current: Route = parseHash(window.location.hash);
  function emit(): void {
    current = parseHash(window.location.hash);
    onChange(current);
  }
  return {
    start() {
      window.addEventListener("hashchange", emit);
      emit();
    },
    navigate(route) {
      window.location.hash = formatRoute(route);
    },
    current() {
      return current;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/web-router.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add web/client/src/router.ts test/web-router.test.ts
git commit -m "feat(web): add hash router"
```

---

## Task 3: CSS token layer

**Files:**
- Create: `web/client/assets/styles/tokens.css`
- Create: `web/client/assets/styles/base.css`

- [ ] **Step 1: Create `tokens.css` with the full variable set from spec §4**

Create `web/client/assets/styles/tokens.css`:

```css
/* Design tokens — see docs/superpowers/specs/2026-04-17-web-ui-redesign-design.md §4 */
:root {
  /* Brand */
  --primary: #6D57FF;
  --primary-hover: #5B46E8;
  --primary-soft: #EFEBFF;
  --primary-ring: rgba(109, 87, 255, 0.22);

  /* Neutrals */
  --bg-app: #F7F7FB;
  --bg-panel: #FFFFFF;
  --bg-muted: #F2F2F7;
  --bg-hover: #EDEDF4;
  --bg-selected: #E8E5F7;

  /* Borders */
  --border: #EAEAF0;
  --border-strong: #D8D8E2;

  /* Text */
  --text: #18181B;
  --text-secondary: #52525B;
  --text-muted: #8A8A93;
  --text-on-primary: #FFFFFF;

  /* Semantic */
  --success: #10B981;
  --warn: #F59E0B;
  --danger: #EF4444;
  --info: #3B82F6;

  /* Radius */
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgba(24, 24, 27, 0.04);
  --shadow-md: 0 4px 16px rgba(24, 24, 27, 0.06), 0 2px 4px rgba(24, 24, 27, 0.04);
  --shadow-lg: 0 20px 48px rgba(109, 87, 255, 0.12), 0 4px 12px rgba(24, 24, 27, 0.06);

  /* Motion */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-fast: 120ms;
  --dur-base: 180ms;
}
```

- [ ] **Step 2: Create `base.css` with reset, body, and the new font stack**

Create `web/client/assets/styles/base.css`:

```css
/* Base reset and typography */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: Inter, "Noto Sans SC", "HarmonyOS Sans SC", "PingFang SC",
    "Microsoft YaHei UI", system-ui, sans-serif;
  font-size: 15px;
  line-height: 22px;
  color: var(--text);
  background: var(--bg-app);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "tnum";
}

button,
input,
textarea,
select {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

.hidden {
  display: none !important;
}

.text-muted {
  color: var(--text-muted);
}

code,
pre,
kbd,
.mono {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/client/assets/styles/tokens.css web/client/assets/styles/base.css
git commit -m "feat(web): add design tokens and base stylesheet"
```

---

## Task 4: Shell layout stylesheet + components stylesheet

**Files:**
- Create: `web/client/assets/styles/shell.css`
- Create: `web/client/assets/styles/components.css`

- [ ] **Step 1: Create `shell.css` — the four-zone grid and its three primary regions**

Create `web/client/assets/styles/shell.css`:

```css
/* Four-zone app shell: rail | browser | main | drawer */

#workspace-shell {
  display: grid;
  grid-template-columns: 64px 280px 1fr 0;
  grid-template-rows: 100vh;
  overflow: hidden;
  background: var(--bg-app);
}

/* ---- Rail ---- */
.shell-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-4) 0;
  gap: var(--space-2);
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
}

.shell-rail__spacer {
  flex: 1;
}

.shell-rail__btn {
  position: relative;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
}

.shell-rail__btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.shell-rail__btn[data-active="true"] {
  color: var(--primary);
  background: var(--primary-soft);
}

.shell-rail__btn[data-active="true"]::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: var(--primary);
  border-radius: 2px;
}

.shell-rail__btn .lucide-icon {
  stroke: currentColor;
  fill: none;
}

/* ---- Browser ---- */
.shell-browser {
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  min-width: 0;
  overflow: hidden;
}

.shell-browser[hidden] {
  display: none;
}

/* ---- Main ---- */
.shell-main {
  min-width: 0;
  overflow: auto;
  background: var(--bg-app);
}

/* ---- Placeholder (Phase 1 for non-chat routes) ---- */
.shell-placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.shell-placeholder__card {
  text-align: center;
  max-width: 360px;
}

.shell-placeholder__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 var(--space-2);
}

.shell-placeholder__copy {
  font-size: 15px;
  line-height: 22px;
  color: var(--text-muted);
  margin: 0;
}
```

- [ ] **Step 2: Create `components.css` — button / input / chip / badge minimums**

Create `web/client/assets/styles/components.css`:

```css
/* Button / input / chip / badge — minimal Phase 1 set */

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 16px;
  border: 0;
  border-radius: var(--radius-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out),
              transform var(--dur-fast) var(--ease-out),
              box-shadow var(--dur-fast) var(--ease-out);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-md);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text);
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 0;
  background: var(--bg-muted);
  border-radius: var(--radius-sm);
  color: var(--text);
  outline: none;
  transition: background var(--dur-fast) var(--ease-out),
              box-shadow var(--dur-fast) var(--ease-out);
}

.input:focus {
  background: var(--bg-panel);
  box-shadow: 0 0 0 2px var(--primary-ring);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 13px;
  line-height: 18px;
  background: var(--bg-muted);
  color: var(--text-secondary);
}

.chip--primary {
  background: var(--primary-soft);
  color: var(--primary);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  height: 18px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 18px;
  background: var(--bg-muted);
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add web/client/assets/styles/shell.css web/client/assets/styles/components.css
git commit -m "feat(web): add shell layout and base component styles"
```

---

## Task 5: Rail module

**Files:**
- Create: `web/client/src/shell/rail.ts`
- Create: `test/web-rail.test.ts`

- [ ] **Step 1: Write failing test for the rail**

Create `test/web-rail.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountRail } from "../web/client/src/shell/rail.js";

describe("mountRail", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("aside");
    document.body.appendChild(container);
  });

  it("renders all five nav items", () => {
    mountRail(container, { current: "chat", onNavigate: vi.fn() });
    const buttons = container.querySelectorAll<HTMLButtonElement>(".shell-rail__btn");
    expect(buttons.length).toBe(5);
    const names = Array.from(buttons).map((b) => b.dataset.route);
    expect(names).toEqual(["chat", "check", "sync", "review", "settings"]);
  });

  it("marks the current route as active", () => {
    mountRail(container, { current: "review", onNavigate: vi.fn() });
    const review = container.querySelector<HTMLButtonElement>('[data-route="review"]');
    expect(review?.getAttribute("data-active")).toBe("true");
    const chat = container.querySelector<HTMLButtonElement>('[data-route="chat"]');
    expect(chat?.getAttribute("data-active")).toBe("false");
  });

  it("invokes onNavigate with the clicked route name", () => {
    const onNavigate = vi.fn();
    mountRail(container, { current: "chat", onNavigate });
    const sync = container.querySelector<HTMLButtonElement>('[data-route="sync"]');
    sync?.click();
    expect(onNavigate).toHaveBeenCalledWith("sync");
  });

  it("update() re-applies the active state without re-rendering buttons", () => {
    const onNavigate = vi.fn();
    const handle = mountRail(container, { current: "chat", onNavigate });
    const before = container.querySelectorAll(".shell-rail__btn");
    handle.update("check");
    const after = container.querySelectorAll(".shell-rail__btn");
    expect(after.length).toBe(before.length);
    expect(after[0]).toBe(before[0]);
    const check = container.querySelector<HTMLButtonElement>('[data-route="check"]');
    expect(check?.getAttribute("data-active")).toBe("true");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/web-rail.test.ts`
Expected: FAIL with "Cannot find module '../web/client/src/shell/rail.js'".

- [ ] **Step 3: Implement the rail**

Create `web/client/src/shell/rail.ts`:

```ts
/**
 * Left-edge function rail. Renders five icon buttons and reports clicks via
 * onNavigate. Active state is driven externally (router -> update()).
 */

import type { RouteName } from "../router.js";
import { renderIcon } from "../components/icon.js";

interface RailItem {
  route: RouteName;
  icon: string;
  label: string;
  position: "top" | "bottom";
}

const RAIL_ITEMS: RailItem[] = [
  { route: "chat", icon: "message-square", label: "对话", position: "top" },
  { route: "check", icon: "check-circle-2", label: "检查", position: "top" },
  { route: "sync", icon: "refresh-cw", label: "同步", position: "top" },
  { route: "review", icon: "clipboard-list", label: "审查", position: "top" },
  { route: "settings", icon: "settings", label: "设置", position: "bottom" },
];

interface RailOptions {
  current: RouteName;
  onNavigate: (route: RouteName) => void;
}

export interface RailHandle {
  update(current: RouteName): void;
}

export function mountRail(container: HTMLElement, options: RailOptions): RailHandle {
  container.classList.add("shell-rail");
  container.innerHTML = "";

  const top: RailItem[] = RAIL_ITEMS.filter((i) => i.position === "top");
  const bottom: RailItem[] = RAIL_ITEMS.filter((i) => i.position === "bottom");

  for (const item of top) {
    container.appendChild(buildButton(item, options));
  }
  const spacer = document.createElement("div");
  spacer.className = "shell-rail__spacer";
  container.appendChild(spacer);
  for (const item of bottom) {
    container.appendChild(buildButton(item, options));
  }

  applyActive(container, options.current);

  return {
    update(current) {
      applyActive(container, current);
    },
  };
}

function buildButton(item: RailItem, options: RailOptions): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shell-rail__btn";
  btn.dataset.route = item.route;
  btn.setAttribute("aria-label", item.label);
  btn.title = item.label;
  btn.innerHTML = renderIcon(item.icon, { size: 24 });
  btn.addEventListener("click", () => options.onNavigate(item.route));
  return btn;
}

function applyActive(container: HTMLElement, current: RouteName): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>(".shell-rail__btn");
  buttons.forEach((btn) => {
    btn.setAttribute("data-active", btn.dataset.route === current ? "true" : "false");
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/web-rail.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/client/src/shell/rail.ts test/web-rail.test.ts
git commit -m "feat(web): add rail shell module"
```

---

## Task 6: Main slot + placeholder

**Files:**
- Create: `web/client/src/shell/placeholder.ts`
- Create: `web/client/src/shell/main-slot.ts`

No new test file — these modules manipulate DOM nodes provided by callers and are exercised by the Playwright smoke test added in Task 9.

- [ ] **Step 1: Create the placeholder view**

Create `web/client/src/shell/placeholder.ts`:

```ts
/**
 * Placeholder view used by non-chat routes during Phase 1.
 * Replaced by real page modules in later phases.
 */

import { renderIcon } from "../components/icon.js";

const COPY: Record<string, { title: string; copy: string }> = {
  check: {
    title: "检查 · 即将推出",
    copy: "将在 Phase 4 上线：运行 lint，实时查看日志并将问题汇入审查。",
  },
  sync: {
    title: "同步 · 即将推出",
    copy: "将在 Phase 4 上线：一键同步源目录并重新编译 wiki。",
  },
  review: {
    title: "审查 · 即将推出",
    copy: "将在 Phase 5 上线：汇总 lint、同步失败和系统检查中需要确认的条目。",
  },
  settings: {
    title: "设置 · 即将推出",
    copy: "将在 Phase 6 上线：仓库、模型、搜索、外观四类设置。",
  },
};

export function renderPlaceholder(routeName: string): HTMLElement {
  const info = COPY[routeName] ?? { title: "即将推出", copy: "" };
  const root = document.createElement("div");
  root.className = "shell-placeholder";
  root.innerHTML = `
    <div class="shell-placeholder__card">
      <div class="shell-placeholder__icon">${renderIcon("hammer", { size: 32 })}</div>
      <h2 class="shell-placeholder__title">${escapeHtml(info.title)}</h2>
      <p class="shell-placeholder__copy">${escapeHtml(info.copy)}</p>
    </div>
  `;
  return root;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

- [ ] **Step 2: Create the main-slot switcher**

Create `web/client/src/shell/main-slot.ts`:

```ts
/**
 * Main content slot. Shows the legacy article/audit DOM for `#/chat` and a
 * placeholder for every other route. The legacy DOM is owned by main.ts and
 * passed in as `legacyChatNode`; this module only toggles visibility and
 * swaps in the placeholder for non-chat routes.
 */

import type { Route } from "../router.js";
import { renderPlaceholder } from "./placeholder.js";

interface MainSlotOptions {
  container: HTMLElement;
  legacyChatNode: HTMLElement;
  legacyBrowser: HTMLElement;
}

export interface MainSlotHandle {
  render(route: Route): void;
}

export function createMainSlot(options: MainSlotOptions): MainSlotHandle {
  const { container, legacyChatNode, legacyBrowser } = options;
  let activeNonChat: HTMLElement | null = null;

  return {
    render(route) {
      const isChat = route.name === "chat";
      legacyChatNode.hidden = !isChat;
      legacyBrowser.hidden = route.name === "settings";
      if (isChat) {
        if (activeNonChat) {
          activeNonChat.remove();
          activeNonChat = null;
        }
        return;
      }
      const next = renderPlaceholder(route.name);
      if (activeNonChat) {
        activeNonChat.replaceWith(next);
      } else {
        container.appendChild(next);
      }
      activeNonChat = next;
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add web/client/src/shell/placeholder.ts web/client/src/shell/main-slot.ts
git commit -m "feat(web): add main slot and placeholder views"
```

---

## Task 7: Browser panel extraction

**Files:**
- Create: `web/client/src/shell/browser.ts`

Phase 1 goal: move the existing browser markup (layer toggle + tree search + tree container) into a module that mounts into the new shell. Behavior stays identical; subsequent phases extend it with multi-select.

- [ ] **Step 1: Create the browser mount helper**

Create `web/client/src/shell/browser.ts`:

```ts
/**
 * Browser panel shell. Wraps the existing layer-toggle + tree-search + tree
 * markup in the new shell grid. Phase 1 preserves behavior — the caller still
 * attaches its own event listeners to the returned element references.
 */

import { renderIcon } from "../components/icon.js";

export interface BrowserRefs {
  root: HTMLElement;
  layerToggle: HTMLElement;
  layerWikiBtn: HTMLButtonElement;
  layerRawBtn: HTMLButtonElement;
  searchInput: HTMLInputElement;
  treeContainer: HTMLElement;
}

export function mountBrowser(container: HTMLElement): BrowserRefs {
  container.classList.add("shell-browser");
  container.innerHTML = `
    <div class="shell-browser__header">
      <div id="layer-toggle" class="layer-toggle" aria-label="Toggle file layer">
        <button type="button" class="layer-pill active" data-layer="wiki">wiki</button>
        <button type="button" class="layer-pill" data-layer="raw">raw</button>
      </div>
    </div>
    <div class="shell-browser__tools">
      <div class="shell-browser__search">
        <span class="shell-browser__search-icon">${renderIcon("search", { size: 16 })}</span>
        <input id="tree-search" class="input" type="search"
               placeholder="搜索文件" autocomplete="off" />
      </div>
    </div>
    <nav id="tree" class="shell-browser__tree"><p class="loading">Loading tree</p></nav>
  `;

  const layerToggle = container.querySelector<HTMLElement>("#layer-toggle")!;
  const [layerWikiBtn, layerRawBtn] = Array.from(
    layerToggle.querySelectorAll<HTMLButtonElement>("[data-layer]")
  );
  const searchInput = container.querySelector<HTMLInputElement>("#tree-search")!;
  const treeContainer = container.querySelector<HTMLElement>("#tree")!;

  return { root: container, layerToggle, layerWikiBtn, layerRawBtn, searchInput, treeContainer };
}
```

- [ ] **Step 2: Add minimal browser styles**

Append to `web/client/assets/styles/shell.css`:

```css
.shell-browser__header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.layer-toggle {
  display: inline-flex;
  background: var(--bg-muted);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.layer-pill {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
}

.layer-pill.active {
  background: var(--bg-panel);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.shell-browser__tools {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.shell-browser__search {
  position: relative;
}

.shell-browser__search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.shell-browser__search .input {
  padding-left: 34px;
}

.shell-browser__tree {
  flex: 1;
  overflow: auto;
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  line-height: 18px;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/client/src/shell/browser.ts web/client/assets/styles/shell.css
git commit -m "feat(web): add browser panel shell module"
```

---

## Task 8: Wire the new shell into `index.html` and `main.ts`

The existing `main.ts` owns a lot of bootstrap logic for the welcome / setup screens. Phase 1 keeps that logic untouched; we only replace the markup inside `#workspace-shell` and let `main.ts` mount the new shell pieces before calling its existing initializers.

**Files:**
- Modify: `web/client/index.html`
- Modify: `web/client/main.ts`
- Modify: `web/client/styles.css`

- [ ] **Step 1: Replace the `#workspace-shell` block in `index.html`**

Open `web/client/index.html`. Locate the `<link rel="stylesheet" href="/assets/styles.css" />` line and swap the styles to the new split files (keep Inter, KaTeX, and add Noto Sans SC):

```html
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" />
    <link rel="stylesheet" href="/assets/styles/tokens.css" />
    <link rel="stylesheet" href="/assets/styles/base.css" />
    <link rel="stylesheet" href="/assets/styles/components.css" />
    <link rel="stylesheet" href="/assets/styles/shell.css" />
    <link rel="stylesheet" href="/assets/styles.css" />
    <link rel="stylesheet" href="/katex/katex.min.css" />
```

Then locate the block `<div id="workspace-shell" class="hidden">` and replace the entire contents (from `<header id="topbar">` through to just before `</div>` closing `#workspace-shell`) with:

```html
      <aside id="shell-rail-slot"></aside>
      <aside id="shell-browser-slot"></aside>
      <main id="shell-main-slot" class="shell-main">
        <section id="chat-legacy">
          <header id="topbar">
            <div class="brand-block">
              <div class="brand-mark"></div>
              <div>
                <div class="brand-title">LLM Wiki</div>
                <div id="wiki-title" class="brand-subtitle"></div>
              </div>
            </div>
            <div class="topbar-actions">
              <button id="btn-settings" class="btn btn-secondary" type="button">Settings</button>
              <button id="btn-refresh" class="btn btn-secondary" type="button">Refresh</button>
            </div>
          </header>
          <section class="panel conversation-panel">
            <div class="panel-header">
              <div>
                <div class="eyebrow">Workspace</div>
                <h2>Article View</h2>
              </div>
              <div id="desktop-context" class="context-chip">Desktop WebUI</div>
            </div>
            <article id="page-content"><p class="loading">Loading page</p></article>
          </section>
          <section class="panel side-panel">
            <div class="panel-header">
              <div>
                <div class="eyebrow">Review</div>
                <h2>Open Audits</h2>
              </div>
            </div>
            <div id="audit-list"><p class="muted">No open audits.</p></div>
          </section>
          <section id="activity-log-panel" class="panel side-panel">
            <div class="panel-header">
              <div>
                <div class="eyebrow">Activity</div>
                <h2>Runtime Log</h2>
              </div>
            </div>
            <pre id="activity-log-content" class="log-content">Loading log</pre>
          </section>
        </section>
      </main>
```

Note: the legacy aside `#sidebar-left` (which hosted the tree) is gone — `#tree`, `#layer-toggle`, and `#tree-search` are now rendered by `browser.ts` into `#shell-browser-slot`.

- [ ] **Step 2: Wire the new shell in `main.ts`**

Open `web/client/main.ts`. At the top, add the new imports (below the existing ones):

```ts
import { createRouter, type Route, type RouteName } from "./src/router.js";
import { mountRail } from "./src/shell/rail.js";
import { mountBrowser, type BrowserRefs } from "./src/shell/browser.js";
import { createMainSlot } from "./src/shell/main-slot.js";
```

Add to the `elements` object:

```ts
  railSlot: document.getElementById("shell-rail-slot") as HTMLElement,
  browserSlot: document.getElementById("shell-browser-slot") as HTMLElement,
  mainSlot: document.getElementById("shell-main-slot") as HTMLElement,
  chatLegacy: document.getElementById("chat-legacy") as HTMLElement,
```

Remove the three element entries that no longer exist:
`tree`, `layerToggle`, `treeSearch`. These are replaced by live refs from `mountBrowser()`.

Replace `bindWorkspaceEvents` so it takes the browser refs instead of reading from `elements`. The new implementation is:

```ts
let browserRefs: BrowserRefs | null = null;

function bindWorkspaceEvents(): void {
  if (!browserRefs) return;

  browserRefs.layerToggle.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextLayer = (button.dataset.layer as "wiki" | "raw" | undefined) ?? "wiki";
      if (nextLayer === state.currentLayer) return;
      state.currentLayer = nextLayer;
      updateLayerToggle();
      if (state.startupState === "READY") {
        await loadTree();
      }
    });
  });

  browserRefs.searchInput.addEventListener("input", async () => {
    state.treeSearch = browserRefs!.searchInput.value.trim();
    if (state.startupState === "READY") {
      await loadTree();
    }
  });

  elements.refreshButton.addEventListener("click", async () => {
    if (state.startupState !== "READY") return;
    await enterReadyWorkspace();
  });

  elements.settingsButton.addEventListener("click", () => {
    openSettingsDialog();
  });
  // ... keep the remaining existing handlers for settingsChooseVault / cancel / etc.
}
```

Every other reference to `elements.tree`, `elements.layerToggle`, or `elements.treeSearch` in the file must be updated to read from `browserRefs` instead. (Use your editor's find-in-file and verify zero remaining references after the change.)

Change `main()` so the shell is mounted **first**, then the existing bootstrap runs:

```ts
async function main(): Promise<void> {
  mountShell();
  bindCommonEvents();
  await loadServerConfig();
  await bootstrapApplication();
  installFeedbackUI({
    getState: () => ({
      currentPath: state.currentPath,
      rawMarkdown: state.rawMarkdown,
      author: state.author,
    }),
    onCreated: async () => {
      await loadAudits(state.currentPath);
      await loadActivityLog();
    },
  });
}

function mountShell(): void {
  browserRefs = mountBrowser(elements.browserSlot);
  const mainSlotHandle = createMainSlot({
    container: elements.mainSlot,
    legacyChatNode: elements.chatLegacy,
    legacyBrowser: elements.browserSlot,
  });
  const railHandle = mountRail(elements.railSlot, {
    current: "chat",
    onNavigate: (route: RouteName) => {
      router.navigate({ name: route });
    },
  });
  const router = createRouter((route: Route) => {
    railHandle.update(route.name);
    mainSlotHandle.render(route);
  });
  router.start();
}
```

The `router` / `railHandle` / `mainSlotHandle` variables are function-scoped on purpose — they don't need module-level state.

- [ ] **Step 3: Update `build-client.mjs` to copy the new split stylesheets**

Open `web/build-client.mjs`. Below the existing `styles.css` copy line, add a loop that copies the new flat stylesheet directory (Phase 1 has no nested subdirectories under `assets/styles/`):

```js
// New split stylesheets under assets/styles/.
const stylesOutDir = path.join(assetsDir, "styles");
fs.mkdirSync(stylesOutDir, { recursive: true });
const stylesSrcDir = path.join(here, "client/assets/styles");
for (const name of fs.readdirSync(stylesSrcDir)) {
  const src = path.join(stylesSrcDir, name);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(stylesOutDir, name));
  }
}
```

Note: later phases may add `assets/styles/pages/` — when that happens, the copy logic can be upgraded to walk subdirectories. Phase 1 keeps it flat.

- [ ] **Step 4: Trim `styles.css` of the rules the new files replace**

Delete from `web/client/styles.css` all rules whose selectors are now styled by `tokens.css` / `base.css` / `components.css` / `shell.css`. Specifically remove: `:root`, `body` (the base reset/font rules), `.btn*`, and any `#workspace`/`#sidebar-left`/`#topbar` layout rules. Keep startup/setup/dialog/audit/log/tree styles. After the edit, `web/client/styles.css` should contain only selectors scoped to legacy elements still present inside `#chat-legacy`, `#startup-shell`, and `#settings-dialog`.

Verify with grep that the file no longer defines `--primary` or `body {`:

Run: `grep -E "^--primary|^body\\s*\\{" web/client/styles.css` (expect no output).

- [ ] **Step 5: Type-check and build**

Run:
```bash
npx tsc --noEmit
npm --prefix web install
npm --prefix web run build
```

Expected:
- `tsc` passes (no new errors; pre-existing errors count must not increase).
- `web/build-client.mjs` logs `✓ client bundled to …/dist/client`.
- `web/dist/client/assets/styles/tokens.css` exists.

- [ ] **Step 6: Run unit tests**

Run: `npm test`

Expected: PASS. Three new suites (`web-icon`, `web-router`, `web-rail`) pass. No previously-passing suite regresses.

- [ ] **Step 7: Commit**

```bash
git add web/client/index.html web/client/main.ts web/client/styles.css web/build-client.mjs
git commit -m "feat(web): mount new shell and route legacy view under #/chat"
```

---

## Task 9: Manual smoke check + completion

**Files:**
- No new files. Manual verification only.

- [ ] **Step 1: Start the web server and open it in the browser**

Run:
```bash
npm run web:build
npm run web:start
```

Open `http://localhost:<port>/` (the port is printed in the console, typically 4174).

- [ ] **Step 2: Smoke checklist**

- Startup / Welcome screen renders with the new color palette (no purple gradient background, off-white `#F7F7FB` body).
- After completing setup, the workspace shell shows three visible regions: rail (left, 64px, five icons), browser panel (280px, `wiki`/`raw` pills + search + tree), main area (article view).
- Clicking rail icon `检查` swaps the main area to the placeholder titled "检查 · 即将推出"; the browser panel remains visible.
- Clicking rail icon `设置` hides the browser panel (full-width main placeholder titled "设置 · 即将推出").
- Clicking rail icon `对话` returns to the legacy article view and the browser panel returns.
- URL hash updates to `#/chat`, `#/check`, etc. as navigation occurs.
- Opening a file from the tree in `#/chat` still loads the article (legacy behavior preserved).

If any item fails, fix it before continuing.

- [ ] **Step 3: Final checks**

Run:
```bash
npx tsc --noEmit
npm test
npm run web:build
```

All three must succeed.

- [ ] **Step 4: Commit any trailing fix-ups**

If the smoke check required small edits, commit them as `fix(web): …` before finishing the phase. Otherwise no further commit is needed.

- [ ] **Step 5: Mark the phase complete**

Append a line to the `## Delivery Phasing` section of `docs/superpowers/specs/2026-04-17-web-ui-redesign-design.md`:

```
> Phase 1 completed 2026-04-17 — commits <first>..<last>.
```

Commit:
```bash
git add docs/superpowers/specs/2026-04-17-web-ui-redesign-design.md
git commit -m "docs(spec): mark web ui redesign phase 1 complete"
```

---

## Out-of-scope for Phase 1 (reminders)

These land in later phases, not here:

- Page drawer (Phase 2).
- Multi-select mode in the browser panel (Phase 2).
- Real chat composer / conversation list / LLM wiring (Phase 3).
- Check / Sync run surfaces and SSE (Phase 4).
- Review merged item list (Phase 5).
- Settings view (dialog → full view) (Phase 6).
- Playwright E2E harness (Phase 7 polish).
