/**
 * Automation workspace live-refresh helpers.
 *
 * The automation UI only needs a tiny wrapper around the SSE endpoint so list
 * and detail pages can re-fetch when source-owned flow modules change.
 */

import { subscribeAutomationWorkspaceChanges } from "./api.js";

export function bindAutomationWorkspaceLiveRefresh(onRefresh: () => Promise<void>): () => void {
  return subscribeAutomationWorkspaceChanges(() => {
    void onRefresh();
  });
}
