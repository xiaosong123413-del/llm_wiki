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

  it("keeps gui source ascii-only to avoid Windows PowerShell encoding damage", async () => {
    const formSource = await readFile(
      path.join(root, "gui", "LlmWikiGui", "MainForm.cs"),
      "utf8",
    );

    expect([...formSource].every((char) => char.charCodeAt(0) <= 127)).toBe(true);
    expect(formSource).toContain("\\u7684\\u4ed3\\u5e93");
  });

  it("renders the panel with Chinese labels through unicode escapes", async () => {
    const formSource = await readFile(
      path.join(root, "gui", "LlmWikiGui", "MainForm.cs"),
      "utf8",
    );

    expect(formSource).toContain("\\u4e00\\u952e\\u540c\\u6b65\\u7f16\\u8bd1");
    expect(formSource).toContain("\\u5f00\\u59cb\\u540c\\u6b65\\u5e76\\u7f16\\u8bd1");
    expect(formSource).toContain("\\u8fd0\\u884c\\u65e5\\u5fd7");
    expect(formSource).not.toContain("One-click Sync Compile");
  });

  it("strips ansi terminal color codes before writing gui logs", async () => {
    const formSource = await readFile(
      path.join(root, "gui", "LlmWikiGui", "MainForm.cs"),
      "utf8",
    );

    expect(formSource).toContain("StripAnsi");
    expect(formSource).toContain("@\"\\x1B\\[[0-?]*[ -/]*[@-~]\"");
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
