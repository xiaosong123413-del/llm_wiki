/**
 * Claim lifecycle lint rules.
 *
 * Surfaces claim-level lifecycle state from .llmwiki/claims.json as page-level
 * diagnostics so the system check can warn about stale or weak knowledge that
 * is still present in the published wiki.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { CLAIMS_FILE } from "../utils/constants.js";
import type { ClaimRecord } from "../utils/types.js";
import type { LintResult } from "./types.js";

const LOW_CONFIDENCE_WARNING_THRESHOLD = 0.4;
const LOW_CONFIDENCE_INFO_THRESHOLD = 0.6;

export async function checkStaleClaims(root: string): Promise<LintResult[]> {
  const claims = readClaims(root);
  return claims
    .filter((claim) => claim.status === "stale")
    .map((claim) => ({
      rule: "stale-claim",
      severity: "warning" as const,
      file: resolveConceptPage(root, claim),
      message: `Stale claim: ${claim.claimText} (retention ${claim.retention.toFixed(2)}, last confirmed ${claim.lastConfirmedAt.slice(0, 10)})`,
    }));
}

export async function checkLowConfidenceClaims(root: string): Promise<LintResult[]> {
  const claims = readClaims(root);
  return claims
    .filter((claim) => claim.status !== "superseded")
    .filter((claim) => claim.confidence < LOW_CONFIDENCE_INFO_THRESHOLD)
    .map((claim) => ({
      rule: "low-confidence-claim",
      severity: claim.confidence < LOW_CONFIDENCE_WARNING_THRESHOLD ? "warning" as const : "info" as const,
      file: resolveConceptPage(root, claim),
      message: `Low-confidence claim: ${claim.claimText} (confidence ${claim.confidence.toFixed(2)}, status ${claim.status})`,
    }));
}

function readClaims(root: string): ClaimRecord[] {
  const claimsPath = path.join(root, CLAIMS_FILE);
  if (!existsSync(claimsPath)) return [];
  try {
    return JSON.parse(readFileSync(claimsPath, "utf8")) as ClaimRecord[];
  } catch {
    return [];
  }
}

function resolveConceptPage(root: string, claim: ClaimRecord): string {
  const conceptPage = path.join(root, "wiki", "concepts", `${claim.conceptSlug}.md`);
  return existsSync(conceptPage) ? conceptPage : path.join(root, CLAIMS_FILE);
}
