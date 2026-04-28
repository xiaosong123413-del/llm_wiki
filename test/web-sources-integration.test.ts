import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import {
  describe,
  expect,
  it,
} from "vitest";

/**
 * Guards the shell integration points for the sources library route.
 */

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

describe("sources shell integration", () => {
  it("wires rail and main slot to the sources page", () => {
    const rail = fs.readFileSync(path.join(root, "web", "client", "src", "shell", "rail.ts"), "utf8");
    const slot = fs.readFileSync(path.join(root, "web", "client", "src", "shell", "main-slot.ts"), "utf8");

    expect(rail).toMatch(/route:\s*"sources"/);
    expect(slot).toMatch(/renderSourcesPage/);
    expect(slot).toMatch(/case "sources":/);
  });
});
