// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { renderWikiPage } from "../web/client/src/pages/wiki/index.js";

describe("wiki page search", () => {
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
              children: [
                { name: "index.md", path: "wiki/index.md", kind: "file" },
              ],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/index.md",
          title: "Index",
          html: "<h1>Index</h1><h2>Overview</h2><h3>Details</h3>",
          raw: "# Index\n\n## Overview\n\n### Details",
          frontmatter: null,
          modifiedAt: "2026-04-21T00:00:00.000Z",
        });
      }
      if (url.includes("/api/search?")) {
        return ok({
          scope: "local",
          mode: "hybrid",
          local: {
            mode: "hybrid",
            results: [
              {
                id: "concept-ai",
                path: "wiki/concepts/ai.md",
                title: "AI",
                layer: "wiki",
                excerpt: "人工智能相关页面",
                tags: ["AI"],
                modifiedAt: "2026-04-21T00:00:00.000Z",
              },
            ],
          },
          web: { configured: false, results: [] },
        });
      }
      return ok({});
    }));
  });

  it("submits wiki search through the unified local search endpoint", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const input = page.querySelector<HTMLInputElement>("[data-wiki-search-input]");
    const form = page.querySelector<HTMLFormElement>("[data-wiki-search]");
    expect(input).toBeTruthy();
    expect(form).toBeTruthy();
    input!.value = "人工智能";
    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "人工智能相关页面");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([call]) => String(call).includes("/api/search?"))).toBe(true);
    expect(fetchMock.mock.calls.some(([call]) => String(call).includes("scope=local"))).toBe(true);
    expect(page.textContent).toContain("搜索：人工智能");
    expect(page.textContent).toContain("AI");
    expect(page.textContent).toContain("人工智能相关页面");
  });
  it("renders a collapsible article toc from headings", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const tocToggle = page.querySelector<HTMLButtonElement>("[data-wiki-toc-toggle]");
    const tocPanel = page.querySelector<HTMLElement>("[data-wiki-toc-panel]");
    const tocList = page.querySelector<HTMLElement>("[data-wiki-toc-list]");

    expect(tocToggle?.disabled).toBe(false);
    expect(tocPanel?.hidden).toBe(true);

    tocToggle?.click();

    expect(tocPanel?.hidden).toBe(false);
    expect(tocList?.textContent).toContain("Index");
    expect(tocList?.textContent).toContain("Overview");
    expect(tocList?.textContent).toContain("Details");
  });

  it("renders separate page mode and reading tool groups in the top tool row", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const pageModeGroup = page.querySelector<HTMLElement>("[data-wiki-page-mode-group]");
    const readingToolsGroup = page.querySelector<HTMLElement>("[data-wiki-reading-tools-group]");
    const articleTab = pageModeGroup?.querySelector("a[aria-current='page']");
    const talkAction = pageModeGroup?.querySelector<HTMLButtonElement>("[data-wiki-action='talk']");
    const readTab = readingToolsGroup?.querySelector("a[aria-current='page']");
    const tocToggle = readingToolsGroup?.querySelector<HTMLButtonElement>("[data-wiki-toc-toggle]");
    const commentAction = readingToolsGroup?.querySelector<HTMLButtonElement>("[data-wiki-comment-action]");

    expect(pageModeGroup).toBeTruthy();
    expect(readingToolsGroup).toBeTruthy();
    expect(articleTab?.textContent).toBe("Article");
    expect(talkAction?.textContent).toBe("Talk");
    expect(readTab?.textContent).toBe("Read");
    expect(tocToggle?.textContent).toBe("目录");
    expect(commentAction?.textContent).toBe("Comment");
    expect(pageModeGroup?.querySelector("[data-wiki-toc-toggle]")).toBeNull();
    expect(pageModeGroup?.querySelector("[data-wiki-comment-action]")).toBeNull();
    expect(readingToolsGroup?.querySelector("[data-wiki-action='talk']")).toBeNull();
  });

  it("renders the wiki brand as a link to the about-me page", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const brandLink = page.querySelector<HTMLAnchorElement>("[data-wiki-brand-link]");
    expect(brandLink).toBeTruthy();
    expect(brandLink?.getAttribute("href")).toBe("#/wiki/wiki%2Fabout-me.md");
  });

  it("reveals the selection comment toolbar only for article text selections", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]");
    expect(toolbar?.hidden).toBe(true);

    const headingText = page.querySelector("[data-wiki-article] h2")?.firstChild;
    const range = document.createRange();
    range.setStart(headingText!, 0);
    range.setEnd(headingText!, 4);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    expect(toolbar?.hidden).toBe(false);

    selection.removeAllRanges();
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    expect(toolbar?.hidden).toBe(true);
  });

  it("renders comment copy and cancel actions in the selection toolbar", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const headingText = page.querySelector("[data-wiki-article] h2")?.firstChild;
    const range = document.createRange();
    range.setStart(headingText!, 0);
    range.setEnd(headingText!, 4);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]");
    expect(toolbar?.hidden).toBe(false);
    expect(toolbar?.textContent).toContain("评论");
    expect(toolbar?.textContent).toContain("复制");
    expect(toolbar?.textContent).toContain("取消");
  });

  it("copies the current selection from the toolbar and dismisses it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const headingText = page.querySelector("[data-wiki-article] h2")?.firstChild;
    const range = document.createRange();
    range.setStart(headingText!, 0);
    range.setEnd(headingText!, 4);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]");
    page.querySelector<HTMLButtonElement>("[data-wiki-selection-copy]")?.click();
    await waitForCondition(() => writeText.mock.calls.length > 0);

    expect(writeText).toHaveBeenCalledWith("Over");
    expect(toolbar?.hidden).toBe(true);
    expect(selection.rangeCount).toBe(0);
  });

  it("cancels the current selection from the toolbar", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const headingText = page.querySelector("[data-wiki-article] h2")?.firstChild;
    const range = document.createRange();
    range.setStart(headingText!, 0);
    range.setEnd(headingText!, 4);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]");
    page.querySelector<HTMLButtonElement>("[data-wiki-selection-cancel]")?.click();

    expect(toolbar?.hidden).toBe(true);
    expect(selection.rangeCount).toBe(0);
  });

  it("anchors the selection comment toolbar to the live range rect", async () => {
    const rangeRect = createDomRect({ left: 120, top: 160, width: 80, height: 24 });
    const originalDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => rangeRect,
    });

    try {
      const page = renderWikiPage("wiki/concepts/index.md");
      document.body.appendChild(page);
      await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

      const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]");
      const headingText = page.querySelector("[data-wiki-article] h2")?.firstChild;
      const range = document.createRange();
      range.setStart(headingText!, 0);
      range.setEnd(headingText!, 4);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      await flush();

      expect(toolbar?.hidden).toBe(false);
      expect(toolbar?.style.left).toBe("160px");
      expect(toolbar?.style.top).toBe("148px");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Range.prototype, "getBoundingClientRect", originalDescriptor);
      } else {
        delete (Range.prototype as Range & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
      }
    }
  });

  it("keeps the selection toolbar on-screen near viewport edges", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 300,
    });

    const originalRangeDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");

    try {
      const page = renderWikiPage("wiki/concepts/index.md");
      document.body.appendChild(page);
      await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

      const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]")!;
      vi.spyOn(toolbar, "getBoundingClientRect").mockImplementation(() =>
        toolbar.hidden
          ? createDomRect({ left: 0, top: 0, width: 0, height: 36 })
          : createDomRect({ left: 0, top: 0, width: 220, height: 36 }),
      );

      const headingText = page.querySelector("[data-wiki-article] h2")?.firstChild;
      const range = document.createRange();
      range.setStart(headingText!, 0);
      range.setEnd(headingText!, 4);
      const selection = window.getSelection()!;

      Object.defineProperty(Range.prototype, "getBoundingClientRect", {
        configurable: true,
        value: () => createDomRect({ left: 2, top: 160, width: 24, height: 24 }),
      });

      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      await flush();

      expect(Number.parseFloat(toolbar.style.left)).toBeGreaterThanOrEqual(122);

      Object.defineProperty(Range.prototype, "getBoundingClientRect", {
        configurable: true,
        value: () => createDomRect({ left: 282, top: 160, width: 24, height: 24 }),
      });

      document.dispatchEvent(new Event("selectionchange"));
      await flush();

      expect(Number.parseFloat(toolbar.style.left)).toBeLessThanOrEqual(178);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      if (originalRangeDescriptor) {
        Object.defineProperty(Range.prototype, "getBoundingClientRect", originalRangeDescriptor);
      } else {
        delete (Range.prototype as Range & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
      }
    }
  });

  it("does not reveal the selection comment toolbar for selections outside the article", async () => {
    const page = renderWikiPage("wiki/concepts/index.md");
    const outsideBoundary = document.createElement("div");
    outsideBoundary.dataset.testOutsideArticleBoundary = "true";
    outsideBoundary.textContent = "outside article boundary";
    document.body.appendChild(page);
    document.body.appendChild(outsideBoundary);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const toolbar = page.querySelector<HTMLElement>("[data-wiki-selection-toolbar]");
    const outsideText = outsideBoundary.firstChild;
    const range = document.createRange();
    range.setStart(outsideText!, 0);
    range.setEnd(outsideText!, outsideText!.textContent!.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flush();

    expect(toolbar?.hidden).toBe(true);
  });

  it("clears preserved selection when a new document replaces the article", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              children: [
                { name: "first.md", path: "wiki/concepts/first.md", kind: "file" },
                { name: "second.md", path: "wiki/concepts/second.md", kind: "file" },
              ],
            },
          ],
        });
      }
      if (url.includes("/api/page?path=wiki%2Fconcepts%2Ffirst.md")) {
        return rawOk({
          path: "wiki/concepts/first.md",
          title: "First",
          html: "<h1>First</h1><p id=\"first-target\">Alpha Beta Gamma</p>",
          raw: "# First",
          frontmatter: null,
          modifiedAt: "2026-04-21T00:00:00.000Z",
        });
      }
      if (url.includes("/api/page?path=wiki%2Fconcepts%2Fsecond.md")) {
        return rawOk({
          path: "wiki/concepts/second.md",
          title: "Second",
          html: "<h1>Second</h1><p>Fresh document</p>",
          raw: "# Second",
          frontmatter: null,
          modifiedAt: "2026-04-22T00:00:00.000Z",
        });
      }
      if (url.startsWith("/api/wiki-comments?path=")) {
        return ok([]);
      }
      if (url === "/api/wiki-comments" && init?.method === "POST") {
        return ok({
          id: "comment-1",
          path: "wiki/concepts/second.md",
          quote: "stale",
          text: "",
          start: 0,
          end: 5,
          resolved: false,
          createdAt: "2026-04-24T00:05:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/concepts/first.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Alpha Beta Gamma");

    const textNode = page.querySelector("#first-target")?.lastChild;
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
    expect(toolbar?.hidden).toBe(false);

    window.location.hash = "#/wiki/wiki%2Fconcepts%2Fsecond.md";
    page.dataset.wikiCurrentPath = "wiki/concepts/second.md";
    const searchInput = page.querySelector<HTMLInputElement>("[data-wiki-search-input]");
    searchInput!.value = "";
    page.querySelector<HTMLFormElement>("[data-wiki-search]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Fresh document");

    expect(toolbar?.hidden).toBe(true);

    toolbarAction?.click();
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-comments-status]")!, "先选中文本，再点击浮动“评论”。");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([call, options]) =>
      String(call) === "/api/wiki-comments" && options?.method === "POST",
    )).toBe(false);
  });

  it("clears preserved selection when search results replace the article", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
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
          html: "<h1>Index</h1><p id=\"search-target\">Alpha Beta Gamma</p>",
          raw: "# Index",
          frontmatter: null,
          modifiedAt: "2026-04-21T00:00:00.000Z",
        });
      }
      if (url.startsWith("/api/wiki-comments?path=")) {
        return ok([]);
      }
      if (url.includes("/api/search?")) {
        return ok({
          local: {
            results: [
              {
                path: "wiki/concepts/ai.md",
                title: "AI",
                excerpt: "人工智能相关页面",
                tags: ["AI"],
                modifiedAt: "2026-04-21T00:00:00.000Z",
              },
            ],
          },
        });
      }
      if (url === "/api/wiki-comments" && init?.method === "POST") {
        return ok({
          id: "comment-1",
          path: "wiki/index.md",
          quote: "stale",
          text: "",
          start: 0,
          end: 5,
          resolved: false,
          createdAt: "2026-04-24T00:05:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Alpha Beta Gamma");

    const textNode = page.querySelector("#search-target")?.lastChild;
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
    expect(toolbar?.hidden).toBe(false);

    const input = page.querySelector<HTMLInputElement>("[data-wiki-search-input]");
    input!.value = "人工智能";
    page.querySelector<HTMLFormElement>("[data-wiki-search]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "人工智能相关页面");

    expect(toolbar?.hidden).toBe(true);

    toolbarAction?.click();
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-comments-status]")!, "当前页面不支持评论。");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([call, options]) =>
      String(call) === "/api/wiki-comments" && options?.method === "POST",
    )).toBe(false);
  });

  it("scrolls to a requested chat message anchor after loading the article", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

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
              children: [
                { name: "test-chat.md", path: "wiki/聊天记录/test-chat.md", kind: "file" },
              ],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/聊天记录/test-chat.md",
          title: "Test Chat",
          html: "<h1>Test Chat</h1><ul><li id=\"msg-2026-04-02-00-44\"><code>2026-04-02 00:44</code> <strong>oiii</strong>：我看完了</li></ul>",
          raw: "# Test Chat",
          frontmatter: null,
          modifiedAt: "2026-04-21T00:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/聊天记录/test-chat.md", "msg-2026-04-02-00-44");
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "我看完了");
    await waitForCondition(() => scrollIntoView.mock.calls.length > 0);

    expect(page.querySelector("#msg-2026-04-02-00-44")).toBeTruthy();
    expect(scrollIntoView).toHaveBeenCalled();
    (page as HTMLElement & { __dispose?: () => void }).__dispose?.();
  });

  it("renders the article before the wiki tree finishes loading", async () => {
    const deferredTree = createDeferred<ReturnType<typeof rawOk>>();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/tree?")) {
        return deferredTree.promise;
      }
      if (url.includes("/api/page?path=wiki%2Fconcepts%2Findex.md")) {
        return rawOk({
          path: "wiki/concepts/index.md",
          title: "Index",
          html: "<h1>Index</h1><p>Visible before tree resolves</p>",
          raw: "# Index\n\nVisible before tree resolves",
          frontmatter: null,
          modifiedAt: "2026-04-21T00:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Visible before tree resolves");

    expect(page.textContent).toContain("Visible before tree resolves");
    expect(page.querySelector("[data-wiki-recent]")?.textContent).not.toContain("Second");

    deferredTree.resolve(rawOk({
      name: "wiki",
      path: "wiki",
      kind: "dir",
      children: [
        {
          name: "wiki",
          path: "wiki",
          kind: "dir",
          children: [
            { name: "index.md", path: "wiki/index.md", kind: "file", modifiedAt: "2026-04-21T00:00:00.000Z" },
            { name: "second.md", path: "wiki/concepts/second.md", kind: "file", modifiedAt: "2026-04-22T00:00:00.000Z" },
          ],
        },
      ],
    }));
    await waitForText(page.querySelector<HTMLElement>("[data-wiki-recent]")!, "Second");
  });
});

