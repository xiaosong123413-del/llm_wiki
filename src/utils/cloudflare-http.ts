/**
 * Minimal HTTP helpers for Cloudflare service adapters.
 *
 * Keeps authentication handling in one server-only module and returns compact,
 * structured errors without including token values.
 */

import {
  ensureTrailingSlash,
  type CloudflareServicesConfig,
} from "./cloudflare-services-config.js";
import { fetchWithOptionalProxy } from "./proxy-fetch.js";

export interface CloudflareClientError {
  type: string;
  message: string;
  status?: number;
  endpoint?: string;
}

export type CloudflareClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CloudflareClientError };

export async function postWorkerJson<T>(
  cfg: CloudflareServicesConfig,
  path: string,
  payload: unknown,
): Promise<CloudflareClientResult<T>> {
  if (!cfg.workerUrl || !cfg.remoteToken) {
    return missingConfig("Missing CLOUDFLARE_WORKER_URL or CLOUDFLARE_REMOTE_TOKEN");
  }
  return postJson<T>(joinUrl(cfg.workerUrl, path), payload, {
    Authorization: `Bearer ${cfg.remoteToken}`,
  });
}

export async function postCloudflareAiRun<T>(
  cfg: CloudflareServicesConfig,
  model: string | null,
  payload: unknown,
): Promise<CloudflareClientResult<T>> {
  if (!cfg.accountId || !cfg.apiToken || !model) {
    return missingConfig("Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, or model");
  }
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/ai/run/${model}`;
  return postJson<T>(endpoint, payload, {
    Authorization: `Bearer ${cfg.apiToken}`,
  });
}

export async function postJson<T>(
  endpoint: string,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<CloudflareClientResult<T>> {
  let response: Response;
  try {
    response = await fetchWithOptionalProxy(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      error: { type: "cloudflare-network-error", message: errorMessage(error), endpoint },
    };
  }
  return parseJsonResponse<T>(response, endpoint);
}

export function extractTextResponse(payload: unknown): string {
  if (typeof payload === "string") return payload;
  const record = asRecord(payload);
  const result = asRecord(record.result);
  return firstString(
    record.text,
    record.response,
    record.output,
    result.text,
    result.response,
    result.output,
  );
}

export function extractVectorResponse(payload: unknown): number[] {
  const record = asRecord(payload);
  const result = asRecord(record.result);
  const vectors = [record.vector, record.embedding, result.vector, result.embedding, result.data];
  for (const value of vectors) {
    if (isNumberArray(value)) return value;
    if (Array.isArray(value) && isNumberArray(value[0])) return value[0];
  }
  return [];
}

function joinUrl(base: string, path: string): string {
  return new URL(path.replace(/^\/+/, ""), ensureTrailingSlash(base)).toString();
}

async function parseJsonResponse<T>(
  response: Response,
  endpoint: string,
): Promise<CloudflareClientResult<T>> {
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      error: {
        type: "cloudflare-http-error",
        message: text || response.statusText,
        status: response.status,
        endpoint,
      },
    };
  }
  return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
}

function missingConfig(message: string): CloudflareClientResult<never> {
  return { ok: false, error: { type: "cloudflare-unconfigured", message } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return "";
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
