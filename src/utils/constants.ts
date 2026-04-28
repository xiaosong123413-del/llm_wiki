/**
 * Shared constants for the llmwiki knowledge compiler.
 * Centralized config values to avoid magic numbers scattered across the codebase.
 */

/** Maximum source file size in characters before truncation. */
export const MAX_SOURCE_CHARS = 100_000;

/** Minimum source content length to ingest without a warning. */
export const MIN_SOURCE_CHARS = 50;

/** Number of most relevant wiki pages to load for query context. */
export const QUERY_PAGE_LIMIT = 5;

/** Maximum concurrent API calls during page generation. */
export const COMPILE_CONCURRENCY = 5;

/** API retry configuration. */
export const RETRY_COUNT = 3;
export const RETRY_BASE_MS = 1000;
export const RETRY_MULTIPLIER = 4;

/** Default provider when LLMWIKI_PROVIDER is not set. */
export const DEFAULT_PROVIDER = "anthropic";

/** Default model per provider. */
export const PROVIDER_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  ollama: "llama3.1",
  minimax: "MiniMax-M2.7",
  cloudflare: "@cf/meta/llama-3.1-8b-instruct",
};

/** Default Ollama API base URL. */
export const OLLAMA_DEFAULT_HOST = "http://localhost:11434/v1";

/** Directory names relative to the project root. */
export const SOURCES_DIR = "sources";
export const SOURCES_FULL_DIR = "sources_full";
export const CONCEPTS_DIR = "wiki/concepts";
export const EPISODES_DIR = "wiki/episodes";
export const PROCEDURES_DIR = "wiki/procedures";
export const QUERIES_DIR = "wiki/queries";
export const LLMWIKI_DIR = ".llmwiki";
export const STATE_FILE = ".llmwiki/state.json";
export const LOCK_FILE = ".llmwiki/lock";
export const CLAIMS_FILE = ".llmwiki/claims.json";
export const EPISODES_FILE = ".llmwiki/episodes.json";
export const PROCEDURES_FILE = ".llmwiki/procedures.json";
const FINAL_COMPILE_RESULT_FILE = ".llmwiki/final-compile-result.json";
const STAGING_DIR = ".llmwiki/staging";
export const INDEX_FILE = "wiki/index.md";
export const MOC_FILE = "wiki/MOC.md";
export const LOG_FILE = "log.md";
