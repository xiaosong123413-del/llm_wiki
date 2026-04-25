import { beforeEach, describe, expect, it, vi } from "vitest";

const generateWikiCommentAiDraft = vi.fn();
const confirmWikiCommentAiDraft = vi.fn();
const discardWikiCommentAiDraft = vi.fn();

vi.mock("../web/server/services/wiki-comment-ai-drafts.js", () => ({
  generateWikiCommentAiDraft,
  confirmWikiCommentAiDraft,
  discardWikiCommentAiDraft,
}));

const { handleWikiCommentAiDraftCreate, handleWikiCommentAiDraftConfirm, handleWikiCommentAiDraftDiscard } =
  await import("../web/server/routes/wiki-comments.js");

const cfg = {
  projectRoot: "D:/Desktop/llm-wiki-compiler-main",
  sourceVaultRoot: "D:/Desktop/ai的仓库",
  runtimeRoot: "D:/Desktop/llm-wiki-compiler-main/.runtime/ai-vault",
  host: "127.0.0.1",
  port: 4175,
  author: "me",
};

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

describe("wiki comment ai routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an ai draft for a comment id", async () => {
    generateWikiCommentAiDraft.mockResolvedValue({
      id: "draft-1",
      commentId: "comment-1",
      pagePath: "wiki/concepts/test.md",
      diffText: "--- current\n+++ proposed\n@@\n-Alpha\n+Better Alpha",
    });

    const handler = handleWikiCommentAiDraftCreate(cfg);
    const response = createResponse();
    await handler({ params: { id: "comment-1" } } as never, response as never);

    expect(generateWikiCommentAiDraft).toHaveBeenCalledWith(expect.objectContaining({
      projectRoot: cfg.projectRoot,
      sourceVaultRoot: cfg.sourceVaultRoot,
      runtimeRoot: cfg.runtimeRoot,
      commentId: "comment-1",
    }));
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: "draft-1" }),
    }));
  });

  it("confirms an ai draft for a comment id", async () => {
    confirmWikiCommentAiDraft.mockResolvedValue({
      id: "draft-1",
      pagePath: "wiki/concepts/test.md",
    });

    const handler = handleWikiCommentAiDraftConfirm(cfg);
    const response = createResponse();
    await handler({ params: { id: "comment-1", draftId: "draft-1" } } as never, response as never);

    expect(confirmWikiCommentAiDraft).toHaveBeenCalledWith(expect.objectContaining({
      commentId: "comment-1",
      draftId: "draft-1",
    }));
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ pagePath: "wiki/concepts/test.md" }),
    }));
  });

  it("discards an ai draft for a comment id", async () => {
    discardWikiCommentAiDraft.mockReturnValue(true);

    const handler = handleWikiCommentAiDraftDiscard(cfg);
    const response = createResponse();
    await handler({ params: { id: "comment-1", draftId: "draft-1" } } as never, response as never);

    expect(discardWikiCommentAiDraft).toHaveBeenCalledWith(cfg.runtimeRoot, "comment-1", "draft-1");
    expect(response.json).toHaveBeenCalledWith({ success: true });
  });
});
