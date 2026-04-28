import { describe, expect, it } from "vitest";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { compile } from "../src/compiler/index.js";
import { makeTempRoot } from "./fixtures/temp-root.js";

describe("compile maintenance artifacts", () => {
  it("rebuilds index, MOC, and log.md when sources are already up to date", async () => {
    const root = await makeTempRoot("compile-maintenance-log");
    await mkdir(path.join(root, "sources"), { recursive: true });

    await compile(root);

    const index = await readFile(path.join(root, "wiki/index.md"), "utf-8");
    const moc = await readFile(path.join(root, "wiki/MOC.md"), "utf-8");
    const log = await readFile(path.join(root, "log.md"), "utf-8");

    expect(index).toContain("# ");
    expect(moc).toContain("# ");
    expect(log).toMatch(/^## \[\d{4}-\d{2}-\d{2}\] compile \| 0 compiled/m);
    expect(log).toContain("- rebuilt: wiki/index.md, wiki/MOC.md");
  });
});
