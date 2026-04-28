// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderSettingsPage } from "../web/client/src/pages/settings/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as Window & { llmWikiDesktop?: unknown }).llmWikiDesktop;
  document.body.innerHTML = "";
});

describe("settings page", () => {
  it("loads the default model card from existing accounts and saves the selected account source", async () => {
    let savedBody: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                provider: "deepseek",
                accountRef: "api:deepseek:primary",
                url: "https://api.deepseek.com/v1",
                keyConfigured: true,
                model: "deepseek-chat",
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/accounts" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                accounts: [{
                  id: "deepseek:primary",
                  name: "primary",
                  provider: "deepseek",
                  url: "https://api.deepseek.com/v1",
                  keyConfigured: true,
                  model: "deepseek-chat",
                  enabled: true,
                  updatedAt: "2026-04-25T00:00:00.000Z",
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                running: false,
                proxyBaseUrl: "http://127.0.0.1:8317/v1",
                accounts: [],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                accounts: [{
                  name: "codex.json",
                  provider: "codex",
                  email: "me@example.com",
                  status: "ok",
                  enabled: true,
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/config" && init?.method === "PUT") {
          savedBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                provider: "codex-cli",
                accountRef: "oauth:codex:codex.json",
                url: "http://127.0.0.1:8317/v1",
                keyConfigured: true,
                model: "gpt-5-codex",
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    const select = page.querySelector<HTMLSelectElement>("[data-llm-default-account]");
    expect(page.querySelector("[data-llm-default-card]")).not.toBeNull();
    expect(page.querySelector("[data-llm-account-summary-card]")).not.toBeNull();
    expect(select?.value).toBe("api:deepseek:primary");
    expect(page.querySelector("[data-llm-default-provider]")?.textContent).toContain("DeepSeek");
    expect(page.querySelector("[data-llm-default-model]")?.textContent).toContain("deepseek-chat");
    expect(page.querySelector("[data-llm-account-summary-card]")?.textContent).toContain("primary");
    expect(page.querySelector("[data-llm-account-summary-card]")?.textContent).toContain("me@example.com");

    if (!select) throw new Error("default model selector not rendered");
    select.value = "oauth:codex:codex.json";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-settings-save]")?.click();
    await flush();

    expect(fetch).toHaveBeenCalledWith(
      "/api/llm/config",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(savedBody).toEqual({
      accountRef: "oauth:codex:codex.json",
    });
    expect(page.querySelector("[data-llm-config-status]")?.textContent).toContain("保存");
  });

  it("saves and tests an individual LLM provider account row", async () => {
    const savedBodies: unknown[] = [];
    const testedBodies: unknown[] = [];
    let savedAccounts: Array<{
      id: string;
      name: string;
      provider: string;
      url: string;
      keyConfigured: boolean;
      model: string;
      enabled: boolean;
      updatedAt: string;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                provider: "openai",
                url: "https://api.openai.com/v1",
                keyConfigured: false,
                model: "gpt-4o",
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/accounts" && init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          savedBodies.push(body);
          savedAccounts = [{
            id: "deepseek:deepseek",
            name: body.name,
            provider: body.provider,
            url: body.url,
            keyConfigured: true,
            model: body.model,
            enabled: true,
            updatedAt: "2026-04-23T00:00:00.000Z",
          }];
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: savedAccounts[0],
            }),
          } as Response;
        }
        if (url === "/api/llm/accounts" && !init?.method) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: savedAccounts } }),
          } as Response;
        }
        if (url === "/api/llm/test" && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          testedBodies.push(body);
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                ok: true,
                provider: body.provider,
                endpoint: `${body.url}/chat/completions`,
                message: "connected",
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    const initialRow = page.querySelector<HTMLElement>("[data-llm-account=\"deepseek\"]");
    expect(initialRow).not.toBeNull();
    if (!initialRow) throw new Error("DeepSeek row not rendered");
    (initialRow.querySelector("[data-provider=\"deepseek:url\"]") as HTMLInputElement).value = "https://api.deepseek.com/v1";
    (initialRow.querySelector("[data-provider=\"deepseek:key\"]") as HTMLInputElement).value = "sk-deepseek";
    (initialRow.querySelector("[data-provider=\"deepseek:model\"]") as HTMLSelectElement).value = "deepseek-chat";

    initialRow.querySelector<HTMLButtonElement>("[data-llm-account-save]")?.click();
    await flush();
    expect(savedBodies).toEqual([{
      name: "deepseek",
      provider: "deepseek",
      url: "https://api.deepseek.com/v1",
      key: "sk-deepseek",
      model: "deepseek-chat",
    }]);

    const savedRow = page.querySelector<HTMLElement>("[data-llm-account=\"deepseek\"]");
    expect(savedRow).not.toBeNull();
    if (!savedRow) throw new Error("DeepSeek row missing after save");

    savedRow.querySelector<HTMLButtonElement>("[data-llm-account-test]")?.click();
    await flush();
    expect(testedBodies).toEqual([{
      id: "deepseek:deepseek",
      name: "deepseek",
      provider: "deepseek",
      url: "https://api.deepseek.com/v1",
      key: "",
      model: "deepseek-chat",
    }]);
    expect(savedRow.querySelector("[data-llm-account-status]")?.textContent).toContain("connected");
  });

  it("renders repository, llm, search, and embedding sections", () => {
    const page = renderSettingsPage();

    expect(page.querySelector(".settings-page__title")?.textContent).toContain("\u8bbe\u7f6e");
    expect(page.textContent).toContain("\u4ed3\u5e93\u4e0e\u540c\u6b65");
    expect(page.textContent).toContain("\u6570\u636e\u5bfc\u5165");
    expect(page.textContent).toContain("\u5c0f\u7ea2\u4e66");
    expect(page.textContent).toContain("X (Twitter)");
    expect(page.textContent).toContain("2. \u540c\u6b65\u4ed3\u5e93");
    expect(page.textContent).toContain("LLM");
    expect(page.textContent).toContain("\u7f51\u7edc\u641c\u7d22");
    expect(page.textContent).toContain("Vector Search");
    expect(page.textContent).toContain("\u9879\u76ee\u65e5\u5fd7");
    expect(page.textContent).toContain("\u5feb\u6377\u952e");
    expect(page.textContent).toContain("\u95ea\u5ff5\u65e5\u8bb0\u5feb\u901f\u8bb0\u5f55");
    expect(page.querySelector("[data-search-provider-status]")).not.toBeNull();
    expect((page.querySelector("[data-shortcut-id=\"flashDiaryCapture\"]") as HTMLInputElement).value).toBe("CommandOrControl+Shift+J");
    expect(page.querySelector("[data-settings-nav=\"project-log\"]")?.textContent).toContain("项目日志");
  });

  it("defines the settings content as the scroll container inside the full-page shell", () => {
    const stylesheet = readFileSync(
      path.resolve(import.meta.dirname, "../web/client/styles.css"),
      "utf8",
    );

    expect(stylesheet).toContain("#workspace-shell[data-full-page] .shell-main");
    expect(stylesheet).toContain("overflow: hidden;");
    expect(stylesheet).toMatch(/\.settings-page\s*\{[^}]*\n\s*height:\s*100%;/);
    expect(stylesheet).toMatch(/\.settings-page\s*\{[^}]*\n\s*min-height:\s*0;/);
    expect(stylesheet).toMatch(/\.settings-content\s*\{[^}]*\n\s*height:\s*100%;/);
    expect(stylesheet).toMatch(/\.settings-content\s*\{[^}]*\n\s*min-height:\s*0;/);
    expect(stylesheet).toMatch(/\.settings-content\s*\{[^}]*\n\s*overflow-y:\s*auto;/);
  });

  it("renders a resizable settings navigation and merges web search status into the search API page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: true, endpointHost: "search.example.com" },
              },
            }),
          } as Response;
        }
        if (url === "/api/search/test") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { ok: true, message: "connected" },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    expect(page.querySelector("[data-settings-sidebar]")).not.toBeNull();
    expect(page.querySelector("[data-settings-sidebar-resize]")).not.toBeNull();
    expect(page.querySelector("[data-settings-section=\"app-config\"]")).not.toBeNull();
    const navItems = Array.from(page.querySelectorAll("[data-settings-nav]"));
    expect(navItems[1]?.getAttribute("data-settings-nav")).toBe("app-config");
    expect(navItems[2]?.getAttribute("data-settings-nav")).toBe("automation");
    expect(page.querySelector("[data-settings-section=\"llm\"]")?.textContent).toContain("LLM");
    expect(page.querySelector("[data-settings-section=\"network-search\"]")).not.toBeNull();
    expect(page.querySelector("[data-settings-section=\"embedding\"]")?.textContent).toContain("Vector Search");
    expect(page.querySelector("[data-settings-section=\"plugins\"]")?.textContent).toContain("MCP");
    expect(page.querySelector("[data-settings-section=\"workspace-sync\"]")?.textContent).toContain("同步");

    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"network-search\"]")?.click();
    expect(page.querySelector("[data-settings-panel=\"network-search\"]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-search-provider-status]")?.textContent).toContain("search.example.com");
    expect(page.querySelector("[data-search-provider-light]")?.className).toContain("is-ok");
    expect(page.textContent).not.toContain("外网搜索状态");

    page.querySelector<HTMLButtonElement>("[data-search-provider-test]")?.click();
    await flush();
    expect(fetch).toHaveBeenCalledWith("/api/search/test", { method: "POST" });
    expect(page.querySelector("[data-search-provider-status]")?.textContent).toContain("connected");
  });

  it("loads and saves the network search provider config", async () => {
    let savedBody: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: true, endpointHost: "search.example.com" },
              },
            }),
          } as Response;
        }
        if (url === "/api/search/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                url: "https://search.example.com/query/",
                keyConfigured: true,
                model: "provider/model",
              },
            }),
          } as Response;
        }
        if (url === "/api/search/config" && init?.method === "PUT") {
          savedBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                url: "https://search.example.com/live",
                keyConfigured: true,
                model: "provider/live-model",
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"network-search\"]")?.click();
    await flush();

    expect((page.querySelector("[data-provider=\"search:url\"]") as HTMLInputElement).value).toBe("https://search.example.com/query/");
    expect((page.querySelector("[data-provider=\"search:model\"]") as HTMLInputElement).value).toBe("provider/model");

    (page.querySelector("[data-provider=\"search:url\"]") as HTMLInputElement).value = "https://search.example.com/live";
    (page.querySelector("[data-provider=\"search:key\"]") as HTMLInputElement).value = "search-secret";
    (page.querySelector("[data-provider=\"search:model\"]") as HTMLInputElement).value = "provider/live-model";

    page.querySelector<HTMLButtonElement>("[data-search-provider-save]")?.click();
    await flush();

    expect(fetch).toHaveBeenCalledWith(
      "/api/search/config",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(savedBody).toEqual({
      url: "https://search.example.com/live",
      key: "search-secret",
      model: "provider/live-model",
    });
    expect(page.querySelector("[data-search-provider-status]")?.textContent).toContain("保存");
  });

  it("renders CLIProxyAPI as a collapsed advanced section by default", () => {
    const page = renderSettingsPage();
    const toggle = page.querySelector<HTMLButtonElement>("[data-cliproxy-toggle]");
    const body = page.querySelector<HTMLElement>("[data-cliproxy-body]");

    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(body?.hidden).toBe(true);
    expect(body?.querySelector("[data-cliproxy-install]")).not.toBeNull();
    expect(body?.querySelector("[data-cliproxy-oauth=\"codex\"]")?.textContent).toContain("Codex");
    expect(page.textContent).toContain("Codex");
    expect(page.textContent).toContain("OAuth");
  });

  it("expands the CLIProxyAPI section when the toggle is clicked", () => {
    const page = renderSettingsPage();
    const toggle = page.querySelector<HTMLButtonElement>("[data-cliproxy-toggle]");
    const body = page.querySelector<HTMLElement>("[data-cliproxy-body]");

    toggle?.click();

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(body?.hidden).toBe(false);
    expect(page.querySelector("[data-cliproxy-install]")).not.toBeNull();
    expect(page.querySelector("[data-cliproxy-oauth=\"codex\"]")?.textContent).toContain("Codex");
  });

  it("renders LLM provider cards with multi-account controls, relay balance, and Codex CLI status", () => {
    const page = renderSettingsPage();

    expect(page.querySelector("[data-llm-config-status]")).not.toBeNull();
    expect(page.querySelector("[data-llm-default-card]")).not.toBeNull();
    expect(page.querySelector("[data-llm-account-summary-card]")).not.toBeNull();
    expect(page.querySelector("[data-cliproxy-status]")).not.toBeNull();
    expect(page.querySelector("[data-cliproxy-install]")).not.toBeNull();
    expect(page.querySelector("[data-cliproxy-oauth=\"codex\"]")?.textContent).toContain("Codex");
    expect(page.querySelector("[data-llm-provider=\"openai\"]")?.textContent).toContain("OpenAI");
    expect(page.querySelector("[data-llm-provider=\"anthropic\"]")?.textContent).toContain("Anthropic");
    expect(page.querySelector("[data-llm-provider=\"relay\"]")).not.toBeNull();
    expect(page.querySelector("[data-llm-provider=\"codex-cli\"]")?.textContent).toContain("Codex CLI");
    expect(page.querySelector("[data-llm-account-add=\"relay\"]")).not.toBeNull();
    expect(page.querySelector("[data-llm-account-test]")).not.toBeNull();
    expect(page.querySelector("[data-llm-account-save]")).not.toBeNull();
    expect(page.querySelector("[data-llm-account-delete]")).not.toBeNull();
    expect(page.querySelector("[data-relay-balance-current]")).not.toBeNull();
    expect(page.querySelector("[data-relay-balance-used]")).not.toBeNull();
    expect(page.querySelector("[data-relay-balance-refresh]")).not.toBeNull();
    expect(page.querySelector("[data-codex-cli-balance]")).not.toBeNull();
    expect(page.querySelector("[data-codex-cli-refresh]")).not.toBeNull();
  });

  it("manages CLIProxyAPI from the LLM settings page", async () => {
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" } }),
          } as Response;
        }
        if (url === "/api/cliproxy/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                running: true,
                proxyBaseUrl: "http://127.0.0.1:8317/v1",
                config: { proxyUrl: "http://127.0.0.1:7890" },
                accounts: [{ name: "codex.json", provider: "codex", email: "me@example.com", status: "ok" }],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/oauth" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { url: "https://auth.example.com", state: "state" } }),
          } as Response;
        }
        if (url === "/api/cliproxy/oauth/status?state=state") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { status: "ok" } }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts" || url === "/api/cliproxy/accounts?refresh=1") {
          const withQuota = url.endsWith("?refresh=1");
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                accounts: [{
                  name: "codex.json",
                  provider: "codex",
                  email: "me@example.com",
                  enabled: true,
                  planType: "plus",
                  quota: withQuota
                    ? {
                      fetchedAt: "2026-04-23T01:00:00Z",
                      primaryWindow: { usedPercent: 20, resetsAt: "2026-04-23T06:00:00Z" },
                      secondaryWindow: { usedPercent: 30, resetsAt: "2026-04-30T01:00:00Z" },
                    }
                    : undefined,
                }, {
                  name: "gemini.json",
                  provider: "gemini-cli",
                  email: "gemini@example.com",
                  enabled: true,
                  status: "ok",
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts/enabled" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { ok: true } }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    const openExternal = vi.fn(async () => undefined);
    Object.defineProperty(window, "llmWikiDesktop", {
      value: { openExternal },
      configurable: true,
    });

    page.querySelector<HTMLButtonElement>("[data-cliproxy-refresh]")?.click();
    await flush();
    expect(page.querySelector("[data-cliproxy-status]")?.textContent).toContain("127.0.0.1:8317");
    expect(page.querySelector("[data-cliproxy-accounts]")?.textContent).toContain("me@example.com");
    expect(page.querySelector<HTMLInputElement>("[data-cliproxy-proxy-url]")?.value).toBe("http://127.0.0.1:7890");
    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("me@example.com");
    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("gemini@example.com");
    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("Gemini");
    page.querySelector<HTMLButtonElement>("[data-cliproxy-codex-refresh]")?.click();
    await flush();
    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("5h");
    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("80%");
    expect(page.querySelector(".settings-codex-account__quota-bar span")?.getAttribute("style")).toContain("width:80%");

    const codexList = page.querySelector<HTMLElement>("[data-cliproxy-codex-accounts]");
    page.querySelector<HTMLButtonElement>("[data-cliproxy-codex-toggle]")?.click();
    expect(codexList?.hidden).toBe(true);
    page.querySelector<HTMLButtonElement>("[data-cliproxy-codex-toggle]")?.click();
    expect(codexList?.hidden).toBe(false);

    page.querySelector<HTMLButtonElement>("[data-cliproxy-oauth=\"codex\"]")?.click();
    await flush();
    expect(fetch).toHaveBeenCalledWith(
      "/api/cliproxy/oauth",
      expect.objectContaining({ method: "POST" }),
    );
    expect(openExternal).toHaveBeenCalledWith("https://auth.example.com");
    expect(window.open).not.toHaveBeenCalled();
    const copyButton = page.querySelector<HTMLButtonElement>("[data-cliproxy-oauth-copy]");
    expect(copyButton?.hidden).toBe(false);
    expect(copyButton?.dataset.oauthUrl).toBe("https://auth.example.com");
  });

  it("falls back to CLIProxy status when the all-OAuth accounts endpoint is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "" } }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return {
            ok: true,
            json: async () => {
              throw new SyntaxError("Unexpected token '<', \"<!DOCTYPE\" is not valid JSON");
            },
          } as Response;
        }
        if (url === "/api/cliproxy/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                running: true,
                proxyBaseUrl: "http://127.0.0.1:8317/v1",
                config: {},
                accounts: [
                  { name: "codex.json", provider: "codex", email: "me@example.com", status: "active" },
                  { name: "gemini.json", provider: "gemini-cli", email: "gemini@example.com", status: "active" },
                ],
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-cliproxy-toggle]")?.click();
    page.querySelector<HTMLButtonElement>("[data-cliproxy-refresh]")?.click();
    await flush();
    await flush();

    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("gemini@example.com");
    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("Gemini");
    expect(page.querySelector("[data-cliproxy-codex-accounts]")?.textContent).not.toContain("<!DOCTYPE");
  });

  it("loads and saves agent configuration from the settings page", async () => {
    let savedBody: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" } }),
          } as Response;
        }
        if (url === "/api/llm/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                accounts: [
                  {
                    name: "gemini.json",
                    provider: "gemini-cli",
                    email: "gemini@example.com",
                    enabled: true,
                  },
                ],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts/models?name=gemini.json") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                models: [{ id: "gemini-2.5-pro" }, { id: "gemini-2.5-flash" }],
              },
            }),
          } as Response;
        }
        if (url === "/api/app-config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "agents/agents.json",
                defaultAppId: "writer",
                apps: [{
                  id: "writer",
                  name: "鍐欎綔 Agent",
                  purpose: "draft notes",
                  provider: "openai",
                  accountRef: "",
                  model: "gpt-5-codex",
                  workflow: "璇诲彇璧勬枡\n鐢熸垚鑽夌",
                  prompt: "淇濇寔缁撴瀯娓呮櫚",
                  enabled: true,
                  updatedAt: "2026-04-23T00:00:00.000Z",
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/app-config" && init?.method === "PUT") {
          savedBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({ success: true, data: { ...(savedBody as object), path: "agents/agents.json" } }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"app-config\"]")?.click();
    await flush();
    expect(page.querySelector("[data-settings-panel=\"app-config\"]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-agent-config-list]")?.textContent).toContain("鍐欎綔 Agent");
    expect((page.querySelector("[data-agent-config-field=\"model\"]") as HTMLSelectElement).value).toBe("gpt-5-codex");

    (page.querySelector("[data-agent-config-field=\"purpose\"]") as HTMLInputElement).value = "draft long article";
    page.querySelector<HTMLInputElement>("[data-agent-config-field=\"purpose\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-agent-config-field=\"provider\"]") as HTMLSelectElement).value = "gemini";
    page.querySelector<HTMLSelectElement>("[data-agent-config-field=\"provider\"]")?.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    const accountSelect = page.querySelector<HTMLSelectElement>("[data-agent-config-field=\"accountRef\"]");
    if (!accountSelect) throw new Error("Agent account select missing");
    expect(accountSelect.textContent).toContain("gemini@example.com");
    accountSelect.value = "oauth:gemini-cli:gemini.json";
    accountSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    (page.querySelector("[data-agent-config-field=\"model\"]") as HTMLSelectElement).value = "gemini-2.5-pro";
    (page.querySelector("[data-agent-config-field=\"workflow\"]") as HTMLTextAreaElement).value = "understand task`nread context`ngenerate draft";
    page.querySelector<HTMLTextAreaElement>("[data-agent-config-field=\"workflow\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-agent-config-field=\"prompt\"]") as HTMLTextAreaElement).value = "keep structure clear and explain verification";
    page.querySelector<HTMLTextAreaElement>("[data-agent-config-field=\"prompt\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-agent-config-save]")?.click();
    await flush();

    expect(fetch).toHaveBeenCalledWith(
      "/api/app-config",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(savedBody).toMatchObject({
      defaultAppId: "writer",
      apps: [
        expect.objectContaining({
          id: "writer",
          purpose: "draft long article",
          provider: "gemini",
          accountRef: "oauth:gemini-cli:gemini.json",
          model: "gemini-2.5-pro",
          workflow: "understand task`nread context`ngenerate draft",
          prompt: "keep structure clear and explain verification",
        }),
      ],
    });
    expect((page.querySelector("[data-agent-config-field=\"provider\"]") as HTMLSelectElement).value).toBe("gemini");
    expect((page.querySelector("[data-agent-config-field=\"accountRef\"]") as HTMLSelectElement).value).toBe("oauth:gemini-cli:gemini.json");
    expect((page.querySelector("[data-agent-config-field=\"model\"]") as HTMLSelectElement).value).toBe("gemini-2.5-pro");
    expect((page.querySelector("[data-agent-config-field=\"workflow\"]") as HTMLTextAreaElement).value).toBe("understand task`nread context`ngenerate draft");
    expect((page.querySelector("[data-agent-config-field=\"prompt\"]") as HTMLTextAreaElement).value).toBe("keep structure clear and explain verification");
    expect(page.querySelector("[data-agent-config-status]")?.textContent).toContain("agents/agents.json");
  });

  it("loads and saves automation configuration from the settings page", async () => {
    let savedBody: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" } }),
          } as Response;
        }
        if (url === "/api/llm/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/app-config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "agents/agents.json",
                defaultAppId: "writer",
                apps: [{
                  id: "writer",
                  name: "Writer App",
                  mode: "chat",
                  purpose: "draft articles",
                  provider: "openai",
                  accountRef: "",
                  model: "gpt-5-codex",
                  workflow: "",
                  prompt: "",
                  enabled: true,
                  updatedAt: "2026-04-25T00:00:00.000Z",
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/automations" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "automations/automations.json",
                automations: [{
                  id: "daily-sync",
                  name: "Daily Sync",
                  summary: "Sync yesterday content.",
                  icon: "calendar",
                  trigger: "schedule",
                  appId: "writer",
                  enabled: true,
                  schedule: "0 9 * * *",
                  webhookPath: "",
                  updatedAt: "2026-04-25T00:00:00.000Z",
                  flow: {
                    nodes: [
                      {
                        id: "trigger-daily-sync",
                        type: "trigger",
                        title: "Daily trigger",
                        description: "Runs at 09:00.",
                        modelMode: "default",
                      },
                      {
                        id: "action-daily-sync",
                        type: "action",
                        title: "Sync content",
                        description: "Calls writer app.",
                        appId: "writer",
                        modelMode: "default",
                      },
                    ],
                    edges: [
                      { id: "edge-daily-sync", source: "trigger-daily-sync", target: "action-daily-sync" },
                    ],
                    branches: [],
                  },
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/automations" && init?.method === "PUT") {
          savedBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({ success: true, data: { ...(savedBody as object), path: "automations/automations.json" } }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"automation\"]")?.click();
    await flush();

    expect(page.querySelector("[data-settings-panel=\"automation\"]")?.hasAttribute("hidden")).toBe(false);
    expect((page.querySelector("[data-automation-config-field=\"id\"]") as HTMLInputElement).value).toBe("daily-sync");
    expect((page.querySelector("[data-automation-config-field=\"name\"]") as HTMLInputElement).value).toBe("Daily Sync");
    expect((page.querySelector("[data-automation-config-field=\"summary\"]") as HTMLInputElement).value).toBe("Sync yesterday content.");
    expect((page.querySelector("[data-automation-config-field=\"icon\"]") as HTMLInputElement).value).toBe("calendar");
    expect((page.querySelector("[data-automation-config-field=\"appId\"]") as HTMLSelectElement).value).toBe("writer");
    expect((page.querySelector("[data-automation-config-field=\"trigger\"]") as HTMLSelectElement).value).toBe("schedule");
    expect((page.querySelector("[data-automation-config-field=\"schedule\"]") as HTMLInputElement).value).toBe("0 9 * * *");
    expect((page.querySelector("[data-automation-config-field=\"webhookPath\"]") as HTMLInputElement).value).toBe("");
    expect((page.querySelector("[data-automation-config-field=\"enabled\"]") as HTMLInputElement).checked).toBe(true);
    expect((page.querySelector("[data-automation-config-field=\"flow\"]") as HTMLTextAreaElement).value).toContain("\"trigger-daily-sync\"");

    (page.querySelector("[data-automation-config-field=\"name\"]") as HTMLInputElement).value = "Publish Hook";
    page.querySelector<HTMLInputElement>("[data-automation-config-field=\"name\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-automation-config-field=\"summary\"]") as HTMLInputElement).value = "Runs after publish webhook.";
    page.querySelector<HTMLInputElement>("[data-automation-config-field=\"summary\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-automation-config-field=\"icon\"]") as HTMLInputElement).value = "rocket";
    page.querySelector<HTMLInputElement>("[data-automation-config-field=\"icon\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-automation-config-field=\"trigger\"]") as HTMLSelectElement).value = "webhook";
    page.querySelector<HTMLSelectElement>("[data-automation-config-field=\"trigger\"]")?.dispatchEvent(new Event("change", { bubbles: true }));
    (page.querySelector("[data-automation-config-field=\"schedule\"]") as HTMLInputElement).value = "0 18 * * 1-5";
    page.querySelector<HTMLInputElement>("[data-automation-config-field=\"schedule\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-automation-config-field=\"webhookPath\"]") as HTMLInputElement).value = "/hooks/publish";
    page.querySelector<HTMLInputElement>("[data-automation-config-field=\"webhookPath\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-automation-config-field=\"flow\"]") as HTMLTextAreaElement).value = JSON.stringify({
      nodes: [
        {
          id: "trigger-publish-hook",
          type: "trigger",
          title: "Publish webhook",
          description: "Receives webhook.",
          modelMode: "default",
        },
        {
          id: "action-publish-hook",
          type: "action",
          title: "Writer app",
          description: "Calls writer app.",
          appId: "writer",
          modelMode: "default",
        },
      ],
      edges: [
        { id: "edge-publish-hook", source: "trigger-publish-hook", target: "action-publish-hook" },
      ],
      branches: [],
    }, null, 2);
    page.querySelector<HTMLTextAreaElement>("[data-automation-config-field=\"flow\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-automation-config-field=\"enabled\"]") as HTMLInputElement).checked = false;
    page.querySelector<HTMLInputElement>("[data-automation-config-field=\"enabled\"]")?.dispatchEvent(new Event("change", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-automation-config-save]")?.click();
    await flush();

    expect(fetch).toHaveBeenCalledWith(
      "/api/automations",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(savedBody).toMatchObject({
      automations: [
        expect.objectContaining({
          id: "daily-sync",
          name: "Publish Hook",
          summary: "Runs after publish webhook.",
          icon: "rocket",
          trigger: "webhook",
          appId: "writer",
          schedule: "0 18 * * 1-5",
          webhookPath: "/hooks/publish",
          enabled: false,
          flow: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "trigger-publish-hook", type: "trigger" }),
            ]),
          }),
        }),
      ],
    });
    expect(page.querySelector("[data-automation-config-status]")?.textContent).toContain("automations/automations.json");
  });

  it("does not overwrite edited agent fields when account options finish loading late", async () => {
    let savedBody: unknown = null;
    let resolveAccounts: ((value: Response) => void) | null = null;
    const delayedAccounts = new Promise<Response>((resolve) => {
      resolveAccounts = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" } }),
          } as Response;
        }
        if (url === "/api/llm/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return delayedAccounts;
        }
        if (url === "/api/cliproxy/accounts/models?name=codex.json") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { models: [{ id: "gpt-5-codex" }, { id: "gpt-4.1" }] } }),
          } as Response;
        }
        if (url === "/api/app-config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "agents/agents.json",
                defaultAppId: "wiki-general",
                apps: [{
                  id: "wiki-general",
                  name: "Wiki 閫氱敤鍔╂墜",
                  purpose: "澶勭悊 Wiki 椤甸潰銆佽祫鏂欐暣鐞嗐€佷唬鐮佷笌鏂囦欢浠诲姟",
                  provider: "openai",
                  accountRef: "",
                  model: "",
                  workflow: "default workflow",
                  prompt: "榛樿 Prompt",
                  enabled: true,
                  updatedAt: "2026-04-23T00:00:00.000Z",
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/app-config" && init?.method === "PUT") {
          savedBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({ success: true, data: { ...(savedBody as object), path: "agents/agents.json" } }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"app-config\"]")?.click();
    await flush();

    (page.querySelector("[data-agent-config-field=\"provider\"]") as HTMLSelectElement).value = "codex-cli";
    page.querySelector<HTMLSelectElement>("[data-agent-config-field=\"provider\"]")?.dispatchEvent(new Event("change", { bubbles: true }));
    (page.querySelector("[data-agent-config-field=\"workflow\"]") as HTMLTextAreaElement).value = "鐞嗚В浠诲姟\n璇诲彇涓婁笅鏂嘰n鍥炲啓缁撴灉";
    page.querySelector<HTMLTextAreaElement>("[data-agent-config-field=\"workflow\"]")?.dispatchEvent(new Event("input", { bubbles: true }));
    (page.querySelector("[data-agent-config-field=\"prompt\"]") as HTMLTextAreaElement).value = "涓嶈鎭㈠榛樿 Prompt";
    page.querySelector<HTMLTextAreaElement>("[data-agent-config-field=\"prompt\"]")?.dispatchEvent(new Event("input", { bubbles: true }));

    resolveAccounts?.({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          accounts: [{
            name: "codex.json",
            provider: "codex",
            email: "xiaosong123413@gmail.com",
            enabled: true,
          }],
        },
      }),
    } as Response);
    await flush();

    const accountSelect = page.querySelector<HTMLSelectElement>("[data-agent-config-field=\"accountRef\"]");
    if (!accountSelect) throw new Error("Agent account select missing");
    accountSelect.value = "oauth:codex:codex.json";
    accountSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    (page.querySelector("[data-agent-config-field=\"model\"]") as HTMLSelectElement).value = "gpt-5-codex";
    page.querySelector<HTMLButtonElement>("[data-agent-config-save]")?.click();
    await flush();

    expect(savedBody).toMatchObject({
      defaultAppId: "wiki-general",
      apps: [
        expect.objectContaining({
          id: "wiki-general",
          provider: "codex-cli",
          accountRef: "oauth:codex:codex.json",
          model: "gpt-5-codex",
          workflow: "鐞嗚В浠诲姟\n璇诲彇涓婁笅鏂嘰n鍥炲啓缁撴灉",
          prompt: "涓嶈鎭㈠榛樿 Prompt",
        }),
      ],
    });
    expect((page.querySelector("[data-agent-config-field=\"provider\"]") as HTMLSelectElement).value).toBe("codex-cli");
    expect((page.querySelector("[data-agent-config-field=\"accountRef\"]") as HTMLSelectElement).value).toBe("oauth:codex:codex.json");
    expect((page.querySelector("[data-agent-config-field=\"model\"]") as HTMLSelectElement).value).toBe("gpt-5-codex");
    expect((page.querySelector("[data-agent-config-field=\"workflow\"]") as HTMLTextAreaElement).value).toBe("鐞嗚В浠诲姟\n璇诲彇涓婁笅鏂嘰n鍥炲啓缁撴灉");
    expect((page.querySelector("[data-agent-config-field=\"prompt\"]") as HTMLTextAreaElement).value).toBe("涓嶈鎭㈠榛樿 Prompt");
  });

  it("shows relay api accounts in agent account source and preselects the only matching relay account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" } }),
          } as Response;
        }
        if (url === "/api/llm/accounts") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                accounts: [{
                  id: "relay:small-horse",
                  name: "灏忛┈涓浆",
                  provider: "relay",
                  url: "https://xiaoma.best",
                  keyConfigured: true,
                  model: "gpt-4o-mini",
                  enabled: true,
                  updatedAt: "2026-04-24T03:31:27.859Z",
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                accounts: [{
                  name: "codex.json",
                  provider: "codex",
                  email: "xiaosong123413@gmail.com",
                  enabled: true,
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/app-config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "agents/agents.json",
                defaultAppId: "wiki-general",
                apps: [{
                  id: "wiki-general",
                  name: "Wiki Agent",
                  purpose: "relay agent",
                  provider: "relay",
                  accountRef: "",
                  model: "",
                  workflow: "",
                  prompt: "",
                  enabled: true,
                  updatedAt: "2026-04-24T00:00:00.000Z",
                }],
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"app-config\"]")?.click();
    await flush();
    await flush();

    const accountSelect = page.querySelector<HTMLSelectElement>("[data-agent-config-field=\"accountRef\"]");
    const modelSelect = page.querySelector<HTMLSelectElement>("[data-agent-config-field=\"model\"]");
    expect(accountSelect?.textContent).toContain("灏忛┈涓浆");
    expect(accountSelect?.textContent).toContain("xiaosong123413@gmail.com");
    expect(accountSelect?.value).toBe("api:relay:small-horse");
    expect(modelSelect?.value).toBe("gpt-4o-mini");
  });

  it("saves the agent currently shown in the editor instead of a stale active id", async () => {
    let savedBody: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/llm/config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" } }),
          } as Response;
        }
        if (url === "/api/llm/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/app-config" && !init?.method) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                path: "agents/agents.json",
                defaultAppId: "draft-agent",
                apps: [
                  {
                    id: "wiki-general",
                    name: "Wiki 閫氱敤鍔╂墜",
                    purpose: "澶勭悊 Wiki 椤甸潰銆佽祫鏂欐暣鐞嗐€佷唬鐮佷笌鏂囦欢浠诲姟",
                    provider: "openai",
                    accountRef: "",
                    model: "",
                    workflow: "default workflow",
                    prompt: "榛樿 Prompt",
                    enabled: true,
                    updatedAt: "2026-04-23T00:00:00.000Z",
                  },
                  {
                    id: "draft-agent",
                    name: "鏂?Agent",
                    purpose: "",
                    provider: "openai",
                    accountRef: "",
                    model: "",
                    workflow: "",
                    prompt: "",
                    enabled: true,
                    updatedAt: "2026-04-23T00:00:00.000Z",
                  },
                ],
              },
            }),
          } as Response;
        }
        if (url === "/api/app-config" && init?.method === "PUT") {
          savedBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({ success: true, data: { ...(savedBody as object), path: "agents/agents.json" } }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"app-config\"]")?.click();
    await flush();

    (page.querySelector("[data-agent-config-field=\"id\"]") as HTMLInputElement).value = "wiki-general";
    (page.querySelector("[data-agent-config-field=\"provider\"]") as HTMLSelectElement).value = "codex-cli";
    (page.querySelector("[data-agent-config-field=\"model\"]") as HTMLSelectElement).value = "gpt-5-codex";
    (page.querySelector("[data-agent-config-field=\"workflow\"]") as HTMLTextAreaElement).value = "褰撳墠缂栬緫鍣ㄥ伐浣滄祦";
    (page.querySelector("[data-agent-config-field=\"prompt\"]") as HTMLTextAreaElement).value = "褰撳墠缂栬緫鍣?Prompt";
    page.querySelector<HTMLButtonElement>("[data-agent-config-save]")?.click();
    await flush();

    expect(savedBody).toMatchObject({
      defaultAppId: "wiki-general",
      apps: [
        expect.objectContaining({
          id: "wiki-general",
          provider: "codex-cli",
          model: "gpt-5-codex",
          workflow: "褰撳墠缂栬緫鍣ㄥ伐浣滄祦",
          prompt: "褰撳墠缂栬緫鍣?Prompt",
        }),
        expect.objectContaining({
          id: "draft-agent",
          provider: "openai",
        }),
      ],
    });
  });

  it("refreshes relay balance and Codex CLI status from provider APIs", async () => {
    let relayRequestBody: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/providers/relay/balance") {
          relayRequestBody = JSON.parse(String(init?.body));
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                ok: true,
                currentBalance: "$17.41",
                usedBalance: "$23.59",
                message: "ok",
              },
            }),
          } as Response;
        }
        if (url === "/api/providers/codex-cli/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                ok: true,
                installed: true,
                version: "codex-cli 1.2.3",
                balance: null,
                message: "Codex CLI available; no stable balance command.",
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();

    (page.querySelector("[data-provider=\"relay:balanceUrl\"]") as HTMLInputElement).value = "https://relay.example.com/balance";
    (page.querySelector("[data-provider=\"relay:key\"]") as HTMLInputElement).value = "sk-relay";
    (page.querySelector("[data-provider=\"relay:balancePath\"]") as HTMLInputElement).value = "data.balance";
    (page.querySelector("[data-provider=\"relay:usedPath\"]") as HTMLInputElement).value = "data.used";

    const relayRefresh = page.querySelector<HTMLButtonElement>("[data-relay-balance-refresh]");
    expect(relayRefresh).not.toBeNull();
    page.querySelector<HTMLButtonElement>("[data-provider-toggle=\"relay\"]")?.click();
    relayRefresh?.click();
    await flush();
    await flush();

    expect(fetch).toHaveBeenCalledWith(
      "/api/providers/relay/balance",
      expect.objectContaining({ method: "POST" }),
    );
    expect(relayRequestBody).toEqual({
      url: "https://relay.example.com/balance",
      key: "sk-relay",
      balancePath: "data.balance",
      usedPath: "data.used",
    });
    expect(page.querySelector("[data-relay-balance-current]")?.textContent).toContain("$17.41");
    expect(page.querySelector("[data-relay-balance-used]")?.textContent).toContain("$23.59");

    const codexRefresh = page.querySelector<HTMLButtonElement>("[data-codex-cli-refresh]");
    expect(codexRefresh).not.toBeNull();
    page.querySelector<HTMLButtonElement>("[data-provider-toggle=\"codex-cli\"]")?.click();
    codexRefresh?.click();
    await flush();
    await flush();

    expect(page.querySelector("[data-codex-cli-status]")?.textContent).toContain("codex-cli 1.2.3");
    expect(page.querySelector("[data-codex-cli-balance]")?.textContent).toContain("no stable balance command");
  });

  it("loads workspace sync config through the desktop bridge and saves the updated paths", async () => {
    const saveDesktopConfig = vi.fn(async () => ({ targetVault: "D:/Desktop/target" }));
    const saveAppConfig = vi.fn(async (payload: unknown) => payload);
    Object.defineProperty(window, "llmWikiDesktop", {
      value: {
        getAppBootstrap: vi.fn(async () => ({
          desktopConfig: { targetVault: "D:/Desktop/target" },
          appConfig: {
            targetRepoPath: "D:/Desktop/target",
            sourceFolders: ["D:/Desktop/source-a", "D:/Desktop/source-b"],
          },
        })),
        chooseTargetVault: vi.fn(async () => "D:/Desktop/target-2"),
        chooseSourceFolders: vi.fn(async () => ["D:/Desktop/source-c"]),
        saveDesktopConfig,
        saveAppConfig,
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: null, progress: 0, status: "idle", message: "not started", hasCookie: false }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"workspace-sync\"]")?.click();
    await flush();
    expect((page.querySelector("[data-sync-target-input]") as HTMLInputElement).value).toBe("D:/Desktop/target");
    expect(page.querySelector("[data-sync-source-paths]")?.textContent).toContain("D:/Desktop/source-a");
    expect(page.querySelector("[data-sync-source-paths]")?.textContent).toContain("D:/Desktop/source-b");

    page.querySelector<HTMLButtonElement>("[data-sync-target-pick]")?.click();
    await flush();
    expect((page.querySelector("[data-sync-target-input]") as HTMLInputElement).value).toBe("D:/Desktop/target-2");

    page.querySelector<HTMLButtonElement>("[data-sync-source-pick]")?.click();
    await flush();
    expect(page.querySelector("[data-sync-source-paths]")?.textContent).toContain("D:/Desktop/source-c");

    page.querySelector<HTMLButtonElement>("[data-sync-remove-source=\"D:/Desktop/source-a\"]")?.click();
    await flush();
    expect(page.querySelector("[data-sync-source-paths]")?.textContent).not.toContain("D:/Desktop/source-a");

    page.querySelector<HTMLButtonElement>("[data-sync-config-save]")?.click();
    await flush();
    expect(saveDesktopConfig).toHaveBeenCalledWith("D:/Desktop/target-2");
    expect(saveAppConfig).toHaveBeenCalledWith({
      targetRepoPath: "D:/Desktop/target-2",
      sourceFolders: ["D:/Desktop/source-b", "D:/Desktop/source-c"],
    });
  });

  it("opens the xiaohongshu modal and saves cookie while polling import progress", async () => {
    const calls: string[] = [];
    const chooseTargetVault = vi.fn(async () => "D:/Desktop/xhs-import");
    Object.defineProperty(window, "llmWikiDesktop", {
      value: {
        chooseTargetVault,
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                local: { configured: true },
                web: { configured: false, endpointHost: null },
              },
            }),
          } as Response;
        }
        if (url === "/api/sync/config") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                targetRepoPath: "D:/Desktop/target",
                sourceRepoPaths: ["D:/Desktop/target/raw"],
              },
            }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              taskId: null,
              progress: 0,
              status: "idle",
              message: "not started",
              hasCookie: false,
              importDirPath: "D:/Desktop/xhs-import-current",
            }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/config") {
          if (!init?.method || init.method === "GET") {
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: {
                  importDirPath: "D:/Desktop/xhs-import-current",
                },
              }),
            } as Response;
          }
          if (init.method === "POST") {
            return {
              ok: true,
              json: async () => ({
                success: true,
                message: "瀵煎叆鏂囦欢澶瑰凡淇濆瓨",
                data: {
                  importDirPath: "D:/Desktop/xhs-import",
                },
              }),
            } as Response;
          }
          if (init.method === "DELETE") {
            return {
              ok: true,
              json: async () => ({
                success: true,
                message: "瀵煎叆鏂囦欢澶瑰凡鍒犻櫎",
              }),
            } as Response;
          }
        }
        if (url === "/api/import/xiaohongshu/cookie" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, message: "cookie 淇濆瓨鎴愬姛" }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/start" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: "task-xhs-1" }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress?taskId=task-xhs-1") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              taskId: "task-xhs-1",
              progress: 100,
              status: "success",
              message: "瀵煎叆鐜宸插氨缁紝鍙互寮€濮嬪皬绾功瀵煎叆",
              hasCookie: true,
              importDirPath: "D:/Desktop/xhs-import",
            }),
          } as Response;
        }
        if (url === "/api/xhs-sync/favorites" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                status: "completed",
                scanned: 3,
                skipped: 1,
                queued: 2,
                message: "detected 3 links, skipped 1 already synced, synced 2 / 2",
                progress: { current: 2, total: 2, percent: 100 },
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"workspace-sync\"]")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-import-source=\"xiaohongshu\"]")?.click();
    await flush();
    expect(page.querySelector("[data-xhs-import-modal]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-xhs-import-status]")?.textContent).toContain("not started");
    expect((page.querySelector("[data-xhs-import-dir-input]") as HTMLInputElement).value).toBe("D:/Desktop/xhs-import-current");

    page.querySelector<HTMLButtonElement>("[data-xhs-import-dir-pick]")?.click();
    await flush();
    expect(chooseTargetVault).toHaveBeenCalled();
    expect((page.querySelector("[data-xhs-import-dir-input]") as HTMLInputElement).value).toBe("D:/Desktop/xhs-import");

    page.querySelector<HTMLButtonElement>("[data-xhs-import-dir-save]")?.click();
    await flush();
    expect(calls).toContain("POST /api/import/xiaohongshu/config");

    page.querySelector<HTMLTextAreaElement>("[data-xhs-cookie-input]")!.value = "a=1; web_session=2";
    page.querySelector<HTMLButtonElement>("[data-xhs-cookie-save]")?.click();
    await flush();
    await flush();

    expect(calls).toContain("POST /api/import/xiaohongshu/cookie");
    expect(calls).toContain("POST /api/import/xiaohongshu/start");
    expect(calls).toContain("GET /api/import/xiaohongshu/progress?taskId=task-xhs-1");
    expect(page.querySelector<HTMLElement>("[data-xhs-import-progress]")?.style.width).toBe("100%");
    expect(page.querySelector("[data-xhs-import-status]")?.textContent?.trim()).not.toBe("");

    page.querySelector<HTMLButtonElement>("[data-xhs-import-sync]")?.click();
    await flush();
    expect(calls).toContain("POST /api/xhs-sync/favorites");
    expect(page.querySelector("[data-xhs-import-status]")?.textContent).toContain("skipped 1");

    page.querySelector<HTMLButtonElement>("[data-xhs-import-dir-clear]")?.click();
    await flush();
    expect(calls).toContain("DELETE /api/import/xiaohongshu/config");
    expect((page.querySelector("[data-xhs-import-dir-input]") as HTMLInputElement).value).toBe("");
  });

  it("imports xiaohongshu cookie from the desktop browser session", async () => {
    const calls: string[] = [];
    const openXiaohongshuLogin = vi.fn(async () => ({
      ok: true,
      message: "opened xiaohongshu login window",
    }));
    const importXiaohongshuCookie = vi.fn(async () => ({
      ok: true,
      cookie: "web_session=desktop-cookie; a=1",
      count: 2,
      message: "read 2 xiaohongshu cookies",
    }));
    Object.defineProperty(window, "llmWikiDesktop", {
      value: {
        openXiaohongshuLogin,
        importXiaohongshuCookie,
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/llm/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" } }),
          } as Response;
        }
        if (url === "/api/llm/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { accounts: [] } }),
          } as Response;
        }
        if (url === "/api/sync/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { targetRepoPath: "", sourceRepoPaths: [] } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { importDirPath: "" } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: null, progress: 0, status: "idle", message: "not started", hasCookie: false, importDirPath: "" }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/cookie" && init?.method === "POST") {
          expect(String(init.body)).toContain("desktop-cookie");
          return {
            ok: true,
            json: async () => ({ success: true, message: "cookie 淇濆瓨鎴愬姛" }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/start" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: "task-xhs-cookie" }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress?taskId=task-xhs-cookie") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: "task-xhs-cookie", progress: 100, status: "success", message: "瀵煎叆瀹屾垚", hasCookie: true, importDirPath: "" }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"workspace-sync\"]")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-import-source=\"xiaohongshu\"]")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-xhs-login-open]")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-xhs-cookie-import]")?.click();
    await flush();
    await flush();

    expect(openXiaohongshuLogin).toHaveBeenCalledOnce();
    expect(importXiaohongshuCookie).toHaveBeenCalledOnce();
    expect((page.querySelector("[data-xhs-cookie-input]") as HTMLTextAreaElement).value).toContain("desktop-cookie");
    expect(calls).toContain("POST /api/import/xiaohongshu/cookie");
    expect(calls).toContain("POST /api/import/xiaohongshu/start");
  });

  it("syncs xiaohongshu favorites through the desktop browser bridge before batch import", async () => {
    const calls: string[] = [];
    const fetchXiaohongshuFavorites = vi.fn(async () => ({
      ok: true,
      urls: [
        "https://www.xiaohongshu.com/explore/64f000000000000001234567?xsec_token=token-a",
        "https://www.xiaohongshu.com/explore/64f000000000000007654321?xsec_token=token-b",
      ],
      count: 2,
      message: "read 2 xiaohongshu favorites",
    }));
    Object.defineProperty(window, "llmWikiDesktop", {
      value: {
        fetchXiaohongshuFavorites,
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/sync/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { targetRepoPath: "", sourceRepoPaths: [] } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { importDirPath: "D:/Desktop/xhs-import" } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: null, progress: 0, status: "idle", message: "not started", hasCookie: true, importDirPath: "D:/Desktop/xhs-import" }),
          } as Response;
        }
        if (url === "/api/xhs-sync/batch" && init?.method === "POST") {
          expect(String(init.body)).toContain("64f000000000000001234567");
          expect(String(init.body)).toContain("64f000000000000007654321");
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                status: "completed",
                queued: 2,
                skipped: 0,
                message: "synced 2 favorites",
                progress: { current: 2, total: 2, percent: 100 },
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"workspace-sync\"]")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-import-source=\"xiaohongshu\"]")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-xhs-import-sync]")?.click();
    await flush();
    await flush();

    expect(fetchXiaohongshuFavorites).toHaveBeenCalledOnce();
    expect(calls).toContain("POST /api/xhs-sync/batch");
    expect(calls).not.toContain("POST /api/xhs-sync/favorites");
    expect(page.textContent).toContain("synced 2 favorites");
  });

  it("keeps the selected xiaohongshu import folder when progress has no saved path yet", async () => {
    const chooseTargetVault = vi.fn(async () => "D:/Desktop/new-xhs-import");
    Object.defineProperty(window, "llmWikiDesktop", {
      value: {
        chooseTargetVault,
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/sync/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { targetRepoPath: "", sourceRepoPaths: [] } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { importDirPath: "" } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: null, progress: 0, status: "idle", message: "not started", hasCookie: false, importDirPath: "" }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"workspace-sync\"]")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-import-source=\"xiaohongshu\"]")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-xhs-import-dir-pick]")?.click();
    await flush();

    expect((page.querySelector("[data-xhs-import-dir-input]") as HTMLInputElement).value).toBe("D:/Desktop/new-xhs-import");
  });

  it("keeps pasted xiaohongshu cookie when the modal is reopened", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/sync/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { targetRepoPath: "", sourceRepoPaths: [] } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { importDirPath: "" } }),
          } as Response;
        }
        if (url === "/api/import/xiaohongshu/progress") {
          return {
            ok: true,
            json: async () => ({ success: true, taskId: null, progress: 0, status: "idle", message: "not started", hasCookie: false, importDirPath: "" }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"workspace-sync\"]")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-import-source=\"xiaohongshu\"]")?.click();
    await flush();

    const cookieInput = page.querySelector<HTMLTextAreaElement>("[data-xhs-cookie-input]")!;
    cookieInput.value = "web_session=keep-me";
    cookieInput.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-xhs-import-close]")?.click();
    page.querySelector<HTMLButtonElement>("[data-import-source=\"xiaohongshu\"]")?.click();
    await flush();

    expect((page.querySelector("[data-xhs-cookie-input]") as HTMLTextAreaElement).value).toBe("web_session=keep-me");
  });

  it("imports douyin cookie from the desktop browser session and saves it to project fallback", async () => {
    const calls: string[] = [];
    const openDouyinLogin = vi.fn(async () => ({
      ok: true,
      message: "opened douyin login window",
    }));
    const importDouyinCookie = vi.fn(async () => ({
      ok: true,
      cookie: "sessionid_ss=douyin-cookie; uid_tt=1",
      count: 2,
      message: "read 2 douyin cookies",
    }));
    Object.defineProperty(window, "llmWikiDesktop", {
      value: {
        openDouyinLogin,
        importDouyinCookie,
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/search/status") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { local: { configured: true }, web: { configured: false, endpointHost: null } } }),
          } as Response;
        }
        if (url === "/api/sync/config") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { targetRepoPath: "", sourceRepoPaths: [] } }),
          } as Response;
        }
        if (url === "/api/import/douyin/cookie" && (!init?.method || init.method === "GET")) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { hasCookie: false, path: "D:/Desktop/project/.llmwiki/douyin-cookie.txt" } }),
          } as Response;
        }
        if (url === "/api/import/douyin/cookie" && init?.method === "POST") {
          expect(String(init.body)).toContain("douyin-cookie");
          return {
            ok: true,
            json: async () => ({
              success: true,
              message: "douyin cookie saved",
              data: { hasCookie: true, path: "D:/Desktop/project/.llmwiki/douyin-cookie.txt" },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage();
    document.body.appendChild(page);
    await flush();
    page.querySelector<HTMLButtonElement>("[data-settings-nav=\"workspace-sync\"]")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-import-source=\"douyin\"]")?.click();
    await flush();

    expect(page.querySelector("[data-douyin-cookie-modal]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-douyin-cookie-status]")?.textContent).toContain("fallback cookie");

    page.querySelector<HTMLButtonElement>("[data-douyin-login-open]")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-douyin-cookie-import]")?.click();
    await flush();
    await flush();

    expect(openDouyinLogin).toHaveBeenCalledOnce();
    expect(importDouyinCookie).toHaveBeenCalledOnce();
    expect((page.querySelector("[data-douyin-cookie-input]") as HTMLTextAreaElement).value).toContain("douyin-cookie");
    expect(calls).toContain("GET /api/import/douyin/cookie");
    expect(calls).toContain("POST /api/import/douyin/cookie");
    expect(page.querySelector("[data-douyin-cookie-light]")?.textContent).toContain("保存");
    expect(page.querySelector("[data-douyin-cookie-path]")?.textContent).toContain("douyin-cookie.txt");
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}


