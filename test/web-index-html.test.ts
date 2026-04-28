import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = fs.readFileSync(path.join(process.cwd(), "web", "client", "index.html"), "utf8");

describe("web index html", () => {
  it("keeps startup flow markup valid and Chinese copy readable", () => {
    expect(indexHtml).toContain('id="welcome-next"');
    expect(indexHtml).toContain("从这里开启你的第二大脑");
    expect(indexHtml).toContain("</button>");
    expect(indexHtml).not.toContain("?/button");
    expect(indexHtml).not.toContain("娴犲氦绻");
  });

  it("keeps only current shell mount points in the workspace", () => {
    expect(indexHtml).toContain('id="shell-rail-slot"');
    expect(indexHtml).toContain('id="shell-browser-slot"');
    expect(indexHtml).toContain('id="chat-app"');
    expect(indexHtml).not.toContain('id="settings-dialog"');
    expect(indexHtml).not.toContain('id="topbar"');
  });

  it("keeps build-version placeholders for cache busting", () => {
    expect(indexHtml).toContain("%BUILD_VERSION%");
  });
});
