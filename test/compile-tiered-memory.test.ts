import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { makeTempRoot } from "./fixtures/temp-root.js";

const callClaude = vi.fn<(options: unknown) => Promise<string>>();

vi.mock("../src/utils/llm.js", () => ({
  callClaude,
}));

describe("compile tiered memory", () => {
  beforeEach(() => {
    callClaude.mockReset();
  });

  it("writes claims with source metadata without episode records", async () => {
    const { compile } = await import("../src/compiler/index.js");
    const root = await makeTempRoot("compile-tiered");
    await mkdir(path.join(root, "sources"), { recursive: true });
    await writeFile(
      path.join(root, "sources", "redis.md"),
      [
        "> 原料来源：渠道：剪藏 | 名称：Redis rollout | 链接：https://example.com/redis",
        "",
        "# Redis",
        "Project X uses Redis for caching.",
        "",
      ].join("\n"),
      "utf8",
    );

    callClaude
      .mockResolvedValueOnce(JSON.stringify({
        brief: "Project X uses Redis for caching.",
        content: "# Redis rollout\n\nProject X uses Redis for caching.",
      }))
      .mockResolvedValueOnce(JSON.stringify({
        concepts: [
          {
            concept: "缓存方案",
            summary: "记录项目缓存方案。",
            is_new: true,
            tags: ["架构"],
            claims: [
              {
                claim_key: "cache-backend",
                claim_text: "Project X uses Redis for caching.",
                claim_type: "fact",
                observed_at: "2026-04-19T00:00:00.000Z",
              },
            ],
          },
        ],
      }))
      .mockResolvedValueOnce("项目当前使用 [[Redis]] 作为缓存层。^[redis.md]\n\n## 来源\n- redis.md");

    await compile(root);

    const episodesDir = path.join(root, "wiki", "episodes");
    const episodesPath = path.join(root, ".llmwiki", "episodes.json");
    const claimsPath = path.join(root, ".llmwiki", "claims.json");
    const proceduresPath = path.join(root, ".llmwiki", "procedures.json");
    const summaryPath = path.join(root, "wiki", "summaries", "redis.md");
    const summary = await readFile(summaryPath, "utf8");
    const claims = JSON.parse(await readFile(claimsPath, "utf8")) as Array<{
      claimText: string;
      sourceFiles: string[];
      sources: Array<{
        file: string;
        title: string;
        channel: string;
        kind: string;
        url?: string;
        observedAt: string;
      }>;
    }>;
    const procedures = JSON.parse(await readFile(proceduresPath, "utf8")) as unknown[];

    expect(existsSync(episodesDir)).toBe(false);
    expect(existsSync(episodesPath)).toBe(false);
    expect(summary).toContain("brief: Project X uses Redis for caching.");
    expect(summary).toContain("[[concepts/");
    expect(claims[0]?.claimText).toContain("Redis");
    expect(claims[0]?.sourceFiles).toEqual(["redis.md"]);
    expect(claims[0]?.sources).toEqual([
      {
        file: "redis.md",
        title: "Redis rollout",
        channel: "剪藏",
        kind: "clipping",
        url: "https://example.com/redis",
        observedAt: "2026-04-19T00:00:00.000Z",
      },
    ]);
    expect(procedures).toEqual([]);
  }, 30_000);
});
