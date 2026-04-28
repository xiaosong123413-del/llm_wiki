import { describe, expect, it, vi } from "vitest";
import { fetchRelayBalance, getCodexCliStatus } from "../web/server/services/provider-status.js";

describe("provider status services", () => {
  it("reads relay balance and used values from configured JSON paths", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          balance: 17.41,
          usage: {
            total: 23.59,
          },
        },
      }),
    })) as unknown as typeof fetch;

    const result = await fetchRelayBalance({
      url: "https://relay.example.com/api/user/self",
      key: "sk-test",
      balancePath: "data.balance",
      usedPath: "data.usage.total",
    }, fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "https://relay.example.com/api/user/self",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
    expect(result).toEqual({
      ok: true,
      currentBalance: "$17.41",
      usedBalance: "$23.59",
      message: "中转站余额读取成功。",
    });
  });

  it("returns a graceful failure when the relay responds with html instead of json", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token '<', \"<!doctype\" is not valid JSON");
      },
    })) as unknown as typeof fetch;

    const result = await fetchRelayBalance({
      url: "https://relay.example.com/api/user/self",
      key: "sk-test",
    }, fetcher);

    expect(result).toEqual({
      ok: false,
      currentBalance: null,
      usedBalance: null,
      message: "中转站余额接口返回了非 JSON 内容。",
    });
  });

  it("reports Codex CLI availability without inventing a balance value", async () => {
    const runner = vi.fn(async () => ({
      stdout: "codex-cli 1.2.3\n",
      stderr: "",
    }));

    const result = await getCodexCliStatus(runner);

    expect(runner).toHaveBeenCalledWith("codex", ["--version"]);
    expect(result).toEqual({
      ok: true,
      installed: true,
      version: "codex-cli 1.2.3",
      balance: null,
      message: "Codex CLI 可用；CLI 当前没有稳定余额查询接口。",
    });
  });
});
