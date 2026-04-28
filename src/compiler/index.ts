/**
 * Compilation orchestrator for the llmwiki knowledge compiler.
 *
 * Coordinates lock acquisition, change detection, concept extraction, claim
 * lifecycle consolidation, tiered-memory persistence, concept/procedure page
 * generation, interlink resolution, and navigation rebuilds.
 */

import { readFile, readdir } from "fs/promises";
import path from "path";
import pLimit from "p-limit";
import { readState, updateSourceState } from "../utils/state.js";
import {
  atomicWrite,
  safeReadFile,
  validateWikiPage,
  slugify,
  buildFrontmatter,
  parseFrontmatter,
} from "../utils/markdown.js";
import { callClaude } from "../utils/llm.js";
import { acquireLock, releaseLock } from "../utils/lock.js";
import {
  CONCEPT_EXTRACTION_TOOL,
  buildExtractionPrompt,
  buildPagePrompt,
  parseConcepts,
} from "./prompts.js";
import { detectChanges, hashFile } from "./hasher.js";
import {
  findAffectedSources,
  findFrozenSlugs,
  findLateAffectedSources,
  freezeFailedExtractions,
  persistFrozenSlugs,
  type ExtractionResult,
} from "./deps.js";
import { markOrphaned, orphanUnownedFrozenPages } from "./orphan.js";
import { resolveLinks } from "./resolver.js";
import { generateIndex } from "./indexgen.js";
import { addObsidianMeta, generateMOC } from "./obsidian.js";
import { appendMaintenanceLog } from "../utils/maintenance-log.js";
import {
  COMPILE_CONCURRENCY,
  CONCEPTS_DIR,
  INDEX_FILE,
  SOURCES_DIR,
} from "../utils/constants.js";
import {
  buildClaimCandidates,
  buildEpisodeRecord,
  readClaims,
  readEpisodes,
  writeClaims,
  writeEpisodes,
  writeEpisodePages,
  writeProcedurePages,
  writeProcedures,
  readSourceMetadata,
} from "./tiered-memory.js";
import { consolidateClaims, deriveProcedures } from "./claims.js";
import * as output from "../utils/output.js";
import type {
  ClaimRecord,
  ExtractedConcept,
  ProcedureRecord,
  SourceChange,
  SourceState,
} from "../utils/types.js";

interface CompileResultSummary {
  claimsUpdated: number;
  episodesUpdated: number;
  proceduresUpdated: number;
}

interface MergedConcept {
  slug: string;
  concept: ExtractedConcept;
  sourceFiles: string[];
  combinedContent: string;
}

export async function compile(root: string): Promise<void> {
  output.header("llmwiki compile");

  const locked = await acquireLock(root);
  if (!locked) {
    output.status("!", output.error("Could not acquire lock. Try again later."));
    return;
  }

  try {
    await runCompilePipeline(root);
  } finally {
    await releaseLock(root);
  }
}

