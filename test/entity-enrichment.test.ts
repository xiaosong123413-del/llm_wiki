import { describe, expect, it } from "vitest";
import { createEmptyEntityIndex, upsertEntityMention, summarizeEntity } from "../web/server/services/entity-index.js";
import { enrichEntityIndex, suggestEntityTier } from "../web/server/services/entity-enrichment.js";
import { entitySummariesToReviewItems } from "../web/server/services/review-items.js";
import { normalizeEntityIndexSnapshot } from "../scripts/sync-compile.mjs";

describe("entity enrichment", () => {
  it("tracks mention count, source diversity, last confirmed time, and tier", () => {
    const index = createEmptyEntityIndex();

    upsertEntityMention(index, {
      entityId: "agent-planning",
      entityTitle: "agent planning",
      sourcePath: "raw/clip-a.md",
      confirmedAt: "2026-04-01T00:00:00.000Z",
    });
    upsertEntityMention(index, {
      entityId: "agent-planning",
      entityTitle: "agent planning",
      sourcePath: "sources_full/clip-b.md",
      confirmedAt: "2026-04-05T00:00:00.000Z",
    });

    const record = index.entities["agent-planning"];
    expect(summarizeEntity(record)).toEqual({
      id: "agent-planning",
      title: "agent planning",
      mentionCount: 2,
      sourceDiversity: 2,
      lastConfirmedAt: "2026-04-05T00:00:00.000Z",
      tier: 2,
    });
    expect(record).toMatchObject({
      id: "agent-planning",
      title: "agent planning",
      mentionCount: 2,
      sourceDiversity: 2,
      lastConfirmedAt: "2026-04-05T00:00:00.000Z",
    });
    expect(suggestEntityTier(record, new Date("2026-04-05T00:00:00.000Z"))).toBe(2);
  });

  it("upgrades highly supported recent entities to tier 3", () => {
    const index = createEmptyEntityIndex();
    for (const sourcePath of ["raw/a.md", "raw/b.md", "sources_full/c.md"]) {
      upsertEntityMention(index, {
        entityId: "entity-x",
        entityTitle: "entity x",
        sourcePath,
        confirmedAt: "2026-04-20T00:00:00.000Z",
      });
    }
    upsertEntityMention(index, {
      entityId: "entity-x",
      entityTitle: "entity x",
      sourcePath: "sources_full/d.md",
      confirmedAt: "2026-04-21T00:00:00.000Z",
    });

    const enriched = enrichEntityIndex(index, new Date("2026-04-21T00:00:00.000Z"));
    expect(enriched.entities["entity-x"]?.tier).toBe(3);
    expect(enriched.entities["entity-x"]?.sourceDiversity).toBe(4);
  });

  it("adapts entity summaries into review items", () => {
    const reviewItems = entitySummariesToReviewItems([
      {
        id: "entity-x",
        title: "entity x",
        mentionCount: 4,
        sourceDiversity: 3,
        lastConfirmedAt: "2026-04-21T00:00:00.000Z",
        tier: 3,
      },
    ]);

    expect(reviewItems).toEqual([
      {
        id: "entity-x",
        kind: "entity",
        severity: "suggest",
        title: "entity x",
        detail: "Mentions: 4 · Sources: 3 · Last confirmed: 2026-04-21T00:00:00.000Z · Tier: 3",
        createdAt: "2026-04-21T00:00:00.000Z",
        target: "entity/entity-x",
      },
    ]);
  });

  it("normalizes entity snapshots with the sync-compile hook", () => {
    const normalized = normalizeEntityIndexSnapshot(
      {
        version: 1,
        entities: {
          "entity-y": {
            id: "entity-y",
            title: "entity y",
            mentionCount: 2,
            sourceDiversity: 1,
            sourcePaths: ["RAW/A.md", "raw/a.md", "sources_full/B.md"],
            lastConfirmedAt: "2026-04-01T00:00:00.000Z",
          },
        },
      },
      new Date("2026-04-21T00:00:00.000Z"),
    );

    expect(normalized.entities["entity-y"]).toMatchObject({
      id: "entity-y",
      title: "entity y",
      mentionCount: 2,
      sourceDiversity: 2,
      sourcePaths: ["raw/a.md", "sources_full/b.md"],
      lastConfirmedAt: "2026-04-01T00:00:00.000Z",
      tier: 2,
    });
  });
});
