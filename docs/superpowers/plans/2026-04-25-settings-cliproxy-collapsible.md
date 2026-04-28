# Settings CLIProxyAPI Collapsible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `CLIProxyAPI` settings card render as a default-collapsed section in the `LLM 大模型` page while preserving all existing Codex/OAuth controls after expansion.

**Architecture:** Keep the current settings page structure and data flow intact. Add a small collapsed-state wrapper around the existing `CLIProxyAPI` content in `web/client/src/pages/settings/index.ts`, style the new header/body states in `web/client/styles.css`, and verify the behavior through focused DOM tests in `test/web-settings-page.test.ts`.

**Tech Stack:** TypeScript, DOM rendering, CSS, Vitest, jsdom

---

### Task 1: Add failing tests for the collapsed card

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/test/web-settings-page.test.ts`
- Test: `D:/Desktop/llm-wiki-compiler-main/test/web-settings-page.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it("renders CLIProxyAPI as a collapsed advanced section by default", () => {
    const page = renderSettingsPage();
    const toggle = page.querySelector<HTMLButtonElement>("[data-cliproxy-toggle]");
    const body = page.querySelector<HTMLElement>("[data-cliproxy-body]");

    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(body?.hidden).toBe(true);
    expect(page.querySelector("[data-cliproxy-install]")).toBeNull();
    expect(page.querySelector("[data-cliproxy-oauth=\"codex\"]")).toBeNull();
    expect(page.textContent).toContain("Codex");
    expect(page.textContent).toContain("OAuth");
  });

  it("expands the CLIProxyAPI section when the toggle is clicked", () => {
    const page = renderSettingsPage();
    const toggle = page.querySelector<HTMLButtonElement>("[data-cliproxy-toggle]");
    const body = page.querySelector<HTMLElement>("[data-cliproxy-body]");

    toggle?.click();

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(body?.hidden).toBe(false);
    expect(page.querySelector("[data-cliproxy-install]")?.textContent).toContain("安装");
    expect(page.querySelector("[data-cliproxy-oauth=\"codex\"]")?.textContent).toContain("Codex");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk test npx vitest run test/web-settings-page.test.ts --testNamePattern "collapsed advanced section|expands the CLIProxyAPI section"`

Expected: FAIL because `data-cliproxy-toggle` and `data-cliproxy-body` do not exist yet, and the card still renders expanded content by default.

- [ ] **Step 3: Inspect the test-only diff**

```bash
git diff -- test/web-settings-page.test.ts
```

### Task 2: Implement the collapsed card in the settings page

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/src/pages/settings/index.ts`
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/client/styles.css`
- Test: `D:/Desktop/llm-wiki-compiler-main/test/web-settings-page.test.ts`

- [ ] **Step 1: Write the minimal TypeScript and markup**

```ts
function renderCLIProxyPanel(): string {
  return `
    <article class="settings-card settings-card--cliproxy">
      <div class="settings-card__header settings-card__header--collapsible">
        <div>
          <div class="eyebrow">CLIPROXYAPI</div>
          <h2>Wiki 内置代理与多账号</h2>
          <p class="settings-card__hint">用于 Codex、OAuth、多账号和本地代理统一出口。</p>
        </div>
        <button
          type="button"
          class="settings-card__toggle"
          data-cliproxy-toggle
          aria-expanded="false"
          aria-controls="settings-cliproxy-body"
        >
          <span data-cliproxy-toggle-icon>›</span>
          <span>展开</span>
        </button>
      </div>
      <div id="settings-cliproxy-body" data-cliproxy-body hidden>
        ...
      </div>
    </article>
  `;
}

function bindCLIProxyControls(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("[data-cliproxy-toggle]")?.addEventListener("click", () => {
    toggleCLIProxySection(root);
  });
  ...
}

function toggleCLIProxySection(root: HTMLElement): void {
  const button = root.querySelector<HTMLButtonElement>("[data-cliproxy-toggle]");
  const body = root.querySelector<HTMLElement>("[data-cliproxy-body]");
  const icon = root.querySelector<HTMLElement>("[data-cliproxy-toggle-icon]");
  if (!button || !body) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  const nextExpanded = !expanded;
  button.setAttribute("aria-expanded", String(nextExpanded));
  body.hidden = !nextExpanded;
  if (icon) icon.textContent = nextExpanded ? "⌄" : "›";
}
```

- [ ] **Step 2: Style the collapsed and expanded states**

```css
.settings-card__header--collapsible {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.settings-card__hint {
  margin: 10px 0 0;
  color: var(--muted-foreground);
}

.settings-card__toggle {
  align-self: center;
}

.settings-card--cliproxy [data-cliproxy-body][hidden] {
  display: none;
}
```

- [ ] **Step 3: Run tests to verify the new behavior passes**

Run: `rtk test npx vitest run test/web-settings-page.test.ts --testNamePattern "collapsed advanced section|expands the CLIProxyAPI section|renders LLM provider cards|manages CLIProxyAPI"`

Expected: PASS, proving the section starts collapsed, expands on click, and the existing CLIProxy flow still works after expansion.

- [ ] **Step 4: Inspect the implementation diff**

```bash
git diff -- web/client/src/pages/settings/index.ts web/client/styles.css test/web-settings-page.test.ts
```

### Task 3: Rebuild and verify the actual frontend artifact

**Files:**
- Modify: `D:/Desktop/llm-wiki-compiler-main/web/dist/client/*` (generated build output)
- Test: `D:/Desktop/llm-wiki-compiler-main/test/web-settings-page.test.ts`

- [ ] **Step 1: Run the focused test suite**

Run: `rtk test npx vitest run test/web-settings-page.test.ts`

Expected: PASS with the new collapsed-card coverage included.

- [ ] **Step 2: Run the TypeScript verification**

Run: `rtk tsc --noEmit`

Expected: PASS with no new TypeScript errors from the added toggle markup and handlers.

- [ ] **Step 3: Rebuild the frontend used by Electron/WebUI**

Run: `rtk proxy npm --prefix web run build`

Expected: PASS and regenerated `web/dist/client` assets that include the new collapsed `CLIProxyAPI` UI.

- [ ] **Step 4: Inspect the final generated diff**

```bash
git diff -- web/client/src/pages/settings/index.ts web/client/styles.css test/web-settings-page.test.ts web/dist/client
```
