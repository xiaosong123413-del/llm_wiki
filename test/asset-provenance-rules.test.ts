import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearRuleRegistry } from "../web/server/services/rules/registry.js";
import { runRules } from "../web/server/services/rule-engine.js";

afterEach(() => {
  clearRuleRegistry();
});

describe("asset provenance rules", () => {
  it("reports an image referenced from wiki when raw and sources_full cannot trace it", () => {
    const root = mkdtempSync(join(tmpdir(), "asset-provenance-image-"));
    const wikiRoot = join(root, "wiki");
    const projectRoot = root;

    mkdirSync(join(wikiRoot, "concepts"), { recursive: true });
    mkdirSync(join(projectRoot, "raw"), { recursive: true });
    mkdirSync(join(projectRoot, "sources_full"), { recursive: true });
    writeFileSync(
      join(wikiRoot, "concepts", "page.md"),
      "# Page\n\n![diagram](../assets/diagram.png)\n",
      "utf8",
    );

    const issues = runRules({ wikiRoot, projectRoot });

    expect(issues).toEqual([
      expect.objectContaining({
        ruleId: "image-provenance",
        severity: "error",
        title: "Untraceable image reference",
        target: "wiki/concepts/page.md",
      }),
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("reports PDF and video files when no provenance record exists", () => {
    const root = mkdtempSync(join(tmpdir(), "asset-provenance-asset-"));
    const wikiRoot = join(root, "wiki");
    const projectRoot = root;

    mkdirSync(join(wikiRoot, "concepts"), { recursive: true });
    mkdirSync(join(projectRoot, "raw", "clip"), { recursive: true });
    mkdirSync(join(projectRoot, "sources_full", "docs"), { recursive: true });
    writeFileSync(join(projectRoot, "raw", "clip", "handbook.pdf"), "%PDF-1.4", "utf8");
    writeFileSync(join(projectRoot, "sources_full", "docs", "demo.mp4"), "video", "utf8");

    const issues = runRules({ wikiRoot, projectRoot });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "asset-provenance",
          severity: "warn",
          title: "Missing asset provenance record",
          target: "raw/clip/handbook.pdf",
        }),
        expect.objectContaining({
          ruleId: "asset-provenance",
          severity: "warn",
          title: "Missing asset provenance record",
          target: "sources_full/docs/demo.mp4",
        }),
      ]),
    );

    rmSync(root, { recursive: true, force: true });
  });
});
