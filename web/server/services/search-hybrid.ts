import type { SearchIndexEntry } from "./search-index.js";

export interface RankedHit {
  id: string;
  title?: string;
  path?: string;
  layer?: SearchIndexEntry["layer"];
  excerpt?: string;
  tags?: string[];
  modifiedAt?: string | null;
  score: number;
}

interface HybridSearchOpts {
  limit?: number;
  expansions?: string[];
}

export function compiledTruthBoost(layer?: SearchIndexEntry["layer"]): number {
  if (layer === "wiki") return 1.35;
  if (layer === "source") return 1.1;
  if (layer === "raw") return 1.0;
  return 1.0;
}

export function rrfFusion(lists: RankedHit[][], k = 60): RankedHit[] {
  const fused = new Map<string, RankedHit>();

  for (const list of lists) {
    list.forEach((hit, rank) => {
      const key = hit.id;
      const current = fused.get(key);
      const nextScore = 1 / (k + rank);
      const boostedScore = nextScore * compiledTruthBoost(hit.layer);
      if (!current || boostedScore > current.score) {
        fused.set(key, { ...hit, score: (current?.score ?? 0) + boostedScore });
      } else {
        current.score += boostedScore;
      }
    });
  }

  return [...fused.values()].sort((a, b) => b.score - a.score);
}

export function hybridSearch(entries: SearchIndexEntry[], query: string, opts?: HybridSearchOpts): SearchIndexEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const expansions = buildExpansions(normalizedQuery, opts?.expansions);
  const rankedLists = expansions.map((expansion) => rankEntries(entries, expansion));
  const fused = rrfFusion(rankedLists);
  const unique = dedupById(fused);
  return unique.slice(0, opts?.limit ?? 20).map((hit) => toEntry(hit));
}

function buildExpansions(query: string, overrides?: string[]): string[] {
  if (overrides && overrides.length > 0) return [...new Set([query, ...overrides.map((v) => v.trim().toLowerCase()).filter(Boolean)])];
  const tokens = query.split(/[\s,，。！？?/.\\_-]+/).map((token) => token.trim()).filter(Boolean);
  const expansions = [query];
  if (tokens.length > 1) expansions.push(tokens.join(" "));
  if (tokens.length > 0) expansions.push(...tokens);
  return [...new Set(expansions)];
}

function rankEntries(entries: SearchIndexEntry[], query: string): RankedHit[] {
  const tokens = query.split(/\s+/).filter(Boolean);

  return entries
    .map((entry) => ({
      ...entry,
      score: scoreEntry(entry, query, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scoreEntry(entry: SearchIndexEntry, query: string, tokens: string[]): number {
  const haystack = [
    entry.id,
    entry.title,
    entry.path,
    entry.excerpt,
    ...entry.tags,
  ].join(" ").toLowerCase();

  let score = 0;
  if (haystack.includes(query)) score += 4;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  if (entry.layer === "wiki" && haystack.includes(query)) score += 1.5;
  if (entry.layer === "source" && haystack.includes(query)) score += 0.5;
  if (entry.layer === "raw") score += 0.25;
  score += pathIntentBoost(entry.path, tokens);
  return score;
}

function pathIntentBoost(pathValue: string, tokens: string[]): number {
  const normalizedPath = pathValue.toLowerCase().replaceAll("\\", "/");
  const wantsProcedure = tokens.some((token) =>
    token === "procedure"
    || token === "workflow"
    || token === "runbook"
    || token === "playbook"
    || token === "triage",
  );

  if (!wantsProcedure) {
    return 0;
  }
  if (normalizedPath.startsWith("wiki/procedures/")) {
    return 5;
  }
  if (normalizedPath.startsWith("wiki/concepts/")) {
    return -1.5;
  }
  if (normalizedPath.startsWith("raw/")) {
    return -1;
  }
  return 0;
}

function dedupById(results: RankedHit[]): RankedHit[] {
  const chosen = new Map<string, RankedHit>();
  for (const hit of results) {
    const existing = chosen.get(hit.id);
    if (!existing || hit.score > existing.score) {
      chosen.set(hit.id, hit);
    }
  }
  return [...chosen.values()].sort((a, b) => b.score - a.score);
}

function toEntry(hit: RankedHit): SearchIndexEntry {
  return {
    id: hit.id,
    title: hit.title ?? hit.id,
    path: hit.path ?? hit.id,
    layer: hit.layer ?? "unknown",
    excerpt: hit.excerpt ?? "",
    tags: hit.tags ?? [],
    modifiedAt: hit.modifiedAt ?? null,
  };
}
