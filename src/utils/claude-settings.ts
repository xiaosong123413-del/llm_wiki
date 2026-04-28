/**
 * Claude settings fallback helpers.
 *
 * Re-exports the Claude settings reader plus Anthropic env resolution helpers
 * behind the existing public module path.
 */

export { readClaudeSettingsEnv } from "./claude-settings-reader.js";
export {
  resolveAnthropicAuthFromEnv,
  resolveAnthropicBaseURLFromEnv,
  resolveAnthropicModelFromEnv,
} from "./claude-settings-resolver.js";
