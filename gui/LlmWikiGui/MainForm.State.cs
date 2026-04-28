using System;
using System.IO;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace LlmWikiGui
{
    public sealed partial class MainForm
    {
        private GuiPanelState LoadPanelState()
        {
            if (!File.Exists(panelStatePath))
            {
                return GuiPanelState.CreateDefault();
            }

            string json = File.ReadAllText(panelStatePath).TrimStart('\uFEFF');
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            GuiPanelState loaded = serializer.Deserialize<GuiPanelState>(json);
            if (loaded == null)
            {
                loaded = GuiPanelState.CreateDefault();
            }

            loaded.ApplyDefaults();
            return loaded;
        }

        private void SavePanelState()
        {
            if (panelState == null)
            {
                panelState = GuiPanelState.CreateDefault();
            }

            panelState.ApplyDefaults();
            CapturePanelState();
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            string json = serializer.Serialize(panelState);
            File.WriteAllText(panelStatePath, PrettyJson(json));
        }

        private void CapturePanelState()
        {
            panelState.nav_width = Theme.NavBarWidth;

            if (browserSplit != null && !browserSplit.Panel1Collapsed && browserSplit.Width > 0)
            {
                panelState.file_browser_width = browserSplit.SplitterDistance;
            }

            if (conversationSplit != null && conversationSplit.Width > 0)
            {
                panelState.conversation_width = conversationSplit.SplitterDistance;
            }

            if (chatPreviewSplit != null && chatPreviewSplit.Width > 0 && !chatPreviewSplit.Panel2Collapsed)
            {
                panelState.chat_width_with_preview = chatPreviewSplit.SplitterDistance;
                panelState.preview_width = chatPreviewSplit.Width - chatPreviewSplit.SplitterDistance - chatPreviewSplit.SplitterWidth;
            }
        }

        private void OnMainFormShown(object sender, EventArgs e)
        {
            if (panelStateApplied)
            {
                return;
            }

            railSplit.Panel1MinSize = Theme.NavBarWidth;
            railSplit.Panel2MinSize = 820;
            browserSplit.Panel1MinSize = 200;
            browserSplit.Panel2MinSize = 720;
            conversationSplit.Panel1MinSize = 260;
            conversationSplit.Panel2MinSize = 420;
            chatPreviewSplit.Panel1MinSize = 360;
            chatPreviewSplit.Panel2MinSize = 280;
            ApplyPanelStateToLayout();
            panelStateApplied = true;
        }

        private void ApplyPanelStateToLayout()
        {
            if (panelState == null)
            {
                panelState = GuiPanelState.CreateDefault();
            }

            panelState.ApplyDefaults();
            ApplySplitDistance(railSplit, panelState.nav_width);

            if (browserSplit != null && !browserSplit.Panel1Collapsed)
            {
                ApplySplitDistance(browserSplit, panelState.file_browser_width);
            }

            ApplySplitDistance(conversationSplit, panelState.conversation_width);

            if (chatPreviewSplit != null && !chatPreviewSplit.Panel2Collapsed)
            {
                int totalWidth = chatPreviewSplit.Width - chatPreviewSplit.SplitterWidth;
                int chatWidth = panelState.chat_width_with_preview;
                if (totalWidth > 0 && panelState.preview_width > 0)
                {
                    chatWidth = totalWidth - panelState.preview_width;
                }

                ApplySplitDistance(chatPreviewSplit, chatWidth);
            }
        }

        private static void ApplySplitDistance(SplitContainer splitContainer, int desiredDistance)
        {
            if (splitContainer == null || splitContainer.Width <= 0)
            {
                return;
            }

            int minDistance = splitContainer.Panel1MinSize;
            int maxDistance = splitContainer.Width - splitContainer.Panel2MinSize - splitContainer.SplitterWidth;
            if (maxDistance < minDistance)
            {
                return;
            }

            int clamped = Math.Max(minDistance, Math.Min(desiredDistance, maxDistance));
            splitContainer.SplitterDistance = clamped;
        }

        private void OnLayoutSplitterMoved(object sender, SplitterEventArgs e)
        {
            SavePanelState();
        }
    }
}
