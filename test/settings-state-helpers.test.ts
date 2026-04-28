// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildDouyinCookieSnapshot,
  buildXiaohongshuProgressSnapshot,
  describeLlmDefaultSelection,
  resolveRenderedLlmDefaultOptions,
} from "../web/client/src/pages/settings/state-helpers.js";

describe("settings state helpers", () => {
  it("preserves the xiaohongshu import folder and cookie-derived status when progress omits them", () => {
    const snapshot = buildXiaohongshuProgressSnapshot(
      {
        cookie: "web_session=keep-me",
        importDirPath: "D:/Desktop/xhs-import",
      },
      {
        taskId: null,
        progress: 0,
        status: "error",
        message: "cookie save failed",
      },
    );

    expect(snapshot).toEqual({
      taskId: null,
      progress: 0,
      status: "error",
      message: "cookie save failed",
      hasCookie: true,
      importDirPath: "D:/Desktop/xhs-import",
    });
  });

  it("reuses the current douyin cookie metadata when only the message changes", () => {
    const snapshot = buildDouyinCookieSnapshot(
      {
        cookie: "sessionid_ss=1",
        hasCookie: true,
        path: "D:/Desktop/project/.llmwiki/douyin-cookie.txt",
      },
      {
        status: "error",
        message: "desktop bridge unavailable",
      },
    );

    expect(snapshot).toEqual({
      cookie: "sessionid_ss=1",
      status: "error",
      message: "desktop bridge unavailable",
      hasCookie: true,
      path: "D:/Desktop/project/.llmwiki/douyin-cookie.txt",
    });
  });

  it("describes oauth and saved-account default model selections", () => {
    const oauthSummary = describeLlmDefaultSelection({
      options: [{
        value: "oauth:codex:codex.json",
        label: "Codex · me@example.com",
        provider: "codex-cli",
        accountName: "me@example.com",
        source: "oauth",
      }],
      config: {
        provider: "codex-cli",
        accountRef: "oauth:codex:codex.json",
        model: "gpt-5-codex",
      },
      selectedValue: "oauth:codex:codex.json",
    });
    const savedSummary = describeLlmDefaultSelection({
      options: [],
      config: {
        provider: "openai",
        accountRef: "api:legacy:archived",
        model: "gpt-4o",
      },
      selectedValue: "api:legacy:archived",
    });

    expect(oauthSummary).toEqual({
      sourceText: "OAuth · me@example.com",
      providerId: "codex-cli",
      modelText: "gpt-5-codex",
    });
    expect(savedSummary).toEqual({
      sourceText: "已保存账号 · api:legacy:archived",
      providerId: "openai",
      modelText: "gpt-4o",
    });
  });

  it("injects a saved account option when the current selection is missing from live accounts", () => {
    const rendered = resolveRenderedLlmDefaultOptions({
      options: [],
      preferredValue: "api:legacy:archived",
      fallbackProvider: "openai",
    });

    expect(rendered.disabled).toBe(false);
    expect(rendered.selectedValue).toBe("api:legacy:archived");
    expect(rendered.options).toEqual([{
      value: "api:legacy:archived",
      label: "已保存账号 · api:legacy:archived",
      provider: "openai",
    }]);
  });
});
