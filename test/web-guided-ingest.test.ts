import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectGuidedIngestRequest,
  completeGuidedIngest,
  completeGuidedIngestFromConversation,
} from "../web/server/services/guided-ingest.js";

const tempRoots: string[] = [];

describe("guided ingest", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects Chinese guided ingest confirmation phrases", () => {
    expect(detectGuidedIngestRequest("\u53ef\u4ee5\u5f55\u5165\u4e86")).toBe(true);
    expect(detectGuidedIngestRequest("\u5f00\u59cb\u5f55\u5165\u8fd9\u6761")).toBe(true);
    expect(detectGuidedIngestRequest("\u5148\u804a\u804a\u8fd9\u6761")).toBe(false);
  });

  it("writes a guided summary page, appends log, and moves inbox source to completed", () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, "inbox"), { recursive: true });
    fs.writeFileSync(path.join(root, "inbox", "source.md"), "# Source Title\n\nRaw body.", "utf8");

    const result = completeGuidedIngest(root, {
      sourcePath: "inbox/source.md",
      conversationNotes: ["\u91cd\u70b9\u662f\u628a\u5b83\u653e\u5230\u9879\u76ee\u80cc\u666f\u91cc\u3002"],
    });

    expect(result.createdPage).toBe("wiki/inbox/Source Title.md");
    expect(fs.readFileSync(path.join(root, result.createdPage), "utf8")).toContain("Raw body.");
    expect(fs.existsSync(path.join(root, "inbox", "_\u5df2\u5f55\u5165", "source.md"))).toBe(true);
    expect(fs.readFileSync(path.join(root, "log.md"), "utf8")).toContain("guided-ingest | Source Title");
  });

  it("completes guided ingest from a conversation with selected inbox context", () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, "inbox"), { recursive: true });
    fs.writeFileSync(path.join(root, "inbox", "source.md"), "# Source Title\n\nRaw body.", "utf8");

    const result = completeGuidedIngestFromConversation(root, {
      title: "Thread",
      messages: [
        { role: "user", content: "\u8fd9\u6761\u8981\u5f3a\u8c03\u5b9e\u8df5\u6d41\u7a0b\u3002" },
        { role: "user", content: "\u53ef\u4ee5\u5f55\u5165\u4e86" },
      ],
      articleRefs: ["inbox/source.md"],
    });

    expect(result?.createdPage).toBe("wiki/inbox/Source Title.md");
    expect(fs.readFileSync(path.join(root, "wiki", "inbox", "Source Title.md"), "utf8")).toContain("\u8fd9\u6761\u8981\u5f3a\u8c03\u5b9e\u8df5\u6d41\u7a0b");
  });
});

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guided-ingest-"));
  tempRoots.push(root);
  return root;
}