describe("wiki about-me profile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installWikiStyles();
  });

  it("renders wiki/about-me.md with the dedicated profile layout instead of the normal article layout", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/page?path=wiki%2Fabout-me.md")) {
        return rawOk({
          path: "wiki/about-me.md",
          title: "小松 Xiaosong",
          html: "<h1>小松 Xiaosong</h1>",
          raw: [
            "# 小松 Xiaosong",
            "> 学生 / 个人知识库搭建者 / 自动化系统爱好者",
            "> 用时间线记录成长，用成果库展示能力。",
            "",
            "## 首页",
            "### 标签",
            "- 学习成长",
            "- 项目实践",
            "",
            "### 统计卡片",
            "- 知识笔记: 320+",
            "",
            "## 时间线",
            "### 2023",
            "构建个人知识系统",
            "搭建第二大脑，沉淀方法与思考",
            "",
            "## 简历",
            "### 联系方式",
            "- Email: xiaosong@example.com",
          ].join("\n"),
          frontmatter: null,
          modifiedAt: "2026-04-26T08:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/about-me.md");
    document.body.appendChild(page);

    await waitForText(page, "小松 Xiaosong");

    expect(page.querySelector("[data-about-me-profile]")).toBeTruthy();
    expect(page.querySelector("[data-about-me-tab='首页']")).toBeTruthy();
    expect(page.querySelector("[data-about-me-tab='简历']")).toBeTruthy();
    expect(page.querySelector("[data-wiki-article]")).toBeNull();
  });

  it("switches profile panels in place without changing the wiki route", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/page?path=wiki%2Fabout-me.md")) {
        return rawOk({
          path: "wiki/about-me.md",
          title: "小松 Xiaosong",
          html: "<h1>小松 Xiaosong</h1>",
          raw: [
            "# 小松 Xiaosong",
            "> 学生 / 个人知识库搭建者 / 自动化系统爱好者",
            "> 用时间线记录成长，用成果库展示能力。",
            "",
            "## 首页",
            "### 总结",
            "首页文案",
            "",
            "## 时间线",
            "### 2023",
            "构建个人知识系统",
            "搭建第二大脑，沉淀方法与思考",
          ].join("\n"),
          frontmatter: null,
          modifiedAt: "2026-04-26T08:00:00.000Z",
        });
      }
      return ok({});
    }));

    window.location.hash = "#/wiki/wiki%2Fabout-me.md";
    const page = renderWikiPage("wiki/about-me.md");
    document.body.appendChild(page);

    await waitForText(page, "首页文案");
    page.querySelector<HTMLButtonElement>("[data-about-me-tab='时间线']")?.click();

    expect(page.querySelector("[data-about-me-panel='首页']")?.hasAttribute("hidden")).toBe(true);
    expect(page.querySelector("[data-about-me-panel='时间线']")?.hasAttribute("hidden")).toBe(false);
    expect(page.textContent).toContain("构建个人知识系统");
    expect(window.location.hash).toBe("#/wiki/wiki%2Fabout-me.md");
  });

  it("renders the parsed stat, timeline, and resume content from about-me markdown", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/page?path=wiki%2Fabout-me.md")) {
        return rawOk({
          path: "wiki/about-me.md",
          title: "小松 Xiaosong",
          html: "<h1>小松 Xiaosong</h1>",
          raw: [
            "# 小松 Xiaosong",
            "> 学生 / 个人知识库搭建者 / 自动化系统爱好者",
            "> 用时间线记录成长，用成果库展示能力。",
            "",
            "## 首页",
            "### 统计卡片",
            "- 知识笔记: 320+",
            "",
            "## 时间线",
            "### 2023",
            "构建个人知识系统",
            "搭建第二大脑，沉淀方法与思考",
            "",
            "## 简历",
            "### 联系方式",
            "- Email: xiaosong@example.com",
          ].join("\n"),
          frontmatter: null,
          modifiedAt: "2026-04-26T08:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/about-me.md");
    document.body.appendChild(page);

    await waitForText(page, "320+");

    expect(page.querySelector("[data-about-me-stat='知识笔记']")?.textContent).toContain("320+");
    expect(page.querySelector("[data-about-me-resume-contact]")?.textContent).toContain("xiaosong@example.com");
    expect(page.querySelector("[data-about-me-timeline]")?.textContent).toContain("构建个人知识系统");
  });

  it("renders the dedicated hero, achievement board, switchable side card, and strengths row", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/page?path=wiki%2Fabout-me.md")) {
        return rawOk({
          path: "wiki/about-me.md",
          title: "小松 Xiaosong",
          html: "<h1>小松 Xiaosong</h1>",
          raw: [
            "# 小松 Xiaosong",
            "> 学生 / 个人知识库搭建者 / 自动化系统爱好者",
            "> 用时间线记录成长，用成果库展示能力。",
            "",
            "## 首页",
            "### 代表能力",
            "- 结构化表达",
            "- 项目推进",
            "",
            "## 成果库",
            "### 项目作品",
            "#### 飞书记录系统",
            "协同记录与自动化",
            "",
            "## 时间线",
            "### 2023",
            "构建个人知识系统",
            "搭建第二大脑，沉淀方法与思考",
            "",
            "## 简历",
            "### 身份",
            "- 学生 / 个人知识库搭建者",
          ].join("\n"),
          frontmatter: null,
          modifiedAt: "2026-04-26T08:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/about-me.md");
    document.body.appendChild(page);

    await waitForText(page, "飞书记录系统");

    expect(page.querySelector("[data-about-me-hero]")).toBeTruthy();
    expect(page.querySelector("[data-about-me-stats-card]")).toBeTruthy();
    expect(page.querySelector("[data-about-me-achievement-board]")).toBeTruthy();
    expect(page.querySelector("[data-about-me-home-side-card='时间线']")).toBeTruthy();
    expect(page.querySelector("[data-about-me-home-panel-switch='时间线']")?.getAttribute("aria-pressed")).toBe("true");
    expect(page.querySelector("[data-about-me-home-panel-switch='简历']")?.getAttribute("aria-pressed")).toBe("false");
    expect(page.querySelector("[data-about-me-strength-grid]")).toBeTruthy();
  });

  it("switches the home side card between timeline and resume", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/page?path=wiki%2Fabout-me.md")) {
        return rawOk({
          path: "wiki/about-me.md",
          title: "小松 Xiaosong",
          html: "<h1>小松 Xiaosong</h1>",
          raw: [
            "# 小松 Xiaosong",
            "> 学生 / 个人知识库搭建者 / 自动化系统爱好者",
            "> 用时间线记录成长，用成果库展示能力。",
            "",
            "## 首页",
            "### 代表能力",
            "- 结构化表达",
            "",
            "## 时间线",
            "### 2023",
            "构建个人知识系统",
            "搭建第二大脑，沉淀方法与思考",
            "",
            "## 简历",
            "### 联系方式",
            "- Email: xiaosong@example.com",
          ].join("\n"),
          frontmatter: null,
          modifiedAt: "2026-04-26T08:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/about-me.md");
    document.body.appendChild(page);

    await waitForText(page, "构建个人知识系统");

    page.querySelector<HTMLButtonElement>("[data-about-me-home-panel-switch='简历']")?.click();

    expect(page.querySelector("[data-about-me-home-side-card='简历']")).toBeTruthy();
    expect(page.querySelector("[data-about-me-home-resume]")?.textContent).toContain("xiaosong@example.com");
    expect(page.querySelector("[data-about-me-home-panel-switch='简历']")?.getAttribute("aria-pressed")).toBe("true");
    expect(page.querySelector("[data-about-me-home-panel-switch='时间线']")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("switches the about-me profile into markdown edit mode and saves the updated raw document", async () => {
    let currentRaw = [
      "# 小松 Xiaosong",
      "> 学生 / 个人知识库搭建者 / 自动化系统爱好者",
      "> 用时间线记录成长，用成果库展示能力。",
      "",
      "## 首页",
      "![头像](https://example.com/old-avatar.png)",
      "### 标签",
      "- 学习成长",
      "",
      "## 简历",
      "### 联系方式",
      "- Email: xiaosong@example.com",
    ].join("\n");
    let saveCount = 0;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/page?path=wiki%2Fabout-me.md")) {
        return rawOk({
          path: "wiki/about-me.md",
          title: "小松 Xiaosong",
          html: "<h1>小松 Xiaosong</h1>",
          raw: currentRaw,
          sourceEditable: true,
          frontmatter: null,
          modifiedAt: "2026-04-26T08:00:00.000Z",
        });
      }
      if (url === "/api/page" && init?.method === "PUT") {
        saveCount += 1;
        const body = JSON.parse(String(init.body ?? "{}")) as { raw: string };
        currentRaw = body.raw;
        return ok({
          path: "wiki/about-me.md",
          modifiedAt: "2026-04-26T08:05:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/about-me.md");
    document.body.appendChild(page);

    await waitForText(page, "小松 Xiaosong");

    page.querySelector<HTMLButtonElement>("[data-about-me-edit]")?.click();

    const editor = page.querySelector<HTMLTextAreaElement>("[data-about-me-editor]");
    expect(editor).toBeTruthy();
    expect(editor?.value).toContain("old-avatar");

    editor!.value = currentRaw
      .replace("小松 Xiaosong", "Farza")
      .replace("https://example.com/old-avatar.png", "https://example.com/new-avatar.png");
    editor!.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-about-me-save]")?.click();

    await waitForCondition(() => page.querySelector("[data-about-me-editor-shell]") === null);

    const avatar = page.querySelector<HTMLImageElement>(".about-me-profile__avatar img");
    expect(page.textContent).toContain("Farza");
    expect(avatar?.getAttribute("src")).toBe("https://example.com/new-avatar.png");
    expect(page.querySelector("[data-about-me-editor-shell]")).toBeNull();
    expect(saveCount).toBe(1);
  });

  it("keeps ordinary wiki pages on the existing article layout", async () => {
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
          html: "<h1>Index</h1><p>Overview</p>",
          raw: "# Index\n\nOverview",
          frontmatter: null,
          modifiedAt: "2026-04-21T00:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/concepts/index.md");
    document.body.appendChild(page);

    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    expect(page.querySelector("[data-about-me-profile]")).toBeNull();
    expect(page.querySelector("[data-wiki-article]")).toBeTruthy();
  });

  it("renders a floated side-image box inside editable ordinary wiki articles", async () => {
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
              children: [{ name: "sample.md", path: "wiki/concepts/sample.md", kind: "file" }],
            },
          ],
        });
      }
      if (url.includes("/api/page?")) {
        return rawOk({
          path: "wiki/concepts/sample.md",
          title: "Sample",
          html: "<h1>Sample</h1><p>Overview</p>",
          raw: "# Sample\n\nOverview",
          frontmatter: {
            side_image: "wiki/.page-media/concepts/sample-side.png",
            side_image_caption: "这是一张右侧说明图。",
          },
          sourceEditable: true,
          modifiedAt: "2026-04-27T08:00:00.000Z",
        });
      }
      return ok({});
    }));

    const page = renderWikiPage("wiki/concepts/sample.md");
    document.body.appendChild(page);

    await waitForText(page.querySelector<HTMLElement>("[data-wiki-article]")!, "Overview");

    const article = page.querySelector<HTMLElement>("[data-wiki-article]");
    const box = article?.querySelector<HTMLElement>("[data-wiki-side-image-box]");
    const preview = page.querySelector<HTMLImageElement>("[data-wiki-side-image-preview]");
    const button = page.querySelector<HTMLButtonElement>("[data-wiki-side-image-upload]");
    const caption = page.querySelector<HTMLElement>("[data-wiki-side-image-caption]");

    expect(box).toBeTruthy();
    expect(preview?.getAttribute("src")).toBe("/api/page-side-image?path=wiki%2F.page-media%2Fconcepts%2Fsample-side.png");
    expect(caption?.textContent).toContain("这是一张右侧说明图。");
    expect(button?.textContent).toContain("更换图片");
  });

  it("keeps the about-me profile layout hooks in wiki-launch.css", () => {
    const styles = readFileSync(
      resolve(__dirname, "../web/client/assets/styles/wiki-launch.css"),
      "utf8",
    );

    expect(styles).toContain(".about-me-profile__hero");
    expect(styles).toContain("grid-template-columns: 220px minmax(0, 1fr) 360px;");
    expect(styles).toContain(".about-me-profile__content");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) 320px;");
    expect(styles).toContain(".about-me-profile__achievement-grid");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(styles).toContain(".about-me-profile__strength-grid");
    expect(styles).toContain("grid-template-columns: repeat(5, minmax(0, 1fr));");
    expect(styles).toContain(".wiki-page__side-image-box");
    expect(styles).toContain("float: right;");
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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

function createDomRect(
  values: { left: number; top: number; width: number; height: number },
): DOMRect {
  return {
    x: values.left,
    y: values.top,
    width: values.width,
    height: values.height,
    top: values.top,
    left: values.left,
    right: values.left + values.width,
    bottom: values.top + values.height,
    toJSON: () => ({}),
  } as DOMRect;
}
