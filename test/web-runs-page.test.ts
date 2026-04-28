// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderRunPage } from "../web/client/src/pages/runs/index.js";

describe("renderRunPage", () => {
  it("renders the system check page with a start button and log view", () => {
    const page = renderRunPage("check");

    expect(page.querySelector(".run-page__title")?.textContent).toContain("\u7cfb\u7edf\u68c0\u67e5");
    expect(page.querySelector<HTMLButtonElement>("[data-run-start]")?.textContent).toContain("\u5f00\u59cb");
    expect(page.querySelector("[data-run-log]")).toBeTruthy();
  });

  it("renders the sync page with sync-specific copy", () => {
    const page = renderRunPage("sync");

    expect(page.querySelector(".run-page__title")?.textContent).toContain("\u540c\u6b65\u7f16\u8bd1");
    expect(page.querySelector(".run-page__copy")?.textContent).toContain("\u540c\u6b65\u6e90\u6587\u4ef6\u5939");
  });
});
