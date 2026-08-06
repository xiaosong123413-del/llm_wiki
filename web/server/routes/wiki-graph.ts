/**
 * Route for the home-cover Graphy panel.
 *
 * The route returns a precomputed wiki graph so the browser only needs to
 * hydrate Sigma with nodes, edges, positions, colors, sizes, and labels.
 */
import type { Request, Response } from "express";
import type { ServerConfig } from "../config.js";
import { buildWikiGraph, buildWikiGraphForPage } from "../services/wiki-graph.js";

export function handleWikiGraph(cfg: ServerConfig) {
  // fallow-ignore-next-line complexity
  return (req: Request, res: Response) => {
    try {
      const pagePath = typeof req.query.path === "string" ? req.query.path.trim() : "";
      const data = pagePath ? buildWikiGraphForPage(cfg, pagePath) : buildWikiGraph(cfg);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
