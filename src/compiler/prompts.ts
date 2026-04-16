/**
 * LLM prompt templates and tool schemas for the compilation pipeline.
 * Contains the tool definition for concept extraction, prompt builders for
 * extraction/page generation, and a parser for structured tool output.
 */

import type { ExtractedConcept } from "../utils/types.js";

/**
 * Tool definition for extracting knowledge concepts from a source.
 * The extracted titles, summaries, and tags are used as wiki metadata.
 */
export const CONCEPT_EXTRACTION_TOOL = {
  name: "extract_concepts",
  description: "从源文档中抽取适合作为中文知识库页面的知识概念",
  input_schema: {
    type: "object" as const,
    properties: {
      concepts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            concept: {
              type: "string",
              description: "中文概念标题；如果原文是英文术语，可保留术语并补充中文表达",
            },
            summary: {
              type: "string",
              description: "中文一句话摘要",
            },
            is_new: {
              type: "boolean",
              description: "如果这是现有 wiki 中尚未覆盖的新概念，则为 true",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "2-4 个中文分类标签，用于组织概念",
            },
          },
          required: ["concept", "summary", "is_new"],
        },
      },
    },
    required: ["concepts"],
  },
};

/**
 * Build the system prompt for the concept extraction phase.
 * @param sourceContent - Full source document text.
 * @param existingIndex - Current wiki index.md contents, possibly empty.
 * @returns System prompt string for extraction.
 */
export function buildExtractionPrompt(
  sourceContent: string,
  existingIndex: string,
): string {
  const indexSection = existingIndex
    ? `\n\n这里是现有 wiki 索引，请避免重复已经覆盖的概念：\n\n${existingIndex}`
    : "\n\n当前还没有已有 wiki 页面。";

  return [
    "你是一个中文知识抽取引擎。请分析下面的源文档，",
    "抽取 3-8 个独立、重要、值得写成 wiki 页面保存的概念。",
    "每个概念都应该是可独立查询和复用的主题。",
    "重点关注关键思想、技术、模式、框架、方法或实体，不要抽取琐碎细节。",
    "概念标题、摘要、标签必须优先使用中文；必要时可保留英文术语作为括注。",
    "请用 extract_concepts 工具返回结果。",
    indexSection,
    "\n\n--- 源文档 ---\n\n",
    sourceContent,
  ].join("\n");
}

/**
 * Build the system prompt for wiki page generation.
 * @param concept - Concept title to write about.
 * @param sourceContent - Source material to draw from.
 * @param existingPage - Existing page content if updating.
 * @param relatedPages - Related wiki pages for context.
 * @returns System prompt string for page generation.
 */
export function buildPagePrompt(
  concept: string,
  sourceContent: string,
  existingPage: string,
  relatedPages: string,
): string {
  const existingSection = existingPage
    ? `\n\n需要更新的现有页面：\n\n${existingPage}`
    : "";

  const relatedSection = relatedPages
    ? `\n\n可用于交叉引用的相关 wiki 页面：\n\n${relatedPages}`
    : "";

  return [
    `你是中文知识库作者。请围绕“${concept}”写一篇清晰、结构良好的中文 Markdown wiki 页面。`,
    "只能依据提供的源材料写作，不要编造事实。",
    "页面正文、标题说明、摘要性段落应优先使用中文；必要时可保留英文术语并附中文解释。",
    "请保留和使用 Obsidian 风格的 [[双链]]，不要破坏已有双链格式。",
    "在页面末尾包含一个 `## 来源` 小节，列出源文档。",
    "语气保持中立、信息密度高，简洁但充分。",
    "",
    "来源标注：每个正文段落末尾都要追加引用标记，说明该段落依据哪些源文件。",
    "格式：单一来源使用 ^[filename.md]，多来源使用 ^[source-a.md, source-b.md]。",
    "引用标记只放在正文段落末尾，不要放在标题、列表项或代码块后。",
    "源文件名会以 `--- SOURCE: filename.md ---` 头部出现在下方材料中。",
    "输出只包含最终 Markdown 页面内容，不要解释你的写作过程。",
    existingSection,
    relatedSection,
    "\n\n--- 源材料 ---\n\n",
    sourceContent,
  ].join("\n");
}

/**
 * Parse the JSON tool output from concept extraction into typed objects.
 * @param toolOutput - Raw JSON string returned from the extract_concepts tool.
 * @returns Array of extracted concept objects.
 */
export function parseConcepts(toolOutput: string): ExtractedConcept[] {
  try {
    const parsed = JSON.parse(toolOutput);
    const concepts: ExtractedConcept[] = parsed.concepts ?? [];
    return concepts
      .filter(
        (c) =>
          typeof c.concept === "string" &&
          typeof c.summary === "string" &&
          typeof c.is_new === "boolean" &&
          (c.tags === undefined || Array.isArray(c.tags)),
      )
      .map((c) => ({
        concept: c.concept,
        summary: c.summary,
        is_new: c.is_new,
        tags: Array.isArray(c.tags) ? c.tags : undefined,
      }));
  } catch {
    return [];
  }
}
