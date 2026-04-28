import { renderIcon } from "../../components/icon.js";
import {
  applyPanelWidth,
  clampPanelWidth,
  readPanelWidth,
  writePanelWidth,
  type PanelWidthBounds,
} from "../../shell/panel-layout.js";
import { attachResizeHandle } from "../../shell/resize-handle.js";
import { createWorkspaceToolboxController } from "./toolbox/controller.js";
import type { ToolboxEntityType } from "./toolbox/types.js";
import {
  TASK_POOL_UNGROUPED_DOMAIN,
  TASK_POOL_UNGROUPED_PROJECT,
  addTaskPoolTreeChild,
  canDeleteTaskPoolTreeNode,
  canRenameTaskPoolTreeNode,
  deleteTaskPoolTreeNode,
  getTaskPoolDomainName,
  getTaskPoolProjectOptionKey,
  getTaskPoolTreeNodeLabel,
  getTaskPoolTreeOptions,
  moveTaskPoolTaskToProject,
  renameTaskPoolTreeNode,
  type TaskPoolTreeLevel,
  type TaskPoolTreeNodeIdentity,
} from "./task-pool-tree-model.js";
import {
  renderTaskPoolTreeLayout,
  type TaskPoolTreeRenderState,
} from "./task-pool-tree-view.js";

type WorkspaceTab = "project-progress" | "task-plan" | "task-pool" | "work-log" | "toolbox";

type WorkspaceDocKind = "root" | "domain" | "project" | "work-log";

interface WorkspacePageOptions {
  routeSection?: string;
}

interface WorkspaceRouteState {
  activeTab: WorkspaceTab;
  toolboxSection: ToolboxEntityType | null;
  taskPoolDomainSlug: string | null;
}

interface WorkspaceTabDefinition {
  id: WorkspaceTab;
  label: string;
}

const WORKSPACE_TABS: readonly WorkspaceTabDefinition[] = [
  { id: "project-progress", label: "\u9879\u76ee\u63a8\u8fdb\u9875" },
  { id: "task-plan", label: "\u4efb\u52a1\u8ba1\u5212\u9875" },
  { id: "task-pool", label: "\u4efb\u52a1\u6c60" },
  { id: "work-log", label: "\u5de5\u4f5c\u65e5\u5fd7" },
  { id: "toolbox", label: "\u5de5\u5177\u7bb1" },
];

interface WorkspaceDocument {
  id: string;
  kind: WorkspaceDocKind;
  label: string;
  path: string;
  title: string | null;
  html: string;
  raw: string;
  modifiedAt: string | null;
  domain: string | null;
  project: string | null;
}

interface WorkspaceDocsPayload {
  success: boolean;
  data?: {
    documents: WorkspaceDocument[];
  };
  error?: string;
}

interface WorkspaceDocsState {
  status: "idle" | "loading" | "ready" | "error";
  documents: WorkspaceDocument[];
  selectedId: string;
  error: string | null;
}

type TaskPlanLoadStatus = "idle" | "loading" | "ready" | "error";

type TaskPlanRoadmapWindow = "current" | "prev" | "next";

type TaskPlanRoadmapView = "week";
type TaskPlanSplitCollapse = "none" | "top" | "bottom";

type TaskPlanPriority = "high" | "mid" | "low" | "cool" | "neutral";
type TaskPlanTaskSource = "文字输入" | "近日状态" | "闪念日记" | "工作日志" | "AI 生成" | "手动新增";

interface TaskPlanVoiceState {
  transcript: string;
  audioPath: string | null;
  updatedAt: string | null;
}

export interface TaskPlanPoolItem {
  id: string;
  title: string;
  priority: TaskPlanPriority;
  source: TaskPlanTaskSource;
  domain?: string;
  project?: string;
}

interface TaskPlanScheduleItem {
  id: string;
  title: string;
  startTime: string;
  priority: TaskPlanPriority;
}

interface TaskPlanScheduleState {
  generationId: string | null;
  revisionId: string | null;
  items: TaskPlanScheduleItem[];
  confirmed: boolean;
}

interface TaskPlanRoadmapEntry {
  id: string;
  title: string;
}

interface TaskPlanRoadmapGroup {
  id: string;
  title: string;
  items: TaskPlanRoadmapEntry[];
}

interface TaskPlanRoadmapState {
  view: TaskPlanRoadmapView;
  windowStart: string;
  topLabel: string;
  windowLabel: string;
  groups: TaskPlanRoadmapGroup[];
}

interface TaskPlanMorningFlowState {
  voiceDone: boolean;
  diaryDone: boolean;
  planningDone: boolean;
  fineTuneDone: boolean;
}

interface TaskPlanState {
  voice: TaskPlanVoiceState;
  statusSummary: string;
  pool: {
    items: TaskPlanPoolItem[];
  };
  schedule: TaskPlanScheduleState;
  roadmap: TaskPlanRoadmapState;
  morningFlow: TaskPlanMorningFlowState;
}

interface TaskPlanViewState {
  status: TaskPlanLoadStatus;
  state: TaskPlanState | null;
  roadmapWindow: TaskPlanRoadmapWindow;
  roadmapView: TaskPlanRoadmapView;
  textDraft: string;
  statusDraft: string;
  poolDraft: TaskPlanPoolItem[];
  poolEditMode: boolean;
  poolDraftTouched: boolean;
  poolFilter: TaskPlanTaskSource | "全部";
  scheduleDraft: TaskPlanScheduleItem[];
  scheduleEditMode: boolean;
  splitRatio: number;
  busyAction: "text" | "pool" | "status" | "status-refresh" | "generate" | "save" | "roadmap" | null;
  feedback: string | null;
  error: string | null;
  pendingScheduleFocusId: string | null;
  draggingScheduleId: string | null;
  pendingPoolFocusId: string | null;
}

type TaskPoolViewMode = "list" | "tree";
type HealthDomainStatus = "idle" | "loading" | "ready" | "error";
type HealthImportTab = "account" | "api";

interface TaskPoolViewState {
  mode: TaskPoolViewMode;
  treeLevel: TaskPoolTreeLevel;
  selectedOptions: string[];
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  zoomPercent: number;
  selectedNode: TaskPoolTreeNodeIdentity | null;
  editingNode: TaskPoolTreeNodeIdentity | null;
  editValue: string;
  draggingTaskId: string | null;
  dropProjectKey: string | null;
}

