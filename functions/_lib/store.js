export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function requireDb(env) {
  return env.DB ? null : json({ success: false, error: "D1 binding DB is not configured." }, 500);
}

export function normalizeConversation(input = {}) {
  const now = new Date().toISOString();
  const id = stringValue(input.id) || crypto.randomUUID();
  const messages = Array.isArray(input.messages) ? input.messages.map(normalizeMessage).filter(Boolean) : [];
  const articleRefs = Array.isArray(input.articleRefs) ? input.articleRefs.map(String).filter(Boolean) : [];
  return {
    id,
    title: stringValue(input.title) || "新对话",
    createdAt: stringValue(input.createdAt) || now,
    updatedAt: stringValue(input.updatedAt) || now,
    webSearchEnabled: input.webSearchEnabled === true,
    searchScope: normalizeSearchScope(input.searchScope),
    agentId: stringValue(input.agentId) || null,
    articleRefs,
    messages,
  };
}

export function normalizeMessage(input = {}) {
  const role = input.role === "assistant" || input.role === "system" ? input.role : "user";
  const content = stringValue(input.content);
  if (!content) return null;
  return {
    id: stringValue(input.id) || crypto.randomUUID(),
    role,
    content,
    createdAt: stringValue(input.createdAt) || new Date().toISOString(),
    articleRefs: Array.isArray(input.articleRefs) ? input.articleRefs.map(String).filter(Boolean) : [],
  };
}

export function normalizeComment(input = {}) {
  const now = new Date().toISOString();
  return {
    id: stringValue(input.id) || crypto.randomUUID(),
    pagePath: stringValue(input.pagePath),
    quote: stringValue(input.quote),
    comment: stringValue(input.comment),
    resolved: input.resolved === true,
    source: stringValue(input.source) || "web",
    createdAt: stringValue(input.createdAt) || now,
    updatedAt: stringValue(input.updatedAt) || now,
  };
}

export async function listConversations(db) {
  const result = await db.prepare(
    "SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, web_search_enabled AS webSearchEnabled, search_scope AS searchScope, agent_id AS agentId, article_refs_json AS articleRefsJson, messages_json AS messagesJson FROM web_conversations ORDER BY updated_at DESC LIMIT 200",
  ).all();
  return (result.results ?? []).map(conversationFromRow);
}

export async function getConversation(db, id) {
  const row = await db.prepare(
    "SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, web_search_enabled AS webSearchEnabled, search_scope AS searchScope, agent_id AS agentId, article_refs_json AS articleRefsJson, messages_json AS messagesJson FROM web_conversations WHERE id = ?",
  ).bind(id).first();
  return row ? conversationFromRow(row) : null;
}

export async function upsertConversation(db, conversation) {
  await db.prepare(
    "INSERT INTO web_conversations (id, title, created_at, updated_at, web_search_enabled, search_scope, agent_id, article_refs_json, messages_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at, web_search_enabled = excluded.web_search_enabled, search_scope = excluded.search_scope, agent_id = excluded.agent_id, article_refs_json = excluded.article_refs_json, messages_json = excluded.messages_json",
  ).bind(
    conversation.id,
    conversation.title,
    conversation.createdAt,
    conversation.updatedAt,
    conversation.webSearchEnabled ? 1 : 0,
    conversation.searchScope,
    conversation.agentId,
    JSON.stringify(conversation.articleRefs),
    JSON.stringify(conversation.messages),
  ).run();
}

export async function deleteConversation(db, id) {
  await db.prepare("DELETE FROM web_conversations WHERE id = ?").bind(id).run();
}

export async function listComments(db, pagePath = "") {
  const query = pagePath
    ? db.prepare(
      "SELECT id, page_path AS pagePath, quote, comment, resolved, source, created_at AS createdAt, updated_at AS updatedAt FROM wiki_comments WHERE page_path = ? ORDER BY updated_at DESC LIMIT 300",
    ).bind(pagePath)
    : db.prepare(
      "SELECT id, page_path AS pagePath, quote, comment, resolved, source, created_at AS createdAt, updated_at AS updatedAt FROM wiki_comments ORDER BY updated_at DESC LIMIT 500",
    );
  const result = await query.all();
  return (result.results ?? []).map(commentFromRow);
}

export async function upsertComment(db, comment) {
  await db.prepare(
    "INSERT INTO wiki_comments (id, page_path, quote, comment, resolved, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET page_path = excluded.page_path, quote = excluded.quote, comment = excluded.comment, resolved = excluded.resolved, source = excluded.source, updated_at = excluded.updated_at",
  ).bind(
    comment.id,
    comment.pagePath,
    comment.quote,
    comment.comment,
    comment.resolved ? 1 : 0,
    comment.source,
    comment.createdAt,
    comment.updatedAt,
  ).run();
}

export async function deleteComment(db, id) {
  await db.prepare("DELETE FROM wiki_comments WHERE id = ?").bind(id).run();
}

export function conversationSummary(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    latestMessage: conversation.messages.at(-1)?.content ?? "",
  };
}

function conversationFromRow(row) {
  return normalizeConversation({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    webSearchEnabled: row.webSearchEnabled === 1,
    searchScope: row.searchScope,
    agentId: row.agentId,
    articleRefs: safeArray(row.articleRefsJson),
    messages: safeArray(row.messagesJson),
  });
}

function commentFromRow(row) {
  return normalizeComment({
    id: row.id,
    pagePath: row.pagePath,
    quote: row.quote,
    comment: row.comment,
    resolved: row.resolved === 1,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function normalizeSearchScope(value) {
  return value === "web" || value === "both" || value === "all" ? value : "local";
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}
