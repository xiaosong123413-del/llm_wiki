// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderGraphPage } from "../web/client/src/pages/graph/index.js";

describe("graph page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders graph shell and build-aware copy", () => {
    const page = renderGraphPage();

    expect(page.querySelector(".graph-stage")).toBeTruthy();
    expect(page.querySelector("[data-graph-canvas]")).toBeTruthy();
    expect(page.querySelector(".graph-page__hero")).toBeNull();
    expect(page.querySelector(".graph-page__stats")).toBeNull();
  });

  it("loads graph data and renders graph stats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        nodes: [
          { id: "wiki/a.md", label: "A", path: "wiki/a.md", group: "concepts", degree: 2, title: "A" },
          { id: "wiki/b.md", label: "B", path: "wiki/b.md", group: "concepts", degree: 1, title: "B" },
        ],
        edges: [{ source: "wiki/a.md", target: "wiki/b.md" }],
      }),
    }));

    const page = renderGraphPage();
    await Promise.resolve();
    await Promise.resolve();

    expect(page.querySelector("[data-graph-status]")?.textContent).toContain("\u5171 2 \u4e2a\u8282\u70b9");
    expect(page.querySelector("[data-graph-status]")?.textContent).toContain("1 \u6761\u8fde\u7ebf");
  });
});
