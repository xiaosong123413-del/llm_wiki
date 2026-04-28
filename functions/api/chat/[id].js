import {
  deleteConversation,
  getConversation,
  json,
  normalizeConversation,
  readJson,
  requireDb,
  upsertConversation,
} from "../../_lib/store.js";

export async function onRequestGet(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  const conversation = await getConversation(context.env.DB, context.params.id);
  if (!conversation) return json({ success: false, error: "conversation not found" }, 404);
  return json({ success: true, data: conversation });
}

export async function onRequestPatch(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  const existing = await getConversation(context.env.DB, context.params.id);
  if (!existing) return json({ success: false, error: "conversation not found" }, 404);
  const payload = await readJson(context.request);
  if (!payload) return json({ success: false, error: "Invalid JSON body." }, 400);
  const conversation = normalizeConversation({
    ...existing,
    ...payload,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await upsertConversation(context.env.DB, conversation);
  return json({ success: true, data: conversation });
}

export async function onRequestDelete(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  await deleteConversation(context.env.DB, context.params.id);
  return json({ success: true, data: { id: context.params.id } });
}
