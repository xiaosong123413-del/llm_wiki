import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_TASK_PLAN_STORAGE_ROOT = "D:\\Desktop\\ai的仓库\\task plan";

const STATE_FILE_NAME = "state.json";

export interface TaskPlanStoreOptions {
  storageRoot?: string;
}

export type TaskPlanPriority = "high" | "mid" | "low" | "cool" | "neutral";
export type TaskPlanTaskSource = "文字输入" | "近日状态" | "闪念日记" | "工作日志" | "AI 生成" | "手动新增";

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

interface TaskPlanPoolState {
  items: TaskPlanPoolItem[];
}

export interface TaskPlanScheduleItem {
  id: string;
  title: string;
  startTime: string;
  priority: TaskPlanPriority;
}

export interface TaskPlanScheduleState {
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

export interface TaskPlanRoadmapState {
  view: "week";
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

export interface TaskPlanState {
  voice: TaskPlanVoiceState;
  pool: TaskPlanPoolState;
  schedule: TaskPlanScheduleState;
  roadmap: TaskPlanRoadmapState;
  statusSummary: string;
  morningFlow: TaskPlanMorningFlowState;
}

interface TaskPlanStoreSnapshot {
  state: TaskPlanState;
}

export async function bootstrapTaskPlanStore(
  options: TaskPlanStoreOptions = {},
): Promise<TaskPlanStoreSnapshot> {
  const storageRoot = resolveStorageRoot(options);
  await mkdir(storageRoot, { recursive: true });
  const state = await readTaskPlanState(options);
  return { state };
}

export async function readTaskPlanState(
  options: TaskPlanStoreOptions = {},
): Promise<TaskPlanState> {
  const filePath = getStatePath(resolveStorageRoot(options));
  if (!existsSync(filePath)) {
    const state = createDefaultTaskPlanState();
    await writeJson(filePath, state);
    return state;
  }

  const stored = await readJsonFile<Partial<TaskPlanState>>(filePath);
  return normalizeTaskPlanState(stored);
}

export async function writeTaskPlanState(
  state: TaskPlanState,
  options: TaskPlanStoreOptions = {},
): Promise<void> {
  await writeJson(getStatePath(resolveStorageRoot(options)), state);
}

function createDefaultTaskPlanState(): TaskPlanState {
  const now = "2026-04-24T00:00:00.000Z";
  return {
    voice: {
      transcript: "今天要先完成需求文档，再和产品确认功能逻辑，下午整理用户反馈，晚上复盘。",
      audioPath: null,
      updatedAt: now,
    },
    pool: {
      items: createDefaultPoolItems(),
    },
    schedule: {
      generationId: null,
      revisionId: null,
      items: createDefaultScheduleItems(),
      confirmed: false,
    },
    roadmap: {
      view: "week",
      windowStart: "2024-05-01",
      topLabel: "领域 / 产品设计",
      windowLabel: "2024年5月",
      groups: createDefaultRoadmapGroups(),
    },
    statusSummary: "今天聚焦需求确认、反馈整理和晚间复盘，先把高优事项推进到可交付状态。",
    morningFlow: {
      voiceDone: false,
      diaryDone: false,
      planningDone: false,
      fineTuneDone: false,
    },
  };
}

function createDefaultPoolItems(): TaskPlanPoolItem[] {
  return [
    { id: "pool-1", title: "完成需求文档初稿", priority: "high", source: "文字输入", domain: "产品设计", project: "工作台改版" },
    { id: "pool-2", title: "与开发确认功能逻辑", priority: "high", source: "文字输入", domain: "产品设计", project: "任务同步" },
    { id: "pool-3", title: "整理用户反馈并归类", priority: "mid", source: "近日状态", domain: "用户研究", project: "反馈归类" },
    { id: "pool-4", title: "操写项目复盘", priority: "cool", source: "AI 生成", domain: "个人成长", project: "效率系统" },
    { id: "pool-5", title: "复盘今日完成情况", priority: "low", source: "近日状态", domain: "个人成长", project: "日常复盘" },
    { id: "pool-6", title: "整理需求变更记录文档", priority: "low", source: "工作日志", domain: "产品设计", project: "任务同步" },
    { id: "pool-7", title: "准备用户访谈提纲", priority: "low", source: "闪念日记", domain: "用户研究", project: "访谈计划" },
    { id: "pool-8", title: "学习用户研究方法", priority: "low", source: "闪念日记", domain: "用户研究", project: "方法沉淀" },
    { id: "pool-9", title: "优化效率模型逻辑", priority: "cool", source: "AI 生成", domain: "个人成长", project: "效率系统" },
    { id: "pool-10", title: "准备需求汇报材料", priority: "cool", source: "手动新增", domain: "产品设计", project: "视觉梳理" },
    { id: "pool-11", title: "处理邮件与消息", priority: "neutral", source: "工作日志", domain: "个人成长", project: "日常维护" },
  ];
}

function createDefaultScheduleItems(): TaskPlanScheduleItem[] {
  return [
    {
      id: "schedule-1",
      title: "完成需求文档初稿",
      startTime: "09:00",
      priority: "high",
    },
    {
      id: "schedule-2",
      title: "与开发确认功能逻辑",
      startTime: "10:30",
      priority: "high",
    },
    {
      id: "schedule-3",
      title: "整理用户反馈并归类",
      startTime: "14:00",
      priority: "mid",
    },
    {
      id: "schedule-4",
      title: "复盘项目进度",
      startTime: "16:00",
      priority: "cool",
    },
    {
      id: "schedule-5",
      title: "复盘今日完成情况",
      startTime: "19:30",
      priority: "low",
    },
  ];
}

function createDefaultRoadmapGroups(): TaskPlanRoadmapGroup[] {
  return [
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
  ];
}

function getStatePath(root: string): string {
  return path.join(root, STATE_FILE_NAME);
}

function resolveStorageRoot(options: TaskPlanStoreOptions): string {
  return options.storageRoot ?? DEFAULT_TASK_PLAN_STORAGE_ROOT;
}

function normalizeTaskPlanState(input: Partial<TaskPlanState>): TaskPlanState {
  const defaults = createDefaultTaskPlanState();
  return {
    voice: normalizeTaskPlanVoice(input, defaults),
    pool: normalizeTaskPlanPool(input, defaults),
    schedule: normalizeTaskPlanSchedule(input, defaults),
    roadmap: normalizeTaskPlanRoadmap(input, defaults),
    statusSummary: typeof input.statusSummary === "string" ? input.statusSummary : defaults.statusSummary,
    morningFlow: normalizeMorningFlow(input, defaults),
  };
}

function normalizeTaskPlanVoice(
  input: Partial<TaskPlanState>,
  defaults: TaskPlanState,
): TaskPlanVoiceState {
  const voice = input.voice;
  return {
    transcript: readStringValue(voice?.transcript, defaults.voice.transcript),
    audioPath: readNullableString(voice?.audioPath, defaults.voice.audioPath),
    updatedAt: readNullableString(voice?.updatedAt, defaults.voice.updatedAt),
  };
}

function normalizeTaskPlanPool(
  input: Partial<TaskPlanState>,
  defaults: TaskPlanState,
): TaskPlanPoolState {
  return {
    items: Array.isArray(input.pool?.items)
      ? input.pool.items.map((item, index) => normalizeTaskPlanPoolItem(item, defaults.pool.items[index]))
      : defaults.pool.items,
  };
}

function normalizeTaskPlanSchedule(
  input: Partial<TaskPlanState>,
  defaults: TaskPlanState,
): TaskPlanScheduleState {
  return {
    generationId: readNullableString(input.schedule?.generationId, defaults.schedule.generationId),
    revisionId: readNullableString(input.schedule?.revisionId, defaults.schedule.revisionId),
    items: Array.isArray(input.schedule?.items) ? input.schedule.items : defaults.schedule.items,
    confirmed: typeof input.schedule?.confirmed === "boolean" ? input.schedule.confirmed : defaults.schedule.confirmed,
  };
}

function normalizeTaskPlanRoadmap(
  input: Partial<TaskPlanState>,
  defaults: TaskPlanState,
): TaskPlanRoadmapState {
  const roadmap = input.roadmap;
  return {
    view: roadmap?.view === "week" ? roadmap.view : defaults.roadmap.view,
    windowStart: readStringValue(roadmap?.windowStart, defaults.roadmap.windowStart),
    topLabel: readStringValue(roadmap?.topLabel, defaults.roadmap.topLabel),
    windowLabel: readStringValue(roadmap?.windowLabel, defaults.roadmap.windowLabel),
    groups: Array.isArray(roadmap?.groups) ? roadmap.groups : defaults.roadmap.groups,
  };
}

function normalizeMorningFlow(
  input: Partial<TaskPlanState>,
  defaults: TaskPlanState,
): TaskPlanMorningFlowState {
  return {
    voiceDone: typeof input.morningFlow?.voiceDone === "boolean" ? input.morningFlow.voiceDone : defaults.morningFlow.voiceDone,
    diaryDone: typeof input.morningFlow?.diaryDone === "boolean" ? input.morningFlow.diaryDone : defaults.morningFlow.diaryDone,
    planningDone:
      typeof input.morningFlow?.planningDone === "boolean" ? input.morningFlow.planningDone : defaults.morningFlow.planningDone,
    fineTuneDone:
      typeof input.morningFlow?.fineTuneDone === "boolean" ? input.morningFlow.fineTuneDone : defaults.morningFlow.fineTuneDone,
  };
}

function readNullableString(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" || value === null ? value : fallback;
}

function readStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTaskPlanPoolItem(input: unknown, fallback: TaskPlanPoolItem | undefined): TaskPlanPoolItem {
  const defaults = fallback ?? createDefaultPoolItems()[0];
  if (!isRecord(input)) {
    return defaults;
  }
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id : defaults.id,
    title: typeof input.title === "string" && input.title.trim() ? input.title : defaults.title,
    priority: isTaskPlanPriority(input.priority) ? input.priority : defaults.priority,
    source: isTaskPlanTaskSource(input.source) ? input.source : defaults.source,
    domain: readOptionalText(input.domain),
    project: readOptionalText(input.project),
  };
}

function isTaskPlanPriority(value: unknown): value is TaskPlanPriority {
  return value === "high" || value === "mid" || value === "low" || value === "cool" || value === "neutral";
}

function isTaskPlanTaskSource(value: unknown): value is TaskPlanTaskSource {
  return value === "文字输入" || value === "近日状态" || value === "闪念日记" || value === "工作日志" || value === "AI 生成"
    || value === "手动新增";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
