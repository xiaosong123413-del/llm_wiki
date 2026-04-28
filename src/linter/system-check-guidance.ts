/**
 * User-facing guidance for the broader wiki system check.
 *
 * The rule-based linter can verify structural issues locally. Broader LLM
 * review items are listed explicitly so the operator can decide what to do next.
 */

export function formatSystemCheckGuidance(): string {
  return [
    "系统检查重点排查：",
    "- 页面间存在矛盾",
    "- 新来源已取代的过时表述",
    "- 没有入站链接的孤立页面",
    "- 提及重要概念却未创建对应页面",
    "- 缺失的交叉引用",
    "- 断链",
    "- 孤立页",
    "- 缺摘要",
    "- 重复概念",
    "- 空/薄页",
    "- 引用缺失",
    "",
    "需要你确认后再继续：",
    "- 需要网络搜索补证的数据空白",
    "  原因：联网搜索会引入新来源和外部信息，需要你确认是否值得补证。",
    "  需要你确认：是否进一步网络搜索补证？",
    "- 新问题/新来源建议",
    "  原因：这会改变后续调查范围和收录边界，需要你确认是否接受。",
    "  需要你确认：是否接受新问题、新来源建议？",
  ].join("\n");
}
