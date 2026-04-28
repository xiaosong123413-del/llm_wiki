using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed partial class MainForm : Form
    {
        private const string QueryResultStartMarker = "<<<LLMWIKI_QUERY_RESULT_START>>>";
        private const string QueryResultEndMarker = "<<<LLMWIKI_QUERY_RESULT_END>>>";
        private const string LegacyOneClickLabel = "\u4e00\u952e\u540c\u6b65\u7f16\u8bd1";
        private const string LegacyQueryLabel = "\u95ee\u9898\u67e5\u8be2";
        private const string LegacyQueryResultLabel = "\u67e5\u8be2\u7ed3\u679c";
        private const string LegacyPendingItemsLabel = "\u5f85\u5904\u7406\u4e8b\u9879";
        private const string LegacyRuntimeLogLabel = "\u8fd0\u884c\u65e5\u5fd7";
        private const string LegacyWatchLabel = "\u5f00\u59cb\u76d1\u542c\u5e76\u81ea\u52a8\u7f16\u8bd1";
        private const string LegacyStartQueryLabel = "\u5f00\u59cb\u67e5\u8be2";
        private const string LegacyQuerySaveLabel = "\u67e5\u8be2\u5e76\u4fdd\u5b58\u7ed3\u679c";
        private const string TitleBarMinimizeIcon = "\uE921";
        private const string TitleBarMaximizeIcon = "\uE922";
        private const string TitleBarRestoreIcon = "\uE923";
        private const string TitleBarCloseIcon = "\uE8BB";
        private const string WebViewerUrl = "http://127.0.0.1:4175/";

        private readonly string projectRoot;
        private readonly string configPath;
        private readonly string panelStatePath;
        private readonly StringBuilder collectedQueryResult;
        private SyncCompileConfig config;
        private GuiPanelState panelState;

        private TableLayoutPanel mainSurface;
        private TitleBarPanel titleBarPanel;
        private ThemedSplitContainer railSplit;
        private ThemedSplitContainer browserSplit;
        private ThemedSplitContainer conversationSplit;
        private ThemedSplitContainer chatPreviewSplit;
        private Panel contentHost;
        private Panel fileBrowserPanel;
        private Panel chatViewPanel;
        private Panel reviewViewPanel;
        private Panel settingsViewPanel;
        private Panel activityLogViewPanel;
        private Panel welcomePagePanel;
        private Panel initializePagePanel;
        private Panel shellPagePanel;

        private ThemedTreeView fileTreeView;
        private TextBox fileSearchTextBox;
        private TextBox targetVaultTextBox;
        private ListBox sourceFoldersListBox;
        private TextBox queryTextBox;
        private TextBox queryResultTextBox;
        private RichTextBox previewTextBox;
        private TextBox systemCheckDecisionTextBox;
        private TextBox llmEndpointTextBox;
        private TextBox llmKeyTextBox;
        private TextBox llmModelTextBox;
        private TextBox searchEndpointTextBox;
        private TextBox searchKeyTextBox;
        private TextBox searchModelTextBox;
        private TextBox vectorEndpointTextBox;
        private TextBox vectorKeyTextBox;
        private TextBox vectorModelTextBox;
        private TextBox logTextBox;

        private ListBox conversationListBox;
        private Label emptyConversationLabel;
        private Panel chatEmptyStatePanel;
        private Label currentContextLabel;
        private Label previewPathLabel;
        private Label initializeTargetPreviewLabel;
        private Label initializeSourceSummaryLabel;
        private FlowLayoutPanel messageFlowPanel;
        private ToolTip navToolTip;

        private Button startCompileButton;
        private Button watchButton;
        private Button queryButton;
        private Button querySaveButton;
        private Button lintButton;
        private Button previewCloseButton;
        private Button wikiLayerButton;
        private Button rawLayerButton;
        private Button selectModeButton;
        private Button navChatButton;
        private Button navCheckButton;
        private Button navSyncButton;
        private Button navReviewButton;
        private Button navLogButton;
        private Button navWebButton;
        private Button navSettingsButton;
        private Button titleBarMinimizeButton;
        private Button titleBarMaximizeButton;
        private Button titleBarCloseButton;

        private System.Diagnostics.Process runningProcess;
        private Process webViewerProcess;
        private bool collectingQueryResult;
        private bool selectionMode;
        private bool rawLayerSelected;
        private bool panelStateApplied;
        private string currentPreviewPath;
        private string currentView;
        private int conversationCount;

        public MainForm()
        {
            projectRoot = ResolveProjectRoot();
            configPath = Path.Combine(projectRoot, "sync-compile-config.json");
            panelStatePath = Path.Combine(projectRoot, "gui-panel-state.json");
            config = LoadConfig();
            panelState = LoadPanelState();
            collectedQueryResult = new StringBuilder();
            InitializeComponent();
            BindConfigToUi();
        }

        private static string ResolveProjectRoot()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string desktopProject = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                "llm-wiki-compiler-main");
            string[] candidates = new string[]
            {
                baseDir,
                Path.GetFullPath(Path.Combine(baseDir, "..", "..")),
                desktopProject
            };

            foreach (string candidate in candidates)
            {
                if (File.Exists(Path.Combine(candidate, "sync-compile-config.json")))
                {
                    return candidate;
                }
            }

            return desktopProject;
        }

        private SyncCompileConfig LoadConfig()
        {
            if (!File.Exists(configPath))
            {
                return SyncCompileConfig.CreateDefault(projectRoot);
            }

            string json = File.ReadAllText(configPath, Encoding.UTF8).TrimStart('\uFEFF');
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            SyncCompileConfig loaded = serializer.Deserialize<SyncCompileConfig>(json);
            if (loaded == null)
            {
                loaded = SyncCompileConfig.CreateDefault(projectRoot);
            }

            loaded.ApplyDefaults(projectRoot);
            return loaded;
        }

        private void SaveConfig()
        {
            config.target_vault = targetVaultTextBox.Text.Trim();
            config.compiler_root = projectRoot;
            config.source_folders = new List<string>();
            foreach (object item in sourceFoldersListBox.Items)
            {
                string value = Convert.ToString(item);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    config.source_folders.Add(value);
                }
            }

            config.ApplyDefaults(projectRoot);
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            string json = serializer.Serialize(config);
            File.WriteAllText(configPath, PrettyJson(json), new UTF8Encoding(false));
            AppendLog("\u914d\u7f6e\u5df2\u4fdd\u5b58\uff1a" + configPath);
        }

        private void SaveEnvSettings()
        {
            Dictionary<string, string> values = new Dictionary<string, string>();
            values["ANTHROPIC_BASE_URL"] = GetTextBoxValue(llmEndpointTextBox);
            values["ANTHROPIC_API_KEY"] = GetTextBoxValue(llmKeyTextBox);
            values["LLMWIKI_MODEL"] = GetTextBoxValue(llmModelTextBox);
            values["SEARCH_API_URL"] = GetTextBoxValue(searchEndpointTextBox);
            values["SEARCH_API_KEY"] = GetTextBoxValue(searchKeyTextBox);
            values["SEARCH_MODEL"] = GetTextBoxValue(searchModelTextBox);
            values["VECTOR_API_URL"] = GetTextBoxValue(vectorEndpointTextBox);
            values["VECTOR_API_KEY"] = GetTextBoxValue(vectorKeyTextBox);
            values["VECTOR_MODEL"] = GetTextBoxValue(vectorModelTextBox);

            string envPath = Path.Combine(projectRoot, ".env");
            WriteEnvValues(envPath, values);
            AppendLog("API \u914d\u7f6e\u5df2\u4fdd\u5b58\uff1a" + envPath);
        }

        private static string GetTextBoxValue(TextBox textBox)
        {
            return textBox == null ? string.Empty : textBox.Text.Trim();
        }

        private static void WriteEnvValues(string envPath, Dictionary<string, string> values)
        {
            string[] orderedKeys = new string[]
            {
                "ANTHROPIC_BASE_URL",
                "ANTHROPIC_API_KEY",
                "LLMWIKI_MODEL",
                "SEARCH_API_URL",
                "SEARCH_API_KEY",
                "SEARCH_MODEL",
                "VECTOR_API_URL",
                "VECTOR_API_KEY",
                "VECTOR_MODEL"
            };

            List<string> lines = File.Exists(envPath)
                ? new List<string>(File.ReadAllLines(envPath, Encoding.UTF8))
                : new List<string>();
            HashSet<string> remaining = new HashSet<string>(values.Keys);

            for (int i = 0; i < lines.Count; i++)
            {
                string line = lines[i];
                int separator = line.IndexOf('=');
                if (separator <= 0)
                {
                    continue;
                }

                string key = line.Substring(0, separator);
                if (values.ContainsKey(key))
                {
                    lines[i] = key + "=" + values[key];
                    remaining.Remove(key);
                }
            }

            foreach (string key in orderedKeys)
            {
                if (remaining.Contains(key))
                {
                    lines.Add(key + "=" + values[key]);
                }
            }

            File.WriteAllLines(envPath, lines.ToArray(), new UTF8Encoding(false));
        }

        private static string PrettyJson(string compactJson)
        {
            StringBuilder output = new StringBuilder();
            int indent = 0;
            bool inString = false;

            for (int i = 0; i < compactJson.Length; i++)
            {
                char ch = compactJson[i];
                bool escapedQuote = ch == '"' && i > 0 && compactJson[i - 1] == '\\';
                if (ch == '"' && !escapedQuote)
                {
                    inString = !inString;
                }

                if (!inString && (ch == '{' || ch == '['))
                {
                    output.Append(ch);
                    output.AppendLine();
                    indent++;
                    output.Append(new string(' ', indent * 2));
                }
                else if (!inString && (ch == '}' || ch == ']'))
                {
                    output.AppendLine();
                    indent--;
                    output.Append(new string(' ', indent * 2));
                    output.Append(ch);
                }
                else if (!inString && ch == ',')
                {
                    output.Append(ch);
                    output.AppendLine();
                    output.Append(new string(' ', indent * 2));
                }
                else if (!inString && ch == ':')
                {
                    output.Append(": ");
                }
                else
                {
                    output.Append(ch);
                }
            }

            output.AppendLine();
            return output.ToString();
        }

        private static string ReadTextFileSafe(string path)
        {
            return File.ReadAllText(path, Encoding.UTF8);
        }

        private void UpdateMaximizedBounds()
        {
            MaximizedBounds = Screen.FromHandle(Handle).WorkingArea;
        }

        internal void PrepareForWindowStateChange()
        {
            UpdateMaximizedBounds();
        }

        private bool ShouldShowWelcomeFlow()
        {
            return !File.Exists(configPath) || config.source_folders == null || config.source_folders.Count == 0;
        }

        private void MinimizeWindow(object sender, EventArgs e)
        {
            WindowState = FormWindowState.Minimized;
            UpdateTitleBarButtonsForWindowState();
        }

        private void ToggleMaximizeWindow(object sender, EventArgs e)
        {
            UpdateMaximizedBounds();
            WindowState = WindowState == FormWindowState.Maximized
                ? FormWindowState.Normal
                : FormWindowState.Maximized;
            UpdateTitleBarButtonsForWindowState();
        }

        private void CloseWindow(object sender, EventArgs e)
        {
            Close();
        }

        private void UpdateTitleBarButtonsForWindowState()
        {
            if (titleBarMinimizeButton != null)
            {
                titleBarMinimizeButton.Text = TitleBarMinimizeIcon;
            }

            if (titleBarMaximizeButton != null)
            {
                titleBarMaximizeButton.Text = WindowState == FormWindowState.Maximized
                    ? TitleBarRestoreIcon
                    : TitleBarMaximizeIcon;
            }

            if (titleBarCloseButton != null)
            {
                titleBarCloseButton.Text = TitleBarCloseIcon;
            }
        }

        protected override void WndProc(ref Message m)
        {
            const int wmNchittest = 0x0084;
            const int htClient = 1;
            const int htLeft = 10;
            const int htRight = 11;
            const int htTop = 12;
            const int htTopLeft = 13;
            const int htTopRight = 14;
            const int htBottom = 15;
            const int htBottomLeft = 16;
            const int htBottomRight = 17;
            const int resizeBorder = 6;

            base.WndProc(ref m);

            if (m.Msg != wmNchittest || WindowState == FormWindowState.Maximized)
            {
                return;
            }

            if ((int)m.Result != htClient)
            {
                return;
            }

            Point cursor = PointToClient(Cursor.Position);
            bool left = cursor.X <= resizeBorder;
            bool right = cursor.X >= Width - resizeBorder;
            bool top = cursor.Y <= resizeBorder;
            bool bottom = cursor.Y >= Height - resizeBorder;

            if (left && top) m.Result = (IntPtr)htTopLeft;
            else if (left && bottom) m.Result = (IntPtr)htBottomLeft;
            else if (right && top) m.Result = (IntPtr)htTopRight;
            else if (right && bottom) m.Result = (IntPtr)htBottomRight;
            else if (left) m.Result = (IntPtr)htLeft;
            else if (right) m.Result = (IntPtr)htRight;
            else if (top) m.Result = (IntPtr)htTop;
            else if (bottom) m.Result = (IntPtr)htBottom;
        }

        private void InitializeComponent()
        {
            BuildMainShell();
        }
    }

    public sealed class SyncCompileConfig
    {
        public string target_vault { get; set; }
        public string compiler_root { get; set; }
        public List<string> source_folders { get; set; }
        public string compile_mode { get; set; }
        public int batch_limit { get; set; }
        public List<string> batch_pattern_order { get; set; }
        public List<string> exclude_dirs { get; set; }

        public static SyncCompileConfig CreateDefault(string projectRoot)
        {
            SyncCompileConfig defaultConfig = new SyncCompileConfig();
            defaultConfig.ApplyDefaults(projectRoot);
            return defaultConfig;
        }

        public void ApplyDefaults(string projectRoot)
        {
            if (string.IsNullOrEmpty(target_vault))
            {
                target_vault = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "ai\u7684\u4ed3\u5e93");
            }

            if (string.IsNullOrEmpty(compiler_root))
            {
                compiler_root = projectRoot;
            }

            if (source_folders == null)
            {
                source_folders = new List<string>();
            }

            if (string.IsNullOrEmpty(compile_mode))
            {
                compile_mode = "batch";
            }

            if (batch_limit <= 0)
            {
                batch_limit = 20;
            }

            if (batch_pattern_order == null || batch_pattern_order.Count == 0)
            {
                batch_pattern_order = new List<string>
                {
                    "ai\u77e5\u8bc6\u5e93\uff08\u7b2c\u4e8c\u5927\u8111\uff09__\u6982\u5ff5__*",
                    "ai\u77e5\u8bc6\u5e93\uff08\u7b2c\u4e8c\u5927\u8111\uff09__\u9879\u76ee__*",
                    "02_\u9886\u57df__*",
                    "01_\u9879\u76ee__*",
                    "03_\u8d44\u6e90__*",
                    "*"
                };
            }

            if (exclude_dirs == null || exclude_dirs.Count == 0)
            {
                exclude_dirs = new List<string>
                {
                    ".obsidian",
                    ".trash",
                    ".claude",
                    ".claudian"
                };
            }
        }
    }
}
