/**
 * Claim lifecycle helpers for tiered-memory compilation.
 *
 * Consolidates fact-level claims across batches, computes confidence and
 * retention, detects supersession/contestation, and promotes repeated
 * workflow claims into procedures.
 */

import { createHash } from "node:crypto";
import { slugify } from "../utils/markdown.js";
import type {
  ClaimCandidate,
  ClaimRecord,
  ClaimType,
  ProcedureRecord,
} from "../utils/types.js";

const MIN_CONFIDENCE = 0.05;
const MAX_CONFIDENCE = 0.99;
const MIN_RETENTION = 0.05;
const STALE_RETENTION_THRESHOLD = 0.25;

function determineHalfLifeDays(claimType: ClaimType): number {
  if (claimType === "decision" || claimType === "workflow") return 180;
  if (claimType === "incident") return 30;
  return 90;
}

export function calculateConfidence(input: {
  supportCount: number;
  reinforcementCount: number;
  contradictionCount: number;
  daysSinceConfirmed: number;
  halfLifeDays: number;
  status: ClaimRecord["status"];
}): number {
  const evidence = Math.min(
    0.55 + 0.18 * (input.supportCount - 1) + 0.07 * input.reinforcementCount,
    0.95,
  );
  const recency = 0.4 + 0.6 * Math.exp(-input.daysSinceConfirmed / input.halfLifeDays);
  const contradictionPenalty = 0.2 * input.contradictionCount;
  const supersededPenalty = input.status === "superseded" ? 0.35 : 0;
  return clamp(evidence * recency - contradictionPenalty - supersededPenalty, MIN_CONFIDENCE, MAX_CONFIDENCE);
}

export function calculateRetention(input: {
  daysSinceTouch: number;
  halfLifeDays: number;
}): number {
  return clamp(Math.exp(-input.daysSinceTouch / input.halfLifeDays), MIN_RETENTION, 1);
}

export function consolidateClaims(
  existingClaims: ClaimRecord[],
  candidates: ClaimCandidate[],
  now = new Date(),
): {
  claims: ClaimRecord[];
  assignments: Array<{ candidateId: string; claimId: string }>;
} {
  const claims = existingClaims.map(cloneClaim);
  const assignments: Array<{ candidateId: string; claimId: string }> = [];

  for (const candidate of candidates) {
    const matchingKey = claims.filter(
      (claim) =>
        claim.conceptSlug === candidate.conceptSlug &&
        claim.claimKey === candidate.claimKey,
    );
    const exactMatch = matchingKey.find((claim) => claim.claimText === candidate.claimText);

    if (exactMatch) {
      reinforceClaim(exactMatch, candidate);
      assignments.push({ candidateId: candidate.candidateId, claimId: exactMatch.id });
      continue;
    }

    const record = createClaimRecord(candidate);
    claims.push(record);
    assignments.push({ candidateId: candidate.candidateId, claimId: record.id });
    reconcileClaimStatus(matchingKey, record);
  }

  for (const claim of claims) {
    refreshClaimScores(claim, now);
  }

  return { claims, assignments };
}

