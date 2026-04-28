import { describe, expect, it } from "vitest";
import {
  QUERY_RESULT_END_MARKER,
  QUERY_RESULT_OUTPUT_MODE,
  QUERY_RESULT_START_MARKER,
  formatGuiQueryResultBlock,
  getQueryOutputMode,
} from "../src/commands/query.js";

describe("query gui output helpers", () => {
  it("formats a query answer into a marked block for the GUI", () => {
    const answer = "第一段。\n\n第二段。";

    expect(formatGuiQueryResultBlock(answer)).toBe(
      `${QUERY_RESULT_START_MARKER}\n第一段。\n\n第二段。\n${QUERY_RESULT_END_MARKER}`,
    );
  });

  it("reads gui block mode from the environment", () => {
    expect(getQueryOutputMode({ LLMWIKI_QUERY_OUTPUT_MODE: QUERY_RESULT_OUTPUT_MODE })).toBe(
      QUERY_RESULT_OUTPUT_MODE,
    );
    expect(getQueryOutputMode({})).toBe("stream");
  });
});
