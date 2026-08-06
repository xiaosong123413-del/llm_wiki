/**
 * Regression coverage for the page-local Wiki Graphy renderer.
 *
 * Ordinary wiki article pages use a separate radial graph from the full Graphy
 * page. This keeps that compact renderer showing node names instead of only
 * circles and lines.
 */
import fs from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

describe("wiki page Graphy renderer", () => {
  it("configures ordinary wiki page graphs to show node labels", () => {
    const source = fs.readFileSync("web/client/src/pages/wiki/page-graph.ts", "utf-8");

    expect(source).toMatch(/const PAGE_GRAPH_SETTINGS:[\s\S]*labelDensity:\s*1,/u);
    expect(source).toMatch(/const PAGE_GRAPH_SETTINGS:[\s\S]*labelRenderedSizeThreshold:\s*0,/u);
    expect(source).toMatch(/const PAGE_GRAPH_SETTINGS:[\s\S]*labelSize:\s*13,/u);
    expect(source).toMatch(/const PAGE_GRAPH_SETTINGS:[\s\S]*labelWeight:\s*"bold",/u);
    expect(source).not.toMatch(/labelRenderedSizeThreshold:\s*999/u);
  });

  it("clips the page-local Sigma canvas inside the Graphy stage", () => {
    const css = fs.readFileSync("web/client/assets/styles/wiki-launch.css", "utf-8");

    expect(css).toMatch(/\.wiki-page__graph-card\s*\{[^}]*overflow:\s*hidden;/su);
    expect(css).toMatch(/\.wiki-page__graph-stage\s*\{[^}]*position:\s*relative;/su);
    expect(css).toMatch(/\.wiki-page__graph-stage\s*\{[^}]*overflow:\s*hidden;/su);
    expect(css).toMatch(/\.wiki-page__graph-stage\s*\{[^}]*height:\s*220px;/su);
    expect(css).toMatch(/\.wiki-page__graph-stage canvas\s*\{[^}]*inset:\s*0;/su);
  });
});
