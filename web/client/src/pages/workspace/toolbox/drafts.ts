/**
 * Toolbox manager draft builders.
 *
 * These helpers isolate workflow and asset draft mapping so the main toolbox
 * state module can stay focused on state transitions instead of field shaping.
 */

import type {
  ToolboxAssetRecord,
  ToolboxManagerDraft,
  ToolboxWorkflowRecord,
} from "./types.js";

export function createWorkflowDraft(
  record: ToolboxWorkflowRecord | ToolboxAssetRecord | null,
): ToolboxManagerDraft {
  const workflow = record && record.entityType === "workflow" ? record : null;
  return {
    id: workflow?.id ?? "",
    entityType: "workflow",
    title: workflow?.title ?? "",
    summary: workflow?.summary ?? "",
    category: "",
    badge: "",
    href: "",
    ratioLabel: workflow?.ratioLabel ?? "1:1",
    agentName: workflow?.agentName ?? "",
    accent: workflow?.accent ?? "blue",
    sourceType: "managed",
  };
}

export function createAssetDraft(
  record: ToolboxWorkflowRecord | ToolboxAssetRecord | null,
): ToolboxManagerDraft {
  const asset = record && record.entityType === "asset" ? record : null;
  return {
    id: asset?.id ?? "",
    entityType: "asset",
    title: asset?.title ?? "",
    summary: asset?.summary ?? "",
    category: asset?.category ?? "标准资料",
    badge: asset?.badge ?? "标准资料",
    href: asset?.href ?? "",
    ratioLabel: "",
    agentName: "",
    accent: "blue",
    sourceType: asset?.source.type ?? "managed",
  };
}
