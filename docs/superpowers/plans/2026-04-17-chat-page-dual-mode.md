# Chat Page Dual Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 WinForms 版 `LLM Wiki` 对话页重构为支持“纯对话态 / 预览展开态”的聊天优先工作区，并支持可拖拽分栏与宽度持久化。

**Architecture:** 保留现有全局导航与文件浏览栏，重写对话页内部结构。使用 `SplitContainer` 组合代替固定列宽布局，将对话页拆成文件栏、会话栏、聊天区和按需展开的预览区。栏宽状态单独保存在新的 UI 状态文件中，避免污染编译配置。

**Tech Stack:** C# WinForms, .NET Framework `csc.exe`, PowerShell build script, Vitest source assertions for GUI source.

---

## File Structure

### Existing files to modify

- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\Program.cs`
  - 保持入口不变，只在必要时更新引用。
- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.cs`
  - 缩减为核心字段、构造函数、配置加载、共用事件入口。
- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\LlmWikiGui.csproj`
  - 纳入新增 `.cs` 文件。
- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\gui-launcher.test.ts`
  - 先写失败测试，再锁定双形态布局、日志页入口、`SplitContainer` 和 UI 状态持久化。

### New files to create

- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.Layout.cs`
  - 仅负责搭建主布局、导航栏、对话页静态区块。
- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.ChatPage.cs`
  - 仅负责对话页双形态、预览展开/关闭、会话区与输入区逻辑。
- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.FileBrowser.cs`
  - 仅负责文件树、单双击行为、选中模式、预览触发。
- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.State.cs`
  - 仅负责 UI 状态文件的读写与分栏宽度恢复。
- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\GuiPanelState.cs`
  - 对话页栏宽、预览态等 UI 状态模型。

### New runtime file

- `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui-panel-state.json`
  - 存储栏宽和对话页显示状态，不混入 `sync-compile-config.json`。

## Task 1: 锁定双形态需求的失败测试

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\gui-launcher.test.ts`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\gui-launcher.test.ts`

- [ ] **Step 1: 写失败测试，锁定双形态对话页和拖拽分栏**

```ts
expect(formSource).toContain("SplitContainer");
expect(formSource).toContain("chatPreviewSplit");
expect(formSource).toContain("conversationSplit");
expect(formSource).toContain("fileBrowserSplit");
expect(formSource).toContain("ShowPreviewPanel");
expect(formSource).toContain("HidePreviewPanel");
expect(formSource).toContain("gui-panel-state.json");
expect(formSource).toContain("GuiPanelState");
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: FAIL，提示缺少 `SplitContainer`、`ShowPreviewPanel`、`GuiPanelState` 等新结构。

- [ ] **Step 3: 补一组失败测试，锁定日志页和文件栏显示规则**

```ts
expect(formSource).toContain("ShowMainView(\"chat\")");
expect(formSource).toContain("ShowMainView(\"activityLog\")");
expect(formSource).toContain("fileBrowserPanel.Visible = view == \"chat\"");
expect(formSource).toContain("activityLogViewPanel");
expect(formSource).not.toContain("activityLogPanel");
```

- [ ] **Step 4: 再跑测试确认仍失败**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: FAIL，且失败点准确落在新需求上，不是旧测试误报。

- [ ] **Step 5: Commit**

```bash
git add test/gui-launcher.test.ts
git commit -m "test: lock chat dual mode gui expectations"
```

## Task 2: 拆分 MainForm，清理超大文件风险

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.cs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\LlmWikiGui.csproj`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.Layout.cs`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.ChatPage.cs`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.FileBrowser.cs`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.State.cs`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\GuiPanelState.cs`

- [ ] **Step 1: 将 `MainForm` 改为 partial class**

```csharp
namespace LlmWikiGui
{
    public sealed partial class MainForm : Form
    {
    }
}
```

- [ ] **Step 2: 把布局构建代码移动到 `MainForm.Layout.cs`**

```csharp
private void InitializeComponent()
{
    BuildMainShell();
}

private void BuildMainShell()
{
    // main shell only
}
```

- [ ] **Step 3: 把文件树相关逻辑移到 `MainForm.FileBrowser.cs`**

```csharp
private Panel BuildFileBrowserPanel()
{
    // file browser only
}

private void OnFileNodeMouseDoubleClick(object sender, TreeNodeMouseClickEventArgs e)
{
    OpenPreviewForNode(e.Node);
}
```

- [ ] **Step 4: 把状态读写逻辑移到 `MainForm.State.cs` 和 `GuiPanelState.cs`**

```csharp
public sealed class GuiPanelState
{
    public int NavWidth { get; set; }
    public int FileBrowserWidth { get; set; }
    public int ConversationWidth { get; set; }
    public int ChatWidthWithPreview { get; set; }
    public int PreviewWidth { get; set; }
    public bool PreviewOpen { get; set; }
}
```