async function runCompilePipeline(root: string): Promise<void> {
  const state = await readState(root);
  const changes = await detectChanges(root, state);

  const affectedFiles = findAffectedSources(state, changes);
  for (const file of affectedFiles) {
    output.status("~", output.info(`${file} [affected by shared concept]`));
    changes.push({ file, status: "changed" });
  }

  const toCompile = changes.filter((c) => c.status === "new" || c.status === "changed");
  const deleted = changes.filter((c) => c.status === "deleted");
  const unchanged = changes.filter((c) => c.status === "unchanged");

  if (toCompile.length === 0 && deleted.length === 0) {
    await rebuildNavigation(root);
    await logCompile(root, toCompile.length, unchanged.length, deleted.length, {
      claimsUpdated: 0,
      episodesUpdated: 0,
      proceduresUpdated: 0,
    });
    output.status("*", output.success("Nothing to compile - all sources up to date."));
    return;
  }

  printChangesSummary(changes);

  for (const del of deleted) {
    await markOrphaned(root, del.file, state);
  }

  const frozenSlugs = findFrozenSlugs(state, changes);
  for (const slug of frozenSlugs) {
    output.status("i", output.dim(`Frozen: ${slug} (shared with deleted source)`));
  }

  const extractions: ExtractionResult[] = [];
  for (const change of toCompile) {
    extractions.push(await extractForSource(root, change.file));
  }

  const lateAffected = findLateAffectedSources(extractions, state, changes);
  for (const file of lateAffected) {
    output.status("~", output.info(`${file} [shares concept with new source]`));
    extractions.push(await extractForSource(root, file));
  }

  await freezeFailedExtractions(root, extractions, frozenSlugs);

  const lifecycle = await updateTieredMemory(root, extractions);
  const merged = mergeExtractions(extractions, frozenSlugs);
  const limit = pLimit(COMPILE_CONCURRENCY);
  const pageResults = await Promise.all(
    merged.map((entry) => limit(async () => {
      await generateMergedPage(root, entry, lifecycle.claims);
      return entry;
    })),
  );

  const allChangedSlugs = pageResults.map((entry) => entry.slug);
  const allNewSlugs = pageResults
    .filter((entry) => entry.concept.is_new)
    .map((entry) => entry.slug);

  for (const result of extractions) {
    if (result.concepts.length === 0) continue;
    await persistSourceState(root, result.sourcePath, result.sourceFile, result.concepts);
  }

  if (frozenSlugs.size > 0) {
    await orphanUnownedFrozenPages(root, frozenSlugs);
  }
  await persistFrozenSlugs(root, frozenSlugs, extractions);

  if (allChangedSlugs.length > 0) {
    output.status("*", output.info("Resolving interlinks..."));
    await resolveLinks(root, allChangedSlugs, allNewSlugs);
  }

  await rebuildNavigation(root);
  await logCompile(root, toCompile.length, unchanged.length, deleted.length, lifecycle);

  output.header("Compilation complete");
  output.status(
    "*",
    output.success(`${toCompile.length} compiled, ${unchanged.length} skipped, ${deleted.length} deleted`),
  );
  output.status(
    "*",
    output.dim(
      `claims ${lifecycle.claimsUpdated}, episodes ${lifecycle.episodesUpdated}, procedures ${lifecycle.proceduresUpdated}`,
    ),
  );
  if (toCompile.length > 0) {
    output.status(">", output.dim('Next: llmwiki query "your question here"'));
  }
}

async function updateTieredMemory(
  root: string,
  extractions: ExtractionResult[],
): Promise<CompileResultSummary & { claims: ClaimRecord[]; procedures: ProcedureRecord[] }> {
  const successfulExtractions = extractions.filter((result) => result.concepts.length > 0);
  const existingClaims = await readClaims(root);
  const existingEpisodes = await readEpisodes(root);
  const candidates = successfulExtractions.flatMap((result) => buildClaimCandidates(result));
  const consolidated = consolidateClaims(existingClaims, candidates);
  const claims = consolidated.claims;
  const procedures = deriveProcedures(claims);
  const claimIdByCandidateId = new Map(
    consolidated.assignments.map((assignment) => [assignment.candidateId, assignment.claimId]),
  );
  const procedureIdsByClaimId = new Map<string, string[]>();

  for (const procedure of procedures) {
    for (const claimId of procedure.supportingClaimIds) {
      const existing = procedureIdsByClaimId.get(claimId);
      if (existing) {
        existing.push(procedure.id);
      } else {
        procedureIdsByClaimId.set(claimId, [procedure.id]);
      }
    }
  }

  const nextEpisodes = existingEpisodes.filter(
    (episode) => !successfulExtractions.some((result) => episode.sourceFile === result.sourceFile),
  );

  for (const result of successfulExtractions) {
    const candidatesForResult = buildClaimCandidates(result);
    const claimIds = candidatesForResult
      .map((candidate) => claimIdByCandidateId.get(candidate.candidateId))
      .filter((value): value is string => Boolean(value));
    const procedureIds = [...new Set(claimIds.flatMap((claimId) => procedureIdsByClaimId.get(claimId) ?? []))];
    const metadata = readSourceMetadata(result.sourceContent, result.sourceFile);
    nextEpisodes.push(buildEpisodeRecord(result, metadata, claimIds, procedureIds));
  }

  await writeClaims(root, claims);
  await writeEpisodes(root, nextEpisodes);
  await writeProcedures(root, procedures);
  await writeEpisodePages(root, nextEpisodes, claims);
  await writeProcedurePages(root, procedures);

  return {
    claims,
    procedures,
    claimsUpdated: claims.length,
    episodesUpdated: nextEpisodes.length,
    proceduresUpdated: procedures.length,
  };
}

