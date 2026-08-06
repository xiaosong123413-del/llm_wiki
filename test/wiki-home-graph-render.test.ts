// @vitest-environment jsdom
/**
 * Regression coverage for Graphy stage layout timing.
 *
 * Sigma throws when constructed before its container has a layout width. The
 * widget waits until the newly inserted stage has a real size before renderer
 * construction.
 */
import fs from "node:fs";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { waitForGraphStageSize } from "../web/client/src/pages/wiki/home-graph.js";

describe("wiki home Graphy renderer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for the graph stage to have width", async () => {
    let widthReads = 0;
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        widthReads += 1;
        return widthReads > 1 ? 320 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 240;
      },
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      setTimeout(() => callback(performance.now()), 0);
      return 1;
    });

    await waitForGraphStageSize(document.createElement("div"), new AbortController().signal);

    expect(widthReads).toBeGreaterThan(1);
  });

  it("keeps the Sigma canvas clipped inside the Graphy stage", () => {
    const css = fs.readFileSync("web/client/assets/styles/wiki-home-cover.css", "utf-8");

    expect(css).toMatch(/\.wiki-home-cover__graph-stage\s*\{[^}]*position:\s*relative;/su);
    expect(css).toMatch(/\.wiki-home-cover__graph-stage\s*\{[^}]*overflow:\s*hidden;/su);
    expect(css).toMatch(/\.wiki-home-cover__graph-stage canvas\s*\{[^}]*inset:\s*0;/su);
  });

  it("places categories beside Graphy on the desktop home grid", () => {
    const css = fs.readFileSync("web/client/assets/styles/wiki-home-cover.css", "utf-8");

    expect(css).toMatch(/\.wiki-home-cover__panel--categories,\s*\.wiki-home-cover__panel--graph\s*\{[^}]*grid-row:\s*2;/su);
    expect(css).toMatch(/\.wiki-home-cover__panel--about\s*\{[^}]*grid-row:\s*3;/su);
  });

  it("keeps node and edge coordinates when Graphy highlights related nodes", () => {
    const source = fs.readFileSync("web/client/src/pages/wiki/home-graph.ts", "utf-8");

    expect(source).toMatch(/return\s*\{\s*\.\.\.data,\s*color:\s*data\.color,/u);
    expect(source).toMatch(/return\s*\{\s*\.\.\.data,[^}]*label:\s*"",/su);
    expect(source).toMatch(/sourceHit\s*&&\s*targetHit/u);
    expect(source).toMatch(/return\s*\{\s*\.\.\.data,\s*color:\s*"rgba\(51,\s*102,\s*204,\s*0\.72\)"/u);
    expect(source).toMatch(/return\s*\{\s*\.\.\.data,\s*color:\s*"rgba\(96,\s*165,\s*250,\s*0\.18\)"/u);
    expect(source).toMatch(/return\s*\{\s*\.\.\.data,\s*color:\s*"rgba\(148,\s*163,\s*184,\s*0\.12\)"/u);
  });
});
