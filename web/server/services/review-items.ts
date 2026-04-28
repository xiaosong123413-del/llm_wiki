import type { RuleIssue } from "./rules/types.js";

interface ReviewItem {
  id: string;
  kind: "rule" | "entity";
  severity: RuleIssue["severity"];
  title: string;
  detail: string;
  createdAt: string;
  target?: string;
}

interface EntitySummary {
  id: string;
  title: string;
  mentionCount: number;
  sourceDiversity: number;
  lastConfirmedAt?: string;
  tier?: 1 | 2 | 3;
}

export function ruleIssuesToReviewItems(issues: readonly RuleIssue[]): ReviewItem[] {
  return issues.map((issue) => ({
    id: issue.id,
    kind: "rule",
    severity: issue.severity,
    title: issue.title,
    detail: issue.detail,
    createdAt: issue.createdAt,
    target: issue.target,
  }));
}

export function entitySummariesToReviewItems(entities: readonly EntitySummary[]): ReviewItem[] {
  return entities.map((entity) => {
    const createdAt = entity.lastConfirmedAt ?? new Date().toISOString();
    const tier = entity.tier ?? 1;
    return {
      id: entity.id,
      kind: "entity",
      severity: "suggest" as const,
      title: entity.title,
      detail: `Mentions: ${entity.mentionCount} · Sources: ${entity.sourceDiversity} · Last confirmed: ${createdAt} · Tier: ${tier}`,
      createdAt,
      target: `entity/${entity.id}`,
    };
  });
}