interface HealthDomainConnectionState {
  mode: "account" | "api" | null;
  status: "disconnected" | "connected" | "error";
  label: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

interface HealthDomainSleepLatestState {
  bedTime: string | null;
  wakeTime: string | null;
  totalSleep: string | null;
  deepSleepQuality: string | null;
  deepSleepMinutes: number | null;
  restingHeartRate: string | null;
  sleepScore: string | null;
  awakeDuration: string | null;
  sleepAverageHeartRate: string | null;
  steps: string | null;
  intensityMinutes: string | null;
}

interface HealthDomainSleepTrendsState {
  bedTimes: string[];
  wakeTimes: string[];
  deepSleepMinutes: number[];
  sleepScores: number[];
  steps: number[];
  intensityMinutes: number[];
}

interface HealthDomainSleepState {
  latest: HealthDomainSleepLatestState;
  insights: string[];
  trends: HealthDomainSleepTrendsState;
}

interface HealthDomainState {
  connection: HealthDomainConnectionState;
  sleep: HealthDomainSleepState;
}

interface WorkspaceHealthStatePayload {
  success: boolean;
  data?: {
    state: HealthDomainState;
  };
  error?: string | WorkspaceHealthErrorPayload;
}

interface WorkspaceHealthErrorPayload {
  code?: string;
  message?: string;
  captchaImageDataUrl?: string;
}

interface WorkspaceHealthActionPayload {
  success: boolean;
  data?: {
    state?: HealthDomainState;
    maskedPhone?: string;
    ticketReady?: boolean;
    message?: string;
    sessionId?: string;
    qrImageUrl?: string;
    loginUrl?: string | null;
    status?: "pending" | "connected";
  };
  error?: string | WorkspaceHealthErrorPayload;
}

interface HealthDomainCaptchaChallengeState {
  imageDataUrl: string;
  message: string | null;
}

interface HealthDomainQrLoginState {
  sessionId: string;
  qrImageUrl: string;
  loginUrl: string | null;
}

interface HealthDomainViewState {
  status: HealthDomainStatus;
  state: HealthDomainState | null;
  activeImportTab: HealthImportTab;
  isImportModalOpen: boolean;
  accountDraft: {
    username: string;
    verificationCode: string;
    captchaCode: string;
  };
  apiDraft: {
    tokenJson: string;
    apiBaseUrl: string;
  };
  busyAction: "send-code" | "connect" | "sync" | "qr-login" | null;
  feedback: string | null;
  error: string | null;
  captchaChallenge: HealthDomainCaptchaChallengeState | null;
  qrLogin: HealthDomainQrLoginState | null;
}

interface TaskPlanStatePayload {
  success: boolean;
  data?: {
    state: TaskPlanState;
  };
  error?: string | { code?: string; message?: string };
}

interface TaskPlanRoadmapPayload {
  success: boolean;
  data?: {
    roadmap: TaskPlanRoadmapState;
  };
  error?: string | { code?: string; message?: string };
}

interface TaskPlanSchedulePayload {
  success: boolean;
  data?: {
    schedule: TaskPlanScheduleState;
  };
  error?: string | { code?: string; message?: string };
}

interface TaskPlanStateMutationPayload {
  success: boolean;
  data?: {
    state: TaskPlanState;
  };
  error?: string | { code?: string; message?: string };
}

const WORKSPACE_TREE_BOUNDS: PanelWidthBounds = {
  defaultWidth: 320,
  minWidth: 240,
  maxWidth: 520,
};

const TASK_POOL_TREE_BOUNDS: PanelWidthBounds = {
  defaultWidth: 252,
  minWidth: 196,
  maxWidth: 360,
};

const WORKSPACE_SIDEBAR_BOUNDS: PanelWidthBounds = {
  defaultWidth: 172,
  minWidth: 132,
  maxWidth: 260,
};

const WORKSPACE_SIDEBAR_COLLAPSED_WIDTH = 0;
const WORKSPACE_SIDEBAR_RAIL_EXPANDED_WIDTH = 10;
const WORKSPACE_SIDEBAR_RAIL_COLLAPSED_WIDTH = 34;

const TASK_PLAN_STEP_LABELS = [
  "文字输入与想法",
  "读取每日日记",
  "整合任务为自动规划",
  "手动微调后确认日程",
] as const;
const TASK_PLAN_SPLIT_RATIO_KEY = "workspace.taskPlanSplitRatio";
const TASK_PLAN_SPLIT_RATIO_DEFAULT = 0.34;
const TASK_PLAN_SPLIT_RATIO_MIN = 0.08;
const TASK_PLAN_SPLIT_RATIO_MAX = 0.92;
const TASK_PLAN_SPLIT_COLLAPSE_THRESHOLD = 0.14;
const TASK_PLAN_SPLIT_HANDLE_SIZE = 18;
const TASK_PLAN_SPLIT_TOP_COLLAPSED_HEIGHT = 60;
const TASK_PLAN_SPLIT_BOTTOM_COLLAPSED_HEIGHT = 68;
const TASK_PLAN_PRIORITY_LABELS: Record<TaskPlanPriority, string> = {
  high: "高",
  mid: "中",
  low: "低",
  cool: "中",
  neutral: "低",
};
const TASK_PLAN_SOURCE_LABELS = ["全部", "文字输入", "近日状态", "闪念日记", "工作日志", "AI 生成", "手动新增"] as const;
const TASK_POOL_TREE_SELECTION_LIMIT = 2;
const TASK_POOL_TREE_COLLAPSED_WIDTH = 56;
const TASK_POOL_ZOOM_MIN = 70;
const TASK_POOL_ZOOM_MAX = 130;
const TASK_POOL_ZOOM_STEP = 10;
const TASK_POOL_HEALTH_DOMAIN_SLUG = "health";
const TASK_POOL_DOMAIN_LABEL_OVERRIDES: Record<string, string> = {
  [TASK_POOL_HEALTH_DOMAIN_SLUG]: "健康",
};

export function renderWorkspacePage(options: WorkspacePageOptions = {}): HTMLElement {
  const root = document.createElement("section");
  root.className = "workspace-page";
  const initialRouteState = parseWorkspaceRouteState(options.routeSection);
  let activeTab: WorkspaceTab = initialRouteState.activeTab;
  let activeTaskPoolDomainSlug = initialRouteState.taskPoolDomainSlug;
  const toolboxController = createWorkspaceToolboxController({
    rerender: () => render(),
    initialSection: initialRouteState.toolboxSection,
    navigateTo(section) {
      const nextHash = buildWorkspaceHash("toolbox", section);
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    },
  });
  let isWorkspaceSidebarCollapsed = false;
  let isWorkspaceDocEditing = false;
  let isWorkspaceOutlineCollapsed = false;
  let workspaceDraftHtml = "";
  let workspaceDocSearch = "";
  let workspaceSidebarWidth = 0;
  let workspaceTreeWidth = 0;
  let workspaceDocsState: WorkspaceDocsState = {
    status: "idle",
    documents: [],
    selectedId: "",
    error: null,
  };
  let taskPlanState: TaskPlanViewState = createDefaultTaskPlanViewState();
  let taskPoolState: TaskPoolViewState = createDefaultTaskPoolViewState();
  let healthDomainState: HealthDomainViewState = createDefaultHealthDomainViewState();
  let taskPoolGestureState: { baselineScale: number; baselineZoomPercent: number } | null = null;
  let suppressNextTaskPoolTreeEditBlur = false;
  let taskPlanDraftScheduleSequence = 0;
  let taskPlanDraftPoolSequence = 0;
  const expandedDomains = new Set<string>();

  const ensureWorkspaceDocsLoaded = (): void => {
    if (workspaceDocsState.status === "loading" || workspaceDocsState.status === "ready") {
      return;
    }

    workspaceDocsState = {
      ...workspaceDocsState,
      status: "loading",
      error: null,
    };
    render();
    void loadWorkspaceDocs();
  };

  const loadWorkspaceDocs = async (): Promise<void> => {
    try {
      const response = await fetch("/api/workspace/docs");
      const payload = (await response.json()) as WorkspaceDocsPayload;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "\u5de5\u4f5c\u65e5\u5fd7\u8bfb\u53d6\u5931\u8d25");
      }

      workspaceDocsState = {
        status: "ready",
        documents: payload.data.documents,
        selectedId: payload.data.documents[0]?.id ?? "",
        error: null,
      };
      syncExpandedDomains(payload.data.documents);
      isWorkspaceDocEditing = false;
      workspaceDraftHtml = "";
      workspaceDocSearch = "";
    } catch (error) {
      workspaceDocsState = {
        status: "error",
        documents: [],
        selectedId: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const ensureTaskPlanLoaded = (): void => {
    if (taskPlanState.status === "loading" || taskPlanState.status === "ready") {
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      status: "loading",
      error: null,
    };
    render();
    void loadTaskPlanState();
  };

  const loadTaskPlanState = async (): Promise<void> => {
    try {
      const state = await fetchTaskPlanState();
      taskPlanState = {
        ...taskPlanState,
        status: "ready",
        state,
        textDraft: state.voice.transcript,
        statusDraft: state.statusSummary,
        poolDraft: cloneTaskPlanPoolItems(state.pool.items),
        poolDraftTouched: false,
        scheduleDraft: state.schedule.items.map((item) => ({ ...item })),
        error: null,
      };
      syncTaskPoolTreeSelection(state.pool.items, taskPoolState.treeLevel, activeTaskPoolDomainSlug);
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const repairTaskPlanPoolDraftIfNeeded = (): void => {
    if (!shouldRepairUntouchedTaskPlanPoolDraft(taskPlanState)) {
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      poolDraft: repairUntouchedTaskPlanPoolDraft(taskPlanState),
      error: null,
    };
  };

  const ensureHealthDomainLoaded = (): void => {
    if (
      healthDomainState.status === "loading" ||
      healthDomainState.status === "ready"
    ) {
      return;
    }
    healthDomainState = {
      ...healthDomainState,
      status: "loading",
      error: null,
    };
    render();
    void loadHealthDomainState();
  };

  const loadHealthDomainState = async (): Promise<void> => {
    try {
      const state = await fetchHealthDomainState();
      healthDomainState = {
        ...healthDomainState,
        status: "ready",
        state,
        error: null,
      };
    } catch (error) {
      healthDomainState = {
        ...healthDomainState,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const syncTaskPoolTreeSelection = (
    items: readonly TaskPlanPoolItem[],
    level: TaskPoolTreeLevel,
    domainSlug: string | null,
  ): void => {
    const options = getTaskPoolTreeOptions(
      filterTaskPoolItemsByDomain(items, domainSlug),
      level,
    );
    const optionKeys = options.map((option) => option.key);
    const nextSelected = taskPoolState.selectedOptions.filter((option) =>
      optionKeys.includes(option)
    );
    const selectedOptions =
      nextSelected.length > 0
        ? nextSelected
        : optionKeys.slice(0, TASK_POOL_TREE_SELECTION_LIMIT);
    taskPoolState = {
      ...taskPoolState,
      treeLevel: level,
      selectedOptions,
    };
  };

  const setTaskPoolViewMode = (mode: TaskPoolViewMode): void => {
    taskPoolState = {
      ...taskPoolState,
      mode,
    };
    if (mode === "tree") {
      syncTaskPoolTreeSelection(
        getTaskPlanPoolSharedItems(taskPlanState),
        taskPoolState.treeLevel,
        activeTaskPoolDomainSlug,
      );
    }
    render();
  };

  const setTaskPoolTreeLevel = (level: TaskPoolTreeLevel): void => {
    syncTaskPoolTreeSelection(
      getTaskPlanPoolSharedItems(taskPlanState),
      level,
      activeTaskPoolDomainSlug,
    );
    render();
  };

  const toggleTaskPoolTreeOption = (option: string): void => {
    const selectedOptions = taskPoolState.selectedOptions.includes(option)
      ? taskPoolState.selectedOptions.filter((item) => item !== option)
      : [...taskPoolState.selectedOptions, option];
    taskPoolState = {
      ...taskPoolState,
      selectedOptions,
    };
    render();
  };

  const setTaskPoolDomainSlug = (domainSlug: string | null): void => {
    activeTaskPoolDomainSlug = domainSlug;
    syncTaskPoolTreeSelection(
      getTaskPlanPoolSharedItems(taskPlanState),
      taskPoolState.treeLevel,
      activeTaskPoolDomainSlug,
    );
    if (activeTaskPoolDomainSlug === TASK_POOL_HEALTH_DOMAIN_SLUG) {
      ensureHealthDomainLoaded();
    }
    render();
  };

  const setTaskPoolZoomPercent = (nextZoom: number): void => {
    taskPoolState = {
      ...taskPoolState,
      zoomPercent: clampTaskPoolZoomPercent(nextZoom),
    };
    render();
  };

  const stepTaskPoolZoom = (direction: "in" | "out" | "reset"): void => {
    if (direction === "reset") {
      setTaskPoolZoomPercent(90);
      return;
    }
    const delta = direction === "in" ? TASK_POOL_ZOOM_STEP : -TASK_POOL_ZOOM_STEP;
    setTaskPoolZoomPercent(taskPoolState.zoomPercent + delta);
  };

  const syncTaskPoolTreeOptionsAfterMutation = (
    items: readonly TaskPlanPoolItem[],
    preferredNode: TaskPoolTreeNodeIdentity | null,
  ): void => {
    const options = getTaskPoolTreeOptions(
      filterTaskPoolItemsByDomain(items, activeTaskPoolDomainSlug),
      taskPoolState.treeLevel,
    );
    const optionKeys = options.map((option) => option.key);
    const nextSelected = taskPoolState.selectedOptions.filter((option) => optionKeys.includes(option));
    const preferredKey = preferredNode
      ? readTaskPoolTreePreferredOptionKey(preferredNode, taskPoolState.treeLevel)
      : null;
    const allowUnlistedTaskFocus =
      taskPoolState.treeLevel === "task" &&
      preferredNode?.type === "task" &&
      Boolean(preferredKey);
    const selectedOptions =
      preferredKey && (optionKeys.includes(preferredKey) || allowUnlistedTaskFocus)
        ? [preferredKey, ...nextSelected.filter((option) => option !== preferredKey)].slice(
            0,
            TASK_POOL_TREE_SELECTION_LIMIT,
          )
        : nextSelected.length > 0
          ? nextSelected
          : optionKeys.slice(0, TASK_POOL_TREE_SELECTION_LIMIT);
    taskPoolState = {
      ...taskPoolState,
      selectedOptions,
    };
  };

  const startTaskPoolTreeNodeEdit = (node: TaskPoolTreeNodeIdentity): void => {
    taskPoolState = {
      ...taskPoolState,
      selectedNode: node,
      editingNode: node,
      editValue: readTaskPoolTreeNodeDraftLabel(node, taskPlanState),
    };
    render();
  };

  const applyTaskPoolTreeEdit = (
    node: TaskPoolTreeNodeIdentity,
    nextValue: string,
  ): {
    items: TaskPlanPoolItem[];
    node: TaskPoolTreeNodeIdentity;
  } => {
    return {
      items: renameTaskPoolTreeNode(taskPlanState.poolDraft, node, nextValue),
      node: resolveTaskPoolTreeEditedNode(node, nextValue),
    };
  };

  const syncActiveTaskPoolDomainSlugAfterEdit = (
    previousNode: TaskPoolTreeNodeIdentity,
    nextNode: TaskPoolTreeNodeIdentity,
  ): void => {
    const previousSlug = getTaskPoolDomainSlug(previousNode.domain);
    if (
      previousNode.type !== "domain" ||
      activeTaskPoolDomainSlug !== previousSlug
    ) {
      return;
    }
    const nextSlug = getTaskPoolDomainSlug(nextNode.domain);
    activeTaskPoolDomainSlug = nextSlug;
    if (nextSlug === previousSlug) {
      return;
    }
    const nextHash = buildWorkspaceHash("task-pool", null, nextSlug);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  };

  const commitTaskPoolTreeEdit = (): TaskPoolTreeNodeIdentity | null => {
    const editingNode = taskPoolState.editingNode;
    if (!editingNode) {
      return null;
    }
    const nextEdit = applyTaskPoolTreeEdit(editingNode, taskPoolState.editValue);
    syncActiveTaskPoolDomainSlugAfterEdit(editingNode, nextEdit.node);
    taskPlanState = {
      ...taskPlanState,
      poolDraft: nextEdit.items,
      poolDraftTouched: true,
    };
    taskPoolState = {
      ...taskPoolState,
      selectedNode: nextEdit.node,
      editingNode: null,
    };
    syncTaskPoolTreeOptionsAfterMutation(nextEdit.items, nextEdit.node);
    render();
    return nextEdit.node;
  };

  const addTaskPoolTreeNodeChild = (
    node: TaskPoolTreeNodeIdentity,
    items: readonly TaskPlanPoolItem[] = taskPlanState.poolDraft,
  ): void => {
    const result = addTaskPoolTreeChild(items, node, createTaskPlanPoolDraftId());
    const nextTreeLevel = promoteTaskPoolTreeLevelForFocus(taskPoolState.treeLevel, result.focus);
    const preferredNode = nextTreeLevel === "task" && result.focus.type !== "task"
      ? createTaskPoolTreeFocusFromLastItem(result.items)
      : result.focus;
    taskPlanState = {
      ...taskPlanState,
      poolDraft: result.items,
      poolDraftTouched: true,
      error: null,
    };
    taskPoolState = {
      ...taskPoolState,
      treeLevel: nextTreeLevel,
      selectedNode: result.focus,
      editingNode: result.focus,
      editValue: "",
    };
    syncTaskPoolTreeOptionsAfterMutation(result.items, preferredNode);
    render();
  };

  const deleteTaskPoolTreeSelection = (node: TaskPoolTreeNodeIdentity): void => {
    if (!canDeleteTaskPoolTreeNode(node)) {
      return;
    }
    const nextItems = deleteTaskPoolTreeNode(taskPlanState.poolDraft, node);
    taskPlanState = {
      ...taskPlanState,
      poolDraft: nextItems,
      poolDraftTouched: true,
      error: null,
    };
    taskPoolState = {
      ...taskPoolState,
      selectedNode: null,
      editingNode: null,
      editValue: "",
    };
    syncTaskPoolTreeOptionsAfterMutation(nextItems, null);
    render();
  };

  const commitTaskPoolTreeEditAndAddChild = (): void => {
    const editingNode = taskPoolState.editingNode;
    if (!editingNode) {
      return;
    }
    const nextEdit = applyTaskPoolTreeEdit(editingNode, taskPoolState.editValue);
    syncActiveTaskPoolDomainSlugAfterEdit(editingNode, nextEdit.node);
    taskPlanState = {
      ...taskPlanState,
      poolDraft: nextEdit.items,
      poolDraftTouched: true,
      error: null,
    };
    taskPoolState = {
      ...taskPoolState,
      selectedNode: nextEdit.node,
      editingNode: null,
    };
    addTaskPoolTreeNodeChild(nextEdit.node, nextEdit.items);
  };

  const moveTaskPoolTreeTaskToProject = (
    taskId: string,
    targetDomain: string,
    targetProject: string,
  ): void => {
    const nextItems = moveTaskPoolTaskToProject(
      taskPlanState.poolDraft,
      taskId,
      targetDomain,
      targetProject,
    );
    const movedNode: TaskPoolTreeNodeIdentity = {
      type: "task",
      domain: targetDomain,
      project: targetProject,
      taskId,
    };
    taskPlanState = {
      ...taskPlanState,
      poolDraft: nextItems,
      poolDraftTouched: true,
      error: null,
    };
    taskPoolState = {
      ...taskPoolState,
      selectedNode: movedNode,
      editingNode: null,
      editValue: "",
      draggingTaskId: null,
      dropProjectKey: null,
    };
    syncTaskPoolTreeOptionsAfterMutation(nextItems, movedNode);
    render();
  };

  const updateHealthAccountDraft = (
    patch: Partial<HealthDomainViewState["accountDraft"]>,
  ): void => {
    const shouldResetCaptcha =
      typeof patch.username === "string" &&
      patch.username !== healthDomainState.accountDraft.username;
    healthDomainState = {
      ...healthDomainState,
      accountDraft: {
        ...healthDomainState.accountDraft,
        ...patch,
        ...(shouldResetCaptcha ? { captchaCode: "" } : {}),
      },
      ...(shouldResetCaptcha ? { captchaChallenge: null } : {}),
    };
  };

  const updateHealthApiDraft = (
    patch: Partial<HealthDomainViewState["apiDraft"]>,
  ): void => {
    healthDomainState = {
      ...healthDomainState,
      apiDraft: {
        ...healthDomainState.apiDraft,
        ...patch,
      },
    };
  };

  const openHealthImportModal = (): void => {
    healthDomainState = {
      ...healthDomainState,
      isImportModalOpen: true,
      error: null,
    };
    render();
  };

  const closeHealthImportModal = (): void => {
    healthDomainState = {
      ...healthDomainState,
      isImportModalOpen: false,
      error: null,
      captchaChallenge: null,
    };
    render();
  };

  const sendHealthVerificationCode = async (): Promise<void> => {
    healthDomainState = {
      ...healthDomainState,
      busyAction: "send-code",
      feedback: "正在发送验证码…",
      error: null,
    };
    render();
    try {
      const result = await postHealthVerificationCode(
        healthDomainState.accountDraft.username,
        healthDomainState.accountDraft.captchaCode,
      );
      if (result.kind === "captcha_required") {
        healthDomainState = {
          ...healthDomainState,
          busyAction: null,
          feedback: result.message,
          error: null,
          captchaChallenge: {
            imageDataUrl: result.captchaImageDataUrl,
            message: result.message,
          },
        };
        render();
        return;
      }
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        feedback: result.message ?? `验证码已发送到 ${result.maskedPhone}。`,
        error: null,
        captchaChallenge: result.ticketReady ? null : healthDomainState.captchaChallenge,
        accountDraft: {
          ...healthDomainState.accountDraft,
          captchaCode: result.ticketReady ? "" : healthDomainState.accountDraft.captchaCode,
        },
      };
    } catch (error) {
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const connectHealthAccount = async (): Promise<void> => {
    healthDomainState = {
      ...healthDomainState,
      busyAction: "connect",
      feedback: "正在连接小米运动健康账号…",
      error: null,
    };
    render();
    try {
      const result = await postHealthAccountConnection(healthDomainState.accountDraft);
      if (result.kind === "captcha_required") {
        healthDomainState = {
          ...healthDomainState,
          busyAction: null,
          feedback: result.message,
          error: null,
          captchaChallenge: {
            imageDataUrl: result.captchaImageDataUrl,
            message: result.message,
          },
        };
        render();
        return;
      }
      const state = result.state;
      healthDomainState = {
        ...healthDomainState,
        status: "ready",
        state,
        busyAction: null,
        feedback: "账号连接成功，正在同步健康数据…",
        error: null,
      };
      render();
      await syncHealthDomain();
      closeHealthImportModal();
      return;
    } catch (error) {
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const connectHealthApi = async (): Promise<void> => {
    healthDomainState = {
      ...healthDomainState,
      busyAction: "connect",
      feedback: "正在保存 API 连接…",
      error: null,
    };
    render();
    try {
      const state = await postHealthApiConnection(healthDomainState.apiDraft);
      healthDomainState = {
        ...healthDomainState,
        status: "ready",
        state,
        busyAction: null,
        feedback: "连接已保存，正在同步健康数据…",
        error: null,
      };
      render();
      await syncHealthDomain();
      closeHealthImportModal();
      return;
    } catch (error) {
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const startHealthQrLogin = async (): Promise<void> => {
    healthDomainState = {
      ...healthDomainState,
      busyAction: "qr-login",
      feedback: "正在生成小米账号二维码…",
      error: null,
      qrLogin: null,
    };
    render();
    try {
      const qrLogin = await postHealthQrLoginStart();
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        feedback: "请用小米账号 App 扫码确认登录。",
        error: null,
        qrLogin,
      };
      render();
      window.setTimeout(() => {
        void pollHealthQrLogin(qrLogin.sessionId);
      }, 2000);
    } catch (error) {
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
      render();
    }
  };

  const pollHealthQrLogin = async (sessionId: string): Promise<void> => {
    if (healthDomainState.qrLogin?.sessionId !== sessionId) {
      return;
    }
    try {
      const result = await getHealthQrLoginStatus(sessionId);
      if (result.status === "pending") {
        window.setTimeout(() => {
          void pollHealthQrLogin(sessionId);
        }, 2000);
        return;
      }
      healthDomainState = {
        ...healthDomainState,
        status: "ready",
        state: result.state,
        busyAction: null,
        feedback: "二维码登录成功，正在同步健康数据…",
        error: null,
      };
      render();
      await syncHealthDomain();
      closeHealthImportModal();
    } catch (error) {
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
      render();
    }
  };

  const syncHealthDomain = async (): Promise<void> => {
    healthDomainState = {
      ...healthDomainState,
      busyAction: "sync",
      feedback: "正在同步近 7 天睡眠数据…",
      error: null,
    };
    render();
    try {
      const state = await postHealthSync();
      healthDomainState = {
        ...healthDomainState,
        status: "ready",
        state,
        busyAction: null,
        feedback: "睡眠数据已同步。",
        error: null,
      };
    } catch (error) {
      healthDomainState = {
        ...healthDomainState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const syncExpandedDomains = (documents: readonly WorkspaceDocument[]): void => {
    for (const document of documents) {
      if (document.domain) {
        expandedDomains.add(document.domain);
      }
    }
  };

  const saveWorkspaceDoc = async (): Promise<void> => {
    const selected = workspaceDocsState.documents.find((item) => item.id === workspaceDocsState.selectedId);
    if (!selected) {
      return;
    }

    const editor = root.querySelector<HTMLElement>("[data-workspace-doc-editor]");
    const currentHtml = editor?.innerHTML ?? workspaceDraftHtml;
    const raw = htmlToMarkdown(currentHtml);
    const response = await fetch("/api/workspace/docs", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: selected.path,
        raw,
      }),
    });
    const payload = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? "工作日志保存失败");
    }

    workspaceDocsState = {
      ...workspaceDocsState,
      documents: workspaceDocsState.documents.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              raw,
              html: currentHtml,
              modifiedAt: new Date().toISOString(),
            }
          : item,
      ),
    };
    isWorkspaceDocEditing = false;
    workspaceDraftHtml = "";
    render();
  };

  const saveTaskPlanText = async (): Promise<void> => {
    const text = taskPlanState.textDraft.trim();
    if (!text) {
      taskPlanState = {
        ...taskPlanState,
        error: "文本内容不能为空",
      };
      render();
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      busyAction: "text",
      feedback: "正在保存文本输入…",
      error: null,
    };
    render();
    try {
      const state = await putTaskPlanText(text);
      taskPlanState = {
        ...taskPlanState,
        status: "ready",
        state,
        textDraft: state.voice.transcript,
        statusDraft: state.statusSummary,
        scheduleDraft: taskPlanState.scheduleEditMode
          ? taskPlanState.scheduleDraft
          : state.schedule.items.map((item) => ({ ...item })),
        busyAction: null,
        feedback: "文本输入已同步到今日计划。",
        error: null,
      };
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const saveTaskPlanStatus = async (): Promise<void> => {
    const statusSummary = taskPlanState.statusDraft.trim();
    if (!statusSummary) {
      taskPlanState = {
        ...taskPlanState,
        error: "近日状态不能为空",
      };
      render();
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      busyAction: "status",
      feedback: "正在保存近日状态…",
      error: null,
    };
    render();
    try {
      const state = await putTaskPlanStatus(statusSummary);
      taskPlanState = {
        ...taskPlanState,
        state,
        textDraft: state.voice.transcript,
        statusDraft: state.statusSummary,
        busyAction: null,
        feedback: "近日状态已保存。",
        error: null,
      };
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const toggleTaskPlanPoolEditMode = (): void => {
    if (!taskPlanState.poolEditMode && !taskPlanState.state) {
      ensureTaskPlanLoaded();
      taskPlanState = {
        ...taskPlanState,
        feedback: "正在载入共享任务池…",
        error: null,
      };
      render();
      return;
    }
    const currentItems = taskPlanState.state?.pool.items ?? [];
    const nextEditMode = !taskPlanState.poolEditMode;
    taskPlanState = {
      ...taskPlanState,
      poolEditMode: nextEditMode,
      poolDraft: cloneTaskPlanPoolItems(currentItems),
      poolDraftTouched: false,
      poolFilter: "全部",
      pendingPoolFocusId: null,
      error: null,
    };
    taskPoolState = {
      ...taskPoolState,
      selectedNode: null,
      editingNode: null,
      editValue: "",
      draggingTaskId: null,
      dropProjectKey: null,
    };
    render();
  };

  const updateTaskPlanPoolDraft = (
    itemId: string,
    patch: Partial<Pick<TaskPlanPoolItem, "title" | "priority" | "source">>,
  ): void => {
    taskPlanState = {
      ...taskPlanState,
      poolDraft: taskPlanState.poolDraft.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      poolDraftTouched: true,
    };
  };

  const createTaskPlanPoolDraftId = (): string => {
    taskPlanDraftPoolSequence += 1;
    return `draft-pool-${taskPlanDraftPoolSequence}`;
  };

  const addTaskPlanPoolDraftItem = (): string => {
    const nextId = createTaskPlanPoolDraftId();
    const domain =
      activeTaskPoolDomainSlug &&
      activeTaskPoolDomainSlug !== TASK_POOL_HEALTH_DOMAIN_SLUG
        ? resolveTaskPoolDomainLabel(activeTaskPoolDomainSlug)
        : undefined;
    taskPlanState = {
      ...taskPlanState,
      poolDraft: [
        ...taskPlanState.poolDraft,
        {
          id: nextId,
          title: "",
          priority: "neutral",
          source: "手动新增",
          domain,
        },
      ],
      poolDraftTouched: true,
      pendingPoolFocusId: nextId,
      error: null,
    };
    render();
    return nextId;
  };

  const removeTaskPlanPoolDraftItem = (itemId: string): void => {
    taskPlanState = {
      ...taskPlanState,
      poolDraft: taskPlanState.poolDraft.filter((item) => item.id !== itemId),
      poolDraftTouched: true,
      error: null,
    };
    render();
  };

  const saveTaskPlanPoolDraft = async (): Promise<void> => {
    repairTaskPlanPoolDraftIfNeeded();
    if (!taskPlanState.state) {
      ensureTaskPlanLoaded();
      taskPlanState = {
        ...taskPlanState,
        feedback: "共享任务池尚未加载完成，暂时无法保存。",
        error: null,
      };
      render();
      return;
    }
    const items = taskPlanState.poolDraft.map((item) => ({
      ...item,
      title: item.title.trim(),
      priority: normalizeTaskPlanPriority(item.priority),
    }));
    taskPlanState = {
      ...taskPlanState,
      busyAction: "pool",
      feedback: "正在保存任务池…",
      error: null,
    };
    render();
    try {
      const state = await putTaskPlanPool(items);
      taskPlanState = {
        ...taskPlanState,
        state,
        poolDraft: cloneTaskPlanPoolItems(state.pool.items),
        poolEditMode: false,
        poolDraftTouched: false,
        poolFilter: "全部",
        busyAction: null,
        feedback: "任务池已保存。",
        error: null,
      };
      taskPoolState = {
        ...taskPoolState,
        editingNode: null,
        editValue: "",
        draggingTaskId: null,
        dropProjectKey: null,
      };
      syncTaskPoolTreeSelection(
        state.pool.items,
        taskPoolState.treeLevel,
        activeTaskPoolDomainSlug,
      );
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const refreshTaskPlanStatus = async (): Promise<void> => {
    taskPlanState = {
      ...taskPlanState,
      busyAction: "status-refresh",
      feedback: "正在刷新近日状态…",
      error: null,
    };
    render();
    try {
      const state = await postTaskPlanStatusRefresh();
      taskPlanState = {
        ...taskPlanState,
        state,
        textDraft: state.voice.transcript,
        statusDraft: state.statusSummary,
        busyAction: null,
        feedback: "近日状态已刷新。",
        error: null,
      };
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const generateTaskPlanSchedule = async (): Promise<void> => {
    if (!taskPlanState.state) {
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      busyAction: "generate",
      feedback: "正在根据语音、日志和任务池生成建议时间表…",
      error: null,
    };
    render();
    try {
      const schedule = await postTaskPlanGenerate();
      taskPlanState = {
        ...taskPlanState,
        state: {
          ...taskPlanState.state,
          schedule,
          morningFlow: {
            ...taskPlanState.state.morningFlow,
            diaryDone: true,
            planningDone: true,
            fineTuneDone: false,
          },
        },
        scheduleDraft: schedule.items.map((item) => ({ ...item })),
        scheduleEditMode: false,
        busyAction: null,
        feedback: "AI 已生成新的建议时间表。",
        error: null,
      };
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const updateTaskPlanScheduleDraft = (
    itemId: string,
    patch: Partial<Pick<TaskPlanScheduleItem, "startTime" | "title" | "priority">>,
  ): void => {
    taskPlanState = {
      ...taskPlanState,
      scheduleDraft: taskPlanState.scheduleDraft.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    };
  };

  const toggleTaskPlanScheduleEditMode = (): void => {
    const currentItems = taskPlanState.state?.schedule.items ?? [];
    taskPlanState = {
      ...taskPlanState,
      scheduleEditMode: !taskPlanState.scheduleEditMode,
      scheduleDraft: currentItems.map((item) => ({ ...item })),
      pendingScheduleFocusId: null,
      draggingScheduleId: null,
      error: null,
    };
    render();
  };

  const saveTaskPlanScheduleDraft = async (): Promise<void> => {
    if (!taskPlanState.state) {
      return;
    }
    const items = taskPlanState.scheduleDraft.map((item) => ({
      ...item,
      title: item.title.trim(),
      startTime: item.startTime.trim(),
    }));
    taskPlanState = {
      ...taskPlanState,
      state: {
        ...taskPlanState.state,
        schedule: {
          ...taskPlanState.state.schedule,
          items,
        },
      },
    };
    render();
    await confirmTaskPlanSchedule();
  };

  const addTaskPlanScheduleDraftItem = (): string => {
    taskPlanDraftScheduleSequence += 1;
    const nextId = `draft-schedule-${taskPlanDraftScheduleSequence}`;
    taskPlanState = {
      ...taskPlanState,
      scheduleDraft: [
        ...taskPlanState.scheduleDraft,
        {
          id: nextId,
          title: "",
          startTime: "",
          priority: "neutral",
        },
      ],
      error: null,
      pendingScheduleFocusId: nextId,
    };
    render();
    return nextId;
  };

  const removeTaskPlanScheduleDraftItem = (itemId: string): void => {
    taskPlanState = {
      ...taskPlanState,
      scheduleDraft: taskPlanState.scheduleDraft.filter((item) => item.id !== itemId),
      error: null,
    };
    render();
  };

  const reorderTaskPlanScheduleDraft = (draggedId: string, targetId: string): void => {
    const draggedIndex = taskPlanState.scheduleDraft.findIndex((item) => item.id === draggedId);
    const targetIndex = taskPlanState.scheduleDraft.findIndex((item) => item.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      return;
    }
    const nextItems = taskPlanState.scheduleDraft.map((item) => ({ ...item }));
    const [draggedItem] = nextItems.splice(draggedIndex, 1);
    if (!draggedItem) {
      return;
    }
    const insertionIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + 1;
    nextItems.splice(insertionIndex, 0, draggedItem);
    const timeSlots = taskPlanState.scheduleDraft.map((item) => item.startTime);
    taskPlanState = {
      ...taskPlanState,
      scheduleDraft: nextItems.map((item, index) => ({
        ...item,
        startTime: timeSlots[index] ?? item.startTime,
      })),
      draggingScheduleId: null,
      error: null,
    };
    render();
  };

  const confirmTaskPlanSchedule = async (): Promise<void> => {
    if (!taskPlanState.state) {
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      busyAction: "save",
      feedback: "正在保存微调后的排期…",
      error: null,
    };
    render();
    try {
      const schedule = await putTaskPlanSchedule(taskPlanState.state.schedule.items, true);
      taskPlanState = {
        ...taskPlanState,
        state: {
          ...taskPlanState.state,
          schedule,
          morningFlow: {
            ...taskPlanState.state.morningFlow,
            fineTuneDone: true,
          },
        },
        scheduleDraft: schedule.items.map((item) => ({ ...item })),
        scheduleEditMode: false,
        busyAction: null,
        feedback: "微调已保存，当前日程已确认。",
        error: null,
      };
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const loadTaskPlanRoadmap = async (windowName: TaskPlanRoadmapWindow): Promise<void> => {
    if (!taskPlanState.state) {
      return;
    }
    taskPlanState = {
      ...taskPlanState,
      busyAction: "roadmap",
      roadmapWindow: windowName,
      feedback: "正在切换里程碑窗口…",
      error: null,
    };
    render();
    try {
      const roadmap = await fetchTaskPlanRoadmap(windowName, taskPlanState.roadmapView);
      taskPlanState = {
        ...taskPlanState,
        state: {
          ...taskPlanState.state,
          roadmap,
        },
        busyAction: null,
        feedback: `已切换到${roadmap.windowLabel}。`,
        error: null,
      };
    } catch (error) {
      taskPlanState = {
        ...taskPlanState,
        busyAction: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  };

  const render = (): void => {
    repairTaskPlanPoolDraftIfNeeded();
    root.innerHTML = `
      <div class="workspace-page__shell">
        <aside class="workspace-page__sidebar${isWorkspaceSidebarCollapsed ? " is-collapsed" : ""}" data-workspace-sidebar>
          <div class="workspace-page__sidebar-top">
            <div class="workspace-page__sidebar-label">\u5de5\u4f5c\u53f0</div>
          </div>
          <nav class="workspace-page__sidebar-nav" aria-label="\u5de5\u4f5c\u53f0\u5206\u9875">
            ${WORKSPACE_TABS.map((tab) => `
              <button
                type="button"
                class="workspace-page__sidebar-item${tab.id === activeTab ? " is-active" : ""}"
                data-workspace-tab="${tab.id}"
                data-active="${tab.id === activeTab ? "true" : "false"}"
              >${tab.label}</button>
            `).join("")}
          </nav>
        </aside>
        <div class="workspace-page__sidebar-rail${isWorkspaceSidebarCollapsed ? " is-collapsed" : ""}" data-workspace-sidebar-rail>
          <button
            type="button"
            class="workspace-page__sidebar-toggle"
            data-workspace-sidebar-toggle
            aria-label="${isWorkspaceSidebarCollapsed ? "\u5c55\u5f00\u5de5\u4f5c\u53f0\u5bfc\u822a" : "\u6298\u53e0\u5de5\u4f5c\u53f0\u5bfc\u822a"}"
          >${isWorkspaceSidebarCollapsed ? "\u203a" : "\u2039"}</button>
          <div class="workspace-page__sidebar-resize panel-resize-handle" data-workspace-sidebar-resize ${isWorkspaceSidebarCollapsed ? "hidden" : ""}></div>
        </div>
        <div class="workspace-page__content">
          <div class="workspace-page__body">
            ${renderWorkspaceView(activeTab, workspaceDocsState, {
              isEditing: isWorkspaceDocEditing,
              isOutlineCollapsed: isWorkspaceOutlineCollapsed,
            expandedDomains,
            draftHtml: workspaceDraftHtml,
            searchQuery: workspaceDocSearch,
            taskPlanState,
            taskPoolState,
            healthDomainState,
            activeTaskPoolDomainSlug,
            toolboxHtml: toolboxController.render(),
          })}
          </div>
        </div>
      </div>
    `;

    root.dataset.workspaceMode = activeTab;

    workspaceSidebarWidth = workspaceSidebarWidth || readPanelWidth("workspace.sidebarWidth", WORKSPACE_SIDEBAR_BOUNDS);
    applyPanelWidth(
      root,
      "--workspace-sidebar-width",
      isWorkspaceSidebarCollapsed ? WORKSPACE_SIDEBAR_COLLAPSED_WIDTH : workspaceSidebarWidth,
    );
    applyPanelWidth(
      root,
      "--workspace-sidebar-rail-width",
      isWorkspaceSidebarCollapsed ? WORKSPACE_SIDEBAR_RAIL_COLLAPSED_WIDTH : WORKSPACE_SIDEBAR_RAIL_EXPANDED_WIDTH,
    );

    root.querySelectorAll<HTMLButtonElement>("[data-workspace-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextTab = normalizeWorkspaceTab(button.dataset.workspaceTab);
        if (nextTab === activeTab) {
          return;
        }
        activeTab = nextTab;
        if (nextTab === "task-pool") {
          activeTaskPoolDomainSlug = null;
        }
        const nextHash = buildWorkspaceHash(nextTab, null, activeTaskPoolDomainSlug);
        if (window.location.hash !== nextHash) {
          window.location.hash = nextHash;
        }
        render();
        if (nextTab === "work-log") {
          ensureWorkspaceDocsLoaded();
        }
        if (tabNeedsTaskPlanState(nextTab)) {
          ensureTaskPlanLoaded();
        }
        if (nextTab === "toolbox") {
          toolboxController.ensureLoaded();
        }
      });
    });

    root.querySelector<HTMLButtonElement>("[data-workspace-sidebar-toggle]")?.addEventListener("click", () => {
      isWorkspaceSidebarCollapsed = !isWorkspaceSidebarCollapsed;
      render();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-workspace-doc-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextId = button.dataset.workspaceDocId ?? "";
        if (!nextId || nextId === workspaceDocsState.selectedId) {
          return;
        }
        workspaceDocsState = {
          ...workspaceDocsState,
          selectedId: nextId,
        };
        isWorkspaceDocEditing = false;
        workspaceDraftHtml = "";
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-workspace-domain-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const domain = button.dataset.workspaceDomainToggle ?? "";
        if (!domain) {
          return;
        }
        if (expandedDomains.has(domain)) {
          expandedDomains.delete(domain);
        } else {
          expandedDomains.add(domain);
        }
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-workspace-outline-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        isWorkspaceOutlineCollapsed = !isWorkspaceOutlineCollapsed;
        render();
      });
    });

    root.querySelector<HTMLInputElement>("[data-workspace-tree-search]")?.addEventListener("input", (event) => {
      workspaceDocSearch = (event.currentTarget as HTMLInputElement).value;
      render();
    });

    root.querySelector<HTMLButtonElement>("[data-workspace-edit-toggle]")?.addEventListener("click", () => {
      const selected = workspaceDocsState.documents.find((item) => item.id === workspaceDocsState.selectedId);
      if (!selected) {
        return;
      }
      isWorkspaceDocEditing = !isWorkspaceDocEditing;
      workspaceDraftHtml = selected.html;
      render();
    });

    root.querySelector<HTMLButtonElement>("[data-workspace-save]")?.addEventListener("click", () => {
      void saveWorkspaceDoc();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-workspace-format]").forEach((button) => {
      button.addEventListener("click", () => {
        applyWorkspaceFormat(button.dataset.workspaceFormat ?? "");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-workspace-heading-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.dataset.workspaceHeadingTarget ?? "";
        const target = root.querySelector<HTMLElement>(`#${cssEscape(targetId)}`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    toolboxController.bind(root);

    root.querySelector<HTMLTextAreaElement>("[data-task-plan-text-input]")?.addEventListener("input", (event) => {
      taskPlanState = {
        ...taskPlanState,
        textDraft: (event.currentTarget as HTMLTextAreaElement).value,
      };
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-text-save]")?.addEventListener("click", () => {
      void saveTaskPlanText();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-plan-pool-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        if (isTaskPlanPoolBusy(taskPlanState)) {
          return;
        }
        const nextFilter = (button.dataset.taskPlanPoolFilter ?? "全部") as TaskPlanTaskSource | "全部";
        taskPlanState = {
          ...taskPlanState,
          poolFilter: nextFilter,
        };
        render();
      });
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.addEventListener("click", () => {
      if (isTaskPlanPoolBusy(taskPlanState)) {
        return;
      }
      toggleTaskPlanPoolEditMode();
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-pool-add]")?.addEventListener("click", () => {
      if (isTaskPlanPoolBusy(taskPlanState)) {
        return;
      }
      addTaskPlanPoolDraftItem();
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.addEventListener("click", () => {
      if (isTaskPlanPoolBusy(taskPlanState)) {
        return;
      }
      void saveTaskPlanPoolDraft();
    });

    root.querySelectorAll<HTMLInputElement>("[data-task-plan-pool-title-input]").forEach((input) => {
      input.addEventListener("input", () => {
        if (isTaskPlanPoolBusy(taskPlanState)) {
          return;
        }
        const itemId = input.dataset.taskPlanPoolTitleInput;
        if (!itemId) {
          return;
        }
        updateTaskPlanPoolDraft(itemId, { title: input.value });
      });
    });

    root.querySelectorAll<HTMLSelectElement>("[data-task-plan-pool-source-input]").forEach((input) => {
      input.addEventListener("change", () => {
        if (isTaskPlanPoolBusy(taskPlanState)) {
          return;
        }
        const itemId = input.dataset.taskPlanPoolSourceInput;
        if (!itemId) {
          return;
        }
        updateTaskPlanPoolDraft(itemId, { source: input.value as TaskPlanTaskSource });
      });
    });

    root.querySelectorAll<HTMLSelectElement>("[data-task-plan-pool-priority-input]").forEach((input) => {
      input.addEventListener("change", () => {
        if (isTaskPlanPoolBusy(taskPlanState)) {
          return;
        }
        const itemId = input.dataset.taskPlanPoolPriorityInput;
        if (!itemId) {
          return;
        }
        updateTaskPlanPoolDraft(itemId, { priority: normalizeTaskPlanPriority(input.value) });
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-plan-pool-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        if (isTaskPlanPoolBusy(taskPlanState)) {
          return;
        }
        const itemId = button.dataset.taskPlanPoolRemove;
        if (!itemId) {
          return;
        }
        removeTaskPlanPoolDraftItem(itemId);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-pool-view-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.taskPoolViewMode;
        if (nextMode !== "list" && nextMode !== "tree") {
          return;
        }
        setTaskPoolViewMode(nextMode);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-pool-tree-level]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextLevel = button.dataset.taskPoolTreeLevel;
        if (nextLevel !== "domain" && nextLevel !== "project" && nextLevel !== "task") {
          return;
        }
        setTaskPoolTreeLevel(nextLevel);
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-task-pool-tree-option]").forEach((input) => {
      input.addEventListener("click", () => {
        const option = input.dataset.taskPoolTreeOption ?? "";
        if (!option) {
          return;
        }
        toggleTaskPoolTreeOption(option);
      });
    });

    root.querySelectorAll<HTMLElement>("[data-task-pool-tree-node]").forEach((node) => {
      node.addEventListener("click", () => {
        const treeNode = readTaskPoolTreeNodeIdentity(node);
        if (!treeNode) {
          return;
        }
        const sameNode = isSameTaskPoolTreeNode(taskPoolState.selectedNode, treeNode);
        const canStartEdit =
          sameNode &&
          taskPlanState.poolEditMode &&
          !isTaskPlanPoolBusy(taskPlanState) &&
          canRenameTaskPoolTreeNode(treeNode);
        if (canStartEdit) {
          startTaskPoolTreeNodeEdit(treeNode);
          return;
        }
        taskPoolState = {
          ...taskPoolState,
          selectedNode: treeNode,
          editingNode: null,
          editValue: "",
        };
        render();
      });

      node.addEventListener("keydown", (event) => {
        const treeNode = readTaskPoolTreeNodeIdentity(node);
        if (!treeNode || !taskPlanState.poolEditMode || isTaskPlanPoolBusy(taskPlanState)) {
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          addTaskPoolTreeNodeChild(treeNode);
          return;
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          if (!canDeleteTaskPoolTreeNode(treeNode)) {
            return;
          }
          event.preventDefault();
          deleteTaskPoolTreeSelection(treeNode);
        }
      });
    });

    root.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='task']").forEach((node) => {
      node.addEventListener("dragstart", (event) => {
        if (!taskPlanState.poolEditMode || isTaskPlanPoolBusy(taskPlanState)) {
          event.preventDefault();
          return;
        }
        const taskId = node.dataset.taskPoolTreeNodeTaskId;
        if (!taskId) {
          return;
        }
        event.dataTransfer?.setData("text/plain", taskId);
        taskPoolState = {
          ...taskPoolState,
          draggingTaskId: taskId,
          dropProjectKey: null,
        };
      });

      node.addEventListener("dragend", () => {
        taskPoolState = {
          ...taskPoolState,
          draggingTaskId: null,
          dropProjectKey: null,
        };
        render();
      });
    });

    root.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='project']").forEach((node) => {
      node.addEventListener("dragover", (event) => {
        const activeTaskId = readActiveTaskPoolDragTaskId(
          taskPoolState.draggingTaskId,
          event.dataTransfer ?? null,
        );
        if (!taskPlanState.poolEditMode || isTaskPlanPoolBusy(taskPlanState) || !activeTaskId) {
          return;
        }
        event.preventDefault();
        const targetDomain = node.dataset.taskPoolTreeNodeDomain ?? "";
        const targetProject = node.dataset.taskPoolTreeNodeProject ?? "";
        if (!targetDomain || !targetProject) {
          return;
        }
        const nextDropProjectKey = getTaskPoolProjectOptionKey(targetDomain, targetProject);
        if (taskPoolState.dropProjectKey === nextDropProjectKey) {
          return;
        }
        taskPoolState = {
          ...taskPoolState,
          dropProjectKey: nextDropProjectKey,
        };
        render();
      });

      node.addEventListener("dragleave", () => {
        const targetDomain = node.dataset.taskPoolTreeNodeDomain ?? "";
        const targetProject = node.dataset.taskPoolTreeNodeProject ?? "";
        if (
          taskPoolState.dropProjectKey !== getTaskPoolProjectOptionKey(targetDomain, targetProject)
        ) {
          return;
        }
        taskPoolState = {
          ...taskPoolState,
          dropProjectKey: null,
        };
        render();
      });

      node.addEventListener("drop", (event) => {
        if (!taskPlanState.poolEditMode || isTaskPlanPoolBusy(taskPlanState)) {
          return;
        }
        const activeTaskId = readActiveTaskPoolDragTaskId(
          taskPoolState.draggingTaskId,
          event.dataTransfer ?? null,
        );
        if (!activeTaskId) {
          return;
        }
        event.preventDefault();
        const targetDomain = node.dataset.taskPoolTreeNodeDomain ?? "";
        const targetProject = node.dataset.taskPoolTreeNodeProject ?? "";
        if (!targetDomain || !targetProject) {
          return;
        }
        moveTaskPoolTreeTaskToProject(activeTaskId, targetDomain, targetProject);
      });
    });

    root.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]")?.addEventListener("input", (event) => {
      if (isTaskPlanPoolBusy(taskPlanState)) {
        return;
      }
      taskPoolState = {
        ...taskPoolState,
        editValue: (event.currentTarget as HTMLInputElement).value,
      };
    });

    root.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]")?.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key !== "Enter" || isTaskPlanPoolBusy(taskPlanState)) {
        return;
      }
      event.preventDefault();
      suppressNextTaskPoolTreeEditBlur = true;
      commitTaskPoolTreeEditAndAddChild();
      window.setTimeout(() => {
        suppressNextTaskPoolTreeEditBlur = false;
      }, 0);
    });

    root.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]")?.addEventListener("blur", () => {
      if (suppressNextTaskPoolTreeEditBlur) {
        suppressNextTaskPoolTreeEditBlur = false;
        return;
      }
      if (isTaskPlanPoolBusy(taskPlanState)) {
        return;
      }
      commitTaskPoolTreeEdit();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-pool-domain-chip]").forEach((button) => {
      button.addEventListener("click", () => {
        const domainSlug = button.dataset.taskPoolDomainChip ?? "";
        const nextDomainSlug = domainSlug || null;
        setTaskPoolDomainSlug(nextDomainSlug);
        const nextHash = buildWorkspaceHash("task-pool", null, nextDomainSlug);
        if (window.location.hash !== nextHash) {
          window.location.hash = nextHash;
        }
      });
    });

    root.querySelector<HTMLButtonElement>("[data-task-pool-tree-sidebar-toggle]")?.addEventListener("click", () => {
      taskPoolState = {
        ...taskPoolState,
        isSidebarCollapsed: !taskPoolState.isSidebarCollapsed,
      };
      render();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-pool-zoom]").forEach((button) => {
      button.addEventListener("click", () => {
        const direction = button.dataset.taskPoolZoom;
        if (direction === "in" || direction === "out" || direction === "reset") {
          stepTaskPoolZoom(direction);
        }
      });
    });

    root.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]")?.addEventListener("wheel", (event) => {
      if (event.deltaY === 0) {
        return;
      }
      event.preventDefault();
      stepTaskPoolZoom(event.deltaY < 0 ? "in" : "out");
    });

