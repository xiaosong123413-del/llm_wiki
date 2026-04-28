import {
  buildReadonlyPrompt,
  normalizeBaseUrl,
  normalizeContexts,
  readReadonlyChatError,
  readReadonlyChatOutputText,
} from "../_lib/readonly-chat.js";

export async function onRequestPost(context) {
  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY is not configured on Cloudflare Pages." }, 500);
  }
  const baseUrl = normalizeBaseUrl(context.env.OPENAI_BASE_URL || "https://api.openai.com");

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question) {
    return json({ error: "Question is required." }, 400);
  }

  const contexts = normalizeContexts(payload.contexts);
  const model = context.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是 LLM Wiki 的全站只读助手。只根据提供的 Wiki 片段回答。缺少依据时直接说没有在当前 Wiki 中找到充分依据。回答要简洁，并在末尾列出引用的页面路径。",
        },
        {
          role: "user",
          content: buildReadonlyPrompt(question, contexts),
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: readReadonlyChatError(data, "OpenAI request failed.") }, response.status);
  }

  return json({ answer: readReadonlyChatOutputText(data), contexts });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
