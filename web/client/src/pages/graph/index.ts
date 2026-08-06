/**
 * Dedicated Graphy page for the wiki-wide relationship map.
 *
 * The page reuses the same Sigma-backed Graphy widget as the wiki home cover.
 * It exists as a focused full-page view so users can open the graph from the
 * home cover title and return to the wiki home without changing graph data.
 */
import {
  disposeWikiHomeGraph,
  mountWikiHomeGraph,
  setWikiHomeGraphHighlights,
} from "../wiki/home-graph.js";
import {
  detectKnowledgeGaps,
  findSurprisingConnections,
} from "./graph-insights.js";
import {
  bindGraphInsightsPanel,
  type GraphInsightsController,
  type GraphInsightsRefs,
} from "./graph-insights-panel.js";
import { bindGraphResearchPanel } from "./graph-research-panel.js";

type DisposableNode = HTMLElement & {
  __dispose?: () => void;
};

type GraphyColorMode = "type" | "community";

interface GraphyPageResponse {
  path: string;
  title: string | null;
  html: string;
  frontmatter: Record<string, unknown> | null;
  modifiedAt?: string;
}

interface GraphyPreviewRefs {
  panel: HTMLElement;
  title: HTMLElement;
  path: HTMLElement;
  content: HTMLElement;
}

interface GraphyMetadataEntry {
  label: string;
  value: unknown;
}

interface GraphySelectedNode {
  id: string;
  label: string;
  path: string;
  type: string;
}

interface GraphyGraphRefs {
  graph: HTMLElement | null;
  legend: HTMLElement | null;
}

const WIKI_HOME_ROUTE = "#/wiki";
const SPARSE_COMMUNITY_COHESION = 0.15;
const COMMUNITY_COLORS = [
  "#60a5fa",
  "#4ade80",
  "#fb923c",
  "#c084fc",
  "#f87171",
  "#2dd4bf",
  "#facc15",
  "#f472b6",
  "#a78bfa",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
] as const;
const NODE_TYPE_COLORS: Record<string, string> = {
  entity: "#60a5fa",
  concept: "#c084fc",
  source: "#fb923c",
  query: "#4ade80",
  synthesis: "#f87171",
  overview: "#facc15",
  comparison: "#2dd4bf",
  other: "#94a3b8",
};
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
};

export function renderGraphPage(): HTMLElement {
  const root = document.createElement("section") as DisposableNode;
  const controller = new AbortController();
  root.className = "graphy-page";
  root.innerHTML = renderGraphPageShell();

  let colorMode: GraphyColorMode = "community";
  const graphRefs = getGraphyGraphRefs(root);
  const previewRefs = getPreviewRefs(root);
  const insights = bindGraphyInsights(root, controller.signal);
  const mountGraph = (): void => {
    if (!graphRefs.graph) return;
    mountWikiHomeGraph(root, graphRefs.graph, controller.signal, {
      labels: "all",
      colorMode,
      onNodeSelect: (node) => {
        void openGraphNodePreview(root, previewRefs, node, controller.signal);
      },
      onGraphLoad: (payload) => {
        insights.setInsights(findSurprisingConnections(payload), detectKnowledgeGaps(payload));
        renderGraphyLegend(graphRefs.legend, payload, colorMode);
      },
    });
  };
  mountGraph();
  bindGraphyColorMode(root, (nextMode) => {
    colorMode = nextMode;
    setGraphyColorMode(root, colorMode);
    mountGraph();
  });
  setGraphyColorMode(root, colorMode);
  bindGraphyBackButton(root);
  bindGraphyPreviewClose(root, previewRefs);
  root.__dispose = () => {
    controller.abort();
    disposeWikiHomeGraph(root);
    insights.close();
  };
  return root;
}

