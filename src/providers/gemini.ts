import type { LLMMessage, LLMProvider, LLMTool } from "../utils/provider.js";
import { fetchWithOptionalProxy } from "../utils/proxy-fetch.js";

interface GeminiRequestPart {
  text: string;
}

interface GeminiRequestContent {
  role: "user" | "model";
  parts: GeminiRequestPart[];
}

interface GeminiResponsePart {
  text?: string;
}

interface GeminiResponseCandidate {
  content?: {
    parts?: GeminiResponsePart[];
  };
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiResponseCandidate[];
}

export class GeminiProvider implements LLMProvider {
  private readonly model: string;
  private readonly baseURL: string;
  private readonly apiKey: string;

  constructor(model: string, baseURL?: string, apiKey?: string) {
    this.model = model;
    this.baseURL = normalizeBaseURL(baseURL ?? "https://generativelanguage.googleapis.com");
    this.apiKey = (apiKey ?? "").trim();
  }

  async complete(system: string, messages: LLMMessage[], _maxTokens: number): Promise<string> {
    const response = await fetchWithOptionalProxy(this.endpoint(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: toGeminiContents(messages),
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini request failed: HTTP ${response.status}`);
    }
    const payload = await response.json() as GeminiGenerateContentResponse;
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  }

  async stream(
    system: string,
    messages: LLMMessage[],
    maxTokens: number,
    onToken?: (text: string) => void,
  ): Promise<string> {
    const text = await this.complete(system, messages, maxTokens);
    if (text) onToken?.(text);
    return text;
  }

  async toolCall(
    system: string,
    messages: LLMMessage[],
    _tools: LLMTool[],
    maxTokens: number,
  ): Promise<string> {
    return this.complete(system, messages, maxTokens);
  }

  private endpoint(): string {
    const url = new URL(`/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, this.baseURL);
    if (this.apiKey) {
      url.searchParams.set("key", this.apiKey);
    }
    return url.toString();
  }
}

function toGeminiContents(messages: LLMMessage[]): GeminiRequestContent[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function normalizeBaseURL(value: string): string {
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  return normalized;
}
