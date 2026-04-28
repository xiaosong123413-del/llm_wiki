// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { renderWikiPage } from "../web/client/src/pages/wiki/index.js";

describe("wiki internal scroll layout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installWikiStyles();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/tree?")) {
        return ok({
          name: "wiki",
          path: "wiki",
          kind: "dir",
          children: [
            {
              name: "wiki",
              path: "wiki",
              kind: "dir",
              children: [{ name: "index.md", path: "wiki/index.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/index.md",
          title: "Index",
          html: "<h1>Index</h1><h2>Overview</h2>",
          raw: "# Index\n\n## Overview",
          frontmatter: null,
          modifiedAt: "2026-04-21T00:00:00.000Z",
        });
      }
      return ok({});
    }));
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = "";
    document.head.querySelector("[data-test-wiki-styles]")?.remove();
    window.location.hash = "";
    vi.unstubAllGlobals();
  });

  it("renders separate chrome and body wrappers with title in chrome and article content in body", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const chrome = page.querySelector<HTMLElement>("[data-wiki-chrome]");
    const body = page.querySelector<HTMLElement>("[data-wiki-body]");
    const title = page.querySelector<HTMLElement>("[data-wiki-title]");
    const article = page.querySelector<HTMLElement>("[data-wiki-article]");
    const search = page.querySelector<HTMLElement>("[data-wiki-search]");
    const tabs = page.querySelector<HTMLElement>(".wiki-page__tabs");
    const lead = page.querySelector<HTMLElement>(".wiki-page__lead");
    const articleLayout = page.querySelector<HTMLElement>(".wiki-page__article-layout");
    const modules = page.querySelector<HTMLElement>(".wiki-page__modules");

    expect(chrome).toBeTruthy();
    expect(body).toBeTruthy();
    expect(title).toBeTruthy();
    expect(article).toBeTruthy();
    expect(search).toBeTruthy();
    expect(tabs).toBeTruthy();
    expect(lead).toBeTruthy();
    expect(articleLayout).toBeTruthy();
    expect(modules).toBeTruthy();
    expect(chrome?.contains(title ?? null)).toBe(true);
    expect(chrome?.contains(search ?? null)).toBe(true);
    expect(chrome?.contains(tabs ?? null)).toBe(true);
    expect(body?.contains(lead ?? null)).toBe(true);
    expect(body?.contains(articleLayout ?? null)).toBe(true);
    expect(body?.contains(modules ?? null)).toBe(true);
    expect(body?.contains(article ?? null)).toBe(true);
    expect(chrome?.contains(article ?? null)).toBe(false);
  });

  it("keeps structural reading regions split between chrome and body wrappers", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const chrome = page.querySelector<HTMLElement>("[data-wiki-chrome]");
    const body = page.querySelector<HTMLElement>("[data-wiki-body]");
    const lead = page.querySelector<HTMLElement>(".wiki-page__lead");
    const articleLayout = page.querySelector<HTMLElement>(".wiki-page__article-layout");
    const modules = page.querySelector<HTMLElement>(".wiki-page__modules");

    expect(chrome).toBeTruthy();
    expect(body).toBeTruthy();
    expect(chrome?.classList.contains("wiki-page__chrome")).toBe(true);
    expect(body?.classList.contains("wiki-page__body")).toBe(true);
    expect(body?.contains(lead ?? null)).toBe(true);
    expect(body?.contains(articleLayout ?? null)).toBe(true);
    expect(body?.contains(modules ?? null)).toBe(true);
    expect(chrome?.contains(lead ?? null)).toBe(false);
    expect(chrome?.contains(articleLayout ?? null)).toBe(false);
    expect(chrome?.contains(modules ?? null)).toBe(false);
  });

  it("keeps article path and metadata in the scroll body instead of the chrome", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const chrome = page.querySelector<HTMLElement>("[data-wiki-chrome]");
    const body = page.querySelector<HTMLElement>("[data-wiki-body]");
    const path = page.querySelector<HTMLElement>("[data-wiki-path]");
    const meta = page.querySelector<HTMLElement>("[data-wiki-meta]");

    expect(chrome).toBeTruthy();
    expect(body).toBeTruthy();
    expect(path).toBeTruthy();
    expect(meta).toBeTruthy();
    expect(body?.contains(path ?? null)).toBe(true);
    expect(body?.contains(meta ?? null)).toBe(true);
    expect(chrome?.contains(path ?? null)).toBe(false);
    expect(chrome?.contains(meta ?? null)).toBe(false);
  });

  it("makes the left wiki sidebar a separate vertical scroll region", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const sidebar = page.querySelector<HTMLElement>(".wiki-page__sidebar");
    expect(sidebar).toBeTruthy();

    const styles = window.getComputedStyle(sidebar!);
    expect(styles.overflowY).toBe("auto");
    expect(styles.overflowX).toBe("hidden");
    expect(Number.parseFloat(styles.minHeight || "0")).toBe(0);
  });
});

function ok(data: unknown) {
  return {
    ok: true,
    json: async () => ({ success: true, data }),
  };
}

function rawOk(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
}

async function waitForText(node: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (node.textContent?.includes(text)) {
      return;
    }
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for text: ${text}`);
}

function installWikiStyles(): void {
  document.head.querySelector("[data-test-wiki-styles]")?.remove();
  const style = document.createElement("style");
  style.dataset.testWikiStyles = "true";
  style.textContent = readFileSync(
    resolve(__dirname, "../web/client/assets/styles/wiki-launch.css"),
    "utf8",
  );
  document.head.appendChild(style);
}