function renderGraphPageShell(): string {
  return `
    <header class="graphy-page__header">
      <button type="button" class="graphy-page__back" data-graphy-back>🔙 返回</button>
      <div>
        <p class="graphy-page__eyebrow">PEIWEIPEDIA</p>
        <h1>Graphy</h1>
      </div>
      <div class="graphy-page__mode" role="group" aria-label="Graph color mode">
        <button type="button" data-graphy-color-mode="type">Type</button>
        <button type="button" data-graphy-color-mode="community">Community</button>
      </div>
      <button type="button" class="graphy-page__insights-button" data-graphy-insights-toggle aria-expanded="false">Insights</button>
    </header>
    <main class="graphy-page__main">
      <div class="graphy-page__graph-wrap">
        <div class="graphy-page__graph" data-graphy-page-graph>正在加载 Graphy…</div>
        <aside class="graphy-page__legend" data-graphy-legend></aside>
      </div>
      <aside class="graphy-page__insights" data-graphy-insights-panel hidden></aside>
      <aside class="graphy-page__preview" data-graphy-preview hidden aria-live="polite">
        <header class="graphy-page__preview-header">
          <div>
            <p class="graphy-page__eyebrow">WIKI PREVIEW</p>
            <h2 data-graphy-preview-title>Wiki</h2>
            <p data-graphy-preview-path></p>
          </div>
          <button type="button" class="graphy-page__preview-close" data-graphy-preview-close aria-label="关闭预览">&times;</button>
        </header>
        <div class="graphy-page__preview-content" data-graphy-preview-content></div>
      </aside>
    </main>
  `;
}

function getGraphyGraphRefs(root: HTMLElement): GraphyGraphRefs {
  return {
    graph: root.querySelector<HTMLElement>("[data-graphy-page-graph]"),
    legend: root.querySelector<HTMLElement>("[data-graphy-legend]"),
  };
}

function bindGraphyColorMode(root: HTMLElement, onChange: (mode: GraphyColorMode) => void): void {
  root.querySelectorAll<HTMLButtonElement>("[data-graphy-color-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.graphyColorMode;
      if (mode === "type" || mode === "community") onChange(mode);
    });
  });
}

function setGraphyColorMode(root: HTMLElement, mode: GraphyColorMode): void {
  root.querySelectorAll<HTMLButtonElement>("[data-graphy-color-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.graphyColorMode === mode);
  });
}

function bindGraphyBackButton(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("[data-graphy-back]")?.addEventListener("click", () => {
    window.location.hash = WIKI_HOME_ROUTE;
  });
}

function bindGraphyPreviewClose(root: HTMLElement, refs: GraphyPreviewRefs): void {
  root.querySelector<HTMLButtonElement>("[data-graphy-preview-close]")?.addEventListener("click", () => {
    refs.panel.hidden = true;
    root.classList.remove("graphy-page--preview-open");
  });
}

function getPreviewRefs(root: HTMLElement): GraphyPreviewRefs {
  return {
    panel: root.querySelector<HTMLElement>("[data-graphy-preview]")!,
    title: root.querySelector<HTMLElement>("[data-graphy-preview-title]")!,
    path: root.querySelector<HTMLElement>("[data-graphy-preview-path]")!,
    content: root.querySelector<HTMLElement>("[data-graphy-preview-content]")!,
  };
}

function bindGraphyInsights(root: HTMLElement, signal: AbortSignal): GraphInsightsController {
  let controller: GraphInsightsController;
  const researchPanel = bindGraphResearchPanel(root, signal);
  controller = bindGraphInsightsPanel(root, getGraphInsightsRefs(root), {
    onHighlight: (nodeIds) => setWikiHomeGraphHighlights(root, nodeIds),
    onResearch: (gap) => {
      researchPanel.start(gap);
      controller.setResearchStatus(`准备研究：${gap.title}`);
    },
  });
  return controller;
}

function getGraphInsightsRefs(root: HTMLElement): GraphInsightsRefs {
  return {
    button: root.querySelector<HTMLButtonElement>("[data-graphy-insights-toggle]")!,
    panel: root.querySelector<HTMLElement>("[data-graphy-insights-panel]")!,
  };
}

async function openGraphNodePreview(
  root: HTMLElement,
  refs: GraphyPreviewRefs,
  node: GraphySelectedNode,
  signal: AbortSignal,
): Promise<void> {
  showPreviewLoading(root, refs, node);
  try {
    const response = await fetch(`/api/page?path=${encodeURIComponent(node.path)}&raw=0`, { signal });
    if (!response.ok) throw new Error("page not found");
    const page = (await response.json()) as GraphyPageResponse;
    if (signal.aborted) return;
    refs.title.textContent = page.title ?? node.label;
    refs.path.textContent = page.path;
    refs.content.innerHTML = renderGraphPreview(page, node);
  } catch {
    if (!signal.aborted) {
      refs.content.innerHTML = `<p class="graphy-page__preview-empty">无法加载这个 Wiki 文件。</p>`;
    }
  }
}

