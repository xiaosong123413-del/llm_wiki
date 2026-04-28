/**
 * Tracks entity mentions and derived entity-tier summaries for runtime indexing.
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { suggestEntityTier } from "./entity-enrichment.js";

export type EntityTier = 1 | 2 | 3;

interface EntityMentionInput {
  entityId: string;
  entityTitle?: string;
  sourcePath: string;
  confirmedAt: string;
}

export interface EntityRecord {
  id: string;
  title: string;
  mentionCount: number;
  sourceDiversity: number;
  sourcePaths: string[];
  lastConfirmedAt?: string;
  tier?: EntityTier;
}

export interface EntityIndex {
  version: 1;
  entities: Record<string, EntityRecord>;
}

interface EntitySummary {
  id: string;
  title: string;
  mentionCount: number;
  sourceDiversity: number;
  lastConfirmedAt?: string;
  tier?: EntityTier;
}

const ENTITY_INDEX_FILE = path.join(".llmwiki", "entity-index.json");

export function createEmptyEntityIndex(): EntityIndex {
  return {
    version: 1,
    entities: {},
  };
}

function getEntityIndexPath(vaultRoot: string): string {
  return path.join(vaultRoot, ENTITY_INDEX_FILE);
}

async function loadEntityIndex(vaultRoot: string): Promise<EntityIndex> {
  try {
    const raw = await readFile(getEntityIndexPath(vaultRoot), "utf8");
    return normalizeEntityIndex(JSON.parse(raw));
  } catch {
    return createEmptyEntityIndex();
  }
}

async function saveEntityIndex(vaultRoot: string, index: EntityIndex): Promise<void> {
  const filePath = getEntityIndexPath(vaultRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalizeEntityIndex(index), null, 2)}\n`, "utf8");
}

export function upsertEntityMention(index: EntityIndex, mention: EntityMentionInput): EntityRecord {
  const entityId = mention.entityId.trim();
  if (!entityId) {
    throw new Error("entityId is required.");
  }

  const current = index.entities[entityId] ?? {
    id: entityId,
    title: mention.entityTitle?.trim() || entityId,
    mentionCount: 0,
    sourceDiversity: 0,
    sourcePaths: [],
    lastConfirmedAt: undefined,
    tier: undefined,
  };

  current.mentionCount += 1;
  current.title = mention.entityTitle?.trim() || current.title || entityId;
  const normalizedSourcePath = normalizeSourcePath(mention.sourcePath);
  if (normalizedSourcePath && !current.sourcePaths.includes(normalizedSourcePath)) {
    current.sourcePaths.push(normalizedSourcePath);
  }
  current.sourceDiversity = current.sourcePaths.length;
  current.lastConfirmedAt = chooseLatestIso(current.lastConfirmedAt, mention.confirmedAt);
  current.tier = suggestEntityTier(current);

  index.entities[entityId] = current;
  return current;
}

export function summarizeEntity(record: EntityRecord): EntitySummary {
  return {
    id: record.id,
    title: record.title,
    mentionCount: record.mentionCount,
    sourceDiversity: record.sourceDiversity,
    lastConfirmedAt: record.lastConfirmedAt,
    tier: record.tier,
  };
}

function normalizeEntityIndex(index: EntityIndex): EntityIndex {
  const normalized: EntityIndex = createEmptyEntityIndex();
  for (const [entityId, record] of Object.entries(index.entities ?? {})) {
    const sourcePaths = uniquePaths(record.sourcePaths ?? []);
    const mentionCount = toCount(record.mentionCount);
    const sourceDiversity = sourcePaths.length;
    const lastConfirmedAt = normalizeIso(record.lastConfirmedAt);
    normalized.entities[entityId] = {
      id: record.id || entityId,
      title: record.title || entityId,
      mentionCount,
      sourceDiversity,
      sourcePaths,
      lastConfirmedAt,
      tier: suggestEntityTier({
        mentionCount,
        sourceDiversity,
        lastConfirmedAt,
      }),
    };
  }
  return normalized;
}

function normalizeSourcePath(sourcePath: string): string {
  return sourcePath.trim().replaceAll("\\", "/").toLowerCase();
}

function uniquePaths(paths: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const sourcePath of paths) {
    const normalized = normalizeSourcePath(sourcePath);
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

function toCount(value: number | string | undefined): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
}

function normalizeIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
}

function chooseLatestIso(current: string | undefined, candidate: string): string {
  const next = normalizeIso(candidate);
  if (!next) return current ?? candidate;
  if (!current) return next;
  const currentTime = new Date(current).getTime();
  const nextTime = new Date(next).getTime();
  return nextTime >= currentTime ? next : current;
}
