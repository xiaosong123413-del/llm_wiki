// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderFlashDiaryPage } from "../web/client/src/pages/flash-diary/index.js";

describe("flash diary page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the two-column diary workspace with a pinned memory card", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          twelveQuestions: {
            kind: "document",
            title: "十二个问题",
            path: "wiki/journal-twelve-questions.md",
            description: "固定追问清单",
            exists: false,
            modifiedAt: null,
          },
          items: [],
          memory: {
            kind: "memory",
            title: "Memory",
            path: "wiki/journal-memory.md",
            description: "根据日记沉淀的分层记忆",
            exists: false,
            modifiedAt: null,
            lastAppliedDiaryDate: null,
          },
        },
      }),
    }));
    window.localStorage.setItem("llmWiki.panel.flashDiary.listWidth", "400");

    const page = renderFlashDiaryPage();
    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-memory]")).toBeTruthy();
    });

    expect(page.querySelector(".flash-diary-page__hero")).toBeNull();
    expect(page.querySelector("[data-flash-diary-list]")).toBeTruthy();
    expect(page.querySelector("[data-flash-diary-twelve-questions]")?.textContent).toContain("十二个问题");
    expect(page.querySelector("[data-flash-diary-memory]")?.textContent).toContain("Memory");
    expect(page.querySelector("[data-flash-diary-editor]")).toBeTruthy();
    expect(page.querySelector("[data-flash-diary-save]")).toBeTruthy();
    expect(page.querySelector("[data-panel-handle='flashDiary.listWidth']")).toBeTruthy();
    expect(page.querySelector("[data-flash-diary-mode='preview']")).toBeNull();
    expect(page.querySelector("[data-flash-diary-preview]")).toBeNull();
    expect(page.querySelector<HTMLElement>(".flash-diary-page__workspace")?.style.getPropertyValue("--flash-diary-list-width")).toBe("400px");
    expect(
      page.querySelector("[data-flash-diary-list]")?.firstElementChild?.getAttribute("data-flash-diary-twelve-questions"),
    ).not.toBeNull();
  });

  it("loads the latest diary and opens it automatically", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            twelveQuestions: {
              kind: "document",
              title: "十二个问题",
              path: "wiki/journal-twelve-questions.md",
              description: "固定追问清单",
              exists: false,
              modifiedAt: null,
            },
            memory: {
              kind: "memory",
              title: "Memory",
              path: "wiki/journal-memory.md",
              description: "根据日记沉淀的分层记忆",
              exists: true,
              modifiedAt: "2026-04-19T10:00:00.000Z",
              lastAppliedDiaryDate: "2026-04-18",
            },
            items: [
              {
                path: "raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-19.md",
                title: "2026-04-19",
                date: "2026-04-19",
                entryCount: 2,
                modifiedAt: "2026-04-19T10:00:00.000Z",
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            path: "raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-19.md",
            title: "2026-04-19",
            raw: "# 2026-04-19\n\n## 10:00:00\n\nhello\n",
            html: "<h1>2026-04-19</h1><h2>10:00:00</h2><p>hello</p>",
            modifiedAt: "2026-04-19T10:00:00.000Z",
            entryCount: 2,
          },
        }),
      }));

    const page = renderFlashDiaryPage();
    await waitFor(() => {
      expect((page.querySelector("[data-flash-diary-editor]") as HTMLTextAreaElement).value).toContain("hello");
    });

    expect(page.textContent).toContain("2026-04-19");
    expect((page.querySelector("[data-flash-diary-editor]") as HTMLTextAreaElement).value).toContain("hello");
    expect(page.querySelector("[data-flash-diary-preview]")).toBeNull();
    expect(page.querySelector("[data-flash-diary-save]")).toBeTruthy();
  });

  it("opens memory in rendered commentable mode when the memory card is clicked", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            twelveQuestions: {
              kind: "document",
              title: "十二个问题",
              path: "wiki/journal-twelve-questions.md",
              description: "固定追问清单",
              exists: false,
              modifiedAt: null,
            },
            memory: {
              kind: "memory",
              title: "Memory",
              path: "wiki/journal-memory.md",
              description: "根据日记沉淀的分层记忆",
              exists: true,
              modifiedAt: "2026-04-22T08:00:00.000Z",
              lastAppliedDiaryDate: "2026-04-21",
            },
            items: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            path: "wiki/journal-memory.md",
            title: "Memory",
            raw: [
              "# Memory",
              "",
              "## 短期记忆（最近 7 天）",
              "### 健康状态",
              "- 作息偏乱",
              "",
              "## 长期记忆",
              "- 更稳定的记忆线索",
            ].join("\n"),
            html: [
              "<h1>Memory</h1>",
              "<h2>短期记忆（最近 7 天）</h2>",
              "<h3>健康状态</h3>",
              "<p>作息偏乱</p>",
              "<h2>长期记忆</h2>",
              "<p>更稳定的记忆线索</p>",
            ].join(""),
            modifiedAt: "2026-04-22T08:00:00.000Z",
            sourceEditable: true,
            lastAppliedDiaryDate: "2026-04-21",
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ success: true, data: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderFlashDiaryPage();
    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-memory]")).toBeTruthy();
    });

    page.querySelector<HTMLButtonElement>("[data-flash-diary-memory]")?.click();

    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-memory-body]")?.textContent).toContain("短期记忆（最近 7 天）");
    });

    expect(page.querySelector("[data-flash-diary-memory-body]")?.textContent).toContain("长期记忆");
    expect(page.querySelector("[data-flash-diary-save]")?.hasAttribute("hidden")).toBe(true);
    expect(page.querySelector("[data-flash-diary-memory-refresh]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-flash-diary-memory-comment]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-wiki-comments-status]")).toBeTruthy();
  });

  it("opens the twelve-questions markdown document in the editable panel", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            twelveQuestions: {
              kind: "document",
              title: "十二个问题",
              path: "wiki/journal-twelve-questions.md",
              description: "固定追问清单",
              exists: true,
              modifiedAt: "2026-04-26T04:00:00.000Z",
            },
            memory: {
              kind: "memory",
              title: "Memory",
              path: "wiki/journal-memory.md",
              description: "根据日记沉淀的分层记忆",
              exists: true,
              modifiedAt: "2026-04-22T08:00:00.000Z",
              lastAppliedDiaryDate: "2026-04-21",
            },
            items: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            path: "wiki/journal-twelve-questions.md",
            title: "十二个问题",
            raw: "# 十二个问题\n\n- 最近最想逃避什么？\n",
            html: "<h1>十二个问题</h1><ul><li>最近最想逃避什么？</li></ul>",
            modifiedAt: "2026-04-26T04:00:00.000Z",
            entryCount: 0,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderFlashDiaryPage();
    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-twelve-questions]")).toBeTruthy();
    });

    page.querySelector<HTMLButtonElement>("[data-flash-diary-twelve-questions]")?.click();

    await waitFor(() => {
      expect((page.querySelector("[data-flash-diary-editor]") as HTMLTextAreaElement).value).toContain("最近最想逃避什么");
    });

    const editor = page.querySelector("[data-flash-diary-editor]") as HTMLTextAreaElement;
    editor.value = "# 十二个问题\n\n- 最近最想逃避什么？\n- 现在真正该推进什么？\n";
    editor.dispatchEvent(new Event("input"));
    page.querySelector<HTMLButtonElement>("[data-flash-diary-save]")?.click();

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) =>
        String(url) === "/api/flash-diary/page" && init?.method === "PUT",
      )).toBe(true);
    });

    expect(page.querySelector("[data-flash-diary-current-title]")?.textContent).toContain("十二个问题");
    expect(page.querySelector("[data-flash-diary-save]")?.hasAttribute("hidden")).toBe(false);
    expect(editor.readOnly).toBe(false);
    expect(page.querySelector("[data-flash-diary-memory-layout]")?.hasAttribute("hidden")).toBe(true);
    const saveRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === "/api/flash-diary/page" && init?.method === "PUT",
    );
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
      path: "wiki/journal-twelve-questions.md",
      raw: "# 十二个问题\n\n- 最近最想逃避什么？\n- 现在真正该推进什么？\n",
    });
  });

  it("shows a dedicated missing-document placeholder when twelve questions does not exist", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            twelveQuestions: {
              kind: "document",
              title: "十二个问题",
              path: "wiki/journal-twelve-questions.md",
              description: "你的固定追问清单",
              exists: false,
              modifiedAt: null,
            },
            memory: {
              kind: "memory",
              title: "Memory",
              path: "wiki/journal-memory.md",
              description: "根据日记沉淀的分层记忆",
              exists: true,
              modifiedAt: "2026-04-22T08:00:00.000Z",
              lastAppliedDiaryDate: "2026-04-21",
            },
            items: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "twelve questions document not found",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderFlashDiaryPage();
    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-twelve-questions]")).toBeTruthy();
    });

    page.querySelector<HTMLButtonElement>("[data-flash-diary-twelve-questions]")?.click();

    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-current-meta]")?.textContent).toContain("文档不存在");
    });

    const editor = page.querySelector("[data-flash-diary-editor]") as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(editor.value).toBe("");
    expect(editor.placeholder).toBe("十二个问题文档不存在");
  });

  it("shows an explicit error state when the memory request returns a non-ok response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            twelveQuestions: {
              kind: "document",
              title: "十二个问题",
              path: "wiki/journal-twelve-questions.md",
              description: "固定追问清单",
              exists: true,
              modifiedAt: "2026-04-26T04:00:00.000Z",
            },
            memory: {
              kind: "memory",
              title: "Memory",
              path: "wiki/journal-memory.md",
              description: "根据日记沉淀的分层记忆",
              exists: true,
              modifiedAt: "2026-04-22T08:00:00.000Z",
              lastAppliedDiaryDate: "2026-04-21",
            },
            items: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "provider unavailable",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderFlashDiaryPage();
    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-memory]")).toBeTruthy();
    });

    page.querySelector<HTMLButtonElement>("[data-flash-diary-memory]")?.click();

    await waitFor(() => {
      expect(page.querySelector("[data-flash-diary-current-meta]")?.textContent).toContain("Memory 加载失败");
    });

    expect(page.querySelector("[data-flash-diary-memory-body]")?.textContent).toContain("Memory 加载失败");
    expect(page.querySelector("[data-flash-diary-memory-layout]")?.hasAttribute("hidden")).toBe(false);
  });

  it("shows the shared selection toolbar in memory mode and creates comments from the selected quote", async () => {
    let createdComment:
      | {
          id: string;
          path: string;
          quote: string;
          text: string;
          start: number;
          end: number;
          resolved: boolean;
          createdAt: string;
        }
      | null = null;

    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/flash-diary") {
        return ok({
          items: [],
          memory: {
            kind: "memory",
            title: "Memory",
            path: "wiki/journal-memory.md",
            description: "根据日记沉淀的分层记忆",
            exists: true,
            modifiedAt: "2026-04-22T08:00:00.000Z",
            lastAppliedDiaryDate: "2026-04-21",
          },
        });
      }
      if (url === "/api/flash-diary/memory") {
        return ok({
          path: "wiki/journal-memory.md",
          title: "Memory",
          raw: [
            "# Memory",
            "",
            "## 短期记忆（最近 7 天）",
            "",
            "### 学习状态",
            "",
            "Alpha Beta Gamma",
            "",
            "## 长期记忆",
            "",
            "Delta",
          ].join("\n"),
          html: [
            "<h1>Memory</h1>",
            "<h2>短期记忆（最近 7 天）</h2>",
            "<h3>学习状态</h3>",
            "<p id=\"memory-target\">Alpha Beta Gamma</p>",
            "<h2>长期记忆</h2>",
            "<p>Delta</p>",
          ].join(""),
          modifiedAt: "2026-04-22T08:00:00.000Z",
          sourceEditable: true,
          lastAppliedDiaryDate: "2026-04-21",
        });
      }
      if (url.startsWith("/api/wiki-comments?path=")) {
        return ok(createdComment ? [createdComment] : []);
      }
      if (url === "/api/wiki-comments" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          path: string;
          quote: string;
          text: string;
          start: number;
          end: number;
        };
        createdComment = {
          id: "comment-1",
          path: body.path,
          quote: body.quote,
          text: body.text,
          start: body.start,
          end: body.end,
          resolved: false,
          createdAt: "2026-04-24T00:05:00.000Z",
        };
        return ok(createdComment);
      }
      return ok({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const originalRangeDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => createDomRect({ left: 120, top: 160, width: 80, height: 24 }),
    });

    try {
      const page = renderFlashDiaryPage();
      document.body.appendChild(page);

      await waitFor(() => {
        expect(page.querySelector("[data-flash-diary-memory]")).toBeTruthy();
      });

      page.querySelector<HTMLButtonElement>("[data-flash-diary-memory]")?.click();

      await waitFor(() => {
        const memoryText = page.querySelector("[data-flash-diary-memory-body]")?.textContent ?? "";
        expect(memoryText).toContain("短期记忆（最近 7 天）");
        expect(memoryText).toContain("长期记忆");
        expect(memoryText).toContain("Alpha Beta Gamma");
      });

      const textNode = page.querySelector("#memory-target")?.firstChild;
      const range = document.createRange();
      range.setStart(textNode!, 6);
      range.setEnd(textNode!, 10);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      await flush();

      const toolbar = page.querySelector<HTMLElement>("[data-flash-diary-selection-toolbar]");
      expect(toolbar?.hidden).toBe(false);
      expect(toolbar?.textContent).toContain("评论");
      expect(toolbar?.textContent).toContain("复制");
      expect(toolbar?.textContent).toContain("取消");

      page.querySelector<HTMLButtonElement>("[data-flash-diary-selection-comment]")?.click();

      await waitFor(() => {
        expect(fetchMock.mock.calls.some(([call, options]) =>
          String(call) === "/api/wiki-comments" && options?.method === "POST",
        )).toBe(true);
      });

      const createRequest = fetchMock.mock.calls.find(([call, options]) =>
        String(call) === "/api/wiki-comments" && options?.method === "POST",
      );
      const requestBody = JSON.parse(String(createRequest?.[1]?.body)) as {
        path: string;
        quote: string;
        text: string;
        start: number;
        end: number;
      };

      expect(requestBody.path).toBe("wiki/journal-memory.md");
      expect(requestBody.quote).toBe("Beta");
      expect(toolbar?.hidden).toBe(true);
      expect(selection.rangeCount).toBe(0);
      expect(page.querySelector<HTMLElement>("[data-flash-diary-memory-comments]")?.hidden).toBe(false);

      await waitFor(() => {
        const input = page.querySelector<HTMLTextAreaElement>("[data-wiki-comments-input=\"comment-1\"]");
        expect(input).toBeTruthy();
        expect(document.activeElement).toBe(input);
      });
    } finally {
      if (originalRangeDescriptor) {
        Object.defineProperty(Range.prototype, "getBoundingClientRect", originalRangeDescriptor);
      } else {
        delete (Range.prototype as Range & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
      }
    }
  });

  it("keeps the memory layout at a fixed viewport height so the article scrolls internally", () => {
    const styles = readFileSync(path.join(process.cwd(), "web", "client", "styles.css"), "utf8");
    const memoryLayoutBlock = styles.match(/\.flash-diary-page__memory-layout\s*\{[^}]+\}/)?.[0] ?? "";
    const workspaceBlock = styles.match(/\.flash-diary-page__workspace\s*\{[^}]+\}/)?.[0] ?? "";
    const listBlock = styles.match(/\.flash-diary-page__list\s*\{[^}]+\}/)?.[0] ?? "";
    const listItemBlock = styles.match(/\.flash-diary-page__list-item\s*\{[^}]+\}/)?.[0] ?? "";

    expect(memoryLayoutBlock).toMatch(/\n\s+height: calc\(100vh - 240px\);/);
    expect(workspaceBlock).toMatch(/\n\s+height: calc\(100vh - 180px\);/);
    expect(listBlock).toMatch(/\n\s+overflow: auto;/);
    expect(listItemBlock).toMatch(/\n\s+padding: 12px 14px;/);
  });
});

async function waitFor(assertion: () => void): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch {
      await flush();
      await flush();
    }
  }
  assertion();
}

function ok(data: unknown) {
  return {
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => ({ success: true, data }),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
}

function createDomRect(values: { left: number; top: number; width: number; height: number }): DOMRect {
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
