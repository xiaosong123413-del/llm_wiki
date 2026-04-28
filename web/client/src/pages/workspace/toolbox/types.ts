/**
 * Client-side toolbox page contracts.
 *
 * These types model the richer toolbox dashboard payload returned by
 * `/api/toolbox` and the local UI state used by the workspace toolbox
 * controller.
 */

type ToolboxMode = "工作流" | "工具资产";
export type ToolboxEntityType = "workflow" | "asset";
export type ToolboxAccent = "violet" | "green" | "orange" | "blue" | "pink";
type ToolboxAssetSourceType = "managed" | "legacy-markdown";

interface ToolboxPageMeta {
  title: string;
  subtitle: string;
  defaultMode: ToolboxMode;
  modes: ToolboxMode[];
  assetCategories: string[];
}

export interface ToolboxWorkflowRecord {
  id: string;
  entityType: "workflow";
  title: string;
  summary: string;
  ratioLabel: string;
  agentName: string;
  accent: ToolboxAccent;
}

interface ToolboxAssetSource {
  type: ToolboxAssetSourceType;
  path?: string;
}

export interface ToolboxAssetRecord {
  id: string;
  entityType: "asset";
  title: string;
  summary: string;
  category: string;
  badge: string;
  href: string;
  source: ToolboxAssetSource;
}

export interface ToolboxRecentRunRecord {
  id: string;
  agentName: string;
  ranAtLabel: string;
  accent: ToolboxAccent;
}

export interface ToolboxFavoriteRecord {
  id: string;
  title: string;
  accent: ToolboxAccent;
}

export interface ToolboxPageData {
  page: ToolboxPageMeta;
  workflows: ToolboxWorkflowRecord[];
  assets: ToolboxAssetRecord[];
  recentRuns: ToolboxRecentRunRecord[];
  favorites: ToolboxFavoriteRecord[];
}

export interface ToolboxPayload {
  success: boolean;
  data?: ToolboxPageData;
  error?: string;
}

export interface ToolboxManagerDraft {
  id: string;
  entityType: ToolboxEntityType;
  title: string;
  summary: string;
  category: string;
  badge: string;
  href: string;
  ratioLabel: string;
  agentName: string;
  accent: ToolboxAccent;
  sourceType: ToolboxAssetSourceType | "managed";
}

interface ToolboxManagerState {
  openSection: ToolboxEntityType | null;
  selectedId: string;
  draft: ToolboxManagerDraft | null;
}

export interface ToolboxState {
  status: "idle" | "loading" | "ready" | "error";
  data: ToolboxPageData | null;
  activeMode: ToolboxMode;
  activeAssetCategory: string;
  search: string;
  manager: ToolboxManagerState;
  error: string | null;
}
