/**
 * Markdown sections appended to generated concept pages.
 *
 * Keeps claim lifecycle rendering separate from page orchestration so the
 * compiler entrypoint stays focused on pipeline control.
 */

import type { ClaimRecord } from "../utils/types.js";

export function renderClaimSections(claims: ClaimRecord[], summaryLinks: readonly string[]): string {
  const active = claims
    .filter((claim) => claim.status === "active" || claim.status === "stale")
    .sort((left, right) => right.confidence - left.confidence);
  const contested = claims.filter((claim) => claim.status === "contested");
  const superseded = claims.filter((claim) => claim.status === "superseded");
  const lines = ["## Confidence overview", ""];

  appendActiveClaims(lines, active);
  appendContestedClaims(lines, contested);
  appendSupersededClaims(lines, superseded);
  appendSummaryLinks(lines, summaryLinks);
  return lines.join("\n");
}

function appendActiveClaims(lines: string[], claims: ClaimRecord[]): void {
  if (claims.length === 0) {
    lines.push("- No high-confidence claims yet.", "");
    return;
  }
  for (const claim of claims) {
    lines.push(
      `- ${claim.claimText} (confidence ${claim.confidence.toFixed(2)} / retention ${claim.retention.toFixed(2)} / last confirmed ${claim.lastConfirmedAt.slice(0, 10)})`,
    );
  }
  lines.push("");
}

function appendContestedClaims(lines: string[], claims: ClaimRecord[]): void {
  lines.push("## Contested claims", "");
  if (claims.length === 0) {
    lines.push("- None.", "");
    return;
  }
  for (const claim of claims) {
    lines.push(`- ${claim.claimText} (support ${claim.supportCount} / contradiction ${claim.contradictionCount})`);
  }
  lines.push("");
}

function appendSupersededClaims(lines: string[], claims: ClaimRecord[]): void {
  lines.push("## Superseded claims", "");
  if (claims.length === 0) {
    lines.push("- None.", "");
    return;
  }
  for (const claim of claims) {
    lines.push(`- ${claim.claimText} (superseded)`);
  }
  lines.push("");
}

function appendSummaryLinks(lines: string[], summaryLinks: readonly string[]): void {
  lines.push("## Source summaries", "");
  for (const link of summaryLinks) {
    lines.push(`- [[${link}]]`);
  }
}