export function deriveProcedures(claims: ClaimRecord[]): ProcedureRecord[] {
  const grouped = new Map<string, ClaimRecord[]>();
  for (const claim of claims) {
    if (claim.claimType !== "workflow" || claim.status === "superseded") continue;
    const key = `${claim.conceptSlug}::${claim.claimKey}::${claim.claimText}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(claim);
    } else {
      grouped.set(key, [claim]);
    }
  }

  const procedures: ProcedureRecord[] = [];
  for (const group of grouped.values()) {
    const episodeIds = dedupe(group.flatMap((claim) => claim.episodeIds));
    const sourceFiles = dedupe(group.flatMap((claim) => claim.sourceFiles));
    const observedDates = dedupe(group.map((claim) => claim.lastConfirmedAt.slice(0, 10)));
    if (episodeIds.length < 3 || sourceFiles.length < 2 || observedDates.length < 2) continue;

    const representative = group
      .slice()
      .sort((left, right) => right.confidence - left.confidence)[0]!;
    procedures.push({
      id: createHash("sha1")
        .update(`procedure:${representative.conceptSlug}:${representative.claimKey}:${representative.claimText}`)
        .digest("hex")
        .slice(0, 16),
      conceptSlug: representative.conceptSlug,
      procedureKey: representative.claimKey,
      title: representative.claimText,
      summary: representative.claimText,
      supportingClaimIds: dedupe(group.map((claim) => claim.id)).sort(),
      sourceFiles: sourceFiles.sort(),
      episodeIds: episodeIds.sort(),
      confidence: clamp(
        Math.max(
          group.reduce((max, claim) => Math.max(max, claim.confidence), 0),
          0.55 + 0.05 * (group.length - 1),
        ),
        MIN_CONFIDENCE,
        MAX_CONFIDENCE,
      ),
      lastConfirmedAt: group
        .map((claim) => claim.lastConfirmedAt)
        .sort()
        .at(-1)!,
    });
  }

  return procedures.sort((left, right) => left.title.localeCompare(right.title));
}

function cloneClaim(claim: ClaimRecord): ClaimRecord {
  return {
    ...claim,
    sourceFiles: [...claim.sourceFiles],
    episodeIds: [...claim.episodeIds],
    supersedes: [...claim.supersedes],
  };
}

function reinforceClaim(claim: ClaimRecord, candidate: ClaimCandidate): void {
  claim.sourceFiles = dedupe([...claim.sourceFiles, candidate.sourceFile]).sort();
  claim.episodeIds = dedupe([...claim.episodeIds, candidate.episodeId]).sort();
  claim.supportCount = claim.sourceFiles.length;
  claim.lastConfirmedAt = maxIso(claim.lastConfirmedAt, candidate.observedAt);
  if (claim.status === "stale") {
    claim.status = "active";
  }
}

function createClaimRecord(candidate: ClaimCandidate): ClaimRecord {
  return {
    id: createHash("sha1")
      .update(`claim:${candidate.conceptSlug}:${candidate.claimKey}:${candidate.claimText}:${candidate.observedAt}`)
      .digest("hex")
      .slice(0, 16),
    conceptSlug: candidate.conceptSlug,
    claimKey: candidate.claimKey,
    claimText: candidate.claimText,
    claimType: candidate.claimType,
    sourceFiles: [candidate.sourceFile],
    episodeIds: [candidate.episodeId],
    firstSeenAt: candidate.observedAt,
    lastConfirmedAt: candidate.observedAt,
    supportCount: 1,
    contradictionCount: 0,
    confidence: 0.5,
    retention: 1,
    status: "active",
    supersedes: [],
    halfLifeDays: determineHalfLifeDays(candidate.claimType),
  };
}

function reconcileClaimStatus(existingClaims: ClaimRecord[], newClaim: ClaimRecord): void {
  if (existingClaims.length === 0) return;

  const latestExisting = existingClaims
    .slice()
    .sort((left, right) => right.lastConfirmedAt.localeCompare(left.lastConfirmedAt))[0]!;
  const isNewer = newClaim.lastConfirmedAt > latestExisting.lastConfirmedAt;
  const hasSameTimestamp = newClaim.lastConfirmedAt === latestExisting.lastConfirmedAt;

  if (hasSameTimestamp) {
    newClaim.status = "contested";
    for (const claim of existingClaims) {
      if (claim.status !== "superseded") {
        claim.status = "contested";
        claim.contradictionCount += 1;
      }
    }
    newClaim.contradictionCount = 1;
    return;
  }

  if (isNewer) {
    for (const claim of existingClaims) {
      if (claim.status === "superseded") continue;
      claim.status = "superseded";
      claim.supersededBy = newClaim.id;
      newClaim.supersedes = dedupe([...newClaim.supersedes, claim.id]);
    }
    return;
  }

  newClaim.status = "contested";
  newClaim.contradictionCount = 1;
  for (const claim of existingClaims) {
    if (claim.status !== "superseded") {
      claim.status = "contested";
      claim.contradictionCount += 1;
    }
  }
}

function refreshClaimScores(claim: ClaimRecord, now: Date): void {
  const lastTouch = claim.lastAccessedAt ?? claim.lastConfirmedAt;
  const daysSinceConfirmed = daysBetween(claim.lastConfirmedAt, now);
  const daysSinceTouch = daysBetween(lastTouch, now);
  claim.retention = calculateRetention({
    daysSinceTouch,
    halfLifeDays: claim.halfLifeDays,
  });
  if (claim.status === "active" && claim.retention < STALE_RETENTION_THRESHOLD) {
    claim.status = "stale";
  }
  claim.confidence = calculateConfidence({
    supportCount: claim.supportCount,
    reinforcementCount: Math.max(0, claim.sourceFiles.length - 1),
    contradictionCount: claim.contradictionCount,
    daysSinceConfirmed,
    halfLifeDays: claim.halfLifeDays,
    status: claim.status,
  });
}

export function normalizeClaimKey(value: string): string {
  return slugify(value).slice(0, 80) || "claim";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function maxIso(left: string, right: string): string {
  return left > right ? left : right;
}

function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - then);
  return diff / (1000 * 60 * 60 * 24);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
