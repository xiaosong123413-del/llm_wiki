import { defineConfig } from "@src/utils/config/define-config.ts";

export default defineConfig((runtime) => ({
  server: {
    apiKey: runtime.required("SERVER_API_KEY"),
    port: Number(runtime.value("TRENDPUBLISH_BRIDGE_PORT", "8765")),
  },
  providers: {
    ai: {
      baseUrl: runtime.value("AI_BASE_URL", "https://api.deepseek.com/v1"),
      apiKey: runtime.required("AI_API_KEY"),
      model: runtime.value("AI_MODEL", "deepseek-chat"),
    },
    publish: {
      weixin: {
        appId: runtime.required("WEIXIN_APP_ID"),
        appSecret: runtime.required("WEIXIN_APP_SECRET"),
        author: runtime.value("WEIXIN_AUTHOR", "小宋"),
      },
      weixinRelay: {
        url: runtime.secret("WEIXIN_RELAY_URL"),
        token: runtime.secret("WEIXIN_RELAY_TOKEN"),
      },
    },
  },
  features: {
    article: {
      dryRun: false,
      sources: [],
      publisher: {
        provider: runtime.value("WEIXIN_PUBLISH_PROVIDER", "weixin") as "weixin" | "weixin-relay",
        accountId: runtime.value("WEIXIN_ACCOUNT_ID", ""),
      },
      renderer: {
        template: "dynamic",
        promptProfile: "general",
      },
      cover: { enabled: false, provider: "dashscope" },
      bodyImages: { mode: "off", provider: "dashscope", count: 0, size: "1024*1024" },
      deduplication: { enabled: false, embeddingProvider: "dashscope", vectorStore: "sqlite" },
      notifications: { channels: [] },
    },
  },
  storage: {
    artifacts: { provider: "local", outputDir: "src/temp/collection-bridge" },
    runState: { provider: "local-json", outputDir: "src/temp/collection-bridge" },
    vector: { provider: "sqlite", sqlitePath: "src/temp/collection-bridge.sqlite3" },
  },
}));
