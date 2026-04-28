/**
 * LLM prompt templates and tool schemas for the compilation pipeline.
 * Contains the tool definition for concept extraction, prompt builders for
 * extraction/page generation, and a parser for structured tool output.
 */

import type { ExtractedConcept, ExtractedClaim } from "../utils/types.js";

export const CONCEPT_EXTRACTION_TOOL = {
  name: "extract_concepts",
  description: "\u4ece\u6e90\u6587\u6863\u4e2d\u62bd\u53d6\u9002\u5408\u5199\u6210\u4e2d\u6587 wiki \u9875\u9762\u7684\u77e5\u8bc6\u6982\u5ff5\u548c claims",
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
              description: "\u6982\u5ff5\u6807\u9898\uff0c\u4f18\u5148\u4f7f\u7528\u4e2d\u6587",
            },
            summary: {
              type: "string",
              description: "\u4e00\u53e5\u8bdd\u4e2d\u6587\u6458\u8981",
            },
            is_new: {
              type: "boolean",
              description: "\u5982\u679c\u8fd9\u662f\u73b0\u6709 wiki \u5c1a\u672a\u8986\u76d6\u7684\u65b0\u6982\u5ff5\uff0c\u5219\u4e3a true",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "2-4 \u4e2a\u4e2d\u6587\u5206\u7c7b\u6807\u7b7e",
            },
            claims: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  claim_key: {
                    type: "string",
                    description: "\u7a33\u5b9a\u7684 claim \u952e\uff0c\u4f8b\u5982 cache-backend\u3001deployment-region",
                  },
                  claim_text: {
                    type: "string",
                    description: "\u53ef\u76f4\u63a5\u5199\u5165 wiki \u7684\u4e8b\u5b9e\u53e5\u5b50",
                  },
                  claim_type: {
                    type: "string",
                    enum: ["decision", "fact", "pattern", "incident", "workflow"],
                    description: "\u4e8b\u5b9e\u7c7b\u578b",
                  },
                  observed_at: {
                    type: "string",
                    description: "\u82e5\u53ef\u4ece\u6e90\u6587\u6863\u63a8\u65ad\u65f6\u95f4\uff0c\u586b ISO \u65f6\u95f4\u5b57\u7b26\u4e32",
                  },
                },
                required: ["claim_key", "claim_text", "claim_type"],
              },
              description: "\u4e0e\u8be5\u6982\u5ff5\u76f8\u5173\u7684 1-5 \u6761 candidate claims",
            },
          },
          required: ["concept", "summary", "is_new"],
        },
      },
    },
    required: ["concepts"],
  },
};

export function buildExtractionPrompt(
  sourceContent: string,
  existingIndex: string,
): string {
  const indexSection = existingIndex
    ? `\n\n\u8fd9\u91cc\u662f\u73b0\u6709 wiki \u7d22\u5f15\uff0c\u8bf7\u907f\u514d\u91cd\u590d\u5df2\u7ecf\u8986\u76d6\u7684\u6982\u5ff5\uff1a\n\n${existingIndex}`
    : "\n\n\u5f53\u524d\u8fd8\u6ca1\u6709\u5df2\u6709 wiki \u9875\u9762\u3002";

  return [
    "\u4f60\u662f\u4e00\u4e2a\u4e2d\u6587\u77e5\u8bc6\u62bd\u53d6\u5f15\u64ce\u3002\u8bf7\u5206\u6790\u4e0b\u9762\u7684\u6e90\u6587\u6863\uff0c",
    "\u62bd\u53d6 3-8 \u4e2a\u503c\u5f97\u5199\u6210 wiki \u9875\u9762\u7684\u6982\u5ff5\u3002",
    "\u6bcf\u4e2a\u6982\u5ff5\u9700\u8981\u8fd4\u56de\u4e2d\u6587\u6982\u5ff5\u6807\u9898\u3001\u4e00\u53e5\u8bdd\u6458\u8981\u3001\u6807\u7b7e\uff0c\u4ee5\u53ca 1-5 \u6761 candidate claims\u3002",
    "\u6bcf\u6761 claim \u5fc5\u987b\u5305\u542b claim_key\u3001claim_text\u3001claim_type\uff1bclaim_key \u8981\u7a33\u5b9a\uff0c\u7528\u4e8e\u540e\u7eed\u5224\u65ad\u7f6e\u4fe1\u5ea6\u3001\u66ff\u4ee3\u548c\u51b2\u7a81\u3002",
    "\u6807\u9898\u3001\u6458\u8981\u3001\u6807\u7b7e\u3001claims \u63cf\u8ff0\u4f18\u5148\u4f7f\u7528\u4e2d\u6587\u3002",
    "\u8bf7\u7528 extract_concepts \u5de5\u5177\u8fd4\u56de\u7ed3\u679c\u3002",
    indexSection,
    "\n\n--- \u6e90\u6587\u6863 ---\n\n",
    sourceContent,
  ].join("\n");
}

