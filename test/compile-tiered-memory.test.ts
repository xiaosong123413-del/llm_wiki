import { describe, expect, it, vi, beforeEach } from "vitest";
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

  it("writes episode pages and claims records for extracted sources", async () => {
    const { compile } = await import("../src/compiler/index.js");
    const root = await makeTempRoot("compile-tiered");
    await mkdir(path.join(root, "sources"), { recursive: true });
    await writeFile(path.join(root, "sources", "redis.md"), "# Redis\nProject X uses Redis for caching.\n", "utf8");

    callClaude
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
    const claimsPath = path.join(root, ".llmwiki", "claims.json");
    const proceduresPath = path.join(root, ".llmwiki", "procedures.json");
    const episodeFiles = await import("node:fs/promises").then((fs) => fs.readdir(episodesDir));
    const claims = JSON.parse(await readFile(claimsPath, "utf8")) as Array<{ claimText: string }>;
    const procedures = JSON.parse(await readFile(proceduresPath, "utf8")) as unknown[];
    const episodePage = await readFile(path.join(episodesDir, episodeFiles[0]!), "utf8");

    expect(episodeFiles.length).toBe(1);
    expect(episodePage).toContain("候选 Claims");
    expect(claims[0]?.claimText).toContain("Redis");
    expect(procedures).toEqual([]);
  });
});