async function rebuildNavigation(root: string): Promise<void> {
  await generateIndex(root);
  await generateMOC(root);
}

async function logCompile(
  root: string,
  compiled: number,
  skipped: number,
  deleted: number,
  summary: CompileResultSummary,
): Promise<void> {
  await appendMaintenanceLog(root, {
    action: "compile",
    title: `${compiled} compiled, ${skipped} skipped, ${deleted} deleted`,
    details: {
      compiled,
      skipped,
      deleted,
      claims: summary.claimsUpdated,
      episodes: summary.episodesUpdated,
      procedures: summary.proceduresUpdated,
      rebuilt: ["wiki/index.md", "wiki/MOC.md"],
    },
  });
}

function printChangesSummary(changes: SourceChange[]): void {
  const iconMap: Record<string, string> = {
    new: "+", changed: "~", unchanged: ".", deleted: "-",
  };
  const fmtMap: Record<string, (s: string) => string> = {
    new: output.success, changed: output.warn, unchanged: output.dim, deleted: output.error,
  };

  for (const change of changes) {
    const icon = iconMap[change.status] ?? "?";
    const fmt = fmtMap[change.status] ?? output.dim;
    output.status(icon, fmt(`${change.file} [${change.status}]`));
  }
}

async function extractForSource(root: string, sourceFile: string): Promise<ExtractionResult> {
  output.status("*", output.info(`Extracting: ${sourceFile}`));

  const sourcePath = path.join(root, SOURCES_DIR, sourceFile);
  const sourceContent = await readFile(sourcePath, "utf-8");
  const existingIndex = await safeReadFile(path.join(root, INDEX_FILE));
  const concepts = await extractConcepts(sourceContent, existingIndex);

  if (concepts.length > 0) {
    const names = concepts.map((concept) => concept.concept).join(", ");
    output.status("*", output.dim(`  Found ${concepts.length} concepts: ${names}`));
  }

  return { sourceFile, sourcePath, sourceContent, concepts };
}

function mergeExtractions(
  extractions: ExtractionResult[],
  frozenSlugs: Set<string>,
): MergedConcept[] {
  const bySlug = new Map<string, MergedConcept>();

  for (const result of extractions) {
    if (result.concepts.length === 0) continue;

    for (const concept of result.concepts) {
      const slug = slugify(concept.concept);
      if (frozenSlugs.has(slug)) continue;

      const existing = bySlug.get(slug);
      if (existing) {
        existing.sourceFiles.push(result.sourceFile);
        existing.combinedContent += `\n\n--- SOURCE: ${result.sourceFile} ---\n\n${result.sourceContent}`;
      } else {
        bySlug.set(slug, {
          slug,
          concept,
          sourceFiles: [result.sourceFile],
          combinedContent: `--- SOURCE: ${result.sourceFile} ---\n\n${result.sourceContent}`,
        });
      }
    }
  }

  return Array.from(bySlug.values());
}

async function generateMergedPage(
  root: string,
  entry: MergedConcept,
  claims: ClaimRecord[],
): Promise<void> {
  const pagePath = path.join(root, CONCEPTS_DIR, `${entry.slug}.md`);
  const existingPage = await safeReadFile(pagePath);
  const relatedPages = await loadRelatedPages(root, entry.slug);
  const conceptClaims = claims.filter((claim) => claim.conceptSlug === entry.slug);
  const system = buildPagePrompt(
    entry.concept.concept,
    entry.combinedContent,
    existingPage,
    relatedPages,
  );

  const pageBody = await callClaude({
    system,
    messages: [
      { role: "user", content: `请为“${entry.concept.concept}”写一篇中文 wiki 页面。` },
    ],
  });

  const now = new Date().toISOString();
  const existing = existingPage ? parseFrontmatter(existingPage) : null;
  const createdAt = (existing?.meta.createdAt && typeof existing.meta.createdAt === "string")
    ? existing.meta.createdAt
    : now;
  const frontmatterFields: Record<string, unknown> = {
    title: entry.concept.concept,
    summary: entry.concept.summary,
    sources: entry.sourceFiles,
    createdAt,
    updatedAt: now,
  };
  addObsidianMeta(frontmatterFields, entry.concept.concept, entry.concept.tags ?? []);
  const fullPage = [
    buildFrontmatter(frontmatterFields),
    "",
    pageBody.trim(),
    "",
    renderClaimSections(conceptClaims, entry.sourceFiles),
    "",
  ].join("\n");
  await writePageIfValid(pagePath, fullPage, entry.concept.concept);
}

