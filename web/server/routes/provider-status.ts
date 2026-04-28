/**
 * Registers lightweight provider health and balance routes for settings.
 */
import type { Express, Request, Response } from "express";
import { fetchRelayBalance, getCodexCliStatus, type RelayBalanceInput } from "../services/provider-status.js";

export function registerProviderStatusRoutes(app: Express): void {
  app.post("/api/providers/relay/balance", handleRelayBalance());
  app.get("/api/providers/codex-cli/status", handleCodexCliStatus());
}

function handleRelayBalance() {
  return async (req: Request, res: Response) => {
    const input = parseRelayBalanceInput(req.body);
    const data = await fetchRelayBalance(input);
    res.json({ success: true, data });
  };
}

function handleCodexCliStatus() {
  return async (_req: Request, res: Response) => {
    const data = await getCodexCliStatus();
    res.json({ success: true, data });
  };
}

function parseRelayBalanceInput(body: unknown): RelayBalanceInput {
  if (!isRecord(body)) {
    return { url: "" };
  }
  return {
    url: readString(body.url),
    key: readOptionalString(body.key),
    balancePath: readOptionalString(body.balancePath),
    usedPath: readOptionalString(body.usedPath),
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
