import {
  getConversation,
  json,
  normalizeMessage,
  readJson,
  requireDb,
  upsertConversation,
} from "../../../_lib/store.js";
import {
  buildReadonlyPrompt,
  normalizeBaseUrl,
  normalizeContexts,
  readReadonlyChatError,
  readReadonlyChatOutputText,
} from "../../../_lib/readonly-chat.js";

export async function onRequestPost(context) {
  const missing = requireDb(context.env);
  if (missing) return missing;
  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) return json({ success: false, error: "OPENAI_API_KEY is not configured." }, 500);

  const conversation = await getConversation(context.env.DB, context.params.id);
  if (!conversation) return json({ success: false, error: "conversation not found" }, 404);

  const payload = await readJson(context.request);
  if (!payload) return json({ success: false, error: "Invalid JSON body." }, 400);
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  if (!content) return json({ success: false, error: "content is required" }, 400);

  const now = new Date().toISOString();
  const articleRefs = Array.isArray(payload.articleRefs) ? payload.articleRefs.map(String).filter(Boolean) : [];
  const userMessage = normalizeMessage({ role: "user", content, createdAt: now, articleRefs });
  if (!userMessage) return json({ success: false, error: "content is required" }, 400);

  const contexts = normalizeContexts(payload.contexts);
  const assistantText = await generateReply(context.env, content, contexts, conversation.messages);
  const assistantMessage = normalizeMessage({
    role: "assistant",
    content: assistantText || "抱歉，这一轮没有生成有效回答。",
    createdAt: new Date().toISOString(),
  });

  const next = {
    ...conversation,
    title: conversation.messages.length === 0 ? content.slice(0, 32) || conversation.title : conversation.title,
    updatedAt: new Date().toISOString(),
    articleRefs: articleRefs.length ? articleRefs : conversation.articleRefs,
    messages: [...conversation.messages, userMessage, assistantMessage].filter(Boolean),
  };
  await upsertConversation(context.env.DB, next);
  return json({ success: true, data: next });
}

async function generateReply(env, question, contexts, history) {
  const baseUrl = normalizeBaseUrl(env.OPENAI_BASE_URL || "https://api.openai.com");
  const model = env.OPENAI_MODEL || "gpt-5-mini";
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是 LLM Wiki 的全站只读助手。优先根据提供的 Wiki 片段回答；缺少依据时说明没有充分依据。回答要简洁，并在末尾列出引用页面路径。",
        },
        ...history.slice(-8).map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
        { role: "user", content: buildReadonlyPrompt(question, contexts) },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(readReadonlyChatError(data, "OpenAI-compatible request failed."));
  }
  return readReadonlyChatOutputText(data);
}