    root.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]")?.addEventListener("gesturestart", (event) => {
      const scale = readTaskPoolGestureScale(event) ?? 1;
      taskPoolGestureState = {
        baselineScale: scale,
        baselineZoomPercent: taskPoolState.zoomPercent,
      };
      event.preventDefault();
    });

    root.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]")?.addEventListener("gesturechange", (event) => {
      const scale = readTaskPoolGestureScale(event);
      const gestureState = taskPoolGestureState;
      if (!scale || !gestureState) {
        return;
      }
      event.preventDefault();
      setTaskPoolZoomPercent(
        resolveTaskPoolGestureZoomPercent(
          gestureState.baselineZoomPercent,
          gestureState.baselineScale,
          scale,
        ),
      );
    });

    root.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]")?.addEventListener("gestureend", () => {
      taskPoolGestureState = null;
    });

    root.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]")?.addEventListener("gesturecancel", () => {
      taskPoolGestureState = null;
    });

    root.querySelector<HTMLButtonElement>("[data-health-import-open]")?.addEventListener("click", () => {
      openHealthImportModal();
    });

    root.querySelector<HTMLButtonElement>("[data-health-import-close]")?.addEventListener("click", () => {
      closeHealthImportModal();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-health-import-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextTab = button.dataset.healthImportTab;
        if (nextTab !== "account" && nextTab !== "api") {
          return;
        }
        healthDomainState = {
          ...healthDomainState,
          activeImportTab: nextTab,
          ...(nextTab === "api" ? { captchaChallenge: null } : {}),
        };
        render();
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-health-account-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.healthAccountInput;
        if (!field) {
          return;
        }
        updateHealthAccountDraft({ [field]: input.value } as Partial<HealthDomainViewState["accountDraft"]>);
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-health-api-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.healthApiInput;
        if (!field) {
          return;
        }
        updateHealthApiDraft({ [field]: input.value } as Partial<HealthDomainViewState["apiDraft"]>);
      });
    });

    root.querySelector<HTMLTextAreaElement>("[data-health-api-token-input]")?.addEventListener("input", (event) => {
      updateHealthApiDraft({ tokenJson: (event.currentTarget as HTMLTextAreaElement).value });
    });

    root.querySelector<HTMLButtonElement>("[data-health-send-code]")?.addEventListener("click", () => {
      void sendHealthVerificationCode();
    });

    root.querySelector<HTMLButtonElement>("[data-health-connect-account]")?.addEventListener("click", () => {
      void connectHealthAccount();
    });

    root.querySelector<HTMLButtonElement>("[data-health-connect-api]")?.addEventListener("click", () => {
      void connectHealthApi();
    });

    root.querySelector<HTMLButtonElement>("[data-health-qr-login]")?.addEventListener("click", () => {
      void startHealthQrLogin();
    });

    root.querySelector<HTMLButtonElement>("[data-health-sync]")?.addEventListener("click", () => {
      void syncHealthDomain();
    });

    root.querySelector<HTMLTextAreaElement>("[data-task-plan-status-input]")?.addEventListener("input", (event) => {
      taskPlanState = {
        ...taskPlanState,
        statusDraft: (event.currentTarget as HTMLTextAreaElement).value,
      };
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-status-save]")?.addEventListener("click", () => {
      void saveTaskPlanStatus();
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-status-refresh]")?.addEventListener("click", () => {
      void refreshTaskPlanStatus();
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-generate]")?.addEventListener("click", () => {
      void generateTaskPlanSchedule();
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-schedule-edit-toggle]")?.addEventListener("click", () => {
      toggleTaskPlanScheduleEditMode();
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-schedule-add]")?.addEventListener("click", () => {
      addTaskPlanScheduleDraftItem();
    });

    root.querySelectorAll<HTMLInputElement>("[data-task-plan-schedule-time-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const itemId = input.dataset.taskPlanScheduleTimeInput;
        if (!itemId) {
          return;
        }
        updateTaskPlanScheduleDraft(itemId, { startTime: input.value });
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        addTaskPlanScheduleDraftItem();
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-task-plan-schedule-title-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const itemId = input.dataset.taskPlanScheduleTitleInput;
        if (!itemId) {
          return;
        }
        updateTaskPlanScheduleDraft(itemId, { title: input.value });
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        addTaskPlanScheduleDraftItem();
      });
    });

    root.querySelectorAll<HTMLSelectElement>("[data-task-plan-schedule-priority-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const itemId = input.dataset.taskPlanSchedulePriorityInput;
        if (!itemId) {
          return;
        }
        updateTaskPlanScheduleDraft(itemId, { priority: normalizeTaskPlanPriority(input.value) });
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        addTaskPlanScheduleDraftItem();
      });
    });

    root.querySelectorAll<HTMLElement>("[data-task-plan-schedule-row]").forEach((row) => {
      const beginDrag = (event: DragEvent): void => {
        const itemId = row.dataset.taskPlanScheduleRow;
        if (!itemId) {
          return;
        }
        event.dataTransfer?.setData("text/plain", itemId);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.dropEffect = "move";
        }
        taskPlanState = {
          ...taskPlanState,
          draggingScheduleId: itemId,
        };
        row.classList.add("is-dragging");
      };
      row.addEventListener("dragstart", beginDrag);
      row.querySelector<HTMLElement>("[data-task-plan-schedule-drag]")?.addEventListener("dragstart", beginDrag);
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const targetId = row.dataset.taskPlanScheduleRow;
        const draggedId = event.dataTransfer?.getData("text/plain") || taskPlanState.draggingScheduleId;
        if (!targetId || !draggedId) {
          return;
        }
        reorderTaskPlanScheduleDraft(draggedId, targetId);
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("is-dragging");
        if (!taskPlanState.draggingScheduleId) {
          return;
        }
        taskPlanState = {
          ...taskPlanState,
          draggingScheduleId: null,
        };
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-plan-schedule-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.dataset.taskPlanScheduleRemove;
        if (!itemId) {
          return;
        }
        removeTaskPlanScheduleDraftItem(itemId);
      });
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-schedule-save]")?.addEventListener("click", () => {
      void saveTaskPlanScheduleDraft();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-task-plan-roadmap-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        void loadTaskPlanRoadmap(normalizeTaskPlanRoadmapWindow(button.dataset.taskPlanRoadmapNav));
      });
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-roadmap-window='current']")?.addEventListener("click", () => {
      void loadTaskPlanRoadmap("current");
    });

    root.querySelector<HTMLButtonElement>("[data-task-plan-roadmap-view='week']")?.addEventListener("click", () => {
      void loadTaskPlanRoadmap(taskPlanState.roadmapWindow);
    });

    const taskPlanSplitHandle = root.querySelector<HTMLElement>("[data-task-plan-split-handle]");
    const taskPlanLayout = root.querySelector<HTMLElement>("[data-task-plan-layout]");
    if (taskPlanSplitHandle && taskPlanLayout) {
      attachResizeHandle({
        handle: taskPlanSplitHandle,
        onMove(event) {
          const rect = taskPlanLayout.getBoundingClientRect();
          if (rect.height <= 0) {
            return;
          }
          const ratio = clampTaskPlanSplitRatio((event.clientY - rect.top) / rect.height);
          taskPlanState = {
            ...taskPlanState,
            splitRatio: ratio,
          };
          applyTaskPlanSplitLayout(taskPlanLayout, ratio);
        },
        onEnd() {
          taskPlanState = {
            ...taskPlanState,
            splitRatio: writeTaskPlanSplitRatio(taskPlanState.splitRatio),
          };
          applyTaskPlanSplitLayout(taskPlanLayout, taskPlanState.splitRatio);
        },
      });
      applyTaskPlanSplitLayout(taskPlanLayout, taskPlanState.splitRatio);
    }

    if (taskPlanState.pendingScheduleFocusId) {
      const focusTarget = root.querySelector<HTMLInputElement>(
        `[data-task-plan-schedule-time-input='${cssEscape(taskPlanState.pendingScheduleFocusId)}']`,
      ) ?? root.querySelector<HTMLInputElement>(
        `[data-task-plan-schedule-title-input='${cssEscape(taskPlanState.pendingScheduleFocusId)}']`,
      );
      if (focusTarget) {
        focusTarget.focus();
        taskPlanState = {
          ...taskPlanState,
          pendingScheduleFocusId: null,
        };
      }
    }

    if (taskPlanState.pendingPoolFocusId) {
      const focusTarget = root.querySelector<HTMLInputElement>(
        `[data-task-plan-pool-title-input='${cssEscape(taskPlanState.pendingPoolFocusId)}']`,
      );
      if (focusTarget) {
        focusTarget.focus();
        taskPlanState = {
          ...taskPlanState,
          pendingPoolFocusId: null,
        };
      }
    }

    const treeEditInput = root.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    if (treeEditInput && document.activeElement !== treeEditInput) {
      treeEditInput.focus();
      treeEditInput.setSelectionRange(treeEditInput.value.length, treeEditInput.value.length);
    }

    const treeResize = root.querySelector<HTMLElement>("[data-workspace-tree-resize]");
    if (treeResize) {
      attachResizeHandle({
        handle: treeResize,
        onMove(event) {
          workspaceTreeWidth = clampPanelWidth(event.clientX - root.getBoundingClientRect().left - 24, WORKSPACE_TREE_BOUNDS);
          applyPanelWidth(root, "--workspace-tree-width", workspaceTreeWidth);
        },
        onEnd() {
          workspaceTreeWidth = writePanelWidth("workspace.treeWidth", workspaceTreeWidth, WORKSPACE_TREE_BOUNDS);
          applyPanelWidth(root, "--workspace-tree-width", workspaceTreeWidth);
        },
      });
    }

    const sidebarResize = root.querySelector<HTMLElement>("[data-workspace-sidebar-resize]");
    if (sidebarResize) {
      attachResizeHandle({
        handle: sidebarResize,
        onMove(event) {
          workspaceSidebarWidth = clampPanelWidth(
            event.clientX - root.getBoundingClientRect().left - 24,
            WORKSPACE_SIDEBAR_BOUNDS,
          );
          applyPanelWidth(root, "--workspace-sidebar-width", workspaceSidebarWidth);
        },
        onEnd() {
          workspaceSidebarWidth = writePanelWidth("workspace.sidebarWidth", workspaceSidebarWidth, WORKSPACE_SIDEBAR_BOUNDS);
          applyPanelWidth(root, "--workspace-sidebar-width", workspaceSidebarWidth);
        },
      });
    }

    const taskPoolResize = root.querySelector<HTMLElement>("[data-task-pool-tree-resize]");
    if (taskPoolResize) {
      attachResizeHandle({
        handle: taskPoolResize,
        onMove(event) {
          taskPoolState = {
            ...taskPoolState,
            sidebarWidth: clampPanelWidth(
              event.clientX - root.getBoundingClientRect().left - 40,
              TASK_POOL_TREE_BOUNDS,
            ),
          };
          applyPanelWidth(
            root,
            "--task-pool-tree-sidebar-width",
            taskPoolState.sidebarWidth,
          );
        },
        onEnd() {
          taskPoolState = {
            ...taskPoolState,
            sidebarWidth: writePanelWidth(
              "workspace.taskPoolTreeSidebarWidth",
              taskPoolState.sidebarWidth,
              TASK_POOL_TREE_BOUNDS,
            ),
          };
          applyPanelWidth(
            root,
            "--task-pool-tree-sidebar-width",
            taskPoolState.sidebarWidth,
          );
        },
      });
    }

    if (activeTab === "work-log") {
      workspaceTreeWidth = workspaceTreeWidth || readPanelWidth("workspace.treeWidth", WORKSPACE_TREE_BOUNDS);
      applyPanelWidth(root, "--workspace-tree-width", workspaceTreeWidth);
      root.querySelector<HTMLElement>("[data-workspace-doc-editor]")?.addEventListener("input", (event) => {
        workspaceDraftHtml = (event.currentTarget as HTMLElement).innerHTML;
      });
    }

    if (activeTab === "task-pool") {
      taskPoolState = {
        ...taskPoolState,
        sidebarWidth:
          taskPoolState.sidebarWidth ||
          readPanelWidth("workspace.taskPoolTreeSidebarWidth", TASK_POOL_TREE_BOUNDS),
      };
      applyPanelWidth(
        root,
        "--task-pool-tree-sidebar-width",
        taskPoolState.isSidebarCollapsed ? TASK_POOL_TREE_COLLAPSED_WIDTH : taskPoolState.sidebarWidth,
      );
      if (
        activeTaskPoolDomainSlug === TASK_POOL_HEALTH_DOMAIN_SLUG &&
        healthDomainState.status === "idle"
      ) {
        ensureHealthDomainLoaded();
      }
    }

    if (activeTab === "work-log" && workspaceDocsState.status === "idle") {
      ensureWorkspaceDocsLoaded();
    }
    if (activeTab === "toolbox" && toolboxController.status() === "idle") {
      toolboxController.ensureLoaded();
    }
    if (tabNeedsTaskPlanState(activeTab) && taskPlanState.status === "idle") {
      ensureTaskPlanLoaded();
    }
  };

  render();
  return root;
}

