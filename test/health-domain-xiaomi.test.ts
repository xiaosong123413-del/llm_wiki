/**
 * Runtime regressions for the Xiaomi Health bridge adapter.
 *
 * The bridge can print SDK debug logs to stderr even when it emits a
 * structured JSON error payload to stdout. The WebUI must preserve the JSON
 * payload so captcha challenges render inline instead of collapsing into log
 * text.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import {
  connectXiaomiHealthAccount,
  startXiaomiHealthVerification,
  XiaomiBridgeError,
} from "../web/server/services/health-domain-xiaomi.js";

const tempRoots: string[] = [];

afterEach(() => {
  execFileMock.mockReset();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("health domain xiaomi bridge", () => {
  it("prefers structured stdout captcha payloads over stderr debug logs", async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "health-domain-xiaomi-"));
    tempRoots.push(projectRoot);
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: readonly string[],
        _options: Record<string, unknown>,
        callback: (error: Error & { stdout?: string; stderr?: string } | null, stdout?: string, stderr?: string) => void,
      ) => {
        const error = new Error("bridge exited") as Error & {
          stdout?: string;
          stderr?: string;
        };
        error.stdout = JSON.stringify({
          success: false,
          error: "获取验证码前需要先完成图形验证码。",
          errorCode: "captcha_required",
          errorData: {
            captchaImageDataUrl: "data:image/png;base64,ZmFrZQ==",
          },
        });
        error.stderr = "2026-04-26 14:03:07.004 | DEBUG | 下载图形验证码: https://account.xiaomi.com/pass/getCode";
        callback(error, "", error.stderr);
      },
    );

    await expect(
      startXiaomiHealthVerification(projectRoot, {
        username: "19000000000",
      }),
    ).rejects.toEqual(
      expect.objectContaining<XiaomiBridgeError>({
        name: "XiaomiBridgeError",
        message: "获取验证码前需要先完成图形验证码。",
        code: "captcha_required",
        details: {
          captchaImageDataUrl: "data:image/png;base64,ZmFrZQ==",
        },
      }),
    );
  });

  it("passes captcha code through the connect-account bridge payload", async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "health-domain-xiaomi-"));
    tempRoots.push(projectRoot);
    execFileMock.mockImplementation(
      (
        _file: string,
        args: readonly string[],
        _options: Record<string, unknown>,
        callback: (error: Error & { stdout?: string; stderr?: string } | null, stdout?: string, stderr?: string) => void,
      ) => {
        const requestPath = String(args[2] ?? "");
        const payload = JSON.parse(fs.readFileSync(requestPath, "utf8")) as Record<string, unknown>;
        expect(payload.captchaCode).toBe("aBcD");
        const error = new Error("bridge exited") as Error & {
          stdout?: string;
          stderr?: string;
        };
        error.stdout = JSON.stringify({
          success: false,
          error: "expected bridge failure",
        });
        callback(error, "", "");
      },
    );

    await expect(
      connectXiaomiHealthAccount(projectRoot, {
        username: "19000000000",
        password: "",
        verificationCode: "123456",
        captchaCode: "aBcD",
      }),
    ).rejects.toThrow("expected bridge failure");
  });
});
