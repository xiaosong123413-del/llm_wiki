/**
 * Markdown helpers for flash-diary Memory.
 *
 * Keeps the tiered Memory document structure stable while letting the caller
 * update short-term and long-term sections independently.
 */

const EMPTY_MEMORY_BULLET = "- 暂无";
const LEGACY_SHORT_TERM_PREFIX = "- 可见窗口：";

export const SHORT_TERM_WINDOW_DAYS = 7;
const SHORT_TERM_HEADING = "## 短期记忆（最近 7 天）";
const LONG_TERM_HEADING = "## 长期记忆";
const LONG_TERM_SECTION_TITLES = [
  "人物与关系",
  "项目与系统",
  "方法论与偏好",
  "长期问题与矛盾",
  "近期变化",
  "来源范围",
] as const;

type LongTermSectionTitle = (typeof LONG_TERM_SECTION_TITLES)[number];
type LongTermSections = Record<LongTermSectionTitle, string>;

export const MEMORY_TEMPLATE = buildTieredMemoryMarkdown(createEmptyLongTermSections(), []);

export function hasTieredMemoryStructure(raw: string): boolean {
  return raw.includes(SHORT_TERM_HEADING)
    && raw.includes(LONG_TERM_HEADING)
    && LONG_TERM_SECTION_TITLES.every((title) => raw.includes(`### ${title}`));
}

export function hasLegacyShortTermPlaceholder(raw: string): boolean {
  return raw.includes(LEGACY_SHORT_TERM_PREFIX);
}

function createEmptyLongTermSections(): LongTermSections {
  return {
    "人物与关系": EMPTY_MEMORY_BULLET,
    "项目与系统": EMPTY_MEMORY_BULLET,
    "方法论与偏好": EMPTY_MEMORY_BULLET,
    "长期问题与矛盾": EMPTY_MEMORY_BULLET,
    "近期变化": EMPTY_MEMORY_BULLET,
    "来源范围": EMPTY_MEMORY_BULLET,
  };
}

export function extractLongTermSections(raw: string): LongTermSections {
  const sections = createEmptyLongTermSections();
  for (const title of LONG_TERM_SECTION_TITLES) {
    sections[title] = extractLongTermSection(raw, title) ?? EMPTY_MEMORY_BULLET;
  }
  return sections;
}

export function mergeLongTermSections(currentSections: LongTermSections, updatedSections: LongTermSections): LongTermSections {
  const mergedSections = createEmptyLongTermSections();
  for (const title of LONG_TERM_SECTION_TITLES) {
    mergedSections[title] = shouldKeepCurrentSection(currentSections[title], updatedSections[title])
      ? currentSections[title]
      : updatedSections[title];
  }
  return mergedSections;
}

export function normalizeMemoryMarkdown(value: string, shortTermLines: readonly string[]): string {
  const source = normalizeMarkdownSource(value);
  return buildTieredMemoryMarkdown(
    extractLongTermSections(source),
    shortTermLines,
  );
}

export function buildTieredMemoryMarkdown(longTermSections: LongTermSections, shortTermLines: readonly string[]): string {
  const lines = [
    "# Memory",
    "",
    SHORT_TERM_HEADING,
    ...(shortTermLines.length > 0 ? shortTermLines : [EMPTY_MEMORY_BULLET]),
    "",
    LONG_TERM_HEADING,
    "",
  ];
  for (const title of LONG_TERM_SECTION_TITLES) {
    lines.push(`### ${title}`, normalizeSectionBody(longTermSections[title]), "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function readShortTermSectionLines(raw: string): string[] {
  const body = extractSectionBody(raw, SHORT_TERM_HEADING, [SHORT_TERM_HEADING, LONG_TERM_HEADING]);
  if (!body) {
    return [];
  }
  return body.split("\n").map((line) => line.trimEnd());
}

function normalizeMarkdownSource(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : MEMORY_TEMPLATE.trim();
}

function extractLongTermSection(raw: string, title: LongTermSectionTitle): string | null {
  const tieredSection = extractSectionBody(
    raw,
    `### ${title}`,
    LONG_TERM_SECTION_TITLES.map((value) => `### ${value}`),
  );
  if (tieredSection) {
    return tieredSection;
  }
  return extractSectionBody(
    raw,
    `## ${title}`,
    LONG_TERM_SECTION_TITLES.map((value) => `## ${value}`),
  );
}

function shouldKeepCurrentSection(currentSection: string, updatedSection: string): boolean {
  return normalizeSectionBody(currentSection) !== EMPTY_MEMORY_BULLET
    && normalizeSectionBody(updatedSection) === EMPTY_MEMORY_BULLET;
}

function extractSectionBody(raw: string, heading: string, stopHeadings: readonly string[]): string | null {
  const nextHeadings = stopHeadings.filter((value) => value !== heading);
  const escapedStopHeadings = nextHeadings.map(escapeRegExp).join("|");
  const stopExpression = escapedStopHeadings.length > 0
    ? `(?=\\n(?:${escapedStopHeadings})(?:\\n|$)|$)`
    : "$";
  const pattern = new RegExp(`(?:^|\\n)${escapeRegExp(heading)}\\n([\\s\\S]*?)${stopExpression}`);
  const match = pattern.exec(raw);
  const body = match?.[1]?.trim();
  return body && body.length > 0 ? body : null;
}

function normalizeSectionBody(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : EMPTY_MEMORY_BULLET;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
