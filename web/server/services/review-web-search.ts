import fs from "node:fs";
import path from "node:path";
import { needsDeepResearch } from "./deep-research.js";
import { aggregateReviewItems, type ReviewItem, type ReviewSummary } from "./review-aggregator.js";
import type { RunSnapshot } from "./run-manager.js";
import { searchAll } from "./search-orchestrator.js";

const REVIEW_WEB_SEARCH_FILE = "review-web-search-suggestions.json";

interface ReviewWebSearchContext {
  sourceVaultRoot: string;
  runtimeRoot: string;
  projectRoot: string;
  currentRun?: RunSnapshot | null;
}

interface ReviewWebSearchSuggestion {
  title: string;
  url: string;
  snippet: string;
}

type ReviewWebSearchSuggestionMap = Record<string, ReviewWebSearchSuggestion[]>;

export async function refreshReviewWebSearchSuggestions(context: ReviewWebSearchContext): Promise<void> {
  const summary = aggregateReviewItems(context);
  const nextSuggestions: ReviewWebSearchSuggestionMap = {};
  const candidates = summary.items.filter((item) => needsNetworkEvidence(item)).slice(0, 3);
  await Promise.all(candidates.map(async (item) => {
    try {
      const result = await searchAll(undefined, `${item.title} ${item.detail}`.slice(0, 180), {
        scope: "web",
        mode: "keyword",
        webLimit: 3,
      });
      if (result.web.results.length > 0) {
        nextSuggestions[item.id] = result.web.results;
      }
    } catch {
      // Background enrichment must not break the main run flow.
    }
  }));
  writeReviewWebSearchSuggestions(context.runtimeRoot, nextSuggestions);
}

export function attachStoredReviewWebSearchSuggestions(runtimeRoot: string, summary: ReviewSummary): ReviewSummary {
  const suggestions = readReviewWebSearchSuggestions(runtimeRoot);
  if (Object.keys(suggestions).length === 0) {
    return summary;
  }
  return {
    ...summary,
    items: summary.items.map((item) => {
      const cached = suggestions[item.id];
      return cached && cached.length > 0
        ? {
          ...item,
          webSearchSuggestions: cached,
        }
        : item;
    }),
  };
}

function needsNetworkEvidence(item: ReviewItem): boolean {
  return needsDeepResearch(`${item.title}\n${item.detail}`);
}

function resolveReviewWebSearchPath(runtimeRoot: string): string {
  return path.join(runtimeRoot, ".llmwiki", REVIEW_WEB_SEARCH_FILE);
}

function readReviewWebSearchSuggestions(runtimeRoot: string): ReviewWebSearchSuggestionMap {
  const filePath = resolveReviewWebSearchPath(runtimeRoot);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    return normalizeReviewWebSearchSuggestionMap(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return {};
  }
}

function writeReviewWebSearchSuggestions(runtimeRoot: string, suggestions: ReviewWebSearchSuggestionMap): void {
  const filePath = resolveReviewWebSearchPath(runtimeRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(suggestions, null, 2)}\n`, "utf8");
}

function normalizeReviewWebSearchSuggestionMap(value: unknown): ReviewWebSearchSuggestionMap {
  if (!isRecord(value)) {
    return {};
  }
  const normalized: ReviewWebSearchSuggestionMap = {};
  for (const [key, candidate] of Object.entries(value)) {
    const suggestions = Array.isArray(candidate)
      ? candidate.map((item) => normalizeReviewWebSearchSuggestion(item)).filter((item): item is ReviewWebSearchSuggestion => Boolean(item))
      : [];
    if (suggestions.length > 0) {
      normalized[key] = suggestions;
    }
  }
  return normalized;
}

function normalizeReviewWebSearchSuggestion(value: unknown): ReviewWebSearchSuggestion | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = stringField(value.title);
  const url = stringField(value.url);
  const snippet = stringField(value.snippet);
  if (!title || !url) {
    return null;
  }
  return { title, url, snippet };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
