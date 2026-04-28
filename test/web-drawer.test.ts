// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDrawer } from "../web/client/src/shell/drawer.js";

describe("createDrawer", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="workspace-shell" data-drawer-open="false"></div>
      <aside id="drawer"></aside>
    `;
  });

  it("opens with rendered content and marks the shell as open", () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer") as HTMLElement;
    const drawer = createDrawer({ shellRoot, container, onNavigate: vi.fn() });

    drawer.open({
      path: "wiki/concepts/example.md",
      title: "Example",
      html: "<p>Hello drawer</p>",
    });

    expect(shellRoot.dataset.drawerOpen).toBe("true");
    expect(container.querySelector(".shell-drawer__title")?.textContent).toContain("Example");
    expect(container.querySelector(".shell-drawer__body")?.innerHTML).toContain("Hello drawer");
  });

  it("renders footer metadata when provided", () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer") as HTMLElement;
    const drawer = createDrawer({ shellRoot, container, onNavigate: vi.fn() });

    drawer.open({
      path: "wiki/concepts/example.md",
      title: "Example",
      html: "<p>Hello drawer</p>",
      aliases: ["示例", "范例"],
      sizeBytes: 1536,
      modifiedAt: "2026-04-17T19:20:00.000Z",
    });

    expect(container.querySelector(".shell-drawer__footer")?.textContent).toContain("1.5 KB");
    expect(container.querySelector(".shell-drawer__footer")?.textContent).toContain("2026-04-17");
    expect(container.querySelectorAll(".shell-drawer__alias").length).toBe(2);
  });

  it("closes when the close button is clicked", () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer") as HTMLElement;
    const drawer = createDrawer({ shellRoot, container, onNavigate: vi.fn() });

    drawer.open({
      path: "wiki/concepts/example.md",
      title: "Example",
      html: "<p>Hello drawer</p>",
    });
    container.querySelector<HTMLButtonElement>("[data-drawer-close]")?.click();

    expect(shellRoot.dataset.drawerOpen).toBe("false");
    expect(container.innerHTML).toBe("");
  });

  it("delegates wikilink clicks back to the caller", () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer") as HTMLElement;
    const onNavigate = vi.fn();
    const drawer = createDrawer({ shellRoot, container, onNavigate });

    drawer.open({
      path: "wiki/concepts/example.md",
      title: "Example",
      html: '<p><a class="wikilink wikilink-alive" href="/?page=wiki%2Fconcepts%2Fother.md">Other</a></p>',
    });
    container.querySelector<HTMLAnchorElement>(".wikilink")?.click();

    expect(onNavigate).toHaveBeenCalledWith("wiki/concepts/other.md");
  });

  it("renders clickable breadcrumb segments and navigates from them", () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer") as HTMLElement;
    const onNavigate = vi.fn();
    const drawer = createDrawer({ shellRoot, container, onNavigate });

    drawer.open({
      path: "wiki/concepts/example.md",
      title: "Example",
      html: "<p>Hello drawer</p>",
    });

    const crumbs = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-drawer-crumb]"));
    expect(crumbs.map((crumb) => crumb.textContent?.trim())).toEqual(["wiki", "concepts", "example.md"]);

    crumbs[1]?.click();
    expect(onNavigate).toHaveBeenCalledWith("wiki/concepts");
  });

  it("closes when Escape is pressed", () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer") as HTMLElement;
    const drawer = createDrawer({ shellRoot, container, onNavigate: vi.fn() });

    drawer.open({
      path: "wiki/concepts/example.md",
      title: "Example",
      html: "<p>Hello drawer</p>",
    });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(shellRoot.dataset.drawerOpen).toBe("false");
    expect(container.innerHTML).toBe("");
  });

  it("copies a wikilink for the current path", async () => {
    const shellRoot = document.getElementById("workspace-shell") as HTMLElement;
    const container = document.getElementById("drawer") as HTMLElement;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const drawer = createDrawer({ shellRoot, container, onNavigate: vi.fn() });

    drawer.open({
      path: "wiki/concepts/example.md",
      title: "Example",
      html: "<p>Hello drawer</p>",
    });

    container.querySelector<HTMLButtonElement>("[data-drawer-copy]")?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("[[wiki/concepts/example.md]]");
  });
});