function renderClaimSections(claims: ClaimRecord[], sourceFiles: string[]): string {
  const active = claims
    .filter((claim) => claim.status === "active" || claim.status === "stale")
    .sort((left, right) => right.confidence - left.confidence);
  const contested = claims.filter((claim) => claim.status === "contested");
  const superseded = claims.filter((claim) => claim.status === "superseded");
  const lines = [
    "## 置信度概览",
    "",
  ];

  if (active.length === 0) {
    lines.push("- 暂无高置信结论。", "");
  } else {
    for (const claim of active) {
      lines.push(
        `- ${claim.claimText}（confidence ${claim.confidence.toFixed(2)} / retention ${claim.retention.toFixed(2)} / last confirmed ${claim.lastConfirmedAt.slice(0, 10)}）`,
      );
    }
    lines.push("");
  }

  lines.push("## 冲突 / 争议结论", "");
  if (contested.length === 0) {
    lines.push("- 暂无。", "");
  } else {
    for (const claim of contested) {
      lines.push(`- ${claim.claimText}（支持 ${claim.supportCount} / 冲突 ${claim.contradictionCount}）`);
    }
    lines.push("");
  }

  lines.push("## 已替代历史结论", "");
  if (superseded.length === 0) {
    lines.push("- 暂无。", "");
  } else {
    for (const claim of superseded) {
      lines.push(`- ${claim.claimText}（已被更新信息替代）`);
    }
    lines.push("");
  }

  lines.push("## 来源", "");
  for (const file of sourceFiles) {
    lines.push(`- ^[${file}]`);
  }
  return lines.join("\n");
}

async function extractConcepts(
  sourceContent: string,
  existingIndex: string,
): Promise<ExtractedConcept[]> {
  const system = buildExtractionPrompt(sourceContent, existingIndex);
  const rawOutput = await callClaude({
    system,
    messages: [{ role: "user", content: "请从这个源文档中抽取关键中文知识概念。" }],
    tools: [CONCEPT_EXTRACTION_TOOL],
  });

  return parseConcepts(rawOutput);
}

async function loadRelatedPages(root: string, excludeSlug: string): Promise<string> {
  const conceptsPath = path.join(root, CONCEPTS_DIR);
  let files: string[];

  try {
    files = await readdir(conceptsPath);
  } catch {
    return "";
  }

  const related = files
    .filter((file) => file.endsWith(".md") && file !== `${excludeSlug}.md`)
    .slice(0, 5);
  const contents: string[] = [];

  for (const file of related) {
    const content = await safeReadFile(path.join(conceptsPath, file));
    if (!content) continue;
    const { meta } = parseFrontmatter(content);
    if (meta.orphaned) continue;
    contents.push(content);
  }

  return contents.join("\n\n---\n\n");
}

async function writePageIfValid(pagePath: string, content: string, conceptTitle: string): Promise<void> {
  if (!validateWikiPage(content)) {
    output.status("!", output.warn(`Invalid page for "${conceptTitle}" - skipped.`));
    return;
  }

  await atomicWrite(pagePath, content);
}

async function persistSourceState(
  root: string,
  sourcePath: string,
  sourceFile: string,
  concepts: ReturnType<typeof parseConcepts>,
): Promise<void> {
  const hash = await hashFile(sourcePath);
  const entry: SourceState = {
    hash,
    concepts: concepts.map((concept) => slugify(concept.concept)),
    compiledAt: new Date().toISOString(),
  };

  await updateSourceState(root, sourceFile, entry);
}
