using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed class SurfacePanel : Panel
    {
        private Color fillColor = Theme.Background;
        private Color borderColor = Theme.Border;
        private int cornerRadius = Theme.RadiusLG;
        private int borderWidth = 1;

        public Color FillColor
        {
            get { return fillColor; }
            set
            {
                fillColor = value;
                BackColor = Color.Transparent;
                Invalidate();
            }
        }

        public Color BorderColor
        {
            get { return borderColor; }
            set
            {
                borderColor = value;
                Invalidate();
            }
        }

        public int CornerRadius
        {
            get { return cornerRadius; }
            set
            {
                cornerRadius = value;
                UpdateRegion();
            }
        }

        public int BorderWidth
        {
            get { return borderWidth; }
            set
            {
                borderWidth = value;
                Invalidate();
            }
        }

        public SurfacePanel()
        {
            DoubleBuffered = true;
            Resize += delegate { UpdateRegion(); };
            UpdateRegion();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle bounds = new Rectangle(0, 0, Width - 1, Height - 1);
            if (bounds.Width <= 0 || bounds.Height <= 0)
            {
                return;
            }

            using (GraphicsPath path = Theme.CreateRoundedPath(bounds, cornerRadius))
            using (SolidBrush brush = new SolidBrush(fillColor))
            using (Pen pen = new Pen(borderColor, borderWidth))
            {
                e.Graphics.FillPath(brush, path);
                e.Graphics.DrawPath(pen, path);
            }
        }

        private void UpdateRegion()
        {
            if (Width <= 0 || Height <= 0)
            {
                return;
            }

            using (GraphicsPath path = Theme.CreateRoundedPath(new Rectangle(0, 0, Width, Height), cornerRadius))
            {
                Region = new Region(path);
            }
            Invalidate();
        }
    }

    internal static class UiFactory
    {
        public static SurfacePanel CreateCard(int radius, Padding padding)
        {
            SurfacePanel panel = new SurfacePanel();
            panel.FillColor = Theme.Background;
            panel.BorderColor = Theme.Border;
            panel.CornerRadius = radius;
            panel.Padding = padding;
            panel.Margin = new Padding(0);
            panel.Dock = DockStyle.Fill;
            return panel;
        }

        public static SurfacePanel CreateInputShell()
        {
            SurfacePanel shell = new SurfacePanel();
            shell.FillColor = Theme.PrimaryLighter;
            shell.BorderColor = Theme.Border;
            shell.CornerRadius = Theme.RadiusMD;
            shell.Padding = new Padding(Theme.SpaceMD, 0, Theme.SpaceMD, 0);
            shell.Height = Theme.InputHeight;
            shell.Dock = DockStyle.Top;
            return shell;
        }

        public static Label CreateTitle(string text)
        {
            Label label = new Label();
            label.Text = text;
            label.AutoSize = true;
            label.ForeColor = Theme.TextPrimary;
            label.Font = Theme.CreateUiFont(22F, FontStyle.Bold);
            label.Margin = new Padding(0);
            return label;
        }

        public static Label CreateSectionTitle(string text)
        {
            Label label = new Label();
            label.Text = text;
            label.AutoSize = true;
            label.ForeColor = Theme.TextPrimary;
            label.Font = Theme.CreateUiFont(16F, FontStyle.Bold);
            label.Margin = new Padding(0);
            return label;
        }

        public static Label CreateCaption(string text, Color color)
        {
            Label label = new Label();
            label.Text = text;
            label.AutoSize = true;
            label.ForeColor = color;
            label.Font = Theme.CreateUiFont(13F, FontStyle.Regular);
            label.Margin = new Padding(0);
            return label;
        }

        public static Button CreatePrimaryButton(string text, EventHandler handler)
        {
            Button button = CreateBaseButton(text, handler);
            button.BackColor = Theme.Primary;
            button.ForeColor = Theme.TextOnPrimary;
            button.FlatAppearance.BorderColor = Theme.Primary;
            HookButtonColors(button, Theme.Primary, Theme.PrimaryHover, Theme.PrimaryHover, Theme.TextOnPrimary);
            return button;
        }

        public static Button CreateSecondaryButton(string text, EventHandler handler)
        {
            Button button = CreateBaseButton(text, handler);
            button.BackColor = Theme.Background;
            button.ForeColor = Theme.TextSecondary;
            button.FlatAppearance.BorderColor = Theme.Border;
            HookButtonColors(button, Theme.Background, Theme.PrimaryLight, Theme.PrimaryLight, Theme.TextSecondary);
            return button;
        }

        public static Button CreateOutlinePrimaryButton(string text, EventHandler handler)
        {
            Button button = CreateBaseButton(text, handler);
            button.BackColor = Theme.PrimaryLight;
            button.ForeColor = Theme.Primary;
            button.FlatAppearance.BorderColor = Theme.Primary;
            HookButtonColors(button, Theme.PrimaryLight, Theme.Primary, Theme.Primary, Theme.Primary);
            button.MouseEnter += delegate { button.ForeColor = Theme.TextOnPrimary; };
            button.MouseLeave += delegate { button.ForeColor = Theme.Primary; };
            button.MouseDown += delegate { button.ForeColor = Theme.TextOnPrimary; };
            button.MouseUp += delegate { button.ForeColor = button.ClientRectangle.Contains(button.PointToClient(Control.MousePosition)) ? Theme.TextOnPrimary : Theme.Primary; };
            return button;
        }

        public static Button CreateToolButton(string text, EventHandler handler)
        {
            Button button = CreateBaseButton(text, handler);
            button.Width = Theme.ButtonHeightSM;
            button.Height = Theme.ButtonHeightSM;
            button.BackColor = Theme.Background;
            button.ForeColor = Theme.TextSecondary;
            button.FlatAppearance.BorderColor = Theme.Border;
            button.Font = Theme.CreateUiFont(14F, FontStyle.Bold);
            button.Padding = new Padding(0);
            HookButtonColors(button, Theme.Background, Theme.PrimaryLight, Theme.PrimaryLight, Theme.TextSecondary);
            return button;
        }

        public static Button CreateNavButton(string icon, string text, EventHandler handler)
        {
            Button button = CreateBaseButton(icon, handler);
            button.Width = Theme.NavButtonSize;
            button.Height = Theme.NavButtonSize;
            button.Font = Theme.CreateIconFont(18F);
            button.Padding = new Padding(0);
            button.BackColor = Color.Transparent;
            button.ForeColor = Theme.TextMuted;
            button.FlatAppearance.BorderSize = 0;
            button.Tag = text;
            button.AccessibleName = text;
            HookButtonColors(button, Color.Transparent, Theme.PrimaryLight, Theme.PrimaryLight, Theme.Primary);
            return button;
        }

        public static Button CreateSegmentButton(string text, bool selected)
        {
            Button button = CreateBaseButton(text, null);
            button.Dock = DockStyle.Fill;
            button.Margin = new Padding(0);
            button.Font = Theme.CreateUiFont(14F, FontStyle.Bold);
            ApplySegmentButtonState(button, selected);
            return button;
        }

        public static void ApplySegmentButtonState(Button button, bool selected)
        {
            if (selected)
            {
                button.BackColor = Theme.Primary;
                button.ForeColor = Theme.TextOnPrimary;
                button.FlatAppearance.BorderColor = Theme.Primary;
            }
            else
            {
                button.BackColor = Theme.PrimaryLight;
                button.ForeColor = Theme.Primary;
                button.FlatAppearance.BorderColor = Theme.PrimaryLight;
            }
        }

        public static void StyleInputTextBox(TextBox textBox, bool multiline)
        {
            textBox.BorderStyle = BorderStyle.None;
            textBox.BackColor = Theme.PrimaryLighter;
            textBox.ForeColor = Theme.TextPrimary;
            textBox.Font = Theme.CreateUiFont(multiline ? 13F : 14F, FontStyle.Regular);
            textBox.Multiline = multiline;
        }

        public static void StyleReadOnlyTextBox(TextBox textBox, bool mono)
        {
            StyleInputTextBox(textBox, true);
            textBox.ReadOnly = true;
            textBox.BackColor = Theme.Background;
            if (mono)
            {
                textBox.Font = Theme.CreateMonoFont(12F, FontStyle.Regular);
            }
        }

        public static void StyleListBox(ListBox listBox)
        {
            listBox.BorderStyle = BorderStyle.None;
            listBox.DrawMode = DrawMode.OwnerDrawFixed;
            listBox.ItemHeight = Theme.ListItemHeight;
            listBox.BackColor = Theme.Background;
            listBox.ForeColor = Theme.TextPrimary;
            listBox.Font = Theme.CreateUiFont(13F, FontStyle.Regular);
        }

        public static void DrawListBoxItem(ListBox listBox, DrawItemEventArgs e, bool selected)
        {
            if (e.Index < 0)
            {
                return;
            }

            e.DrawBackground();
            Graphics g = e.Graphics;
            Rectangle bounds = e.Bounds;
            using (SolidBrush brush = new SolidBrush(selected ? Theme.PrimaryLight : Theme.Background))
            {
                g.FillRectangle(brush, bounds);
            }

            if (selected)
            {
                using (SolidBrush accent = new SolidBrush(Theme.Primary))
                {
                    g.FillRectangle(accent, bounds.Left, bounds.Top + 6, 3, bounds.Height - 12);
                }
            }

            string text = e.Index >= 0 ? Convert.ToString(listBox.Items[e.Index]) : string.Empty;
            TextRenderer.DrawText(
                g,
                text,
                Theme.CreateUiFont(13F, FontStyle.Regular),
                new Rectangle(bounds.Left + Theme.SpaceLG, bounds.Top, bounds.Width - Theme.SpaceLG * 2, bounds.Height),
                Theme.TextPrimary,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis);
        }

        public static void HookInputShellFocus(SurfacePanel shell, TextBox textBox)
        {
            textBox.Enter += delegate
            {
                shell.BorderColor = Theme.BorderFocus;
                shell.Invalidate();
            };
            textBox.Leave += delegate
            {
                shell.BorderColor = Theme.Border;
                shell.Invalidate();
            };
        }

        public static void ApplyRoundedRegion(Control control, int radius)
        {
            if (control.Width <= 0 || control.Height <= 0)
            {
                return;
            }

            using (GraphicsPath path = Theme.CreateRoundedPath(new Rectangle(0, 0, control.Width, control.Height), radius))
            {
                control.Region = new Region(path);
            }
        }

        private static Button CreateBaseButton(string text, EventHandler handler)
        {
            Button button = new Button();
            button.Text = text;
            button.AutoSize = false;
            button.Height = Theme.ButtonHeightMD;
            button.Padding = new Padding(Theme.SpaceLG, 0, Theme.SpaceLG, 0);
            button.Margin = new Padding(0);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 1;
            button.Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            button.Cursor = Cursors.Hand;
            if (handler != null)
            {
                button.Click += handler;
            }

            button.Resize += delegate { ApplyRoundedRegion(button, Theme.RadiusMD); };
            return button;
        }

        private static void HookButtonColors(Button button, Color normal, Color hover, Color pressed, Color textColor)
        {
            button.BackColor = normal;
            button.ForeColor = textColor;
            button.MouseEnter += delegate
            {
                if (button.Enabled)
                {
                    button.BackColor = hover;
                }
            };
            button.MouseLeave += delegate
            {
                if (button.Enabled)
                {
                    button.BackColor = normal;
                }
            };
            button.MouseDown += delegate
            {
                if (button.Enabled)
                {
                    button.BackColor = pressed;
                }
            };
            button.MouseUp += delegate
            {
                if (button.Enabled)
                {
                    button.BackColor = button.ClientRectangle.Contains(button.PointToClient(Control.MousePosition)) ? hover : normal;
                }
            };
        }
    }
}
