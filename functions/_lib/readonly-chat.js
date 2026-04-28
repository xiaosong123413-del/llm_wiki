/**
 * Shared readonly-chat helpers for Cloudflare Pages functions.
 *
 * Both the standalone assistant endpoint and the conversation message
 * endpoint prepare the same wiki-context prompt and parse the same
 * OpenAI-compatible response shape, so these helpers keep that behavior in
 * one place.
 */

const MAX_CONTEXTS = 8;
const MAX_CONTEXT_CHARS = 1800;

export function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, "");
}

export function normalizeContexts(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, MAX_CONTEXTS).map((item) => ({
    title: stringField(item, "title").slice(0, 120),
    path: stringField(item, "path").slice(0, 240),
    excerpt: stringField(item, "excerpt").slice(0, 300),
    text: stringField(item, "text").slice(0, MAX_CONTEXT_CHARS),
  }));
}

export function buildReadonlyPrompt(question, contexts) {
  const sources = contexts.length
    ? contexts
        .map((item, index) => `【${index + 1}】${item.title}\n路径：${item.path}\n摘要：${item.excerpt}\n正文片段：${item.text}`)
        .join("\n\n")
    : "未命中相关 Wiki 片段。";
  return `用户问题：${question}\n\n可用 Wiki 片段：\n${sources}`;
}

export function readReadonlyChatOutputText(data) {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0];
  if (!first || typeof first !== "object") {
    return "没有返回内容。";
  }
  const content = first.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "没有返回内容。";
  }
  return content
    .map((part) => (part && typeof part === "object" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim() || "没有返回内容。";
}

export function readReadonlyChatError(data, fallbackMessage) {
  if (data && typeof data === "object" && data.error && typeof data.error.message === "string") {
    return data.error.message;
  }
  return fallbackMessage;
}

function stringField(value, key) {
  if (!value || typeof value !== "object") {
    return "";
  }
  const field = value[key];
  return typeof field === "string" ? field : "";
}