function renderWorkspaceView(
  tab: WorkspaceTab,
  workspaceDocsState: WorkspaceDocsState,
  options: {
    isEditing: boolean;
    isOutlineCollapsed: boolean;
    expandedDomains: ReadonlySet<string>;
    draftHtml: string;
    searchQuery: string;
    taskPlanState?: TaskPlanViewState;
    taskPoolState?: TaskPoolViewState;
    healthDomainState?: HealthDomainViewState;
    activeTaskPoolDomainSlug?: string | null;
    toolboxHtml?: string;
  },
): string {
  const taskPlanViewState = options.taskPlanState ?? createDefaultTaskPlanViewState();
  const taskPoolViewState = options.taskPoolState ?? createDefaultTaskPoolViewState();
  const healthViewState = options.healthDomainState ?? createDefaultHealthDomainViewState();
  const renderers: Record<WorkspaceTab, () => string> = {
    "project-progress": () => renderProjectProgressView(taskPlanViewState),
    "task-plan": () => renderTaskPlanView(taskPlanViewState),
    "task-pool": () =>
      renderTaskPoolView(
        taskPlanViewState,
        taskPoolViewState,
        healthViewState,
        options.activeTaskPoolDomainSlug ?? null,
      ),
    "work-log": () => renderWorkLogView(workspaceDocsState, options),
    toolbox: () => options.toolboxHtml ?? "",
  };
  return renderers[tab]();
}

function renderProjectProgressView(viewState: TaskPlanViewState): string {
  return `
    <section class="workspace-view workspace-view--project-progress" data-workspace-view="project-progress">
      <div class="workspace-grid workspace-grid--project-progress">
        <section class="workspace-panel workspace-panel--todo">
          <header class="workspace-panel__header">
            <div><div class="eyebrow">TODAY</div><h2>\u4eca\u65e5\u65f6\u95f4\u8868</h2></div>
            <button type="button" class="icon-btn" aria-label="\u66f4\u591a">${renderIcon("search", { size: 16 })}</button>
          </header>
          <button type="button" class="workspace-page__action workspace-page__action--ghost">${renderIcon("plus", { size: 16 })}<span>\u6dfb\u52a0\u4efb\u52a1</span></button>
          ${renderProjectProgressSchedule(viewState)}
          <footer class="workspace-panel__footer"><span>\u6700\u8fd1\u540c\u6b65\uff1a5 \u5206\u949f\u524d</span><button type="button" class="icon-btn" aria-label="\u5237\u65b0">${renderIcon("refresh-cw", { size: 16 })}</button></footer>
        </section>

        <section class="workspace-panel workspace-panel--focus">
          <header class="workspace-panel__header">
            <div><div class="eyebrow">FOCUS BOARD</div><h2>\u5de5\u4f5c\u53f0</h2></div>
            <button type="button" class="icon-btn" aria-label="\u5207\u6362">${renderIcon("copy", { size: 16 })}</button>
          </header>
          <section class="workspace-focus-card">
            <div class="workspace-focus-card__header">
              <div class="workspace-focus-card__title">${renderIcon("hammer", { size: 20 })}<strong>\u5f53\u524d\u4efb\u52a1</strong></div>
              <div class="workspace-chip-row">
                <span class="workspace-chip">5\u670818\u65e5 \u5468\u65e5</span>
                <span class="workspace-chip workspace-chip--danger">\u9700\u8981\u4e13\u6ce8</span>
                <span class="workspace-chip workspace-chip--success">\u8fdb\u884c\u4e2d</span>
              </div>
            </div>
            <h3>\u5b8c\u6210\u5927\u521b\u9879\u76ee\u4e2d\u671f\u7ed3\u9879\u6750\u6599</h3>
            <p class="workspace-focus-card__copy">\u672c\u5468\u76ee\u6807\u662f\u8f93\u51fa\u4e00\u5957\u53ef\u6c47\u62a5\u7684\u4e2d\u671f\u7ed3\u9879\u5b8c\u6574\u8109\u7edc\u548c\u6750\u6599\u3002</p>
            <div class="workspace-check-columns">
              ${renderChecklistColumn("\u5b8c\u6210\u6807\u51c6", ["\u6587\u5b57\u7a3f\u5b8c\u6210", "PPT \u6846\u67b6\u5b8c\u6210", "\u6570\u636e\u56fe\u8868\u5b8c\u6210", "\u6700\u7ec8\u62a5\u544a\u751f\u6210"], false)}
              ${renderChecklistColumn("\u4eca\u65e5\u884c\u52a8", ["\u65e9\u4e2d\u665a\u7ed3\u9879\u6587\u5b57\u7a3f\u68b3\u7406", "\u6574\u7406 PPT \u7ed3\u6784", "\u7528 AI \u751f\u6210 PPT \u521d\u7a3f"], true)}
              ${renderChecklistColumn("\u540e\u7eed\u884c\u52a8", ["\u5b8c\u5584\u5185\u5bb9\u4e0e\u903b\u8f91", "\u4fee\u6539\u5bf9\u9f50\u5b9e\u9a8c", "\u51c6\u5907\u6c47\u62a5\u6f14\u7ec3"], false)}
            </div>
            <div class="workspace-action-row">
              <button type="button" class="btn btn-primary workspace-page__primary-cta">\u5f00\u59cb\u4e13\u6ce8\uff08\u5168\u5c4f\uff09</button>
              <button type="button" class="btn btn-secondary workspace-page__secondary-cta">\u6807\u8bb0\u5b8c\u6210</button>
            </div>
          </section>
          <div class="workspace-focus-grid">
            <section class="workspace-subpanel">
              <div class="workspace-subpanel__title">\u5f85\u786e\u8ba4 / \u98ce\u9669\u63d0\u9192</div>
              <ul class="workspace-alert-list">
                <li><span class="workspace-alert workspace-alert--warning">\u5f85\u786e\u8ba4</span><span>\u4e2d\u671f\u7ed3\u9879\u683c\u5f0f\u8981\u6c42</span></li>
                <li><span class="workspace-alert workspace-alert--warning">\u98ce\u9669</span><span>\u8bc4\u5ba1\u65f6\u95f4\u5c1a\u672a\u786e\u5b9a</span></li>
                <li><span class="workspace-alert workspace-alert--link">\u4f9d\u8d56</span><span>\u6307\u5bfc\u8001\u5e08\u53cd\u9988\u5f85\u8f93\u5165</span></li>
              </ul>
            </section>
            <section class="workspace-subpanel">
              <div class="workspace-subpanel__title">\u4efb\u52a1\u6d41\u7a0b\u94fe</div>
              <div class="workspace-flow">
                <span class="workspace-flow__node is-done">\u786e\u5b9a\u9700\u6c42</span>
                <span class="workspace-flow__node is-active">\u6587\u5b57\u68b3\u7406</span>
                <span class="workspace-flow__node">\u5236\u4f5c PPT</span>
                <span class="workspace-flow__node">\u4eba\u5de5\u5ba1\u6821</span>
                <span class="workspace-flow__node">\u4fee\u6539\u5b8c\u5584</span>
                <span class="workspace-flow__node">\u8f93\u51fa\u7ed3\u9879\u6750\u6599</span>
              </div>
            </section>
            <section class="workspace-subpanel workspace-subpanel--milestone">
              <div class="workspace-subpanel__title">\u4eca\u65e5\u91cc\u7a0b\u7891</div>
              <strong>17:30 \u524d\u5b8c\u6210\u53ef\u4fee\u6539\u7684\u4e00\u7248 PPT \u521d\u7a3f</strong>
              <p>\u5269\u4f59 5 \u5c0f\u65f6</p>
              <div class="workspace-progress"><span style="width: 42%"></span></div>
            </section>
          </div>
          <section class="workspace-toolbox">
            <div class="workspace-toolbox__header">
              <h3>\u5de5\u5177\u62bd\u5c49</h3>
              <div class="workspace-toolbox__search">${renderIcon("search", { size: 16 })}<span>\u641c\u7d22\u5de5\u5177\uff08\u4f8b\u5982\uff1a\u601d\u7ef4\u5bfc\u56fe\u3001PPT\u3001\u8868\u683c...\uff09</span></div>
            </div>
            <div class="workspace-tool-grid">
              ${renderToolTile("\u601d\u7ef4\u5bfc\u56fe")}
              ${renderToolTile("\u6587\u6863\u6a21\u677f")}
              ${renderToolTile("PPT \u52a9\u624b")}
              ${renderToolTile("\u8868\u683c\u5904\u7406")}
              ${renderToolTile("AI \u5199\u4f5c")}
              ${renderToolTile("\u6570\u636e\u53ef\u89c6\u5316")}
              ${renderToolTile("\u8ba1\u65f6\u5668")}
              ${renderToolTile("\u66f4\u591a\u5de5\u5177")}
            </div>
          </section>
        </section>

        <section class="workspace-panel workspace-panel--done">
          <header class="workspace-panel__header">
            <div><div class="eyebrow">DONE</div><h2>\u4eca\u65e5\u5b8c\u6210\u8868</h2></div>
            <button type="button" class="icon-btn" aria-label="\u66f4\u591a">${renderIcon("search", { size: 16 })}</button>
          </header>
          <div class="workspace-celebration"><div class="workspace-celebration__icon">\u2728</div><strong>\u592a\u68d2\u4e86\uff01\u7ee7\u7eed\u4fdd\u6301</strong><span>\u5df2\u5b8c\u6210 6 \u9879\u4efb\u52a1</span></div>
          <div class="workspace-completed-list">
            ${renderCompletedItem("\u6668\u95f4\u62c9\u4f38 15 \u5206\u949f", "07:30")}
            ${renderCompletedItem("\u68c0\u67e5\u90ae\u4ef6\u548c\u6d88\u606f", "08:00")}
            ${renderCompletedItem("\u9605\u8bfb\u884c\u4e1a\u8d44\u8baf", "08:30")}
            ${renderCompletedItem("\u9879\u76ee\u65e9\u4f1a", "09:30")}
            ${renderCompletedItem("\u6574\u7406\u7b14\u8bb0", "11:00")}
            ${renderCompletedItem("\u5348\u9910 & \u4f11\u606f", "12:30")}
          </div>
          <button type="button" class="btn btn-secondary workspace-page__secondary-cta workspace-page__secondary-cta--full">\u67e5\u770b\u5b8c\u6210\u5206\u6790</button>
        </section>
      </div>
    </section>
  `;
}

function renderProjectProgressSchedule(viewState: TaskPlanViewState): string {
  if (viewState.status === "loading") {
    return `
      <div class="workspace-empty-card">
        <strong>正在同步任务计划页的正式日程</strong>
        <p>确认完成后，这里的今日时间表会自动刷新为共享正式版。</p>
      </div>
    `;
  }

  if (viewState.status === "error") {
    return `
      <div class="workspace-empty-card">
        <strong>${escapeHtml(viewState.error ?? "共享日程加载失败")}</strong>
        <p>请稍后重试，或先到任务计划页检查共享日程状态。</p>
      </div>
    `;
  }

  const schedule = viewState.state?.schedule;
  if (!schedule?.confirmed || schedule.items.length === 0) {
    return `
      <div class="workspace-empty-card">
        <strong>\u4eca\u65e5\u6b63\u5f0f\u65e5\u7a0b\u5c1a\u672a\u786e\u8ba4\uff0c\u8bf7\u5148\u5230\u4efb\u52a1\u8ba1\u5212\u9875\u786e\u8ba4\u65e5\u7a0b\u3002</strong>
        <p>\u4efb\u52a1\u8ba1\u5212\u9875\u786e\u8ba4\u540e\u7684\u6b63\u5f0f\u7248\u65f6\u95f4\u8868\u4f1a\u81ea\u52a8\u540c\u6b65\u5230\u8fd9\u91cc\u3002</p>
      </div>
    `;
  }

  return `
    <div class="workspace-list">
      ${schedule.items
        .map((item) => renderScheduleItem(item.title, TASK_PLAN_PRIORITY_LABELS[item.priority] ?? "", item.startTime))
        .join("")}
    </div>
  `;
}

