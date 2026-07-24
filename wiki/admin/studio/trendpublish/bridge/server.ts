import { initializeAppConfig, validateAppConfig } from "@src/utils/config/app-config.ts";
import type { ResolvedTrendPublishConfig } from "@src/utils/config/define-config.ts";
import { LlmProviderResolver } from "@src/integrations/llm/llm-provider-resolver.ts";
import { WeixinDynamicHtmlGenerator } from "@src/features/weixin-article/rendering/dynamic/dynamic-html.generator.ts";
import { WeixinArticleTemplateRenderer } from "@src/features/weixin-article/rendering/article.renderer.ts";
import { NoopArticleImageLayoutService, type WeixinTemplate } from "@src/features/weixin-article/domain/renderable-article.ts";
import { WeixinPublisher } from "@src/integrations/publish/providers/weixin-publisher.ts";
import { WeixinRelayPublisher } from "@src/integrations/publish/providers/weixin-relay-publisher.ts";
import { WeixinImageProcessor } from "@src/utils/image/image-processor.ts";
import type { ContentImageUploader, ContentPublisher } from "@src/core/ports/content-publisher.ts";

const HOST = "127.0.0.1";
const PORT = Number(Deno.env.get("TRENDPUBLISH_BRIDGE_PORT") || "8765");
const BRIDGE_KEY = Deno.env.get("TRENDPUBLISH_BRIDGE_KEY")?.trim() || "";
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("TRENDPUBLISH_ALLOWED_ORIGINS") || "https://llm-wiki.cn,http://localhost:4175,http://127.0.0.1:4175")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const IDLE_TIMEOUT_MS = Number(Deno.env.get("TRENDPUBLISH_IDLE_TIMEOUT_MS") || String(30 * 60 * 1000));

if (!BRIDGE_KEY) {
  console.error("缺少 TRENDPUBLISH_BRIDGE_KEY，拒绝启动本地桥接服务。");
  Deno.exit(1);
}

const config = await initializeAppConfig();
let lastActivityAt = Date.now();
let shuttingDown = false;
let server: Deno.HttpServer | undefined;

interface CollectionSource {
  id: string;
  title: string;
  summary?: string;
  bodyText?: string;
  bodyHtml?: string;
  sourceUrl?: string;
  publishDate?: string;
  coverUrl?: string;
  images?: Array<{ url: string; alt?: string; width?: number; height?: number }>;
  sourceVersion?: number;
}

interface GenerateRequest {
  source: CollectionSource;
  conversion?: "faithful" | "longform" | "thematic";
  template?: "极简阅读" | "长文杂志" | "个人随笔" | string;
  accountId?: string;
}

interface PublishRequest {
  title: string;
  digest: string;
  html: string;
  coverUrl: string;
  accountId?: string;
  sourceId?: string;
  sourceVersion?: number;
  version?: number;
}

