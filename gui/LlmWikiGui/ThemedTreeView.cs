using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed class ThemedTreeView : TreeView
    {
        private TreeNode hoveredNode;

        public ThemedTreeView()
        {
            DrawMode = TreeViewDrawMode.OwnerDrawText;
            BorderStyle = BorderStyle.None;
            BackColor = Theme.Background;
            FullRowSelect = true;
            HideSelection = false;
            Indent = Theme.TreeIndent;
            ItemHeight = Theme.TreeItemHeight;
            ShowLines = false;
            ShowPlusMinus = true;
            ShowRootLines = false;
            DrawNode += OnDrawNode;
            MouseMove += OnMouseMoveOverNode;
            MouseLeave += delegate
            {
                hoveredNode = null;
                Invalidate();
            };
        }

        private void OnMouseMoveOverNode(object sender, MouseEventArgs e)
        {
            TreeNode node = GetNodeAt(e.Location);
            if (hoveredNode != node)
            {
                hoveredNode = node;
                Invalidate();
            }
        }

        private void OnDrawNode(object sender, DrawTreeNodeEventArgs e)
        {
            Rectangle rowBounds = new Rectangle(0, e.Bounds.Top, Width, ItemHeight);
            bool selected = (e.State & TreeNodeStates.Selected) == TreeNodeStates.Selected;
            bool hovered = hoveredNode == e.Node;

            Color background = Theme.Background;
            if (selected || hovered)
            {
                background = Theme.PrimaryLight;
            }

            using (SolidBrush brush = new SolidBrush(background))
            {
                e.Graphics.FillRectangle(brush, rowBounds);
            }

            if (selected)
            {
                using (SolidBrush accent = new SolidBrush(Theme.Primary))
                {
                    e.Graphics.FillRectangle(accent, 0, rowBounds.Top + 5, 3, rowBounds.Height - 10);
                }
            }

            DrawHierarchyGuides(e.Graphics, e.Node, rowBounds, e.Bounds);

            Font font = e.Node.Nodes.Count > 0
                ? Theme.CreateUiFont(14F, FontStyle.Regular)
                : Theme.CreateUiFont(13F, FontStyle.Regular);
            Color color = e.Node.Nodes.Count > 0 ? Theme.TextPrimary : Theme.TextSecondary;
            Rectangle textBounds = new Rectangle(e.Bounds.Left + Theme.SpaceXS, e.Bounds.Top, Width - e.Bounds.Left - Theme.SpaceMD, e.Bounds.Height);
            TextRenderer.DrawText(
                e.Graphics,
                e.Node.Text,
                font,
                textBounds,
                color,
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }

        private void DrawHierarchyGuides(Graphics graphics, TreeNode node, Rectangle rowBounds, Rectangle textBounds)
        {
            if (node == null || node.Parent == null)
            {
                return;
            }

            using (Pen pen = new Pen(Theme.Border, 1F))
            {
                pen.DashStyle = DashStyle.Dot;

                TreeNode ancestor = node;
                for (int level = node.Level; level > 0; level--)
                {
                    ancestor = level == node.Level ? node.Parent : ancestor.Parent;
                    if (ancestor == null)
                    {
                        continue;
                    }

                    int x = textBounds.Left - Theme.SpaceLG - ((node.Level - level) * Theme.TreeIndent);
                    if (ancestor.NextNode != null)
                    {
                        graphics.DrawLine(pen, x, rowBounds.Top, x, rowBounds.Bottom);
                    }
                }

                int branchX = textBounds.Left - Theme.SpaceLG;
                int branchY = rowBounds.Top + (rowBounds.Height / 2);
                graphics.DrawLine(pen, branchX, rowBounds.Top, branchX, branchY);
                graphics.DrawLine(pen, branchX, branchY, textBounds.Left - Theme.SpaceSM, branchY);

                if (node.NextNode != null)
                {
                    graphics.DrawLine(pen, branchX, branchY, branchX, rowBounds.Bottom);
                }
            }
        }
    }
}
