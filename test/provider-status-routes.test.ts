import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerProviderStatusRoutes } from "../web/server/routes/provider-status.js";

const hoisted = vi.hoisted(() => ({
  fetchRelayBalance: vi.fn(),
  getCodexCliStatus: vi.fn(),
}));

vi.mock("../web/server/services/provider-status.js", () => ({
  fetchRelayBalance: hoisted.fetchRelayBalance,
  getCodexCliStatus: hoisted.getCodexCliStatus,
}));

describe("provider status routes", () => {
  beforeEach(() => {
    hoisted.fetchRelayBalance.mockReset();
    hoisted.getCodexCliStatus.mockReset();
  });

  it("registers relay balance and codex cli status routes", async () => {
    hoisted.fetchRelayBalance.mockResolvedValue({
      ok: true,
      currentBalance: "$17.41",
      usedBalance: "$23.59",
      message: "ok",
    });
    hoisted.getCodexCliStatus.mockResolvedValue({
      ok: true,
      installed: true,
      version: "codex-cli 1.2.3",
      balance: null,
      message: "Codex CLI available",
    });

    const getRoutes: Array<{ path: string; handler: (req: unknown, res: { json: (body: unknown) => void }) => Promise<void> | void }> = [];
    const postRoutes: Array<{ path: string; handler: (req: unknown, res: { json: (body: unknown) => void }) => Promise<void> | void }> = [];
    const app = {
      get(path: string, handler: (req: unknown, res: { json: (body: unknown) => void }) => Promise<void> | void) {
        getRoutes.push({ path, handler });
        return app;
      },
      post(path: string, handler: (req: unknown, res: { json: (body: unknown) => void }) => Promise<void> | void) {
        postRoutes.push({ path, handler });
        return app;
      },
    };

    registerProviderStatusRoutes(app as never);

    expect(postRoutes[0]?.path).toBe("/api/providers/relay/balance");
    expect(getRoutes[0]?.path).toBe("/api/providers/codex-cli/status");

    const relayJson = vi.fn();
    await postRoutes[0]?.handler(
      {
        body: {
          url: "https://relay.example.com/balance",
          key: "sk-relay",
          balancePath: "data.balance",
          usedPath: "data.used",
        },
      },
      { json: relayJson },
    );
    expect(hoisted.fetchRelayBalance).toHaveBeenCalledWith({
      url: "https://relay.example.com/balance",
      key: "sk-relay",
      balancePath: "data.balance",
      usedPath: "data.used",
    });
    expect(relayJson).toHaveBeenCalledWith({
      success: true,
      data: {
        ok: true,
        currentBalance: "$17.41",
        usedBalance: "$23.59",
        message: "ok",
      },
    });

    const codexJson = vi.fn();
    await getRoutes[0]?.handler({}, { json: codexJson });
    expect(hoisted.getCodexCliStatus).toHaveBeenCalledOnce();
    expect(codexJson).toHaveBeenCalledWith({
      success: true,
      data: {
        ok: true,
        installed: true,
        version: "codex-cli 1.2.3",
        balance: null,
        message: "Codex CLI available",
      },
    });
  });
});
