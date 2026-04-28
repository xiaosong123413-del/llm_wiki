// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BUILD_INFO } from "../web/client/src/runtime/build-info.js";
import { readRuntimeSnapshot } from "../web/client/src/runtime/diagnostics.js";

describe("runtime diagnostics", () => {
  it("keeps runtime data readable without rendering a floating panel", () => {
    document.body.innerHTML = `
      <div id="workspace-shell" data-route="review"></div>
      <main id="shell-main-slot"></main>
    `;
    window.location.hash = "#/review";
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const mainSlot = document.getElementById("shell-main-slot") as HTMLElement;
    mainSlot.getBoundingClientRect = () =>
      ({ width: 864 } as DOMRect);

    const snapshot = readRuntimeSnapshot(shellRoot, mainSlot);

    expect(document.getElementById("runtime-diagnostics")).toBeNull();
    expect(snapshot.buildVersion).toBe(BUILD_INFO.version);
    expect(snapshot.route).toBe("#/review");
    expect(snapshot.mainWidth).toBe("864px");
  });
});
