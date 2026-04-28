/**
 * Rebuild the wiki landing pages for a target vault.
 *
 * This script keeps CLI argument parsing and file writes local while the
 * content-generation helpers live in a testable core module.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildIndex,
  buildMoc,
  collectPages,
} from "./regenerate-vault-index-core.mjs";

const vaultRoot = process.argv[2];
if (!vaultRoot) {
  console.error("Usage: node scripts/regenerate-vault-index.mjs <vault-root>");
  process.exit(1);
}

const wikiRoot = path.join(vaultRoot, "wiki");

const concepts = await collectPages(path.join(wikiRoot, "concepts"));
const queries = await collectPages(path.join(wikiRoot, "queries"));

await writeFile(path.join(wikiRoot, "index.md"), buildIndex(concepts, queries), "utf8");
await writeFile(path.join(wikiRoot, "MOC.md"), buildMoc(concepts), "utf8");

console.log(`Regenerated index and MOC for ${concepts.length + queries.length} pages.`);
