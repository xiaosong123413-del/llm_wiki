import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runDouyinSingle,
  type DouyinCollector,
} from "../web/server/services/douyin-sync.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("douyin sync service", () => {
  it("writes local video, formatted transcript, and decision note for a douyin clip", async () => {
    const wikiRoot = makeRoot();
    const collector: DouyinCollector = {
      async collect(input) {
        const videoDir = path.join(input.outputDir, "video");
        fs.mkdirSync(videoDir, { recursive: true });
        const videoPath = path.join(videoDir, "douyin-test.mp4");
        fs.writeFileSync(videoPath, "video", "utf8");
        return {
          post: {
            id: "7528906304966249771",
            title: "深圳打工十年后的选择",
            desc: "35岁中登裸辞计划，重新看待车贷房贷和职业路径。",
            date: "2026-04-24",
            author: "抖音作者A",
            tags: ["裸辞", "35岁危机"],
            sourceUrl: input.url,
            videoUrl: input.url,
          },
          video: {
            sourceUrl: input.url,
            storedPath: "video/douyin-test.mp4",
          },
        };
      },
    };

    const result = await runDouyinSingle(wikiRoot, {
      url: "https://www.douyin.com/video/7528906304966249771",
      body: "用户备注",
      now: new Date("2026-04-24T08:00:00.000Z"),
    }, {
      collector,
      projectRoot: wikiRoot,
      videoTranscriber: async () => "第一句。这是第二句。然后继续说第三句。",
      postFormatter: async () => ({
        insightTitle: "把裸辞叙事转成职业判断",
        shortTitle: "深圳裸辞判断",
        summaryLines: ["先看现金流，再看职业动作。"],
        decisionNote: "不要把情绪当结论，先验证风险承受能力。",
      }),
    });

    expect(result.status).toBe("completed");
    expect(result.path).toMatch(/^raw\/剪藏\/抖音\//);

    const markdownPath = path.join(wikiRoot, ...String(result.path).split("/"));
    const raw = fs.readFileSync(markdownPath, "utf8");
    expect(raw).toContain("platform: douyin");
    expect(raw).toContain("![](video/douyin-test.mp4)");
    expect(raw).toContain("第一句。");
    expect(raw).toContain("\n\n这是第二句。");
    expect(raw).toContain("不要把情绪当结论");

    const transcriptDir = path.join(wikiRoot, ".llmwiki", "transcripts");
    const sidecars = fs.existsSync(transcriptDir) ? fs.readdirSync(transcriptDir) : [];
    expect(sidecars.length).toBeGreaterThan(0);
    const sidecar = fs.readFileSync(path.join(transcriptDir, sidecars[0]!), "utf8");
    expect(sidecar).toContain("这是第二句。");
  });
});

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "douyin-sync-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "raw", "剪藏", "抖音"), { recursive: true });
  return root;
}
