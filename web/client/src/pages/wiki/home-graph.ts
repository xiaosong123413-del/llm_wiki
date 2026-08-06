/**
 * Sigma-backed Graphy widget for the dedicated wiki home cover.
 *
 * The server owns graph construction, relevance scoring, Louvain communities,
 * and ForceAtlas2 layout. This client module keeps the DOM page small: fetch
 * the graph, hydrate graphology, mount Sigma, and clean up on route changes.
 */
import type Graph from "graphology";
import type Sigma from "sigma";
import type { Settings } from "sigma/settings";

export interface WikiHomeGraphNode {
  id: string;
  label: string;
  path: string;
  type: string;
  community: number;
  size: number;
  color: string;
  x: number;
  y: number;
}

export interface WikiHomeGraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  label: string;
}

interface WikiHomeGraphCommunity {
  id: number;
  nodeCount: number;
  cohesion: number;
  topNodes: string[];
}

export interface WikiHomeGraphPayload {
  nodes: WikiHomeGraphNode[];
  edges: WikiHomeGraphEdge[];
  communities: WikiHomeGraphCommunity[];
}

interface WikiHomeGraphApiResponse {
  success?: boolean;
  data?: WikiHomeGraphPayload;
  error?: string;
}

interface GraphNodeAttributes {
  label: string;
  path: string;
  nodeType: string;
  community: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface GraphEdgeAttributes {
  label: string;
  weight: number;
  size: number;
  color: string;
}

interface MountedGraph {
  kill: () => void;
  setHighlights: (nodeIds: readonly string[]) => void;
}

interface WikiHomeGraphSelectedNode {
  id: string;
  label: string;
  path: string;
  type: string;
}

interface WikiHomeGraphMountOptions {
  labels?: "sparse" | "all";
  colorMode?: WikiHomeGraphColorMode;
  onNodeSelect?: (node: WikiHomeGraphSelectedNode) => void;
  onGraphLoad?: (payload: WikiHomeGraphPayload) => void;
}

type WikiHomeGraphColorMode = "type" | "community";

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
const HOME_NODE_SIZE_FACTOR = 0.45;
const MIN_HOME_NODE_SIZE = 3;
const MAX_HOME_NODE_SIZE = 13;

const mountedGraphs = new WeakMap<HTMLElement, MountedGraph>();

export function mountWikiHomeGraph(
  root: HTMLElement,
  container: HTMLElement,
  signal: AbortSignal,
  options: WikiHomeGraphMountOptions = {},
): void {
  disposeWikiHomeGraph(root);
  container.innerHTML = `<p class="wiki-home-cover__placeholder">正在加载 Graphy…</p>`;
  void loadWikiHomeGraph(root, container, signal, options);
}

export function disposeWikiHomeGraph(root: HTMLElement): void {
  mountedGraphs.get(root)?.kill();
  mountedGraphs.delete(root);
}

export function setWikiHomeGraphHighlights(root: HTMLElement, nodeIds: readonly string[]): void {
  mountedGraphs.get(root)?.setHighlights(nodeIds);
}

async function loadWikiHomeGraph(
  root: HTMLElement,
  container: HTMLElement,
  signal: AbortSignal,
  options: WikiHomeGraphMountOptions,
): Promise<void> {
  try {
    const response = await fetch("/api/wiki/graph", { signal });
    const payload = (await response.json()) as WikiHomeGraphApiResponse;
    if (signal.aborted) return;
    const graph = payload.success === false ? null : payload.data;
    if (!isWikiHomeGraphPayload(graph) || graph.nodes.length === 0) {
      renderGraphEmpty(container);
      return;
    }
    await renderSigmaGraph(root, container, graph, signal, options);
  } catch {
    if (!signal.aborted) {
      renderGraphError(container);
    }
  }
}

async function renderSigmaGraph(
  root: HTMLElement,
  container: HTMLElement,
  payload: WikiHomeGraphPayload,
  signal: AbortSignal,
  options: WikiHomeGraphMountOptions,
): Promise<void> {
  const [{ default: GraphCtor }, { default: SigmaCtor }] = await Promise.all([
    import("graphology"),
    import("sigma"),
  ]);
  if (signal.aborted) return;

  const graph = createGraph(GraphCtor, payload, options.colorMode ?? "community");
  container.innerHTML = `
    <div class="wiki-home-cover__graph-stage" data-wiki-home-graph-stage></div>
    <div class="wiki-home-cover__graph-meta">${payload.nodes.length} 个节点 · ${payload.edges.length} 条关系</div>
  `;
  const stage = container.querySelector<HTMLElement>("[data-wiki-home-graph-stage]");
  if (!stage) return;

  await waitForGraphStageSize(stage, signal);
  if (signal.aborted) return;
  const renderer = new SigmaCtor(graph, stage, graphSettings(options));
  bindGraphNodeSelection(renderer, graph, options);
  mountedGraphs.set(root, {
    kill: () => renderer.kill(),
    setHighlights: createGraphHighlightManager(renderer, graph),
  });
  options.onGraphLoad?.(payload);
}

type SigmaNodeEvent = { node: string };

type SigmaNodeEventRenderer = Sigma<GraphNodeAttributes, GraphEdgeAttributes> & {
  on(event: "clickNode", handler: (event: SigmaNodeEvent) => void): void;
};

function bindGraphNodeSelection(
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes>,
  graph: Graph<GraphNodeAttributes, GraphEdgeAttributes>,
  options: WikiHomeGraphMountOptions,
): void {
  if (!options.onNodeSelect) return;
  const selectableRenderer = renderer as SigmaNodeEventRenderer;
  selectableRenderer.on("clickNode", ({ node }) => {
    if (!graph.hasNode(node)) return;
    const attributes = graph.getNodeAttributes(node);
    options.onNodeSelect?.({
      id: node,
      label: attributes.label,
      path: attributes.path,
      type: attributes.nodeType,
    });
  });
}

function createGraphHighlightManager(
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes>,
  graph: Graph<GraphNodeAttributes, GraphEdgeAttributes>,
): (nodeIds: readonly string[]) => void {
  return (nodeIds) => {
    const highlighted = new Set(nodeIds);
    if (highlighted.size === 0) {
      renderer.setSettings({ nodeReducer: null, edgeReducer: null }).refresh();
      return;
    }
    renderer.setSettings({
      nodeReducer: (node, data) => reduceHighlightedNode(node, data, highlighted),
      edgeReducer: (edge, data) => reduceHighlightedEdge(edge, data, highlighted, graph),
    }).refresh();
  };
}

function reduceHighlightedNode(
  node: string,
  data: GraphNodeAttributes,
  highlighted: ReadonlySet<string>,
) {
  if (highlighted.has(node)) {
    return { ...data, color: data.color, size: data.size * 1.25, forceLabel: true };
  }
  return {
    ...data,
    color: "rgba(148, 163, 184, 0.2)",
    label: "",
    size: Math.max(2, data.size * 0.65),
  };
}

function reduceHighlightedEdge(
  edge: string,
  data: GraphEdgeAttributes,
  highlighted: ReadonlySet<string>,
  graph: Graph<GraphNodeAttributes, GraphEdgeAttributes>,
) {
  const sourceHit = highlighted.has(graph.source(edge));
  const targetHit = highlighted.has(graph.target(edge));
  if (sourceHit && targetHit) {
    return { ...data, color: "rgba(51, 102, 204, 0.72)", size: Math.max(1.4, data.size * 1.6) };
  }
  if (sourceHit || targetHit) {
    return { ...data, color: "rgba(96, 165, 250, 0.18)", size: Math.max(0.45, data.size * 0.7) };
  }
  return { ...data, color: "rgba(148, 163, 184, 0.12)", size: Math.max(0.2, data.size * 0.45) };
}

function createGraph(
  GraphCtor: typeof Graph,
  payload: WikiHomeGraphPayload,
  colorMode: WikiHomeGraphColorMode,
): Graph<GraphNodeAttributes, GraphEdgeAttributes> {
  const graph = new GraphCtor<GraphNodeAttributes, GraphEdgeAttributes>({ type: "undirected" });
  for (const node of payload.nodes) {
    graph.addNode(node.id, toNodeAttributes(node, colorMode));
  }
  for (const edge of payload.edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.addUndirectedEdgeWithKey(edge.id, edge.source, edge.target, toEdgeAttributes(edge));
    }
  }
  return graph;
}

