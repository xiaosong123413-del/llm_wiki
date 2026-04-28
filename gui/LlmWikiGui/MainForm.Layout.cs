using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed partial class MainForm
    {
        private void BuildMainShell()
        {
            Text = "LLM Wiki";
            Width = 1480;
            Height = 900;
            MinimumSize = new Size(1160, 720);
            WindowState = FormWindowState.Normal;
            StartPosition = FormStartPosition.CenterScreen;
            Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            BackColor = Theme.Background;
            FormBorderStyle = FormBorderStyle.None;

            TableLayoutPanel root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.ColumnCount = 1;
            root.RowCount = 2;
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, Theme.TitleBarHeight));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));

            titleBarPanel = BuildTitleBar();
            root.Controls.Add(titleBarPanel, 0, 0);

            Panel pageHost = new Panel();
            pageHost.Dock = DockStyle.Fill;
            pageHost.BackColor = Theme.Background;
            root.Controls.Add(pageHost, 0, 1);

            shellPagePanel = new Panel();
            shellPagePanel.Dock = DockStyle.Fill;
            shellPagePanel.BackColor = Theme.Background;
            pageHost.Controls.Add(shellPagePanel);

            mainSurface = new TableLayoutPanel();
            mainSurface.Dock = DockStyle.Fill;
            mainSurface.ColumnCount = 3;
            mainSurface.RowCount = 1;
            mainSurface.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Theme.NavBarWidth));
            mainSurface.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Theme.FilePanelWidth));
            mainSurface.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            shellPagePanel.Controls.Add(mainSurface);

            railSplit = new ThemedSplitContainer();
            railSplit.Dock = DockStyle.Fill;
            railSplit.Panel1MinSize = 50;
            railSplit.Panel2MinSize = 50;
            railSplit.SplitterWidth = 6;
            railSplit.IsSplitterFixed = true;
            railSplit.Panel1.Controls.Add(BuildNavRail());

            browserSplit = new ThemedSplitContainer();
            browserSplit.Dock = DockStyle.Fill;
            browserSplit.Panel1MinSize = 50;
            browserSplit.Panel2MinSize = 50;
            browserSplit.SplitterMoved += OnLayoutSplitterMoved;
            railSplit.Panel2.Controls.Add(browserSplit);

            fileBrowserPanel = BuildFileBrowserPanel();
            browserSplit.Panel1.Controls.Add(fileBrowserPanel);

            chatViewPanel = BuildChatViewPanel();
            reviewViewPanel = BuildReviewViewPanel();
            settingsViewPanel = BuildSettingsViewPanel();
            activityLogViewPanel = BuildActivityLogViewPanel();

            contentHost = new Panel();
            contentHost.Name = "contentHost";
            contentHost.Dock = DockStyle.Fill;
            contentHost.BackColor = Theme.Background;
            contentHost.Controls.Add(chatViewPanel);
            contentHost.Controls.Add(reviewViewPanel);
            contentHost.Controls.Add(settingsViewPanel);
            contentHost.Controls.Add(activityLogViewPanel);
            browserSplit.Panel2.Controls.Add(contentHost);

            mainSurface.Controls.Add(railSplit, 0, 0);
            mainSurface.SetColumnSpan(railSplit, 3);

            welcomePagePanel = BuildWelcomePage();
            initializePagePanel = BuildInitializePage();
            pageHost.Controls.Add(welcomePagePanel);
            pageHost.Controls.Add(initializePagePanel);

            Controls.Add(root);

            ShowMainView("chat");
            if (ShouldShowWelcomeFlow())
            {
                ShowWelcomePage();
            }
            else
            {
                shellPagePanel.Visible = true;
                welcomePagePanel.Visible = false;
                initializePagePanel.Visible = false;
            }

            HandleCreated += delegate
            {
                UpdateMaximizedBounds();
                UpdateTitleBarButtonsForWindowState();
            };
            Resize += delegate
            {
                UpdateMaximizedBounds();
                UpdateTitleBarButtonsForWindowState();
            };
            Shown += OnMainFormShown;
            FormClosing += OnFormClosing;
        }

        private TitleBarPanel BuildTitleBar()
        {
            TitleBarPanel bar = new TitleBarPanel();
            bar.BackColor = Theme.Background;
            bar.Dock = DockStyle.Fill;
            bar.Padding = new Padding(Theme.SpaceMD, 0, 0, 0);
            bar.BorderStyle = BorderStyle.None;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 5;
            layout.RowCount = 1;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Theme.TitleBarHeight));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Theme.TitleBarHeight));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Theme.TitleBarHeight));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 8F));

            FlowLayoutPanel brand = new FlowLayoutPanel();
            brand.Dock = DockStyle.Fill;
            brand.WrapContents = false;
            brand.FlowDirection = FlowDirection.LeftToRight;
            brand.Padding = new Padding(0, 8, 0, 0);

            SurfacePanel logo = new SurfacePanel();
            logo.Width = 20;
            logo.Height = 20;
            logo.FillColor = Theme.Primary;
            logo.BorderColor = Theme.Primary;
            logo.CornerRadius = Theme.RadiusSM;
            Label logoGlyph = new Label();
            logoGlyph.Text = "\uE8BD";
            logoGlyph.Dock = DockStyle.Fill;
            logoGlyph.TextAlign = ContentAlignment.MiddleCenter;
            logoGlyph.Font = Theme.CreateIconFont(11F);
            logoGlyph.ForeColor = Theme.TextOnPrimary;
            logo.Controls.Add(logoGlyph);
            brand.Controls.Add(logo);

            Label title = new Label();
            title.Text = "LLM Wiki";
            title.AutoSize = true;
            title.Margin = new Padding(10, 1, 0, 0);
            title.ForeColor = Theme.TextPrimary;
            title.Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            brand.Controls.Add(title);

            layout.Controls.Add(brand, 0, 0);
            titleBarMinimizeButton = CreateTitleBarButton(TitleBarMinimizeIcon, MinimizeWindow, false);
            titleBarMaximizeButton = CreateTitleBarButton(TitleBarMaximizeIcon, ToggleMaximizeWindow, false);
            titleBarCloseButton = CreateTitleBarButton(TitleBarCloseIcon, CloseWindow, true);
            layout.Controls.Add(titleBarMinimizeButton, 1, 0);
            layout.Controls.Add(titleBarMaximizeButton, 2, 0);
            layout.Controls.Add(titleBarCloseButton, 3, 0);
            UpdateTitleBarButtonsForWindowState();

            bar.Controls.Add(layout);
            return bar;
        }

        private Button CreateTitleBarButton(string icon, EventHandler handler, bool danger)
        {
            Button button = new Button();
            button.Text = icon;
            button.Width = Theme.TitleBarHeight;
            button.Height = Theme.TitleBarHeight;
            button.Margin = new Padding(0);
            button.Padding = new Padding(0);
            button.Dock = DockStyle.Fill;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0;
            button.BackColor = Theme.Background;
            button.ForeColor = Theme.TextSecondary;
            button.Font = Theme.CreateIconFont(12F);
            button.Click += handler;
            button.MouseEnter += delegate
            {
                button.BackColor = danger ? Theme.DangerLight : Theme.PrimaryLight;
                button.ForeColor = danger ? Theme.Danger : Theme.TextPrimary;
            };
            button.MouseLeave += delegate
            {
                button.BackColor = Theme.Background;
                button.ForeColor = Theme.TextSecondary;
            };
            button.Region = null;
            return button;
        }

        private Panel BuildNavRail()
        {
            Panel navRail = new Panel();
            navRail.Name = "navRail";
            navRail.Dock = DockStyle.Fill;
            navRail.Padding = new Padding(Theme.SpaceMD, Theme.SpaceLG, Theme.SpaceMD, Theme.SpaceLG);
            navRail.BackColor = Theme.Surface;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            FlowLayoutPanel topGroup = new FlowLayoutPanel();
            topGroup.AutoSize = true;
            topGroup.FlowDirection = FlowDirection.TopDown;
            topGroup.WrapContents = false;
            topGroup.Margin = new Padding(0);

            navToolTip = new ToolTip();
            navChatButton = CreateNavButton("\uE8BD", "\u5bf9\u8bdd", OnShowChat);
            navCheckButton = CreateNavButton("\uE73E", "\u68c0\u67e5", OnConfirmCheck);
            navSyncButton = CreateNavButton("\uE895", "\u540c\u6b65", OnConfirmSync);
            navReviewButton = CreateNavButton("\uE8A5", "\u5ba1\u67e5", OnShowReview);
            navLogButton = CreateNavButton("\uE9D9", "\u65e5\u5fd7", OnShowActivityLog);
            navWebButton = CreateNavButton("\uE8A7", "\u542f\u52a8\u672c\u5730Web\u9884\u89c8\u5668", OnStartWebViewer);
            navSettingsButton = CreateNavButton("\uE713", "\u8bbe\u7f6e", OnShowSettings);

            topGroup.Controls.Add(navChatButton);
            topGroup.Controls.Add(navCheckButton);
            topGroup.Controls.Add(navSyncButton);
            topGroup.Controls.Add(navReviewButton);
            topGroup.Controls.Add(navLogButton);
            layout.Controls.Add(topGroup, 0, 0);

            Panel spacer = new Panel();
            spacer.Dock = DockStyle.Fill;
            layout.Controls.Add(spacer, 0, 1);

            FlowLayoutPanel bottomGroup = new FlowLayoutPanel();
            bottomGroup.AutoSize = true;
            bottomGroup.FlowDirection = FlowDirection.TopDown;
            bottomGroup.WrapContents = false;
            bottomGroup.Margin = new Padding(0);
            bottomGroup.Controls.Add(navWebButton);
            bottomGroup.Controls.Add(navSettingsButton);
            layout.Controls.Add(bottomGroup, 0, 2);

            navRail.Controls.Add(layout);
            return navRail;
        }

        private Panel BuildReviewViewPanel()
        {
            Panel panel = new Panel();
            panel.Name = "reviewViewPanel";
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Theme.Background;
            panel.Padding = new Padding(Theme.SpaceXXL, Theme.SpaceXL, Theme.SpaceXXL, Theme.SpaceXXL);

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 4;
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            layout.Controls.Add(UiFactory.CreateTitle("\u5ba1\u67e5"), 0, 0);

            Label subtitle = UiFactory.CreateSectionTitle("\u5f85\u5904\u7406\u4e8b\u9879");
            subtitle.Margin = new Padding(0, Theme.SpaceLG, 0, Theme.SpaceLG);
            layout.Controls.Add(subtitle, 0, 1);

            SurfacePanel card = CreateCard(LegacyPendingItemsLabel);
            card.Padding = new Padding(Theme.SpaceXL);
            systemCheckDecisionTextBox = new TextBox();
            systemCheckDecisionTextBox.Dock = DockStyle.Fill;
            systemCheckDecisionTextBox.Multiline = true;
            systemCheckDecisionTextBox.ScrollBars = ScrollBars.Vertical;
            systemCheckDecisionTextBox.WordWrap = true;
            UiFactory.StyleReadOnlyTextBox(systemCheckDecisionTextBox, false);
            systemCheckDecisionTextBox.Text = BuildSystemCheckDecisionText();
            card.Controls.Add(systemCheckDecisionTextBox);
            layout.Controls.Add(card, 0, 2);

            FlowLayoutPanel actions = new FlowLayoutPanel();
            actions.AutoSize = true;
            actions.Margin = new Padding(0, Theme.SpaceLG, 0, 0);
            Button runButton = UiFactory.CreatePrimaryButton("\u8fd0\u884c\u7cfb\u7edf\u68c0\u67e5", OnConfirmCheck);
            runButton.Height = 40;
            Button openButton = UiFactory.CreateSecondaryButton("\u67e5\u770b\u4fdd\u5b58\u7ed3\u679c", OnOpenWiki);
            openButton.Height = 40;
            actions.Controls.Add(runButton);
            actions.Controls.Add(openButton);
            layout.Controls.Add(actions, 0, 3);

            panel.Controls.Add(layout);
            return panel;
        }

        private Panel BuildSettingsViewPanel()
        {
            Panel panel = new Panel();
            panel.Name = "settingsViewPanel";
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Theme.PrimaryLighter;
            panel.Padding = new Padding(0);

            Panel container = new Panel();
            container.Dock = DockStyle.Fill;
            container.AutoScroll = true;
            container.BackColor = Theme.PrimaryLighter;
            panel.Controls.Add(container);

            TableLayoutPanel settingsCanvas = new TableLayoutPanel();
            settingsCanvas.Name = "settingsCanvas";
            settingsCanvas.AutoSize = true;
            settingsCanvas.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            settingsCanvas.ColumnCount = 2;
            settingsCanvas.RowCount = 5;
            settingsCanvas.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            settingsCanvas.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            settingsCanvas.MaximumSize = new Size(1120, 0);
            settingsCanvas.MinimumSize = new Size(900, 0);
            settingsCanvas.Padding = new Padding(0, Theme.SpaceXXL, 0, Theme.SpaceXXL);
            settingsCanvas.Margin = new Padding(0);
            container.Controls.Add(settingsCanvas);

            Panel heroCard = BuildSettingsHeroCard();
            settingsCanvas.Controls.Add(heroCard, 0, 0);
            settingsCanvas.SetColumnSpan(heroCard, 2);

            Panel repositoryCard = CreateSettingsCard("\u4e00\u3001\u4ed3\u5e93\u4e0e\u540c\u6b65", BuildRepositorySettingsContent());
            settingsCanvas.Controls.Add(repositoryCard, 0, 1);
            settingsCanvas.SetColumnSpan(repositoryCard, 2);

            settingsCanvas.Controls.Add(CreateSettingsCard("\u4e8c\u3001LLM\u63d0\u4f9b\u5546", BuildProviderSettingsContent()), 0, 2);
            settingsCanvas.Controls.Add(CreateSettingsCard("\u4e09\u3001\u7f51\u7edc\u641c\u7d22api", BuildSearchSettingsContent()), 1, 2);

            Panel vectorCard = CreateSettingsCard("\u56db\u3001Vector Search / Embedding", BuildVectorSettingsContent());
            settingsCanvas.Controls.Add(vectorCard, 0, 3);
            settingsCanvas.SetColumnSpan(vectorCard, 2);

            FlowLayoutPanel footerActions = new FlowLayoutPanel();
            footerActions.AutoSize = true;
            footerActions.FlowDirection = FlowDirection.RightToLeft;
            footerActions.WrapContents = false;
            footerActions.Margin = new Padding(0, Theme.SpaceXL, 0, 0);
            footerActions.Controls.Add(UiFactory.CreateSecondaryButton("\u6253\u5f00\u914d\u7f6e", OnOpenConfig));
            footerActions.Controls.Add(UiFactory.CreatePrimaryButton("\u4fdd\u5b58\u5168\u90e8\u8bbe\u7f6e", OnSaveAllSettings));
            settingsCanvas.Controls.Add(footerActions, 0, 4);
            settingsCanvas.SetColumnSpan(footerActions, 2);

            container.Resize += delegate { CenterSettingsCanvas(container, settingsCanvas); };
            panel.HandleCreated += delegate { CenterSettingsCanvas(container, settingsCanvas); };

            return panel;
        }

        private Panel BuildActivityLogViewPanel()
        {
            Panel panel = new Panel();
            panel.Name = "activityLogViewPanel";
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Theme.Background;
            panel.Padding = new Padding(Theme.SpaceXXL, Theme.SpaceXL, Theme.SpaceXXL, Theme.SpaceXXL);

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));

            layout.Controls.Add(UiFactory.CreateTitle("\u6d3b\u52a8\u65e5\u5fd7"), 0, 0);

            Label subtitle = UiFactory.CreateSectionTitle("\u8fd0\u884c\u65e5\u5fd7");
            subtitle.Margin = new Padding(0, Theme.SpaceLG, 0, Theme.SpaceLG);
            layout.Controls.Add(subtitle, 0, 1);

            SurfacePanel card = CreateCard(LegacyRuntimeLogLabel);
            card.Padding = new Padding(Theme.SpaceLG);
            logTextBox = new TextBox();
            logTextBox.Dock = DockStyle.Fill;
            logTextBox.Multiline = true;
            logTextBox.ScrollBars = ScrollBars.Both;
            logTextBox.WordWrap = false;
            UiFactory.StyleReadOnlyTextBox(logTextBox, true);
            card.Controls.Add(logTextBox);
            layout.Controls.Add(card, 0, 2);

            panel.Controls.Add(layout);
            return panel;
        }

        private Panel BuildWelcomePage()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Theme.PrimaryLighter;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 40F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 60F));

            FlowLayoutPanel center = new FlowLayoutPanel();
            center.FlowDirection = FlowDirection.TopDown;
            center.WrapContents = false;
            center.AutoSize = true;
            center.Anchor = AnchorStyles.None;

            Label title = new Label();
            title.Text = "\u4ece\u8fd9\u91cc\u5f00\u542f\u4f60\u7684\u7b2c\u4e8c\u5927\u8111\uff01";
            title.AutoSize = true;
            title.ForeColor = Theme.TextPrimary;
            title.Font = Theme.CreateUiFont(24F, FontStyle.Bold);
            title.Margin = new Padding(0, 0, 0, Theme.SpaceXXL);
            center.Controls.Add(title);

            Button next = UiFactory.CreatePrimaryButton("\u70b9\u51fb\u4e0b\u4e00\u9875", delegate
            {
                ShowInitializePage();
            });
            next.Width = 200;
            next.Height = 48;
            center.Controls.Add(next);

            layout.Controls.Add(center, 0, 1);
            panel.Controls.Add(layout);
            return panel;
        }

        private Panel BuildInitializePage()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Theme.PrimaryLighter;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 25F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 75F));

            FlowLayoutPanel center = new FlowLayoutPanel();
            center.FlowDirection = FlowDirection.TopDown;
            center.WrapContents = false;
            center.AutoSize = true;
            center.Anchor = AnchorStyles.None;
            center.Width = 560;

            center.Controls.Add(UiFactory.CreateSectionTitle("\u76ee\u6807\u4ed3\u5e93"));
            initializeTargetPreviewLabel = UiFactory.CreateCaption(config.target_vault, Theme.TextSecondary);
            initializeTargetPreviewLabel.AutoSize = false;
            initializeTargetPreviewLabel.Width = 560;
            initializeTargetPreviewLabel.Height = 24;
            initializeTargetPreviewLabel.Margin = new Padding(0, Theme.SpaceSM, 0, Theme.SpaceSM);
            center.Controls.Add(initializeTargetPreviewLabel);
            center.Controls.Add(CreateInitializeButtonRow("\u9009\u62e9\u76ee\u6807\u4ed3\u5e93", OnChooseTargetVault));

            center.Controls.Add(UiFactory.CreateSectionTitle("\u540c\u6b65\u6e90\u6587\u4ef6\u5939\uff08\u53ef\u4ee5\u540c\u65f6\u9009\u62e9\u591a\u4e2a\uff09"));
            initializeSourceSummaryLabel = UiFactory.CreateCaption("\u5df2\u9009\u62e9 0 \u4e2a\u6587\u4ef6\u5939", Theme.TextSecondary);
            initializeSourceSummaryLabel.AutoSize = false;
            initializeSourceSummaryLabel.Width = 560;
            initializeSourceSummaryLabel.Height = 24;
            initializeSourceSummaryLabel.Margin = new Padding(0, Theme.SpaceSM, 0, Theme.SpaceSM);
            center.Controls.Add(initializeSourceSummaryLabel);
            center.Controls.Add(CreateInitializeButtonRow("\u6dfb\u52a0\u6e90\u6587\u4ef6\u5939", OnAddSourceFolder));

            Button start = UiFactory.CreatePrimaryButton("\u5f00\u59cb\u540c\u6b65\u5e76\u7f16\u8bd1", delegate
            {
                if (sourceFoldersListBox.Items.Count == 0)
                {
                    AppDialog.ShowWarning(this, "\u7f3a\u5c11\u6e90\u6587\u4ef6\u5939", "\u8bf7\u5148\u6dfb\u52a0\u81f3\u5c11\u4e00\u4e2a\u540c\u6b65\u6e90\u6587\u4ef6\u5939\u3002");
                    return;
                }

                shellPagePanel.Visible = true;
                welcomePagePanel.Visible = false;
                initializePagePanel.Visible = false;
                OnShowChat(this, EventArgs.Empty);
                OnStartCompile(this, EventArgs.Empty);
            });
            start.Width = 240;
            start.Height = 48;
            start.Margin = new Padding(0, Theme.SpaceXXL, 0, 0);
            center.Controls.Add(start);

            layout.Controls.Add(center, 0, 1);
            panel.Controls.Add(layout);
            return panel;
        }

        private Control CreateInitializeButtonRow(string buttonText, EventHandler handler)
        {
            FlowLayoutPanel row = new FlowLayoutPanel();
            row.AutoSize = true;
            row.WrapContents = false;
            row.Margin = new Padding(0, 0, 0, Theme.SpaceXL);
            Button button = UiFactory.CreateSecondaryButton(buttonText, handler);
            button.Width = 220;
            button.Height = 48;
            row.Controls.Add(button);
            return row;
        }

        private void ShowMainView(string view)
        {
            currentView = view;
            if (chatViewPanel != null) chatViewPanel.Visible = view == "chat";
            if (reviewViewPanel != null) reviewViewPanel.Visible = view == "review";
            if (settingsViewPanel != null) settingsViewPanel.Visible = view == "settings";
            if (activityLogViewPanel != null) activityLogViewPanel.Visible = view == "activityLog";
            if (fileBrowserPanel != null) fileBrowserPanel.Visible = view == "chat";
            if (browserSplit != null)
            {
                browserSplit.Panel1Collapsed = view != "chat";
                if (view == "chat")
                {
                    ApplyPanelStateToLayout();
                }
            }

            UpdateNavSelection();
        }

        private void ShowWelcomePage()
        {
            shellPagePanel.Visible = false;
            initializePagePanel.Visible = false;
            welcomePagePanel.Visible = true;
        }

        private void ShowInitializePage()
        {
            shellPagePanel.Visible = false;
            welcomePagePanel.Visible = false;
            initializePagePanel.Visible = true;
            RefreshInitializeSummary();
        }

        private void OnShowReview(object sender, EventArgs e)
        {
            if (systemCheckDecisionTextBox != null)
            {
                systemCheckDecisionTextBox.Text = BuildSystemCheckDecisionText();
            }
            ShowMainView("review");
        }

        private void OnShowChat(object sender, EventArgs e)
        {
            ShowMainView("chat");
            if (queryTextBox != null)
            {
                queryTextBox.Focus();
            }
        }

        private void OnShowSettings(object sender, EventArgs e)
        {
            ShowMainView("settings");
        }

        private void OnShowActivityLog(object sender, EventArgs e)
        {
            ShowMainView("activityLog");
        }

        private Button CreateNavButton(string icon, string text, EventHandler handler)
        {
            Button button = UiFactory.CreateNavButton(icon, text, handler);
            navToolTip.SetToolTip(button, text);
            button.Margin = new Padding(0, 0, 0, Theme.SpaceSM);
            return button;
        }

        private static SurfacePanel CreateCard(string title)
        {
            SurfacePanel card = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceXL));
            card.Tag = title;
            return card;
        }

        private static Button CreateButton(string text, EventHandler handler)
        {
            return UiFactory.CreateSecondaryButton(text, handler);
        }

        private static Button CreateIconButton(string text)
        {
            return UiFactory.CreateToolButton(text, null);
        }

        private Button CreateLayerTabButton(string text, bool selected)
        {
            return UiFactory.CreateSegmentButton(text, selected);
        }

        private static Label CreateSettingsTitle(string text)
        {
            Label label = UiFactory.CreateSectionTitle(text);
            label.Margin = new Padding(0, 0, 0, Theme.SpaceLG);
            return label;
        }

        private static Label CreateSettingsHint(string text)
        {
            Label label = UiFactory.CreateCaption(text, Theme.TextMuted);
            label.AutoSize = false;
            label.Width = 680;
            label.Height = 40;
            label.Margin = new Padding(0, 0, 0, Theme.SpaceLG);
            return label;
        }

        private TextBox CreateSettingsTextBox(string envKey)
        {
            TextBox textBox = new TextBox();
            textBox.Text = ReadEnvValue(envKey);
            return textBox;
        }

        private string ReadEnvValue(string key)
        {
            string envPath = Path.Combine(projectRoot, ".env");
            if (!File.Exists(envPath))
            {
                return string.Empty;
            }

            foreach (string line in File.ReadAllLines(envPath))
            {
                if (line.StartsWith(key + "=", StringComparison.Ordinal))
                {
                    return line.Substring(key.Length + 1);
                }
            }

            return string.Empty;
        }

        private static void StyleTextBox(TextBox textBox, bool multiline)
        {
            if (multiline)
            {
                UiFactory.StyleReadOnlyTextBox(textBox, false);
            }
            else
            {
                UiFactory.StyleInputTextBox(textBox, false);
            }
        }

        private static string BuildSystemCheckDecisionText()
        {
            return
                "\u7cfb\u7edf\u68c0\u67e5\u91cd\u70b9\u6392\u67e5\uff1a\u9875\u9762\u77db\u76fe\u3001\u65b0\u6765\u6e90\u5df2\u66ff\u4ee3\u7684\u8fc7\u65f6\u8868\u8ff0\u3001\u6ca1\u6709\u5165\u7ad9\u94fe\u63a5\u7684\u5b64\u7acb\u9875\u3001\u65ad\u94fe\u3001\u7f3a\u6458\u8981\u3001\u91cd\u590d\u6982\u5ff5\u3001\u7a7a/\u8584\u9875\u3001\u5f15\u7528\u7f3a\u5931\u7b49\u3002" + Environment.NewLine +
                Environment.NewLine +
                "1. \u9700\u8981\u7f51\u7edc\u641c\u7d22\u8865\u8bc1\u7684\u6570\u636e\u7a7a\u767d" + Environment.NewLine +
                "\u539f\u56e0\uff1a\u8054\u7f51\u641c\u7d22\u4f1a\u5f15\u5165\u65b0\u6765\u6e90\u548c\u5916\u90e8\u4fe1\u606f\uff0c\u9700\u8981\u4f60\u5148\u786e\u8ba4\u662f\u5426\u503c\u5f97\u8865\u8bc1\u3002" + Environment.NewLine +
                "\u9700\u8981\u4f60\u786e\u8ba4\uff1a\u662f\u5426\u8fdb\u4e00\u6b65\u7f51\u7edc\u641c\u7d22\u8865\u8bc1\uff1f" + Environment.NewLine +
                Environment.NewLine +
                "2. \u65b0\u95ee\u9898 / \u65b0\u6765\u6e90\u5efa\u8bae" + Environment.NewLine +
                "\u539f\u56e0\uff1a\u8fd9\u4f1a\u6539\u53d8\u540e\u7eed\u8c03\u67e5\u8303\u56f4\u548c\u6536\u5f55\u8fb9\u754c\uff0c\u9700\u8981\u4f60\u5148\u786e\u8ba4\u662f\u5426\u63a5\u53d7\u3002" + Environment.NewLine +
                "\u9700\u8981\u4f60\u786e\u8ba4\uff1a\u662f\u5426\u63a5\u53d7\u65b0\u95ee\u9898\u3001\u65b0\u6765\u6e90\u5efa\u8bae\uff1f";
        }

        private void BindConfigToUi()
        {
            targetVaultTextBox.Text = config.target_vault;
            sourceFoldersListBox.Items.Clear();
            foreach (string folder in config.source_folders)
            {
                sourceFoldersListBox.Items.Add(folder);
            }

            RefreshInitializeSummary();
            LoadFileTree();
            AppendLog("\u9879\u76ee\u76ee\u5f55\uff1a" + projectRoot);
            AppendLog("\u914d\u7f6e\u6587\u4ef6\uff1a" + configPath);
            AppendLog("sources_full\uff08\u5168\u91cf\u539f\u6599\u4ed3\uff09\u7528\u4e8e\u4fdd\u5b58\u5168\u90e8\u540c\u6b65\u8fc7\u6765\u7684 raw \u6587\u4ef6\u3002");
            AppendLog("sources\uff08\u5f53\u524d\u6279\u6b21\u5de5\u4f5c\u533a\uff09\u53ea\u653e\u672c\u8f6e\u771f\u6b63\u53c2\u4e0e\u7f16\u8bd1\u7684\u6587\u4ef6\u3002");
            currentContextLabel.Text = "\u5f53\u524d\u4e0a\u4e0b\u6587\uff1a\u672a\u9009\u4e2d\u6587\u4ef6";
        }

        private void RefreshInitializeSummary()
        {
            if (initializeTargetPreviewLabel != null)
            {
                initializeTargetPreviewLabel.Text = targetVaultTextBox == null ? config.target_vault : targetVaultTextBox.Text;
            }

            if (initializeSourceSummaryLabel != null && sourceFoldersListBox != null)
            {
                initializeSourceSummaryLabel.Text = "\u5df2\u9009\u62e9 " + sourceFoldersListBox.Items.Count + " \u4e2a\u6587\u4ef6\u5939";
            }
        }

        private void OnChooseTargetVault(object sender, EventArgs e)
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "\u9009\u62e9\u4e00\u4e2a\u76ee\u6807\u4ed3\u5e93\u6587\u4ef6\u5939\u3002";
                dialog.ShowNewFolderButton = true;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    config.target_vault = dialog.SelectedPath;
                    targetVaultTextBox.Text = dialog.SelectedPath;
                    RefreshInitializeSummary();
                }
            }
        }

        private void UpdateNavSelection()
        {
            UpdateNavButtonState(navChatButton, currentView == "chat");
            UpdateNavButtonState(navReviewButton, currentView == "review");
            UpdateNavButtonState(navLogButton, currentView == "activityLog");
            UpdateNavButtonState(navSettingsButton, currentView == "settings");
            UpdateNavButtonState(navCheckButton, false);
            UpdateNavButtonState(navSyncButton, false);
        }

        private static void UpdateNavButtonState(Button button, bool selected)
        {
            if (button == null)
            {
                return;
            }

            button.BackColor = selected ? Theme.Primary : Color.Transparent;
            button.ForeColor = selected ? Theme.TextOnPrimary : Theme.TextMuted;
        }

        private static void CenterSettingsCanvas(Panel container, TableLayoutPanel settingsCanvas)
        {
            if (container == null || settingsCanvas == null)
            {
                return;
            }

            int targetWidth = Math.Min(1120, Math.Max(900, container.ClientSize.Width - Theme.SpaceXXL * 2));
            settingsCanvas.Width = targetWidth;
            settingsCanvas.Left = Math.Max(Theme.SpaceXL, (container.ClientSize.Width - targetWidth) / 2);
            settingsCanvas.Top = Theme.SpaceXL;
        }

        private Panel BuildSettingsHeroCard()
        {
            SurfacePanel card = UiFactory.CreateCard(Theme.RadiusXL, new Padding(Theme.SpaceXXL));
            card.AutoSize = true;
            card.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            card.Margin = new Padding(0, 0, 0, Theme.SpaceXL);
            card.FillColor = Theme.Primary;
            card.BorderColor = Theme.Primary;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.AutoSize = true;
            layout.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));

            Label title = new Label();
            title.AutoSize = true;
            title.Text = "\u8bbe\u7f6e\u4e2d\u5fc3";
            title.ForeColor = Theme.TextOnPrimary;
            title.Font = Theme.CreateUiFont(24F, FontStyle.Bold);
            title.Margin = new Padding(0, 0, 0, Theme.SpaceSM);
            layout.Controls.Add(title, 0, 0);

            Label subtitle = new Label();
            subtitle.AutoSize = true;
            subtitle.Text = "\u628a\u4ed3\u5e93\u3001\u6e90\u6587\u4ef6\u5939\u3001LLM \u548c\u641c\u7d22\u80fd\u529b\u6536\u5728\u4e00\u4e2a\u6e05\u6670\u7684\u5de5\u4f5c\u53f0\u91cc\u3002";
            subtitle.MaximumSize = new Size(920, 0);
            subtitle.ForeColor = Theme.TextOnPrimaryMuted;
            subtitle.Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            subtitle.Margin = new Padding(0, 0, 0, Theme.SpaceLG);
            layout.Controls.Add(subtitle, 0, 1);

            FlowLayoutPanel badges = new FlowLayoutPanel();
            badges.AutoSize = true;
            badges.WrapContents = true;
            badges.Margin = new Padding(0);
            badges.Controls.Add(CreateSettingsBadge("\u4ed3\u5e93\u4e0e\u540c\u6b65"));
            badges.Controls.Add(CreateSettingsBadge("LLM / API"));
            badges.Controls.Add(CreateSettingsBadge("\u68c0\u67e5\u4e0e\u67e5\u8be2"));
            layout.Controls.Add(badges, 0, 2);

            card.Controls.Add(layout);
            return card;
        }

        private static Control CreateSettingsBadge(string text)
        {
            SurfacePanel badge = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceLG, Theme.SpaceSM, Theme.SpaceLG, Theme.SpaceSM));
            badge.AutoSize = true;
            badge.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            badge.FillColor = Theme.PrimaryOverlay;
            badge.BorderColor = Theme.PrimaryOverlay;
            badge.Margin = new Padding(0, 0, Theme.SpaceSM, Theme.SpaceSM);

            Label label = new Label();
            label.AutoSize = true;
            label.Text = text;
            label.ForeColor = Theme.TextOnPrimary;
            label.Font = Theme.CreateUiFont(13F, FontStyle.Bold);
            label.Margin = new Padding(0);
            badge.Controls.Add(label);
            return badge;
        }

        private Panel CreateSettingsCard(string title, Control content)
        {
            SurfacePanel card = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceXL));
            card.AutoSize = true;
            card.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            card.Margin = new Padding(0, 0, 0, Theme.SpaceXL);
            card.FillColor = Theme.Background;
            card.BorderColor = Theme.Border;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.AutoSize = true;
            layout.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            layout.ColumnCount = 1;
            layout.RowCount = 2;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.Controls.Add(CreateSettingsTitle(title), 0, 0);
            layout.Controls.Add(content, 0, 1);
            card.Controls.Add(layout);
            return card;
        }

        private Control BuildRepositorySettingsContent()
        {
            TableLayoutPanel layout = new TableLayoutPanel();
            layout.AutoSize = true;
            layout.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            layout.Dock = DockStyle.Top;
            layout.ColumnCount = 1;
            layout.RowCount = 6;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            targetVaultTextBox = new TextBox();
            layout.Controls.Add(
                WrapWithLabel(
                    "\u76ee\u6807\u4ed3\u5e93",
                    CreateBrowseInputRow(
                        CreateLabeledInput(targetVaultTextBox, 780),
                        "\u9009\u62e9\u672c\u5730\u6587\u4ef6\u5939",
                        OnChooseTargetVault)),
                0,
                0);

            sourceFoldersListBox = new ListBox();
            sourceFoldersListBox.Height = 164;
            sourceFoldersListBox.SelectionMode = SelectionMode.MultiExtended;
            UiFactory.StyleListBox(sourceFoldersListBox);
            sourceFoldersListBox.DrawItem += OnListBoxDrawItem;
            SurfacePanel sourceCard = UiFactory.CreateCard(Theme.RadiusMD, new Padding(Theme.SpaceSM));
            sourceCard.Dock = DockStyle.Top;
            sourceCard.Width = 980;
            sourceCard.MinimumSize = new Size(980, 172);
            sourceCard.Height = 172;
            sourceFoldersListBox.Dock = DockStyle.Fill;
            sourceCard.Controls.Add(sourceFoldersListBox);
            layout.Controls.Add(WrapWithLabel("\u540c\u6b65\u6e90\u6587\u4ef6\u5939\uff08\u53ef\u4ee5\u540c\u65f6\u9009\u62e9\u591a\u4e2a\uff09", sourceCard), 0, 1);

            FlowLayoutPanel syncActions = new FlowLayoutPanel();
            syncActions.AutoSize = true;
            syncActions.WrapContents = true;
            syncActions.Margin = new Padding(0, 0, 0, Theme.SpaceLG);
            syncActions.Controls.Add(UiFactory.CreateSecondaryButton("\u6dfb\u52a0\u6e90\u6587\u4ef6\u5939", OnAddSourceFolder));
            syncActions.Controls.Add(UiFactory.CreateSecondaryButton("\u79fb\u9664\u9009\u4e2d", OnRemoveSelectedFolder));
            syncActions.Controls.Add(UiFactory.CreatePrimaryButton("\u4fdd\u5b58\u914d\u7f6e", OnSaveConfig));
            syncActions.Controls.Add(UiFactory.CreateSecondaryButton("\u6253\u5f00\u914d\u7f6e", OnOpenConfig));
            layout.Controls.Add(syncActions, 0, 2);

            Label operationsTitle = UiFactory.CreateSectionTitle("\u5de5\u4f5c\u533a\u64cd\u4f5c");
            operationsTitle.Margin = new Padding(0, Theme.SpaceSM, 0, Theme.SpaceSM);
            layout.Controls.Add(operationsTitle, 0, 3);

            Label operationsHint = UiFactory.CreateCaption(
                "\u4e0b\u9762\u8fd9\u4e00\u7ec4\u6309\u94ae\u7528\u4e8e\u6253\u5f00\u7f16\u8bd1\u8bbe\u7f6e\uff0c\u5f00\u542f\u5b9e\u65f6\u76d1\u542c\uff0c\u7acb\u5373\u624b\u52a8\u540c\u6b65\uff0c\u4ee5\u53ca\u8fd0\u884c\u7cfb\u7edf\u68c0\u67e5\u3002",
                Theme.TextMuted);
            operationsHint.MaximumSize = new Size(920, 0);
            operationsHint.Margin = new Padding(0, 0, 0, Theme.SpaceLG);
            layout.Controls.Add(operationsHint, 0, 4);

            TableLayoutPanel modes = new TableLayoutPanel();
            modes.AutoSize = true;
            modes.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            modes.ColumnCount = 4;
            modes.RowCount = 1;
            modes.Dock = DockStyle.Top;
            modes.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));
            modes.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));
            modes.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));
            modes.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));

            Button compileSettingsButton = UiFactory.CreateSecondaryButton("\u6253\u5f00\u7f16\u8bd1\u8bbe\u7f6e", OnShowSettings);
            compileSettingsButton.Width = 220;
            compileSettingsButton.Height = 40;
            modes.Controls.Add(compileSettingsButton, 0, 0);

            watchButton = UiFactory.CreateSecondaryButton("\u5f00\u542f\u5b9e\u65f6\u76d1\u542c", OnStartWatch);
            watchButton.Width = 220;
            watchButton.Height = 40;
            modes.Controls.Add(watchButton, 1, 0);

            startCompileButton = UiFactory.CreateSecondaryButton("\u7acb\u5373\u624b\u52a8\u540c\u6b65", OnStartCompile);
            startCompileButton.Width = 220;
            startCompileButton.Height = 40;
            modes.Controls.Add(startCompileButton, 2, 0);

            lintButton = UiFactory.CreateOutlinePrimaryButton("\u8fd0\u884c\u7cfb\u7edf\u68c0\u67e5", OnConfirmCheck);
            lintButton.Width = 220;
            lintButton.Height = 40;
            modes.Controls.Add(lintButton, 3, 0);
            layout.Controls.Add(modes, 0, 5);
            return layout;
        }

        private Control BuildProviderSettingsContent()
        {
            TableLayoutPanel layout = new TableLayoutPanel();
            layout.AutoSize = true;
            layout.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            layout.Dock = DockStyle.Top;
            layout.ColumnCount = 1;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            llmEndpointTextBox = CreateSettingsTextBox("ANTHROPIC_BASE_URL");
            llmKeyTextBox = CreateSettingsTextBox("ANTHROPIC_API_KEY");
            llmModelTextBox = CreateSettingsTextBox("LLMWIKI_MODEL");
            layout.Controls.Add(WrapWithLabel("\u5730\u5740", CreateLabeledInput(llmEndpointTextBox, 460)), 0, 0);
            layout.Controls.Add(WrapWithLabel("\u5bc6\u94a5", CreateLabeledInput(llmKeyTextBox, 460)), 0, 1);
            layout.Controls.Add(WrapWithLabel("\u6a21\u578b", CreateLabeledInput(llmModelTextBox, 460)), 0, 2);
            return layout;
        }

        private Control BuildSearchSettingsContent()
        {
            TableLayoutPanel layout = new TableLayoutPanel();
            layout.AutoSize = true;
            layout.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            layout.Dock = DockStyle.Top;
            layout.ColumnCount = 1;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            searchEndpointTextBox = CreateSettingsTextBox("SEARCH_API_URL");
            searchKeyTextBox = CreateSettingsTextBox("SEARCH_API_KEY");
            searchModelTextBox = CreateSettingsTextBox("SEARCH_MODEL");
            layout.Controls.Add(WrapWithLabel("\u5730\u5740", CreateLabeledInput(searchEndpointTextBox, 460)), 0, 0);
            layout.Controls.Add(WrapWithLabel("\u5bc6\u94a5", CreateLabeledInput(searchKeyTextBox, 460)), 0, 1);
            layout.Controls.Add(WrapWithLabel("\u6a21\u578b", CreateLabeledInput(searchModelTextBox, 460)), 0, 2);
            return layout;
        }

        private Control BuildVectorSettingsContent()
        {
            TableLayoutPanel layout = new TableLayoutPanel();
            layout.AutoSize = true;
            layout.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            layout.Dock = DockStyle.Top;
            layout.ColumnCount = 1;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            vectorEndpointTextBox = CreateSettingsTextBox("VECTOR_API_URL");
            vectorKeyTextBox = CreateSettingsTextBox("VECTOR_API_KEY");
            vectorModelTextBox = CreateSettingsTextBox("VECTOR_MODEL");
            layout.Controls.Add(WrapWithLabel("\u5730\u5740", CreateLabeledInput(vectorEndpointTextBox, 980)), 0, 0);
            layout.Controls.Add(WrapWithLabel("\u5bc6\u94a5", CreateLabeledInput(vectorKeyTextBox, 980)), 0, 1);
            layout.Controls.Add(WrapWithLabel("\u6a21\u578b", CreateLabeledInput(vectorModelTextBox, 980)), 0, 2);
            return layout;
        }

        private Control CreateLabeledInput(TextBox textBox, int width)
        {
            SurfacePanel shell = UiFactory.CreateInputShell();
            shell.Dock = DockStyle.Top;
            shell.Width = width;
            shell.MinimumSize = new Size(width, Theme.InputHeight);
            UiFactory.StyleInputTextBox(textBox, false);
            textBox.Dock = DockStyle.Fill;
            shell.Controls.Add(textBox);
            UiFactory.HookInputShellFocus(shell, textBox);
            return shell;
        }

        private Control CreateBrowseInputRow(Control input, string buttonText, EventHandler handler)
        {
            TableLayoutPanel row = new TableLayoutPanel();
            row.AutoSize = true;
            row.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            row.Dock = DockStyle.Top;
            row.ColumnCount = 2;
            row.RowCount = 1;
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            row.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            row.Controls.Add(input, 0, 0);

            Button browseButton = UiFactory.CreateSecondaryButton(buttonText, handler);
            browseButton.Width = 172;
            browseButton.Height = Theme.ButtonHeightLG;
            browseButton.Margin = new Padding(Theme.SpaceMD, 0, 0, 0);
            row.Controls.Add(browseButton, 1, 0);
            return row;
        }

        private static Control WrapWithLabel(string labelText, Control control)
        {
            TableLayoutPanel wrapper = new TableLayoutPanel();
            wrapper.AutoSize = true;
            wrapper.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            wrapper.Dock = DockStyle.Top;
            wrapper.ColumnCount = 1;
            wrapper.RowCount = 2;
            wrapper.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            wrapper.Margin = new Padding(0, 0, 0, Theme.SpaceLG);

            Label label = UiFactory.CreateCaption(labelText, Theme.Primary);
            label.Margin = new Padding(0, 0, 0, 6);
            wrapper.Controls.Add(label, 0, 0);
            wrapper.Controls.Add(control, 0, 1);
            return wrapper;
        }

        private void OnListBoxDrawItem(object sender, DrawItemEventArgs e)
        {
            UiFactory.DrawListBoxItem((ListBox)sender, e, (e.State & DrawItemState.Selected) == DrawItemState.Selected);
        }
    }
}
