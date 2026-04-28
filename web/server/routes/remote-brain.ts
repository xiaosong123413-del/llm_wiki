import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import {
  getRemoteBrainStatus,
  queueRemoteBrainPull,
  queueRemoteBrainPublish,
  queueRemoteBrainPush,
} from "../services/remote-brain-sync.js";

export function handleRemoteBrainStatus(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    const result = await getRemoteBrainStatus(cfg);
    if (result.ok) {
      res.json({
        success: true,
        data: result.data,
      });
      return;
    }

    res.status(result.statusCode).json({
      success: false,
      error: result.error,
      data: result.data,
    });
  };
}

export function handleRemoteBrainPush(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    const result = await queueRemoteBrainPush(cfg);
    if (result.ok) {
      res.json({
        success: true,
        data: result.data,
      });
      return;
    }

    res.status(result.statusCode).json({
      success: false,
      error: result.error,
      data: result.data,
    });
  };
}

export function handleRemoteBrainPull(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    const result = await queueRemoteBrainPull(cfg);
    if (result.ok) {
      res.json({
        success: true,
        data: result.data,
      });
      return;
    }

    res.status(result.statusCode).json({
      success: false,
      error: result.error,
      data: result.data,
    });
  };
}

export function handleRemoteBrainPublish(cfg: ServerConfig) {
  return async (_req: Request, res: Response) => {
    const result = await queueRemoteBrainPublish(cfg);
    if (result.ok) {
      res.json({
        success: true,
        data: result.data,
      });
      return;
    }

    res.status(result.statusCode).json({
      success: false,
      error: result.error,
      data: result.data,
    });
  };
}
