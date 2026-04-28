import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readClipTasks,
  runClipTask,
  type ClipRunner,
} from "../web/server/services/clip-pipeline.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("clip pipeline", () => {
  it("writes a media-rich clipping markdown file and persists the completed task", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    const runner: ClipRunner = {
      async collect(input) {
        fs.mkdirSync(input.outputDir, { recursive: true });
        fs.writeFileSync(path.join(input.outputDir, "cover.jpg"), "image", "utf8");
        fs.writeFileSync(path.join(input.outputDir, "clip.mp4"), "video", "utf8");
        return {
          metadata: {
            title: "建议大家一定要坚持准时出摊",
            description: "图文和视频都要进入源料库",
            author: "今天抱抱自己",
            platform: "xhs",
            webpageUrl: input.url,
            contentType: "mixed",
          },
          media: [
            { kind: "image", path: path.join(input.outputDir, "cover.jpg"), title: "cover" },
            { kind: "video", path: path.join(input.outputDir, "clip.mp4"), title: "clip" },
          ],
        };
      },
    };

    const result = await runClipTask(sourceVaultRoot, {
      url: "https://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76",
      body: "用户补充笔记",
      quality: "720",
      now: new Date("2026-04-23T08:00:00.000Z"),
    }, { runner, projectRoot: sourceVaultRoot, runtimeRoot });

    expect(result.status).toBe("completed");
    expect(result.path).toMatch(/^raw\/剪藏\/建议大家一定要坚持准时出摊/);
    const raw = fs.readFileSync(path.join(sourceVaultRoot, ...result.path!.split("/")), "utf8");
    expect(raw).toContain("platform: xhs");
    expect(raw).toContain("clip_status: completed");
    expect(raw).toContain("video_quality: \"720\"");
    expect(raw).toContain("source_url: \"https://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76\"");
    expect(raw).toContain("用户补充笔记");
    expect(raw).toContain("![](./assets/");
    expect(raw).toContain("[视频：clip](./assets/");
    expect(readClipTasks(sourceVaultRoot).items[0]).toMatchObject({
      id: result.task.id,
      status: "completed",
      url: "https://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76",
      path: result.path,
    });
  });

  it("records a failed task without writing a markdown file when extraction fails", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    const runner: ClipRunner = {
      async collect() {
        throw new Error("yt-dlp not found");
      },
    };

    const result = await runClipTask(sourceVaultRoot, {
      url: "https://www.douyin.com/video/123",
      now: new Date("2026-04-23T08:00:00.000Z"),
    }, { runner, projectRoot: sourceVaultRoot, runtimeRoot });

    expect(result.status).toBe("failed");
    expect(result.path).toBeUndefined();
    expect(result.error).toBe("yt-dlp not found");
    expect(readClipTasks(sourceVaultRoot).items[0]).toMatchObject({
      status: "failed",
      platform: "douyin",
      error: "yt-dlp not found",
    });
  });

  it("writes a partial clipping when yt-dlp reports no video formats for an image post", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    const runner: ClipRunner = {
      async collect() {
        throw new Error("ERROR: [Xiaohongshu] 69e5e4880000000023022e76: No video formats found!");
      },
    };

    const result = await runClipTask(sourceVaultRoot, {
      url: "https://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76",
      body: "建议大家一定要坚持准时出摊\nhttps://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76",
      now: new Date("2026-04-23T08:00:00.000Z"),
    }, { runner, projectRoot: sourceVaultRoot, runtimeRoot });

    expect(result.status).toBe("partial");
    expect(result.path).toMatch(/^raw\/剪藏\/建议大家一定要坚持准时出摊/);
    const raw = fs.readFileSync(path.join(sourceVaultRoot, ...result.path!.split("/")), "utf8");
    expect(raw).toContain("clip_status: partial");
    expect(raw).toContain("platform: xhs");
    expect(raw).toContain("建议大家一定要坚持准时出摊");
    expect(readClipTasks(sourceVaultRoot).items[0]).toMatchObject({
      status: "partial",
      platform: "xhs",
      path: result.path,
    });
  });

  it("writes a partial clipping when social metadata download times out", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    const runner: ClipRunner = {
      async collect() {
        throw new Error(
          "ERROR: [twitter] 2047124337191444844: Unable to download JSON metadata: <HTTPSConnection(host='api.x.com', port=443) at 0x1d2d876c070>: Connection to api.x.com timed out.",
        );
      },
    };

    const result = await runClipTask(sourceVaultRoot, {
      url: "https://x.com/shivsakhuja/status/2047124337191444844",
      body: "我去 gbrain创始人聊的这个skill graphy正是我想要搭建的workflow 储存与调用方面的思考",
      now: new Date("2026-04-23T08:00:00.000Z"),
    }, { runner, projectRoot: sourceVaultRoot, runtimeRoot });

    expect(result.status).toBe("partial");
    expect(result.path).toMatch(/^raw\/剪藏\/我去 gbrain创始人聊的这个skill graphy/);
    const raw = fs.readFileSync(path.join(sourceVaultRoot, ...result.path!.split("/")), "utf8");
    expect(raw).toContain("clip_status: partial");
    expect(raw).toContain("platform: generic");
    expect(raw).toContain("api.x.com timed out");
    expect(raw).toContain("我去 gbrain创始人聊的这个skill graphy");
  });
});

function makeRoots(): { sourceVaultRoot: string; runtimeRoot: string } {
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clip-pipeline-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clip-pipeline-runtime-"));
  roots.push(sourceVaultRoot, runtimeRoot);
  fs.mkdirSync(path.join(sourceVaultRoot, "raw", "剪藏"), { recursive: true });
  return { sourceVaultRoot, runtimeRoot };
}
