import { describe, expect, it } from "vitest";
import type { SearchResult } from "../web/server/services/search-router.js";
import { dedupSearchResults } from "../web/server/services/search-dedup.js";
import { chooseSearchMode } from "../web/server/services/search-intent.js";

describe("search mode routing", () => {
  it("routes direct when the query looks like a path or slug", () => {
    expect(chooseSearchMode("wiki/index.md")).toBe("direct");
    expect(chooseSearchMode("sources_full/clip-note.md")).toBe("direct");
  });

  it("routes keyword for short exact terms", () => {
    expect(chooseSearchMode("Redis")).toBe("keyword");
  });

  it("routes hybrid for natural language questions", () => {
    expect(chooseSearchMode("我最近关于缓存提到过什么模式")).toBe("hybrid");
  });
});

describe("search dedup", () => {
  it("keeps the highest-priority layer among duplicate hits", () => {
    const results: SearchResult[] = [
      {
        id: "source",
        title: "Foo",
        path: "sources_full/foo.md",
        layer: "source",
        excerpt: "source",
        tags: [],
        modifiedAt: null,
      },
      {
        id: "raw",
        title: "Foo",
        path: "raw/剪藏/foo.md",
        layer: "raw",
        excerpt: "raw",
        tags: [],
        modifiedAt: null,
      },
      {
        id: "episode",
        title: "Foo",
        path: "wiki/episodes/foo.md",
        layer: "wiki",
        excerpt: "episode",
        tags: [],
        modifiedAt: null,
      },
      {
        id: "concept",
        title: "Foo",
        path: "wiki/concepts/foo.md",
        layer: "wiki",
        excerpt: "concept",
        tags: [],
        modifiedAt: null,
      },
      {
        id: "procedure",
        title: "Foo",
        path: "wiki/procedures/foo.md",
        layer: "wiki",
        excerpt: "procedure",
        tags: [],
        modifiedAt: null,
      },
    ];

    const deduped = dedupSearchResults(results);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("procedure");
  });
});
