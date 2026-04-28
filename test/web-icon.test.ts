// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderIcon, ICON_NAMES } from "../web/client/src/components/icon.js";

describe("renderIcon", () => {
  it("returns an <svg> string with the requested size and stroke width", () => {
    const svg = renderIcon("message-square", { size: 20, strokeWidth: 1.75 });
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toMatch(/width="20"/);
    expect(svg).toMatch(/height="20"/);
    expect(svg).toMatch(/stroke-width="1.75"/);
    expect(svg).toMatch(/class="lucide-icon"/);
  });

  it("falls back to the default size when omitted", () => {
    const svg = renderIcon("settings");
    expect(svg).toMatch(/width="20"/);
    expect(svg).toMatch(/stroke-width="1.75"/);
  });

  it("throws for an unknown icon name", () => {
    expect(() => renderIcon("definitely-not-a-real-icon")).toThrow(/unknown icon/i);
  });

  it("exports every Phase 1 icon used by the shell", () => {
    for (const name of [
      "message-square",
      "check-circle-2",
      "refresh-cw",
      "clipboard-list",
      "settings",
      "search",
      "plus",
      "chevron-left",
      "chevron-right",
      "hammer",
    ]) {
      expect(ICON_NAMES).toContain(name);
      expect(() => renderIcon(name)).not.toThrow();
    }
  });
});