server = Deno.serve({ hostname: HOST, port: PORT }, async (request) => {
  lastActivityAt = Date.now();
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "trendpublish-collection-bridge",
        version: "1.0.0",
        host: HOST,
        port: PORT,
        allowedOrigin: isAllowedOrigin(origin),
        idleShutdownMinutes: Math.round(IDLE_TIMEOUT_MS / 60000),
      }, 200, origin);
    }

    if (!isAllowedOrigin(origin)) {
      return json({ error: "来源站点未获授权" }, 403, origin);
    }
    if (!timingSafeEqual(request.headers.get("X-TrendPublish-Key") || "", BRIDGE_KEY)) {
      return json({ error: "本地发布器配对密钥无效" }, 401, origin);
    }

    if (request.method === "POST" && url.pathname === "/api/wechat/generate") {
      await validateAppConfig({ requireLLM: true });
      const payload = await readJson<GenerateRequest>(request);
      validateSource(payload.source);
      const result = await generateWechatHtml(payload, config);
      return json(result, 200, origin);
    }

    if (request.method === "POST" && url.pathname === "/api/wechat/validate") {
      await validateAppConfig({ requireWeixinPublish: true });
      const payload = await readJson<{ accountId?: string }>(request);
      const publisher = createPublisher(config, payload.accountId);
      const result = await publisher.validateIpWhitelist();
      return json({ ok: result === true, ip: result === true ? undefined : result }, 200, origin);
    }

    if (request.method === "POST" && url.pathname === "/api/wechat/publish") {
      await validateAppConfig({ requireWeixinPublish: true });
      const payload = await readJson<PublishRequest>(request);
      validatePublishRequest(payload);
      const result = await publishWechatDraft(payload, config);
      scheduleShutdown(5000);
      return json(result, 200, origin);
    }

    return json({ error: "接口不存在" }, 404, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[collection-bridge] ${request.method} ${url.pathname}:`, error);
    return json({ error: message }, 500, origin);
  }
});

console.log(`TrendPublish Collection Bridge 已启动：http://${HOST}:${PORT}`);
console.log(`允许来源：${[...ALLOWED_ORIGINS].join(", ")}`);

setInterval(() => {
  if (!shuttingDown && Date.now() - lastActivityAt > IDLE_TIMEOUT_MS) {
    scheduleShutdown(0);
  }
}, 30_000);

async function generateWechatHtml(
  payload: GenerateRequest,
  baseConfig: ResolvedTrendPublishConfig,
) {
  const template = resolveTemplate(payload.template, payload.conversion);
  const requestConfig = structuredClone(baseConfig);
  requestConfig.features.article.renderer.template = template;
  requestConfig.features.article.bodyImages.mode = "off";

  const publisher = createPublisher(requestConfig, payload.accountId);
  let dynamicGenerator: WeixinDynamicHtmlGenerator | undefined;
  if (template === "dynamic") {
    const llm = await new LlmProviderResolver(requestConfig).getDefaultProvider();
    dynamicGenerator = new WeixinDynamicHtmlGenerator(
      llm,
      resolvePromptProfile(payload.conversion),
      {
        displayName: "小宋",
        positioning: "个人知识、生活观察与长期收藏",
        audience: "希望持续学习、改善生活并保留个人经验的中文读者",
        tone: conversionTone(payload.conversion),
        titleStyle: "具体、克制、有信息量，避免空泛标题",
      },
    );
  }

  const renderer = new WeixinArticleTemplateRenderer(
    dynamicGenerator,
    false,
    new NoopArticleImageLayoutService(),
    publisher,
    template,
  );
  const templateData = sourceToTemplateData(payload.source);
  const html = await renderer.render(templateData, template);

  return {
    ok: true,
    html,
    title: payload.source.title,
    digest: buildDigest(payload.source),
    coverUrl: payload.source.coverUrl || payload.source.images?.[0]?.url || "",
    template,
    conversion: payload.conversion || "faithful",
    sourceId: payload.source.id,
    sourceVersion: payload.source.sourceVersion || 1,
    generatedAt: new Date().toISOString(),
  };
}

async function publishWechatDraft(
  payload: PublishRequest,
  baseConfig: ResolvedTrendPublishConfig,
) {
  const publisher = createPublisher(baseConfig, payload.accountId);
  const imageProcessor = new WeixinImageProcessor(publisher);
  const processed = await imageProcessor.processContent(payload.html);
  const failedImages = processed.results.filter((item) => item.error);
  if (failedImages.length) {
    throw new Error(
      `正文图片处理失败：${failedImages.map((item) => `${item.originalUrl}（${item.error}）`).join("；")}`,
    );
  }

  const coverMediaId = await publisher.uploadImage(payload.coverUrl);
  const result = await publisher.publishArticle({
    content: processed.content,
    title: payload.title,
    digest: payload.digest,
    coverMediaId,
  });

  return {
    ok: true,
    draft: result,
    imageResults: processed.results,
    sourceId: payload.sourceId,
    sourceVersion: payload.sourceVersion,
    version: payload.version,
    sentAt: new Date().toISOString(),
  };
}

function createPublisher(
  config: ResolvedTrendPublishConfig,
  accountId?: string,
): ContentPublisher & ContentImageUploader & { validateIpWhitelist(): Promise<string | boolean> } {
  const resolvedAccountId = accountId || config.features.article.publisher.accountId;
  if (config.features.article.publisher.provider === "weixin-relay") {
    return new WeixinRelayPublisher(
      config.providers.publish.weixinRelay,
      config.providers.publish.weixin,
      resolvedAccountId,
    );
  }
  return new WeixinPublisher(config.providers.publish.weixin, resolvedAccountId);
}

function sourceToTemplateData(source: CollectionSource): WeixinTemplate[] {
  const normalized = normalizeSourceText(source);
  const chunks = splitIntoChunks(normalized, 1450);
  const media = (source.images || []).filter((image) => /^https?:\/\//i.test(image.url)).map((image) => ({
    url: image.url,
    type: "image",
    size: { width: image.width || 0, height: image.height || 0 },
  }));
  return chunks.map((content, index) => ({
    id: `${source.id}-${index + 1}`,
    title: chunks.length === 1 ? source.title : `${source.title} · 第 ${index + 1} 部分`,
    content,
    url: source.sourceUrl || "",
    publishDate: source.publishDate || new Date().toISOString(),
    metadata: {
      collectionSourceId: source.id,
      sourceVersion: source.sourceVersion || 1,
      originalTitle: source.title,
      originalContentExcerpt: normalized.slice(0, 1800),
    },
    keywords: [],
    media: index === 0 ? media : [],
  }));
}

