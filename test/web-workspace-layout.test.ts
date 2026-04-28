/**
 * Verifies the workspace task-plan layout keeps the assistant cards inside the
 * stretch row and lets the task-plan shell consume the full content column.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace task-plan layout css", () => {
  it("stretches the assistant grid with the split pane and fills the task-plan content column", () => {
    const styles = readFileSync(path.join(process.cwd(), "web", "client", "styles.css"), "utf8");

    expect(styles).toMatch(
      /\.workspace-task-plan-poster__assistant\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/,
    );
    expect(styles).toMatch(
      /\.workspace-page\[data-workspace-mode="task-plan"\]\s+\.workspace-page__content\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\);[\s\S]*min-height:\s*0;/,
    );
    expect(styles).toMatch(
      /\.workspace-page\[data-workspace-mode="task-plan"\]\s+\.workspace-page__body\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\);[\s\S]*min-height:\s*0;/,
    );
  });
});
