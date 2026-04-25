// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWikiPage } from "../web/client/src/pages/wiki/index.js";

describe("wiki page comments", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installWikiStyles();
  });

  it("starts with the comments drawer closed and toggles it without creating a comment", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              children: [{ name: "test.md", path: "wiki/concepts/test.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/test.md",
          title: "Test",
          html: "<h1>Test</h1><p id=\"wiki-target\">Alpha Beta Gamma</p>",
          raw: "# Test\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-24T00:00:00.000Z",
        });
      }
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Ftest.md") {
        return ok([
          {
            id: "comment-1",
            path: "wiki/concepts/test.md",
            quote: "Beta",
            text: "共享评论",
            start: 10,
            end: 14,
            resolved: false,
            createdAt: "2026-04-24T00:00:00.000Z",
          },
        ]);
      }
      if (url === "/api/wiki-comments" && init?.method === "POST") {
        return ok({
          id: "comment-2",
          path: "wiki/concepts/test.md",
          quote: "Gamma",
          text: "",
          start: 11,
          end: 16,
          resolved: false,
          createdAt: "2026-04-24T00:05:00.000Z",
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const page = renderWikiPage("wiki/concepts/test.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Beta");
    await waitForText(page, "共享评论");

    expect(page.querySelector("[data-feedback-submit]")).toBeNull();
    expect(page.querySelector("[data-wiki-comments-add]")).toBeNull();
    expect(page.textContent).toContain("共享评论");
    expect(page.querySelector("[data-wiki-comments-highlight=\"comment-1\"]")?.textContent).toBe("Beta");

    const commentsPanel = page.querySelector(".wiki-page__comments") as HTMLElement;
    const article = page.querySelector<HTMLElement>("[data-wiki-article]")!;
    const articleMarkupBeforeToggle = article.innerHTML;
    expect(commentsPanel.hidden).toBe(true);

    const commentsButton = page.querySelector<HTMLButtonElement>("[data-wiki-comment-action]");
    commentsButton?.click();
    await flush();

    const fetchMock = vi.mocked(fetch);
    expect(commentsPanel.hidden).toBe(false);
    expect(article.innerHTML).toBe(articleMarkupBeforeToggle);
    expect(fetchMock.mock.calls.some(([call]) => String(call) === "/api/wiki-comments?path=wiki%2Fconcepts%2Ftest.md")).toBe(true);
    expect(fetchMock.mock.calls.some(([call, options]) =>
      String(call) === "/api/wiki-comments" && options?.method === "POST",
    )).toBe(false);

    commentsButton?.click();

    expect(commentsPanel.hidden).toBe(true);
    expect(article.innerHTML).toBe(articleMarkupBeforeToggle);
  });

  it("keeps the toc and comments drawer from remaining open together", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
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
              children: [{ name: "test.md", path: "wiki/concepts/test.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/test.md",
          title: "Test",
          html: "<h1>Test</h1><h2>Overview</h2><p>Alpha Beta Gamma</p>",
          raw: "# Test\n\n## Overview\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-24T00:00:00.000Z",
        });
      }
      if (url.startsWith("/api/wiki-comments?path=")) {
        return ok([]);
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const page = renderWikiPage("wiki/concepts/test.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const commentsButton = page.querySelector<HTMLButtonElement>("[data-wiki-comment-action]");
    const commentsPanel = page.querySelector<HTMLElement>("[data-wiki-comments-status]")?.closest<HTMLElement>(".wiki-page__comments");
    const tocToggle = page.querySelector<HTMLButtonElement>("[data-wiki-toc-toggle]");
    const tocPanel = page.querySelector<HTMLElement>("[data-wiki-toc-panel]");

    tocToggle?.click();
    expect(tocPanel?.hidden).toBe(false);

    commentsButton?.click();
    await flush();

    expect(commentsPanel?.hidden).toBe(false);
    expect(tocPanel?.hidden).toBe(true);

    tocToggle?.click();

    expect(tocPanel?.hidden).toBe(false);
    expect(commentsPanel?.hidden).toBe(true);
  });

  it("shows a friendly error for non-json comment responses and closes the comments panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
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
              children: [{ name: "broken.md", path: "wiki/concepts/broken.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/broken.md",
          title: "Broken",
          html: "<h1>Broken</h1><p>Alpha Beta Gamma</p>",
          raw: "# Broken\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-24T00:00:00.000Z",
        });
      }
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

    const page = renderWikiPage("wiki/concepts/broken.md");
    document.body.appendChild(page);
    await waitForText(page, "评论服务暂时不可用");

    expect(page.textContent).toContain("评论服务暂时不可用");

    const commentsPanel = page.querySelector(".wiki-page__comments") as HTMLElement;
    expect(commentsPanel.hidden).toBe(true);

    page.querySelector<HTMLButtonElement>("[data-wiki-comment-action]")?.click();

    expect(commentsPanel.hidden).toBe(false);

    page.querySelector<HTMLButtonElement>("[data-wiki-comments-close]")?.click();

    expect(commentsPanel.hidden).toBe(true);
  });

  it("creates a comment draft from the preserved toolbar selection and opens the drawer", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              children: [{ name: "draft.md", path: "wiki/concepts/draft.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/draft.md",
          title: "Draft",
          html: "<h1>Draft</h1><p id=\"wiki-target\">Alpha Beta Gamma</p>",
          raw: "# Draft\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-24T00:00:00.000Z",
        });
      }
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Fdraft.md") {
        return ok([]);
      }
      if (url === "/api/wiki-comments" && init?.method === "POST") {
        return ok({
          id: "comment-2",
          path: "wiki/concepts/draft.md",
          quote: "Beta",
          text: "",
          start: 11,
          end: 15,
          resolved: false,
          createdAt: "2026-04-24T00:05:00.000Z",
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const page = renderWikiPage("wiki/concepts/draft.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Alpha Beta Gamma");

    const textNode = page.querySelector("#wiki-target")?.lastChild;
    const range = document.createRange();
    range.setStart(textNode!, 6);
    range.setEnd(textNode!, 10);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]");
    const toolbarAction = page.querySelector<HTMLButtonElement>("[data-wiki-selection-comment]");
    const commentsPanel = page.querySelector(".wiki-page__comments") as HTMLElement;
    const tocToggle = page.querySelector<HTMLButtonElement>("[data-wiki-toc-toggle]");
    const tocPanel = page.querySelector<HTMLElement>("[data-wiki-toc-panel]");
    const commentStatus = page.querySelector<HTMLElement>("[data-wiki-comments-status]")!;

    expect(toolbar?.hidden).toBe(false);
    selection.removeAllRanges();
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    tocToggle?.click();
    expect(tocPanel?.hidden).toBe(false);

    toolbarAction?.click();
    await waitForCondition(() => commentStatus.textContent?.includes("评论已创建") === true);

    const fetchMock = vi.mocked(fetch);
    const createCall = fetchMock.mock.calls.find(([call, options]) =>
      String(call) === "/api/wiki-comments" && options?.method === "POST",
    );

    expect(createCall).toBeTruthy();
    expect(createCall?.[1]?.body).toBe(JSON.stringify({
      path: "wiki/concepts/draft.md",
      quote: "Beta",
      text: "",
      start: 11,
      end: 15,
    }));
    expect(toolbar?.hidden).toBe(true);
    expect(commentsPanel.hidden).toBe(false);
    expect(tocPanel?.hidden).toBe(true);
    expect(document.activeElement).toBe(page.querySelector("[data-wiki-comments-input=\"comment-2\"]"));
  });

  it("saves and deletes comments through the drawer controls", async () => {
    let comments = [
      {
        id: "comment-1",
        path: "wiki/concepts/editable.md",
        quote: "Beta",
        text: "初始评论",
        start: 6,
        end: 10,
        resolved: false,
        createdAt: "2026-04-24T00:00:00.000Z",
      },
    ];

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              children: [{ name: "editable.md", path: "wiki/concepts/editable.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/editable.md",
          title: "Editable",
          html: "<h1>Editable</h1><p>Alpha Beta Gamma</p>",
          raw: "# Editable\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-24T00:00:00.000Z",
        });
      }
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Feditable.md") {
        return ok(comments);
      }
      if (url === "/api/wiki-comments/comment-1" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { text: string };
        comments = comments.map((comment) =>
          comment.id === "comment-1"
            ? { ...comment, text: body.text }
            : comment,
        );
        return ok(comments[0]);
      }
      if (url === "/api/wiki-comments/comment-1?path=wiki%2Fconcepts%2Feditable.md" && init?.method === "DELETE") {
        comments = [];
        return ok(null);
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const page = renderWikiPage("wiki/concepts/editable.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Alpha Beta Gamma");
    await waitForText(page, "初始评论");

    page.querySelector<HTMLButtonElement>("[data-wiki-comment-action]")?.click();
    await flush();

    const textarea = page.querySelector<HTMLTextAreaElement>("[data-wiki-comments-input=\"comment-1\"]")!;
    const saveButton = page.querySelector<HTMLButtonElement>("[data-wiki-comments-save]")!;
    const deleteButton = page.querySelector<HTMLButtonElement>("[data-wiki-comments-delete]")!;

    textarea.value = "已更新的评论";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    saveButton.click();

    const fetchMock = vi.mocked(fetch);
    await waitForCondition(() => fetchMock.mock.calls.some(([call, options]) =>
      String(call) === "/api/wiki-comments/comment-1" && options?.method === "PATCH",
    ));

    const patchCall = fetchMock.mock.calls.find(([call, options]) =>
      String(call) === "/api/wiki-comments/comment-1" && options?.method === "PATCH",
    );

    expect(patchCall).toBeTruthy();
    expect(patchCall?.[1]?.body).toBe(JSON.stringify({
      path: "wiki/concepts/editable.md",
      text: "已更新的评论",
    }));
    await waitForCondition(() =>
      page.querySelector<HTMLTextAreaElement>("[data-wiki-comments-input=\"comment-1\"]")?.value === "已更新的评论",
    );

    deleteButton.click();

    await waitForCondition(() => fetchMock.mock.calls.some(([call, options]) =>
      String(call) === "/api/wiki-comments/comment-1?path=wiki%2Fconcepts%2Feditable.md" && options?.method === "DELETE",
    ));

    const deleteCall = fetchMock.mock.calls.find(([call, options]) =>
      String(call) === "/api/wiki-comments/comment-1?path=wiki%2Fconcepts%2Feditable.md" && options?.method === "DELETE",
    );

    expect(deleteCall).toBeTruthy();
    await waitForCondition(() => page.querySelector("[data-wiki-comments-card=\"comment-1\"]") === null);
    expect(page.querySelector("[data-wiki-comments-input]")).toBeNull();
  });

  it("shows AI auto resolve only for editable unresolved comments with text", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
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
              children: [{ name: "editable.md", path: "wiki/concepts/editable.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/editable.md",
          title: "Editable",
          html: "<h1>Editable</h1><p>Alpha Beta Gamma</p>",
          raw: "# Editable\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-25T00:00:00.000Z",
          sourceEditable: true,
        });
      }
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Feditable.md") {
        return ok([
          {
            id: "comment-eligible",
            path: "wiki/concepts/editable.md",
            quote: "Beta",
            text: "把这里改成更具体的描述。",
            start: 6,
            end: 10,
            resolved: false,
            createdAt: "2026-04-25T00:00:00.000Z",
          },
          {
            id: "comment-empty",
            path: "wiki/concepts/editable.md",
            quote: "Gamma",
            text: "",
            start: 11,
            end: 16,
            resolved: false,
            createdAt: "2026-04-25T00:01:00.000Z",
          },
          {
            id: "comment-resolved",
            path: "wiki/concepts/editable.md",
            quote: "Alpha",
            text: "这个评论已经处理过。",
            start: 0,
            end: 5,
            resolved: true,
            createdAt: "2026-04-25T00:02:00.000Z",
          },
        ]);
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const page = renderWikiPage("wiki/concepts/editable.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Alpha Beta Gamma");
    await waitForText(page, "把这里改成更具体的描述。");

    page.querySelector<HTMLButtonElement>("[data-wiki-comment-action]")?.click();
    await flush();

    expect(findButtonsByText(page, "AI自动解决")).toHaveLength(1);
    expect(page.querySelector("[data-wiki-comments-card=\"comment-eligible\"]")?.textContent).toContain("AI自动解决");
    expect(page.querySelector("[data-wiki-comments-card=\"comment-empty\"]")?.textContent).not.toContain("AI自动解决");
    expect(page.querySelector("[data-wiki-comments-card=\"comment-resolved\"]")?.textContent).not.toContain("AI自动解决");
  });

  it("renders diff review after AI resolve and refreshes the article from confirm data.page", async () => {
    let commentResolved = false;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              children: [{ name: "editable.md", path: "wiki/concepts/editable.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/editable.md",
          title: "Editable",
          html: "<h1>Editable</h1><p id=\"wiki-target\">Alpha Beta Gamma</p>",
          raw: "# Editable\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-25T00:00:00.000Z",
          sourceEditable: true,
        });
      }
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Feditable.md") {
        return ok([
          {
            id: "comment-1",
            path: "wiki/concepts/editable.md",
            quote: "Beta",
            text: "把 Beta 改成 Better。",
            start: 6,
            end: 10,
            resolved: commentResolved,
            createdAt: "2026-04-25T00:00:00.000Z",
          },
        ]);
      }
      if (url === "/api/wiki-comments/comment-1/ai-draft" && init?.method === "POST") {
        return ok({
          id: "draft-1",
          commentId: "comment-1",
          pagePath: "wiki/concepts/editable.md",
          status: "done-await-confirm",
          diffText: [
            "--- current",
            "+++ proposed",
            "@@",
            "-# Editable",
            "-",
            "-Alpha Beta Gamma",
            "+# Editable",
            "+",
            "+Alpha Better Gamma",
          ].join("\n"),
        });
      }
      if (url === "/api/wiki-comments/comment-1/ai-draft/draft-1/confirm" && init?.method === "POST") {
        commentResolved = true;
        return ok({
          id: "draft-1",
          pagePath: "wiki/concepts/editable.md",
          page: {
            path: "wiki/concepts/editable.md",
            title: "Editable",
            html: "<h1>Editable</h1><p id=\"wiki-target\">Alpha Better Gamma</p>",
            raw: "# Editable\n\nAlpha Better Gamma",
            frontmatter: null,
            modifiedAt: "2026-04-25T00:10:00.000Z",
            sourceEditable: true,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const page = renderWikiPage("wiki/concepts/editable.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Alpha Beta Gamma");
    await waitForText(page, "把 Beta 改成 Better。");

    page.querySelector<HTMLButtonElement>("[data-wiki-comment-action]")?.click();
    await flush();

    const aiResolveButton = findButtonsByText(page, "AI自动解决")[0];
    expect(aiResolveButton).toBeTruthy();
    aiResolveButton?.click();

    await waitForText(page, "+++ proposed");

    const confirmButton = findButtonsByText(page, "确认写入")[0];
    expect(confirmButton).toBeTruthy();
    confirmButton?.click();

    await waitForCondition(() =>
      page.querySelector<HTMLElement>("[data-wiki-article]")?.textContent?.includes("Alpha Better Gamma") === true,
    );
    expect(page.querySelector<HTMLElement>("[data-wiki-article]")?.textContent).toContain("Alpha Better Gamma");
    expect(page.querySelector<HTMLElement>("[data-wiki-article]")?.textContent).not.toContain("Alpha Beta Gamma");
    await waitForText(page, "评论已解决");
  });

  it("does not show AI auto resolve on runtime-only wiki pages", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
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
              children: [{ name: "runtime-only.md", path: "wiki/concepts/runtime-only.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/runtime-only.md",
          title: "Runtime only",
          html: "<h1>Runtime only</h1><p>Alpha Beta Gamma</p>",
          raw: "# Runtime only\n\nAlpha Beta Gamma",
          frontmatter: null,
          modifiedAt: "2026-04-25T00:00:00.000Z",
          sourceEditable: false,
        });
      }
      if (url === "/api/wiki-comments?path=wiki%2Fconcepts%2Fruntime-only.md") {
        return ok([
          {
            id: "comment-1",
            path: "wiki/concepts/runtime-only.md",
            quote: "Beta",
            text: "即使评论有内容，runtime-only 页面也不能 AI 自动解决。",
            start: 6,
            end: 10,
            resolved: false,
            createdAt: "2026-04-25T00:00:00.000Z",
          },
        ]);
      }
      throw new Error(`unexpected fetch ${url}`);
    }));

    const page = renderWikiPage("wiki/concepts/runtime-only.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Alpha Beta Gamma");
    await waitForText(page, "runtime-only 页面也不能 AI 自动解决");

    page.querySelector<HTMLButtonElement>("[data-wiki-comment-action]")?.click();
    await flush();

    expect(findButtonsByText(page, "AI自动解决")).toHaveLength(0);
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

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) {
      return;
    }
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for condition");
}

function installWikiStyles(): void {
  const existing = document.head.querySelector("[data-test-wiki-styles]");
  if (existing) {
    existing.remove();
  }
  const style = document.createElement("style");
  style.dataset.testWikiStyles = "true";
  style.textContent = readFileSync(
    resolve(__dirname, "../web/client/assets/styles/wiki-launch.css"),
    "utf8",
  );
  document.head.appendChild(style);
}

function findButtonsByText(root: ParentNode, text: string): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
    .filter((button) => button.textContent?.includes(text) === true);
}
