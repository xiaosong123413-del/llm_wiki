import { describe, expect, it } from "vitest";
import { compiledTruthBoost, hybridSearch, rrfFusion } from "../web/server/services/search-hybrid.js";

describe("search hybrid", () => {
  it("applies compiled truth boost to wiki layer hits", () => {
    const results = hybridSearch(
      [
        {
          id: "raw-redis",
          title: "Redis cache note",
          path: "raw/notes/redis.md",
          layer: "raw",
          excerpt: "redis cache note",
          tags: ["cache"],
          modifiedAt: null,
        },
        {
          id: "wiki-redis",
          title: "Redis cache concept",
          path: "wiki/concepts/redis-cache.md",
          layer: "wiki",
          excerpt: "redis cache concept",
          tags: ["cache"],
          modifiedAt: null,
        },
      ],
      "redis cache",
    );

    expect(results[0]?.id).toBe("wiki-redis");
  });

  it("fuses ranked lists with RRF", () => {
    const results = rrfFusion([
      [
        { id: "a", score: 1 },
        { id: "b", score: 0.9 },
      ],
      [
        { id: "b", score: 1 },
      ],
    ]);

    expect(results[0]?.id).toBeDefined();
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("exposes compiled truth boost helper", () => {
    expect(compiledTruthBoost("wiki")).toBeGreaterThan(compiledTruthBoost("raw"));
  });

  it("prefers procedure pages over concept pages for procedure-shaped queries", () => {
    const results = hybridSearch(
      [
        {
          id: "concept-incident-recovery",
          title: "Incident Recovery Procedure Overview",
          path: "wiki/concepts/incident-recovery.md",
          layer: "wiki",
          excerpt: "Overview of incident recovery procedure choices.",
          tags: ["incident", "recovery", "procedure"],
          modifiedAt: null,
        },
        {
          id: "procedure-incident-recovery",
          title: "Incident Recovery",
          path: "wiki/procedures/incident-recovery.md",
          layer: "wiki",
          excerpt: "Step by step recovery workflow for incidents.",
          tags: ["incident", "recovery", "workflow"],
          modifiedAt: null,
        },
      ],
      "incident recovery procedure",
    );

    expect(results[0]?.id).toBe("procedure-incident-recovery");
  });

  it("keeps a supporting source visible without displacing the main wiki concept", () => {
    const results = hybridSearch(
      [
        {
          id: "wiki-incident-playbook",
          title: "Incident Playbook",
          path: "wiki/concepts/incident-playbook.md",
          layer: "wiki",
          excerpt: "The main concept page for incident playbooks.",
          tags: ["incident", "playbook"],
          modifiedAt: null,
        },
        {
          id: "source-incident-playbook",
          title: "Incident Playbook Source",
          path: "sources_full/notes/incident-playbook-source.md",
          layer: "source",
          excerpt: "A clipped note with incident playbook examples.",
          tags: ["incident", "playbook", "source"],
          modifiedAt: null,
        },
      ],
      "incident playbook",
      { limit: 2 },
    );

    expect(results[0]?.id).toBe("wiki-incident-playbook");
    expect(results[1]?.id).toBe("source-incident-playbook");
  });
});
