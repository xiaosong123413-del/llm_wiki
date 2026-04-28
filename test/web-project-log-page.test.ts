// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderProjectLogPage } from "../web/client/src/pages/project-log/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("project log page", () => {
  it("loads the project log document as a full-width single column", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/project-log") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "docs/project-log.md",
                html: "<h1>Project Log</h1><h2>Current Interface</h2><h2>Current Flow</h2><h2>Timeline</h2>",
                raw: "# Project Log",
                modifiedAt: "2026-04-20T13:00:00.000Z",
              },
            }),
          } as Response;
        }

        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderProjectLogPage();
    document.body.appendChild(page);
    await flush();

    expect(fetch).toHaveBeenCalledWith("/api/project-log");
    expect(fetch).not.toHaveBeenCalledWith("/api/project-log/workspace");
    expect(page.querySelector(".project-log-page__title")?.textContent).toContain("项目日志");
    expect(page.querySelector("[data-project-log-content]")?.innerHTML).toContain("project-log-heading-2");
    expect(page.querySelector("[data-project-workspace]")).toBeNull();
    expect(page.querySelector(".project-log-page__layout")).toBeNull();
  });

  it("renders a sticky toolbar, resizable toc, and editable comments from a selection trigger", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/project-log") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "docs/project-log.md",
                html: "<h1>Project Log</h1><h2>Current Interface</h2><p id=\"target-text\">Commentable sentence.</p><h3>Dialogue Page</h3><h2>Timeline</h2>",
                raw: "# Project Log",
                modifiedAt: "2026-04-20T13:00:00.000Z",
              },
            }),
          } as Response;
        }

        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderProjectLogPage();
    document.body.appendChild(page);
    await flush();

    const toolbar = page.querySelector<HTMLElement>("[data-project-log-toolbar]");
    expect(toolbar).not.toBeNull();
    expect(toolbar?.className).toContain("project-log-page__toolbar");
    expect(page.getAttribute("style") ?? "").toContain("--project-log-comments-width");
    expect(page.querySelector("[data-project-log-comments-resize]")).not.toBeNull();
    expect(page.querySelector("[data-project-log-comment]")).toBeNull();

    page.querySelector<HTMLButtonElement>("[data-project-log-toc-toggle]")?.click();
    expect(page.querySelector("[data-project-log-toc-panel]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-project-log-toc-resize]")).not.toBeNull();
    expect(page.querySelectorAll(".project-log-page__toc-link").length).toBeGreaterThan(0);
    expect(page.querySelector(".project-log-page__toc-link--level-3")).not.toBeNull();

    const selectedText = page.querySelector("#target-text")?.firstChild;
    expect(selectedText).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(selectedText!);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));

    const selectionCommentButton = page.querySelector<HTMLButtonElement>("[data-project-log-selection-comment]");
    expect(selectionCommentButton).not.toBeNull();
    expect(selectionCommentButton?.hidden).toBe(false);

    selectionCommentButton?.click();
    const highlight = page.querySelector<HTMLElement>("[data-project-log-comment-highlight]");
    expect(highlight?.textContent).toContain("Commentable sentence.");
    expect(page.querySelector("[data-project-log-comments-panel]")?.hasAttribute("hidden")).toBe(false);

    const textarea = page.querySelector<HTMLTextAreaElement>("[data-project-log-comment-input]");
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
    textarea!.value = "Need more context.";
    page.querySelector<HTMLButtonElement>("[data-project-log-comment-save]")?.click();
    expect(page.querySelector("[data-project-log-comments-list]")?.textContent).toContain("Need more context.");

    page.querySelector<HTMLButtonElement>("[data-project-log-comment-resolve]")?.click();
    page.querySelector<HTMLButtonElement>("[data-project-log-filter=\"open\"]")?.click();
    expect(page.querySelector("[data-project-log-comments-list]")?.textContent).not.toContain("Need more context.");
    page.querySelector<HTMLButtonElement>("[data-project-log-filter=\"resolved\"]")?.click();
    expect(page.querySelector("[data-project-log-comments-list]")?.textContent).toContain("Need more context.");
    const deleteButton = page.querySelector<HTMLButtonElement>("[data-project-log-comment-delete]");
    expect(deleteButton).not.toBeNull();
    deleteButton?.click();
  });

  it("defines the project log page as the scroll container inside the full-page shell", () => {
    const stylesheet = readFileSync(
      path.resolve(import.meta.dirname, "../web/client/styles.css"),
      "utf8",
    );

    expect(stylesheet).toContain("#workspace-shell[data-full-page] .shell-main");
    expect(stylesheet).toContain("overflow: hidden;");
    expect(stylesheet).toMatch(/\.project-log-page\s*\{[\s\S]*height:\s*100%;/);
    expect(stylesheet).toMatch(/\.project-log-page\s*\{[\s\S]*min-height:\s*0;/);
    expect(stylesheet).toMatch(/\.project-log-page\s*\{[\s\S]*overflow-y:\s*auto;/);
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
