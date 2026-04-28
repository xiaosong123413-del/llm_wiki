// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPanelWidth,
  clampPanelWidth,
  readPanelWidth,
  writePanelWidth,
  type PanelWidthBounds,
} from "../web/client/src/shell/panel-layout.js";

const CHAT_BROWSER: PanelWidthBounds = {
  defaultWidth: 320,
  minWidth: 240,
  maxWidth: 520,
};

describe("panel layout storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("returns defaults when no width is stored", () => {
    expect(readPanelWidth("chat.browserWidth", CHAT_BROWSER)).toBe(320);
  });

  it("persists and reads a bounded width", () => {
    writePanelWidth("chat.browserWidth", 400, CHAT_BROWSER);
    expect(readPanelWidth("chat.browserWidth", CHAT_BROWSER)).toBe(400);
  });

  it("clamps invalid values before storing and applying", () => {
    expect(clampPanelWidth(120, CHAT_BROWSER)).toBe(240);
    expect(clampPanelWidth(999, CHAT_BROWSER)).toBe(520);

    const target = document.createElement("div");
    applyPanelWidth(target, "--chat-browser-width", 487.7);
    expect(target.style.getPropertyValue("--chat-browser-width")).toBe("488px");
  });
});
