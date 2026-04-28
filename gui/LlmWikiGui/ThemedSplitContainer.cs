using System.Drawing;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed class ThemedSplitContainer : SplitContainer
    {
        private bool hovering;
        private bool dragging;

        public ThemedSplitContainer()
        {
            DoubleBuffered = true;
            SplitterWidth = 6;
            BackColor = Theme.Background;
            MouseMove += OnContainerMouseMove;
            MouseLeave += delegate
            {
                hovering = false;
                dragging = false;
                Cursor = Cursors.Default;
                Invalidate();
            };
            MouseDown += delegate
            {
                if (hovering)
                {
                    dragging = true;
                    Invalidate();
                }
            };
            MouseUp += delegate
            {
                dragging = false;
                Invalidate();
            };
            SplitterMoved += delegate
            {
                dragging = false;
                Invalidate();
            };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Rectangle splitterBounds = GetSplitterBounds();
            Color color = dragging || hovering ? Theme.Primary : Theme.Border;
            int width = dragging || hovering ? 2 : 1;

            using (SolidBrush brush = new SolidBrush(color))
            {
                if (Orientation == Orientation.Vertical)
                {
                    int x = splitterBounds.Left + (splitterBounds.Width - width) / 2;
                    e.Graphics.FillRectangle(brush, x, splitterBounds.Top, width, splitterBounds.Height);
                }
                else
                {
                    int y = splitterBounds.Top + (splitterBounds.Height - width) / 2;
                    e.Graphics.FillRectangle(brush, splitterBounds.Left, y, splitterBounds.Width, width);
                }
            }
        }

        private void OnContainerMouseMove(object sender, MouseEventArgs e)
        {
            Rectangle splitterBounds = GetSplitterBounds();
            bool nowHovering = splitterBounds.Contains(e.Location);
            if (hovering != nowHovering)
            {
                hovering = nowHovering;
                Cursor = hovering
                    ? (Orientation == Orientation.Vertical ? Cursors.SizeWE : Cursors.SizeNS)
                    : Cursors.Default;
                Invalidate();
            }
        }

        private Rectangle GetSplitterBounds()
        {
            if (Orientation == Orientation.Vertical)
            {
                return new Rectangle(SplitterDistance, 0, SplitterWidth, Height);
            }

            return new Rectangle(0, SplitterDistance, Width, SplitterWidth);
        }
    }
}
