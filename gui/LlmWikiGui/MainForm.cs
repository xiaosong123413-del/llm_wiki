using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
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
        private Button saveButton;
        private Button startButton;
        private Button openWikiButton;
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
            string[] candidates = new string[]
            {
                baseDir,
                Path.GetFullPath(Path.Combine(baseDir, "..", "..")),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "llm-wiki-compiler-main")
            };

            foreach (string candidate in candidates)
            {
                if (File.Exists(Path.Combine(candidate, "sync-compile-config.json")))
                {
                    return candidate;
                }
            }

            return candidates[candidates.Length - 1];
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
                config.source_folders.Add(Convert.ToString(item));
            }
            config.ApplyDefaults(projectRoot);

            JavaScriptSerializer serializer = new JavaScriptSerializer();
            string json = serializer.Serialize(config);
            File.WriteAllText(configPath, PrettyJson(json), new UTF8Encoding(false));
            AppendLog("Config saved: " + configPath);
        }

        private static string PrettyJson(string compactJson)
        {
            StringBuilder output = new StringBuilder();
            int indent = 0;
            bool inString = false;
            for (int i = 0; i < compactJson.Length; i++)
            {
                char ch = compactJson[i];
                if (ch == '"' && (i == 0 || compactJson[i - 1] != '\\'))
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
            Text = "LLM Wiki Compiler Panel";
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
            titleLabel.Text = "LLM Wiki 一键同步编译";
            titleLabel.Font = new Font(Font.FontFamily, 16F, FontStyle.Bold);
            titleLabel.AutoSize = true;
            titleLabel.Margin = new Padding(0, 0, 0, 12);
            layout.Controls.Add(titleLabel, 0, 0);

            targetVaultTextBox = new TextBox();
            targetVaultTextBox.Dock = DockStyle.Top;
            targetVaultTextBox.Margin = new Padding(0, 0, 0, 12);
            layout.Controls.Add(WrapWithLabel("目标 vault", targetVaultTextBox), 0, 1);

            sourceFoldersListBox = new ListBox();
            sourceFoldersListBox.Dock = DockStyle.Fill;
            sourceFoldersListBox.HorizontalScrollbar = true;
            layout.Controls.Add(WrapWithLabel("同步源文件夹（可添加多个）", sourceFoldersListBox), 0, 2);

            FlowLayoutPanel sourceButtons = new FlowLayoutPanel();
            sourceButtons.AutoSize = true;
            sourceButtons.Margin = new Padding(0, 8, 0, 12);
            sourceButtons.Controls.Add(CreateButton("添加源文件夹", OnAddSourceFolder));
            sourceButtons.Controls.Add(CreateButton("移除选中", OnRemoveSelectedFolder));
            saveButton = CreateButton("保存配置", OnSaveConfig);
            sourceButtons.Controls.Add(saveButton);
            sourceButtons.Controls.Add(CreateButton("打开配置文件", OnOpenConfig));
            layout.Controls.Add(sourceButtons, 0, 3);

            FlowLayoutPanel runButtons = new FlowLayoutPanel();
            runButtons.AutoSize = true;
            runButtons.Margin = new Padding(0, 0, 0, 12);
            startButton = CreateButton("开始同步并编译", OnStartCompile);
            openWikiButton = CreateButton("打开 wiki 输出", OnOpenWiki);
            runButtons.Controls.Add(startButton);
            runButtons.Controls.Add(openWikiButton);
            layout.Controls.Add(runButtons, 0, 4);

            logTextBox = new TextBox();
            logTextBox.Dock = DockStyle.Fill;
            logTextBox.Multiline = true;
            logTextBox.ScrollBars = ScrollBars.Both;
            logTextBox.WordWrap = false;
            logTextBox.ReadOnly = true;
            logTextBox.Font = new Font("Consolas", 9F);
            layout.Controls.Add(WrapWithLabel("运行日志", logTextBox), 0, 5);

            Label hintLabel = new Label();
            hintLabel.AutoSize = true;
            hintLabel.Text = "说明：保存配置后点击开始。程序会调用 Node 同步编译，不会打开 PowerShell 黑窗口。";
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

            AppendLog("Project root: " + projectRoot);
            AppendLog("Config: " + configPath);
        }

        private void OnAddSourceFolder(object sender, EventArgs e)
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择一个同步源文件夹。可重复点击添加多个。";
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
            }
            else
            {
                MessageBox.Show(this, "wiki 输出目录还不存在。先运行一次编译。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void OnStartCompile(object sender, EventArgs e)
        {
            if (runningProcess != null && !runningProcess.HasExited)
            {
                MessageBox.Show(this, "已有同步编译任务正在运行。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            if (sourceFoldersListBox.Items.Count == 0)
            {
                MessageBox.Show(this, "请先添加至少一个同步源文件夹。", "缺少源文件夹", MessageBoxButtons.OK, MessageBoxIcon.Warning);
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
            AppendLog("Starting sync + compile...");
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
                AppendLog(e.Data);
            }
        }

        private void OnProcessExited(object sender, EventArgs e)
        {
            int exitCode = runningProcess.ExitCode;
            BeginInvoke(new Action(delegate
            {
                startButton.Enabled = true;
                AppendLog("Process exited with code " + exitCode + ".");
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
            if (runningProcess != null && !runningProcess.HasExited)
            {
                DialogResult result = MessageBox.Show(
                    this,
                    "同步编译仍在运行，关闭窗口会停止当前任务。确定关闭？",
                    "确认关闭",
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
                target_vault = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "ai的仓库");
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
                    "ai知识库（第二大脑）__概念__*",
                    "ai知识库（第二大脑）__项目__*",
                    "02_领域__*",
                    "01_项目__*",
                    "03_资源__*",
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
