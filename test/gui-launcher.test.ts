import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function readGuiSources() {
  const guiRoot = path.join(root, "gui", "LlmWikiGui");
  const entries = await readdir(guiRoot);
  const sourceNames = entries.filter((name) => name.endsWith(".cs")).sort();
  const contents = await Promise.all(
    sourceNames.map(async (name) => readFile(path.join(guiRoot, name), "utf8")),
  );

  return contents.join("\n");
}

describe("windows gui launcher", () => {
  it("starts sync compile without showing a console window", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("CreateNoWindow = true");
    expect(formSource).toContain("RedirectStandardOutput = true");
    expect(formSource).toContain("sync-compile.mjs");
    expect(formSource).toContain("watch-sync-compile.mjs");
    expect(formSource).toContain("\"query\"");
    expect(formSource).toContain("\"lint\"");
  });

  it("keeps gui source ascii-only to avoid Windows PowerShell encoding damage", async () => {
    const formSource = await readGuiSources();

    expect([...formSource].every((char) => char.charCodeAt(0) <= 127)).toBe(true);
    expect(formSource).toContain("\\u7684\\u4ed3\\u5e93");
  });

  it("renders the panel with Chinese labels through unicode escapes", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("\\u4e00\\u952e\\u540c\\u6b65\\u7f16\\u8bd1");
    expect(formSource).toContain("\\u5f00\\u59cb\\u540c\\u6b65\\u5e76\\u7f16\\u8bd1");
    expect(formSource).toContain("\\u5f00\\u59cb\\u76d1\\u542c\\u5e76\\u81ea\\u52a8\\u7f16\\u8bd1");
    expect(formSource).toContain("\\u95ee\\u9898\\u67e5\\u8be2");
    expect(formSource).toContain("\\u67e5\\u8be2\\u7ed3\\u679c");
    expect(formSource).toContain("\\u5f00\\u59cb\\u67e5\\u8be2");
    expect(formSource).toContain("\\u67e5\\u8be2\\u5e76\\u4fdd\\u5b58\\u7ed3\\u679c");
    expect(formSource).toContain("\\u7cfb\\u7edf\\u68c0\\u67e5");
    expect(formSource).toContain("\\u5f85\\u5904\\u7406\\u4e8b\\u9879");
    expect(formSource).not.toContain("\\u7cfb\\u7edf\\u68c0\\u67e5\\u5f85\\u786e\\u8ba4\\u4e8b\\u9879");
    expect(formSource).toContain("\\u539f\\u56e0");
    expect(formSource).toContain("\\u662f\\u5426\\u8fdb\\u4e00\\u6b65\\u7f51\\u7edc\\u641c\\u7d22\\u8865\\u8bc1");
    expect(formSource).toContain("\\u662f\\u5426\\u63a5\\u53d7\\u65b0\\u95ee\\u9898\\u3001\\u65b0\\u6765\\u6e90\\u5efa\\u8bae");
    expect(formSource).not.toContain("\\u8584\\u9875\\u68c0\\u67e5");
    expect(formSource).toContain("\\u5168\\u91cf\\u539f\\u6599\\u4ed3");
    expect(formSource).toContain("\\u5f53\\u524d\\u6279\\u6b21\\u5de5\\u4f5c\\u533a");
    expect(formSource).toContain("\\u8fd0\\u884c\\u65e5\\u5fd7");
    expect(formSource).not.toContain("One-click Sync Compile");
  });

  it("uses a desktop-workbench layout inspired by the reference app", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("navRail");
    expect(formSource).toContain("workspacePanel");
    expect(formSource).toContain("activityLogViewPanel");
    expect(formSource).toContain("BuildActivityLogViewPanel");
    expect(formSource).toContain("OnShowActivityLog");
    expect(formSource).not.toContain("activityLogPanel");
    expect(formSource).toContain("root.RowCount = 2");
    expect(formSource).toContain("TitleBarHeight");
    expect(formSource).toContain("CreateNavButton");
    expect(formSource).toContain("CreateCard");
    expect(formSource).toContain("mainSurface.ColumnCount = 3");
    expect(formSource).toContain("queryResultTextBox");
    expect(formSource).not.toContain("rightPreviewPanel");
    expect(formSource).not.toContain("\\u53f3\\u4fa7\\u9884\\u89c8 / \\u5f85\\u786e\\u8ba4");
    expect(formSource).toContain("\\u6d3b\\u52a8\\u65e5\\u5fd7");
  });

  it("implements the LLM Wiki product layout and iris color system", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("Theme.Primary");
    expect(formSource).toContain("Theme.PrimaryLight");
    expect(formSource).toContain("Theme.PrimaryLighter");
    expect(formSource).toContain("Theme.Border");
    expect(formSource).toContain("ShowWelcomePage");
    expect(formSource).toContain("ShowInitializePage");
    expect(formSource).toContain("BuildMainShell");
    expect(formSource).toContain("fileBrowserPanel");
    expect(formSource).toContain("chatViewPanel");
    expect(formSource).toContain("reviewViewPanel");
    expect(formSource).toContain("settingsViewPanel");
    expect(formSource).toContain("activityLogViewPanel");
    expect(formSource).not.toContain("markdownPreviewTextBox");
    expect(formSource).toContain("LoadFileTree");
    expect(formSource).toContain("OnFileNodeMouseDoubleClick");
    expect(formSource).toContain("\\u4ece\\u8fd9\\u91cc\\u5f00\\u542f\\u4f60\\u7684\\u7b2c\\u4e8c\\u5927\\u8111");
    expect(formSource).toContain("\\u70b9\\u51fb\\u4e0b\\u4e00\\u9875");
    expect(formSource).toContain("\\u5bf9\\u8bdd");
    expect(formSource).toContain("\\u68c0\\u67e5");
    expect(formSource).toContain("\\u540c\\u6b65");
    expect(formSource).toContain("\\u5ba1\\u67e5");
    expect(formSource).toContain("\\u8bbe\\u7f6e");
    expect(formSource).toContain("\\u65e5\\u5fd7");
    expect(formSource).toContain("wiki");
    expect(formSource).toContain("raw\\u5c42");
    expect(formSource).toContain("\\u65b0\\u5bf9\\u8bdd");
    expect(formSource).toContain("\\u6682\\u65e0\\u5bf9\\u8bdd");
    expect(formSource).toContain("\\u7f51\\u7edc\\u641c\\u7d22api");
    expect(formSource).toContain("Vector Search / Embedding");
  });

  it("centralizes theme tokens and removes scattered legacy gui color constants", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("public static class Theme");
    expect(formSource).toContain("public static readonly Color Primary");
    expect(formSource).toContain("public const int NavBarWidth = 72");
    expect(formSource).not.toContain("private const string PrimaryColorHex");
    expect(formSource).not.toContain("private const string SoftPurpleHex");
    expect(formSource).not.toContain("private const string PanelBackgroundHex");
    expect(formSource).not.toContain("private const string BorderColorHex");
  });

  it("uses a custom window frame and themed splitters instead of raw winforms chrome", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("FormBorderStyle.None");
    expect(formSource).toContain("TitleBarPanel");
    expect(formSource).toContain("ThemedSplitContainer");
    expect(formSource).toContain("WindowState = FormWindowState.Normal");
    expect(formSource).toContain("MaximizedBounds = Screen.FromHandle(Handle).WorkingArea");
    expect(formSource).toContain("MinimizeWindow");
    expect(formSource).toContain("ToggleMaximizeWindow");
    expect(formSource).toContain("CloseWindow");
  });

  it("keeps standard title bar controls for minimize, maximize-restore, and close", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("titleBarMinimizeButton");
    expect(formSource).toContain("titleBarMaximizeButton");
    expect(formSource).toContain("titleBarCloseButton");
    expect(formSource).toContain("UpdateTitleBarButtonsForWindowState()");
    expect(formSource).toContain("FormWindowState.Minimized");
    expect(formSource).toContain("titleBarMaximizeButton.Text =");
  });

  it("replaces app message boxes with the themed dialog component", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("AppDialog");
    expect(formSource).toContain("ShowConfirmation");
    expect(formSource).toContain("ShowInfo");
    expect(formSource).not.toContain("MessageBox.Show");
    expect(formSource).toContain("FolderBrowserDialog");
  });

  it("uses real content panels for review and settings navigation", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("ShowMainView");
    expect(formSource).toContain("BuildReviewViewPanel");
    expect(formSource).toContain("BuildSettingsViewPanel");
    expect(formSource).toContain("contentHost");
    expect(formSource).toContain("chatViewPanel.Visible");
    expect(formSource).toContain("reviewViewPanel.Visible");
    expect(formSource).toContain("settingsViewPanel.Visible");
    expect(formSource).toContain("activityLogViewPanel.Visible");
    expect(formSource).toContain("fileBrowserPanel.Visible = view == \"chat\"");
    expect(formSource).not.toContain("fileBrowserPanel.Visible = view != \"settings\"");
    expect(formSource).toContain("llmEndpointTextBox");
    expect(formSource).toContain("searchEndpointTextBox");
    expect(formSource).toContain("vectorEndpointTextBox");
    expect(formSource).not.toContain("\\u8bbe\\u7f6e\\u9875\\u5305\\u542b");
    expect(formSource).not.toContain("\\u5ba1\\u67e5\\u9875\\u4f1a\\u5c55\\u793a");
  });

  it("persists provider, search, and vector settings into the project env file", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("OnSaveAllSettings");
    expect(formSource).toContain("SaveEnvSettings");
    expect(formSource).toContain("WriteEnvValues");
    expect(formSource).toContain("llmKeyTextBox");
    expect(formSource).toContain("llmModelTextBox");
    expect(formSource).toContain("searchKeyTextBox");
    expect(formSource).toContain("searchModelTextBox");
    expect(formSource).toContain("vectorKeyTextBox");
    expect(formSource).toContain("vectorModelTextBox");
    expect(formSource).toContain("ANTHROPIC_BASE_URL");
    expect(formSource).toContain("ANTHROPIC_API_KEY");
    expect(formSource).toContain("LLMWIKI_MODEL");
    expect(formSource).toContain("SEARCH_API_URL");
    expect(formSource).toContain("SEARCH_API_KEY");
    expect(formSource).toContain("SEARCH_MODEL");
    expect(formSource).toContain("VECTOR_API_URL");
    expect(formSource).toContain("VECTOR_API_KEY");
    expect(formSource).toContain("VECTOR_MODEL");
  });

  it("strips ansi terminal color codes before writing gui logs", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("StripAnsi");
    expect(formSource).toContain("@\"\\x1B\\[[0-?]*[ -/]*[@-~]\"");
  });

  it("build script publishes a desktop exe panel", async () => {
    const buildScript = await readFile(
      path.join(root, "scripts", "build-gui.ps1"),
      "utf8",
    );

    expect(buildScript).toContain("LLM-Wiki-Compiler-Panel.exe");
    expect(buildScript).toContain("csc.exe");
    expect(buildScript).toContain("/target:winexe");
  });

  it("supports dual-mode chat layout with resizable preview and persisted panel widths", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("ThemedSplitContainer");
    expect(formSource).toContain("conversationSplit");
    expect(formSource).toContain("chatPreviewSplit");
    expect(formSource).toContain("ShowPreviewPanel");
    expect(formSource).toContain("HidePreviewPanel");
    expect(formSource).toContain("OpenPreviewForNode");
    expect(formSource).toContain("Panel2Collapsed");
    expect(formSource).toContain("GuiPanelState");
    expect(formSource).toContain("gui-panel-state.json");
    expect(formSource).toContain("previewCloseButton");
  });

  it("defers strict splitter min sizes until the form is shown to avoid startup crashes", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("OnMainFormShown");
    expect(formSource).toContain("railSplit.Panel2MinSize = 50");
    expect(formSource).toContain("browserSplit.Panel2MinSize = 50");
    expect(formSource).toContain("conversationSplit.Panel2MinSize = 50");
    expect(formSource).toContain("chatPreviewSplit.Panel2MinSize = 50");
    expect(formSource).toContain("browserSplit.Panel2MinSize = 720");
    expect(formSource).toContain("chatPreviewSplit.Panel2MinSize = 280");
  });

  it("opens the preview on a normal file click while keeping selection mode as a context-only workflow", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("private void OnFileNodeMouseClick");
    expect(formSource).toContain("OpenPreviewForNode(e.Node);");
    expect(formSource).toContain("if (selectionMode)");
    expect(formSource).toContain("currentContextLabel.Text = \"\\u5f53\\u524d\\u4e0a\\u4e0b\\u6587");
  });

  it("uses a wide branded settings canvas instead of the old thin auto-flow column", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("settingsCanvas");
    expect(formSource).toContain("settingsCanvas.MaximumSize = new Size(1120, 0)");
    expect(formSource).toContain("settingsCanvas.ColumnCount = 2");
    expect(formSource).toContain("settingsCanvas.SetColumnSpan");
    expect(formSource).toContain("BuildSettingsHeroCard");
    expect(formSource).not.toContain("layout.Width = 760");
  });

  it("pins the navigation rail to the theme width instead of restoring stale oversized values", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("nav_width = Theme.NavBarWidth;");
    expect(formSource).not.toContain("if (nav_width <= 0)");
  });

  it("renders preview content with markdown-friendly rich text instead of a raw plain textbox dump", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("private RichTextBox previewTextBox;");
    expect(formSource).toContain("previewTextBox = new RichTextBox();");
    expect(formSource).toContain("previewTextBox.WordWrap = true;");
    expect(formSource).toContain("RenderPreviewMarkdown(");
    expect(formSource).toContain("StripYamlFrontMatter(");
  });

  it("adds target vault browsing and clearer repository action guidance in settings", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("OnChooseTargetVault");
    expect(formSource).toContain("\\u9009\\u62e9\\u672c\\u5730\\u6587\\u4ef6\\u5939");
    expect(formSource).toContain("\\u5de5\\u4f5c\\u533a\\u64cd\\u4f5c");
    expect(formSource).toContain("\\u4e0b\\u9762\\u8fd9\\u4e00\\u7ec4\\u6309\\u94ae");
  });

  it("draws visible tree hierarchy guides instead of a flat file list", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("DrawHierarchyGuides(");
    expect(formSource).toContain("DashStyle.Dot");
    expect(formSource).toContain("Theme.TreeIndent");
  });

  it("wires the vendored audit, web viewer, and Obsidian plugin tooling into the desktop panel", async () => {
    const formSource = await readGuiSources();

    expect(formSource).toContain("OnStartWebViewer");
    expect(formSource).toContain("web:start");
    expect(formSource).toContain("navWebButton");
    expect(formSource).toContain("bottomGroup.Controls.Add(navWebButton)");
    expect(formSource).toContain("\\u542f\\u52a8\\u672c\\u5730Web\\u9884\\u89c8\\u5668");
    expect(formSource).toContain("EnsureAuditDirectories");
    expect(formSource).toContain("TryReachWebViewer");
    expect(formSource).toContain("http://127.0.0.1:4175/");
  });
});
