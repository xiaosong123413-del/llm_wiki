import { describe, expect, it } from "vitest";
import {
  addChineseAliasToPage,
  extractChineseAliasCandidate,
  extractEmbeddedAliasCandidates,
  extractSourceAliasCandidates,
  extractTitleVariantAliases,
} from "../src/wiki/aliases.js";

describe("wiki chinese aliases", () => {
  it("extracts the Chinese title from a mixed Chinese and English heading", () => {
    const page = [
      "---",
      "title: absorb-compile-link-maintain-cycle",
      "---",
      "",
      "# \u5438\u6536-\u7f16\u8bd1-\u8fde\u7ebf-\u7ef4\u62a4\u5faa\u73af (Absorb-Compile-Link-Maintain Cycle)",
      "",
      "\u6b63\u6587",
    ].join("\n");

    expect(extractChineseAliasCandidate(page)).toBe("\u5438\u6536-\u7f16\u8bd1-\u8fde\u7ebf-\u7ef4\u62a4\u5faa\u73af");
  });

  it("adds a Chinese alias without removing existing aliases", () => {
    const page = [
      "---",
      "title: absorb-compile-link-maintain-cycle",
      "aliases:",
      "  - absorb-compile-link-maintain-cycle",
      "  - ACLM",
      "---",
      "",
      "# \u5438\u6536-\u7f16\u8bd1-\u8fde\u7ebf-\u7ef4\u62a4\u5faa\u73af (Absorb-Compile-Link-Maintain Cycle)",
      "",
      "\u6b63\u6587",
    ].join("\n");

    const updated = addChineseAliasToPage(page);
    expect(updated).not.toBeNull();
    expect(updated).toContain("  - absorb-compile-link-maintain-cycle");
    expect(updated).toContain("  - ACLM");
    expect(updated).toContain("  - \u5438\u6536-\u7f16\u8bd1-\u8fde\u7ebf-\u7ef4\u62a4\u5faa\u73af");
  });

  it("does not rewrite pages that already have the Chinese alias", () => {
    const page = [
      "---",
      "title: absorb-compile-link-maintain-cycle",
      "aliases:",
      "  - absorb-compile-link-maintain-cycle",
      "  - \u5438\u6536-\u7f16\u8bd1-\u8fde\u7ebf-\u7ef4\u62a4\u5faa\u73af",
      "---",
      "",
      "# \u5438\u6536-\u7f16\u8bd1-\u8fde\u7ebf-\u7ef4\u62a4\u5faa\u73af (Absorb-Compile-Link-Maintain Cycle)",
      "",
      "\u6b63\u6587",
    ].join("\n");

    expect(addChineseAliasToPage(page)).toBeNull();
  });

  it("skips pages without a Chinese candidate", () => {
    const page = [
      "---",
      "title: Agent Planning Hierarchy",
      "---",
      "",
      "# Agent Planning Hierarchy",
      "",
      "Body",
    ].join("\n");

    expect(extractChineseAliasCandidate(page)).toBeNull();
    expect(addChineseAliasToPage(page)).toBeNull();
  });

  it("extracts Chinese alias candidates from source filenames", () => {
    const page = [
      "---",
      "title: AI Knowledge Base Construction",
      "sources:",
      "  - ai\u77e5\u8bc6\u5e93\uff08\u7b2c\u4e8c\u5927\u8111\uff09__\u6982\u5ff5__AI\u77e5\u8bc6\u5e93\u6784\u5efa__80281896.md",
      "  - ai\u77e5\u8bc6\u5e93\uff08\u7b2c\u4e8c\u5927\u8111\uff09__\u6982\u5ff5__Graphify__74b5cdc3.md",
      "---",
      "",
      "# AI Knowledge Base Construction",
      "",
      "Body",
    ].join("\n");

    expect(extractSourceAliasCandidates(page)).toContain("AI\u77e5\u8bc6\u5e93\u6784\u5efa");
    expect(extractSourceAliasCandidates(page)).not.toContain("Graphify");
  });

  it("extracts title variant aliases for punctuation-normalized English titles", () => {
    const page = [
      "---",
      "title: Chain of Thought (CoT)",
      "---",
      "",
      "# \u601d\u7ef4\u94fe\uff08CoT\uff09",
      "",
      "Body",
    ].join("\n");

    expect(extractTitleVariantAliases(page)).toContain("Chain-of-Thought");
    expect(extractTitleVariantAliases(page)).toContain("Chain of Thought");
  });

  it("extracts mixed title aliases from leading English prefixes", () => {
    const page = [
      "---",
      "title: Claude Code 单 Agent Context 膨胀问题",
      "---",
      "",
      "# Claude Code 单 Agent Context 膨胀问题",
      "",
      "Body",
    ].join("\n");

    expect(extractTitleVariantAliases(page)).toContain("Claude Code");
  });

  it("extracts mixed title aliases before parenthetical Chinese qualifiers", () => {
    const page = [
      "---",
      "title: TUN 模式（虚拟网卡模式）",
      "---",
      "",
      "# TUN 模式（虚拟网卡模式）",
      "",
      "Body",
    ].join("\n");

    expect(extractTitleVariantAliases(page)).toContain("TUN");
    expect(extractTitleVariantAliases(page)).toContain("TUN 模式");
  });

  it("extracts aliases from embedded markdown frontmatter blocks", () => {
    const page = [
      "---",
      "title: PARA 系统",
      "aliases:",
      "  - para-系统",
      "---",
      "",
      "```markdown",
      "---",
      "title: PARA系统",
      "aliases:",
      "  - PARA",
      "  - PARA System",
      "---",
      "",
      "# PARA 系统",
      "",
      "Body",
      "```",
    ].join("\n");

    expect(extractEmbeddedAliasCandidates(page)).toContain("PARA");
    expect(extractEmbeddedAliasCandidates(page)).toContain("PARA System");
  });

  it("extracts aliases from raw body frontmatter blocks", () => {
    const page = [
      "---",
      "title: AI上下文限制问题",
      "aliases:",
      "  - ai上下文限制问题",
      "---",
      "",
      "---",
      "title: AI上下文限制问题",
      "aliases:",
      "  - 上下文窗口限制",
      "  - context window",
      "---",
      "",
      "# AI上下文限制问题",
      "",
      "Body",
    ].join("\n");

    expect(extractEmbeddedAliasCandidates(page)).toContain("上下文窗口限制");
    expect(extractEmbeddedAliasCandidates(page)).toContain("context window");
  });

  it("adds source-derived and title-variant aliases together", () => {
    const page = [
      "---",
      "title: Chain of Thought (CoT)",
      "sources:",
      "  - ai\u77e5\u8bc6\u5e93\uff08\u7b2c\u4e8c\u5927\u8111\uff09__\u6982\u5ff5__CoT__60ca95e7.md",
      "aliases:",
      "  - chain-of-thought-cot",
      "---",
      "",
      "# \u601d\u7ef4\u94fe\uff08CoT\uff09",
      "",
      "Body",
    ].join("\n");

    const updated = addChineseAliasToPage(page);
    expect(updated).not.toBeNull();
    expect(updated).toContain("  - chain-of-thought-cot");
    expect(updated).toContain("  - \u601d\u7ef4\u94fe");
    expect(updated).toContain("  - Chain-of-Thought");
  });

  it("adds embedded markdown aliases together with mixed title aliases", () => {
    const page = [
      "---",
      "title: MCP（模型上下文协议）集成配置",
      "aliases:",
      "  - mcp模型上下文协议集成配置",
      "---",
      "",
      "```markdown",
      "---",
      "title: MCP（模型上下文协议）集成配置",
      "aliases:",
      "  - MCP集成",
      "  - 模型上下文协议配置",
      "---",
      "",
      "# MCP（模型上下文协议）集成配置",
      "",
      "Body",
      "```",
    ].join("\n");

    const updated = addChineseAliasToPage(page);
    expect(updated).not.toBeNull();
    expect(updated).toContain("  - MCP");
    expect(updated).toContain("  - MCP集成");
    expect(updated).toContain("  - 模型上下文协议配置");
  });
});
