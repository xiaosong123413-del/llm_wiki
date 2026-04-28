import { renderIcon } from "../components/icon.js";

export interface BrowserRefs {
  root: HTMLElement;
  layerToggle: HTMLElement;
  layerWikiBtn: HTMLButtonElement;
  layerRawBtn: HTMLButtonElement;
  toggleButton: HTMLButtonElement;
  searchInput: HTMLInputElement;
  newButton: HTMLButtonElement;
  multiSelectButton: HTMLButtonElement;
  selectionStatus: HTMLElement;
  treeContainer: HTMLElement;
}

export function mountBrowser(container: HTMLElement): BrowserRefs {
  container.classList.add("shell-browser");
  container.innerHTML = `
    <div class="shell-browser__header">
      <div id="layer-toggle" class="layer-toggle" aria-label="Toggle file layer">
        <button type="button" class="layer-pill active" data-layer="wiki">wiki</button>
        <button type="button" class="layer-pill" data-layer="raw">raw</button>
      </div>
      <button type="button" class="btn btn-secondary btn-inline shell-browser__collapse" data-action="toggle-browser">折叠</button>
    </div>
    <div class="shell-browser__tools">
      <div class="shell-browser__search">
        <span class="shell-browser__search-icon">${renderIcon("search", { size: 16 })}</span>
        <input id="tree-search" class="input" type="search" placeholder="\u641c\u7d22\u6587\u4ef6" autocomplete="off" />
      </div>
      <div class="shell-browser__tool-row">
        <button type="button" class="icon-btn shell-browser__tool-btn" data-action="new" aria-label="New file">
          ${renderIcon("plus", { size: 16 })}
        </button>
        <button
          type="button"
          class="icon-btn shell-browser__tool-btn"
          data-action="multi-select"
          aria-label="Toggle multi-select"
          aria-pressed="false"
        >
          ${renderIcon("list-checks", { size: 16 })}
        </button>
      </div>
      <div id="tree-selection-status" class="shell-browser__selection-status hidden"></div>
    </div>
    <nav id="tree" class="shell-browser__tree"><p class="loading">Loading tree</p></nav>
  `;

  const layerToggle = container.querySelector<HTMLElement>("#layer-toggle")!;
  const [layerWikiBtn, layerRawBtn] = Array.from(
    layerToggle.querySelectorAll<HTMLButtonElement>("[data-layer]"),
  );
  const toggleButton = container.querySelector<HTMLButtonElement>('[data-action="toggle-browser"]')!;
  const searchInput = container.querySelector<HTMLInputElement>("#tree-search")!;
  const newButton = container.querySelector<HTMLButtonElement>('[data-action="new"]')!;
  const multiSelectButton = container.querySelector<HTMLButtonElement>('[data-action="multi-select"]')!;
  const selectionStatus = container.querySelector<HTMLElement>("#tree-selection-status")!;
  const treeContainer = container.querySelector<HTMLElement>("#tree")!;

  return {
    root: container,
    layerToggle,
    layerWikiBtn,
    layerRawBtn,
    toggleButton,
    searchInput,
    newButton,
    multiSelectButton,
    selectionStatus,
    treeContainer,
  };
}
