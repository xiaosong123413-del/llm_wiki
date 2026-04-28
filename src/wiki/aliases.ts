import { buildFrontmatter, parseFrontmatter } from "../utils/markdown.js";

const HAN_REGEX = /\p{Script=Han}/u;
const TRAILING_PAREN_SUFFIX_REGEX = /\s*[\uFF08(][^()\uFF08\uFF09]*[\uFF09)]\s*$/u;
const TRAILING_OPEN_PAREN_REGEX = /[\s\uFF08(]+$/u;
const H1_REGEX = /^#\s+(.+)$/m;
const SOURCE_STEM_REGEX = /__[^_]+__([^_].*?)__([a-f0-9]{8,32})\.md$/i;
const ENGLISH_TITLE_REGEX = /^[A-Za-z0-9\s&/+:'"-]+(?:\s*[\uFF08(][A-Za-z0-9\s&/+:'"-]+[\uFF09)])?$/;
const MIXED_TITLE_PREFIX_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s&/+:'"-]*/;
const MIXED_TITLE_PAREN_ALIAS_REGEX = /^([A-Za-z0-9][A-Za-z0-9\s&/+:'"-]*?)\s*([\p{Script=Han}]{1,4})\s*[\uFF08(]/u;
const EMBEDDED_MARKDOWN_BLOCK_REGEX = /(?:^|\n)(```|~~~)(?:markdown|md)\s*\n([\s\S]*?)\n\1/g;

function getPrimaryHeading(body: string): string | null {
  const match = body.match(H1_REGEX);
  return match ? match[1].trim() : null;
}

function normalizeChineseAlias(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !HAN_REGEX.test(trimmed)) {
    return null;
  }

  const withoutSuffix = trimmed.replace(TRAILING_PAREN_SUFFIX_REGEX, "").trim();
  if (withoutSuffix && HAN_REGEX.test(withoutSuffix)) {
    return withoutSuffix;
  }

  return trimmed;
}

function normalizeAliases(aliases: unknown): string[] {
  if (!Array.isArray(aliases)) {
    return [];
  }

  return aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0);
}

function uniqueAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

function normalizeEnglishBaseTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed || HAN_REGEX.test(trimmed) || !ENGLISH_TITLE_REGEX.test(trimmed)) {
    return null;
  }

  return trimmed.replace(TRAILING_PAREN_SUFFIX_REGEX, "").replace(/\s+/g, " ").trim() || null;
}

function normalizeVisibleAlias(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(TRAILING_OPEN_PAREN_REGEX, "").trim() || null;
}

function extractMixedTitleAliases(title: string): string[] {
  if (!HAN_REGEX.test(title)) {
    return [];
  }

  const prefixAlias = title.match(MIXED_TITLE_PREFIX_REGEX)?.[0];
  const parentheticalAlias = title.match(MIXED_TITLE_PAREN_ALIAS_REGEX);
  return uniqueAliases([
    normalizeVisibleAlias(prefixAlias ?? "") ?? "",
    normalizeVisibleAlias(
      parentheticalAlias ? `${parentheticalAlias[1]} ${parentheticalAlias[2]}` : "",
    ) ?? "",
  ]);
}

function extractEmbeddedMarkdownBlocks(content: string): string[] {
  return [...content.matchAll(EMBEDDED_MARKDOWN_BLOCK_REGEX)].map((match) => match[2]);
}

function extractBodyFrontmatterBlock(content: string): string[] {
  const { body } = parseFrontmatter(content);
  const trimmedBody = body.trimStart();
  const { meta } = parseFrontmatter(trimmedBody);
  return Object.keys(meta).length > 0 ? [trimmedBody] : [];
}

export function extractChineseAliasCandidate(content: string): string | null {
  const { meta, body } = parseFrontmatter(content);
  const heading = getPrimaryHeading(body);
  const headingAlias = heading ? normalizeChineseAlias(heading) : null;
  if (headingAlias) {
    return headingAlias;
  }

  return typeof meta.title === "string" ? normalizeChineseAlias(meta.title) : null;
}

export function extractSourceAliasCandidates(content: string): string[] {
  const { meta } = parseFrontmatter(content);
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  const aliases: string[] = [];

  for (const source of sources) {
    if (typeof source !== "string") {
      continue;
    }

    const match = source.match(SOURCE_STEM_REGEX);
    if (!match) {
      continue;
    }

    const alias = normalizeChineseAlias(match[1]);
    if (alias) {
      aliases.push(alias);
    }
  }

  return uniqueAliases(aliases);
}

export function extractTitleVariantAliases(content: string): string[] {
  const { meta } = parseFrontmatter(content);
  if (typeof meta.title !== "string") {
    return [];
  }

  const originalTitle = meta.title.trim();
  const baseTitle = normalizeEnglishBaseTitle(originalTitle);
  const aliases = extractMixedTitleAliases(originalTitle);
  if (baseTitle && baseTitle !== originalTitle) {
    aliases.push(baseTitle, baseTitle.replace(/\s+/g, "-"));
  }

  return uniqueAliases(aliases);
}

export function extractEmbeddedAliasCandidates(content: string): string[] {
  const aliases: string[] = [];
  for (const block of [...extractEmbeddedMarkdownBlocks(content), ...extractBodyFrontmatterBlock(content)]) {
    const { meta } = parseFrontmatter(block);
    aliases.push(
      ...normalizeAliases(meta.aliases),
      extractChineseAliasCandidate(block) ?? "",
      ...extractTitleVariantAliases(block),
    );
  }

  return uniqueAliases(aliases);
}

export function addChineseAliasToPage(content: string): string | null {
  const { meta, body } = parseFrontmatter(content);
  if (Object.keys(meta).length === 0) {
    return null;
  }

  const aliases = normalizeAliases(meta.aliases);
  const nextAliases = uniqueAliases([
    ...aliases,
    extractChineseAliasCandidate(content) ?? "",
    ...extractSourceAliasCandidates(content),
    ...extractTitleVariantAliases(content),
    ...extractEmbeddedAliasCandidates(content),
  ]);

  if (nextAliases.length === aliases.length) {
    return null;
  }

  const nextMeta = {
    ...meta,
    aliases: nextAliases,
  };

  return `${buildFrontmatter(nextMeta)}\n\n${body.trimStart()}`;
}
