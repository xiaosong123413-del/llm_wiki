/**
 * Short-term Memory summarization for flash-diary.
 *
 * Produces a 7-day, multi-dimensional summary block that sits above the
 * long-term Memory sections.
 */

import type { LLMProvider } from "../../../src/utils/provider.js";
import { resolveAgentRuntimeProvider } from "./llm-chat.js";

const SHORT_TERM_MAX_TOKENS = 1000;
const FALLBACK_BULLET = "- 暂无明显信息";
const SHORT_TERM_SECTION_TITLES = [
  "健康状态",
  "学习状态",
  "人际关系",
  "爱情状态",
  "财富状态",
  "情绪与能量",
  "近期重点与风险",
] as const;

interface ShortTermDiaryInput {
  date: string;
  raw: string;
}

interface BuildShortTermMemoryOptions {
  projectRoot: string;
  diaries: readonly ShortTermDiaryInput[];
  provider?: LLMProvider;
}

export async function buildShortTermMemoryLines(options: BuildShortTermMemoryOptions): Promise<string[]> {
  if (options.diaries.length === 0) {
    return [];
  }
  const provider = options.provider ?? resolveAgentRuntimeProvider(
    options.projectRoot,
    null,
    "flash-diary-short-term-memory",
  );
  const raw = await provider.complete(
    buildShortTermMemorySystemPrompt(),
    [{ role: "user", content: buildShortTermMemoryUserPrompt(options.diaries) }],
    SHORT_TERM_MAX_TOKENS,
  );
  return normalizeShortTermSummary(raw);
}

function buildShortTermMemorySystemPrompt(): string {
  return [
    "你负责生成一段最近 7 天短期记忆总结。",
    "不要输出 # Memory、## 短期记忆（最近 7 天）或 ## 长期记忆。",
    "只输出以下七个三级标题，顺序必须固定：### 健康状态、### 学习状态、### 人际关系、### 爱情状态、### 财富状态、### 情绪与能量、### 近期重点与风险。",
    "每个标题下写 1 到 3 条 bullet，内容必须是归纳，不要按日期摘录，不要复述整段原文。",
    "没有明确信号的维度写一条：- 暂无明显信息。",
    "不要编造事实，只能根据给定日记归纳。",
  ].join("\n");
}

function buildShortTermMemoryUserPrompt(diaries: readonly ShortTermDiaryInput[]): string {
  const blocks = diaries.map((diary) => [
    `## ${diary.date}`,
    diary.raw.trim(),
  ].join("\n"));
  return [
    "请基于这些最近 7 天日记，输出短期记忆区块内部的 Markdown：",
    "",
    ...blocks,
  ].join("\n\n");
}

function normalizeShortTermSummary(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  const lines: string[] = [];
  for (const title of SHORT_TERM_SECTION_TITLES) {
    lines.push(`### ${title}`);
    const sectionLines = extractSectionLines(normalized, title);
    lines.push(...(sectionLines.length > 0 ? sectionLines : [FALLBACK_BULLET]), "");
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function extractSectionLines(raw: string, title: (typeof SHORT_TERM_SECTION_TITLES)[number]): string[] {
  const heading = `### ${title}`;
  const escapedHeading = escapeRegExp(heading);
  const stopHeadings = SHORT_TERM_SECTION_TITLES
    .filter((value) => value !== title)
    .map((value) => escapeRegExp(`### ${value}`))
    .join("|");
  const stopExpression = stopHeadings.length > 0
    ? `(?=\\n(?:${stopHeadings})(?:\\n|$)|$)`
    : "$";
  const pattern = new RegExp(`(?:^|\\n)${escapedHeading}\\n([\\s\\S]*?)${stopExpression}`);
  const match = pattern.exec(raw);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.startsWith("- ") ? line : `- ${line.replace(/^-+\s*/, "")}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
