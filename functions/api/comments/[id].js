import {
  deleteComment,
  json,
  listComments,
  normalizeComment,
  readJson,
  requireDb,
  upsertComment,
} from "../../_lib/store.js";

export async function onRequestPatch(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  const payload = await readJson(context.request);
  if (!payload) return json({ success: false, error: "Invalid JSON body." }, 400);
  const existing = (await listComments(context.env.DB)).find((item) => item.id === context.params.id);
  if (!existing) return json({ success: false, error: "comment not found" }, 404);
  const comment = normalizeComment({
    ...existing,
    ...payload,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await upsertComment(context.env.DB, comment);
  return json({ success: true, data: comment });
}

export async function onRequestDelete(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  await deleteComment(context.env.DB, context.params.id);
  return json({ success: true, data: { id: context.params.id } });
}
