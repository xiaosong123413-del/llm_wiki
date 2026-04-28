// @vitest-environment jsdom
/**
 * Focused coverage for the CLIProxy settings helpers.
 *
 * These tests drive the extracted panel directly so fallow can see the start,
 * OAuth polling, and account-toggle branches without needing the entire
 * settings page runtime in every assertion.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  postCLIProxyAction,
  renderCLIProxyPanel,
  setCLIProxyCodexAccountEnabled,
  startCLIProxyOAuth,
  waitForCLIProxyOAuth,
} from "../web/client/src/pages/settings/cli-proxy.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (window as Window & { llmWikiDesktop?: unknown }).llmWikiDesktop;
  document.body.innerHTML = "";
});

describe("CLIProxy settings helpers", () => {
  it("posts start actions with the current proxy URL and refreshes accounts", async () => {
    const refreshOAuthAccounts = vi.fn(async () => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/cliproxy/start" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { message: "代理已启动。" } }),
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
                  enabled: true,
                }],
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const root = renderCLIProxyRoot();
    await postCLIProxyAction(root, refreshOAuthAccounts, "/api/cliproxy/start", {
      proxyUrl: "http://127.0.0.1:7890",
    });
    await flush();

    expect(fetch).toHaveBeenCalledWith(
      "/api/cliproxy/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ proxyUrl: "http://127.0.0.1:7890" }),
      }),
    );
    expect(root.querySelector("[data-cliproxy-status]")?.textContent).toContain("127.0.0.1:8317");
    expect(root.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("me@example.com");
    expect(refreshOAuthAccounts).toHaveBeenCalledWith(
      root,
      expect.arrayContaining([
        expect.objectContaining({ name: "codex.json", email: "me@example.com" }),
      ]),
    );
  });

  it("polls OAuth status until the account is ready and refreshes quota data", async () => {
    const refreshOAuthAccounts = vi.fn(async () => undefined);
    let oauthStatusCalls = 0;
    vi.useFakeTimers();
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/cliproxy/oauth" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { url: "https://auth.example.com", state: "oauth-state" },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/oauth/status?state=oauth-state") {
          oauthStatusCalls += 1;
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { status: oauthStatusCalls === 1 ? "wait" : "ok" },
            }),
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
                accounts: [{ name: "codex.json", provider: "codex", email: "me@example.com", status: "ok" }],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts" || url === "/api/cliproxy/accounts?refresh=1") {
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
                  quota: {
                    fetchedAt: "2026-04-25T00:00:00.000Z",
                    primaryWindow: { usedPercent: 20, resetsAt: "2026-04-25T06:00:00.000Z" },
                  },
                }],
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const root = renderCLIProxyRoot();
    const oauthPromise = startCLIProxyOAuth(root, refreshOAuthAccounts, "codex");
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(2000);
    await flushMicrotasks();
    await oauthPromise;

    expect(window.open).toHaveBeenCalledWith("https://auth.example.com", "_blank", "noopener");
    expect(oauthStatusCalls).toBe(2);
    expect(root.querySelector("[data-cliproxy-status]")?.textContent).toContain("Codex 剩余额度已更新");
    expect(root.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("80%");
    expect(refreshOAuthAccounts).toHaveBeenCalled();
  });

  it("surfaces OAuth status polling errors", async () => {
    const refreshOAuthAccounts = vi.fn(async () => undefined);
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/cliproxy/oauth" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { url: "https://auth.example.com/error", state: "oauth-error" },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/oauth/status?state=oauth-error") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { status: "error", error: "授权失败" },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const root = renderCLIProxyRoot();
    await startCLIProxyOAuth(root, refreshOAuthAccounts, "codex");

    expect(root.querySelector("[data-cliproxy-status]")?.textContent).toContain("授权失败");
    expect(refreshOAuthAccounts).not.toHaveBeenCalled();
  });

  it("waits for OAuth completion before hydrating refreshed accounts", async () => {
    const refreshOAuthAccounts = vi.fn(async () => undefined);
    let pollCount = 0;
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/cliproxy/oauth/status?state=oauth-wait") {
          pollCount += 1;
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { status: pollCount === 1 ? "wait" : "ok" },
            }),
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
                accounts: [{ name: "codex.json", provider: "codex", email: "me@example.com", status: "ok" }],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts" || url === "/api/cliproxy/accounts?refresh=1") {
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
                }],
              },
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const root = renderCLIProxyRoot();
    const waitPromise = waitForCLIProxyOAuth(root, refreshOAuthAccounts, "codex", "oauth-wait");
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(2000);
    await flushMicrotasks();
    await waitPromise;

    expect(pollCount).toBe(2);
    expect(root.querySelector("[data-cliproxy-status]")?.textContent).toContain("Codex 剩余额度已更新");
    expect(refreshOAuthAccounts).toHaveBeenCalled();
  });

  it("surfaces CLIProxy action failures without clearing the last status message", async () => {
    const refreshOAuthAccounts = vi.fn(async () => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/cliproxy/start" && init?.method === "POST") {
          return {
            ok: false,
            json: async () => ({ success: false, error: "启动失败" }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const root = renderCLIProxyRoot();
    await postCLIProxyAction(root, refreshOAuthAccounts, "/api/cliproxy/start", {
      proxyUrl: "http://127.0.0.1:7890",
    });

    expect(root.querySelector("[data-cliproxy-status]")?.textContent).toContain("启动失败");
    expect(refreshOAuthAccounts).not.toHaveBeenCalled();
  });

  it("shows the toggle error but still rehydrates accounts when account enabling fails", async () => {
    const refreshOAuthAccounts = vi.fn(async () => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/cliproxy/status") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                running: true,
                proxyBaseUrl: "http://127.0.0.1:8317/v1",
                config: {},
                accounts: [{ name: "codex.json", provider: "codex", email: "me@example.com", status: "ok" }],
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
                  enabled: true,
                }],
              },
            }),
          } as Response;
        }
        if (url === "/api/cliproxy/accounts/enabled" && init?.method === "POST") {
          return {
            ok: false,
            json: async () => ({ success: false, error: "切换失败" }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const root = renderCLIProxyRoot();
    await setCLIProxyCodexAccountEnabled(root, refreshOAuthAccounts, "codex.json", false);
    await flush();

    expect(root.querySelector("[data-cliproxy-status]")?.textContent).toContain("切换失败");
    expect(root.querySelector("[data-cliproxy-codex-accounts]")?.textContent).toContain("me@example.com");
    expect(refreshOAuthAccounts).toHaveBeenCalledWith(
      root,
      expect.arrayContaining([
        expect.objectContaining({ name: "codex.json" }),
      ]),
    );
  });
});

function renderCLIProxyRoot(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderCLIProxyPanel();
  const root = wrapper.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("expected CLIProxy panel root");
  }
  document.body.appendChild(root);
  return root;
}

async function flush(): Promise<void> {
  await flushMicrotasks();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}
