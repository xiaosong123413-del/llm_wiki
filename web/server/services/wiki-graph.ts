/**
 * Builds the wiki-wide graph used by the home-cover Graphy panel.
 *
 * The graph is derived from markdown pages under the active `wiki` tree. This
 * file orchestrates parsing, relevance scoring, Louvain community detection,
 * and ForceAtlas2 layout so the browser can render the payload immediately.
 */
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { ServerConfig } from "../config.js";
import {
  BASE_NODE_SIZE,
  MAX_NODE_SIZE,
  NODE_COLORS,
  type ParsedWikiPage,
  type WikiGraphEdgeAttributes,
  type WikiGraphEdgePayload,
  type WikiGraphCommunityPayload,
  type WikiGraphNodeAttributes,
  type WikiGraphNodePayload,
  type WikiGraphPayload,
} from "./wiki-graph-model.js";
import { buildPageLookup, readWikiPages } from "./wiki-graph-pages.js";
import { buildEdges } from "./wiki-graph-relevance.js";

/** Builds the complete server-side graph payload for the Wiki home Graphy panel. */
export function buildWikiGraph(cfg: ServerConfig): WikiGraphPayload {
  const pages = readWikiPages(cfg).filter((page) => page.type !== "query");
  const lookup = buildPageLookup(pages);
  const edges = buildEdges(pages, lookup);
  const graph = createGraph(pages, edges);
  const communities = assignGraphCommunities(graph);
  assignGraphLayout(graph);
  return graphToPayload(graph, communities);
}

/** Builds the direct relation subgraph for one wiki page. */
export function buildWikiGraphForPage(cfg: ServerConfig, pagePath: string): WikiGraphPayload {
  return filterWikiGraphForPage(buildWikiGraph(cfg), pagePath);
}

/** Keeps only the current page, directly related pages, and their connecting edges. */
function filterWikiGraphForPage(graph: WikiGraphPayload, pagePath: string): WikiGraphPayload {
  const pageEdges = graph.edges.filter((edge) => edge.source === pagePath || edge.target === pagePath);
  if (pageEdges.length === 0) {
    return { ...graph, nodes: [], edges: [], communities: [] };
  }
  const nodeIds = new Set<string>();
  for (const edge of pageEdges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }
  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
  return {
    ...graph,
    nodes,
    edges: pageEdges,
    communities: summarizePayloadCommunities(nodes, pageEdges),
  };
}

function createGraph(
  pages: readonly ParsedWikiPage[],
  edges: readonly WikiGraphEdgePayload[],
): Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes> {
  const graph = new Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>({ type: "undirected" });
  pages.forEach((page, index) => graph.addNode(page.path, initialNodeAttributes(page, index, pages.length)));
  for (const edge of edges) {
    graph.addUndirectedEdgeWithKey(edge.id, edge.source, edge.target, {
      weight: edge.weight,
      label: edge.label,
    });
  }
  return graph;
}

function assignGraphCommunities(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
): WikiGraphCommunityPayload[] {
  if (graph.order === 0) {
    return [];
  }
  if (graph.size === 0) {
    let community = 0;
    graph.forEachNode((node) => {
      graph.setNodeAttribute(node, "community", community);
      community += 1;
    });
    return buildCommunityInfo(graph);
  }
  louvain.assign(graph, { resolution: 1, getEdgeWeight: "weight" });
  remapCommunitiesBySize(graph);
  return buildCommunityInfo(graph);
}

function assignGraphLayout(graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>): void {
  if (graph.order < 2) {
    graph.forEachNode((node) => graph.mergeNodeAttributes(node, { x: 0, y: 0 }));
    return;
  }
  forceAtlas2.assign(graph, {
    iterations: 150,
    getEdgeWeight: "weight",
    settings: {
      gravity: 1,
      scalingRatio: 2,
      strongGravityMode: true,
      barnesHutOptimize: graph.order > 50,
    },
  });
}

function graphToPayload(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
  communities: readonly WikiGraphCommunityPayload[],
): WikiGraphPayload {
  const maxRootDegree = Math.max(1, ...graph.nodes().map((node) => Math.sqrt(graph.degree(node))));
  return {
    generatedAt: new Date().toISOString(),
    nodes: graph.nodes().map((node) => nodeToPayload(graph, node, maxRootDegree)),
    edges: graph.edges().map((edge) => edgeToPayload(graph, edge)),
    communities: [...communities],
  };
}

function nodeToPayload(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
  node: string,
  maxRootDegree: number,
): WikiGraphNodePayload {
  const attributes = graph.getNodeAttributes(node);
  const linkCount = graph.degree(node);
  return {
    id: node,
    label: attributes.label,
    path: attributes.path,
    type: attributes.type,
    linkCount,
    community: attributes.community ?? 0,
    size: scaleNodeSize(linkCount, maxRootDegree),
    color: attributes.color,
    x: attributes.x,
    y: attributes.y,
  };
}

