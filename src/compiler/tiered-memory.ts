/**
 * Tiered-memory persistence helpers.
 *
 * Persists claims, episodes, and procedures as JSON indices plus markdown
 * pages for episode/procedure browsing inside the wiki.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { atomicWrite, buildFrontmatter, slugify } from "../utils/markdown.js";
import {
  CLAIMS_FILE,
  EPISODES_DIR,
  EPISODES_FILE,
  PROCEDURES_DIR,
  PROCEDURES_FILE,
} from "../utils/constants.js";
import type {
  ClaimCandidate,
  ClaimRecord,
  EpisodeRecord,
  ExtractedConcept,
  ProcedureRecord,
} from "../utils/types.js";
import type { ExtractionResult } from "./deps.js";
import { normalizeClaimKey } from "./claims.js";

interface SourceMetadata {
  sourceKind: string;
  sourceChannel: string;
  sourceTitle: string;
  sourceUrl?: string;
}

export async function readClaims(root: string): Promise<ClaimRecord[]> {
  return readJsonFile(path.join(root, CLAIMS_FILE), []);
}

export async function writeClaims(root: string, claims: ClaimRecord[]): Promise<void> {
  await writeJsonFile(path.join(root, CLAIMS_FILE), claims);
}

export async function readEpisodes(root: string): Promise<EpisodeRecord[]> {
  return readJsonFile(path.join(root, EPISODES_FILE), []);
}

export async function writeEpisodes(root: string, episodes: EpisodeRecord[]): Promise<void> {
  await writeJsonFile(path.join(root, EPISODES_FILE), episodes);
}

export async function writeProcedures(root: string, procedures: ProcedureRecord[]): Promise<void> {
  await writeJsonFile(path.join(root, PROCEDURES_FILE), procedures);
}

export function buildClaimCandidates(result: ExtractionResult): ClaimCandidate[] {
  const episodeId = buildEpisodeId(result.sourceFile);
  const observedAt = new Date().toISOString();
  return result.concepts.flatMap((concept) => {
    const conceptSlug = slugify(concept.concept);
    const claims = concept.claims?.length
      ? concept.claims
      : [{
        claim_text: concept.summary,
        claim_type: "fact" as const,
        claim_key: concept.concept,
        observed_at: observedAt,
      }];

    return claims.map((claim, index) => {
      const claimText = String(claim.claim_text ?? concept.summary).trim();
      return {
        candidateId: createHash("sha1")
          .update(`${result.sourceFile}:${conceptSlug}:${index}:${claimText}`)
          .digest("hex")
          .slice(0, 16),
        conceptSlug,
        claimKey: normalizeClaimKey(String(claim.claim_key ?? concept.concept)),
        claimText,
        claimType: claim.claim_type ?? "fact",
        sourceFile: result.sourceFile,
        episodeId,
        observedAt: claim.observed_at ?? observedAt,
      };
    });
  });
}

export function buildEpisodeRecord(
  result: ExtractionResult,
  sourceMetadata: SourceMetadata,
  claimIds: string[],
  procedureIds: string[],
): EpisodeRecord {
  return {
    id: buildEpisodeId(result.sourceFile),
    sourceFile: result.sourceFile,
    title: sourceMetadata.sourceTitle,
    sourceKind: sourceMetadata.sourceKind,
    sourceChannel: sourceMetadata.sourceChannel,
    sourceUrl: sourceMetadata.sourceUrl,
    observedAt: new Date().toISOString(),
    summary: summarizeConcepts(result.concepts),
    conceptSlugs: result.concepts.map((concept) => slugify(concept.concept)),
    candidateClaimIds: claimIds,
    procedureIds,
  };
}

export async function writeEpisodePages(root: string, episodes: EpisodeRecord[], claims: ClaimRecord[]): Promise<void> {
  const dir = path.join(root, EPISODES_DIR);
  await mkdir(dir, { recursive: true });
  for (const episode of episodes) {
    const content = buildEpisodePage(episode, claims);
    await atomicWrite(path.join(dir, `${slugify(episode.sourceFile)}.md`), content);
  }
}

export async function writeProcedurePages(root: string, procedures: ProcedureRecord[]): Promise<void> {
  const dir = path.join(root, PROCEDURES_DIR);
  await mkdir(dir, { recursive: true });
  for (const procedure of procedures) {
    const content = buildProcedurePage(procedure);
    await atomicWrite(path.join(dir, `${procedure.id}.md`), content);
  }
}

function buildEpisodeId(sourceFile: string): string {
  return createHash("sha1").update(`episode:${sourceFile}`).digest("hex").slice(0, 16);
}

export function readSourceMetadata(sourceContent: string, sourceFile: string): SourceMetadata {
  const metadataLine = sourceContent.match(/^> 原料来源：(.+)$/m)?.[1] ?? "";
  const pairs = metadataLine.split("|").map((part) => part.trim());
  const sourceChannel = pickValue(pairs, "渠道") ?? "外部源";
  return {
    sourceKind: sourceChannel === "剪藏" ? "clipping" : sourceChannel === "闪念日记" ? "flash" : "external",
    sourceChannel,
    sourceTitle: pickValue(pairs, "名称") ?? sourceFile,
    sourceUrl: pickValue(pairs, "链接") ?? undefined,
  };
}

function summarizeConcepts(concepts: ExtractedConcept[]): string {
  const summaries = concepts
    .map((concept) => concept.summary.trim())
    .filter(Boolean);
  return summaries[0] ?? "本篇源料已进入情景记忆。";
}

function buildEpisodePage(episode: EpisodeRecord, claims: ClaimRecord[]): string {
  const relatedClaims = claims.filter((claim) => episode.candidateClaimIds.includes(claim.id));
  const frontmatter = buildFrontmatter({
    title: episode.title,
    summary: episode.summary,
    sourceFile: episode.sourceFile,
    sourceChannel: episode.sourceChannel,
    observedAt: episode.observedAt,
    tags: ["情景记忆"],
  });
  const lines = [
    frontmatter,
    "",
    `# ${episode.title}`,
    "",
    "## 来源",
    "",
    `- 渠道：${episode.sourceChannel}`,
    `- 文件：${episode.sourceFile}`,
    episode.sourceUrl ? `- 链接：${episode.sourceUrl}` : "",
    `- 时间：${episode.observedAt}`,
    "",
    "## 本篇观察摘要",
    "",
    episode.summary,
    "",
    "## 候选 Claims",
    "",
    ...relatedClaims.map((claim) => `- ${claim.claimText}（${claim.status} / confidence ${claim.confidence.toFixed(2)}）`),
    "",
    "## 与已有 Semantic Memory 的关系",
    "",
    episode.conceptSlugs.length > 0
      ? `- 涉及概念：${episode.conceptSlugs.map((slug) => `[[${slug}]]`).join("、")}`
      : "- 暂无已提升概念",
    "",
    "## 是否触发新 Procedure",
    "",
    episode.procedureIds.length > 0
      ? `- 已触发：${episode.procedureIds.map((procedureId) => `[[${procedureId}]]`).join("、")}`
      : "- 暂未触发新的程序记忆",
    "",
  ];
  return lines.filter(Boolean).join("\n");
}

function buildProcedurePage(procedure: ProcedureRecord): string {
  const frontmatter = buildFrontmatter({
    title: procedure.title,
    summary: procedure.summary,
    updatedAt: procedure.lastConfirmedAt,
    tags: ["程序记忆"],
  });
  return [
    frontmatter,
    "",
    `# ${procedure.title}`,
    "",
    "## 适用场景",
    "",
    procedure.summary,
    "",
    "## 触发条件",
    "",
    `- concept: ${procedure.conceptSlug}`,
    `- procedureKey: ${procedure.procedureKey}`,
    "",
    "## 标准步骤",
    "",
    `1. ${procedure.summary}`,
    "",
    "## 例外情况",
    "",
    "- 如出现新证据与当前流程冲突，则重新审查 supporting claims。",
    "",
    "## 证据与置信度",
    "",
    `- supporting claims: ${procedure.supportingClaimIds.length}`,
    `- confidence: ${procedure.confidence.toFixed(2)}`,
    `- last confirmed: ${procedure.lastConfirmedAt}`,
    "",
  ].join("\n");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pickValue(parts: string[], label: string): string | null {
  const part = parts.find((item) => item.startsWith(`${label}：`));
  if (!part) return null;
  return part.slice(label.length + 1).trim() || null;
}