function renderTaskPlanView(viewState: TaskPlanViewState): string {
  const taskPlanState = viewState.state ?? createDefaultTaskPlanState();
  const roadmap = taskPlanState.roadmap;
  const roadmapGroups = roadmap.groups.slice(0, 3);
  const scheduleItems = viewState.scheduleEditMode ? viewState.scheduleDraft : taskPlanState.schedule.items;
  const poolItems = getTaskPlanPoolVisibleItems(viewState);
  const poolBusy = isTaskPlanPoolBusy(viewState);
  const morningSteps = [
    taskPlanState.morningFlow.voiceDone,
    taskPlanState.morningFlow.diaryDone,
    taskPlanState.morningFlow.planningDone,
    taskPlanState.morningFlow.fineTuneDone,
  ];
  const roadmapHeaders = buildTaskPlanRoadmapHeaders(roadmap.windowStart);
  const feedback = viewState.error
    ? viewState.error
    : viewState.feedback ?? (viewState.status === "loading" && !viewState.state ? "正在同步任务计划..." : "系统已与后端任务计划状态同步。");

  return `
    <section class="workspace-view workspace-view--task-plan" data-workspace-view="task-plan">
      <div class="workspace-task-plan-layout" data-task-plan-layout style="--task-plan-top-ratio:${viewState.splitRatio};">
        <div class="workspace-task-plan-poster workspace-task-plan-poster--top" data-task-plan-top>
          <div class="workspace-task-plan-poster__morning">
            <div class="workspace-task-plan-poster__morning-label">
              <span class="workspace-task-plan-poster__morning-icon">${renderIcon("refresh-cw", { size: 18 })}</span>
              <span>晨间流程建议</span>
            </div>
            ${TASK_PLAN_STEP_LABELS.map((label, index) => `
              <div class="workspace-task-plan-poster__morning-step" data-done="${morningSteps[index] ? "true" : "false"}">
                <span class="workspace-task-plan-poster__morning-index">${index + 1}</span>
                <span>${label}</span>
              </div>
              ${index < TASK_PLAN_STEP_LABELS.length - 1 ? '<span class="workspace-task-plan-poster__morning-arrow">›</span>' : ""}
            `).join("")}
          </div>

          <section class="workspace-task-plan-poster__assistant" data-task-plan-assistant-layout="compact-feedback">
            <header class="workspace-task-plan-poster__assistant-header">
              <h2>AI 智能排期助手</h2>
              <div class="workspace-task-plan-poster__assistant-actions" data-task-plan-assistant-actions>
                <button
                  type="button"
                  class="workspace-task-plan-poster__action"
                  data-task-plan-generate
                  ${viewState.busyAction === "generate" ? "disabled" : ""}
                >
                  <span class="workspace-task-plan-poster__action-icon">✦</span>
                  <span>AI优先级判断·时间排序</span>
                </button>
                <div
                  class="workspace-task-plan-poster__action-feedback"
                  data-task-plan-feedback-inline
                  data-busy="${viewState.busyAction ? "true" : "false"}"
                >${escapeHtml(feedback)}</div>
              </div>
            </header>

            <div class="workspace-task-plan-poster__assistant-grid">
              <article
                class="workspace-task-plan-poster__card workspace-task-plan-poster__card--voice"
                data-task-plan-card="text"
              >
                <div class="workspace-task-plan-poster__card-head">
                  <div class="workspace-task-plan-poster__card-title">
                    <span class="workspace-task-plan-poster__card-index">1</span>
                    <span>文字输入</span>
                  </div>
                  <div class="workspace-task-plan-poster__card-actions">
                    <button
                      type="button"
                      class="workspace-task-plan-poster__control-chip"
                      data-task-plan-text-save
                      ${viewState.busyAction === "text" ? "disabled" : ""}
                    >保存</button>
                  </div>
                </div>
                <textarea class="workspace-task-plan-poster__editor" data-task-plan-text-input placeholder="直接输入你今天的想法与安排">${escapeHtml(viewState.textDraft)}</textarea>
                <div class="workspace-task-plan-poster__card-foot">${taskPlanState.voice.updatedAt ? "已同步" : "待输入"} <span>✔</span></div>
              </article>

              <article class="workspace-task-plan-poster__card workspace-task-plan-poster__card--status">
                <div class="workspace-task-plan-poster__card-head">
                  <div class="workspace-task-plan-poster__card-title">
                    <span class="workspace-task-plan-poster__card-index">2</span>
                    <span>近日状态</span>
                  </div>
                  <div class="workspace-task-plan-poster__card-actions">
                    <button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-status-save ${viewState.busyAction === "status" ? "disabled" : ""}>保存</button>
                    <button type="button" class="workspace-task-plan-poster__control-arrow" data-task-plan-status-refresh ${viewState.busyAction === "status-refresh" ? "disabled" : ""}>↻</button>
                  </div>
                </div>
                <textarea class="workspace-task-plan-poster__editor workspace-task-plan-poster__editor--status" data-task-plan-status-input>${escapeHtml(viewState.statusDraft)}</textarea>
              </article>

              <article class="workspace-task-plan-poster__card workspace-task-plan-poster__card--pool">
                <div class="workspace-task-plan-poster__card-head">
                  <div class="workspace-task-plan-poster__card-title">
                    <span class="workspace-task-plan-poster__card-index">3</span>
                    <span>已有任务池</span>
                  </div>
                  <div class="workspace-task-plan-poster__card-actions">
                    ${viewState.poolEditMode ? `<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-add ${poolBusy ? "disabled" : ""}>新增</button>` : ""}
                    ${viewState.poolEditMode ? `<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-save ${poolBusy ? "disabled" : ""}>保存</button>` : ""}
                    <button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-edit-toggle ${poolBusy ? "disabled" : ""}>${viewState.poolEditMode ? "取消" : "编辑"}</button>
                  </div>
                </div>
                <div class="workspace-task-plan-poster__pool-filters">
                  ${renderTaskPlanPoolFilters(viewState.poolFilter, poolBusy)}
                </div>
                <div class="workspace-task-plan-poster__pool-list" data-task-plan-pool-list data-task-plan-scroll-mode="flex">
                  ${renderTaskPlanPoolRows(poolItems, viewState.poolEditMode, poolBusy)}
                </div>
                <div class="workspace-task-plan-poster__pool-total">共 ${poolItems.length} 项任务</div>
              </article>

              <article class="workspace-task-plan-poster__card workspace-task-plan-poster__card--schedule">
                <div class="workspace-task-plan-poster__card-head">
                  <div class="workspace-task-plan-poster__card-title">
                    <span class="workspace-task-plan-poster__card-index">4</span>
                    <span>今日建议时间表</span>
                  </div>
                  <div class="workspace-task-plan-poster__card-actions">
                    ${viewState.scheduleEditMode ? '<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-schedule-add>新增</button>' : ""}
                    <button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-schedule-edit-toggle>${viewState.scheduleEditMode ? "取消" : "修改"}</button>
                  </div>
                </div>
                <div class="workspace-task-plan-poster__timeline" data-task-plan-schedule-list data-task-plan-scroll-mode="flex">
                  ${scheduleItems.map((item) => viewState.scheduleEditMode
                    ? `
                      <div
                        class="workspace-task-plan-poster__timeline-row workspace-task-plan-poster__timeline-row--edit${viewState.draggingScheduleId === item.id ? " is-dragging" : ""}"
                        data-task-plan-schedule-row="${escapeHtml(item.id)}"
                        draggable="true"
                      >
                        <span class="workspace-task-plan-poster__timeline-drag" data-task-plan-schedule-drag draggable="true" aria-hidden="true">⋮⋮</span>
                        <input class="workspace-task-plan-poster__timeline-input workspace-task-plan-poster__timeline-input--time" data-task-plan-schedule-time-input="${escapeHtml(item.id)}" value="${escapeHtml(item.startTime)}" />
                        <input class="workspace-task-plan-poster__timeline-input" data-task-plan-schedule-title-input="${escapeHtml(item.id)}" value="${escapeHtml(item.title)}" />
                        <select class="workspace-task-plan-poster__timeline-select" data-task-plan-schedule-priority-input="${escapeHtml(item.id)}">
                          ${(["high", "mid", "low", "cool", "neutral"] as const).map((priority) => `
                            <option value="${priority}" ${item.priority === priority ? "selected" : ""}>${TASK_PLAN_PRIORITY_LABELS[priority]}</option>
                          `).join("")}
                        </select>
                        <button type="button" class="workspace-task-plan-poster__timeline-remove" data-task-plan-schedule-remove="${escapeHtml(item.id)}">删除</button>
                      </div>
                    `
                    : `
                      <div class="workspace-task-plan-poster__timeline-row" data-task-plan-schedule-row="${escapeHtml(item.id)}">
                        <div class="workspace-task-plan-poster__timeline-time">${escapeHtml(item.startTime)}</div>
                        <div class="workspace-task-plan-poster__timeline-card">
                          <span>${escapeHtml(item.title)}</span>
                          <span class="workspace-task-plan-poster__pill workspace-task-plan-poster__pill--${item.priority}">${TASK_PLAN_PRIORITY_LABELS[item.priority]}</span>
                          <span class="workspace-task-plan-poster__timeline-menu">⋮</span>
                        </div>
                      </div>
                    `).join("")}
                </div>
                <div class="workspace-task-plan-poster__schedule-actions">
                  <button type="button" class="workspace-task-plan-poster__fine-tune workspace-task-plan-poster__fine-tune--compact" data-task-plan-schedule-save ${viewState.busyAction === "save" ? "disabled" : ""}>
                    <span>${renderIcon("copy", { size: 14 })}</span>
                    <span>${viewState.scheduleEditMode ? "保存日程" : "确认日程"}</span>
                  </button>
                </div>
                <p class="workspace-task-plan-poster__fine-copy workspace-task-plan-poster__fine-copy--schedule">
                  系统已结合文本输入、近日状态与任务池<br/>
                  确认后会将当前时间表保存为正式版本。
                </p>
              </article>
            </div>
          </section>
        </div>

        <div
          class="workspace-task-plan-split-handle panel-resize-handle"
          data-task-plan-split-handle
          role="separator"
          aria-label="调整任务计划上下区域高度"
          aria-orientation="horizontal"
          tabindex="0"
        ></div>

        <section class="workspace-task-plan-poster__roadmap" data-task-plan-bottom>
          <header class="workspace-task-plan-poster__roadmap-header">
            <div>
              <h3>领域与项目推进</h3>
              <p>选择领域查看详情，并通过甘特视图跟踪进度与里程碑</p>
            </div>
            <div class="workspace-task-plan-poster__roadmap-controls">
              <button type="button" class="workspace-task-plan-poster__control-chip workspace-task-plan-poster__control-chip--active" data-task-plan-roadmap-window="current">本周</button>
              <button type="button" class="workspace-task-plan-poster__control-arrow" data-task-plan-roadmap-nav="prev">‹</button>
              <button type="button" class="workspace-task-plan-poster__control-arrow" data-task-plan-roadmap-nav="next">›</button>
              <button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-roadmap-view="week">周视图 ⌄</button>
            </div>
          </header>

          <div class="workspace-task-plan-poster__roadmap-board">
            <aside class="workspace-task-plan-poster__roadmap-tree">
              <div class="workspace-task-plan-poster__tree-top">
                <span>${escapeHtml(roadmap.topLabel)}</span>
                <span>▢</span>
              </div>
              ${roadmapGroups.map((group, index) => `
                <div class="workspace-task-plan-poster__tree-group">
                  <div class="workspace-task-plan-poster__tree-title">
                    <span class="workspace-task-plan-poster__tree-badge workspace-task-plan-poster__tree-badge--${index === 0 ? "blue" : index === 1 ? "green" : "orange"}">${index === 0 ? "P" : index === 1 ? "T" : "R"}</span>
                    <span>${escapeHtml(group.title)}</span>
                  </div>
                  <ul>
                    ${group.items.map((item) => `<li>${escapeHtml(item.title)}</li>`).join("")}
                  </ul>
                </div>
              `).join("")}
            </aside>

            <div class="workspace-task-plan-poster__roadmap-grid">
              <div class="workspace-task-plan-poster__month">${escapeHtml(roadmap.windowLabel)}</div>
              <div class="workspace-task-plan-poster__header-row">
                ${roadmapHeaders.map((label) => `<span class="workspace-task-plan-poster__header-cell">${escapeHtml(label)}</span>`).join("")}
              </div>
              <div class="workspace-task-plan-poster__lane">
                <div class="workspace-task-plan-poster__bar workspace-task-plan-poster__bar--blue" style="--start:2; --span:5;">进行中 60%</div>
                <div class="workspace-task-plan-poster__bar workspace-task-plan-poster__bar--blue-light" style="--start:4; --span:6;">需求评审</div>
                <span class="workspace-task-plan-poster__marker workspace-task-plan-poster__marker--diamond workspace-task-plan-poster__marker--blue" style="--column:6;"></span>
              </div>
              <div class="workspace-task-plan-poster__lane">
                <div class="workspace-task-plan-poster__bar workspace-task-plan-poster__bar--green" style="--start:2; --span:6;">进行中 45%</div>
                <div class="workspace-task-plan-poster__bar workspace-task-plan-poster__bar--green-light" style="--start:9; --span:4;">待开始</div>
                <span class="workspace-task-plan-poster__marker workspace-task-plan-poster__marker--diamond workspace-task-plan-poster__marker--green" style="--column:8;"></span>
              </div>
              <div class="workspace-task-plan-poster__lane">
                <div class="workspace-task-plan-poster__bar workspace-task-plan-poster__bar--orange-light" style="--start:3; --span:4;">已排期</div>
                <span class="workspace-task-plan-poster__marker workspace-task-plan-poster__marker--diamond workspace-task-plan-poster__marker--orange" style="--column:7;"></span>
              </div>
              <div class="workspace-task-plan-poster__lane">
                <div class="workspace-task-plan-poster__bar workspace-task-plan-poster__bar--orange" style="--start:2; --span:8;">已完成 80%</div>
                <span class="workspace-task-plan-poster__marker workspace-task-plan-poster__marker--ring" style="--column:10;"></span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderTaskPoolView(
  viewState: TaskPlanViewState,
  taskPoolState: TaskPoolViewState,
  healthViewState: HealthDomainViewState,
  activeDomainSlug: string | null,
): string {
  if (viewState.status === "loading") {
    return renderTaskPoolStatusView("\u6b63\u5728\u540c\u6b65\u4efb\u52a1\u8ba1\u5212\u9875\u7684\u5171\u4eab\u4efb\u52a1\u6c60...");
  }
  if (viewState.status === "error") {
    return renderTaskPoolStatusView(viewState.error ?? "\u4efb\u52a1\u6c60\u52a0\u8f7d\u5931\u8d25");
  }
  return renderTaskPoolReadyView(
    viewState,
    taskPoolState,
    healthViewState,
    activeDomainSlug,
  );
}

function renderTaskPoolStatusView(subtitle: string): string {
  return `
    <section class="workspace-view workspace-view--task-pool" data-workspace-view="task-pool">
      <section class="workspace-panel workspace-panel--pool-placeholder">
        <div class="eyebrow">TASK POOL</div>
        <h2>\u4efb\u52a1\u6c60</h2>
        <p class="workspace-page__subtitle">${escapeHtml(subtitle)}</p>
      </section>
    </section>
  `;
}

function renderTaskPoolReadyView(
  viewState: TaskPlanViewState,
  taskPoolState: TaskPoolViewState,
  healthViewState: HealthDomainViewState,
  activeDomainSlug: string | null,
): string {
  const allPoolItems = getTaskPlanPoolSharedItems(viewState);
  const poolBusy = isTaskPlanPoolBusy(viewState);
  if (activeDomainSlug === TASK_POOL_HEALTH_DOMAIN_SLUG) {
    return renderHealthDomainView(
      viewState,
      taskPoolState,
      healthViewState,
      activeDomainSlug,
    );
  }
  const pageTitle = resolveTaskPoolPageTitle(activeDomainSlug);
  const subtitle = activeDomainSlug
    ? `当前展示“${escapeHtml(pageTitle)}”领域下的共享任务。`
    : "\u4e0e\u4efb\u52a1\u8ba1\u5212\u9875\u5171\u4eab\u540c\u4e00\u4efd\u4efb\u52a1\u6c60\uff0c\u53ef\u76f4\u63a5\u7b5b\u9009\u3001\u7f16\u8f91\u5e76\u4fdd\u5b58\u3002";
  const scopedItems = filterTaskPoolItemsByDomain(allPoolItems, activeDomainSlug);
  const listItems = scopedItems.filter(
    (item) => viewState.poolFilter === "全部" || item.source === viewState.poolFilter,
  );
  const treeRenderState: TaskPoolTreeRenderState = {
    level: taskPoolState.treeLevel,
    selectedOptions: taskPoolState.selectedOptions,
    isSidebarCollapsed: taskPoolState.isSidebarCollapsed,
    zoomPercent: taskPoolState.zoomPercent,
    isEditorEnabled: viewState.poolEditMode,
    selectedNode: taskPoolState.selectedNode,
    editingNode: taskPoolState.editingNode,
    editValue: taskPoolState.editValue,
    draggingTaskId: taskPoolState.draggingTaskId,
    dropProjectKey: taskPoolState.dropProjectKey,
    dirty: isTaskPoolDraftDirty(viewState),
  };
  return `
    <section class="workspace-view workspace-view--task-pool" data-workspace-view="task-pool">
      <div class="workspace-task-pool-page">
        <header class="workspace-task-pool-page__header">
          <div>
            <div class="eyebrow">TASK POOL</div>
            <h2>${escapeHtml(pageTitle)}</h2>
            <p class="workspace-page__subtitle">${subtitle}</p>
          </div>
          ${taskPoolState.mode === "tree" ? renderTaskPoolActions(viewState, poolBusy, false) : ""}
          ${renderTaskPoolModeBar(allPoolItems, taskPoolState, activeDomainSlug)}
        </header>
        ${
          taskPoolState.mode === "tree"
            ? renderTaskPoolTreeLayout(scopedItems, treeRenderState)
            : renderTaskPoolListLayout(viewState, listItems, poolBusy)
        }
      </div>
    </section>
  `;
}

function renderTaskPoolModeBar(
  items: readonly TaskPlanPoolItem[],
  taskPoolState: TaskPoolViewState,
  activeDomainSlug: string | null,
): string {
  return `
    <div class="workspace-task-pool-page__toolbar">
      <div class="workspace-task-pool-page__modes">
        ${renderTaskPoolModeButton("list", "\u5217\u8868\u89c6\u56fe", taskPoolState.mode)}
        ${renderTaskPoolModeButton("tree", "\u6811\u72b6\u56fe", taskPoolState.mode)}
      </div>
      <div class="workspace-task-pool-page__domains">
        ${renderTaskPoolDomainChips(items, activeDomainSlug)}
      </div>
      ${
        taskPoolState.mode === "tree"
          ? renderTaskPoolZoomControls(taskPoolState.zoomPercent)
          : ""
      }
    </div>
  `;
}

function renderTaskPoolModeButton(
  mode: TaskPoolViewMode,
  label: string,
  activeMode: TaskPoolViewMode,
): string {
  const active = mode === activeMode;
  return `
    <button
      type="button"
      class="workspace-task-pool-page__mode${active ? " is-active" : ""}"
      data-task-pool-view-mode="${mode}"
      data-active="${active ? "true" : "false"}"
    >${label}</button>
  `;
}

function renderTaskPoolDomainChips(
  items: readonly TaskPlanPoolItem[],
  activeDomainSlug: string | null,
): string {
  const domainLabels = [...getTaskPoolDomainLabels(items), "健康"];
  const uniqueLabels = Array.from(new Set(domainLabels));
  return uniqueLabels
    .map((label) => {
      const domainSlug = getTaskPoolDomainSlug(label);
      const isActive = activeDomainSlug === domainSlug;
      return `
        <button
          type="button"
          class="workspace-task-pool-page__domain${isActive ? " is-active" : ""}"
          data-task-pool-domain-chip="${escapeHtml(domainSlug)}"
        >${escapeHtml(label)}</button>
      `;
    })
    .join("");
}

function renderTaskPoolZoomControls(zoomPercent: number): string {
  return `
    <div class="workspace-task-pool-page__zoom">
      <button type="button" class="workspace-task-pool-page__zoom-btn" data-task-pool-zoom="out">−</button>
      <span class="workspace-task-pool-page__zoom-value">${zoomPercent}%</span>
      <button type="button" class="workspace-task-pool-page__zoom-btn" data-task-pool-zoom="in">+</button>
      <button type="button" class="workspace-task-pool-page__zoom-reset" data-task-pool-zoom="reset">\u91cd\u7f6e</button>
    </div>
  `;
}

function renderTaskPoolListLayout(
  viewState: TaskPlanViewState,
  items: readonly TaskPlanPoolItem[],
  poolBusy: boolean,
): string {
  return `
    <section class="workspace-task-plan-poster__card workspace-task-pool-page__card">
      <div class="workspace-task-plan-poster__card-head">
        <div class="workspace-task-plan-poster__card-title">
          <span class="workspace-task-plan-poster__card-index">3</span>
          <span>共享任务池</span>
        </div>
        ${renderTaskPoolActions(viewState, poolBusy)}
      </div>
      <div class="workspace-task-plan-poster__pool-filters">
        ${renderTaskPlanPoolFilters(viewState.poolFilter, poolBusy)}
      </div>
      <div class="workspace-task-plan-poster__pool-list workspace-task-pool-page__list" data-task-plan-pool-list>
        ${renderTaskPlanPoolRows(items, viewState.poolEditMode, poolBusy)}
      </div>
      <div class="workspace-task-plan-poster__pool-total">共 ${items.length} 项任务</div>
    </section>
  `;
}

function renderHealthDomainView(
  taskPlanViewState: TaskPlanViewState,
  taskPoolState: TaskPoolViewState,
  healthViewState: HealthDomainViewState,
  activeDomainSlug: string | null,
): string {
  const latest = healthViewState.state?.sleep.latest ?? createEmptyHealthSleepLatestState();
  const insights = healthViewState.state?.sleep.insights ?? [];
  const trends = healthViewState.state?.sleep.trends ?? createEmptyHealthSleepTrendsState();
  const healthTasks = getHealthTaskPoolItems(taskPlanViewState);
  return `
    <section class="workspace-view workspace-view--task-pool" data-workspace-view="task-pool">
      <div class="workspace-task-pool-page">
        <header class="workspace-task-pool-page__header">
          <div>
            <div class="eyebrow">HEALTH DOMAIN</div>
            <h2>健康</h2>
            <p class="workspace-page__subtitle">重点跟踪入睡、起床、深度睡眠质量，以及影响睡眠的活动与心率趋势。</p>
          </div>
          ${renderTaskPoolModeBar(taskPlanViewState.state?.pool.items ?? [], taskPoolState, activeDomainSlug)}
        </header>
        <section class="workspace-health-domain" data-workspace-domain-view="health">
          <div class="workspace-health-domain__topbar">
            <div class="workspace-health-domain__sync">
              <strong>${escapeHtml(healthViewState.state?.connection.label ?? "小米运动健康未连接")}</strong>
              <span>${escapeHtml(readHealthConnectionSummary(healthViewState))}</span>
            </div>
            <div class="workspace-health-domain__actions">
              <button type="button" class="workspace-task-plan-poster__control-chip" data-health-import-open>导入小米运动健康数据</button>
              <button type="button" class="workspace-task-plan-poster__control-chip" data-health-sync ${healthViewState.busyAction === "sync" ? "disabled" : ""}>手动同步</button>
            </div>
          </div>
          <div class="workspace-health-domain__metrics">
            ${renderHealthMetricCard("入睡时间", latest.bedTime)}
            ${renderHealthMetricCard("起床时间", latest.wakeTime)}
            ${renderHealthMetricCard("深度睡眠质量", latest.deepSleepQuality)}
            ${renderHealthMetricCard("总睡眠时长", latest.totalSleep)}
          </div>
          <div class="workspace-health-domain__factors">
            ${renderHealthFactorCard("睡眠评分", latest.sleepScore)}
            ${renderHealthFactorCard("清醒时长", latest.awakeDuration)}
            ${renderHealthFactorCard("睡眠平均心率", latest.sleepAverageHeartRate)}
            ${renderHealthFactorCard("步数 / 活动量", latest.steps && latest.intensityMinutes ? `${latest.steps} · ${latest.intensityMinutes}` : latest.steps ?? latest.intensityMinutes)}
          </div>
          <div class="workspace-health-domain__grid">
            <section class="workspace-health-domain__panel">
              <header><h3>影响睡眠的因素</h3></header>
              <div class="workspace-health-domain__insights">${insights.length > 0 ? insights.map((item) => `<div class="workspace-health-domain__insight">${escapeHtml(item)}</div>`).join("") : '<div class="workspace-health-domain__empty">连接后会显示最近 7 天的睡眠风险提醒。</div>'}</div>
            </section>
            <section class="workspace-health-domain__panel">
              <header><h3>最近 7 天趋势</h3></header>
              <div class="workspace-health-domain__trend-list">
                ${renderHealthTrendRow("入睡时间", (trends.bedTimes ?? []).join(" · "))}
                ${renderHealthTrendRow("起床时间", (trends.wakeTimes ?? []).join(" · "))}
                ${renderHealthTrendRow("深睡分钟", (trends.deepSleepMinutes ?? []).join(" / "))}
                ${renderHealthTrendRow("睡眠评分", (trends.sleepScores ?? []).join(" / "))}
              </div>
            </section>
            <section class="workspace-health-domain__panel">
              <header><h3>健康任务</h3></header>
              <div class="workspace-health-domain__task-list">
                ${healthTasks.length > 0 ? healthTasks.map((item) => `<div class="workspace-health-domain__task">${escapeHtml(item.title)}</div>`).join("") : '<div class="workspace-health-domain__empty">当前还没有标记为“健康”领域的共享任务。</div>'}
              </div>
            </section>
          </div>
          ${renderHealthImportModal(healthViewState)}
        </section>
      </div>
    </section>
  `;
}

function renderHealthMetricCard(title: string, value: string | null): string {
  return `<article class="workspace-health-domain__metric"><span>${title}</span><strong>${escapeHtml(value ?? "--")}</strong></article>`;
}

function renderHealthFactorCard(title: string, value: string | null): string {
  return `<article class="workspace-health-domain__factor"><span>${title}</span><strong>${escapeHtml(value ?? "--")}</strong></article>`;
}

function renderHealthTrendRow(title: string, value: string): string {
  return `<div class="workspace-health-domain__trend"><span>${title}</span><strong>${escapeHtml(value || "--")}</strong></div>`;
}

function renderHealthImportModal(healthViewState: HealthDomainViewState): string {
  if (!healthViewState.isImportModalOpen) {
    return "";
  }
  const showSmsReadyHint =
    !!healthViewState.captchaChallenge &&
    healthViewState.accountDraft.verificationCode.trim().length > 0;
  return `
    <div class="workspace-health-domain__modal-backdrop" data-health-import-modal>
      <section class="workspace-health-domain__modal">
        <header class="workspace-health-domain__modal-head">
          <div>
            <strong>导入小米运动健康数据</strong>
            <span>支持手机号验证码连接、二维码登录和 token / API 连接。</span>
          </div>
          <button type="button" class="workspace-health-domain__modal-close" data-health-import-close>×</button>
        </header>
        <div class="workspace-health-domain__modal-tabs">
          <button type="button" class="workspace-health-domain__modal-tab${healthViewState.activeImportTab === "account" ? " is-active" : ""}" data-health-import-tab="account">验证码连接</button>
          <button type="button" class="workspace-health-domain__modal-tab${healthViewState.activeImportTab === "api" ? " is-active" : ""}" data-health-import-tab="api">高级连接</button>
        </div>
        ${renderHealthImportModalBody(healthViewState, showSmsReadyHint)}
        ${renderHealthImportModalFoot(healthViewState, showSmsReadyHint)}
      </section>
    </div>
  `;
}

function renderHealthImportModalBody(
  healthViewState: HealthDomainViewState,
  showSmsReadyHint: boolean,
): string {
  if (healthViewState.activeImportTab === "account") {
    return renderHealthAccountImportBody(healthViewState, showSmsReadyHint);
  }
  return renderHealthApiImportBody(healthViewState);
}

function renderHealthAccountImportBody(
  healthViewState: HealthDomainViewState,
  showSmsReadyHint: boolean,
): string {
  return `
    <div class="workspace-health-domain__modal-body">
      <input class="workspace-task-plan-poster__editor workspace-health-domain__input" data-health-account-input="username" value="${escapeHtml(healthViewState.accountDraft.username)}" placeholder="手机号" />
      ${renderHealthCaptchaChallenge(healthViewState, showSmsReadyHint)}
      <div class="workspace-health-domain__inline">
        <input class="workspace-task-plan-poster__editor workspace-health-domain__input" data-health-account-input="verificationCode" value="${escapeHtml(healthViewState.accountDraft.verificationCode)}" placeholder="短信验证码" />
        <button type="button" class="workspace-task-plan-poster__control-chip" data-health-send-code ${healthViewState.busyAction === "send-code" ? "disabled" : ""}>${healthViewState.captchaChallenge ? "提交图形验证码" : "获取验证码"}</button>
      </div>
      <button type="button" class="workspace-task-plan-poster__control-chip workspace-health-domain__primary" data-health-connect-account ${healthViewState.busyAction === "connect" ? "disabled" : ""}>验证码登录并连接</button>
    </div>
  `;
}

function renderHealthCaptchaChallenge(
  healthViewState: HealthDomainViewState,
  showSmsReadyHint: boolean,
): string {
  if (!healthViewState.captchaChallenge) {
    return "";
  }
  return `
    <div class="workspace-health-domain__captcha" data-health-captcha-challenge>
      <div class="workspace-health-domain__captcha-copy">${escapeHtml(healthViewState.captchaChallenge.message ?? "当前连接触发了图形验证码，请先完成校验。")}</div>
      <img class="workspace-health-domain__captcha-image" src="${escapeHtml(healthViewState.captchaChallenge.imageDataUrl)}" alt="图形验证码" />
      <input class="workspace-task-plan-poster__editor workspace-health-domain__input" data-health-account-input="captchaCode" value="${escapeHtml(healthViewState.accountDraft.captchaCode)}" placeholder="图形验证码" />
      ${showSmsReadyHint ? '<div class="workspace-health-domain__captcha-hint">如果你已经收到短信验证码，不要再点右侧按钮，直接点下方“登录并连接”。</div>' : ""}
    </div>
  `;
}

function renderHealthApiImportBody(healthViewState: HealthDomainViewState): string {
  return `
    <div class="workspace-health-domain__modal-body">
      ${renderHealthQrLoginPanel(healthViewState)}
      <textarea class="workspace-task-plan-poster__editor workspace-health-domain__textarea" data-health-api-token-input placeholder="粘贴 token.json 内容">${escapeHtml(healthViewState.apiDraft.tokenJson)}</textarea>
      <input class="workspace-task-plan-poster__editor workspace-health-domain__input" data-health-api-input="apiBaseUrl" value="${escapeHtml(healthViewState.apiDraft.apiBaseUrl)}" placeholder="API 地址（可选）" />
      <button type="button" class="workspace-task-plan-poster__control-chip workspace-health-domain__primary" data-health-connect-api ${healthViewState.busyAction === "connect" ? "disabled" : ""}>保存并导入</button>
    </div>
  `;
}

function renderHealthQrLoginPanel(healthViewState: HealthDomainViewState): string {
  return `
    <div class="workspace-health-domain__qr">
      <div>
        <strong>二维码登录生成 token</strong>
        <span>用小米账号 App 扫码，成功后会自动保存并导入。</span>
      </div>
      ${renderHealthQrLoginImage(healthViewState.qrLogin)}
      <button type="button" class="workspace-task-plan-poster__control-chip" data-health-qr-login ${healthViewState.busyAction === "qr-login" ? "disabled" : ""}>${healthViewState.qrLogin ? "重新生成二维码" : "生成二维码登录"}</button>
    </div>
  `;
}

function renderHealthQrLoginImage(qrLogin: HealthDomainQrLoginState | null): string {
  if (!qrLogin) {
    return "";
  }
  return `
    <img class="workspace-health-domain__qr-image" src="${escapeHtml(qrLogin.qrImageUrl)}" alt="小米账号二维码" />
    ${qrLogin.loginUrl ? `<a class="workspace-health-domain__qr-link" href="${escapeHtml(qrLogin.loginUrl)}" target="_blank" rel="noreferrer">打开登录链接</a>` : ""}
  `;
}

function renderHealthImportModalFoot(
  healthViewState: HealthDomainViewState,
  showSmsReadyHint: boolean,
): string {
  return `
    <footer class="workspace-health-domain__modal-foot">
      <div class="workspace-health-domain__modal-status">
        <span>${escapeHtml(healthViewState.error ?? healthViewState.feedback ?? "")}</span>
        ${showSmsReadyHint ? '<span class="workspace-health-domain__modal-note">短信已经到手机后，后续以“登录并连接”为准。</span>' : ""}
      </div>
    </footer>
  `;
}

function renderTaskPoolActions(
  viewState: TaskPlanViewState,
  poolBusy: boolean,
  showAddButton: boolean = true,
): string {
  return `
    <div class="workspace-task-plan-poster__card-actions">
      ${viewState.poolEditMode && showAddButton ? `<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-add ${poolBusy ? "disabled" : ""}>新增</button>` : ""}
      ${viewState.poolEditMode ? `<button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-save ${poolBusy ? "disabled" : ""}>保存</button>` : ""}
      <button type="button" class="workspace-task-plan-poster__control-chip" data-task-plan-pool-edit-toggle ${poolBusy ? "disabled" : ""}>${viewState.poolEditMode ? "取消" : "编辑"}</button>
    </div>
  `;
}

type TaskPlanPoolDraftRepairState = Pick<
  TaskPlanViewState,
  "state" | "poolDraft" | "poolEditMode" | "poolDraftTouched"
>;

function cloneTaskPlanPoolItems(items: readonly TaskPlanPoolItem[]): TaskPlanPoolItem[] {
  return items.map((item) => ({ ...item }));
}

function shouldRepairUntouchedTaskPlanPoolDraft(viewState: TaskPlanPoolDraftRepairState): boolean {
  const persistedItems = viewState.state?.pool.items ?? [];
  return (
    viewState.poolEditMode &&
    !viewState.poolDraftTouched &&
    viewState.poolDraft.length === 0 &&
    persistedItems.length > 0
  );
}

export function repairUntouchedTaskPlanPoolDraft(
  viewState: TaskPlanPoolDraftRepairState,
): TaskPlanPoolItem[] {
  if (shouldRepairUntouchedTaskPlanPoolDraft(viewState)) {
    return cloneTaskPlanPoolItems(viewState.state?.pool.items ?? []);
  }
  return cloneTaskPlanPoolItems(viewState.poolDraft);
}

function getTaskPlanPoolSharedItems(
  viewState: Pick<TaskPlanViewState, "state" | "poolDraft" | "poolEditMode" | "poolDraftTouched">,
): TaskPlanPoolItem[] {
  const state = viewState.state ?? createDefaultTaskPlanState();
  if (viewState.poolEditMode) {
    return repairUntouchedTaskPlanPoolDraft(viewState);
  }
  return state.pool.items;
}

function getTaskPlanPoolVisibleItems(viewState: TaskPlanViewState): TaskPlanPoolItem[] {
  const state = viewState.state ?? createDefaultTaskPlanState();
  if (viewState.poolEditMode) {
    return repairUntouchedTaskPlanPoolDraft(viewState);
  }
  return state.pool.items.filter((item) => viewState.poolFilter === "全部" || item.source === viewState.poolFilter);
}

function isTaskPoolDraftDirty(viewState: TaskPlanViewState): boolean {
  const persisted = JSON.stringify(viewState.state?.pool.items ?? []);
  const draft = JSON.stringify(viewState.poolDraft);
  return persisted !== draft;
}

function isTaskPlanPoolBusy(viewState: Pick<TaskPlanViewState, "busyAction">): boolean {
  return viewState.busyAction === "pool";
}

function renderTaskPlanPoolFilters(activeFilter: TaskPlanViewState["poolFilter"], disabled: boolean): string {
  return TASK_PLAN_SOURCE_LABELS.map((source) => `
    <button
      type="button"
      class="workspace-task-plan-poster__pool-filter${activeFilter === source ? " is-active" : ""}"
      data-task-plan-pool-filter="${source}"
      ${disabled ? "disabled" : ""}
    >${source}</button>
  `).join("");
}

function renderTaskPlanPoolRows(items: readonly TaskPlanPoolItem[], editMode: boolean, disabled: boolean): string {
  return items.map((item) => {
    const priority = normalizeTaskPlanPriority(item.priority);
    const priorityLabel = TASK_PLAN_PRIORITY_LABELS[priority];
    return editMode
      ? `
        <div class="workspace-task-plan-poster__pool-row workspace-task-plan-poster__pool-row--edit" data-task-plan-pool-row="${escapeHtml(item.id)}">
          <input class="workspace-task-plan-poster__timeline-input" data-task-plan-pool-title-input="${escapeHtml(item.id)}" value="${escapeHtml(item.title)}" ${disabled ? "disabled" : ""} />
          <select class="workspace-task-plan-poster__timeline-select" data-task-plan-pool-source-input="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""}>
            ${TASK_PLAN_SOURCE_LABELS.filter((source) => source !== "全部").map((source) => `
              <option value="${source}" ${item.source === source ? "selected" : ""}>${source}</option>
            `).join("")}
          </select>
          <select class="workspace-task-plan-poster__timeline-select" data-task-plan-pool-priority-input="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""}>
            ${(["high", "mid", "low", "cool", "neutral"] as const).map((priority) => `
              <option value="${priority}" ${priority === normalizeTaskPlanPriority(item.priority) ? "selected" : ""}>${TASK_PLAN_PRIORITY_LABELS[priority]}</option>
            `).join("")}
          </select>
          <button type="button" class="workspace-task-plan-poster__timeline-remove" data-task-plan-pool-remove="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""}>删除</button>
        </div>
      `
      : `
        <div class="workspace-task-plan-poster__pool-row">
          <span class="workspace-task-plan-poster__pool-caret">▸</span>
          <span class="workspace-task-plan-poster__pool-text">${escapeHtml(item.title)}</span>
          <span class="workspace-task-plan-poster__pool-meta">
            <span class="workspace-task-plan-poster__source-pill">${escapeHtml(item.source)}</span>
            <span class="workspace-task-plan-poster__pill workspace-task-plan-poster__pill--${priority}">${priorityLabel}</span>
          </span>
        </div>
      `;
  }).join("");
}

function getTaskPoolDomainLabels(items: readonly TaskPlanPoolItem[]): string[] {
  return Array.from(
    new Set(items.map((item) => getTaskPoolDomainName(item)).filter(Boolean)),
  );
}

function getTaskPoolDomainSlug(label: string): string {
  if (label === "健康") {
    return TASK_POOL_HEALTH_DOMAIN_SLUG;
  }
  return encodeURIComponent(label);
}

function resolveTaskPoolPageTitle(domainSlug: string | null): string {
  if (!domainSlug) {
    return "\u4efb\u52a1\u6c60";
  }
  return resolveTaskPoolDomainLabel(domainSlug);
}

function resolveTaskPoolDomainLabel(domainSlug: string): string {
  if (TASK_POOL_DOMAIN_LABEL_OVERRIDES[domainSlug]) {
    return TASK_POOL_DOMAIN_LABEL_OVERRIDES[domainSlug];
  }
  try {
    return decodeURIComponent(domainSlug);
  } catch {
    return domainSlug;
  }
}

function filterTaskPoolItemsByDomain(
  items: readonly TaskPlanPoolItem[],
  domainSlug: string | null,
): TaskPlanPoolItem[] {
  if (!domainSlug || domainSlug === TASK_POOL_HEALTH_DOMAIN_SLUG) {
    return [...items];
  }
  const domainLabel = resolveTaskPoolDomainLabel(domainSlug);
  return items.filter((item) => getTaskPoolDomainName(item) === domainLabel);
}

function getHealthTaskPoolItems(
  taskPlanViewState: TaskPlanViewState,
): TaskPlanPoolItem[] {
  return (taskPlanViewState.state?.pool.items ?? []).filter(
    (item) => getTaskPoolDomainName(item) === "健康",
  );
}

function createEmptyHealthSleepLatestState(): HealthDomainSleepLatestState {
  return {
    bedTime: null,
    wakeTime: null,
    totalSleep: null,
    deepSleepQuality: null,
    deepSleepMinutes: null,
    restingHeartRate: null,
    sleepScore: null,
    awakeDuration: null,
    sleepAverageHeartRate: null,
    steps: null,
    intensityMinutes: null,
  };
}

function createEmptyHealthSleepTrendsState(): HealthDomainSleepTrendsState {
  return {
    bedTimes: [],
    wakeTimes: [],
    deepSleepMinutes: [],
    sleepScores: [],
    steps: [],
    intensityMinutes: [],
  };
}

function readHealthConnectionSummary(
  healthViewState: HealthDomainViewState,
): string {
  const connection = healthViewState.state?.connection;
  if (!connection) {
    return healthViewState.error ?? "\u5c1a\u672a\u8fde\u63a5";
  }
  if (connection.lastSyncedAt) {
    return `最近同步：${connection.lastSyncedAt}`;
  }
  if (connection.lastError) {
    return connection.lastError;
  }
  return connection.status === "connected"
    ? "\u5df2\u8fde\u63a5\uff0c\u7b49\u5f85\u9996\u6b21\u540c\u6b65"
    : "\u5c1a\u672a\u8fde\u63a5";
}

function renderWorkLogView(
  state: WorkspaceDocsState,
  options: {
    isEditing: boolean;
    isOutlineCollapsed: boolean;
    expandedDomains: ReadonlySet<string>;
    draftHtml: string;
    searchQuery: string;
  },
): string {
  if (state.status === "loading") {
    return `
      <section class="workspace-view workspace-view--work-log" data-workspace-view="work-log">
        <section class="workspace-panel workspace-panel--pool-placeholder">
          <div class="eyebrow">DOCUMENTS</div>
          <h2>\u5de5\u4f5c\u65e5\u5fd7</h2>
          <p class="workspace-page__subtitle">\u6b63\u5728\u8bfb\u53d6\u9886\u57df / \u9879\u76ee / \u5de5\u4f5c\u65e5\u5fd7\u6587\u6863...</p>
        </section>
      </section>
    `;
  }

  if (state.status === "error") {
    return `
      <section class="workspace-view workspace-view--work-log" data-workspace-view="work-log">
        <section class="workspace-panel workspace-panel--pool-placeholder">
          <div class="eyebrow">DOCUMENTS</div>
          <h2>\u5de5\u4f5c\u65e5\u5fd7</h2>
          <p class="workspace-page__subtitle">${escapeHtml(state.error ?? "\u672a\u77e5\u9519\u8bef")}</p>
        </section>
      </section>
    `;
  }

  const selected = state.documents.find((item) => item.id === state.selectedId) ?? state.documents[0];
  if (!selected) {
    return `
      <section class="workspace-view workspace-view--work-log" data-workspace-view="work-log">
        <section class="workspace-panel workspace-panel--pool-placeholder">
          <div class="eyebrow">DOCUMENTS</div>
          <h2>\u5de5\u4f5c\u65e5\u5fd7</h2>
          <p class="workspace-page__subtitle">\u8fd8\u6ca1\u6709\u53ef\u8bfb\u53d6\u7684\u6587\u6863\u3002</p>
        </section>
      </section>
    `;
  }

  const contentHtml = options.isEditing && options.draftHtml ? options.draftHtml : selected.html;
  const toc = extractWorkspaceHeadings(contentHtml);
  const visibleDocuments = filterWorkspaceDocuments(state.documents, options.searchQuery);
  return `
    <section class="workspace-view workspace-view--work-log" data-workspace-view="work-log">
      <div class="workspace-log-shell" data-outline-collapsed="${options.isOutlineCollapsed ? "true" : "false"}">
        <aside class="workspace-log-tree" data-workspace-tree-panel>
          <div class="workspace-log-tree__search">
            ${renderIcon("search", { size: 16 })}
            <input
              type="search"
              value="${escapeHtml(options.searchQuery)}"
              placeholder="\u641c\u7d22"
              aria-label="\u641c\u7d22\u6587\u6863"
              data-workspace-tree-search
            />
          </div>
          <header class="workspace-log-tree__header">
            <div class="workspace-log-tree__title">
              <span>\u76ee\u5f55</span>
            </div>
            <div class="workspace-log-tree__actions">
              <button type="button" class="workspace-log-tree__icon-button" aria-label="\u65b0\u5efa">${renderIcon("plus", { size: 15 })}</button>
              <button type="button" class="workspace-log-tree__icon-button" aria-label="\u7b5b\u9009">${renderIcon("settings", { size: 15 })}</button>
            </div>
          </header>
          <div class="workspace-doc-tree" data-workspace-tree>
            ${renderWorkspaceDocTree(visibleDocuments, selected.id, options.expandedDomains)}
          </div>
        </aside>
        <div class="workspace-doc-sidebar-resize panel-resize-handle" data-workspace-tree-resize></div>
        <aside class="workspace-log-outline" data-workspace-outline-lane ${options.isOutlineCollapsed ? "hidden" : ""}>
          <header class="workspace-log-outline__header">
            <div class="workspace-log-outline__eyebrow">\u76ee\u5f55\u680f</div>
            <button type="button" class="workspace-log-outline__toggle" data-workspace-outline-toggle>
              &laquo;
            </button>
          </header>
          <nav class="workspace-log-outline__list" data-workspace-outline-list>
            ${renderWorkspaceOutlineList(selected, toc)}
          </nav>
        </aside>
        <section class="workspace-log-stage" data-workspace-stage>
          <header class="workspace-log-stage__header">
            <div class="workspace-log-stage__title-group">
              <button type="button" class="workspace-log-stage__collapse" data-workspace-outline-toggle aria-label="\u5207\u6362\u76ee\u5f55\u680f">
                ${options.isOutlineCollapsed ? "&raquo;" : "&laquo;"}
              </button>
              <div>
                <div class="workspace-log-stage__kicker">\u8bb0\u5f55\u7cfb\u7edf</div>
                <h2 data-workspace-stage-title>${escapeHtml(selected.title ?? selected.label)}</h2>
                <p>${selected.modifiedAt ? formatWorkspaceTime(selected.modifiedAt) : "\u6682\u65e0\u66f4\u65b0\u65f6\u95f4"}</p>
              </div>
            </div>
            <div class="workspace-log-stage__actions">
              <button type="button" class="workspace-log-stage__action" data-workspace-edit-toggle>\u7f16\u8f91</button>
              <button type="button" class="workspace-log-stage__action workspace-log-stage__action--primary" data-workspace-save>\u4fdd\u5b58</button>
            </div>
          </header>
          ${options.isEditing ? `
            <div class="workspace-doc-toolbar" data-workspace-toolbar>
              ${renderWorkspaceToolbarButton("h1", "\u6807\u9898 1")}
              ${renderWorkspaceToolbarButton("h2", "\u6807\u9898 2")}
              ${renderWorkspaceToolbarButton("bold", "\u52a0\u7c97")}
              ${renderWorkspaceToolbarButton("italic", "\u659c\u4f53")}
              ${renderWorkspaceToolbarButton("ul", "\u65e0\u5e8f\u5217\u8868")}
              ${renderWorkspaceToolbarButton("ol", "\u6709\u5e8f\u5217\u8868")}
              ${renderWorkspaceToolbarButton("quote", "\u5f15\u7528")}
              ${renderWorkspaceToolbarButton("code", "\u4ee3\u7801\u5757")}
              ${renderWorkspaceToolbarButton("hr", "\u5206\u5272\u7ebf")}
            </div>
          ` : ""}
          <div class="workspace-log-stage__canvas">
            <div class="workspace-log-stage__summary">
              <strong>${escapeHtml(selected.label)}</strong>
              <div class="workspace-log-stage__summary-lines">
                ${renderWorkspaceSummaryLines(toc)}
              </div>
            </div>
            <article
              class="workspace-doc-viewer__content markdown-body workspace-doc-editor workspace-log-stage__document${selected.id ? " is-editable" : ""}"
              data-workspace-doc-editor
              data-workspace-doc-content
              contenteditable="${options.isEditing ? "true" : "false"}"
            >${contentHtml}</article>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderWorkspaceOutlineList(
  selected: WorkspaceDocument,
  toc: readonly { id: string; level: number; text: string }[],
): string {
  const items = [
    selected.kind === "root" ? "领域" : selected.domain,
    selected.kind === "project" || selected.kind === "work-log" ? selected.project : null,
    selected.kind === "work-log" ? "工作日志" : null,
  ].filter((value): value is string => Boolean(value));

  const outlineItems = toc.length > 0 ? toc : items.map((text, index) => ({ id: `workspace-outline-${index}`, level: 1, text }));
  return outlineItems
    .map(
      (item) => `
        <button
          type="button"
          class="workspace-log-outline__item workspace-log-outline__item--level-${item.level}"
          ${toc.length > 0 ? `data-workspace-heading-target="${escapeHtml(item.id)}"` : ""}
        >${escapeHtml(item.text)}</button>
      `,
    )
    .join("");
}

function renderWorkspaceSummaryLines(toc: readonly { id: string; level: number; text: string }[]): string {
  const entries = toc.slice(0, 6).map((item) => item.text).filter((text) => text.trim().length > 0);
  if (entries.length === 0) {
    return [
      '<span class="workspace-log-stage__summary-line"></span>',
      '<span class="workspace-log-stage__summary-line workspace-log-stage__summary-line--short"></span>',
      '<span class="workspace-log-stage__summary-line"></span>',
    ].join("");
  }
  return entries
    .map((entry, index) => `<span class="workspace-log-stage__summary-tag workspace-log-stage__summary-tag--${(index % 3) + 1}">${escapeHtml(entry)}</span>`)
    .join("");
}

function filterWorkspaceDocuments(documents: readonly WorkspaceDocument[], query: string): WorkspaceDocument[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...documents];
  }
  const lookup = buildWorkspaceDocumentLookup(documents);
  const includedIds = new Set<string>();
  for (const document of documents) {
    if (!matchesWorkspaceDocumentQuery(document, normalizedQuery)) {
      continue;
    }
    includeWorkspaceDocumentHierarchy(includedIds, lookup, document);
  }

  return documents.filter((item) => includedIds.has(item.id));
}

