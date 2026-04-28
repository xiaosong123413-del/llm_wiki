export interface DraftConversation {
  id: string;
  title: string;
  draft: string;
  createdAt: string;
  updatedAt: string;
  webSearchEnabled: boolean;
  searchScope: "local" | "web" | "both";
  appId: string | null;
}

interface DraftConversationInput {
  id?: string;
  title?: string;
  draft?: string;
  createdAt?: string;
  updatedAt?: string;
  webSearchEnabled?: boolean;
  searchScope?: DraftConversation["searchScope"];
  appId?: string | null;
}

const DRAFT_PREFIX = "draft-";

export function createDraftConversation(input: DraftConversationInput = {}): DraftConversation {
  const now = input.updatedAt ?? new Date().toISOString();
  return {
    id: input.id ?? `${DRAFT_PREFIX}${crypto.randomUUID()}`,
    title: input.title?.trim() || "\u65b0\u5bf9\u8bdd",
    draft: input.draft ?? "",
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    webSearchEnabled: input.webSearchEnabled ?? false,
    searchScope: input.searchScope ?? (input.webSearchEnabled ? "web" : "local"),
    appId: input.appId ?? null,
  };
}

export function isDraftConversationId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(DRAFT_PREFIX);
}

export function getDraftConversationSummary(draft: DraftConversation) {
  return {
    id: draft.id,
    title: draft.title,
    updatedAt: draft.updatedAt,
    latestMessage: draft.draft,
  };
}
