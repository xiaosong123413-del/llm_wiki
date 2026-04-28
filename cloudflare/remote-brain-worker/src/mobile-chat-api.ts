/**
 * Mobile chat routes and reply synthesis for the remote-brain Worker.
 *
 * Pulling the mobile assistant flow out of the main Worker entrypoint keeps the
 * route table thin while preserving the current chat behavior and test hooks.
 */

import {
  buildMobileSearchRequest,
  mergeMobileChatSources,
  normalizeMobileWebSearchResults,
  resolveMobileChatMode,
  toWebChatSource,
  toWikiChatSource,
  type MobileChatMode,
  type MobileChatSource,
  type MobileWebSearchResult,
} from "./mobile-chat.js";
import {
  isExternalMobileAiProvider,
  runMobileAiText,
} from "./mobile-ai-provider.js";
import { normalizeMobileChatRecord } from "./mobile-runtime-helpers.js";
import type {
  MobileAiProviderRequest,
  MobileChatEnv,
  MobileChatMessage,
  MobileChatPayload,
  MobileChatRecord,
  MobileOwnerPayload,
  MobileWebSearchOutcome,
  MobileWikiContextItem,
} from "./mobile-shared.js";
import {
  json,
  requireAi,
  safeJson,
} from "./worker-support.js";

let mobileChatSchemaReady = false;

export async function handleMobileChatList(request: Request, env: MobileChatEnv): Promise<Response> {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const ownerUid = String((await safeJson<MobileOwnerPayload>(request)).ownerUid ?? "").trim();
  if (!ownerUid) return json({ ok: false, error: "missing_owner_uid" }, 400);
  await ensureMobileChatSchema(db);
  const result = await db.prepare("SELECT id, owner_uid AS ownerUid, title, mode, messages_json AS messagesJson, sources_json AS sourcesJson, created_at AS createdAt, updated_at AS updatedAt FROM mobile_chats WHERE owner_uid = ? ORDER BY updated_at DESC LIMIT 100").bind(ownerUid).all();
  return json({ ok: true, chats: (result.results ?? []).map(normalizeMobileChatRecord) });
}

export async function handleMobileChatSend(request: Request, env: MobileChatEnv): Promise<Response> {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const payload = await safeJson<MobileChatPayload>(request);
  const ownerUid = String(payload.ownerUid ?? "").trim();
  const message = String(payload.message ?? "").trim();
  const mode = resolveMobileChatMode(payload.mode);
  if (!ownerUid) return json({ ok: false, error: "missing_owner_uid" }, 400);
  if (!message) return json({ ok: false, error: "missing_message" }, 400);
  await ensureMobileChatSchema(db);
  const currentChat = await readMobileChat(db, ownerUid, payload.chatId);
  const wikiContext = mode === "web" ? [] : await searchMobileWikiContext(env, message);
  const webSearch = mode === "wiki" ? emptyMobileWebSearchOutcome() : await searchMobileWebContext(env, message, 5);
  if (mobileChatNeedsModel(mode, wikiContext, webSearch) && !isExternalMobileAiProvider(payload.aiProvider)) {
    const missing = requireAi(env, env.LLM_MODEL);
    if (missing) return missing;
  }
  let reply: { text: string; sources: MobileChatSource[] };
  try {
    reply = await buildMobileChatReply(env, mode, message, currentChat?.messages ?? [], wikiContext, webSearch, payload.aiProvider);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "mobile_chat_failed" }, 500);
  }
  const chat = createMobileChatRecord(payload.chatId, ownerUid, message, mode, currentChat, reply);
  await saveMobileChat(db, chat);
  return json({ ok: true, chat });
}