function renderScheduleItem(title: string, tag: string, time: string): string {
  return `<article class="workspace-task-row"><div class="workspace-task-row__main"><span class="workspace-task-row__checkbox"></span><div><strong>${escapeHtml(title)}</strong><div class="workspace-task-row__meta"><span class="workspace-tag">${escapeHtml(tag)}</span></div></div></div><span class="workspace-task-row__time">${escapeHtml(time)}</span></article>`;
}

function renderChecklistColumn(title: string, items: readonly string[], markFirst: boolean): string {
  return `<section class="workspace-check-column"><h4>${title}</h4><ul>${items.map((item, index) => `<li><span class="workspace-check ${markFirst && index === 0 ? "is-done" : ""}"></span><span>${item}</span></li>`).join("")}</ul></section>`;
}

function renderToolTile(title: string): string {
  return `<article class="workspace-tool-tile"><div class="workspace-tool-tile__icon">${renderIcon("list-checks", { size: 18 })}</div><span>${title}</span></article>`;
}

function renderCompletedItem(title: string, time: string): string {
  return `<article class="workspace-completed-item"><div class="workspace-completed-item__main">${renderIcon("check-circle-2", { size: 16 })}<span>${title}</span></div><time>${time}</time></article>`;
}

function renderLifeStat(title: string, detail: string, value: string): string {
  const meter = value.endsWith("%") ? `<div class="workspace-progress workspace-progress--compact"><span style="width:${value}"></span></div>` : "";
  return `<article class="workspace-life-stat"><div><strong>${title}</strong><p>${detail}</p></div><div class="workspace-life-stat__value">${meter}<span>${value}</span></div></article>`;
}

