import fs from "node:fs";
import path from "node:path";
import { searchAll } from "./search-orchestrator.js";
import type { SearchResult } from "./search-router.js";
import type { Conversation } from "./chat-store.js";
import type { LLMMessage, LLMProvider } from "../../../src/utils/provider.js";
import type { WebSearchResult } from "../../../src/services/cloudflare-web-search.js";
import { readAgentConfig, type AgentDefinition } from "./agent-config.js";
import { resolveAgentRuntimeProvider } from "./llm-agent-provider.js";

const MAX_TOKENS = 1200;
const MAX_CONTEXT_CHARS = 4000;

export {
  resolveAgentRuntimeProvider,
  resolveCodexAgentProviderRoute,
} from "./llm-agent-provider.js";

interface LlmChatOptions {
  projectRoot?: string;
  provider?: LLMProvider;
}

export async function generateAssistantReply(
  wikiRoot: string,
  conversation: Conversation,
  providerOrOptions: LLMProvider | LlmChatOptions = {},
): Promise<string> {
  const options = normalizeChatOptions(providerOrOptions);
  const agent = resolveConversationAgent(options.projectRoot ?? wikiRoot, conversation);
  const provider = options.provider ?? resolveConversationProvider(options.projectRoot ?? wikiRoot, conversation, agent);
  const system = await buildSystemPrompt(wikiRoot, conversation, agent);
  return provider.complete(system, toProviderMessages(conversation), MAX_TOKENS);
}

export async function streamAssistantReply(
  wikiRoot: string,
  conversation: Conversation,
  providerOrOptions: LLMProvider | LlmChatOptions = {},
  onToken?: (token: string) => void,
): Promise<string> {
  const options = normalizeChatOptions(providerOrOptions);
  const agent = resolveConversationAgent(options.projectRoot ?? wikiRoot, conversation);
  const provider = options.provider ?? resolveConversationProvider(options.projectRoot ?? wikiRoot, conversation, agent);
  const system = await buildSystemPrompt(wikiRoot, conversation, agent);
  return provider.stream(system, toProviderMessages(conversation), MAX_TOKENS, onToken);
}

function normalizeChatOptions(input: LLMProvider | LlmChatOptions): LlmChatOptions {
  if (isProviderLike(input)) {
    return { provider: input };
  }
  return input;
}

function isProviderLike(value: LLMProvider | LlmChatOptions): value is LLMProvider {
  return typeof (value as Partial<LLMProvider>).complete === "function"
    || typeof (value as Partial<LLMProvider>).stream === "function";
}

function resolveConversationAgent(projectRoot: string, conversation: Conversation): AgentDefinition | null {
  const config = readAgentConfig(projectRoot);
  const agentId = conversation.appId ?? conversation.agentId ?? config.activeAgentId;
  if (!agentId) return null;
  return config.agents.find((agent) => agent.id === agentId && agent.enabled) ?? null;
}

function resolveConversationProvider(projectRoot: string, conversation: Conversation, agent: AgentDefinition | null): LLMProvider {
  return resolveAgentRuntimeProvider(projectRoot, agent, `conversation:${conversation.id}`);
}

async function buildSystemPrompt(
  wikiRoot: string,
  conversation: Conversation,
  agent: AgentDefinition | null,
): Promise<string> {
  const sections: string[] = [
    "You are LLM Wiki, a personal knowledge assistant.",
    "Answer in the user's working language unless explicitly asked otherwise.",
    "Ground claims in the provided wiki, source context, and search results.",
    "If both local wiki and web search are available, clearly separate 哪些信息来自本地 wiki，哪些来自联网结果。",
  ];

  if (agent) {
    sections.push("<agent_config>");
    sections.push([
      `name: ${agent.name}`,
      agent.purpose ? `purpose: ${agent.purpose}` : "",
      agent.workflow ? `workflow:\n${agent.workflow}` : "",
      agent.prompt ? `prompt:\n${agent.prompt}` : "",
    ].filter(Boolean).join("\n\n"));
    sections.push("</agent_config>");
  }

  const searchContext = await loadSearchContext(conversation);
  if (searchContext.local) {
    sections.push("<wiki_search_results>");
    sections.push(searchContext.local);
    sections.push("</wiki_search_results>");
  }
  if (searchContext.web) {
    sections.push("<web_search_results>");
    sections.push(searchContext.web);
    sections.push("</web_search_results>");
  }

  const articleContext = loadArticleContext(wikiRoot, conversation.articleRefs);
  if (articleContext) {
    sections.push("<article_context>");
    sections.push(articleContext);
    sections.push("</article_context>");
  }

  return sections.join("\n\n");
}

function toProviderMessages(conversation: Conversation): LLMMessage[] {
  return conversation.messages
    .filter((message): message is Conversation["messages"][number] & { role: "user" | "assistant" } =>
      message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

async function loadSearchContext(conversation: Conversation): Promise<{ local: string; web: string }> {
  const latestUserMessage = [...conversation.messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim());
  if (!latestUserMessage) {
    return { local: "", web: "" };
  }

  const scope = normalizeConversationScope(conversation);
  const result = await searchAll(undefined, latestUserMessage.content, {
    scope,
    mode: scope === "web" ? "keyword" : "hybrid",
    webLimit: 5,
  });

  return {
    local: formatLocalSearchResults(result.local.results),
    web: formatWebSearchResults(result.web.results),
  };
}

function normalizeConversationScope(conversation: Conversation): "local" | "web" | "all" {
  if (conversation.searchScope === "all" || conversation.searchScope === "web" || conversation.searchScope === "local") {
    return conversation.searchScope;
  }
  return conversation.webSearchEnabled ? "web" : "local";
}

function formatLocalSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "";
  }
  return results.slice(0, 8).map((result, index) => [
    `${index + 1}. ${result.title}`,
    `path: ${result.path}`,
    `excerpt: ${truncate(result.excerpt, 320)}`,
  ].join("\n")).join("\n\n");
}

function formatWebSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return "";
  }
  return results.slice(0, 8).map((result, index) => [
    `${index + 1}. ${result.title}`,
    `url: ${result.url}`,
    `snippet: ${truncate(result.snippet, 320)}`,
  ].join("\n")).join("\n\n");
}

function loadArticleContext(wikiRoot: string, articleRefs: string[]): string {
  if (!articleRefs.length) {
    return "";
  }

  const chunks: string[] = [];
  for (const ref of articleRefs) {
    const normalizedRef = ref.replace(/\\/g, "/");
    const filePath = path.join(wikiRoot, normalizedRef);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) {
      continue;
    }
    chunks.push(`${normalizedRef}\n${truncate(raw, MAX_CONTEXT_CHARS)}`);
  }

  return chunks.join("\n\n---\n\n");
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}...`;
}
