import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleProjectWorkspace, handleProjectWorkspaceDelete } from "../web/server/routes/pages.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("project workspace routes", () => {
  it("groups current workspace leftovers by project", () => {
    const root = createRepo();
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "project-log.md"), "# log\n", "utf8");
    fs.writeFileSync(path.join(root, "tracked.txt"), "base\n", "utf8");
    execFileSync("git", ["-C", root, "add", "tracked.txt"]);
    execFileSync("git", ["-C", root, "commit", "-m", "init"], {
      stdio: "ignore",
      env: gitEnv(),
    });

    fs.writeFileSync(path.join(root, "tracked.txt"), "changed\n", "utf8");
    fs.mkdirSync(path.join(root, "wiki-clone", ".next"), { recursive: true });
    fs.writeFileSync(path.join(root, "wiki-clone", ".next", "cache.txt"), "cache\n", "utf8");
    fs.writeFileSync(path.join(root, "gui-panel-state.json"), "{}", "utf8");

    const json = vi.fn();
    handleProjectWorkspace(config(root))({} as never, { json } as never);

    const payload = json.mock.calls[0]?.[0];
    expect(payload.success).toBe(true);
    expect(payload.data.groups.flatMap((group: { entries: Array<{ path: string }> }) => group.entries.map((item) => item.path))).toContain("gui-panel-state.json");
    expect(payload.data.groups.flatMap((group: { entries: Array<{ path: string }> }) => group.entries.map((item) => item.path))).toContain("wiki-clone/.next/");
  });

  it("deletes a workspace entry inside project root", () => {
    const root = createRepo();
    fs.mkdirSync(path.join(root, "tmp"), { recursive: true });
    fs.writeFileSync(path.join(root, "tmp", "leftover.txt"), "leftover\n", "utf8");

    const json = vi.fn();
    handleProjectWorkspaceDelete(config(root))(
      { body: { path: "tmp/leftover.txt" } } as never,
      { json, status: vi.fn().mockReturnThis() } as never,
    );

    expect(json).toHaveBeenCalledWith({ success: true });
    expect(fs.existsSync(path.join(root, "tmp", "leftover.txt"))).toBe(false);
  });
});

function createRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "llmwiki-project-workspace-"));
  tempDirs.push(root);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore", env: gitEnv() });
  return root;
}

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
}

function config(root: string) {
  return {
    projectRoot: root,
    wikiRoot: root,
    host: "127.0.0.1",
    port: 4175,
    author: "me",
  };
}