function toNodeAttributes(node: WikiHomeGraphNode, colorMode: WikiHomeGraphColorMode): GraphNodeAttributes {
  return {
    label: node.label,
    path: node.path,
    nodeType: node.type,
    community: node.community,
    x: node.x,
    y: node.y,
    size: scaleHomeNodeSize(node.size),
    color: colorMode === "community" ? communityColor(node.community) : node.color,
  };
}

function toEdgeAttributes(edge: WikiHomeGraphEdge): GraphEdgeAttributes {
  return {
    label: edge.label,
    weight: edge.weight,
    size: Math.max(0.55, Math.min(2.2, Math.sqrt(edge.weight) * 0.55)),
    color: "rgba(71, 85, 105, 0.4)",
  };
}

function communityColor(community: number): string {
  return COMMUNITY_COLORS[Math.abs(community) % COMMUNITY_COLORS.length] ?? "#94a3b8";
}

function scaleHomeNodeSize(size: number): number {
  const scaled = size * HOME_NODE_SIZE_FACTOR;
  return Math.max(MIN_HOME_NODE_SIZE, Math.min(MAX_HOME_NODE_SIZE, scaled));
}

function isWikiHomeGraphPayload(value: WikiHomeGraphPayload | null | undefined): value is WikiHomeGraphPayload {
  return Array.isArray(value?.nodes) && Array.isArray(value?.edges);
}

function renderGraphEmpty(container: HTMLElement): void {
  container.innerHTML = `<p class="wiki-home-cover__empty">当前还没有可展示的图谱关系。</p>`;
}

function renderGraphError(container: HTMLElement): void {
  container.innerHTML = `<p class="wiki-home-cover__empty">Graphy 暂时无法加载。</p>`;
}

/**
 * Waits for the newly inserted Sigma stage to receive layout dimensions.
 */
export function waitForGraphStageSize(stage: HTMLElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = (): void => {
      if (signal.aborted) {
        resolve();
        return;
      }
      if (stage.clientWidth > 0 && stage.clientHeight > 0) {
        resolve();
        return;
      }
      attempts += 1;
      if (attempts >= 30) {
        reject(new Error("Graphy stage has no layout size."));
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

const GRAPH_SETTINGS: Partial<Settings<GraphNodeAttributes, GraphEdgeAttributes>> = {
  renderEdgeLabels: false,
  defaultEdgeColor: "#cbd5e1",
  defaultNodeColor: "#94a3b8",
  labelSize: 13,
  labelWeight: "bold",
  labelDensity: 0.08,
  labelRenderedSizeThreshold: 12,
  stagePadding: 30,
};

function graphSettings(
  options: WikiHomeGraphMountOptions,
): Partial<Settings<GraphNodeAttributes, GraphEdgeAttributes>> {
  if (options.labels !== "all") {
    return GRAPH_SETTINGS;
  }
  return {
    ...GRAPH_SETTINGS,
    labelDensity: 1,
    labelRenderedSizeThreshold: 0,
    labelSize: 14,
  };
}
