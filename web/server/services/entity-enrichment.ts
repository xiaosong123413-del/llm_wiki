import type { EntityIndex, EntityRecord, EntityTier } from "./entity-index.js";

interface EntityTierInput {
  mentionCount: number;
  sourceDiversity: number;
  lastConfirmedAt?: string;
  now?: Date;
}

type EntityTierSource = Pick<EntityRecord, "mentionCount" | "sourceDiversity" | "lastConfirmedAt"> & {
  now?: Date;
};

export function suggestEntityTier(input: EntityTierInput | EntityTierSource): EntityTier {
  const mentionCount = Math.max(0, Math.floor(input.mentionCount ?? 0));
  const sourceDiversity = Math.max(0, Math.floor(input.sourceDiversity ?? 0));
  const recent = isRecentlyConfirmed(input.lastConfirmedAt, input.now);

  if (mentionCount >= 5 || sourceDiversity >= 3 || (recent && mentionCount >= 3)) {
    return 3;
  }

  if (mentionCount >= 2 || sourceDiversity >= 2) {
    return 2;
  }

  return 1;
}

function enrichEntityRecord(record: EntityRecord, now = new Date()): EntityRecord {
  const mentionCount = Math.max(0, Math.floor(record.mentionCount ?? 0));
  const sourcePaths = [...new Set((record.sourcePaths ?? []).map((sourcePath) => normalizeSourcePath(sourcePath)).filter(Boolean))];
  const sourceDiversity = sourcePaths.length;
  const lastConfirmedAt = normalizeIso(record.lastConfirmedAt);

  return {
    ...record,
    mentionCount,
    sourceDiversity,
    sourcePaths,
    lastConfirmedAt,
    tier: suggestEntityTier({
      mentionCount,
      sourceDiversity,
      lastConfirmedAt,
      now,
    }),
  };
}

export function enrichEntityIndex(index: EntityIndex, now = new Date()): EntityIndex {
  const entities: EntityIndex["entities"] = {};
  for (const [entityId, record] of Object.entries(index.entities ?? {})) {
    entities[entityId] = enrichEntityRecord(
      {
        id: record.id || entityId,
        title: record.title || entityId,
        mentionCount: record.mentionCount ?? 0,
        sourceDiversity: record.sourceDiversity ?? 0,
        sourcePaths: record.sourcePaths ?? [],
        lastConfirmedAt: record.lastConfirmedAt,
        tier: record.tier,
      },
      now,
    );
  }

  return {
    version: index.version ?? 1,
    entities,
  };
}

function isRecentlyConfirmed(lastConfirmedAt: string | undefined, now: Date | undefined): boolean {
  if (!lastConfirmedAt) return false;
  const confirmedAt = new Date(lastConfirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) return false;
  const referenceTime = now ?? new Date();
  const ageInDays = (referenceTime.getTime() - confirmedAt.getTime()) / (24 * 60 * 60 * 1000);
  return ageInDays <= 30;
}

function normalizeSourcePath(sourcePath: string): string {
  return sourcePath.trim().replaceAll("\\", "/").toLowerCase();
}

function normalizeIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
}