- [ ] **Step 5: 运行 GUI 测试，确认拆分后还能编译字符串断言**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: 仍然 FAIL，但失败点只剩双形态功能未实现，不是类名或文件丢失。

- [ ] **Step 6: Commit**

```bash
git add gui/LlmWikiGui/MainForm.cs gui/LlmWikiGui/MainForm.Layout.cs gui/LlmWikiGui/MainForm.FileBrowser.cs gui/LlmWikiGui/MainForm.State.cs gui/LlmWikiGui/MainForm.ChatPage.cs gui/LlmWikiGui/GuiPanelState.cs gui/LlmWikiGui/LlmWikiGui.csproj
git commit -m "refactor: split winforms main form by responsibility"
```

## Task 3: 重做对话页静态布局为聊天优先结构

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.Layout.cs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.ChatPage.cs`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\gui-launcher.test.ts`

- [ ] **Step 1: 用 `SplitContainer` 替代当前对话页内容区**

```csharp
private SplitContainer fileBrowserSplit;
private SplitContainer conversationSplit;
private SplitContainer chatPreviewSplit;
```

- [ ] **Step 2: 构建纯对话态四区结构**

```csharp
fileBrowserSplit = CreateVerticalSplit(270);
conversationSplit = CreateVerticalSplit(320);

fileBrowserSplit.Panel1.Controls.Add(fileBrowserPanel);
fileBrowserSplit.Panel2.Controls.Add(conversationSplit);
conversationSplit.Panel1.Controls.Add(conversationPanel);
conversationSplit.Panel2.Controls.Add(chatPanel);
```

- [ ] **Step 3: 把当前“问题与工作流”表单拆成聊天区和会话区**

```csharp
private Panel BuildConversationListPanel() { ... }
private Panel BuildChatPanel() { ... }
```

- [ ] **Step 4: 运行测试确认布局字符串通过一部分**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: 部分新断言通过，但预览切换和状态持久化仍失败。

- [ ] **Step 5: Commit**

```bash
git add gui/LlmWikiGui/MainForm.Layout.cs gui/LlmWikiGui/MainForm.ChatPage.cs test/gui-launcher.test.ts
git commit -m "feat: rebuild chat page shell around split containers"
```

## Task 4: 实现纯对话态与预览展开态切换

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.ChatPage.cs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.FileBrowser.cs`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\gui-launcher.test.ts`

- [ ] **Step 1: 写失败测试，锁定预览开关方法**

```ts
expect(formSource).toContain("ShowPreviewPanel");
expect(formSource).toContain("HidePreviewPanel");
expect(formSource).toContain("OpenPreviewForNode");
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: FAIL，提示缺少这些方法。

- [ ] **Step 3: 实现预览栏与开关方法**

```csharp
private void ShowPreviewPanel(string path)
{
    currentPreviewPath = path;
    chatPreviewSplit.Panel2Collapsed = false;
    previewTitleLabel.Text = Path.GetFileName(path);
    previewTextBox.Text = File.ReadAllText(path, Encoding.UTF8);
}

private void HidePreviewPanel()
{
    currentPreviewPath = null;
    chatPreviewSplit.Panel2Collapsed = true;
}
```

- [ ] **Step 4: 将双击文件事件接入预览**

```csharp
private void OpenPreviewForNode(TreeNode node)
{
    string path = node == null ? null : node.Tag as string;
    if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
    {
        return;
    }

    ShowPreviewPanel(path);
}
```

- [ ] **Step 5: 再跑测试确认通过**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: PASS，或只剩状态持久化相关失败。

- [ ] **Step 6: Commit**

```bash
git add gui/LlmWikiGui/MainForm.ChatPage.cs gui/LlmWikiGui/MainForm.FileBrowser.cs test/gui-launcher.test.ts
git commit -m "feat: add preview-expanded chat mode"
```

## Task 5: 实现栏宽拖拽与状态持久化

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.State.cs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.Layout.cs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.ChatPage.cs`
- Create: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui-panel-state.json`
- Test: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\gui-launcher.test.ts`

- [ ] **Step 1: 写失败测试，锁定 UI 状态文件和状态模型**

