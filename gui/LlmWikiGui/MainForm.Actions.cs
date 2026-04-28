using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed partial class MainForm
    {
        private void OnConfirmCheck(object sender, EventArgs e)
        {
            DialogResult result = AppDialog.ShowConfirmation(this, "\u68c0\u67e5", "\u662f\u5426\u786e\u8ba4\u68c0\u67e5\uff1f");
            if (result == DialogResult.Yes)
            {
                OnRunLint(sender, e);
            }
        }

        private void OnConfirmSync(object sender, EventArgs e)
        {
            DialogResult result = AppDialog.ShowConfirmation(this, "\u540c\u6b65", "\u662f\u5426\u786e\u8ba4\u540c\u6b65\uff1f");
            if (result == DialogResult.Yes)
            {
                OnStartCompile(sender, e);
            }
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
                        RefreshInitializeSummary();
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
            RefreshInitializeSummary();
        }

        private void OnSaveConfig(object sender, EventArgs e)
        {
            SaveConfig();
            RefreshInitializeSummary();
            LoadFileTree();
        }

        private void OnSaveAllSettings(object sender, EventArgs e)
        {
            SaveConfig();
            SaveEnvSettings();
            RefreshInitializeSummary();
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

            AppDialog.ShowInfo(this, "\u63d0\u793a", "wiki \u8f93\u51fa\u76ee\u5f55\u8fd8\u4e0d\u5b58\u5728\uff0c\u8bf7\u5148\u8fd0\u884c\u4e00\u6b21\u7f16\u8bd1\u3002");
        }

        private void OnStartWebViewer(object sender, EventArgs e)
        {
            string wikiRoot = targetVaultTextBox == null ? config.target_vault : targetVaultTextBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(wikiRoot) || !Directory.Exists(wikiRoot))
            {
                AppDialog.ShowWarning(this, "\u7f3a\u5c11\u4ed3\u5e93", "\u8bf7\u5148\u914d\u7f6e\u6709\u6548\u7684\u76ee\u6807\u4ed3\u5e93\uff0c\u518d\u542f\u52a8\u672c\u5730Web\u9884\u89c8\u5668\u3002");
                return;
            }

            try
            {
                Cursor previousCursor = Cursor.Current;
                Cursor.Current = Cursors.WaitCursor;
                try
                {
                    EnsureAuditDirectories(wikiRoot);
                    if (!TryReachWebViewer())
                    {
                        AppendLog("\u6b63\u5728\u542f\u52a8\u672c\u5730Web\u9884\u89c8\u5668...");
                        StartWebViewerProcess(wikiRoot);
                        if (!WaitForWebViewerReady())
                        {
                            AppDialog.ShowWarning(this, "\u542f\u52a8\u5931\u8d25", "\u672c\u5730Web\u9884\u89c8\u5668\u542f\u52a8\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002");
                            return;
                        }
                    }

                    OpenWebViewerInBrowser();
                    AppendLog("\u5df2\u6253\u5f00\u672c\u5730Web\u9884\u89c8\u5668\uff1a" + WebViewerUrl);
                }
                finally
                {
                    Cursor.Current = previousCursor;
                }
            }
            catch (Exception ex)
            {
                AppendLog("\u542f\u52a8Web\u9884\u89c8\u5668\u5931\u8d25\uff1a" + ex.Message);
                AppDialog.ShowWarning(this, "\u542f\u52a8\u5931\u8d25", "\u542f\u52a8\u672c\u5730Web\u9884\u89c8\u5668\u5931\u8d25\uff1a" + ex.Message);
            }
        }

        private void EnsureAuditDirectories(string wikiRoot)
        {
            Directory.CreateDirectory(Path.Combine(wikiRoot, "audit"));
            Directory.CreateDirectory(Path.Combine(wikiRoot, "audit", "resolved"));
        }

        private bool TryReachWebViewer()
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(WebViewerUrl + "api/config");
                request.Method = "GET";
                request.Timeout = 1500;
                request.ReadWriteTimeout = 1500;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return response.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private void StartWebViewerProcess(string wikiRoot)
        {
            if (webViewerProcess != null && !webViewerProcess.HasExited)
            {
                return;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = "cmd.exe";
            startInfo.Arguments =
                "/c npm run web:start -- --wiki " +
                Quote(wikiRoot) +
                " --port 4175 --author " +
                Quote(Environment.UserName);
            startInfo.WorkingDirectory = projectRoot;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            webViewerProcess = Process.Start(startInfo);
        }

        private bool WaitForWebViewerReady()
        {
            for (int i = 0; i < 15; i++)
            {
                if (TryReachWebViewer())
                {
                    return true;
                }

                Thread.Sleep(1000);
            }

            return false;
        }

        private void OpenWebViewerInBrowser()
        {
            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = WebViewerUrl;
            startInfo.UseShellExecute = true;
            Process.Start(startInfo);
        }

        private void OnStartCompile(object sender, EventArgs e)
        {
            if (IsTaskRunning())
            {
                AppDialog.ShowInfo(this, "\u63d0\u793a", "\u5df2\u6709\u4efb\u52a1\u6b63\u5728\u8fd0\u884c\u3002");
                return;
            }

            if (sourceFoldersListBox.Items.Count == 0)
            {
                AppDialog.ShowWarning(this, "\u7f3a\u5c11\u6e90\u6587\u4ef6\u5939", "\u8bf7\u5148\u6dfb\u52a0\u81f3\u5c11\u4e00\u4e2a\u540c\u6b65\u6e90\u6587\u4ef6\u5939\u3002");
                return;
            }

            SaveConfig();
            systemCheckDecisionTextBox.Text = BuildSystemCheckDecisionText();
            StartCommandProcess(
                "\u6b63\u5728\u5f00\u59cb\u540c\u6b65\u5e76\u7f16\u8bd1...",
                projectRoot,
                Path.Combine(projectRoot, "scripts", "sync-compile.mjs"));
        }

        private void OnStartWatch(object sender, EventArgs e)
        {
            if (IsTaskRunning())
            {
                AppDialog.ShowInfo(this, "\u63d0\u793a", "\u5df2\u6709\u4efb\u52a1\u6b63\u5728\u8fd0\u884c\u3002");
                return;
            }

            if (sourceFoldersListBox.Items.Count == 0)
            {
                AppDialog.ShowWarning(this, "\u7f3a\u5c11\u6e90\u6587\u4ef6\u5939", "\u8bf7\u5148\u6dfb\u52a0\u81f3\u5c11\u4e00\u4e2a\u540c\u6b65\u6e90\u6587\u4ef6\u5939\u3002");
                return;
            }

            SaveConfig();
            StartCommandProcess(
                "\u6b63\u5728\u76d1\u542c\u6e90\u6587\u4ef6\u5939\u53d8\u5316\u5e76\u81ea\u52a8\u540c\u6b65\u7f16\u8bd1...",
                projectRoot,
                null,
                false,
                Path.Combine(projectRoot, "scripts", "watch-sync-compile.mjs"));
        }

        private void OnStartQuery(object sender, EventArgs e)
        {
            StartQueryProcess(false);
        }

        private void OnStartQueryAndSave(object sender, EventArgs e)
        {
            StartQueryProcess(true);
        }

        private void OnRunLint(object sender, EventArgs e)
        {
            if (IsTaskRunning())
            {
                AppDialog.ShowInfo(this, "\u63d0\u793a", "\u5df2\u6709\u4efb\u52a1\u6b63\u5728\u8fd0\u884c\u3002");
                return;
            }

            SaveConfig();
            systemCheckDecisionTextBox.Text = BuildSystemCheckDecisionText();
            StartCommandProcess(
                "\u6b63\u5728\u8fd0\u884c wiki \u7cfb\u7edf\u68c0\u67e5...",
                targetVaultTextBox.Text.Trim(),
                Path.Combine(projectRoot, "dist", "cli.js"),
                "lint");
        }

        private void StartQueryProcess(bool saveResult)
        {
            if (IsTaskRunning())
            {
                AppDialog.ShowInfo(this, "\u63d0\u793a", "\u5df2\u6709\u4efb\u52a1\u6b63\u5728\u8fd0\u884c\u3002");
                return;
            }

            string question = queryTextBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(question))
            {
                AppDialog.ShowWarning(this, "\u7f3a\u5c11\u95ee\u9898", "\u8bf7\u5148\u8f93\u5165\u95ee\u9898\u518d\u67e5\u8be2\u3002");
                return;
            }

            EnsureConversation();
            AppendUserMessage(question);

            if (!string.IsNullOrWhiteSpace(currentPreviewPath))
            {
                currentContextLabel.Text = "\u5f53\u524d\u4e0a\u4e0b\u6587\uff1a" + Path.GetFileName(currentPreviewPath);
            }

            SaveConfig();
            List<string> arguments = new List<string>();
            arguments.Add(Path.Combine(projectRoot, "dist", "cli.js"));
            arguments.Add("query");
            if (saveResult)
            {
                arguments.Add("--save");
            }
            arguments.Add(question);

            StartCommandProcess(
                saveResult
                    ? "\u6b63\u5728\u67e5\u8be2\u5e76\u4fdd\u5b58 wiki \u7ed3\u679c..."
                    : "\u6b63\u5728\u67e5\u8be2 wiki...",
                targetVaultTextBox.Text.Trim(),
                new Dictionary<string, string>
                {
                    { "LLMWIKI_QUERY_OUTPUT_MODE", "gui-block" }
                },
                true,
                arguments.ToArray());

            queryTextBox.Clear();
        }

        private void StartCommandProcess(string startMessage, string workingDirectory, params string[] arguments)
        {
            StartCommandProcess(startMessage, workingDirectory, null, false, arguments);
        }

        private void StartCommandProcess(
            string startMessage,
            string workingDirectory,
            Dictionary<string, string> environmentVariables,
            bool clearQueryResult,
            params string[] arguments)
        {
            string nodePath = ResolveNodePath();
            logTextBox.Clear();
            collectingQueryResult = false;
            collectedQueryResult.Clear();
            if (clearQueryResult)
            {
                queryResultTextBox.AppendText("");
            }

            AppendLog(startMessage);
            AppendLog("Node: " + nodePath);
            AppendLog("\u5de5\u4f5c\u76ee\u5f55: " + workingDirectory);
            AppendLog("\u547d\u4ee4: " + BuildCommandLine(arguments));

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = nodePath;
            startInfo.Arguments = BuildArguments(arguments);
            startInfo.WorkingDirectory = workingDirectory;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;
            startInfo.StandardOutputEncoding = Encoding.UTF8;
            startInfo.StandardErrorEncoding = Encoding.UTF8;

            if (environmentVariables != null)
            {
                foreach (KeyValuePair<string, string> pair in environmentVariables)
                {
                    startInfo.EnvironmentVariables[pair.Key] = pair.Value;
                }
            }

            runningProcess = new Process();
            runningProcess.StartInfo = startInfo;
            runningProcess.EnableRaisingEvents = true;
            runningProcess.OutputDataReceived += OnProcessOutput;
            runningProcess.ErrorDataReceived += OnProcessOutput;
            runningProcess.Exited += OnProcessExited;

            SetActionButtonsEnabled(false);
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

        private static string BuildArguments(IEnumerable<string> arguments)
        {
            StringBuilder builder = new StringBuilder();
            bool first = true;
            foreach (string argument in arguments)
            {
                if (!first)
                {
                    builder.Append(" ");
                }

                builder.Append(Quote(argument));
                first = false;
            }

            return builder.ToString();
        }

        private static string BuildCommandLine(IEnumerable<string> arguments)
        {
            StringBuilder builder = new StringBuilder("node");
            foreach (string argument in arguments)
            {
                builder.Append(" ");
                builder.Append(Quote(argument));
            }

            return builder.ToString();
        }

        private bool IsTaskRunning()
        {
            return runningProcess != null && !runningProcess.HasExited;
        }

        private void SetActionButtonsEnabled(bool enabled)
        {
            if (startCompileButton != null) startCompileButton.Enabled = enabled;
            if (watchButton != null) watchButton.Enabled = enabled;
            if (queryButton != null) queryButton.Enabled = enabled;
            if (querySaveButton != null) querySaveButton.Enabled = enabled;
            if (lintButton != null) lintButton.Enabled = enabled;
        }

        private void OnProcessOutput(object sender, DataReceivedEventArgs e)
        {
            if (e.Data == null)
            {
                return;
            }

            string line = StripAnsi(e.Data);
            if (line == QueryResultStartMarker)
            {
                collectingQueryResult = true;
                collectedQueryResult.Clear();
                return;
            }

            if (line == QueryResultEndMarker)
            {
                collectingQueryResult = false;
                if (collectedQueryResult.Length > 0)
                {
                    AppendAssistantMessage(collectedQueryResult.ToString().Trim());
                }
                return;
            }

            if (collectingQueryResult)
            {
                if (collectedQueryResult.Length > 0)
                {
                    collectedQueryResult.AppendLine();
                }
                collectedQueryResult.Append(line);
                return;
            }

            if (line.Length > 0)
            {
                AppendLog(line);
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
                SetActionButtonsEnabled(true);
                AppendLog("\u8fdb\u7a0b\u9000\u51fa\uff0c\u4ee3\u7801\uff1a" + exitCode + "\u3002");
                runningProcess = null;
            }));
        }

        private void AppendLog(string line)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(AppendLog), line);
                return;
            }

            if (logTextBox != null)
            {
                logTextBox.AppendText("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + line + Environment.NewLine);
            }
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            SavePanelState();

            if (runningProcess == null || runningProcess.HasExited)
            {
                return;
            }

            DialogResult result = AppDialog.ShowConfirmation(
                this,
                "\u786e\u8ba4\u5173\u95ed",
                "\u5f53\u524d\u4efb\u52a1\u4ecd\u5728\u8fd0\u884c\u3002\u5173\u95ed\u7a97\u53e3\u4f1a\u505c\u6b62\u5f53\u524d\u4efb\u52a1\uff0c\u786e\u8ba4\u5173\u95ed\u5417\uff1f");
            if (result != DialogResult.Yes)
            {
                e.Cancel = true;
                return;
            }

            runningProcess.Kill();
        }
    }
}