function renderGanttRow(title: string, labels: readonly string[]): string {
  return `<div class="workspace-gantt__row"><div class="workspace-gantt__label">${title}</div><div class="workspace-gantt__bars">${labels.map((label, index) => `<span class="workspace-gantt__bar workspace-gantt__bar--${(index % 3) + 1}">${label}</span>`).join("")}</div></div>`;
}

function renderDeliverableCard(title: string, status: string, deadline: string): string {
  return `<article class="workspace-deliverable-card"><div class="workspace-deliverable-card__header"><strong>${title}</strong><span class="workspace-chip">${status}</span></div><p>${deadline}</p></article>`;
}

function renderTimelineItem(time: string, title: string): string {
  return `<article class="workspace-timeline-item"><time>${time}</time><span>${title}</span><span class="workspace-link-pill">\u5efa\u8bae</span></article>`;
}

function tabNeedsTaskPlanState(tab: WorkspaceTab): boolean {
  return tab === "project-progress" || tab === "task-plan" || tab === "task-pool";
}

function normalizeWorkspaceTab(value: string | undefined): WorkspaceTab {
  return value === "task-plan" || value === "task-pool" || value === "work-log" || value === "toolbox"
    ? value
    : "project-progress";
}

function parseWorkspaceRouteState(routeSection: string | undefined): WorkspaceRouteState {
  const normalizedSection = (routeSection ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!normalizedSection || normalizedSection === "project-progress") {
    return createWorkspaceRouteState("project-progress");
  }
  if (normalizedSection.startsWith("task-pool/domain/")) {
    const domainSlug = normalizedSection.slice("task-pool/domain/".length).trim();
    return createWorkspaceRouteState("task-pool", null, domainSlug || null);
  }
  const toolboxSection = WORKSPACE_TOOLBOX_ROUTE_SECTIONS[normalizedSection];
  if (toolboxSection !== undefined) {
    return createWorkspaceRouteState("toolbox", toolboxSection);
  }
  if (isWorkspaceRouteTab(normalizedSection)) {
    return createWorkspaceRouteState(normalizedSection);
  }
  return createWorkspaceRouteState("project-progress");
}

function buildWorkspaceHash(
  tab: WorkspaceTab,
  toolboxSection: ToolboxEntityType | null = null,
  taskPoolDomainSlug: string | null = null,
): string {
  if (tab === "project-progress") {
    return "#/workspace";
  }
  if (tab === "toolbox") {
    if (toolboxSection === "workflow") {
      return "#/workspace/toolbox/workflows";
    }
    if (toolboxSection === "asset") {
      return "#/workspace/toolbox/assets";
    }
    return "#/workspace/toolbox";
  }
  if (tab === "task-pool" && taskPoolDomainSlug) {
    return `#/workspace/task-pool/domain/${taskPoolDomainSlug}`;
  }
  return `#/workspace/${tab}`;
}

const WORKSPACE_TOOLBOX_ROUTE_SECTIONS: Partial<Record<string, ToolboxEntityType | null>> = {
  toolbox: null,
  "toolbox/workflows": "workflow",
  "toolbox/assets": "asset",
};

function buildWorkspaceDocumentLookup(documents: readonly WorkspaceDocument[]): {
  root: WorkspaceDocument | undefined;
  domainByLabel: Map<string, WorkspaceDocument>;
  projectByKey: Map<string, WorkspaceDocument>;
} {
  return {
    root: documents.find((item) => item.kind === "root"),
    domainByLabel: new Map(documents.filter((item) => item.kind === "domain").map((item) => [item.label, item])),
    projectByKey: new Map(
      documents
        .filter((item) => item.kind === "project" && item.domain && item.project)
        .map((item) => [`${item.domain}/${item.project}`, item] as const),
    ),
  };
}

function matchesWorkspaceDocumentQuery(document: WorkspaceDocument, normalizedQuery: string): boolean {
  return [document.label, document.path, document.title ?? "", document.raw]
    .join("\n")
    .toLowerCase()
    .includes(normalizedQuery);
}

function includeWorkspaceDocumentHierarchy(
  includedIds: Set<string>,
  lookup: {
    root: WorkspaceDocument | undefined;
    domainByLabel: Map<string, WorkspaceDocument>;
    projectByKey: Map<string, WorkspaceDocument>;
  },
  document: WorkspaceDocument,
): void {
  includedIds.add(document.id);
  if (lookup.root) {
    includedIds.add(lookup.root.id);
  }
  if (document.domain) {
    const domainDoc = lookup.domainByLabel.get(document.domain);
    if (domainDoc) {
      includedIds.add(domainDoc.id);
    }
  }
  if (document.domain && document.project) {
    const projectDoc = lookup.projectByKey.get(`${document.domain}/${document.project}`);
    if (projectDoc) {
      includedIds.add(projectDoc.id);
    }
  }
}

function createWorkspaceRouteState(
  activeTab: WorkspaceTab,
  toolboxSection: ToolboxEntityType | null = null,
  taskPoolDomainSlug: string | null = null,
): WorkspaceRouteState {
  return { activeTab, toolboxSection, taskPoolDomainSlug };
}

function isWorkspaceRouteTab(value: string): value is Exclude<WorkspaceTab, "project-progress" | "toolbox"> {
  return value === "task-plan" || value === "task-pool" || value === "work-log";
}

function createDefaultTaskPlanViewState(): TaskPlanViewState {
  return {
    status: "idle",
    state: null,
    roadmapWindow: "current",
    roadmapView: "week",
    textDraft: "",
    statusDraft: "",
    poolDraft: [],
    poolEditMode: false,
    poolDraftTouched: false,
    poolFilter: "全部",
    scheduleDraft: [],
    scheduleEditMode: false,
    splitRatio: readTaskPlanSplitRatio(),
    busyAction: null,
    feedback: null,
    error: null,
    pendingScheduleFocusId: null,
    draggingScheduleId: null,
    pendingPoolFocusId: null,
  };
}

function createDefaultTaskPoolViewState(): TaskPoolViewState {
  return {
    mode: "list",
    treeLevel: "domain",
    selectedOptions: [],
    isSidebarCollapsed: false,
    sidebarWidth: 0,
    zoomPercent: 90,
    selectedNode: null,
    editingNode: null,
    editValue: "",
    draggingTaskId: null,
    dropProjectKey: null,
  };
}

function createDefaultHealthDomainViewState(): HealthDomainViewState {
  return {
    status: "idle",
    state: null,
    activeImportTab: "account",
    isImportModalOpen: false,
    accountDraft: {
      username: "",
      verificationCode: "",
      captchaCode: "",
    },
    apiDraft: {
      tokenJson: "",
      apiBaseUrl: "",
    },
    busyAction: null,
    feedback: null,
    error: null,
    captchaChallenge: null,
    qrLogin: null,
  };
}

function createDefaultTaskPlanState(): TaskPlanState {
  return {
    voice: {
      transcript: "今天要先完成需求文档，再和产品确认功能逻辑，下午整理用户反馈，晚上复盘。",
      audioPath: null,
      updatedAt: null,
    },
    statusSummary: "今天聚焦需求确认、反馈整理和晚间复盘，先把高优事项推进到可交付状态。",
    pool: {
      items: [
        { id: "pool-1", title: "完成需求文档初稿", priority: "high", source: "文字输入", domain: "产品设计", project: "工作台改版" },
        { id: "pool-2", title: "与开发确认功能逻辑", priority: "high", source: "文字输入", domain: "产品设计", project: "任务同步" },
        { id: "pool-3", title: "整理用户反馈并归类", priority: "mid", source: "近日状态", domain: "用户研究", project: "反馈归类" },
        { id: "pool-4", title: "复盘今日完成情况", priority: "low", source: "AI 生成", domain: "个人成长", project: "日常复盘" },
      ],
    },
    schedule: {
      generationId: null,
      revisionId: null,
      confirmed: false,
      items: [
        { id: "schedule-1", title: "完成需求文档初稿", startTime: "09:00", priority: "high" },
        { id: "schedule-2", title: "与开发确认功能逻辑", startTime: "10:30", priority: "high" },
        { id: "schedule-3", title: "整理用户反馈并归类", startTime: "14:00", priority: "mid" },
      ],
    },
    roadmap: {
      view: "week",
      windowStart: "2024-05-12",
      topLabel: "领域 / 产品设计",
      windowLabel: "2024年5月",
      groups: [
        {
          id: "roadmap-group-1",
          title: "1. 产品 & 设计",
          items: [
            { id: "roadmap-item-1", title: "工作台改版" },
            { id: "roadmap-item-2", title: "任务追踪页优化" },
          ],
        },
        {
          id: "roadmap-group-2",
          title: "2. 用户研究",
          items: [
            { id: "roadmap-item-3", title: "用户访谈洞察" },
            { id: "roadmap-item-4", title: "访谈提要" },
          ],
        },
        {
          id: "roadmap-group-3",
          title: "3. 个人成长",
          items: [
            { id: "roadmap-item-5", title: "效率系统复盘" },
            { id: "roadmap-item-6", title: "阅读沉淀" },
          ],
        },
      ],
    },
    morningFlow: {
      voiceDone: false,
      diaryDone: false,
      planningDone: false,
      fineTuneDone: false,
    },
  };
}

function buildTaskPlanRoadmapHeaders(windowStart: string): string[] {
  const baseDate = new Date(windowStart);
  const start = Number.isNaN(baseDate.getTime()) ? new Date("2024-05-12T00:00:00.000Z") : baseDate;
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const weekDay = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "周一";
    return `${date.getMonth() + 1}/${date.getDate()} ${weekDay}`;
  });
}

async function fetchHealthDomainState(): Promise<HealthDomainState> {
  const response = await fetch("/api/workspace/health/state");
  const payload = (await response.json()) as WorkspaceHealthStatePayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readWorkspaceHealthError(payload.error, "健康数据读取失败"));
  }
  return payload.data.state;
}

async function postHealthVerificationCode(
  username: string,
  captchaCode: string,
): Promise<
  | { kind: "sent"; maskedPhone: string; ticketReady: boolean; message: string | null }
  | { kind: "captcha_required"; message: string; captchaImageDataUrl: string }
> {
  const response = await fetch("/api/workspace/health/connection/account/send-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, captchaCode }),
  });
  const payload = (await response.json()) as WorkspaceHealthActionPayload;
  const challenge = readWorkspaceHealthCaptchaChallenge(payload.error);
  if (challenge) {
    return {
      kind: "captcha_required",
      message: readWorkspaceHealthError(payload.error, "获取验证码前需要先完成图形验证码。"),
      captchaImageDataUrl: challenge,
    };
  }
  if (!response.ok || !payload.success || !payload.data?.maskedPhone) {
    throw new Error(readWorkspaceHealthError(payload.error, "验证码发送失败"));
  }
  return {
    kind: "sent",
    maskedPhone: payload.data.maskedPhone,
    ticketReady: payload.data.ticketReady !== false,
    message:
      typeof payload.data.message === "string" && payload.data.message.trim()
        ? payload.data.message
        : null,
  };
}

