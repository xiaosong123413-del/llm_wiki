/**
 * Search and AI result helpers for the Remote Brain Worker.
 *
 * These helpers keep the main Worker entrypoint focused on routing while
 * centralizing search result shaping and Workers AI text extraction.
 */

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  rank: number;
  source: string;
}

export function normalizeSearchLimit(limit: unknown): number {
  return Math.max(1, Math.min(Number(limit ?? 10), 30));
}

export function keywordResultsFromRows(rows: readonly Record<string, unknown>[]): SearchResultItem[] {
  return rows.map((item, rank) => ({
    title: String(item.title ?? ""),
    url: String(item.url ?? ""),
    snippet: String(item.snippet ?? ""),
    rank,
    source: "keyword",
  }));
}

export function vectorResultsFromMatches(
  matches: readonly Array<{ id: unknown; metadata?: unknown }>,
): SearchResultItem[] {
  return matches.map((match, rank) => {
    const metadata = readRecord(match.metadata);
    return {
      title: String(metadata?.title ?? metadata?.path ?? match.id),
      url: String(metadata?.path ?? match.id),
      snippet: String(metadata?.excerpt ?? ""),
      rank,
      source: "vector",
    };
  });
}

export function extractWorkerText(result: unknown): string {
  if (typeof result === "string") return result;
  const record = readRecord(result);
  if (!record) return "";
  const nested = readRecord(record.result);
  return firstTextValue([
    record.response,
    record.text,
    record.generated_text,
    nested?.response,
    nested?.text,
    nested?.description,
    nested?.generated_text,
  ]);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function firstTextValue(values: readonly unknown[]): string {
  return String(values.find((value) => typeof value === "string" && value.length > 0) ?? "");
}