function showPreviewLoading(root: HTMLElement, refs: GraphyPreviewRefs, node: GraphySelectedNode): void {
  root.classList.add("graphy-page--preview-open");
  refs.panel.hidden = false;
  refs.title.textContent = node.label;
  refs.path.textContent = node.path;
  refs.content.innerHTML = `<p class="graphy-page__preview-empty">正在加载 Wiki 预览...</p>`;
}

function renderGraphPreview(page: GraphyPageResponse, node: GraphySelectedNode): string {
  const article = page.html || `<p class="graphy-page__preview-empty">这个 Wiki 文件没有正文内容。</p>`;
  return `
    <section class="graphy-page__meta-card">
      ${renderGraphPreviewMetadata(page, node)}
    </section>
    <article class="graphy-page__article markdown-rendered">${article}</article>
  `;
}

function renderGraphPreviewMetadata(page: GraphyPageResponse, node: GraphySelectedNode): string {
  const rows = collectMetadataRows(page, node).map(renderMetadataRow).join("");
  return rows || `<p class="graphy-page__preview-empty">没有可展示的元信息。</p>`;
}

function collectMetadataRows(
  page: GraphyPageResponse,
  node: GraphySelectedNode,
): GraphyMetadataEntry[] {
  const frontmatter = page.frontmatter ?? {};
  return [
    { label: "title", value: frontmatter.title ?? page.title ?? node.label },
    { label: "type", value: frontmatter.type ?? node.type },
    { label: "updated", value: frontmatter.updated ?? page.modifiedAt },
    { label: "tags", value: frontmatter.tags },
    { label: "sources", value: frontmatter.sources },
    { label: "related", value: frontmatter.related },
  ].filter((entry) => valueToList(entry.value).length > 0);
}

function renderMetadataRow(entry: GraphyMetadataEntry): string {
  return `
    <div class="graphy-page__meta-row">
      <span>${escapeHtml(entry.label)}</span>
      <div>${renderMetadataValue(entry.value)}</div>
    </div>
  `;
}

function renderMetadataValue(value: unknown): string {
  const values = valueToList(value);
  if (values.length === 1) {
    return `<strong>${escapeHtml(values[0] ?? "")}</strong>`;
  }
  return values.map((item) => `<code>${escapeHtml(item)}</code>`).join("");
}

function valueToList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return [];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => HTML_ESCAPE_MAP[character] ?? character);
}

function renderGraphyLegend(
  legend: HTMLElement | null,
  payload: Parameters<typeof findSurprisingConnections>[0],
  colorMode: GraphyColorMode,
): void {
  if (!legend) return;
  legend.innerHTML = colorMode === "community" ? renderCommunityLegend(payload) : renderTypeLegend(payload);
}

function renderCommunityLegend(payload: Parameters<typeof findSurprisingConnections>[0]): string {
  return `
    <h2>Communities</h2>
    <div class="graphy-page__legend-list">
      ${payload.communities.map((community) => `
        <div class="graphy-page__legend-row">
          <span class="graphy-page__legend-dot" style="background:${communityColor(community.id)}"></span>
          <span title="${escapeHtml(community.topNodes.join(", "))}">${escapeHtml(community.topNodes[0] ?? `Cluster ${community.id}`)}</span>
          <strong>${community.nodeCount}</strong>
          ${community.cohesion < SPARSE_COMMUNITY_COHESION && community.nodeCount >= 3
            ? `<em title="Low cohesion: ${community.cohesion.toFixed(2)}">!</em>`
            : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderTypeLegend(payload: Parameters<typeof findSurprisingConnections>[0]): string {
  const counts = new Map<string, number>();
  for (const node of payload.nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  return `
    <h2>Node Types</h2>
    <div class="graphy-page__legend-list">
      ${[...counts.entries()].map(([type, count]) => `
        <div class="graphy-page__legend-row">
          <span class="graphy-page__legend-dot" style="background:${typeColor(type)}"></span>
          <span>${escapeHtml(type)}</span>
          <strong>${count}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function communityColor(community: number): string {
  return COMMUNITY_COLORS[Math.abs(community) % COMMUNITY_COLORS.length] ?? "#94a3b8";
}

function typeColor(type: string): string {
  return NODE_TYPE_COLORS[type] ?? NODE_TYPE_COLORS.other;
}
