// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderSettingsPage } from "../web/client/src/pages/settings/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("settings app publish section", () => {
  it("shows the publish section inside app settings and loads remote brain status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/search/status") {
          return jsonResponse({
            success: true,
            data: {
              local: { configured: true },
              web: { configured: false, endpointHost: null },
            },
          });
        }
        if (url === "/api/llm/config" && !init?.method) {
          return jsonResponse({
            success: true,
            data: { provider: "openai", url: "", keyConfigured: false, model: "gpt-5-codex" },
          });
        }
        if (url === "/api/llm/accounts") {
          return jsonResponse({ success: true, data: { accounts: [] } });
        }
        if (url === "/api/cliproxy/accounts") {
          return jsonResponse({ success: true, data: { accounts: [] } });
        }
        if (url === "/api/app-config") {
          return jsonResponse({
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
          });
        }
        if (url === "/api/remote-brain/status") {
          return jsonResponse({
            success: true,
            data: {
              provider: "cloudflare",
              mode: "cloudflare-connected",
              connected: true,
              endpoint: "https://worker.example.com/remote-brain",
              pushSupported: true,
              pullSupported: true,
              publishSupported: true,
              cloudflare: {
                provider: "cloudflare",
                enabled: true,
                workerUrl: "https://worker.example.com",
                accountId: "acc-123",
                d1DatabaseId: "d1-123",
                r2Bucket: "wiki-bucket",
                vectorizeIndex: "wiki-index",
                tokenConfigured: true,
              },
              flashDiarySync: {
                mode: "local",
                lastSyncedAt: null,
                queueSize: 0,
              },
            },
          });
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const page = renderSettingsPage("app-config");
    document.body.appendChild(page);
    await flush();
    await flush();

    expect(page.querySelector("[data-settings-panel=\"app-config\"]")?.hasAttribute("hidden")).toBe(false);
    expect(page.querySelector("[data-app-publish-section]")).not.toBeNull();
    expect(page.textContent).toContain("应用发布");
    expect(page.querySelector("[data-publish-connection]")?.textContent).toContain("已连接");
    expect(page.querySelector("[data-publish-worker-url]")?.textContent).toContain("https://worker.example.com");
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
