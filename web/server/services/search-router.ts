import type { ServerConfig } from "../config.js";
import { loadSearchIndex, type SearchIndexEntry } from "./search-index.js";
import { dedupSearchResults } from "./search-dedup.js";
import { chooseSearchMode, type SearchMode as IntentSearchMode } from "./search-intent.js";
import { hybridSearch, rrfFusion, type RankedHit } from "./search-hybrid.js";
import { embedText, queryVectorSearch } from "../../../src/services/cloudflare-vector-search.js";

export type SearchMode = IntentSearchMode;

export interface SearchResult {
  id: string;
  title: string;
  path: string;
  layer: SearchIndexEntry["layer"];
  excerpt: string;
  tags: string[];
  modifiedAt: string | null;
}

export interface SearchResponse {
  mode: SearchMode;
  results: SearchResult[];
}

interface SearchIndexLookups {
  byPath: Map<string, SearchIndexEntry>;
  byId: Map<string, SearchIndexEntry>;
}

type VectorSearchMatch = Awaited<ReturnType<typeof queryVectorSearch>> extends { ok: true; data: Array<infer T> } ? T : never;

interface VectorSearchMetadata {
  path: string;
  title: string;
  excerpt: string;
}

export async function runSearch(cfg: ServerConfig | undefined, query: string, mode: SearchMode): Promise<SearchResponse> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { mode: chooseSearchMode(normalizedQuery), results: [] };
  }

  const effectiveMode = mode === "direct" || mode === "hybrid" ? mode : chooseSearchMode(normalizedQuery);
  const index = loadSearchIndex(cfg);
  if (effectiveMode === "hybrid") {
    const hybridResults = await runHybridSearch(index, normalizedQuery);
    return {
      mode: effectiveMode,
      results: dedupSearchResults(hybridResults.map((entry) => ({
        id: entry.id,
        title: entry.title,
        path: entry.path,
        layer: entry.layer,
        excerpt: entry.excerpt,
        tags: entry.tags,
        modifiedAt: entry.modifiedAt,
      }))),
    };
  }
  const results = dedupSearchResults(index
    .filter((entry) => matches(entry, normalizedQuery, effectiveMode))
    .slice(0, 20)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      path: entry.path,
      layer: entry.layer,
      excerpt: entry.excerpt,
      tags: entry.tags,
      modifiedAt: entry.modifiedAt,
    })));

  return { mode: effectiveMode, results };
}

async function runHybridSearch(index: SearchIndexEntry[], query: string): Promise<SearchIndexEntry[]> {
  const localResults = hybridSearch(index, query, { limit: 30 });
  const localRanked: RankedHit[] = localResults.map((entry) => ({
    ...entry,
    score: 1,
  }));
  const vectorRanked = await runVectorSearch(index, query);
  const fused = vectorRanked.length ? rrfFusion([vectorRanked, localRanked]) : localRanked;
  return fused.slice(0, 20).map((hit) => ({
    id: hit.id,
    title: hit.title ?? hit.id,
    path: hit.path ?? hit.id,
    layer: hit.layer ?? "unknown",
    excerpt: hit.excerpt ?? "",
    tags: hit.tags ?? [],
    modifiedAt: hit.modifiedAt ?? null,
  }));
}

async function runVectorSearch(index: SearchIndexEntry[], query: string): Promise<RankedHit[]> {
  const vector = await embedText(query);
  if (!vector.ok || !vector.data.length) return [];
  const matches = await queryVectorSearch(vector.data, 30);
  if (!matches.ok) return [];
  const lookups = createSearchIndexLookups(index);
  return matches.data.map((match) => toRankedVectorHit(match, lookups));
}

function matches(entry: SearchIndexEntry, query: string, mode: SearchMode): boolean {
  const values = [
    entry.id,
    entry.title,
    entry.path,
    entry.excerpt,
    entry.tags.join(" "),
  ].map((value) => value.toLowerCase());

  const normalizedQuery = query.toLowerCase();

  if (mode === "direct") {
    return matchesDirect(entry, normalizedQuery);
  }

  if (mode === "hybrid") {
    return matchesHybrid(values, normalizedQuery);
  }

  return values.some((value) => value.includes(normalizedQuery));
}

function matchesDirect(entry: SearchIndexEntry, query: string): boolean {
  const path = normalizeSearchPath(entry.path);
  const title = entry.title.toLowerCase();
  const id = entry.id.toLowerCase();
  const baseName = path.split("/").pop() ?? "";
  const trimmedQuery = trimMarkdownExtension(query);

  if (matchesExactCandidate([path, title, id, baseName], query)) {
    return true;
  }

  if (trimmedQuery === trimMarkdownExtension(baseName)) {
    return true;
  }

  return matchesPathSuffix(path, [query, trimmedQuery]);
}

function matchesHybrid(values: string[], query: string): boolean {
  const tokens = query
    .split(/[\s,，。！？?/.\\_-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length <= 1) {
    return values.some((value) => value.includes(query));
  }

  return tokens.every((token) => values.some((value) => value.includes(token)));
}

function normalizeSearchPath(pathValue: string): string {
  return pathValue.toLowerCase().replaceAll("\\", "/");
}

function trimMarkdownExtension(value: string): string {
  return value.replace(/\.md$/, "");
}

function matchesExactCandidate(candidates: readonly string[], query: string): boolean {
  return candidates.some((candidate) => candidate === query);
}

function matchesPathSuffix(pathValue: string, queries: readonly string[]): boolean {
  return queries.some((query) => Boolean(query) && pathValue.endsWith(`/${query}`));
}

function createSearchIndexLookups(index: SearchIndexEntry[]): SearchIndexLookups {
  return {
    byPath: new Map(index.map((entry) => [normalizeSearchPath(entry.path), entry])),
    byId: new Map(index.map((entry) => [entry.id, entry])),
  };
}

function toRankedVectorHit(
  match: VectorSearchMatch,
  lookups: SearchIndexLookups,
): RankedHit {
  const metadata = readVectorSearchMetadata(match);
  const indexed = findIndexedVectorEntry(lookups, match.id, metadata.path);
  return {
    id: pickIndexedValue(indexed?.id, match.id),
    title: pickIndexedValue(indexed?.title, metadata.title),
    path: pickIndexedValue(indexed?.path, metadata.path),
    layer: pickIndexedValue(indexed?.layer, "wiki"),
    excerpt: pickIndexedValue(indexed?.excerpt, metadata.excerpt),
    tags: pickIndexedValue(indexed?.tags, []),
    modifiedAt: pickIndexedValue(indexed?.modifiedAt, null),
    score: match.score,
  };
}

function readVectorSearchMetadata(match: VectorSearchMatch): VectorSearchMetadata {
  const metadata = match.metadata ?? {};
  return {
    path: normalizeSearchPath(readMetadataText(metadata.path, match.id)),
    title: readMetadataText(metadata.title, match.id),
    excerpt: readMetadataText(metadata.excerpt, ""),
  };
}

function readMetadataText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function findIndexedVectorEntry(
  lookups: SearchIndexLookups,
  id: string,
  path: string,
): SearchIndexEntry | null {
  return lookups.byPath.get(path) ?? lookups.byId.get(id) ?? null;
}

function pickIndexedValue<T>(indexed: T | null | undefined, fallback: T): T {
  return indexed ?? fallback;
}