function normalizeSourceText(source: CollectionSource): string {
  const raw = source.bodyText?.trim() || htmlToText(source.bodyHtml || "") || source.summary?.trim() || "";
  if (!raw) throw new Error("来源文章正文为空");
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToText(html: string): string {
  if (!html.trim()) return "";
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/section|\/h[1-6]|\/blockquote|\/li)>/gi, "\n\n")
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, "\n[图片：$1]\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoChunks(text: string, limit: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > limit) {
      if (current) chunks.push(current);
      for (let index = 0; index < paragraph.length; index += limit) {
        chunks.push(paragraph.slice(index, index + limit));
      }
      current = "";
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > limit && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, limit)];
}

function resolveTemplate(template?: string, conversion?: string): string {
  if (conversion === "longform" || conversion === "thematic") return "dynamic";
  if (template === "长文杂志") return "longform";
  if (template === "个人随笔") return "dynamic";
  return "minimal";
}

function resolvePromptProfile(conversion?: string): "general" | "research" {
  return conversion === "thematic" || conversion === "longform" ? "research" : "general";
}

function conversionTone(conversion?: string): string {
  if (conversion === "thematic") return "围绕一个清晰主线重组内容，但不得增加原文没有的事实；保留个人判断与具体经验";
  if (conversion === "longform") return "补足文章开头、层级与段落衔接，形成连贯长文；保持原文观点和事实边界";
  return "忠实保留原文顺序与语气，只优化段落节奏、标题层级和公众号可读性";
}

function buildDigest(source: CollectionSource): string {
  const digest = (source.summary || normalizeSourceText(source)).replace(/\s+/g, " ").trim();
  return digest.slice(0, 120);
}

function validateSource(source?: CollectionSource) {
  if (!source?.id?.trim()) throw new Error("缺少来源文章 ID");
  if (!source.title?.trim()) throw new Error("缺少来源文章标题");
  normalizeSourceText(source);
}

function validatePublishRequest(payload?: PublishRequest) {
  if (!payload?.title?.trim()) throw new Error("缺少公众号标题");
  if (!payload.digest?.trim()) throw new Error("缺少公众号摘要");
  if (!payload.html?.trim() || !/^\s*<section\b/i.test(payload.html)) {
    throw new Error("公众号 HTML 无效：正文必须以 section 为根节点");
  }
  if (!payload.coverUrl?.trim() || !/^https?:\/\//i.test(payload.coverUrl)) {
    throw new Error("封面必须是可公开访问的 HTTP(S) 图片地址");
  }
  if (/<script\b|\son\w+\s*=|<iframe\b|<form\b/i.test(payload.html)) {
    throw new Error("公众号 HTML 含不安全或不兼容内容");
  }
}

function isAllowedOrigin(origin: string): boolean {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-TrendPublish-Key",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (isAllowedOrigin(origin) && origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(value: unknown, status: number, origin: string): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { status, headers });
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error("请求 JSON 无效");
  }
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) diff |= (a[index] || 0) ^ (b[index] || 0);
  return diff === 0;
}

function scheduleShutdown(delayMs: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  setTimeout(async () => {
    console.log("TrendPublish Collection Bridge 正在退出。");
    await server?.shutdown();
  }, delayMs);
}