export function buildPagePrompt(
  concept: string,
  sourceContent: string,
  existingPage: string,
  relatedPages: string,
): string {
  const existingSection = existingPage
    ? `\n\n\u9700\u8981\u66f4\u65b0\u7684\u73b0\u6709\u9875\u9762\uff1a\n\n${existingPage}`
    : "";
  const relatedSection = relatedPages
    ? `\n\n\u53ef\u7528\u4e8e\u4ea4\u53c9\u5f15\u7528\u7684\u76f8\u5173 wiki \u9875\u9762\uff1a\n\n${relatedPages}`
    : "";

  return [
    `\u4f60\u662f\u4e2d\u6587\u77e5\u8bc6\u5e93\u4f5c\u8005\u3002\u8bf7\u56f4\u7ed5\u300c${concept}\u300d\u5199\u4e00\u7bc7\u7ed3\u6784\u6e05\u6670\u7684\u4e2d\u6587 Markdown wiki \u9875\u9762\u3002`,
    "\u53ea\u80fd\u4f9d\u636e\u63d0\u4f9b\u7684\u6e90\u6750\u6599\u5199\u4f5c\uff0c\u4e0d\u8981\u7f16\u9020\u4e8b\u5b9e\u3002",
    "\u8bf7\u4fdd\u7559\u548c\u4f7f\u7528 Obsidian \u98ce\u683c\u7684 [[\u53cc\u94fe]]\uff0c\u4e0d\u8981\u7834\u574f\u5df2\u6709\u53cc\u94fe\u683c\u5f0f\u3002",
    "\u5728\u9875\u9762\u672b\u5c3e\u5305\u542b `## \u6765\u6e90` \u5c0f\u8282\uff0c\u5217\u51fa\u6e90\u6587\u6863\u3002",
    "\u6bcf\u4e2a\u6b63\u6587\u6bb5\u843d\u672b\u5c3e\u90fd\u8981\u8ffd\u52a0\u5f15\u7528\u6807\u8bb0\uff0c\u5355\u6e90\u4f7f\u7528 ^[filename.md]\uff0c\u591a\u6e90\u4f7f\u7528 ^[a.md, b.md]\u3002",
    "\u8f93\u51fa\u53ea\u5305\u542b\u6700\u7ec8 Markdown \u9875\u9762\u5185\u5bb9\u3002",
    existingSection,
    relatedSection,
    "\n\n--- \u6e90\u6750\u6599 ---\n\n",
    sourceContent,
  ].join("\n");
}

export function parseConcepts(toolOutput: string): ExtractedConcept[] {
  try {
    const parsed = JSON.parse(toolOutput);
    const concepts = parsed.concepts ?? [];
    return concepts
      .filter(
        (concept: Record<string, unknown>) =>
          typeof concept.concept === "string" &&
          typeof concept.summary === "string" &&
          typeof concept.is_new === "boolean" &&
          (concept.tags === undefined || Array.isArray(concept.tags)) &&
          (concept.claims === undefined || Array.isArray(concept.claims)),
      )
      .map((concept: Record<string, unknown>) => ({
        concept: concept.concept as string,
        summary: concept.summary as string,
        is_new: concept.is_new as boolean,
        tags: Array.isArray(concept.tags) ? concept.tags as string[] : undefined,
        claims: parseClaims(concept.claims),
      }));
  } catch {
    return [];
  }
}

function parseClaims(raw: unknown): ExtractedClaim[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter(
      (claim: Record<string, unknown>) =>
        typeof claim.claim_key === "string" &&
        typeof claim.claim_text === "string" &&
        typeof claim.claim_type === "string",
    )
    .map((claim: Record<string, unknown>) => ({
      claim_key: claim.claim_key as string,
      claim_text: claim.claim_text as string,
      claim_type: claim.claim_type as ExtractedClaim["claim_type"],
      observed_at: typeof claim.observed_at === "string" ? claim.observed_at : undefined,
    }));
}
