import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, buildPagePrompt } from "../src/compiler/prompts.js";

describe("Chinese wiki generation prompts", () => {
  it("asks concept extraction to return Chinese concepts and summaries", () => {
    const prompt = buildExtractionPrompt("# Source\ncontent", "");

    expect(prompt).toContain("中文");
    expect(prompt).toContain("概念标题");
    expect(prompt).toContain("摘要");
    expect(prompt).toContain("标签");
  });

  it("asks page generation to write Chinese markdown while preserving wikilinks and citations", () => {
    const prompt = buildPagePrompt("测试概念", "source", "", "");

    expect(prompt).toContain("中文");
    expect(prompt).toContain("[[双链]]");
    expect(prompt).toContain("Markdown");
    expect(prompt).toContain("## 来源");
    expect(prompt).toContain("^[filename.md]");
  });
});
