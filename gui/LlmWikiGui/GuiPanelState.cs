namespace LlmWikiGui
{
    public sealed class GuiPanelState
    {
        public int nav_width { get; set; }
        public int file_browser_width { get; set; }
        public int conversation_width { get; set; }
        public int chat_width_with_preview { get; set; }
        public int preview_width { get; set; }

        public static GuiPanelState CreateDefault()
        {
            GuiPanelState state = new GuiPanelState();
            state.ApplyDefaults();
            return state;
        }

        public void ApplyDefaults()
        {
            nav_width = Theme.NavBarWidth;

            if (file_browser_width <= 0)
            {
                file_browser_width = Theme.FilePanelWidth;
            }

            if (conversation_width <= 0)
            {
                conversation_width = 320;
            }

            if (chat_width_with_preview <= 0)
            {
                chat_width_with_preview = 420;
            }

            if (preview_width <= 0)
            {
                preview_width = Theme.PreviewPanelWidth;
            }
        }
    }
}
