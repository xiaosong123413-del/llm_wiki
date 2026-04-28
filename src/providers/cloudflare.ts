/**
 * Cloudflare LLM provider implementation.
 *
 * Uses a configured Worker endpoint when available, otherwise calls
 * Cloudflare Workers AI REST directly for text generation.
 */

import type { LLMMessage, LLMProvider, LLMTool } from "../utils/provider.js";
import { readCloudflareServicesConfig } from "../utils/cloudflare-services-config.js";
import {
  extractTextResponse,
  postCloudflareAiRun,
  postWorkerJson,
  type CloudflareClientResult,
} from "../utils/cloudflare-http.js";

interface CloudflareTextPayload {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  model: string | null;
}

/** Cloudflare-backed LLM provider. */
export class CloudflareProvider implements LLMProvider {
  private readonly model: string | null;

  constructor(model: string | null = null) {
    this.model = model;
  }

  async complete(system: string, messages: LLMMessage[], maxTokens: number): Promise<string> {
    const payload = this.buildPayload(system, messages, maxTokens);
    const result = await this.sendText(payload);
    if (!result.ok) throw new Error(result.error.message);
    return extractTextResponse(result.data);
  }

  async stream(
    system: string,
    messages: LLMMessage[],
    maxTokens: number,
    onToken?: (text: string) => void,
  ): Promise<string> {
    const text = await this.complete(system, messages, maxTokens);
    onToken?.(text);
    return text;
  }

  async toolCall(
    system: string,
    messages: LLMMessage[],
    _tools: LLMTool[],
    maxTokens: number,
  ): Promise<string> {
    return this.complete(system, messages, maxTokens);
  }

  private buildPayload(
    system: string,
    messages: LLMMessage[],
    maxTokens: number,
  ): CloudflareTextPayload {
    return {
      system,
      messages,
      maxTokens,
      model: this.model,
    };
  }

  private async sendText(payload: CloudflareTextPayload): Promise<CloudflareClientResult<unknown>> {
    const cfg = readCloudflareServicesConfig();
    if (cfg.workerUrl && cfg.remoteToken) {
      return postWorkerJson<unknown>(cfg, "llm", payload);
    }
    return postCloudflareAiRun<unknown>(cfg, this.model, {
      messages: [{ role: "system", content: payload.system }, ...payload.messages],
      max_tokens: payload.maxTokens,
    });
  }
}
