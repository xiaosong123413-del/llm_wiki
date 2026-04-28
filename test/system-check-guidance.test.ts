import { describe, expect, it } from "vitest";
import { formatSystemCheckGuidance } from "../src/linter/system-check-guidance.js";

describe("system check guidance", () => {
  it("documents the full wiki health review scope in Chinese", () => {
    const guidance = formatSystemCheckGuidance();

    expect(guidance).toContain("系统检查重点排查");
    expect(guidance).toContain("页面间存在矛盾");
    expect(guidance).toContain("新来源已取代的过时表述");
    expect(guidance).toContain("没有入站链接的孤立页面");
    expect(guidance).toContain("提及重要概念却未创建对应页面");
    expect(guidance).toContain("缺失的交叉引用");
    expect(guidance).toContain("断链");
    expect(guidance).toContain("缺摘要");
    expect(guidance).toContain("重复概念");
    expect(guidance).toContain("空/薄页");
    expect(guidance).toContain("引用缺失");
  });

  it("asks before network search or accepting new questions and sources", () => {
    const guidance = formatSystemCheckGuidance();

    expect(guidance).toContain("需要你确认后再继续");
    expect(guidance).toContain("原因：联网搜索会引入新来源和外部信息");
    expect(guidance).toContain("原因：这会改变后续调查范围和收录边界");
    expect(guidance).toContain("是否进一步网络搜索补证");
    expect(guidance).toContain("是否接受新问题、新来源建议");
  });
});
