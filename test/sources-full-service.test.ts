import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  addSourceHighlight,
  archiveSourceItem,
  createSourceBookmark,
  createSourceNote,
  getSourcesFullItem,
  listSourcesFullItems,
  runSourceOcr,
  updateSourcesFullMeta,
} from "../web/server/services/sources-full.js";

/**
 * Verifies the sources_full service keeps long-lived source records separate
 * from raw intake folders and persists metadata sidecars under `.llmwiki`.
 */

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("sources-full service", () => {
  it("lists sources_full records even when raw clipping has been cleaned", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    write(runtimeRoot, "sources_full/\u526a\u85cf/example.md", [
      "---",
      "title: \u957f\u671f\u4fdd\u7559\u7684\u526a\u85cf",
      "source_url: https://example.com/article",
      "source_channel: web",
      "---",
      "",
      "\u8fd9\u662f\u5df2\u7ecf\u540c\u6b65\u5230 sources_full \u7684\u6e90\u6599\u3002",
    ].join("\n"));
    write(sourceVaultRoot, "raw/\u526a\u85cf/_\u5df2\u6e05\u7406/example.md", "\u539f\u59cb\u5165\u53e3\u5df2\u6e05\u7406");

    const result = await listSourcesFullItems(runtimeRoot);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("\u957f\u671f\u4fdd\u7559\u7684\u526a\u85cf");
    expect(result.items[0]?.sourceUrl).toBe("https://example.com/article");
    expect(result.items[0]?.kind).toBe("clipping");
  });

  it("persists metadata and highlights outside the markdown body", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    const markdownPath = "sources_full/note.md";
    write(runtimeRoot, markdownPath, "# Raw Note\n\nBody");
    const [{ id }] = (await listSourcesFullItems(runtimeRoot)).items;

    await updateSourcesFullMeta(runtimeRoot, id, {
      title: "\u91cd\u547d\u540d\u6e90\u6599",
      tags: ["AI", "\u526a\u85cf"],
      lists: ["\u7a0d\u540e\u9605\u8bfb"],
      note: "\u4fdd\u7559\u8ffd\u6eaf",
    });
    await addSourceHighlight(runtimeRoot, id, {
      text: "Body",
      note: "\u91cd\u70b9",
      createdAt: "2026-04-19T00:00:00.000Z",
    });

    const item = await getSourcesFullItem(sourceVaultRoot, runtimeRoot, id);

    expect(item.title).toBe("\u91cd\u547d\u540d\u6e90\u6599");
    expect(item.tags).toEqual(["AI", "\u526a\u85cf"]);
    expect(item.highlights).toHaveLength(1);
    expect(fs.readFileSync(path.join(runtimeRoot, markdownPath), "utf8")).toBe("# Raw Note\n\nBody");
    expect(fs.existsSync(path.join(runtimeRoot, ".llmwiki", "sources-full-index.json"))).toBe(true);
    expect(fs.existsSync(path.join(runtimeRoot, ".llmwiki", "source-highlights.json"))).toBe(true);
    expect(fs.existsSync(path.join(sourceVaultRoot, ".llmwiki", "sources-full-index.json"))).toBe(false);
  });

  it("search includes markdown, metadata, and OCR text", async () => {
    const { runtimeRoot } = makeRoots();
    write(runtimeRoot, "sources_full/paper.md", "# Vision Paper\n\nOnly body text");
    const [{ id }] = (await listSourcesFullItems(runtimeRoot)).items;

    await updateSourcesFullMeta(runtimeRoot, id, { tags: ["\u89c6\u89c9"], lists: ["papers"] });
    await runSourceOcr(runtimeRoot, id, { text: "\u56fe\u7247\u4e2d\u7684 OCR \u6587\u5b57" });

    expect((await listSourcesFullItems(runtimeRoot, { query: "Vision" })).items).toHaveLength(1);
    expect((await listSourcesFullItems(runtimeRoot, { query: "\u89c6\u89c9" })).items).toHaveLength(1);
    expect((await listSourcesFullItems(runtimeRoot, { query: "OCR" })).items).toHaveLength(1);
  });

  it("bookmark and note creation use raw entry folders instead of writing sources_full directly", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();

    const bookmark = await createSourceBookmark(sourceVaultRoot, {
      url: "https://example.com/a",
      title: "Example Link",
      description: "\u7b80\u77ed\u63cf\u8ff0",
      now: new Date("2026-04-19T10:00:00.000Z"),
    });
    const note = await createSourceNote(sourceVaultRoot, {
      title: "\u95ea\u5ff5",
      body: "\u4eca\u5929\u7684\u7b14\u8bb0",
      target: "flash-diary",
      now: new Date("2026-04-19T10:05:00.000Z"),
    });

    expect(bookmark.path).toMatch(/^raw\/\u526a\u85cf\//);
    expect(note.path).toBe("raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-19.md");
    expect(fs.existsSync(path.join(runtimeRoot, "sources_full", "Example Link.md"))).toBe(false);
  });

  it("loads a single source detail without rescanning every markdown file", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    write(runtimeRoot, "sources_full/first.md", "# First\n\nBody one");
    write(runtimeRoot, "sources_full/second.md", "# Second\n\nBody two");
    const [{ id }] = (await listSourcesFullItems(runtimeRoot)).items;
    const readSpy = vi.spyOn(fs, "readFileSync");

    await getSourcesFullItem(sourceVaultRoot, runtimeRoot, id);

    const markdownReads = readSpy.mock.calls.filter(([filePath]) =>
      typeof filePath === "string" && filePath.endsWith(".md"),
    );
    expect(markdownReads.length).toBeLessThanOrEqual(1);
  });

  it("reuses the source list scan when the source directory is unchanged", async () => {
    const { runtimeRoot } = makeRoots();
    write(runtimeRoot, "sources_full/first.md", "# First\n\nBody one");
    write(runtimeRoot, "sources_full/second.md", "# Second\n\nBody two");

    await listSourcesFullItems(runtimeRoot);
    const readSpy = vi.spyOn(fs, "readFileSync");
    await listSourcesFullItems(runtimeRoot);

    const markdownReads = readSpy.mock.calls.filter(([filePath]) =>
      typeof filePath === "string" && filePath.endsWith(".md"),
    );
    expect(markdownReads).toHaveLength(0);
  });

  it("archives a source into an html snapshot under .llmwiki", async () => {
    const { sourceVaultRoot, runtimeRoot } = makeRoots();
    write(runtimeRoot, "sources_full/article.md", [
      "---",
      "title: Archived Source",
      "source_url: https://example.com/archive",
      "---",
      "",
      "# Heading",
      "",
      "Saved body",
    ].join("\n"));
    const [{ id }] = (await listSourcesFullItems(runtimeRoot)).items;

    const archived = await archiveSourceItem(sourceVaultRoot, runtimeRoot, id);
    const detail = await getSourcesFullItem(sourceVaultRoot, runtimeRoot, id);
    const archiveFile = path.join(runtimeRoot, ...archived.path.split("/"));

    expect(archived.path).toBe(`.llmwiki/archives/${id}.html`);
    expect(fs.existsSync(archiveFile)).toBe(true);
    expect(fs.readFileSync(archiveFile, "utf8")).toContain("Archived Source");
    expect(detail.archivePath).toBe(`.llmwiki/archives/${id}.html`);
  });
});

function makeRoots(): { sourceVaultRoot: string; runtimeRoot: string } {
  const sourceVaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sources-full-source-"));
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sources-full-runtime-"));
  roots.push(sourceVaultRoot, runtimeRoot);
  fs.mkdirSync(path.join(sourceVaultRoot, "raw", "\u526a\u85cf"), { recursive: true });
  fs.mkdirSync(path.join(sourceVaultRoot, "raw", "\u95ea\u5ff5\u65e5\u8bb0"), { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, "sources_full"), { recursive: true });
  return { sourceVaultRoot, runtimeRoot };
}

function write(root: string, relativePath: string, content: string): void {
  const full = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}
