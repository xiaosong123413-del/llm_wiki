import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWikiComment, findWikiCommentById } from "../web/server/services/wiki-comments.js";
import {
  confirmWikiCommentAiDraft,
  discardWikiCommentAiDraft,
  generateWikiCommentAiDraft,
  getWikiCommentAiDraft,
} from "../web/server/services/wiki-comment-ai-drafts.js";
import type { LLMProvider } from "../src/utils/provider.js";

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createFakeProvider(content: string): LLMProvider {
  return {
    complete: vi.fn(async () => content),
    stream: vi.fn(async () => content),
    toolCall: vi.fn(async () => content),
  };
}

describe("wiki comment ai drafts", () => {
  it("generates a diff draft and confirms it back to the source vault", async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-comment-ai-project-"));
    const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-comment-ai-source-"));
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-comment-ai-runtime-"));
    tempDirs.push(projectRoot, sourceVaultRoot, runtimeRoot);

    const sourceFile = path.join(sourceVaultRoot, "wiki", "crm", "赵宇馨.md");
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(sourceFile, "# 赵宇馨\n\n- 当前最需要关注的事：待补充\n", "utf8");

    const comment = createWikiComment(runtimeRoot, {
      path: "wiki/crm/赵宇馨.md",
      quote: "当前最需要关注的事",
      text: "把这里改成更明确的近期行动，不要写待补充。",
      start: 9,
      end: 18,
    });

    const provider = createFakeProvider("# 赵宇馨\n\n- 当前最需要关注的事：本周末前整理纪念日清单并确认见面安排\n");

    const draft = await generateWikiCommentAiDraft({
      projectRoot,
      sourceVaultRoot,
      runtimeRoot,
      commentId: comment.id,
      provider,
    });

    expect(draft.commentId).toBe(comment.id);
    expect(draft.pagePath).toBe("wiki/crm/赵宇馨.md");
    expect(draft.diffText).toContain("--- current");
    expect(draft.diffText).toContain("+++ proposed");
    expect(draft.diffText).toContain("当前最需要关注的事");
    expect(getWikiCommentAiDraft(runtimeRoot, comment.id)?.id).toBe(draft.id);

    const confirmed = await confirmWikiCommentAiDraft({
      projectRoot,
      sourceVaultRoot,
      runtimeRoot,
      commentId: comment.id,
      draftId: draft.id,
    });

    expect(confirmed.pagePath).toBe("wiki/crm/赵宇馨.md");
    expect(fs.readFileSync(sourceFile, "utf8")).toContain("本周末前整理纪念日清单并确认见面安排");
    expect(findWikiCommentById(runtimeRoot, comment.id)?.resolved).toBe(true);
    expect(getWikiCommentAiDraft(runtimeRoot, comment.id)).toBeNull();
  });

  it("rejects confirm when the source file changed after draft generation and preserves the unresolved comment", async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-comment-ai-project-"));
    const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-comment-ai-source-"));
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-comment-ai-runtime-"));
    tempDirs.push(projectRoot, sourceVaultRoot, runtimeRoot);

    const sourceFile = path.join(sourceVaultRoot, "wiki", "concepts", "test.md");
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(sourceFile, "# Test\n\nAlpha Beta Gamma\n", "utf8");

    const comment = createWikiComment(runtimeRoot, {
      path: "wiki/concepts/test.md",
      quote: "Beta",
      text: "把 Beta 改成更具体的表述。",
      start: 8,
      end: 12,
    });

    const draft = await generateWikiCommentAiDraft({
      projectRoot,
      sourceVaultRoot,
      runtimeRoot,
      commentId: comment.id,
      provider: createFakeProvider("# Test\n\nAlpha Better Gamma\n"),
    });

    fs.writeFileSync(sourceFile, "# Test\n\nAlpha Beta Gamma\n\nManual change.\n", "utf8");

    await expect(confirmWikiCommentAiDraft({
      projectRoot,
      sourceVaultRoot,
      runtimeRoot,
      commentId: comment.id,
      draftId: draft.id,
    })).rejects.toThrow("source file changed");

    expect(findWikiCommentById(runtimeRoot, comment.id)?.resolved).toBe(false);
    expect(getWikiCommentAiDraft(runtimeRoot, comment.id)?.id).toBe(draft.id);

    expect(discardWikiCommentAiDraft(runtimeRoot, comment.id, draft.id)).toBe(true);
    expect(getWikiCommentAiDraft(runtimeRoot, comment.id)).toBeNull();
    expect(findWikiCommentById(runtimeRoot, comment.id)?.resolved).toBe(false);
  });
});
