/**
 * Shared LLM provider defaults for the WebUI settings and account services.
 *
 * Keeps provider validation, OpenAI-compatible URL normalization, and default
 * model/base URL choices in one place so the settings form and saved account
 * store cannot drift apart.
 */

const OPENAI_COMPAT_PROVIDERS = new Set([
  "openai",
  "deepseek",
  "groq",
  "xai",
  "kimi-global",
  "kimi-cn",
  "glm",
  "custom",
  "relay",
  "codex-cli",
]);

export function isSupportedLlmProvider(provider: string): boolean {
  return (
    provider === "anthropic"
    || provider === "gemini"
    || provider === "minimax"
    || provider === "ollama"
    || OPENAI_COMPAT_PROVIDERS.has(provider)
  );
}

export function usesOpenAICompatibleUrl(provider: string): boolean {
  return provider !== "anthropic" && provider !== "gemini" && provider !== "ollama";
}

export function normalizeOpenAICompatibleBaseUrl(url: string, provider: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    parsed.pathname = path.replace(/\/chat\/completions$/, "");
    return parsed.toString().replace(/\/$/, "");
  }
  if (!path || path === "/") {
    parsed.pathname = defaultOpenAICompatiblePath(provider);
  }
  return parsed.toString().replace(/\/$/, "");
}

export function defaultBaseUrlForProvider(provider: string): string {
  switch (provider) {
    case "anthropic": return "https://api.anthropic.com";
    case "gemini": return "https://generativelanguage.googleapis.com";
    case "groq": return "https://api.groq.com/openai/v1";
    case "xai": return "https://api.x.ai/v1";
    case "deepseek": return "https://api.deepseek.com/v1";
    case "kimi-global": return "https://api.moonshot.ai/v1";
    case "kimi-cn": return "https://api.moonshot.cn/v1";
    case "glm": return "https://open.bigmodel.cn/api/paas/v4";
    case "minimax": return "https://api.minimax.chat/v1";
    case "ollama": return "http://localhost:11434/v1";
    default: return "https://api.openai.com/v1";
  }
}

export function defaultModelForProvider(provider: string): string {
  switch (provider) {
    case "anthropic": return "claude-sonnet-4-20250514";
    case "gemini": return "gemini-2.5-flash";
    case "ollama": return "llama3.1";
    case "minimax": return "MiniMax-M2.7";
    case "deepseek": return "deepseek-chat";
    case "groq": return "llama-3.3-70b-versatile";
    case "xai": return "grok-4";
    case "kimi-global":
    case "kimi-cn":
      return "kimi-k2-0711-preview";
    case "glm":
      return "glm-4.5";
    case "codex-cli":
      return "gpt-5-codex";
    default:
      return "gpt-4o";
  }
}

function defaultOpenAICompatiblePath(provider: string): string {
  if (provider === "groq") return "/openai/v1";
  if (provider === "glm") return "/api/paas/v4";
  return "/v1";
}
