import { describe, expect, it } from "vitest";
import {
  createDraftConversation,
  getDraftConversationSummary,
  isDraftConversationId,
} from "../web/client/src/pages/chat/drafts.js";

describe("chat drafts", () => {
  it("creates draft conversations with a stable draft prefix", () => {
    const draft = createDraftConversation();

    expect(isDraftConversationId(draft.id)).toBe(true);
    expect(draft.title).toBe("新对话");
    expect(draft.draft).toBe("");
    expect(draft.webSearchEnabled).toBe(false);
  });

  it("builds summaries from draft state", () => {
    const draft = createDraftConversation({
      id: "draft-manual",
      draft: "hello draft",
      updatedAt: "2026-04-17T10:00:00.000Z",
    });

    expect(getDraftConversationSummary(draft)).toEqual({
      id: "draft-manual",
      title: "新对话",
      updatedAt: "2026-04-17T10:00:00.000Z",
      latestMessage: "hello draft",
    });
  });
});
