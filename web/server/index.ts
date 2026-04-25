import express from "express";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";
import { config as loadDotenv } from "dotenv";
import { parseArgs } from "./config.js";
import { registerCLIProxyRoutes } from "./routes/cliproxy.js";
import { registerAgentConfigRoutes } from "./routes/agent-config.js";
import { handleTaskPlanJsonParseError, registerTaskPlanRoutes } from "./routes/task-plan.js";
import { registerLlmRoutes } from "./routes/llm.js";
import { registerSearchRoutes } from "./routes/search.js";
import { handleTree } from "./routes/tree.js";
import {
  handleActivityLog,
  handlePage,
  handleProjectLog,
  handleProjectWorkspace,
  handleProjectWorkspaceDelete,
  handleRaw,
  handleWorkspaceDocs,
  handleWorkspaceDocsSave,
} from "./routes/pages.js";
import {
  handleWikiCommentAiDraftConfirm,
  handleWikiCommentAiDraftCreate,
  handleWikiCommentAiDraftDiscard,
  handleWikiCommentsCreate,
  handleWikiCommentsDelete,
  handleWikiCommentsList,
  handleWikiCommentsUpdate,
} from "./routes/wiki-comments.js";
import {
  handleFlashDiaryAppend,
  handleFlashDiaryList,
  handleFlashDiaryPage,
  handleFlashDiaryRetry,
  handleFlashDiarySave,
} from "./routes/flash-diary.js";
import { handleGraph } from "./routes/graph.js";
import { handleIntakeScan } from "./routes/intake.js";
import { registerProviderStatusRoutes } from "./routes/provider-status.js";
import {
  handleDeepResearchAction,
  handleDeepResearchBulkAdvance,
  handleDeepResearchBulkConfirm,
  handleDeepResearchChat,
  handleDeepResearchConfirm,
  handleReviewInboxBatchIngest,
  handleReviewSummary,
} from "./routes/review.js";
import {
  handleRemoteBrainPull,
  handleRemoteBrainPublish,
  handleRemoteBrainPush,
  handleRemoteBrainStatus,
} from "./routes/remote-brain.js";
import {
  handleSourceGalleryCompile,
  handleSourceGalleryCreate,
  handleSourceGalleryDelete,
  handleSourceGalleryDetail,
  handleSourceGalleryIngestQueue,
  handleSourceGalleryList,
  handleSourceGalleryMedia,
  handleSourceGalleryMoveToInbox,
  handleSourceGalleryOcr,
  handleSourceGallerySave,
  handleSourceGalleryTranscribe,
} from "./routes/source-gallery.js";
import {
  handleChatAddMessage,
  handleChatCreate,
  handleChatDelete,
  handleChatGet,
  handleChatList,
  handleChatPatch,
  handleChatStreamMessage,
} from "./routes/chat.js";
import { handleClipCreate, handleYtDlpInstall, handleYtDlpStatus } from "./routes/clips.js";
import { handleDouyinCookieSave, handleDouyinCookieStatusGet } from "./routes/douyin-import.js";
import {
  handleXiaohongshuCookieSave,
  handleXiaohongshuImportConfigDelete,
  handleXiaohongshuImportConfigGet,
  handleXiaohongshuImportConfigSave,
  handleXiaohongshuImportProgress,
  handleXiaohongshuImportStart,
} from "./routes/xiaohongshu-import.js";
import { handleXhsBatch, handleXhsExtract, handleXhsFailureDelete, handleXhsFavoritesSync, handleXhsStatus } from "./routes/xhs-sync.js";
import { handleSyncConfigGet, handleSyncConfigSave } from "./routes/sync-config.js";
import { handleToolboxCreate, handleToolboxDelete, handleToolboxList, handleToolboxSave } from "./routes/toolbox.js";
import { handleRunCurrent, handleRunEvents, handleRunStart, handleRunStop } from "./routes/runs.js";
import { createRunManager } from "./services/run-manager.js";

const cfg = parseArgs(process.argv);
loadProjectEnv(cfg.projectRoot);
const runManager = createRunManager();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(handleTaskPlanJsonParseError);

