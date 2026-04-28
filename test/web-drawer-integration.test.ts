import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

describe("web drawer integration", () => {
  it("opens the drawer from tree selection without navigating the main article view", async () => {
    const source = await readFile(path.join(root, "web", "client", "main.ts"), "utf8");

    expect(source).toContain("renderTree(browserRefs.treeContainer, tree, (path) => {");
    expect(source).toContain("void openDrawerForPath(path);");
    expect(source).not.toContain("renderTree(browserRefs.treeContainer, tree, (path) => {\r\n    void openDrawerForPath(path);\r\n    void navigateToPage(path);");
    expect(source).not.toContain("renderTree(browserRefs.treeContainer, tree, (path) => {\n    void openDrawerForPath(path);\n    void navigateToPage(path);");
    expect(source).toContain("onNavigate: (path: string) => {\n      void openDrawerForPath(path);");
    expect(source).not.toContain("onNavigate: (path: string) => {\n      void openDrawerForPath(path);\n      void navigateToPage(path);");
  });
});
