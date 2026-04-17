// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouter, parseHash, type Route } from "../web/client/src/router.js";

describe("parseHash", () => {
  it("parses a simple route", () => {
    expect(parseHash("#/chat")).toEqual({ name: "chat", params: {} });
  });

  it("extracts a single path parameter", () => {
    expect(parseHash("#/chat/abc-123")).toEqual({ name: "chat", params: { id: "abc-123" } });
  });

  it("extracts a settings section", () => {
    expect(parseHash("#/settings/llm")).toEqual({ name: "settings", params: { section: "llm" } });
  });

  it("falls back to the default route for empty or unknown hashes", () => {
    expect(parseHash("")).toEqual({ name: "chat", params: {} });
    expect(parseHash("#/nope")).toEqual({ name: "chat", params: {} });
  });
});

describe("createRouter", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("calls onChange with the current route on start", () => {
    const onChange = vi.fn();
    window.location.hash = "#/review";
    const router = createRouter(onChange);
    router.start();
    expect(onChange).toHaveBeenCalledWith({ name: "review", params: {} });
  });

  it("calls onChange on hashchange", () => {
    const onChange = vi.fn();
    const router = createRouter(onChange);
    router.start();
    onChange.mockClear();
    window.location.hash = "#/sync";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(onChange).toHaveBeenCalledWith({ name: "sync", params: {} });
  });

  it("navigate() updates the hash", () => {
    const onChange = vi.fn();
    const router = createRouter(onChange);
    router.start();
    router.navigate({ name: "check" });
    expect(window.location.hash).toBe("#/check");
  });
});

const sample: Route = { name: "chat", params: {} };
void sample;
