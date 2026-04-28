import {
  conversationSummary,
  json,
  listConversations,
  normalizeConversation,
  readJson,
  requireDb,
  upsertConversation,
} from "../_lib/store.js";

export async function onRequestGet(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  const conversations = await listConversations(context.env.DB);
  return json({ success: true, data: conversations.map(conversationSummary) });
}

export async function onRequestPost(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  const payload = await readJson(context.request);
  if (!payload) return json({ success: false, error: "Invalid JSON body." }, 400);
  const conversation = normalizeConversation(payload);
  await upsertConversation(context.env.DB, conversation);
  return json({ success: true, data: conversation }, 201);
}
