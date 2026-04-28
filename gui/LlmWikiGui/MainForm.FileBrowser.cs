using System;
using System.IO;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed partial class MainForm
    {
        private Panel BuildFileBrowserPanel()
        {
            Panel panel = new Panel();
            panel.Name = "fileBrowserPanel";
            panel.Dock = DockStyle.Fill;
            panel.Padding = new Padding(Theme.SpaceLG, Theme.SpaceLG, Theme.SpaceLG, Theme.SpaceLG);
            panel.BackColor = Theme.Background;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 5;
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 48F));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 48F));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40F));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 44F));

            SurfacePanel tabsShell = UiFactory.CreateCard(Theme.RadiusMD, new Padding(Theme.SpaceXS));
            tabsShell.FillColor = Theme.PrimaryLight;
            tabsShell.BorderColor = Theme.PrimaryLight;

            TableLayoutPanel tabs = new TableLayoutPanel();
            tabs.Dock = DockStyle.Fill;
            tabs.ColumnCount = 2;
            tabs.RowCount = 1;
            tabs.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            tabs.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));

            wikiLayerButton = CreateLayerTabButton("wiki", true);
            rawLayerButton = CreateLayerTabButton("raw\u5c42", false);
            wikiLayerButton.Click += delegate
            {
                rawLayerSelected = false;
                RefreshLayerButtons();
                LoadFileTree(false);
            };
            rawLayerButton.Click += delegate
            {
                rawLayerSelected = true;
                RefreshLayerButtons();
                LoadFileTree(true);
            };
            tabs.Controls.Add(wikiLayerButton, 0, 0);
            tabs.Controls.Add(rawLayerButton, 1, 0);
            tabsShell.Controls.Add(tabs);
            layout.Controls.Add(tabsShell, 0, 0);

            SurfacePanel searchShell = UiFactory.CreateInputShell();
            fileSearchTextBox = new TextBox();
            fileSearchTextBox.Dock = DockStyle.Fill;
            fileSearchTextBox.Text = "\u641c\u7d22...";
            StyleTextBox(fileSearchTextBox, false);
            fileSearchTextBox.GotFocus += delegate
            {
                if (fileSearchTextBox.Text == "\u641c\u7d22...")
                {
                    fileSearchTextBox.Text = string.Empty;
                }
            };
            fileSearchTextBox.LostFocus += delegate
            {
                if (string.IsNullOrWhiteSpace(fileSearchTextBox.Text))
                {
                    fileSearchTextBox.Text = "\u641c\u7d22...";
                }
            };
            fileSearchTextBox.TextChanged += delegate { LoadFileTree(rawLayerSelected); };
            searchShell.Controls.Add(fileSearchTextBox);
            UiFactory.HookInputShellFocus(searchShell, fileSearchTextBox);
            layout.Controls.Add(searchShell, 0, 1);

            FlowLayoutPanel actions = new FlowLayoutPanel();
            actions.Dock = DockStyle.Fill;
            actions.FlowDirection = FlowDirection.RightToLeft;
            Button filterButton = CreateIconButton("\uE71C");
            filterButton.Font = Theme.CreateIconFont(12F);
            Button addButton = CreateIconButton("\uE710");
            addButton.Font = Theme.CreateIconFont(12F);
            addButton.Click += OnAddSourceFolder;
            actions.Controls.Add(filterButton);
            actions.Controls.Add(addButton);
            layout.Controls.Add(actions, 0, 2);

            SurfacePanel treeCard = UiFactory.CreateCard(Theme.RadiusLG, new Padding(Theme.SpaceSM));
            fileTreeView = new ThemedTreeView();
            fileTreeView.Dock = DockStyle.Fill;
            fileTreeView.NodeMouseClick += OnFileNodeMouseClick;
            fileTreeView.NodeMouseDoubleClick += OnFileNodeMouseDoubleClick;
            treeCard.Controls.Add(fileTreeView);
            layout.Controls.Add(treeCard, 0, 3);

            selectModeButton = UiFactory.CreateSecondaryButton("\u9009\u4e2d\u6a21\u5f0f", OnToggleSelectionMode);
            selectModeButton.Dock = DockStyle.Fill;
            layout.Controls.Add(selectModeButton, 0, 4);

            panel.Controls.Add(layout);
            return panel;
        }

        private void RefreshLayerButtons()
        {
            if (wikiLayerButton == null || rawLayerButton == null)
            {
                return;
            }

            UiFactory.ApplySegmentButtonState(wikiLayerButton, !rawLayerSelected);
            UiFactory.ApplySegmentButtonState(rawLayerButton, rawLayerSelected);
        }

        private void OnToggleSelectionMode(object sender, EventArgs e)
        {
            selectionMode = !selectionMode;
            selectModeButton.BackColor = selectionMode ? Theme.PrimaryLight : Theme.Background;
            selectModeButton.FlatAppearance.BorderColor = selectionMode ? Theme.Primary : Theme.Border;
            AppendLog(selectionMode
                ? "\u9009\u4e2d\u6a21\u5f0f\uff1a\u5355\u51fb\u6587\u4ef6\u4f1a\u628a\u5b83\u52a0\u5165\u5bf9\u8bdd\u4e0a\u4e0b\u6587\u3002"
                : "\u9009\u4e2d\u6a21\u5f0f\u5df2\u5173\u95ed\uff0c\u53cc\u51fb\u6587\u4ef6\u624d\u4f1a\u6253\u5f00\u9884\u89c8\u3002");
        }

        private void LoadFileTree()
        {
            LoadFileTree(rawLayerSelected);
        }

        private void LoadFileTree(bool rawLayer)
        {
            if (fileTreeView == null)
            {
                return;
            }

            fileTreeView.BeginUpdate();
            fileTreeView.Nodes.Clear();
            string vault = targetVaultTextBox == null ? config.target_vault : targetVaultTextBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(vault))
            {
                fileTreeView.EndUpdate();
                return;
            }

            if (rawLayer)
            {
                AddDirectoryToTree(fileTreeView.Nodes, Path.Combine(vault, "sources"), "sources");
                AddDirectoryToTree(fileTreeView.Nodes, Path.Combine(vault, "sources_full"), "sources_full");
            }
            else
            {
                AddDirectoryToTree(fileTreeView.Nodes, Path.Combine(vault, "wiki"), "wiki");
            }

            fileTreeView.ExpandAll();
            fileTreeView.EndUpdate();
        }

        private void AddDirectoryToTree(TreeNodeCollection nodes, string directory, string label)
        {
            TreeNode rootNode = new TreeNode(label);
            rootNode.Tag = directory;
            if (!Directory.Exists(directory))
            {
                nodes.Add(rootNode);
                return;
            }

            if (PopulateTreeNode(rootNode, directory) || MatchesSearch(label))
            {
                nodes.Add(rootNode);
            }
        }

        private bool PopulateTreeNode(TreeNode parentNode, string directory)
        {
            bool hasVisibleChildren = false;

            try
            {
                string[] directories = Directory.GetDirectories(directory);
                Array.Sort(directories, StringComparer.OrdinalIgnoreCase);
                foreach (string childDirectory in directories)
                {
                    TreeNode directoryNode = new TreeNode(Path.GetFileName(childDirectory));
                    directoryNode.Tag = childDirectory;
                    if (PopulateTreeNode(directoryNode, childDirectory) || MatchesSearch(directoryNode.Text))
                    {
                        parentNode.Nodes.Add(directoryNode);
                        hasVisibleChildren = true;
                    }
                }

                string[] files = Directory.GetFiles(directory);
                Array.Sort(files, StringComparer.OrdinalIgnoreCase);
                foreach (string file in files)
                {
                    string fileName = Path.GetFileName(file);
                    if (!MatchesSearch(fileName))
                    {
                        continue;
                    }

                    TreeNode fileNode = new TreeNode(fileName);
                    fileNode.Tag = file;
                    parentNode.Nodes.Add(fileNode);
                    hasVisibleChildren = true;
                }
            }
            catch
            {
                return false;
            }

            return hasVisibleChildren;
        }

        private bool MatchesSearch(string name)
        {
            string query = fileSearchTextBox == null ? string.Empty : fileSearchTextBox.Text.Trim();
            if (query == string.Empty || query == "\u641c\u7d22...")
            {
                return true;
            }

            return name.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private void OnFileNodeMouseClick(object sender, TreeNodeMouseClickEventArgs e)
        {
            fileTreeView.SelectedNode = e.Node;
            if (selectionMode)
            {
                PreviewFileNode(e.Node);
                return;
            }

            OpenPreviewForNode(e.Node);
        }

        private void OnFileNodeMouseDoubleClick(object sender, TreeNodeMouseClickEventArgs e)
        {
            fileTreeView.SelectedNode = e.Node;
            OpenPreviewForNode(e.Node);
        }

        private void PreviewFileNode(TreeNode node)
        {
            string path = node == null ? null : node.Tag as string;
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            {
                return;
            }

            if (selectionMode)
            {
                currentContextLabel.Text = "\u5f53\u524d\u4e0a\u4e0b\u6587\uff1a" + Path.GetFileName(path);
                AppendLog("\u5df2\u52a0\u5165\u5bf9\u8bdd\u4e0a\u4e0b\u6587\uff1a" + path);
                return;
            }

            currentContextLabel.Text = "\u5f53\u524d\u9884\u89c8\uff1a" + Path.GetFileName(path);
            AppendLog("\u5df2\u9009\u4e2d\u6587\u4ef6\uff1a" + path);
        }
    }
}
