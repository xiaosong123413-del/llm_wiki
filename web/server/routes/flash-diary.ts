/**
 * Flash-diary HTTP routes.
 *
 * Exposes diary listing, editable page reads/writes, the rendered Memory page,
 * and quick-capture failure recovery for the flash-diary workspace.
 */
import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { createRenderer } from "../render/markdown.js";
import type { LLMProvider } from "../../../src/utils/provider.js";
import {
  appendFlashDiaryEntry,
  listFlashDiaryFiles,
  readFlashDiaryFailures,
  readFlashDiaryPage,
  recordFlashDiaryFailure,
  removeFlashDiaryFailure,
  readTwelveQuestionsPage,
  readTwelveQuestionsSummary,
  readCloudDocument,
  saveCloudDocument,
  saveFlashDiaryPage,
  saveTwelveQuestionsPage,
  TWELVE_QUESTIONS_PATH,
} from "../services/flash-diary.js";
import {
  isLegacyShortTermMemory,
  readFlashDiaryMemoryPage,
  readFlashDiaryMemorySummary,
  readStoredFlashDiaryMemoryPage,
  refreshStoredFlashDiaryShortTermPage,
  refreshFlashDiaryMemoryIfDue,
} from "../services/flash-diary-memory.js";
import { MEMORY_PATH, MEMORY_TITLE } from "../services/flash-diary-memory-files.js";

export function handleFlashDiaryList(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    const items = await listFlashDiaryFiles(cfg.sourceVaultRoot);
    const memory = readFlashDiaryMemorySummary(cfg.sourceVaultRoot, cfg.runtimeRoot);
    const twelveQuestions = await readTwelveQuestionsSummary(cfg.sourceVaultRoot);
    res.json({ success: true, data: { items, memory, twelveQuestions } });
  };
}

export function handleFlashDiaryPage(cfg: ServerConfig) {
  const renderer = createRenderer({ pageLookupRoot: cfg.sourceVaultRoot });

  return async (req: Request, res: Response) => {
    try {
      const rawPath = String(req.query.path ?? "").trim();
      const page = rawPath.replace(/\\/g, "/") === TWELVE_QUESTIONS_PATH
        ? await readTwelveQuestionsPage(cfg.sourceVaultRoot)
        : await readFlashDiaryPage(cfg.sourceVaultRoot, rawPath);
      const rendered = renderer.render(page.raw);
      res.json({
        success: true,
        data: {
          ...page,
          html: rendered.html,
        },
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
}

export function handleFlashDiaryMemory(
  cfg: ServerConfig,
  options: { now?: Date; provider?: LLMProvider } = {},
) {
  const renderer = createRenderer({ pageLookupRoot: cfg.sourceVaultRoot });

  return async (_req: Request, res: Response) => {
    try {
      const storedPage = readStoredFlashDiaryMemoryPage(cfg.sourceVaultRoot, cfg.runtimeRoot);
      const cloudMemory = await readCloudDocument(MEMORY_PATH);
      if (cloudMemory) {
        const rendered = renderer.render(cloudMemory.raw);
        res.json({
          success: true,
          data: {
            path: MEMORY_PATH,
            title: MEMORY_TITLE,
            raw: cloudMemory.raw,
            modifiedAt: cloudMemory.updatedAt || new Date().toISOString(),
            sourceEditable: true,
            lastAppliedDiaryDate: storedPage?.lastAppliedDiaryDate ?? null,
            html: rendered.html,
          },
        });
        return;
      }
      
      if (storedPage) {
        const immediatePage = isLegacyShortTermMemory(storedPage.raw) && options.provider
          ? await Promise.race([
            refreshStoredFlashDiaryShortTermPage({
            projectRoot: cfg.projectRoot,
            sourceVaultRoot: cfg.sourceVaultRoot,
            runtimeRoot: cfg.runtimeRoot,
            now: options.now,
            provider: options.provider,
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 25)),
          ]) ?? storedPage
          : storedPage;
        void refreshFlashDiaryMemoryIfDue({
          projectRoot: cfg.projectRoot,
          sourceVaultRoot: cfg.sourceVaultRoot,
          runtimeRoot: cfg.runtimeRoot,
          now: options.now,
          provider: options.provider,
        }).catch(() => undefined);
        const rendered = renderer.render(immediatePage.raw);
        res.json({
          success: true,
          data: {
            ...immediatePage,
            html: rendered.html,
          },
        });
        return;
      }
      const page = await readFlashDiaryMemoryPage({
        projectRoot: cfg.projectRoot,
        sourceVaultRoot: cfg.sourceVaultRoot,
        runtimeRoot: cfg.runtimeRoot,
        now: options.now,
        provider: options.provider,
      });
      const rendered = renderer.render(page.raw);
      res.json({
        success: true,
        data: {
          ...page,
          html: rendered.html,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
}

export function handleFlashDiarySave(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    try {
      const rawPath = String(req.body?.path ?? "").trim();
      const raw = String(req.body?.raw ?? "");
      if (rawPath.replace(/\\/g, "/") === MEMORY_PATH) {
        await saveCloudDocument(MEMORY_PATH, MEMORY_TITLE, raw);
      } else if (rawPath.replace(/\\/g, "/") === TWELVE_QUESTIONS_PATH) {
        await saveTwelveQuestionsPage(cfg.sourceVaultRoot, raw);
      } else {
        await saveFlashDiaryPage(cfg.sourceVaultRoot, rawPath, raw);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
}

export function handleFlashDiaryAppend(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const text = String(req.body?.text ?? "");
    const mediaPaths = Array.isArray(req.body?.mediaPaths)
      ? req.body.mediaPaths.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const now = req.body?.now ? new Date(String(req.body.now)) : new Date();
    try {
      const result = await appendFlashDiaryEntry(cfg.sourceVaultRoot, { text, mediaPaths, now });
      res.json({ success: true, data: result });
    } catch (error) {
      const record = await recordFlashDiaryFailure(cfg.runtimeRoot, {
        createdAt: now.toISOString(),
        targetDate: now.toISOString().slice(0, 10),
        text,
        mediaFiles: mediaPaths,
        error: error instanceof Error ? error.message : String(error),
        status: "failed",
      });
      res.status(500).json({ success: false, error: record.error, data: record });
    }
  };
}

export function handleFlashDiaryRetry(cfg: ServerConfig) {
  return async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "");
    const failure = readFlashDiaryFailures(cfg.runtimeRoot).find((item) => item.id === id);
    if (!failure) {
      res.status(404).json({ success: false, error: "flash diary failure not found" });
      return;
    }

    try {
      const result = await appendFlashDiaryEntry(cfg.sourceVaultRoot, {
        text: failure.text,
        mediaPaths: failure.mediaFiles,
        now: new Date(failure.createdAt),
      });
      await removeFlashDiaryFailure(cfg.runtimeRoot, id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
}
