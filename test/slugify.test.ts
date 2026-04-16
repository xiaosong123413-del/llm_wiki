import { describe, it, expect } from "vitest";
import { slugify } from "../src/utils/markdown.js";

describe("slugify", () => {
  it("converts titles to lowercase hyphenated slugs", () => {
    expect(slugify("LLM Knowledge Bases")).toBe("llm-knowledge-bases");
  });

  it("strips apostrophes", () => {
    expect(slugify("Karpathy's Vision")).toBe("karpathys-vision");
  });

  it("strips smart quotes", () => {
    expect(slugify("Karpathy\u2019s Vision")).toBe("karpathys-vision");
  });

  it("strips punctuation", () => {
    expect(slugify("What is AI? (A Guide)")).toBe("what-is-ai-a-guide");
  });

  it("collapses multiple spaces into single hyphen", () => {
    expect(slugify("too   many    spaces")).toBe("too-many-spaces");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("already---hyphenated")).toBe("already-hyphenated");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("-leading and trailing-")).toBe("leading-and-trailing");
  });

  it("preserves Chinese concept titles", () => {
    expect(slugify("\u6cd5\u5b66\u5b66\u7855\u5907\u8003\u9879\u76ee\u7ba1\u7406")).toBe(
      "\u6cd5\u5b66\u5b66\u7855\u5907\u8003\u9879\u76ee\u7ba1\u7406",
    );
  });

  it("hyphenates mixed Chinese and Latin titles", () => {
    expect(slugify("\u77e5\u8bc6\u7f16\u8bd1 vs \u4f20\u7edf RAG")).toBe(
      "\u77e5\u8bc6\u7f16\u8bd1-vs-\u4f20\u7edf-rag",
    );
  });

  it("returns a safe fallback for empty input", () => {
    expect(slugify("")).toBe("untitled");
  });

  it("returns a safe fallback when punctuation strips everything", () => {
    expect(slugify("!!!")).toBe("untitled");
  });

  it("handles single word", () => {
    expect(slugify("Concept")).toBe("concept");
  });
});
