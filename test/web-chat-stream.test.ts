import { describe, expect, it } from "vitest";
import { parseSseMessages } from "../web/client/src/pages/chat/stream.js";

describe("chat SSE parser", () => {
  it("parses complete SSE events and preserves the incomplete tail", () => {
    const input = [
      'event: token',
      'data: {"token":"Hel"}',
      '',
      'event: token',
      'data: {"token":"lo"}',
      '',
      'event: done',
      'data: {"ok":true}',
      '',
      'event: token',
      'data: {"token":"partial"}',
    ].join("\n");

    const result = parseSseMessages(input);

    expect(result.messages).toEqual([
      { event: "token", data: '{"token":"Hel"}' },
      { event: "token", data: '{"token":"lo"}' },
      { event: "done", data: '{"ok":true}' },
    ]);
    expect(result.rest).toBe('event: token\ndata: {"token":"partial"}');
  });
});
