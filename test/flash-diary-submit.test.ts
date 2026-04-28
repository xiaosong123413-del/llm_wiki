import { describe, expect, it } from "vitest";
import { buildFlashDiarySubmission } from "../desktop-webui/src/flash-diary-submit.js";

describe("flash diary clipping submission routing", () => {
  it("routes xiaohongshu clipping text to the dedicated xhs extract endpoint", () => {
    const submission = buildFlashDiarySubmission({
      target: "clipping",
      text: "我想存这个\nhttps://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76?xsec_token=test",
      mediaPaths: [],
    });

    expect(submission.endpoint).toBe("api/xhs-sync/extract");
    expect(submission.body).toMatchObject({
      url: "https://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76?xsec_token=test",
      body: "我想存这个\nhttps://www.xiaohongshu.com/discovery/item/69e5e4880000000023022e76?xsec_token=test",
    });
  });

  it("keeps non-xiaohongshu clipping links on the generic clip pipeline", () => {
    const submission = buildFlashDiarySubmission({
      target: "clipping",
      text: "https://x.com/example/status/123",
      mediaPaths: [],
    });

    expect(submission.endpoint).toBe("api/clips");
    expect(submission.body).toMatchObject({
      url: "https://x.com/example/status/123",
      quality: "720",
    });
  });

  it("extracts a clean douyin short link from share text", () => {
    const submission = buildFlashDiarySubmission({
      target: "clipping",
      text: "0.00 jCu:/ 05/21 f@O.KJ 深圳打工十年，35岁中登裸辞计划 https://v.douyin.com/pdtrF_y67Hq/复制此链接，打开Dou音搜索，直接观看视频！",
      mediaPaths: [],
    });

    expect(submission.endpoint).toBe("api/clips");
    expect(submission.body).toMatchObject({
      url: "https://v.douyin.com/pdtrF_y67Hq/",
      quality: "720",
    });
  });

  it("keeps clipping text without links on the source gallery create endpoint", () => {
    const submission = buildFlashDiarySubmission({
      target: "clipping",
      text: "只是一些想法",
      mediaPaths: [],
    });

    expect(submission.endpoint).toBe("api/source-gallery/create");
    expect(submission.body).toMatchObject({
      type: "clipping",
      body: "只是一些想法",
    });
  });

  it("keeps flash diary submissions on the flash diary endpoint", () => {
    const payload = {
      target: "flash-diary" as const,
      text: "今天的记录",
      mediaPaths: ["C:/tmp/a.png"],
    };
    const submission = buildFlashDiarySubmission(payload);

    expect(submission.endpoint).toBe("api/flash-diary/entry");
    expect(submission.body).toEqual(payload);
  });
});
