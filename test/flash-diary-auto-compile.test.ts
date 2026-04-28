import { describe, expect, it } from "vitest";
import {
  markFlashDiaryAutoCompile,
  selectAutoCompileFiles,
  shouldRunFlashDiaryAutoCompile,
} from "../scripts/sync-compile/flash-diary-auto-compile.mjs";

describe("flash diary auto compile filtering", () => {
  it("keeps only yesterday's flash diary in the auto compile candidates", () => {
    const files = [
      {
        imported_filename: "flash-yesterday.md",
        source_kind: "flash",
        source_relative_path: "raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-21.md",
      },
      {
        imported_filename: "flash-today.md",
        source_kind: "flash",
        source_relative_path: "raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-22.md",
      },
      {
        imported_filename: "flash-old.md",
        source_kind: "flash",
        source_relative_path: "raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-20.md",
      },
      {
        imported_filename: "clip.md",
        source_kind: "clipping",
        source_relative_path: "raw/\u526a\u85cf/clip.md",
      },
    ];

    expect(
      selectAutoCompileFiles(files, new Set(), { now: new Date("2026-04-22T09:00:00") }),
    ).toEqual(["flash-yesterday.md", "clip.md"]);
  });

  it("skips flash diary files that already compiled", () => {
    const files = [
      {
        imported_filename: "flash-yesterday.md",
        source_kind: "flash",
        source_relative_path: "raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-21.md",
      },
      {
        imported_filename: "clip.md",
        source_kind: "clipping",
        source_relative_path: "raw/\u526a\u85cf/clip.md",
      },
    ];

    expect(
      selectAutoCompileFiles(
        files,
        new Set(["flash-yesterday.md"]),
        { now: new Date("2026-04-22T09:00:00") },
      ),
    ).toEqual(["clip.md"]);
  });

  it("does not auto compile flash diary outside the morning window", () => {
    const files = [
      {
        imported_filename: "flash-yesterday.md",
        source_kind: "flash",
        source_relative_path: "raw/\u95ea\u5ff5\u65e5\u8bb0/2026-04-21.md",
      },
      {
        imported_filename: "clip.md",
        source_kind: "clipping",
        source_relative_path: "raw/\u526a\u85cf/clip.md",
      },
    ];

    expect(
      selectAutoCompileFiles(files, new Set(), { now: new Date("2026-04-22T13:00:00") }),
    ).toEqual(["clip.md"]);
  });

  it("marks and blocks second morning auto compile on the same day", () => {
    const state = markFlashDiaryAutoCompile({}, new Date("2026-04-22T08:00:00"));
    expect(shouldRunFlashDiaryAutoCompile(new Date("2026-04-22T09:30:00"), state)).toBe(false);
  });
});
