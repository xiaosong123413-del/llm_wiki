// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWikiPage } from "../web/client/src/pages/wiki/index.js";

const TREE_URL = "/api/tree?layer=wiki";
const INDEX_URL = "/api/page?path=wiki%2Findex.md&raw=1";
const GUIDE_URL = "/api/page?path=wiki%2Fconcepts%2Fguide.md&raw=1";
const EPISODE_URL = "/api/page?path=wiki%2Fconcepts%2Fepisode.md&raw=1";

describe("wiki page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders the Peiweipedia home cover from wiki data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === TREE_URL) {
        return jsonResponse({
          name: "wiki",
          path: "wiki",
          kind: "dir",
          children: [
            {
              name: "wiki",
              path: "wiki",
              kind: "dir",
              children: [
                { name: "index", path: "wiki/index.md", kind: "file" },
                {
                  name: "concepts",
                  path: "wiki/concepts",
                  kind: "dir",
                  children: [
                    {
                      name: "Navigation Guide",
                      path: "wiki/concepts/guide.md",
                      kind: "file",
                      modifiedAt: "2026-04-21T08:00:00.000Z",
                    },
                    {
                      name: "Episode Notes",
                      path: "wiki/concepts/episode.md",
                      kind: "file",
                      modifiedAt: "2026-04-20T08:00:00.000Z",
                    },
                  ],
                },
                {
                  name: "journals",
                  path: "wiki/journals",
                  kind: "dir",
                  children: [
                    {
                      name: "Daily Review",
                      path: "wiki/journals/daily-review.md",
                      kind: "file",
                      modifiedAt: "2026-04-19T08:00:00.000Z",
                    },
                  ],
                },
              ],
            },
          ],
        });
      }
      if (url === INDEX_URL) {
        return jsonResponse({
          path: "wiki/index.md",
          title: "知识 Wiki",
          html: "<h1>知识 Wiki</h1><p>这里整理长期沉淀下来的知识、概念和主题页面。</p>",
          raw: [
            "# 知识 Wiki",
            "",
            "这里整理长期沉淀下来的知识、概念和主题页面。",
            "页面来自持续积累的日记、笔记与项目记录。",
          ].join("\n"),
          frontmatter: null,
          modifiedAt: "2026-04-21T07:00:00.000Z",
        });
      }
      if (url === GUIDE_URL) {
        return jsonResponse({
          path: "wiki/concepts/guide.md",
          title: "Navigation Guide",
          html: "<p>Guide</p><p>一篇用于介绍知识导航方式的页面。</p>",
          raw: "# Navigation Guide\n\n一篇用于介绍知识导航方式的页面。",
          frontmatter: null,
          modifiedAt: "2026-04-21T08:00:00.000Z",
        });
      }
      if (url === EPISODE_URL) {
        return jsonResponse({
          path: "wiki/concepts/episode.md",
          title: "Episode Notes",
          html: "<p>Episode</p>",
          raw: "Episode",
          frontmatter: null,
          modifiedAt: "2026-04-20T08:00:00.000Z",
        });
      }
      return new Response("not found", { status: 404 });
    }));

    const page = renderWikiPage();
    document.body.appendChild(page);

    await waitForText(page, "共 4 篇条目，分布在 2 个分类中");

    expect(page.matches("[data-wiki-home]")).toBe(true);
    expect(page.textContent).toContain("欢迎来到 Peiweipedia");
    expect(page.textContent).toContain("共 4 篇条目，分布在 2 个分类中");
    expect(page.textContent).toContain("精选条目");
    expect(page.textContent).toContain("Navigation Guide");
    expect(page.textContent).toContain("最近更新");
    expect(page.textContent).toContain("按分类浏览");
    expect(page.textContent).toContain("关于");
    expect(page.textContent).toContain("这里整理长期沉淀下来的知识、概念和主题页面。");
    expect(page.textContent).toContain("页面来自持续积累的日记、笔记与项目记录。");
    expect(page.querySelector("[data-wiki-article]")).toBeNull();
  });

  it("keeps a structured empty state when wiki/index.md is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === TREE_URL) {
        return jsonResponse({
          name: "wiki",
          path: "wiki",
          kind: "dir",
          children: [],
        });
      }
      if (url === INDEX_URL) {
        return new Response("missing", { status: 404 });
      }
      return new Response("not found", { status: 404 });
    }));

    const page = renderWikiPage();
    document.body.appendChild(page);

    await waitForText(page, "尚未找到 wiki/index.md。");

    expect(page.textContent).toContain("尚未找到 wiki/index.md。");
    expect(page.textContent).toContain("重新编译 wiki 后，这里会自动恢复为首页封面。");
    expect(page.querySelector("[data-wiki-home-empty]")).toBeTruthy();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function waitForText(node: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (node.textContent?.includes(text)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for text: ${text}`);
}
