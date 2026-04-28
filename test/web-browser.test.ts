// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { mountBrowser } from "../web/client/src/shell/browser.js";

describe("mountBrowser", () => {
  beforeEach(() => {
    document.body.innerHTML = '<aside id="browser"></aside>';
  });

  it("renders the layer toggle, search input, and tree container", () => {
    const container = document.getElementById("browser") as HTMLElement;
    const refs = mountBrowser(container);

    expect(refs.layerToggle.id).toBe("layer-toggle");
    expect(refs.layerWikiBtn.dataset.layer).toBe("wiki");
    expect(refs.layerRawBtn.dataset.layer).toBe("raw");
    expect(refs.searchInput.id).toBe("tree-search");
    expect(refs.treeContainer.id).toBe("tree");
    expect(refs.newButton.dataset.action).toBe("new");
    expect(refs.multiSelectButton.dataset.action).toBe("multi-select");
    expect(refs.toggleButton.dataset.action).toBe("toggle-browser");
    expect(refs.selectionStatus.id).toBe("tree-selection-status");
  });

  it("starts with wiki active", () => {
    const container = document.getElementById("browser") as HTMLElement;
    const refs = mountBrowser(container);

    expect(refs.layerWikiBtn.classList.contains("active")).toBe(true);
    expect(refs.layerRawBtn.classList.contains("active")).toBe(false);
  });

  it("starts with multi-select inactive", () => {
    const container = document.getElementById("browser") as HTMLElement;
    const refs = mountBrowser(container);

    expect(refs.multiSelectButton.getAttribute("aria-pressed")).toBe("false");
  });
});