```ts
expect(formSource).toContain("gui-panel-state.json");
expect(formSource).toContain("LoadGuiPanelState");
expect(formSource).toContain("SaveGuiPanelState");
expect(formSource).toContain("SplitterMoved");
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: FAIL，提示状态持久化未实现。

- [ ] **Step 3: 实现状态文件加载与保存**

```csharp
private GuiPanelState LoadGuiPanelState()
{
    string path = Path.Combine(projectRoot, "gui-panel-state.json");
    if (!File.Exists(path))
    {
        return GuiPanelState.CreateDefault();
    }

    string json = File.ReadAllText(path, Encoding.UTF8).TrimStart('\uFEFF');
    JavaScriptSerializer serializer = new JavaScriptSerializer();
    return serializer.Deserialize<GuiPanelState>(json) ?? GuiPanelState.CreateDefault();
}
```

- [ ] **Step 4: 在 `SplitContainer.SplitterMoved` 里写回宽度**

```csharp
fileBrowserSplit.SplitterMoved += delegate { SaveGuiPanelState(); };
conversationSplit.SplitterMoved += delegate { SaveGuiPanelState(); };
chatPreviewSplit.SplitterMoved += delegate { SaveGuiPanelState(); };
```

- [ ] **Step 5: 启动时恢复分栏宽度**

```csharp
fileBrowserSplit.SplitterDistance = guiPanelState.FileBrowserWidth;
conversationSplit.SplitterDistance = guiPanelState.ConversationWidth;
chatPreviewSplit.SplitterDistance = guiPanelState.ChatWidthWithPreview;
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add gui/LlmWikiGui/MainForm.State.cs gui/LlmWikiGui/MainForm.Layout.cs gui/LlmWikiGui/MainForm.ChatPage.cs gui/LlmWikiGui/GuiPanelState.cs test/gui-launcher.test.ts
git commit -m "feat: persist chat page panel widths"
```

## Task 6: 将查询输出改造成真正的聊天工作区

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.ChatPage.cs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\gui\LlmWikiGui\MainForm.cs`
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\test\gui-launcher.test.ts`

- [ ] **Step 1: 把当前查询输出框重命名为消息流容器**

```csharp
private RichTextBox chatTranscriptTextBox;
private TextBox chatInputTextBox;
```

- [ ] **Step 2: 发送查询时先追加用户消息，再等待 AI 输出**

```csharp
private void AppendUserMessage(string message)
{
    chatTranscriptTextBox.AppendText("你" + Environment.NewLine + message + Environment.NewLine + Environment.NewLine);
}
```

- [ ] **Step 3: 将 AI 输出块追加为消息而不是覆盖文本**

```csharp
private void AppendAssistantMessage(string message)
{
    chatTranscriptTextBox.AppendText("LLM Wiki" + Environment.NewLine + message + Environment.NewLine + Environment.NewLine);
}
```

- [ ] **Step 4: 运行 GUI 测试和全量测试**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: PASS

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add gui/LlmWikiGui/MainForm.ChatPage.cs gui/LlmWikiGui/MainForm.cs test/gui-launcher.test.ts
git commit -m "feat: turn query output into chat transcript"
```

## Task 7: 构建验证与桌面 exe 验证

**Files:**
- Modify: `C:\Users\Administrator\Desktop\llm-wiki-compiler-main\docs\superpowers\specs\2026-04-17-chat-page-dual-mode-design.md` (only if implementation diverges)

- [ ] **Step 1: 运行 GUI 定向测试**

Run: `npm test -- test/gui-launcher.test.ts`
Expected: PASS

- [ ] **Step 2: 运行全量测试**

Run: `npm test`
Expected: PASS，所有现有 227+ 测试通过。

- [ ] **Step 3: 重建桌面 exe**

Run: `npm run gui:build`
Expected: 输出新的 `C:\Users\Administrator\Desktop\LLM-Wiki-Compiler-Panel.exe`

- [ ] **Step 4: 如果实现与设计有偏差，回写设计文档**

```md
- 调整了预览栏默认最小宽度
- 会话列表暂时未接持久化
```

- [ ] **Step 5: Commit**

```bash
git add gui/LlmWikiGui/*.cs test/gui-launcher.test.ts docs/superpowers/specs/2026-04-17-chat-page-dual-mode-design.md
git commit -m "feat: ship dual-mode chat page"
```

## Self-Review

### Spec coverage

- 双形态布局：Task 3 + Task 4
- 预览展开后聊天区保留：Task 4
- 拖拽分栏：Task 3 + Task 5
- 栏宽持久化：Task 5
- 文件单双击与选中模式规则：Task 4
- 聊天区替代查询结果框：Task 6
- 验证与桌面 exe 更新：Task 7

没有发现未覆盖的 spec 条目。

### Placeholder scan

- 没有 `TODO`、`TBD`、`later` 之类占位符。
- 每个任务都有明确文件路径、测试命令和预期结果。

### Type consistency

- UI 状态模型统一命名为 `GuiPanelState`
- 预览开关统一命名为 `ShowPreviewPanel` / `HidePreviewPanel`
- 文件预览入口统一命名为 `OpenPreviewForNode`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-chat-page-dual-mode.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
