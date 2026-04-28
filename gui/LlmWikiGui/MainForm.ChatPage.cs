using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed partial class MainForm
    {
        private Panel BuildChatViewPanel()
        {
            Panel workspacePanel = new Panel();
            workspacePanel.Name = "workspacePanel";
            workspacePanel.Dock = DockStyle.Fill;
            workspacePanel.BackColor = Theme.Background;
            workspacePanel.Padding = new Padding(Theme.SpaceLG);

            conversationSplit = new ThemedSplitContainer();
            conversationSplit.Dock = DockStyle.Fill;
            conversationSplit.Panel1MinSize = 50;
            conversationSplit.Panel2MinSize = 50;
            conversationSplit.SplitterMoved += OnLayoutSplitterMoved;
            conversationSplit.Panel1.Controls.Add(BuildConversationColumn());

            chatPreviewSplit = new ThemedSplitContainer();
            chatPreviewSplit.Dock = DockStyle.Fill;
            chatPreviewSplit.Panel1MinSize = 50;
            chatPreviewSplit.Panel2MinSize = 50;
            chatPreviewSplit.Panel2Collapsed = true;
            chatPreviewSplit.SplitterMoved += OnLayoutSplitterMoved;
            chatPreviewSplit.Panel1.Controls.Add(BuildChatWorkspace());
            chatPreviewSplit.Panel2.Controls.Add(BuildPreviewPanel());

            conversationSplit.Panel2.Controls.Add(chatPreviewSplit);
            workspacePanel.Controls.Add(conversationSplit);
            return workspacePanel;
        }

        private Panel BuildConversationColumn()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Fill;
            panel.Padding = new Padding(0, 0, Theme.SpaceLG, 0);
            panel.BackColor = Theme.Background;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));

            Button newChatButton = UiFactory.CreateSecondaryButton("\u002b \u65b0\u5bf9\u8bdd", OnNewChat);
            newChatButton.Width = 180;
            newChatButton.Height = 40;
            layout.Controls.Add(newChatButton, 0, 0);

            emptyConversationLabel = new Label();
            emptyConversationLabel.Text = "\u6682\u65e0\u5bf9\u8bdd";
            emptyConversationLabel.AutoSize = false;
            emptyConversationLabel.Width = 220;
            emptyConversationLabel.Height = 40;
            emptyConversationLabel.BackColor = Theme.PrimaryLighter;
            emptyConversationLabel.ForeColor = Theme.TextSecondary;
            emptyConversationLabel.TextAlign = ContentAlignment.MiddleCenter;
            emptyConversationLabel.Font = Theme.CreateUiFont(13F, FontStyle.Regular);
            emptyConversationLabel.Margin = new Padding(0, Theme.SpaceMD, 0, Theme.SpaceMD);
            layout.Controls.Add(emptyConversationLabel, 0, 1);

            SurfacePanel listCard = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceSM));
            listCard.Dock = DockStyle.Fill;
            conversationListBox = new ListBox();
            conversationListBox.Dock = DockStyle.Fill;
            conversationListBox.Visible = false;
            UiFactory.StyleListBox(conversationListBox);
            conversationListBox.DrawItem += OnListBoxDrawItem;
            listCard.Controls.Add(conversationListBox);
            layout.Controls.Add(listCard, 0, 2);

            panel.Controls.Add(layout);
            return panel;
        }

        private Panel BuildChatWorkspace()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Theme.Background;
            panel.Padding = new Padding(Theme.SpaceLG, 0, 0, 0);

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            SurfacePanel messageCard = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceXL));
            messageCard.Dock = DockStyle.Fill;

            Panel messageHost = new Panel();
            messageHost.Dock = DockStyle.Fill;
            messageHost.BackColor = Theme.Background;

            chatEmptyStatePanel = BuildChatEmptyState();
            messageHost.Controls.Add(chatEmptyStatePanel);

            messageFlowPanel = new FlowLayoutPanel();
            messageFlowPanel.Dock = DockStyle.Fill;
            messageFlowPanel.FlowDirection = FlowDirection.TopDown;
            messageFlowPanel.WrapContents = false;
            messageFlowPanel.AutoScroll = true;
            messageFlowPanel.Visible = false;
            messageFlowPanel.BackColor = Theme.Background;
            messageHost.Controls.Add(messageFlowPanel);

            queryResultTextBox = new TextBox();
            queryResultTextBox.Visible = false;
            queryResultTextBox.Multiline = true;
            queryResultTextBox.ReadOnly = true;
            messageHost.Controls.Add(queryResultTextBox);

            messageCard.Controls.Add(messageHost);
            layout.Controls.Add(messageCard, 0, 0);

            currentContextLabel = UiFactory.CreateCaption("\u5f53\u524d\u4e0a\u4e0b\u6587\uff1a\u672a\u9009\u4e2d\u6587\u4ef6", Theme.TextMuted);
            currentContextLabel.Margin = new Padding(0, Theme.SpaceMD, 0, Theme.SpaceMD);
            layout.Controls.Add(currentContextLabel, 0, 1);

            layout.Controls.Add(BuildInputBar(), 0, 2);
            panel.Controls.Add(layout);
            return panel;
        }

        private Panel BuildChatEmptyState()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Theme.Background;

            FlowLayoutPanel center = new FlowLayoutPanel();
            center.FlowDirection = FlowDirection.TopDown;
            center.WrapContents = false;
            center.AutoSize = true;
            center.Anchor = AnchorStyles.None;
            center.Location = new Point(0, 0);

            Label icon = new Label();
            icon.Text = "\uE8BD";
            icon.AutoSize = true;
            icon.Font = Theme.CreateIconFont(54F);
            icon.ForeColor = Theme.TextMuted;
            icon.Margin = new Padding(0, 0, 0, Theme.SpaceLG);
            center.Controls.Add(icon);

            Label title = new Label();
            title.Text = "\u5f00\u59cb\u65b0\u5bf9\u8bdd";
            title.AutoSize = true;
            title.Font = Theme.CreateUiFont(16F, FontStyle.Bold);
            title.ForeColor = Theme.TextPrimary;
            title.Margin = new Padding(0, 0, 0, Theme.SpaceSM);
            center.Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = "\u70b9\u51fb\u300c+ \u65b0\u5bf9\u8bdd\u300d\u5f00\u59cb";
            subtitle.AutoSize = true;
            subtitle.Font = Theme.CreateUiFont(13F, FontStyle.Regular);
            subtitle.ForeColor = Theme.TextMuted;
            center.Controls.Add(subtitle);

            panel.Controls.Add(center);
            panel.Resize += delegate
            {
                center.Left = Math.Max(0, (panel.ClientSize.Width - center.Width) / 2);
                center.Top = Math.Max(0, (panel.ClientSize.Height - center.Height) / 2);
            };
            return panel;
        }

        private Control BuildInputBar()
        {
            SurfacePanel shell = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceMD, Theme.SpaceSM, Theme.SpaceSM, Theme.SpaceSM));
            shell.Height = Theme.InputHeight + Theme.SpaceSM * 2;
            shell.FillColor = Theme.PrimaryLighter;
            shell.BorderColor = Theme.Border;

            TableLayoutPanel inputBar = new TableLayoutPanel();
            inputBar.Dock = DockStyle.Fill;
            inputBar.ColumnCount = 2;
            inputBar.RowCount = 1;
            inputBar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            inputBar.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));

            queryTextBox = new TextBox();
            queryTextBox.Dock = DockStyle.Fill;
            queryTextBox.BorderStyle = BorderStyle.None;
            queryTextBox.BackColor = Theme.PrimaryLighter;
            queryTextBox.ForeColor = Theme.TextPrimary;
            queryTextBox.Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            inputBar.Controls.Add(queryTextBox, 0, 0);

            queryButton = UiFactory.CreatePrimaryButton("\uE122", OnStartQuery);
            queryButton.Width = 36;
            queryButton.Height = 36;
            queryButton.Font = Theme.CreateIconFont(14F);
            queryButton.Padding = new Padding(0);
            inputBar.Controls.Add(queryButton, 1, 0);

            querySaveButton = UiFactory.CreateSecondaryButton(LegacyQuerySaveLabel, OnStartQueryAndSave);
            querySaveButton.Visible = false;
            inputBar.Controls.Add(querySaveButton, 1, 0);
            querySaveButton.SendToBack();

            shell.Controls.Add(inputBar);
            queryTextBox.Enter += delegate { shell.BorderColor = Theme.BorderFocus; shell.Invalidate(); };
            queryTextBox.Leave += delegate { shell.BorderColor = Theme.Border; shell.Invalidate(); };
            return shell;
        }

        private Panel BuildPreviewPanel()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Fill;
            panel.Padding = new Padding(Theme.SpaceLG, 0, 0, 0);
            panel.BackColor = Theme.Background;

            SurfacePanel card = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceXL));
            card.Dock = DockStyle.Fill;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));

            TableLayoutPanel header = new TableLayoutPanel();
            header.Dock = DockStyle.Fill;
            header.ColumnCount = 2;
            header.RowCount = 1;
            header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            header.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));

            header.Controls.Add(UiFactory.CreateTitle("\u9875\u9762"), 0, 0);

            previewCloseButton = UiFactory.CreateToolButton("\uE711", delegate { HidePreviewPanel(); });
            previewCloseButton.Font = Theme.CreateIconFont(12F);
            previewCloseButton.Width = 32;
            previewCloseButton.Height = 32;
            header.Controls.Add(previewCloseButton, 1, 0);
            layout.Controls.Add(header, 0, 0);

            previewPathLabel = UiFactory.CreateCaption("\u672a\u6253\u5f00\u6587\u4ef6", Theme.TextMuted);
            previewPathLabel.Margin = new Padding(0, Theme.SpaceSM, 0, Theme.SpaceLG);
            layout.Controls.Add(previewPathLabel, 0, 1);

            SurfacePanel readShell = UiFactory.CreateCard(Theme.RadiusMD, new Padding(Theme.SpaceLG));
            readShell.FillColor = Theme.Background;
            previewTextBox = new RichTextBox();
            previewTextBox.Dock = DockStyle.Fill;
            previewTextBox.ReadOnly = true;
            previewTextBox.BorderStyle = BorderStyle.None;
            previewTextBox.BackColor = Theme.Background;
            previewTextBox.ForeColor = Theme.TextPrimary;
            previewTextBox.Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            previewTextBox.ScrollBars = RichTextBoxScrollBars.Vertical;
            previewTextBox.WordWrap = true;
            previewTextBox.DetectUrls = true;
            previewTextBox.ShortcutsEnabled = true;
            readShell.Controls.Add(previewTextBox);
            layout.Controls.Add(readShell, 0, 2);

            card.Controls.Add(layout);
            panel.Controls.Add(card);
            return panel;
        }

        private void OnNewChat(object sender, EventArgs e)
        {
            conversationCount++;
            string title = "\u5bf9\u8bdd " + conversationCount.ToString("00");
            conversationListBox.Items.Insert(0, title);
            conversationListBox.Visible = true;
            emptyConversationLabel.Visible = false;
            conversationListBox.SelectedIndex = 0;
            queryResultTextBox.Clear();
            messageFlowPanel.Controls.Clear();
            messageFlowPanel.Visible = false;
            chatEmptyStatePanel.Visible = true;
            queryTextBox.Clear();
            currentContextLabel.Text = "\u5f53\u524d\u4e0a\u4e0b\u6587\uff1a\u672a\u9009\u4e2d\u6587\u4ef6";
            HidePreviewPanel();
        }

        private void EnsureConversation()
        {
            if (conversationListBox.Items.Count == 0)
            {
                OnNewChat(this, EventArgs.Empty);
            }
        }

        private void AppendUserMessage(string text)
        {
            ShowMessageSurface();
            queryResultTextBox.AppendText("\u4f60\uff1a" + Environment.NewLine + text + Environment.NewLine + Environment.NewLine);
            AddMessageBubble(text, true);
        }

        private void AppendAssistantMessage(string text)
        {
            ShowMessageSurface();
            queryResultTextBox.AppendText("LLM Wiki\uff1a" + Environment.NewLine + text + Environment.NewLine + Environment.NewLine);
            AddMessageBubble(text, false);
        }

        private void AddMessageBubble(string text, bool fromUser)
        {
            Panel row = new Panel();
            row.Width = Math.Max(320, messageFlowPanel.ClientSize.Width - SystemInformation.VerticalScrollBarWidth - Theme.SpaceSM);
            row.Height = 12;
            row.Margin = new Padding(0, 0, 0, Theme.SpaceMD);

            SurfacePanel bubble = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceLG, Theme.SpaceMD, Theme.SpaceLG, Theme.SpaceMD));
            bubble.FillColor = fromUser ? Theme.Primary : Theme.PrimaryLighter;
            bubble.BorderColor = fromUser ? Theme.Primary : Theme.Border;
            bubble.MaximumSize = new Size(Math.Max(260, row.Width - 80), 0);
            bubble.AutoSize = true;
            bubble.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            bubble.Anchor = fromUser ? AnchorStyles.Top | AnchorStyles.Right : AnchorStyles.Top | AnchorStyles.Left;

            Label body = new Label();
            body.AutoSize = true;
            body.MaximumSize = new Size(Math.Max(220, row.Width - 110), 0);
            body.Text = text;
            body.ForeColor = fromUser ? Theme.TextOnPrimary : Theme.TextPrimary;
            body.Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            bubble.Controls.Add(body);

            bubble.Width = Math.Min(bubble.PreferredSize.Width, row.Width - 24);
            bubble.Height = bubble.PreferredSize.Height;
            bubble.Left = fromUser ? Math.Max(0, row.Width - bubble.Width - 4) : 0;
            bubble.Top = 0;

            row.Height = bubble.Height;
            row.Controls.Add(bubble);
            messageFlowPanel.Controls.Add(row);
            messageFlowPanel.ScrollControlIntoView(row);
        }

        private void ShowMessageSurface()
        {
            chatEmptyStatePanel.Visible = false;
            messageFlowPanel.Visible = true;
        }

        private void OpenPreviewForNode(TreeNode node)
        {
            string path = node == null ? null : node.Tag as string;
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            {
                return;
            }

            currentPreviewPath = path;
            previewPathLabel.Text = Path.GetFileName(path);
            RenderPreviewMarkdown(ReadTextFileSafe(path));
            currentContextLabel.Text = "\u5f53\u524d\u9884\u89c8\uff1a" + Path.GetFileName(path);
            ShowPreviewPanel();
        }

        private void RenderPreviewMarkdown(string markdown)
        {
            if (previewTextBox == null)
            {
                return;
            }

            previewTextBox.SuspendLayout();
            previewTextBox.Clear();
            previewTextBox.SelectionBullet = false;
            previewTextBox.SelectionIndent = 0;
            previewTextBox.SelectionHangingIndent = 0;
            previewTextBox.SelectionRightIndent = 0;
            previewTextBox.SelectionBackColor = Theme.Background;

            string normalized = StripYamlFrontMatter(markdown)
                .Replace("\r\n", "\n")
                .Replace('\r', '\n');

            bool inCodeBlock = false;
            foreach (string rawLine in normalized.Split('\n'))
            {
                string line = rawLine.TrimEnd();
                string trimmed = line.Trim();

                if (trimmed.StartsWith("```", StringComparison.Ordinal))
                {
                    inCodeBlock = !inCodeBlock;
                    continue;
                }

                if (inCodeBlock)
                {
                    AppendPreviewBlock(line, Theme.CreateMonoFont(12F, FontStyle.Regular), Theme.TextPrimary, Theme.PrimaryLighter, false, true);
                    continue;
                }

                int headingLevel = CountHeadingLevel(trimmed);
                if (headingLevel > 0)
                {
                    AppendPreviewBlock(
                        trimmed.Substring(headingLevel).TrimStart(),
                        GetHeadingFont(headingLevel),
                        Theme.TextPrimary,
                        Theme.Background,
                        false,
                        true);
                    continue;
                }

                if (trimmed.StartsWith("- ", StringComparison.Ordinal) ||
                    trimmed.StartsWith("* ", StringComparison.Ordinal) ||
                    trimmed.StartsWith("+ ", StringComparison.Ordinal))
                {
                    AppendPreviewBlock(trimmed.Substring(2).TrimStart(), Theme.CreateUiFont(14F, FontStyle.Regular), Theme.TextPrimary, Theme.Background, true, false);
                    continue;
                }

                if (trimmed.Length == 0)
                {
                    previewTextBox.AppendText(Environment.NewLine);
                    continue;
                }

                AppendPreviewBlock(line, Theme.CreateUiFont(14F, FontStyle.Regular), Theme.TextPrimary, Theme.Background, false, false);
            }

            previewTextBox.SelectionStart = 0;
            previewTextBox.SelectionLength = 0;
            previewTextBox.ResumeLayout();
        }

        private void AppendPreviewBlock(string text, Font font, Color color, Color background, bool bullet, bool addSpacing)
        {
            previewTextBox.SelectionStart = previewTextBox.TextLength;
            previewTextBox.SelectionLength = 0;
            previewTextBox.SelectionFont = font;
            previewTextBox.SelectionColor = color;
            previewTextBox.SelectionBackColor = background;
            previewTextBox.SelectionBullet = bullet;
            previewTextBox.SelectionIndent = bullet ? Theme.SpaceLG : 0;
            previewTextBox.SelectionHangingIndent = bullet ? Theme.SpaceSM : 0;
            previewTextBox.AppendText(text + Environment.NewLine);
            previewTextBox.SelectionBullet = false;
            previewTextBox.SelectionIndent = 0;
            previewTextBox.SelectionHangingIndent = 0;
            previewTextBox.SelectionBackColor = Theme.Background;

            if (addSpacing)
            {
                previewTextBox.AppendText(Environment.NewLine);
            }
        }

        private static string StripYamlFrontMatter(string markdown)
        {
            if (string.IsNullOrWhiteSpace(markdown))
            {
                return string.Empty;
            }

            string normalized = markdown.Replace("\r\n", "\n");
            if (!normalized.StartsWith("---\n", StringComparison.Ordinal))
            {
                return markdown;
            }

            int closingMarker = normalized.IndexOf("\n---\n", 4, StringComparison.Ordinal);
            if (closingMarker < 0)
            {
                return markdown;
            }

            return normalized.Substring(closingMarker + 5);
        }

        private static int CountHeadingLevel(string line)
        {
            int level = 0;
            while (level < line.Length && level < 6 && line[level] == '#')
            {
                level++;
            }

            if (level == 0 || level >= line.Length || line[level] != ' ')
            {
                return 0;
            }

            return level;
        }

        private static Font GetHeadingFont(int level)
        {
            switch (level)
            {
                case 1:
                    return Theme.CreateUiFont(22F, FontStyle.Bold);
                case 2:
                    return Theme.CreateUiFont(18F, FontStyle.Bold);
                case 3:
                    return Theme.CreateUiFont(16F, FontStyle.Bold);
                default:
                    return Theme.CreateUiFont(14F, FontStyle.Bold);
            }
        }

        private void ShowPreviewPanel()
        {
            if (chatPreviewSplit.Panel2Collapsed)
            {
                chatPreviewSplit.Panel2Collapsed = false;
                ApplyPanelStateToLayout();
            }
        }

        private void HidePreviewPanel()
        {
            if (!chatPreviewSplit.Panel2Collapsed)
            {
                CapturePanelState();
                chatPreviewSplit.Panel2Collapsed = true;
            }
        }
    }
}
