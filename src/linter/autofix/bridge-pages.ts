/**
 * Deterministic repairer for migration-backed bridge pages.
 *
 * A bridge page is created only when a broken wikilink exactly matches an
 * entry in `.llmwiki/link-migrations.json` and the canonical target exists.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  atomicWrite,
  buildFrontmatter,
  parseFrontmatter,
  slugify,
} from "../../utils/markdown.js";
import type { LintAutofixDetail, LintResult } from "../types.js";
import { normalizeWikilinkTarget } from "../wiki-page-index.js";
import type { AutofixContext, AutofixRepairer } from "./types.js";

interface LinkMigration {
  oldTitle: string;
  canonicalPath: string;
  createdAt: string;
  reason: string;
}

interface MigrationReadResult {
  errorReason?: string;
  migrations: LinkMigration[];
}

export const bridgePageRepairer: AutofixRepairer = {
  name: "bridge-page",
  async run(context): Promise<LintAutofixDetail[]> {
    const diagnostics = context.diagnostics.filter((result) => result.rule === "broken-wikilink");
    const migrationResult = await readMigrations(context.root);
    const details: LintAutofixDetail[] = [];

    for (const diagnostic of diagnostics) {
      details.push(await repairBridgePageDiagnostic(context.root, diagnostic, migrationResult));
    }

    return details;
  },
};

async function repairBridgePageDiagnostic(
  root: string,
  diagnostic: LintResult,
  migrationResult: MigrationReadResult,
): Promise<LintAutofixDetail> {
  if (migrationResult.errorReason) {
    return makeDetail(root, "failed", diagnostic.file, migrationResult.errorReason);
  }
  const migration = matchMigration(migrationResult.migrations, diagnostic.message);
  if (migration === "unparseable") {
    return makeDetail(root, "failed", diagnostic.file, "unparseable-target");
  }
  if (migration === "ambiguous") {
    return makeDetail(root, "skipped", diagnostic.file, "ambiguous-migration");
  }
  if (!migration) {
    return makeDetail(root, "skipped", diagnostic.file, "missing-migration");
  }
  return await createBridgePage(root, migration);
}

function matchMigration(
  migrations: readonly LinkMigration[],
  message: string,
): LinkMigration | "ambiguous" | "unparseable" | null {
  const captured = message.match(/\[\[(.+?)\]\]/)?.[1];
  if (!captured) {
    return "unparseable";
  }

  const visibleTarget = normalizeWikilinkTarget(captured);
  const matches = migrations.filter((entry) => entry.oldTitle.trim() === visibleTarget);
  return matches.length > 1 ? "ambiguous" : matches[0] ?? null;
}

async function createBridgePage(root: string, migration: LinkMigration): Promise<LintAutofixDetail> {
  const canonicalFile = resolveCanonicalFile(root, migration.canonicalPath);
  if (!canonicalFile) {
    return makeDetail(root, "failed", migration.canonicalPath, "unsafe-canonical-path");
  }
  if (!existsSync(canonicalFile)) {
    return makeDetail(root, "failed", migration.canonicalPath, "missing-canonical-page");
  }
  if (path.extname(canonicalFile).toLowerCase() !== ".md") {
    return makeDetail(root, "failed", migration.canonicalPath, "invalid-canonical-path");
  }
  const bridgeFile = path.join(path.dirname(canonicalFile), `${slugify(migration.oldTitle)}.md`);
  if (existsSync(bridgeFile)) {
    return makeDetail(root, "skipped", bridgeFile, "bridge-already-exists");
  }
  const canonicalTitle = await readCanonicalTitle(canonicalFile);
  if (!canonicalTitle) {
    return makeDetail(root, "failed", migration.canonicalPath, "invalid-canonical-path");
  }
  await atomicWrite(bridgeFile, buildBridgePageContent(migration.oldTitle, canonicalTitle));
  return makeDetail(root, "applied", bridgeFile, "created-bridge-page");
}

async function readCanonicalTitle(canonicalFile: string): Promise<string | null> {
  try {
    const canonicalContent = await readFile(canonicalFile, "utf8");
    const canonicalMeta = parseFrontmatter(canonicalContent).meta;
    return typeof canonicalMeta.title === "string" ? canonicalMeta.title : path.basename(canonicalFile, ".md");
  } catch {
    return null;
  }
}

function buildBridgePageContent(oldTitle: string, canonicalTitle: string): string {
  return [
    buildFrontmatter({
      title: oldTitle,
      summary: `桥接页：兼容旧链接，指向 [[${canonicalTitle}]]。`,
      aliases: [oldTitle],
    }),
    "",
    `# ${oldTitle}`,
    "",
    `本页是桥接页，请改用 [[${canonicalTitle}]]。`,
  ].join("\n");
}

async function readMigrations(root: string): Promise<MigrationReadResult> {
  const filePath = path.join(root, ".llmwiki", "link-migrations.json");
  if (!existsSync(filePath)) {
    return { migrations: [] };
  }

  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as { migrations?: unknown };
    if (!Array.isArray(parsed.migrations)) {
      return { migrations: [] };
    }

    const migrations = parsed.migrations.flatMap((migration) => {
      if (!isLinkMigration(migration)) {
        return [];
      }
      return [migration];
    });

    return { migrations };
  } catch {
    return { errorReason: "invalid-migration-map", migrations: [] };
  }
}

function isLinkMigration(value: unknown): value is LinkMigration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const migration = value as Record<string, unknown>;
  return (
    typeof migration.oldTitle === "string"
    && typeof migration.canonicalPath === "string"
    && typeof migration.createdAt === "string"
    && typeof migration.reason === "string"
  );
}

function resolveCanonicalFile(root: string, canonicalPath: string): string | null {
  const wikiRoot = path.resolve(root, "wiki");
  const resolved = path.resolve(root, canonicalPath);
  if (resolved === wikiRoot) {
    return null;
  }
  return resolved.startsWith(`${wikiRoot}${path.sep}`) ? resolved : null;
}

function makeDetail(
  root: string,
  status: "applied" | "skipped" | "failed",
  target: string,
  reason: string,
): LintAutofixDetail {
  return {
    repairer: "bridge-page",
    kind: "broken-wikilink",
    target: path.relative(root, target).replace(/\\/g, "/"),
    reason,
    status,
  };
}