export async function buildMobileChatReply(
  env: MobileChatEnv,
  mode: MobileChatMode,
  message: string,
  history: readonly MobileChatMessage[],
  wikiContext: readonly MobileWikiContextItem[],
  webSearch: MobileWebSearchOutcome,
  aiProvider?: MobileAiProviderRequest,
): Promise<{ text: string; sources: MobileChatSource[] }> {
  const wikiSources = wikiContext.map((item) => toWikiChatSource({ title: item.title, path: item.path }));
  const webSources = webSearch.ok ? webSearch.results.map((item, index) => toWebChatSource(item, index)) : [];
  if (mode === "wiki" && wikiSources.length === 0) return { text: "未找到相关 wiki 来源。", sources: [] };
  if (mode === "web" && !webSearch.ok) return { text: "网络搜索不可用。", sources: [] };
  if (mode === "web" && webSources.length === 0) return { text: "未找到相关网络结果。", sources: [] };
  if (mode === "hybrid" && wikiSources.length === 0 && !webSearch.ok) return { text: "未找到相关 wiki 来源，且网络搜索不可用。", sources: [] };
  if (mode === "hybrid" && wikiSources.length === 0 && webSources.length === 0) return { text: "未找到相关 wiki 来源，也未找到相关网络结果。", sources: [] };
  const scopeNote = buildMobileChatScopeNote(mode, wikiSources.length > 0, webSearch.ok, webSources.length > 0);
  const sources = mode === "wiki" ? wikiSources : mode === "web" ? webSources : mergeMobileChatSources(wikiSources, webSources);
  const text = await generateMobileChatAnswer(env, scopeNote, message, history, wikiContext, webSearch.ok ? webSearch.results : [], aiProvider);
  return { text, sources };
}

async function ensureMobileChatSchema(db: D1Database): Promise<void> {
  if (mobileChatSchemaReady) return;
  try {
    await db.prepare("ALTER TABLE mobile_chats ADD COLUMN mode TEXT NOT NULL DEFAULT 'wiki'").run();
  } catch {
    // Ignore when the column already exists.
  }
  mobileChatSchemaReady = true;
}

async function readMobileChat(
  db: D1Database,
  ownerUid: string,
  chatId: string | undefined,
): Promise<MobileChatRecord | null> {
  if (!chatId) return null;
  const row = await db.prepare("SELECT id, owner_uid AS ownerUid, title, mode, messages_json AS messagesJson, sources_json AS sourcesJson, created_at AS createdAt, updated_at AS updatedAt FROM mobile_chats WHERE id = ? AND owner_uid = ?")
    .bind(chatId, ownerUid)
    .first();
  return row ? normalizeMobileChatRecord(row) : null;
}

function mobileChatNeedsModel(
  mode: MobileChatMode,
  wikiContext: readonly MobileWikiContextItem[],
  webSearch: MobileWebSearchOutcome,
): boolean {
  if (mode === "wiki") return wikiContext.length > 0;
  if (mode === "web") return webSearch.ok && webSearch.results.length > 0;
  return wikiContext.length > 0 || (webSearch.ok && webSearch.results.length > 0);
}

function createMobileChatRecord(
  chatId: string | undefined,
  ownerUid: string,
  message: string,
  mode: MobileChatMode,
  currentChat: MobileChatRecord | null,
  reply: { text: string; sources: MobileChatSource[] },
): MobileChatRecord {
  const now = new Date().toISOString();
  return {
    id: chatId || crypto.randomUUID(),
    ownerUid,
    title: currentChat?.title || message.slice(0, 32) || "新对话",
    mode,
    messages: buildMobileChatMessages(currentChat?.messages ?? [], message, reply.text, now),
    sources: reply.sources,
    createdAt: currentChat?.createdAt || now,
    updatedAt: new Date().toISOString(),
  };
}

async function saveMobileChat(db: D1Database, chat: MobileChatRecord): Promise<void> {
  await db.prepare(
    "INSERT INTO mobile_chats (id, owner_uid, title, mode, messages_json, sources_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, mode = excluded.mode, messages_json = excluded.messages_json, sources_json = excluded.sources_json, updated_at = excluded.updated_at",
  ).bind(chat.id, chat.ownerUid, chat.title, chat.mode, JSON.stringify(chat.messages), JSON.stringify(chat.sources), chat.createdAt, chat.updatedAt).run();
}

