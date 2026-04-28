import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  articleRefs?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  webSearchEnabled: boolean;
  searchScope: "local" | "web" | "all";
  appId?: string | null;
  agentId?: string | null;
  articleRefs: string[];
  messages: ChatMessage[];
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  latestMessage: string;
}

interface CreateConversationInput {
  title?: string;
  webSearchEnabled?: boolean;
  searchScope?: Conversation["searchScope"];
  appId?: string | null;
  agentId?: string | null;
  articleRefs?: string[];
}

interface UpdateConversationInput {
  title?: string;
  webSearchEnabled?: boolean;
  searchScope?: Conversation["searchScope"];
  appId?: string | null;
  agentId?: string | null;
  articleRefs?: string[];
}

interface AddMessageInput {
  role: ChatMessage["role"];
  content: string;
  articleRefs?: string[];
}

export function listConversations(root: string): ConversationSummary[] {
  const dir = ensureChatDir(root);
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readConversationFile(path.join(dir, name)))
    .filter((conversation): conversation is Conversation => conversation !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      latestMessage: conversation.messages.at(-1)?.content ?? "",
    }));
}

export function createConversation(root: string, input: CreateConversationInput = {}): Conversation {
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    title: input.title?.trim() || "\u65b0\u5bf9\u8bdd",
    createdAt: now,
    updatedAt: now,
    webSearchEnabled: input.webSearchEnabled ?? false,
    searchScope: normalizeSearchScope(input.searchScope, input.webSearchEnabled),
    appId: normalizeAppId(input.appId ?? input.agentId),
    articleRefs: input.articleRefs ?? [],
    messages: [],
  };
  writeConversation(root, conversation);
  return conversation;
}

export function getConversation(root: string, id: string): Conversation | null {
  return readConversationFile(conversationPath(root, id));
}

export function updateConversation(root: string, id: string, input: UpdateConversationInput): Conversation | null {
  const conversation = getConversation(root, id);
  if (!conversation) {
    return null;
  }

  if (typeof input.title === "string" && input.title.trim()) {
    conversation.title = input.title.trim();
  }
  if (typeof input.webSearchEnabled === "boolean") {
    conversation.webSearchEnabled = input.webSearchEnabled;
    if (!input.searchScope && !input.webSearchEnabled) {
      conversation.searchScope = "local";
    }
  }
  if (typeof input.searchScope === "string") {
    conversation.searchScope = normalizeSearchScope(input.searchScope, conversation.webSearchEnabled);
  }
  if (input.appId !== undefined || input.agentId !== undefined) {
    conversation.appId = normalizeAppId(input.appId ?? input.agentId);
  }
  if (Array.isArray(input.articleRefs)) {
    conversation.articleRefs = input.articleRefs;
  }
  conversation.updatedAt = new Date().toISOString();
  writeConversation(root, conversation);
  return conversation;
}

export function deleteConversation(root: string, id: string): boolean {
  const filePath = conversationPath(root, id);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.rmSync(filePath, { force: true });
  return true;
}

export function addConversationMessage(root: string, id: string, input: AddMessageInput): Conversation | null {
  const conversation = getConversation(root, id);
  if (!conversation) {
    return null;
  }

  conversation.messages.push({
    id: crypto.randomUUID(),
    role: input.role,
    content: input.content,
    createdAt: new Date().toISOString(),
    articleRefs: input.articleRefs ?? [],
  });
  if (input.articleRefs?.length) {
    conversation.articleRefs = input.articleRefs;
  }
  conversation.updatedAt = new Date().toISOString();
  writeConversation(root, conversation);
  return conversation;
}

function ensureChatDir(root: string): string {
  const dir = path.join(root, ".chat");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function conversationPath(root: string, id: string): string {
  return path.join(ensureChatDir(root), `${id}.json`);
}

function writeConversation(root: string, conversation: Conversation): void {
  fs.writeFileSync(conversationPath(root, conversation.id), JSON.stringify(conversation, null, 2));
}

function readConversationFile(filePath: string): Conversation | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<Conversation>;
  return {
    id: String(parsed.id ?? ""),
    title: readConversationTitle(parsed.title),
    createdAt: readConversationTimestamp(parsed.createdAt),
    updatedAt: readConversationTimestamp(parsed.updatedAt),
    webSearchEnabled: parsed.webSearchEnabled === true,
    searchScope: normalizeSearchScope(parsed.searchScope, parsed.webSearchEnabled === true),
    appId: normalizeAppId(parsed.appId ?? parsed.agentId),
    articleRefs: normalizeStringArray(parsed.articleRefs),
    messages: normalizeMessages(parsed.messages),
  };
}

function normalizeAppId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSearchScope(
  value: Conversation["searchScope"] | undefined,
  webSearchEnabled: boolean | undefined,
): Conversation["searchScope"] {
  if (value === "web" || value === "all") {
    return value;
  }
  if (value === "local") {
    return "local";
  }
  return webSearchEnabled ? "web" : "local";
}

function readConversationTitle(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "\u65b0\u5bf9\u8bdd";
}

function readConversationTimestamp(value: unknown): string {
  return typeof value === "string" ? value : new Date().toISOString();
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeMessages(value: unknown): ChatMessage[] {
  return Array.isArray(value) ? value as ChatMessage[] : [];
}
