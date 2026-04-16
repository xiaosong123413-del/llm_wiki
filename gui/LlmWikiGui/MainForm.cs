using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed class MainForm : Form
    {
        private readonly string projectRoot;
        private readonly string configPath;
        private SyncCompileConfig config;
        private TextBox targetVaultTextBox;
        private ListBox sourceFoldersListBox;
        private TextBox logTextBox;
        private Button startButton;
        private Process runningProcess;

        public MainForm()
        {
            projectRoot = ResolveProjectRoot();
            configPath = Path.Combine(projectRoot, "sync-compile-config.json");
            config = LoadConfig();
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

        private void InitializeComponent()
        {
            Text = "LLM Wiki \u7f16\u8bd1\u9762\u677f";
            Width = 900;
            Height = 680;
            MinimumSize = new Size(760, 560);
            Font = new Font("Microsoft YaHei UI", 9F);
            StartPosition = FormStartPosition.CenterScreen;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 7;
            layout.Padding = new Padding(16);
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 150));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            Label titleLabel = new Label();
            titleLabel.Text = "LLM Wiki \u4e00\u952e\u540c\u6b65\u7f16\u8bd1";
            titleLabel.Font = new Font(Font.FontFamily, 16F, FontStyle.Bold);
            titleLabel.AutoSize = true;
            titleLabel.Margin = new Padding(0, 0, 0, 12);
            layout.Controls.Add(titleLabel, 0, 0);

            targetVaultTextBox = new TextBox();
            targetVaultTextBox.Dock = DockStyle.Top;
            targetVaultTextBox.Margin = new Padding(0, 0, 0, 12);
            layout.Controls.Add(WrapWithLabel("\u76ee\u6807\u4ed3\u5e93", targetVaultTextBox), 0, 1);

            sourceFoldersListBox = new ListBox();
            sourceFoldersListBox.Dock = DockStyle.Fill;
            sourceFoldersListBox.HorizontalScrollbar = true;
            layout.Controls.Add(WrapWithLabel("\u540c\u6b65\u6e90\u6587\u4ef6\u5939\uff08\u53ef\u6dfb\u52a0\u591a\u4e2a\uff09", sourceFoldersListBox), 0, 2);

            FlowLayoutPanel sourceButtons = new FlowLayoutPanel();
            sourceButtons.AutoSize = true;
            sourceButtons.Margin = new Padding(0, 8, 0, 12);
            sourceButtons.Controls.Add(CreateButton("\u6dfb\u52a0\u6e90\u6587\u4ef6\u5939", OnAddSourceFolder));
            sourceButtons.Controls.Add(CreateButton("\u79fb\u9664\u9009\u4e2d", OnRemoveSelectedFolder));
            sourceButtons.Controls.Add(CreateButton("\u4fdd\u5b58\u914d\u7f6e", OnSaveConfig));
            sourceButtons.Controls.Add(CreateButton("\u6253\u5f00\u914d\u7f6e", OnOpenConfig));
            layout.Controls.Add(sourceButtons, 0, 3);

            FlowLayoutPanel runButtons = new FlowLayoutPanel();
            runButtons.AutoSize = true;
            runButtons.Margin = new Padding(0, 0, 0, 12);
            startButton = CreateButton("\u5f00\u59cb\u540c\u6b65\u5e76\u7f16\u8bd1", OnStartCompile);
            runButtons.Controls.Add(startButton);
            runButtons.Controls.Add(CreateButton("\u6253\u5f00 wiki \u8f93\u51fa", OnOpenWiki));
            layout.Controls.Add(runButtons, 0, 4);

            logTextBox = new TextBox();
            logTextBox.Dock = DockStyle.Fill;
            logTextBox.Multiline = true;
            logTextBox.ScrollBars = ScrollBars.Both;
            logTextBox.WordWrap = false;
            logTextBox.ReadOnly = true;
            logTextBox.Font = new Font("Consolas", 9F);
            layout.Controls.Add(WrapWithLabel("\u8fd0\u884c\u65e5\u5fd7", logTextBox), 0, 5);

            Label hintLabel = new Label();
            hintLabel.AutoSize = true;
            hintLabel.Text = "\u5148\u4fdd\u5b58\u914d\u7f6e\uff0c\u518d\u5f00\u59cb\u3002\u7a0b\u5e8f\u4f1a\u76f4\u63a5\u8c03\u7528 Node\uff0c\u4e0d\u4f1a\u6253\u5f00 PowerShell \u7a97\u53e3\u3002";
            hintLabel.Margin = new Padding(0, 12, 0, 0);
            layout.Controls.Add(hintLabel, 0, 6);

            Controls.Add(layout);
            FormClosing += OnFormClosing;
        }

        private static Control WrapWithLabel(string label, Control control)
        {
            TableLayoutPanel wrapper = new TableLayoutPanel();
            wrapper.Dock = DockStyle.Fill;
            wrapper.ColumnCount = 1;
            wrapper.RowCount = 2;
            wrapper.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            wrapper.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));

            Label labelControl = new Label();
            labelControl.Text = label;
            labelControl.AutoSize = true;
            labelControl.Margin = new Padding(0, 0, 0, 4);

            wrapper.Controls.Add(labelControl, 0, 0);
            wrapper.Controls.Add(control, 0, 1);
            return wrapper;
        }

        private static Button CreateButton(string text, EventHandler handler)
        {
            Button button = new Button();
            button.Text = text;
            button.AutoSize = true;
            button.Margin = new Padding(0, 0, 8, 0);
            button.Click += handler;
            return button;
        }

        private void BindConfigToUi()
        {
            targetVaultTextBox.Text = config.target_vault;
            sourceFoldersListBox.Items.Clear();
            foreach (string folder in config.source_folders)
            {
                sourceFoldersListBox.Items.Add(folder);
            }

            AppendLog("\u9879\u76ee\u76ee\u5f55\uff1a" + projectRoot);
            AppendLog("\u914d\u7f6e\u6587\u4ef6\uff1a" + configPath);
        }

        private void OnAddSourceFolder(object sender, EventArgs e)
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "\u9009\u62e9\u4e00\u4e2a\u540c\u6b65\u6e90\u6587\u4ef6\u5939\u3002\u53ef\u91cd\u590d\u70b9\u51fb\u6dfb\u52a0\u591a\u4e2a\u6587\u4ef6\u5939\u3002";
                dialog.ShowNewFolderButton = false;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    if (!sourceFoldersListBox.Items.Contains(dialog.SelectedPath))
                    {
                        sourceFoldersListBox.Items.Add(dialog.SelectedPath);
                    }
                }
            }
        }

        private void OnRemoveSelectedFolder(object sender, EventArgs e)
        {
            while (sourceFoldersListBox.SelectedItems.Count > 0)
            {
                sourceFoldersListBox.Items.Remove(sourceFoldersListBox.SelectedItems[0]);
            }
        }

        private void OnSaveConfig(object sender, EventArgs e)
        {
            SaveConfig();
        }

        private void OnOpenConfig(object sender, EventArgs e)
        {
            Process.Start("notepad.exe", configPath);
        }

        private void OnOpenWiki(object sender, EventArgs e)
        {
            string wikiPath = Path.Combine(targetVaultTextBox.Text.Trim(), "wiki");
            if (Directory.Exists(wikiPath))
            {
                Process.Start("explorer.exe", wikiPath);
                return;
            }

            MessageBox.Show(this, "wiki \u8f93\u51fa\u76ee\u5f55\u8fd8\u4e0d\u5b58\u5728\uff0c\u8bf7\u5148\u8fd0\u884c\u4e00\u6b21\u7f16\u8bd1\u3002", "\u63d0\u793a", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void OnStartCompile(object sender, EventArgs e)
        {
            if (runningProcess != null && !runningProcess.HasExited)
            {
                MessageBox.Show(this, "\u5df2\u6709\u540c\u6b65\u7f16\u8bd1\u4efb\u52a1\u6b63\u5728\u8fd0\u884c\u3002", "\u63d0\u793a", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            if (sourceFoldersListBox.Items.Count == 0)
            {
                MessageBox.Show(this, "\u8bf7\u5148\u6dfb\u52a0\u81f3\u5c11\u4e00\u4e2a\u540c\u6b65\u6e90\u6587\u4ef6\u5939\u3002", "\u7f3a\u5c11\u6e90\u6587\u4ef6\u5939", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            SaveConfig();
            StartCompileProcess();
        }

        private void StartCompileProcess()
        {
            string nodePath = ResolveNodePath();
            string scriptPath = Path.Combine(projectRoot, "scripts", "sync-compile.mjs");
            logTextBox.Clear();
            AppendLog("\u6b63\u5728\u5f00\u59cb\u540c\u6b65\u5e76\u7f16\u8bd1...");
            AppendLog("Node: " + nodePath);
            AppendLog("Script: " + scriptPath);

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = nodePath;
            startInfo.Arguments = Quote(scriptPath);
            startInfo.WorkingDirectory = projectRoot;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;
            startInfo.StandardOutputEncoding = Encoding.UTF8;
            startInfo.StandardErrorEncoding = Encoding.UTF8;

            runningProcess = new Process();
            runningProcess.StartInfo = startInfo;
            runningProcess.EnableRaisingEvents = true;
            runningProcess.OutputDataReceived += OnProcessOutput;
            runningProcess.ErrorDataReceived += OnProcessOutput;
            runningProcess.Exited += OnProcessExited;

            startButton.Enabled = false;
            runningProcess.Start();
            runningProcess.BeginOutputReadLine();
            runningProcess.BeginErrorReadLine();
        }

        private static string ResolveNodePath()
        {
            string nvmNode = Path.Combine("C:\\", "nvm4w", "nodejs", "node.exe");
            if (File.Exists(nvmNode))
            {
                return nvmNode;
            }

            return "node";
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private void OnProcessOutput(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                AppendLog(StripAnsi(e.Data));
            }
        }

        private static string StripAnsi(string line)
        {
            return Regex.Replace(line, @"\x1B\[[0-?]*[ -/]*[@-~]", string.Empty);
        }

        private void OnProcessExited(object sender, EventArgs e)
        {
            int exitCode = runningProcess.ExitCode;
            BeginInvoke(new Action(delegate
            {
                startButton.Enabled = true;
                AppendLog("\u8fdb\u7a0b\u9000\u51fa\uff0c\u4ee3\u7801\uff1a" + exitCode + "\u3002");
            }));
        }

        private void AppendLog(string line)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(AppendLog), line);
                return;
            }

            logTextBox.AppendText("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + line + Environment.NewLine);
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            if (runningProcess == null || runningProcess.HasExited)
            {
                return;
            }

            DialogResult result = MessageBox.Show(
                this,
                "\u540c\u6b65\u7f16\u8bd1\u4ecd\u5728\u8fd0\u884c\u3002\u5173\u95ed\u7a97\u53e3\u4f1a\u505c\u6b62\u5f53\u524d\u4efb\u52a1\uff0c\u786e\u8ba4\u5173\u95ed\u5417\uff1f",
                "\u786e\u8ba4\u5173\u95ed",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning);
            if (result != DialogResult.Yes)
            {
                e.Cancel = true;
                return;
            }

            runningProcess.Kill();
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
            SyncCompileConfig config = new SyncCompileConfig();
            config.ApplyDefaults(projectRoot);
            return config;
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