// ── API ────────────────────────────────────────────────────────────────────
app.get("/api/tree", handleTree(cfg));
registerCLIProxyRoutes(app, cfg);
registerAgentConfigRoutes(app, cfg);
registerTaskPlanRoutes(app, cfg);
registerLlmRoutes(app, cfg);
registerSearchRoutes(app, cfg);
registerProviderStatusRoutes(app);
app.get("/api/graph", handleGraph(cfg));
app.get("/api/remote-brain/status", handleRemoteBrainStatus(cfg));
app.post("/api/remote-brain/push", handleRemoteBrainPush(cfg));
app.post("/api/remote-brain/pull", handleRemoteBrainPull(cfg));
app.post("/api/remote-brain/publish", handleRemoteBrainPublish(cfg));
app.get("/api/page", handlePage(cfg));
app.get("/api/raw", handleRaw(cfg));
app.get("/api/log", handleActivityLog(cfg));
app.get("/api/project-log", handleProjectLog(cfg));
app.get("/api/project-log/workspace", handleProjectWorkspace(cfg));
app.delete("/api/project-log/workspace", handleProjectWorkspaceDelete(cfg));
app.get("/api/workspace/docs", handleWorkspaceDocs(cfg));
app.put("/api/workspace/docs", handleWorkspaceDocsSave(cfg));
app.get("/api/flash-diary", handleFlashDiaryList(cfg));
app.get("/api/flash-diary/page", handleFlashDiaryPage(cfg));
app.put("/api/flash-diary/page", handleFlashDiarySave(cfg));
app.post("/api/flash-diary/entry", handleFlashDiaryAppend(cfg));
app.post("/api/flash-diary/failures/:id/retry", handleFlashDiaryRetry(cfg));
app.get("/api/source-gallery", handleSourceGalleryList(cfg));
app.get("/api/source-gallery/media", handleSourceGalleryMedia(cfg));
app.get("/api/source-gallery/:id", handleSourceGalleryDetail(cfg));
app.put("/api/source-gallery/:id", handleSourceGallerySave(cfg));
app.delete("/api/source-gallery", handleSourceGalleryDelete(cfg));
app.post("/api/source-gallery/:id/ocr", handleSourceGalleryOcr(cfg));
app.post("/api/source-gallery/:id/transcribe", handleSourceGalleryTranscribe(cfg));
app.post("/api/source-gallery/:id/compile", handleSourceGalleryCompile(cfg, runManager));
app.post("/api/source-gallery/create", handleSourceGalleryCreate(cfg));
app.post("/api/source-gallery/selection/inbox", handleSourceGalleryMoveToInbox(cfg));
app.post("/api/source-gallery/selection/ingest", handleSourceGalleryIngestQueue(cfg));
app.post("/api/clips", handleClipCreate(cfg));
app.get("/api/clips/yt-dlp", handleYtDlpStatus(cfg));
app.post("/api/clips/yt-dlp/install", handleYtDlpInstall(cfg));
app.get("/api/sync/config", handleSyncConfigGet(cfg));
app.post("/api/sync/config", handleSyncConfigSave(cfg));
app.get("/api/import/xiaohongshu/config", handleXiaohongshuImportConfigGet(cfg));
app.post("/api/import/xiaohongshu/config", handleXiaohongshuImportConfigSave(cfg));
app.delete("/api/import/xiaohongshu/config", handleXiaohongshuImportConfigDelete(cfg));
app.post("/api/import/xiaohongshu/cookie", handleXiaohongshuCookieSave(cfg));
app.post("/api/import/xiaohongshu/start", handleXiaohongshuImportStart(cfg));
app.get("/api/import/xiaohongshu/progress", handleXiaohongshuImportProgress(cfg));
app.get("/api/import/douyin/cookie", handleDouyinCookieStatusGet(cfg));
app.post("/api/import/douyin/cookie", handleDouyinCookieSave(cfg));
app.get("/api/xhs-sync/status", handleXhsStatus(cfg));
app.post("/api/xhs-sync/extract", handleXhsExtract(cfg));
app.post("/api/xhs-sync/batch", handleXhsBatch(cfg));
app.post("/api/xhs-sync/favorites", handleXhsFavoritesSync(cfg));
app.delete("/api/xhs-sync/failures", handleXhsFailureDelete(cfg));
app.get("/api/intake/scan", handleIntakeScan(cfg));
app.get("/api/toolbox", handleToolboxList(cfg));
app.post("/api/toolbox", handleToolboxCreate(cfg));
app.put("/api/toolbox", handleToolboxSave(cfg));
app.delete("/api/toolbox", handleToolboxDelete(cfg));
app.get("/api/chat", handleChatList(cfg));
app.post("/api/chat", handleChatCreate(cfg));
app.get("/api/chat/:id", handleChatGet(cfg));
app.patch("/api/chat/:id", handleChatPatch(cfg));
app.delete("/api/chat/:id", handleChatDelete(cfg));
app.post("/api/chat/:id/messages/stream", handleChatStreamMessage(cfg));
app.post("/api/chat/:id/messages", handleChatAddMessage(cfg));
app.get("/api/runs/current", handleRunCurrent(runManager));
app.post("/api/runs/check", handleRunStart(cfg, runManager, "check"));
app.post("/api/runs/sync", handleRunStart(cfg, runManager, "sync"));
app.post("/api/runs/:id/stop", handleRunStop(runManager));
app.get("/api/runs/:id/events", handleRunEvents(runManager));
app.get("/api/review", handleReviewSummary(cfg, runManager));
app.post("/api/review/inbox/batch-ingest", handleReviewInboxBatchIngest(cfg));
app.post("/api/review/deep-research/bulk-advance", handleDeepResearchBulkAdvance(cfg));
app.post("/api/review/deep-research/bulk-confirm", handleDeepResearchBulkConfirm(cfg));
app.post("/api/review/deep-research/:id/actions", handleDeepResearchAction(cfg));
app.post("/api/review/deep-research/:id/confirm", handleDeepResearchConfirm(cfg));
app.post("/api/review/deep-research/:id/chat", handleDeepResearchChat(cfg));
app.get("/api/wiki-comments", handleWikiCommentsList(cfg));
app.post("/api/wiki-comments", handleWikiCommentsCreate(cfg));
app.post("/api/wiki-comments/:id/ai-draft", handleWikiCommentAiDraftCreate(cfg));
app.post("/api/wiki-comments/:id/ai-draft/:draftId/confirm", handleWikiCommentAiDraftConfirm(cfg));
app.delete("/api/wiki-comments/:id/ai-draft/:draftId", handleWikiCommentAiDraftDiscard(cfg));
app.patch("/api/wiki-comments/:id", handleWikiCommentsUpdate(cfg));
app.delete("/api/wiki-comments/:id", handleWikiCommentsDelete(cfg));
app.get("/api/config", (_req, res) => {
  res.json({
    author: cfg.author,
    sourceVaultRoot: path.basename(cfg.sourceVaultRoot),
    runtimeRoot: path.basename(cfg.runtimeRoot),
  });
});

// ── Static client ──────────────────────────────────────────────────────────
const here = path.dirname(url.fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../dist/client");
if (!fs.existsSync(clientDist)) {
  console.warn(
    `warning: client bundle not found at ${clientDist}. Run 'npm run build' first.`,
  );
}
app.use("/assets", express.static(path.join(clientDist, "assets")));
app.use("/katex", express.static(path.resolve(here, "../node_modules/katex/dist")));
app.use("/project-log-assets", express.static(path.join(cfg.projectRoot, "project-log-assets")));
app.get("/", (_req, res) => {
  const index = path.join(clientDist, "index.html");
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.status(500).send("client bundle missing. Run: npm run build");
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(cfg.port, cfg.host, () => {
  console.log(`llm-wiki web server listening on http://${cfg.host}:${cfg.port}`);
  console.log(`  source vault: ${cfg.sourceVaultRoot}`);
  console.log(`  runtime root: ${cfg.runtimeRoot}`);
  console.log(`  author:    ${cfg.author}`);
});

function loadProjectEnv(projectRoot: string): void {
  loadDotenv({ path: path.join(projectRoot, ".env") });
}
