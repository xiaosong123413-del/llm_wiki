using System;
using System.Drawing;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed class AppDialog : Form
    {
        public static DialogResult ShowConfirmation(IWin32Window owner, string title, string message)
        {
            using (AppDialog dialog = new AppDialog(title, message, "\u786e\u8ba4", "\u53d6\u6d88", true))
            {
                return dialog.ShowDialog(owner);
            }
        }

        public static DialogResult ShowInfo(IWin32Window owner, string title, string message)
        {
            using (AppDialog dialog = new AppDialog(title, message, "\u786e\u5b9a", null, false))
            {
                return dialog.ShowDialog(owner);
            }
        }

        public static DialogResult ShowWarning(IWin32Window owner, string title, string message)
        {
            using (AppDialog dialog = new AppDialog(title, message, "\u786e\u5b9a", null, false))
            {
                return dialog.ShowDialog(owner);
            }
        }

        private AppDialog(string title, string message, string confirmText, string cancelText, bool showCancel)
        {
            StartPosition = FormStartPosition.CenterParent;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            MinimizeBox = false;
            MaximizeBox = false;
            BackColor = Color.FromArgb(1, 1, 1);
            Opacity = 0.98D;
            Width = 460;
            Height = 260;

            SurfacePanel card = UiFactory.CreateCard(Theme.RadiusXL, new Padding(Theme.SpaceXXL));
            card.Dock = DockStyle.Fill;
            card.FillColor = Theme.Background;
            card.BorderColor = Theme.Border;
            card.Margin = new Padding(0);

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            Label titleLabel = UiFactory.CreateSectionTitle(title);
            titleLabel.Margin = new Padding(0, 0, 0, Theme.SpaceLG);
            layout.Controls.Add(titleLabel, 0, 0);

            Label body = new Label();
            body.Text = message;
            body.Dock = DockStyle.Fill;
            body.ForeColor = Theme.TextSecondary;
            body.Font = Theme.CreateUiFont(14F, FontStyle.Regular);
            body.Margin = new Padding(0);
            body.AutoEllipsis = false;
            layout.Controls.Add(body, 0, 1);

            FlowLayoutPanel actions = new FlowLayoutPanel();
            actions.Dock = DockStyle.Fill;
            actions.FlowDirection = FlowDirection.RightToLeft;
            actions.WrapContents = false;
            actions.AutoSize = true;
            actions.Margin = new Padding(0, Theme.SpaceXL, 0, 0);

            Button confirmButton = UiFactory.CreatePrimaryButton(confirmText, delegate
            {
                DialogResult = DialogResult.Yes;
                Close();
            });
            confirmButton.Width = 96;
            confirmButton.Height = Theme.ButtonHeightLG;
            actions.Controls.Add(confirmButton);

            if (showCancel)
            {
                Button cancelButton = UiFactory.CreateSecondaryButton(cancelText, delegate
                {
                    DialogResult = DialogResult.No;
                    Close();
                });
                cancelButton.Width = 96;
                cancelButton.Height = Theme.ButtonHeightLG;
                actions.Controls.Add(cancelButton);
            }

            layout.Controls.Add(actions, 0, 2);
            card.Controls.Add(layout);
            Controls.Add(card);
        }
    }
}
