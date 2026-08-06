/**
 * Page-local Graphy widget for ordinary wiki articles.
 *
 * It renders only the current page, directly connected pages, and the
 * connecting relevance edges. The layout is radial so the article header gets
 * a compact relationship map instead of the full wiki-wide graph.
 */
import type Graph from "graphology";
import type Sigma from "sigma";
import type { Settings } from "sigma/settings";
import { waitForGraphStageSize } from "./home-graph.js";

interface WikiPageGraphNode {
  id: string;
  label: string;
  path: string;
  type: string;
  size: number;
  color: string;
}

interface WikiPageGraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  label: string;
}

interface WikiPageGraphPayload {
  nodes: WikiPageGraphNode[];
  edges: WikiPageGraphEdge[];
}

interface WikiPageGraphApiResponse {
  success?: boolean;
  data?: WikiPageGraphPayload;
}

interface PageGraphNodeAttributes {
  label: string;
  path: string;
  nodeType: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface PageGraphEdgeAttributes {
  label: string;
  weight: number;
  size: number;
  color: string;
}

interface MountedGraph {
  kill: () => void;
}

const mountedPageGraphs = new WeakMap<HTMLElement, MountedGraph>();
const PAGE_GRAPH_RING_SIZE = 24;

export function mountWikiPageGraph(
  root: HTMLElement,
  container: HTMLElement,
  pagePath: string,
  signal: AbortSignal,
): void {
  disposeWikiPageGraph(root);
  container.hidden = false;
  container.innerHTML = renderPageGraphShell(`<p class="wiki-page__graph-placeholder">正在加载 Graphy...</p>`);
  void loadWikiPageGraph(root, container, pagePath, signal);
}

export function clearWikiPageGraph(root: HTMLElement, container: HTMLElement): void {
  disposeWikiPageGraph(root);
  container.hidden = true;
  container.innerHTML = "";
}

export function disposeWikiPageGraph(root: HTMLElement): void {
  mountedPageGraphs.get(root)?.kill();
  mountedPageGraphs.delete(root);
}

async function loadWikiPageGraph(
  root: HTMLElement,
  container: HTMLElement,
  pagePath: string,
  signal: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(`/api/wiki/graph?path=${encodeURIComponent(pagePath)}`, { signal });
    const payload = (await response.json()) as WikiPageGraphApiResponse;
    if (signal.aborted) return;
    const graph = payload.success === false ? null : payload.data;
    if (!isWikiPageGraphPayload(graph) || graph.nodes.length < 2 || graph.edges.length === 0) {
      renderPageGraphEmpty(container);
      return;
    }
    await renderSigmaPageGraph(root, container, graph, pagePath, signal);
  } catch {
    if (!signal.aborted) {
      renderPageGraphEmpty(container);
    }
  }
}

async function renderSigmaPageGraph(
  root: HTMLElement,
  container: HTMLElement,
  payload: WikiPageGraphPayload,
  pagePath: string,
  signal: AbortSignal,
): Promise<void> {
  const [{ default: GraphCtor }, { default: SigmaCtor }] = await Promise.all([
    import("graphology"),
    import("sigma"),
  ]);
  if (signal.aborted) return;

  const graph = createPageGraph(GraphCtor, payload, pagePath);
  container.innerHTML = renderPageGraphShell(`
    <div class="wiki-page__graph-stage" data-wiki-page-graph-stage></div>
    <div class="wiki-page__graph-meta">${payload.nodes.length - 1} 个相关条目 · ${payload.edges.length} 条连接</div>
  `);
  const stage = container.querySelector<HTMLElement>("[data-wiki-page-graph-stage]");
  if (!stage) return;

  await waitForGraphStageSize(stage, signal);
  if (signal.aborted) return;
  const renderer = new SigmaCtor(graph, stage, PAGE_GRAPH_SETTINGS);
  mountedPageGraphs.set(root, { kill: () => renderer.kill() });
}

function createPageGraph(
  GraphCtor: typeof Graph,
  payload: WikiPageGraphPayload,
  pagePath: string,
): Graph<PageGraphNodeAttributes, PageGraphEdgeAttributes> {
  const graph = new GraphCtor<PageGraphNodeAttributes, PageGraphEdgeAttributes>({ type: "undirected" });
  const positions = pageGraphPositions(payload.nodes, pagePath);
  for (const node of payload.nodes) {
    graph.addNode(node.id, toNodeAttributes(node, positions.get(node.id), node.id === pagePath));
  }
  for (const edge of payload.edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.addUndirectedEdgeWithKey(edge.id, edge.source, edge.target, toEdgeAttributes(edge));
    }
  }
  return graph;
}

function pageGraphPositions(
  nodes: readonly WikiPageGraphNode[],
  pagePath: string,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(pagePath, { x: 0, y: 0 });
  nodes.filter((node) => node.id !== pagePath).forEach((node, index) => {
    const ring = Math.floor(index / PAGE_GRAPH_RING_SIZE);
    const ringStart = ring * PAGE_GRAPH_RING_SIZE;
    const ringCount = Math.min(PAGE_GRAPH_RING_SIZE, nodes.length - 1 - ringStart);
    const angle = -Math.PI / 2 + (Math.PI * 2 * (index - ringStart)) / Math.max(1, ringCount);
    const radius = 1.8 + ring * 0.72;
    positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return positions;
}

function toNodeAttributes(
  node: WikiPageGraphNode,
  position: { x: number; y: number } | undefined,
  isCurrentPage: boolean,
): PageGraphNodeAttributes {
  return {
    label: node.label,
    path: node.path,
    nodeType: node.type,
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    size: isCurrentPage ? 11 : Math.max(4, Math.min(8, node.size * 0.32)),
    color: isCurrentPage ? "#111827" : node.color,
  };
}

function toEdgeAttributes(edge: WikiPageGraphEdge): PageGraphEdgeAttributes {
  return {
    label: edge.label,
    weight: edge.weight,
    size: Math.max(0.7, Math.min(2.4, Math.sqrt(edge.weight) * 0.55)),
    color: "rgba(51, 65, 85, 0.48)",
  };
}

function renderPageGraphShell(body: string): string {
  return `
    <article class="wiki-page__graph-card">
      <div class="wiki-page__graph-header">
        <h2>Graphy</h2>
      </div>
      <div class="wiki-page__graph-body">${body}</div>
    </article>
  `;
}

function renderPageGraphEmpty(container: HTMLElement): void {
  container.innerHTML = renderPageGraphShell(
    `<p class="wiki-page__graph-placeholder">当前条目还没有可展示的相关连接。</p>`,
  );
}

function isWikiPageGraphPayload(value: WikiPageGraphPayload | null | undefined): value is WikiPageGraphPayload {
  return Array.isArray(value?.nodes) && Array.isArray(value?.edges);
}

const PAGE_GRAPH_SETTINGS: Partial<Settings<PageGraphNodeAttributes, PageGraphEdgeAttributes>> = {
  renderEdgeLabels: false,
  defaultEdgeColor: "#64748b",
  defaultNodeColor: "#94a3b8",
  labelDensity: 1,
  labelRenderedSizeThreshold: 0,
  labelSize: 13,
  labelWeight: "bold",
  stagePadding: 44,
};
