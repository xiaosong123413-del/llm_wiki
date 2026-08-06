// @vitest-environment jsdom
/**
 * Graphy page behavior coverage.
 *
 * The dedicated graph page should render wiki node names, unlike the compact
 * wiki home card which keeps labels sparse to save space.
 */
import fs from "node:fs";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mountWikiHomeGraphMock = vi.fn();
const disposeWikiHomeGraphMock = vi.fn();
const setWikiHomeGraphHighlightsMock = vi.fn();

vi.mock("../web/client/src/pages/wiki/home-graph.js", () => ({
  disposeWikiHomeGraph: disposeWikiHomeGraphMock,
  mountWikiHomeGraph: mountWikiHomeGraphMock,
  setWikiHomeGraphHighlights: setWikiHomeGraphHighlightsMock,
}));

describe("Graphy page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mountWikiHomeGraphMock.mockClear();
    disposeWikiHomeGraphMock.mockClear();
    setWikiHomeGraphHighlightsMock.mockClear();
  });

  it("mounts the wiki graph with all node labels visible", async () => {
    const { renderGraphPage } = await import("../web/client/src/pages/graph/index.js");

    const page = renderGraphPage();
    const options = mountWikiHomeGraphMock.mock.calls[0]?.[3] as { labels?: string } | undefined;

    expect(page.querySelector("[data-graphy-page-graph]")).toBeTruthy();
    expect(page.querySelector("[data-graphy-insights-toggle]")).toBeTruthy();
    expect(page.querySelector("[data-graphy-color-mode='type']")).toBeTruthy();
    expect(page.querySelector("[data-graphy-color-mode='community']")).toBeTruthy();
    expect(mountWikiHomeGraphMock).toHaveBeenCalledWith(
      page,
      page.querySelector("[data-graphy-page-graph]"),
      expect.any(AbortSignal),
      expect.objectContaining({ labels: "all", colorMode: "community" }),
    );
    expect(options?.labels).toBe("all");
  });

  it("switches Graphy coloring between community and type", async () => {
    const { renderGraphPage } = await import("../web/client/src/pages/graph/index.js");
    const page = renderGraphPage();

    page.querySelector<HTMLButtonElement>("[data-graphy-color-mode='type']")?.click();

    expect(mountWikiHomeGraphMock).toHaveBeenLastCalledWith(
      page,
      page.querySelector("[data-graphy-page-graph]"),
      expect.any(AbortSignal),
      expect.objectContaining({ colorMode: "type" }),
    );
    expect(page.querySelector("[data-graphy-color-mode='type']")?.classList.contains("is-active")).toBe(true);
  });

  it("returns to the wiki home from the back button", async () => {
    const { renderGraphPage } = await import("../web/client/src/pages/graph/index.js");
    const page = renderGraphPage();

    page.querySelector<HTMLButtonElement>("[data-graphy-back]")?.click();

    expect(window.location.hash).toBe("#/wiki");
  });

  it("lets the graph fill the remaining page height", () => {
    const css = fs.readFileSync("web/client/assets/styles/wiki-home-cover.css", "utf-8");

    expect(css).toMatch(
      /\.graphy-page__main\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/su,
    );
    expect(css).toMatch(
      /\.graphy-page__graph\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*auto;/su,
    );
    expect(css).toMatch(
      /\.graphy-page \.wiki-home-cover__graph-stage\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/su,
    );
    expect(css).not.toMatch(
      /\.graphy-page \.wiki-home-cover__graph-stage\s*\{[^}]*min\(620px/su,
    );
  });

  it("opens the clicked graph node as a wiki markdown preview", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/page?path=wiki%2Falpha.md&raw=0");
      return jsonResponse({
        path: "wiki/alpha.md",
        title: "Alpha",
        html: "<h1>Alpha</h1><p>Rendered body</p>",
        frontmatter: {
          title: "Alpha",
          type: "concept",
          tags: ["one", "two"],
          sources: ["source.md"],
          related: ["Beta"],
          updated: "2026-05-02",
        },
        modifiedAt: "2026-05-02T00:00:00.000Z",
      });
    }));
    const { renderGraphPage } = await import("../web/client/src/pages/graph/index.js");
    const page = renderGraphPage();
    const options = mountWikiHomeGraphMock.mock.calls[0]?.[3] as {
      onNodeSelect?: (node: { label: string; path: string; type: string }) => void;
    };

    options.onNodeSelect?.({ label: "Alpha", path: "wiki/alpha.md", type: "concept" });
    await waitForPreview(page);

    const preview = page.querySelector<HTMLElement>("[data-graphy-preview]");
    expect(preview?.hidden).toBe(false);
    expect(preview?.textContent).toContain("wiki/alpha.md");
    expect(preview?.textContent).toContain("concept");
    expect(preview?.textContent).toContain("source.md");
    expect(preview?.innerHTML).toContain("<h1>Alpha</h1>");
  });

  it("dismisses surprising connections and toggles graph highlights", async () => {
    const { renderGraphPage } = await import("../web/client/src/pages/graph/index.js");
    const page = renderGraphPage();
    const options = mountWikiHomeGraphMock.mock.calls[0]?.[3] as {
      onGraphLoad?: (payload: unknown) => void;
    };

    options.onGraphLoad?.({
      nodes: [
        graphNode("wiki/a.md", "Alpha", "entity", 1),
        graphNode("wiki/b.md", "Beta", "concept", 2),
      ],
      edges: [graphEdge("wiki/a.md", "wiki/b.md", 1)],
      communities: [],
    });
    page.querySelector<HTMLButtonElement>("[data-graphy-insights-toggle]")?.click();
    page.querySelector<HTMLElement>("[data-graphy-insight-card]")?.click();
    expect(setWikiHomeGraphHighlightsMock).toHaveBeenLastCalledWith(page, ["wiki/a.md", "wiki/b.md"]);

    page.querySelector<HTMLElement>("[data-graphy-insight-card]")?.click();
    expect(setWikiHomeGraphHighlightsMock).toHaveBeenLastCalledWith(page, []);

    page.querySelector<HTMLButtonElement>("[data-graphy-dismiss-insight]")?.click();
    const surprisingSection = page.querySelector(".graphy-insights__section");
    expect(surprisingSection?.textContent).not.toContain("Alpha ↔ Beta");
    expect(page.querySelector("[data-graphy-insights-toggle]")?.textContent).toBe("Insights 2");
  });

  it("keeps dismissed surprising connections hidden after remounting Graphy", async () => {
    const { renderGraphPage } = await import("../web/client/src/pages/graph/index.js");
    const page = renderGraphPage();
    const options = mountWikiHomeGraphMock.mock.calls[0]?.[3] as {
      onGraphLoad?: (payload: unknown) => void;
    };
    const payload = {
      nodes: [
        graphNode("wiki/a.md", "Alpha", "entity", 1),
        graphNode("wiki/b.md", "Beta", "concept", 2),
      ],
      edges: [graphEdge("wiki/a.md", "wiki/b.md", 1)],
      communities: [],
    };

    options.onGraphLoad?.(payload);
    page.querySelector<HTMLButtonElement>("[data-graphy-insights-toggle]")?.click();
    page.querySelector<HTMLButtonElement>("[data-graphy-dismiss-insight]")?.click();

    const remountedPage = renderGraphPage();
    const remountedOptions = mountWikiHomeGraphMock.mock.calls.at(-1)?.[3] as {
      onGraphLoad?: (payload: unknown) => void;
    };
    remountedOptions.onGraphLoad?.(payload);
    remountedPage.querySelector<HTMLButtonElement>("[data-graphy-insights-toggle]")?.click();

    const surprisingSection = remountedPage.querySelector(".graphy-insights__section");
    expect(surprisingSection?.textContent).not.toContain("Alpha ↔ Beta");
    expect(remountedPage.querySelector("[data-graphy-insights-toggle]")?.textContent).toBe("Insights 2");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

async function waitForPreview(page: HTMLElement): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const preview = page.querySelector<HTMLElement>("[data-graphy-preview]");
    if (preview && !preview.hidden && preview.textContent?.includes("source.md")) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Graphy preview did not open");
}

function graphNode(id: string, label: string, type: string, community: number) {
  return { id, label, path: id, type, community, size: 8, color: "#94a3b8", x: 0, y: 0 };
}

function graphEdge(source: string, target: string, weight: number) {
  return { id: `${source}::${target}`, source, target, weight, label: String(weight) };
}