async function postHealthAccountConnection(
  draft: HealthDomainViewState["accountDraft"],
): Promise<
  | { kind: "connected"; state: HealthDomainState }
  | { kind: "captcha_required"; message: string; captchaImageDataUrl: string }
> {
  const response = await fetch("/api/workspace/health/connection/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(draft),
  });
  const payload = (await response.json()) as WorkspaceHealthActionPayload;
  const challenge = readWorkspaceHealthCaptchaChallenge(payload.error);
  if (challenge) {
    return {
      kind: "captcha_required",
      message: readWorkspaceHealthError(payload.error, "提交图形验证码后再完成登录。"),
      captchaImageDataUrl: challenge,
    };
  }
  if (!response.ok || !payload.success || !payload.data?.state) {
    throw new Error(readWorkspaceHealthError(payload.error, "健康账号连接失败"));
  }
  return { kind: "connected", state: payload.data.state };
}

async function postHealthApiConnection(
  draft: HealthDomainViewState["apiDraft"],
): Promise<HealthDomainState> {
  const response = await fetch("/api/workspace/health/connection/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(draft),
  });
  const payload = (await response.json()) as WorkspaceHealthActionPayload;
  if (!response.ok || !payload.success || !payload.data?.state) {
    throw new Error(readWorkspaceHealthError(payload.error, "健康 API 连接失败"));
  }
  return payload.data.state;
}

async function postHealthQrLoginStart(): Promise<HealthDomainQrLoginState> {
  const response = await fetch("/api/workspace/health/connection/qr/start", {
    method: "POST",
  });
  const payload = (await response.json()) as WorkspaceHealthActionPayload;
  if (!response.ok || !payload.success || !payload.data?.sessionId || !payload.data.qrImageUrl) {
    throw new Error(readWorkspaceHealthError(payload.error, "二维码生成失败"));
  }
  return {
    sessionId: payload.data.sessionId,
    qrImageUrl: payload.data.qrImageUrl,
    loginUrl: payload.data.loginUrl ?? null,
  };
}

async function getHealthQrLoginStatus(
  sessionId: string,
): Promise<
  | { status: "pending" }
  | { status: "connected"; state: HealthDomainState }
> {
  const response = await fetch(
    `/api/workspace/health/connection/qr/${encodeURIComponent(sessionId)}`,
  );
  const payload = (await response.json()) as WorkspaceHealthActionPayload;
  if (!response.ok || !payload.success || !payload.data?.status) {
    throw new Error(readWorkspaceHealthError(payload.error, "二维码登录失败"));
  }
  if (payload.data.status === "pending") {
    return { status: "pending" };
  }
  if (!payload.data.state) {
    throw new Error("二维码登录成功后未返回健康连接状态");
  }
  return { status: "connected", state: payload.data.state };
}

async function postHealthSync(): Promise<HealthDomainState> {
  const response = await fetch("/api/workspace/health/sync", {
    method: "POST",
  });
  const payload = (await response.json()) as WorkspaceHealthActionPayload;
  if (!response.ok || !payload.success || !payload.data?.state) {
    throw new Error(readWorkspaceHealthError(payload.error, "健康数据同步失败"));
  }
  return payload.data.state;
}

async function fetchTaskPlanState(): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/state");
  const payload = (await response.json()) as TaskPlanStatePayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "任务计划读取失败"));
  }
  return payload.data.state;
}

async function fetchTaskPlanRoadmap(
  windowName: TaskPlanRoadmapWindow,
  view: TaskPlanRoadmapView,
): Promise<TaskPlanRoadmapState> {
  const response = await fetch(`/api/task-plan/roadmap?window=${windowName}&view=${view}`);
  const payload = (await response.json()) as TaskPlanRoadmapPayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "任务路线图读取失败"));
  }
  return payload.data.roadmap;
}

async function postTaskPlanVoice(input: {
  filename: string;
  mimeType: string;
  audioBase64: string;
}): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/voice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as TaskPlanVoicePayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "语音转写失败"));
  }
  return payload.data.state;
}

async function putTaskPlanText(text: string): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/text", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = (await response.json()) as TaskPlanStateMutationPayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "文本输入保存失败"));
  }
  return payload.data.state;
}

async function putTaskPlanStatus(statusSummary: string): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/status", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ statusSummary }),
  });
  const payload = (await response.json()) as TaskPlanStateMutationPayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "近日状态保存失败"));
  }
  return payload.data.state;
}

async function putTaskPlanPool(items: readonly TaskPlanPoolItem[]): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/pool", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const payload = (await response.json()) as TaskPlanStateMutationPayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "任务池保存失败"));
  }
  return payload.data.state;
}

async function postTaskPlanStatusRefresh(): Promise<TaskPlanState> {
  const response = await fetch("/api/task-plan/status/refresh", {
    method: "POST",
  });
  const payload = (await response.json()) as TaskPlanStateMutationPayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "近日状态刷新失败"));
  }
  return payload.data.state;
}

async function postTaskPlanGenerate(): Promise<TaskPlanScheduleState> {
  const response = await fetch("/api/task-plan/generate", {
    method: "POST",
  });
  const payload = (await response.json()) as TaskPlanSchedulePayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "任务计划生成失败"));
  }
  return payload.data.schedule;
}

async function putTaskPlanSchedule(
  items: readonly TaskPlanScheduleItem[],
  confirmed: boolean,
): Promise<TaskPlanScheduleState> {
  const response = await fetch("/api/task-plan/schedule", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, confirmed }),
  });
  const payload = (await response.json()) as TaskPlanSchedulePayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(readTaskPlanError(payload.error, "任务计划保存失败"));
  }
  return payload.data.schedule;
}

function normalizeTaskPlanRoadmapWindow(value: string | undefined): TaskPlanRoadmapWindow {
  return value === "prev" || value === "next" ? value : "current";
}

function normalizeTaskPlanPriority(value: string): TaskPlanPriority {
  return value === "high" || value === "mid" || value === "low" || value === "cool" || value === "neutral"
    ? value
    : "neutral";
}

function readTaskPoolTreeNodeIdentity(element: HTMLElement): TaskPoolTreeNodeIdentity | null {
  const type = element.dataset.taskPoolTreeNodeType;
  if (type !== "domain" && type !== "project" && type !== "task") {
    return null;
  }
  return {
    type,
    domain: element.dataset.taskPoolTreeNodeDomain ?? "",
    project: element.dataset.taskPoolTreeNodeProject ?? "",
    taskId: type === "task" ? element.dataset.taskPoolTreeNodeTaskId ?? null : null,
  };
}

function isSameTaskPoolTreeNode(
  currentNode: TaskPoolTreeNodeIdentity | null,
  nextNode: TaskPoolTreeNodeIdentity,
): boolean {
  return Boolean(
    currentNode &&
      currentNode.type === nextNode.type &&
      currentNode.domain === nextNode.domain &&
      currentNode.project === nextNode.project &&
      currentNode.taskId === nextNode.taskId,
  );
}

function readTaskPoolTreeNodeDraftLabel(
  node: TaskPoolTreeNodeIdentity,
  viewState: Pick<TaskPlanViewState, "state" | "poolDraft" | "poolEditMode" | "poolDraftTouched">,
): string {
  return getTaskPoolTreeNodeLabel(getTaskPlanPoolSharedItems(viewState), node);
}

function readTaskPoolTreePreferredOptionKey(
  node: TaskPoolTreeNodeIdentity,
  level: TaskPoolTreeLevel,
): string | null {
  if (level === "domain") {
    return node.domain || null;
  }
  if (level === "project") {
    return node.type === "domain" ? null : getTaskPoolProjectOptionKey(node.domain, node.project);
  }
  return node.taskId;
}

function resolveTaskPoolTreeEditedNode(
  node: TaskPoolTreeNodeIdentity,
  nextValue: string,
): TaskPoolTreeNodeIdentity {
  const trimmedValue = nextValue.trim();
  if (node.type === "domain") {
    return {
      ...node,
      domain: trimmedValue || TASK_POOL_UNGROUPED_DOMAIN,
    };
  }
  if (node.type === "project") {
    return {
      ...node,
      project: trimmedValue || TASK_POOL_UNGROUPED_PROJECT,
    };
  }
  return node;
}

function createTaskPoolTreeFocusFromLastItem(
  items: readonly TaskPlanPoolItem[],
): TaskPoolTreeNodeIdentity | null {
  const item = items[items.length - 1];
  if (!item) {
    return null;
  }
  return {
    type: "task",
    domain: getTaskPoolDomainName(item),
    project: item.project?.trim() || TASK_POOL_UNGROUPED_PROJECT,
    taskId: item.id,
  };
}

function promoteTaskPoolTreeLevelForFocus(
  currentLevel: TaskPoolTreeLevel,
  focus: TaskPoolTreeNodeIdentity,
): TaskPoolTreeLevel {
  if (focus.type === "project" && currentLevel === "domain") {
    return "project";
  }
  if (focus.type === "task" && currentLevel !== "task") {
    return "task";
  }
  return currentLevel;
}

function clampTaskPoolZoomPercent(value: number): number {
  return Math.min(TASK_POOL_ZOOM_MAX, Math.max(TASK_POOL_ZOOM_MIN, value));
}

function readTaskPlanError(
  error: string | { code?: string; message?: string } | undefined,
  fallback: string,
): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function readWorkspaceHealthError(
  error: string | WorkspaceHealthErrorPayload | undefined,
  fallback: string,
): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function readWorkspaceHealthCaptchaChallenge(
  error: string | WorkspaceHealthErrorPayload | undefined,
): string | null {
  if (!error || typeof error === "string") {
    return null;
  }
  return typeof error.captchaImageDataUrl === "string" && error.captchaImageDataUrl.trim()
    ? error.captchaImageDataUrl
    : null;
}

function clampTaskPlanSplitRatio(value: number): number {
  return Math.min(
    TASK_PLAN_SPLIT_RATIO_MAX,
    Math.max(TASK_PLAN_SPLIT_RATIO_MIN, Number.isFinite(value) ? value : TASK_PLAN_SPLIT_RATIO_DEFAULT),
  );
}

function resolveTaskPlanSplitCollapse(ratio: number): TaskPlanSplitCollapse {
  if (ratio <= TASK_PLAN_SPLIT_COLLAPSE_THRESHOLD) {
    return "top";
  }
  if (ratio >= 1 - TASK_PLAN_SPLIT_COLLAPSE_THRESHOLD) {
    return "bottom";
  }
  return "none";
}

function applyTaskPlanSplitLayout(layout: HTMLElement, ratio: number): void {
  const normalizedRatio = clampTaskPlanSplitRatio(ratio);
  const collapse = resolveTaskPlanSplitCollapse(normalizedRatio);
  layout.style.setProperty("--task-plan-top-ratio", `${normalizedRatio}`);
  if (collapse === "top") {
    layout.dataset.taskPlanCollapse = "top";
    layout.style.gridTemplateRows = `${TASK_PLAN_SPLIT_TOP_COLLAPSED_HEIGHT}px ${TASK_PLAN_SPLIT_HANDLE_SIZE}px minmax(0, calc(100% - ${TASK_PLAN_SPLIT_TOP_COLLAPSED_HEIGHT + TASK_PLAN_SPLIT_HANDLE_SIZE}px))`;
    return;
  }
  if (collapse === "bottom") {
    layout.dataset.taskPlanCollapse = "bottom";
    layout.style.gridTemplateRows = `minmax(0, calc(100% - ${TASK_PLAN_SPLIT_BOTTOM_COLLAPSED_HEIGHT + TASK_PLAN_SPLIT_HANDLE_SIZE}px)) ${TASK_PLAN_SPLIT_HANDLE_SIZE}px ${TASK_PLAN_SPLIT_BOTTOM_COLLAPSED_HEIGHT}px`;
    return;
  }
  delete layout.dataset.taskPlanCollapse;
  const topPercent = Number((normalizedRatio * 100).toFixed(1));
  const bottomPercent = Number((100 - topPercent).toFixed(1));
  const gutterOffset = TASK_PLAN_SPLIT_HANDLE_SIZE / 2;
  layout.style.gridTemplateRows = `minmax(0, calc(${topPercent}% - ${gutterOffset}px)) ${TASK_PLAN_SPLIT_HANDLE_SIZE}px minmax(0, calc(${bottomPercent}% - ${gutterOffset}px))`;
}

function readTaskPlanSplitRatio(): number {
  const raw = window.localStorage.getItem(TASK_PLAN_SPLIT_RATIO_KEY);
  return clampTaskPlanSplitRatio(raw ? Number(raw) : TASK_PLAN_SPLIT_RATIO_DEFAULT);
}

function writeTaskPlanSplitRatio(value: number): number {
  const ratio = Number(clampTaskPlanSplitRatio(value).toFixed(1));
  window.localStorage.setItem(TASK_PLAN_SPLIT_RATIO_KEY, ratio.toFixed(1));
  return ratio;
}

function renderWorkspaceDocTree(
  documents: readonly WorkspaceDocument[],
  selectedId: string,
  expandedDomains: ReadonlySet<string>,
): string {
  const root = documents.find((item) => item.kind === "root");
  const domainDocs = documents.filter((item) => item.kind === "domain");
  const projectDocs = documents.filter((item) => item.kind === "project");
  const workLogs = documents.filter((item) => item.kind === "work-log");

  return `
    ${root ? `<div class="workspace-doc-tree__group">${renderWorkspaceDocTreeItem(root, selectedId, 0)}</div>` : ""}
    ${domainDocs.map((domain) => {
      const projects = projectDocs.filter((project) => project.domain === domain.label);
      const logs = workLogs.filter((log) => log.domain === domain.label);
      const expanded = expandedDomains.has(domain.label);
      return `
        <div class="workspace-doc-tree__group">
          <div class="workspace-doc-tree__row">
            <button type="button" class="workspace-doc-tree__toggle" data-workspace-domain-toggle="${escapeHtml(domain.label)}" aria-label="toggle">${expanded ? "▾" : "▸"}</button>
            ${renderWorkspaceDocTreeItem(domain, selectedId, 0)}
          </div>
          <div class="workspace-doc-tree__children" ${expanded ? "" : "hidden"}>
            ${projects.map((project) => {
              const projectLog = logs.find((log) => log.project === project.label);
              return `
                ${renderWorkspaceDocTreeItem(project, selectedId, 1)}
                ${projectLog ? renderWorkspaceDocTreeItem(projectLog, selectedId, 2) : ""}
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function renderWorkspaceDocTreeItem(item: WorkspaceDocument, selectedId: string, depth: number): string {
  return `
    <button
      type="button"
      class="workspace-doc-tree__item${item.id === selectedId ? " is-active" : ""}"
      data-workspace-doc-id="${escapeHtml(item.id)}"
      style="--workspace-doc-depth:${depth}"
    >
      <span class="workspace-doc-tree__icon">${renderIcon(item.kind === "work-log" ? "archive" : "book-open-text", { size: 15 })}</span>
      <span>${escapeHtml(item.label)}</span>
    </button>
  `;
}

function renderWorkspaceToolbarButton(format: string, label: string): string {
  return `<button type="button" class="btn btn-secondary btn-inline workspace-doc-toolbar__button" data-workspace-format="${format}">${label}</button>`;
}

function formatWorkspaceTime(value: string): string {
  return new Date(value).toLocaleString();
}

function applyWorkspaceFormat(format: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  if (runInlineWorkspaceFormat(format)) {
    return;
  }
  const block = resolveWorkspaceBlockFormat(format);
  if (block) {
    document.execCommand("formatBlock", false, block);
    return;
  }
  if (format === "hr") {
    document.execCommand("insertHorizontalRule");
  }
}

function htmlToMarkdown(html: string): string {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return renderMarkdownBlocks(Array.from(wrapper.childNodes)).trim();
}

function renderMarkdownBlocks(nodes: readonly ChildNode[]): string {
  return nodes
    .map((node) => renderMarkdownNode(node))
    .join("")
    .replace(/\n{3,}/g, "\n\n");
}

function renderMarkdownNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }
  const renderer = WORKSPACE_MARKDOWN_RENDERERS[node.tagName.toLowerCase()];
  return renderer ? renderer(node) : renderInlineMarkdown(node.childNodes);
}

function runInlineWorkspaceFormat(format: string): boolean {
  if (format === "bold") {
    document.execCommand("bold");
    return true;
  }
  if (format === "italic") {
    document.execCommand("italic");
    return true;
  }
  if (format === "ul") {
    document.execCommand("insertUnorderedList");
    return true;
  }
  if (format === "ol") {
    document.execCommand("insertOrderedList");
    return true;
  }
  return false;
}

function resolveWorkspaceBlockFormat(format: string): string | null {
  if (format === "h1" || format === "h2" || format === "blockquote" || format === "pre") {
    return format;
  }
  if (format === "quote") {
    return "blockquote";
  }
  if (format === "code") {
    return "pre";
  }
  return null;
}

const WORKSPACE_MARKDOWN_RENDERERS: Record<string, (node: HTMLElement) => string> = {
  h1: (node) => renderMarkdownHeading(node, "#"),
  h2: (node) => renderMarkdownHeading(node, "##"),
  h3: (node) => renderMarkdownHeading(node, "###"),
  p: (node) => `${renderInlineMarkdown(node.childNodes).trim()}\n\n`,
  strong: (node) => wrapInlineMarkdown(node, "**"),
  b: (node) => wrapInlineMarkdown(node, "**"),
  em: (node) => wrapInlineMarkdown(node, "*"),
  i: (node) => wrapInlineMarkdown(node, "*"),
  ul: (node) => renderMarkdownList(node, false),
  ol: (node) => renderMarkdownList(node, true),
  blockquote: (node) => renderMarkdownBlockquote(node),
  pre: (node) => `\`\`\`\n${node.textContent?.trim() ?? ""}\n\`\`\`\n\n`,
  hr: () => "---\n\n",
  br: () => "\n",
  a: (node) => `[${renderInlineMarkdown(node.childNodes)}](${node.getAttribute("href") ?? ""})`,
  div: (node) => renderMarkdownContainer(node),
  section: (node) => renderMarkdownContainer(node),
  article: (node) => renderMarkdownContainer(node),
};

function renderMarkdownHeading(node: HTMLElement, prefix: string): string {
  return `${prefix} ${renderInlineMarkdown(node.childNodes).trim()}\n\n`;
}

function wrapInlineMarkdown(node: HTMLElement, marker: string): string {
  return `${marker}${renderInlineMarkdown(node.childNodes)}${marker}`;
}

function renderMarkdownList(node: HTMLElement, ordered: boolean): string {
  const lines = Array.from(node.children).map((child, index) => {
    const prefix = ordered ? `${index + 1}.` : "-";
    return `${prefix} ${renderInlineMarkdown(child.childNodes).trim()}`;
  });
  return `${lines.join("\n")}\n\n`;
}

function renderMarkdownBlockquote(node: HTMLElement): string {
  return `${renderInlineMarkdown(node.childNodes).split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
}

function renderMarkdownContainer(node: HTMLElement): string {
  return `${renderMarkdownBlocks(Array.from(node.childNodes))}\n`;
}

function renderInlineMarkdown(nodes: NodeListOf<ChildNode> | readonly ChildNode[]): string {
  return Array.from(nodes)
    .map((node) => renderMarkdownNode(node))
    .join("")
    .replace(/\n{3,}/g, "\n\n");
}

function extractWorkspaceHeadings(html: string): Array<{ id: string; level: number; text: string }> {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return Array.from(wrapper.querySelectorAll<HTMLElement>("h1,h2,h3"))
    .map((heading, index) => ({
      id: heading.id || `workspace-heading-${index}`,
      level: Number(heading.tagName.slice(1)),
      text: heading.textContent ?? "",
    }));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return escaped[character] ?? character;
  });
}

function cssEscape(value: string): string {
  const css = (window as Window & { CSS?: { escape?: (input: string) => string } }).CSS;
  if (typeof css?.escape === "function") {
    return css.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function readActiveTaskPoolDragTaskId(
  activeTaskId: string | null,
  dataTransfer: Pick<DataTransfer, "getData"> | null | undefined,
): string | null {
  if (!activeTaskId) {
    return null;
  }
  const transferredTaskId = dataTransfer?.getData("text/plain") ?? "";
  if (transferredTaskId && transferredTaskId !== activeTaskId) {
    return null;
  }
  return activeTaskId;
}

function readTaskPoolGestureScale(event: Event): number | null {
  const scale = (event as Event & { scale?: number }).scale;
  return typeof scale === "number" && Number.isFinite(scale) ? scale : null;
}

function resolveTaskPoolGestureZoomPercent(
  baselineZoomPercent: number,
  baselineScale: number,
  nextScale: number,
): number {
  if (nextScale === baselineScale) {
    return baselineZoomPercent;
  }
  const stepDirection = nextScale > baselineScale ? 1 : -1;
  return baselineZoomPercent + stepDirection * TASK_POOL_ZOOM_STEP;
}


