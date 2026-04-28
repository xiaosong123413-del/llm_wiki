/**
 * Chat runtime public surface.
 *
 * Keeps the chat page import path stable while the summary builder logic lives
 * in a smaller implementation-focused module.
 */

export type {
  ChatAgentRuntimeApiAccount,
  ChatAgentRuntimeOAuthAccount,
  ChatRuntimeSummary,
} from "./runtime-summary-builder.js";
export { buildChatRuntimeSummary } from "./runtime-summary-builder.js";
