import {
  describe,
  expect,
  it,
} from "vitest";
import { parseHash } from "../web/client/src/router.js";

/**
 * Verifies the hash router recognizes the sources library route.
 */

describe("sources route parsing", () => {
  it("parses #/sources into the sources page route", () => {
    expect(parseHash("#/sources")).toEqual({ name: "sources", params: {} });
  });
});
