using System.Drawing;
using System.Drawing.Drawing2D;

namespace LlmWikiGui
{
    public static class Theme
    {
        public static readonly Color Primary = ColorTranslator.FromHtml("#7C5CFC");
        public static readonly Color PrimaryHover = ColorTranslator.FromHtml("#6B4AEB");
        public static readonly Color PrimaryLight = ColorTranslator.FromHtml("#F3F0FF");
        public static readonly Color PrimaryLighter = ColorTranslator.FromHtml("#F9F8FE");
        public static readonly Color Background = ColorTranslator.FromHtml("#FFFFFF");
        public static readonly Color Surface = ColorTranslator.FromHtml("#FAFAFE");
        public static readonly Color Border = ColorTranslator.FromHtml("#E8E5F0");
        public static readonly Color BorderFocus = ColorTranslator.FromHtml("#7C5CFC");
        public static readonly Color TextPrimary = ColorTranslator.FromHtml("#1A1A1A");
        public static readonly Color TextSecondary = ColorTranslator.FromHtml("#555555");
        public static readonly Color TextMuted = ColorTranslator.FromHtml("#999999");
        public static readonly Color TextOnPrimary = ColorTranslator.FromHtml("#FFFFFF");
        public static readonly Color TextOnPrimaryMuted = Color.FromArgb(228, 255, 255, 255);
        public static readonly Color Danger = ColorTranslator.FromHtml("#FF4444");
        public static readonly Color DangerLight = ColorTranslator.FromHtml("#FFE5E5");
        public static readonly Color PrimaryOverlay = Color.FromArgb(32, 255, 255, 255);
        public static readonly Color HeroGlow = ColorTranslator.FromHtml("#EEE9FF");
        public static readonly Color Shadow = Color.FromArgb(30, 26, 26, 26);

        public const int SpaceXS = 4;
        public const int SpaceSM = 8;
        public const int SpaceMD = 12;
        public const int SpaceLG = 16;
        public const int SpaceXL = 24;
        public const int SpaceXXL = 32;

        public const int RadiusSM = 6;
        public const int RadiusMD = 8;
        public const int RadiusLG = 12;
        public const int RadiusXL = 16;

        public const int NavBarWidth = 72;
        public const int FilePanelWidth = 260;
        public const int PreviewPanelWidth = 360;
        public const int TitleBarHeight = 40;
        public const int NavButtonSize = 48;
        public const int InputHeight = 44;
        public const int ButtonHeightLG = 44;
        public const int ButtonHeightMD = 36;
        public const int ButtonHeightSM = 32;
        public const int ListItemHeight = 36;
        public const int TreeItemHeight = 32;
        public const int TreeIndent = 16;

        public static Font CreateUiFont(float pixels, FontStyle style)
        {
            return new Font("Microsoft YaHei UI", pixels, style, GraphicsUnit.Pixel);
        }

        public static Font CreateLatinFont(float pixels, FontStyle style)
        {
            return new Font("Segoe UI", pixels, style, GraphicsUnit.Pixel);
        }

        public static Font CreateMonoFont(float pixels, FontStyle style)
        {
            return new Font("Cascadia Code", pixels, style, GraphicsUnit.Pixel);
        }

        public static Font CreateIconFont(float pixels)
        {
            return new Font("Segoe MDL2 Assets", pixels, FontStyle.Regular, GraphicsUnit.Pixel);
        }

        public static GraphicsPath CreateRoundedPath(Rectangle bounds, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int diameter = radius * 2;
            Rectangle arc = new Rectangle(bounds.Location, new Size(diameter, diameter));

            path.AddArc(arc, 180, 90);
            arc.X = bounds.Right - diameter;
            path.AddArc(arc, 270, 90);
            arc.Y = bounds.Bottom - diameter;
            path.AddArc(arc, 0, 90);
            arc.X = bounds.Left;
            path.AddArc(arc, 90, 90);
            path.CloseFigure();
            return path;
        }
    }
}
