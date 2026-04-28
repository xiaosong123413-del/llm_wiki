import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerLlmRoutes } from "../web/server/routes/llm.js";

const { readLlmProviderConfig, saveLlmProviderConfig, testLlmProviderConfig, readLlmApiAccounts, saveLlmApiAccount, deleteLlmApiAccount } = vi.hoisted(() => ({
  readLlmProviderConfig: vi.fn(),
  saveLlmProviderConfig: vi.fn(),
  testLlmProviderConfig: vi.fn(),
  readLlmApiAccounts: vi.fn(),
  saveLlmApiAccount: vi.fn(),
  deleteLlmApiAccount: vi.fn(),
}));

vi.mock("../web/server/services/llm-config.js", () => ({
  readLlmProviderConfig,
  saveLlmProviderConfig,
  testLlmProviderConfig,
}));

vi.mock("../web/server/services/llm-accounts.js", () => ({
  readLlmApiAccounts,
  saveLlmApiAccount,
  deleteLlmApiAccount,
}));

describe("llm routes", () => {
  beforeEach(() => {
    readLlmProviderConfig.mockReset();
    readLlmProviderConfig.mockReturnValue({
      provider: "openai",
      url: "http://127.0.0.1:8317/v1",
      keyConfigured: true,
      model: "gpt-5-codex",
    });
    saveLlmProviderConfig.mockReset();
    saveLlmProviderConfig.mockReturnValue({
      provider: "openai",
      url: "http://127.0.0.1:8317/v1",
      keyConfigured: true,
      model: "gpt-5-codex",
    });
    testLlmProviderConfig.mockReset();
    testLlmProviderConfig.mockResolvedValue({
      ok: true,
      provider: "openai",
      endpoint: "http://127.0.0.1:8317/v1/chat/completions",
      message: "ok",
    });
    readLlmApiAccounts.mockReset();
    readLlmApiAccounts.mockReturnValue({ accounts: [] });
    saveLlmApiAccount.mockReset();
    saveLlmApiAccount.mockReturnValue({
      id: "openai:main",
      name: "main",
      provider: "openai",
      url: "http://127.0.0.1:8317/v1",
      keyConfigured: true,
      model: "gpt-5-codex",
      enabled: true,
      updatedAt: "2026-04-23T00:00:00.000Z",
    });
    deleteLlmApiAccount.mockReset();
    deleteLlmApiAccount.mockReturnValue({ ok: true });
  });

  it("registers GET, PUT, and test routes for LLM config", async () => {
    const getRoutes: Array<{ path: string; handler: (req: unknown, res: { json: (body: unknown) => void }) => void }> = [];
    const putRoutes: Array<{
      path: string;
      handler: (
        req: { body?: unknown },
        res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } },
      ) => void;
    }> = [];
    const postRoutes: Array<{
      path: string;
      handler: (
        req: { body?: unknown },
        res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } },
      ) => Promise<void>;
    }> = [];
    const app = {
      get(path: string, handler: (req: unknown, res: { json: (body: unknown) => void }) => void) {
        getRoutes.push({ path, handler });
        return app;
      },
      put(
        path: string,
        handler: (
          req: { body?: unknown },
          res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } },
        ) => void,
      ) {
        putRoutes.push({ path, handler });
        return app;
      },
      post(
        path: string,
        handler: (
          req: { body?: unknown },
          res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } },
        ) => Promise<void>,
      ) {
        postRoutes.push({ path, handler });
        return app;
      },
    };

    registerLlmRoutes(app as never, { wikiRoot: "wiki", port: 4175, host: "127.0.0.1", author: "me", projectRoot: "project-root" });

    const json = vi.fn();
    getRoutes[0]?.handler({}, { json });
    expect(getRoutes[0]?.path).toBe("/api/llm/config");
    expect(readLlmProviderConfig).toHaveBeenCalledWith("project-root");
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: {
        provider: "openai",
        url: "http://127.0.0.1:8317/v1",
        keyConfigured: true,
        model: "gpt-5-codex",
      },
    });

    const status = vi.fn(() => ({ json }));
    putRoutes[0]?.handler(
      {
        body: {
          provider: "openai",
          url: "http://127.0.0.1:8317/v1",
          key: "wiki-client-key",
          model: "gpt-5-codex",
        },
      },
      { json, status },
    );
    expect(putRoutes[0]?.path).toBe("/api/llm/config");
    expect(saveLlmProviderConfig).toHaveBeenCalledWith("project-root", {
      provider: "openai",
      url: "http://127.0.0.1:8317/v1",
      key: "wiki-client-key",
      model: "gpt-5-codex",
    });

    await postRoutes[0]?.handler(
      {
        body: {
          provider: "deepseek",
          url: "https://api.deepseek.com/v1",
          key: "sk-deepseek",
          model: "deepseek-chat",
        },
      },
      { json, status },
    );
    expect(postRoutes[0]?.path).toBe("/api/llm/test");
    expect(testLlmProviderConfig).toHaveBeenCalledWith("project-root", {
      provider: "deepseek",
      url: "https://api.deepseek.com/v1",
      key: "sk-deepseek",
      model: "deepseek-chat",
    });
    expect(json).toHaveBeenLastCalledWith({
      success: true,
      data: {
        ok: true,
        provider: "openai",
        endpoint: "http://127.0.0.1:8317/v1/chat/completions",
        message: "ok",
      },
    });
  });
});
