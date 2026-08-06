/**
 * Compilation orchestrator for the llmwiki knowledge compiler.
 *
 * Coordinates lock acquisition, change detection, concept extraction, claim
 * lifecycle consolidation, tiered-memory persistence, concept/procedure page
 * generation, interlink resolution, and navigation rebuilds.
 */

import { readFile } from "fs/promises";
import path from "path";
import pLimit from "p-limit";
import { readState, updateSourceState } from "../utils/state.js";
import {
  safeReadFile,
  slugify,
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
import { generateMOC } from "./obsidian.js";
import { appendMaintenanceLog } from "../utils/maintenance-log.js";
import {
  COMPILE_CONCURRENCY,
  INDEX_FILE,
  SOURCES_DIR,
} from "../utils/constants.js";
import {
  buildClaimCandidates,
  readClaims,
  writeClaims,
  writeProcedurePages,
  writeProcedures,
} from "./tiered-memory.js";
import { consolidateClaims, deriveProcedures } from "./claims.js";
import { generateMergedPage, type MergedConcept } from "./concept-pages.js";
import { loadExistingConceptBriefs } from "./concept-context.js";
import { addSummaryConceptLinks, writeSourceSummaryPage } from "./summaries.js";
import * as output from "../utils/output.js";
import type {
  ClaimRecord,
  ExtractedConcept,
  ProcedureRecord,
  SourceChange,
  SourceState,
  WikiState,
} from "../utils/types.js";

interface CompileResultSummary {
  claimsUpdated: number;
  proceduresUpdated: number;
}

interface ChangeSet {
  changes: SourceChange[];
  toCompile: SourceChange[];
  deleted: SourceChange[];
  unchanged: SourceChange[];
}

interface ExtractionOutcome {
  extractions: ExtractionResult[];
  frozenSlugs: Set<string>;
}

interface GenerationOutcome {
  lifecycle: CompileResultSummary & { claims: ClaimRecord[]; procedures: ProcedureRecord[] };
  allChangedSlugs: string[];
  allNewSlugs: string[];
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

/** Detect source changes and classify them into compile/delete/unchanged buckets. */
async function prepareChangeSet(root: string, state: WikiState): Promise<ChangeSet> {
  const changes = await detectChanges(root, state);
  const affectedFiles = findAffectedSources(state, changes);
  for (const file of affectedFiles) {
    output.status("~", output.info(`${file} [affected by shared concept]`));
    changes.push({ file, status: "changed" });
  }
  return {
    changes,
    toCompile: changes.filter((c) => c.status === "new" || c.status === "changed"),
    deleted: changes.filter((c) => c.status === "deleted"),
    unchanged: changes.filter((c) => c.status === "unchanged"),
  };
}

/** Process deletions, resolve frozen slugs, and extract concepts for changed sources. */
async function extractAllConcepts(
  root: string,
  state: WikiState,
  changes: SourceChange[],
  toCompile: SourceChange[],
  deleted: SourceChange[],
): Promise<ExtractionOutcome> {
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
  return { extractions, frozenSlugs };
}

/** Run tiered-memory updates, merge extractions, and generate wiki pages. */
async function generateAllPages(
  root: string,
  extractions: ExtractionResult[],
  frozenSlugs: Set<string>,
): Promise<GenerationOutcome> {
  const lifecycle = await updateTieredMemory(root, extractions);
  const merged = mergeExtractions(extractions, frozenSlugs);
  const limit = pLimit(COMPILE_CONCURRENCY);
  const pageResults = await Promise.all(
    merged.map((entry) => limit(async () => {
      await generateMergedPage(root, entry, lifecycle.claims);
      return entry;
    })),
  );
  return {
    lifecycle,
    allChangedSlugs: pageResults.map((entry) => entry.slug),
    allNewSlugs: pageResults
      .filter((entry) => entry.concept.is_new)
      .map((entry) => entry.slug),
  };
}

/** Persist source states, orphan unowned frozen pages, and resolve interlinks. */
async function persistAllResults(
  root: string,
  extractions: ExtractionResult[],
  frozenSlugs: Set<string>,
  allChangedSlugs: string[],
  allNewSlugs: string[],
): Promise<void> {
  for (const result of extractions) {
    if (result.concepts.length === 0) continue;
    await persistSourceState(root, result.sourcePath, result.sourceFile, result.concepts);
    await addSummaryConceptLinks(
      root,
      result.summaryLinkTarget,
      result.concepts
        .map((concept) => slugify(concept.concept))
        .filter((slug) => !frozenSlugs.has(slug))
        .map((slug) => `concepts/${slug}`),
    );
  }

  if (frozenSlugs.size > 0) {
    await orphanUnownedFrozenPages(root, frozenSlugs);
  }
  await persistFrozenSlugs(root, frozenSlugs, extractions);

  if (allChangedSlugs.length > 0) {
    output.status("*", output.info("Resolving interlinks..."));
    await resolveLinks(root, allChangedSlugs, allNewSlugs);
  }
}

/** Print the final compilation summary to the console. */
function printFinalSummary(
  toCompile: SourceChange[],
  unchanged: SourceChange[],
  deleted: SourceChange[],
  lifecycle: CompileResultSummary,
): void {
  output.header("Compilation complete");
  output.status(
    "*",
    output.success(`${toCompile.length} compiled, ${unchanged.length} skipped, ${deleted.length} deleted`),
  );
  output.status(
    "*",
    output.dim(`claims ${lifecycle.claimsUpdated}, procedures ${lifecycle.proceduresUpdated}`),
  );
  if (toCompile.length > 0) {
    output.status(">", output.dim('Next: llmwiki query "your question here"'));
  }
}

async function runCompilePipeline(root: string): Promise<void> {
  const state = await readState(root);
  const { changes, toCompile, deleted, unchanged } = await prepareChangeSet(root, state);

  if (toCompile.length === 0 && deleted.length === 0) {
    await rebuildNavigation(root);
    await logCompile(root, 0, unchanged.length, 0, {
      claimsUpdated: 0,
      proceduresUpdated: 0,
    });
    output.status("*", output.success("Nothing to compile - all sources up to date."));
    return;
  }

  const { extractions, frozenSlugs } = await extractAllConcepts(root, state, changes, toCompile, deleted);
  const { lifecycle, allChangedSlugs, allNewSlugs } = await generateAllPages(root, extractions, frozenSlugs);
  await persistAllResults(root, extractions, frozenSlugs, allChangedSlugs, allNewSlugs);
  await rebuildNavigation(root);
  await logCompile(root, toCompile.length, unchanged.length, deleted.length, lifecycle);
  printFinalSummary(toCompile, unchanged, deleted, lifecycle);
}

async function updateTieredMemory(
  root: string,
  extractions: ExtractionResult[],
): Promise<CompileResultSummary & { claims: ClaimRecord[]; procedures: ProcedureRecord[] }> {
  const successfulExtractions = extractions.filter((result) => result.concepts.length > 0);
  const existingClaims = await readClaims(root);
  const candidates = successfulExtractions.flatMap((result) => buildClaimCandidates(result));
  const consolidated = consolidateClaims(existingClaims, candidates);
  const claims = consolidated.claims;
  const procedures = deriveProcedures(claims);

  await writeClaims(root, claims);
  await writeProcedures(root, procedures);
  await writeProcedurePages(root, procedures);

  return {
    claims,
    procedures,
    claimsUpdated: claims.length,
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
  const summary = await writeSourceSummaryPage(root, sourceFile, sourceContent);
  const existingIndex = await safeReadFile(path.join(root, INDEX_FILE));
  const existingConceptBriefs = await loadExistingConceptBriefs(root);
  const concepts = await extractConcepts(summary.markdown, existingIndex, existingConceptBriefs);

  if (concepts.length > 0) {
    const names = concepts.map((concept) => concept.concept).join(", ");
    output.status("*", output.dim(`  Found ${concepts.length} concepts: ${names}`));
  }

  return {
    sourceFile,
    sourcePath,
    sourceContent,
    summaryContent: summary.markdown,
    summaryLinkTarget: summary.linkTarget,
    summaryWikiPath: summary.wikiPath,
    concepts,
  };
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
        existing.summaryLinks.push(result.summaryLinkTarget);
        existing.combinedContent += `\n\n--- SUMMARY: ${result.summaryWikiPath} ---\n\n${result.summaryContent}`;
      } else {
        bySlug.set(slug, {
          slug,
          concept,
          summaryLinks: [result.summaryLinkTarget],
          combinedContent: `--- SUMMARY: ${result.summaryWikiPath} ---\n\n${result.summaryContent}`,
        });
      }
    }
  }

  return Array.from(bySlug.values());
}

async function extractConcepts(
  sourceContent: string,
  existingIndex: string,
  existingConceptBriefs: string,
): Promise<ExtractedConcept[]> {
  const system = buildExtractionPrompt(sourceContent, existingIndex, existingConceptBriefs);
  const rawOutput = await callClaude({
    system,
    messages: [{ role: "user", content: "请从这个源文档中抽取关键中文知识概念。" }],
    tools: [CONCEPT_EXTRACTION_TOOL],
  });

  return parseConcepts(rawOutput);
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