function buildMobileChatScopeNote(
  mode: MobileChatMode,
  hasWiki: boolean,
  webAvailable: boolean,
  hasWeb: boolean,
): string {
  if (mode === "wiki") return "只根据 wiki 来源回答，不要补充联网信息。";
  if (mode === "web") return "只根据网络搜索结果回答，并在回答中保持来源可追溯。";
  if (!webAvailable) return "当前网络搜索不可用，只根据 wiki 来源回答，并明确说明这一点。";
  if (!hasWiki) return "本次没有找到相关 wiki 来源，只根据网络搜索结果回答，并明确说明这一点。";
  if (!hasWeb) return "本次没有找到相关网络结果，只根据 wiki 来源回答，并明确说明这一点。";
  return "同时综合 wiki 与网络搜索结果回答，并明确区分哪些信息来自 wiki，哪些来自网络。";
}

async function generateMobileChatAnswer(
  env: MobileChatEnv,
  scopeNote: string,
  message: string,
  history: readonly MobileChatMessage[],
  wikiContext: readonly MobileWikiContextItem[],
  webResults: readonly MobileWebSearchResult[],
  aiProvider?: MobileAiProviderRequest,
): Promise<string> {
  const text = await runMobileAiText(env, aiProvider, [
    { role: "system", content: "你是 LLM Wiki 手机端助手。回答必须简洁、可执行、可追溯。" },
    { role: "user", content: buildMobileChatPrompt(scopeNote, message, history, wikiContext, webResults) },
  ]);
  return text.trim() || "没有生成可用回答。";
}

function buildMobileChatPrompt(
  scopeNote: string,
  message: string,
  history: readonly MobileChatMessage[],
  wikiContext: readonly MobileWikiContextItem[],
  webResults: readonly MobileWebSearchResult[],
): string {
  return [
    scopeNote,
    history.length > 0 ? `最近对话：\n${history.slice(-12).map((item) => `${item.role === "user" ? "用户" : "助手"}：${item.content}`).join("\n")}` : "",
    wikiContext.length > 0 ? `Wiki 来源：\n${wikiContext.map((item, index) => `#${index + 1} ${item.title}\n路径：${item.path}\n${item.content}`).join("\n\n")}` : "",
    webResults.length > 0 ? `网络来源：\n${webResults.map((item, index) => `#${index + 1} ${item.title}\n链接：${item.url}\n摘要：${item.snippet}`).join("\n\n")}` : "",
    `当前问题：${message}`,
  ].filter(Boolean).join("\n\n");
}

function buildMobileChatMessages(
  history: readonly MobileChatMessage[],
  question: string,
  answer: string,
  createdAt: string,
): MobileChatMessage[] {
  return [
    ...history,
    { id: crypto.randomUUID(), role: "user", content: question, createdAt },
    { id: crypto.randomUUID(), role: "assistant", content: answer, createdAt: new Date().toISOString() },
  ].slice(-40);
}

async function searchMobileWebContext(
  env: MobileChatEnv,
  query: string,
  limit: number,
): Promise<MobileWebSearchOutcome> {
  const endpoint = env.CLOUDFLARE_SEARCH_ENDPOINT;
  if (!endpoint) return { ok: false, error: "missing_search_endpoint" };
  const request = buildMobileSearchRequest(endpoint, query, limit, env.CLOUDFLARE_SEARCH_MODEL ?? null);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = env.CLOUDFLARE_SEARCH_TOKEN ?? env.REMOTE_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(request.endpoint, { method: "POST", headers, body: JSON.stringify(request.payload) });
    if (!response.ok) return { ok: false, error: `search_http_${response.status}` };
    return { ok: true, results: normalizeMobileWebSearchResults(await response.json().catch(() => ({}))) };
  } catch {
    return { ok: false, error: "search_network_error" };
  }
}

async function searchMobileWikiContext(
  env: MobileChatEnv,
  query: string,
): Promise<MobileWikiContextItem[]> {
  const db = env.DB;
  if (!db) return [];
  const keyword = `%${query}%`;
  const result = await db.prepare("SELECT path, title, substr(content, 1, 1200) AS content FROM wiki_pages WHERE content LIKE ? OR title LIKE ? ORDER BY updated_at DESC LIMIT 5")
    .bind(keyword, keyword)
    .all();
  return (result.results ?? []).map((item) => ({
    path: String(item.path ?? ""),
    title: String(item.title ?? ""),
    content: String(item.content ?? ""),
  }));
}

function emptyMobileWebSearchOutcome(): MobileWebSearchOutcome {
  return { ok: true, results: [] };
}
