import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

describe("windows gui launcher", () => {
  it("starts sync compile without showing a console window", async () => {
    const formSource = await readFile(
      path.join(root, "gui", "LlmWikiGui", "MainForm.cs"),
      "utf8",
    );

    expect(formSource).toContain("CreateNoWindow = true");
    expect(formSource).toContain("RedirectStandardOutput = true");
    expect(formSource).toContain("sync-compile.mjs");
  });

  it("build script publishes a desktop exe panel", async () => {
    const buildScript = await readFile(
      path.join(root, "scripts", "build-gui.ps1"),
      "utf8",
    );

    expect(buildScript).toContain("LLM-Wiki-Compiler-Panel.exe");
    expect(buildScript).toContain("csc.exe");
    expect(buildScript).toContain("/target:winexe");
  });
});
