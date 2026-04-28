// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDrawer } from "../web/client/src/shell/drawer.js";

describe("drawer wiki comments", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = `
      <section id="workspace-shell" data-drawer-open="false">
        <aside id="drawer-slot"></aside>
      </section>
    `;
  });

  it("removes feedback UI and uses shared wiki comments for the preview page", async () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer-slot") as HTMLElement;
    const onNavigate = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Ftest.md") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "comment-1",
                path: "wiki/concepts/test.md",
                quote: "Beta",
                text: "已有评论",
                start: 6,
                end: 10,
                resolved: false,
                createdAt: "2026-04-24T00:00:00.000Z",
              },
            ],
          }),
        } as Response;
      }
      if (url === "/api/wiki-comments" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "comment-2",
              path: "wiki/concepts/test.md",
              quote: "Gamma",
              text: "",
              start: 11,
              end: 16,
              resolved: false,
              createdAt: "2026-04-24T00:05:00.000Z",
            },
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const drawer = createDrawer({ shellRoot, container, onNavigate });
    drawer.open({
      path: "wiki/concepts/test.md",
      title: "Test",
      html: "<p>Alpha Beta Gamma</p>",
      rawMarkdown: "Alpha Beta Gamma",
    });
    await flush();
    await flush();

    expect(container.querySelector("[data-feedback-submit]")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/wiki-comments?path=wiki%2Fconcepts%2Ftest.md");
    expect(container.textContent).toContain("已有评论");
    expect(container.querySelector("[data-wiki-comments-highlight=\"comment-1\"]")?.textContent).toBe("Beta");

    const body = container.querySelector(".shell-drawer__body") as HTMLElement;
    const textNode = body.querySelector("p")?.lastChild;
    const range = document.createRange();
    range.setStart(textNode!, 1);
    range.setEnd(textNode!, 6);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    container.querySelector<HTMLButtonElement>("[data-wiki-comments-add]")?.click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/wiki-comments", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }));
    const payload = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string);
    expect(payload).toMatchObject({
      path: "wiki/concepts/test.md",
      quote: "Gamma",
      start: 11,
      end: 16,
    });
  });

  it("shows a friendly error when the comments endpoint returns html and lets the panel close", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Fbroken.md") {
        return {
          ok: true,
          headers: {
            get: (name: string) => name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null,
          },
          text: async () => "<!DOCTYPE html><html></html>",
        } as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer-slot") as HTMLElement;
    const drawer = createDrawer({ shellRoot, container, onNavigate: vi.fn() });
    drawer.open({
      path: "wiki/concepts/broken.md",
      title: "Broken",
      html: "<p>Alpha Beta Gamma</p>",
    });
    await flush();
    await flush();

    expect(container.textContent).toContain("评论服务暂时不可用");

    const commentsPanel = container.querySelector(".shell-drawer__comments") as HTMLElement;
    expect(commentsPanel.hidden).toBe(false);

    container.querySelector<HTMLButtonElement>("[data-wiki-comments-close]")?.click();

    expect(commentsPanel.hidden).toBe(true);
  });
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
