import { describe, expect, it } from "vitest";
import { buildChatRuntimeSummary } from "../web/client/src/pages/chat/runtime.js";

describe("buildChatRuntimeSummary", () => {
  it("uses the default app when no conversation-specific app is selected", () => {
    const summary = buildChatRuntimeSummary({
      appId: null,
      defaultAppId: "writer",
      apps: [
        {
          id: "writer",
          name: "写作应用",
          mode: "chat",
          provider: "gemini",
          model: "gemini-2.5-pro",
          enabled: true,
          accountRef: "oauth:gemini-cli:gemini.json",
        },
      ],
      apiAccounts: [],
      oauthAccounts: [
        {
          provider: "gemini-cli",
          name: "gemini.json",
          email: "gemini@example.com",
          enabled: true,
        },
      ],
    });

    expect(summary).toEqual({
      appLabel: "写作应用",
      providerLabel: "Google (Gemini)",
      modelLabel: "gemini-2.5-pro",
      sourceLabel: "OAuth · Gemini CLI · gemini@example.com",
    });
  });

  it("resolves saved API accounts for the selected app", () => {
    const summary = buildChatRuntimeSummary({
      appId: "research",
      defaultAppId: "writer",
      apps: [
        {
          id: "research",
          name: "Research App",
          mode: "knowledge",
          provider: "deepseek",
          model: "",
          enabled: true,
          accountRef: "api:deepseek-work",
        },
      ],
      apiAccounts: [
        {
          id: "deepseek-work",
          name: "DeepSeek 工作号",
          provider: "deepseek",
          model: "deepseek-chat",
          enabled: true,
        },
      ],
      oauthAccounts: [],
    });

    expect(summary).toEqual({
      appLabel: "Research App",
      providerLabel: "DeepSeek",
      modelLabel: "deepseek-chat",
      sourceLabel: "API · DeepSeek · DeepSeek 工作号",
    });
  });

  it("shows an unbound state when no app is available", () => {
    const summary = buildChatRuntimeSummary({
      appId: null,
      defaultAppId: null,
      apps: [],
      apiAccounts: [],
      oauthAccounts: [],
    });

    expect(summary).toEqual({
      appLabel: "未绑定应用",
      providerLabel: "应用未配置",
      modelLabel: "请先选择应用",
      sourceLabel: "聊天必须绑定应用后才能发送",
    });
  });
});
