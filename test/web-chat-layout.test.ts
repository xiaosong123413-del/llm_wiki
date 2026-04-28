import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

describe("chat layout css", () => {
  it("pins the sidebar, resize handle, and thread to explicit grid columns", async () => {
    const styles = await readFile(path.join(root, "web", "client", "styles.css"), "utf8");

    expect(styles).toContain(".chat-workspace > .chat-sidebar");
    expect(styles).toContain("grid-column: 1");
    expect(styles).toContain(".chat-workspace > .panel-resize-handle--page");
    expect(styles).toContain("grid-column: 2");
    expect(styles).toContain(".chat-workspace > .chat-thread");
    expect(styles).toContain("grid-column: 3");
  });
});
