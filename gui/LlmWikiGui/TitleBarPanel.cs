using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed class TitleBarPanel : Panel
    {
        private const int WmNclbuttondown = 0x00A1;
        private const int HtCaption = 0x0002;

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);

        public TitleBarPanel()
        {
            MouseDown += OnBeginDrag;
            DoubleClick += OnToggleMaximize;
        }

        private void OnBeginDrag(object sender, MouseEventArgs e)
        {
            Form owner = FindForm();
            if (owner == null || e.Button != MouseButtons.Left)
            {
                return;
            }

            ReleaseCapture();
            SendMessage(owner.Handle, WmNclbuttondown, HtCaption, 0);
        }

        private void OnToggleMaximize(object sender, EventArgs e)
        {
            Form owner = FindForm();
            if (owner == null)
            {
                return;
            }

            MainForm mainForm = owner as MainForm;
            if (mainForm != null)
            {
                mainForm.PrepareForWindowStateChange();
            }

            owner.WindowState = owner.WindowState == FormWindowState.Maximized
                ? FormWindowState.Normal
                : FormWindowState.Maximized;
        }
    }
}