function edgeToPayload(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
  edge: string,
): WikiGraphEdgePayload {
  const attributes = graph.getEdgeAttributes(edge);
  return {
    id: edge,
    source: graph.source(edge),
    target: graph.target(edge),
    weight: attributes.weight,
    label: attributes.label,
  };
}

function initialNodeAttributes(page: ParsedWikiPage, index: number, total: number): WikiGraphNodeAttributes {
  const angle = total > 0 ? (index / total) * Math.PI * 2 : 0;
  return {
    label: page.title,
    path: page.path,
    type: page.type,
    color: NODE_COLORS[page.type],
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function scaleNodeSize(linkCount: number, maxRootDegree: number): number {
  const scaled = BASE_NODE_SIZE + (Math.sqrt(linkCount) / maxRootDegree) * (MAX_NODE_SIZE - BASE_NODE_SIZE);
  return Math.min(MAX_NODE_SIZE, Math.max(BASE_NODE_SIZE, Number(scaled.toFixed(2))));
}

function remapCommunitiesBySize(graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>): void {
  const remap = new Map<number, number>();
  groupNodeIdsByCommunity(graph)
    .sort((left, right) => right.nodeIds.length - left.nodeIds.length)
    .forEach((group, index) => remap.set(group.id, index));
  graph.forEachNode((node, attributes) => {
    graph.setNodeAttribute(node, "community", remap.get(attributes.community ?? 0) ?? 0);
  });
}

function buildCommunityInfo(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
): WikiGraphCommunityPayload[] {
  return groupNodeIdsByCommunity(graph)
    .map((group) => communityInfo(graph, group.id, group.nodeIds))
    .sort((left, right) => left.id - right.id);
}

function groupNodeIdsByCommunity(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
): Array<{ id: number; nodeIds: string[] }> {
  const groups = new Map<number, string[]>();
  graph.forEachNode((node, attributes) => {
    const community = attributes.community ?? 0;
    groups.set(community, [...(groups.get(community) ?? []), node]);
  });
  return [...groups.entries()].map(([id, nodeIds]) => ({ id, nodeIds }));
}

function communityInfo(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
  id: number,
  nodeIds: readonly string[],
): WikiGraphCommunityPayload {
  const members = new Set(nodeIds);
  return {
    id,
    nodeCount: nodeIds.length,
    cohesion: communityCohesion(graph, members, nodeIds.length),
    topNodes: topCommunityNodeLabels(graph, nodeIds),
  };
}

function communityCohesion(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
  members: ReadonlySet<string>,
  nodeCount: number,
): number {
  const internalEdges = graph.edges().filter((edge) => members.has(graph.source(edge)) && members.has(graph.target(edge)));
  const possibleEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 1;
  return Number((internalEdges.length / possibleEdges).toFixed(4));
}

function topCommunityNodeLabels(
  graph: Graph<WikiGraphNodeAttributes, WikiGraphEdgeAttributes>,
  nodeIds: readonly string[],
): string[] {
  return [...nodeIds]
    .sort((left, right) => graph.degree(right) - graph.degree(left))
    .slice(0, 5)
    .map((node) => graph.getNodeAttribute(node, "label"));
}

function summarizePayloadCommunities(
  nodes: readonly WikiGraphNodePayload[],
  edges: readonly WikiGraphEdgePayload[],
): WikiGraphCommunityPayload[] {
  return groupPayloadNodesByCommunity(nodes)
    .map((group) => payloadCommunityInfo(group.id, group.nodes, edges))
    .sort((left, right) => left.id - right.id);
}

function groupPayloadNodesByCommunity(
  nodes: readonly WikiGraphNodePayload[],
): Array<{ id: number; nodes: WikiGraphNodePayload[] }> {
  const groups = new Map<number, WikiGraphNodePayload[]>();
  for (const node of nodes) {
    groups.set(node.community, [...(groups.get(node.community) ?? []), node]);
  }
  return [...groups.entries()].map(([id, groupedNodes]) => ({ id, nodes: groupedNodes }));
}

function payloadCommunityInfo(
  id: number,
  nodes: readonly WikiGraphNodePayload[],
  edges: readonly WikiGraphEdgePayload[],
): WikiGraphCommunityPayload {
  const memberIds = new Set(nodes.map((node) => node.id));
  const internalEdges = edges.filter((edge) => memberIds.has(edge.source) && memberIds.has(edge.target));
  const possibleEdges = nodes.length > 1 ? (nodes.length * (nodes.length - 1)) / 2 : 1;
  return {
    id,
    nodeCount: nodes.length,
    cohesion: Number((internalEdges.length / possibleEdges).toFixed(4)),
    topNodes: [...nodes].sort((left, right) => right.linkCount - left.linkCount).slice(0, 5).map((node) => node.label),
  };
}
