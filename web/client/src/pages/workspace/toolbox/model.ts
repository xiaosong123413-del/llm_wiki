/**
 * Pure toolbox page state helpers.
 *
 * The workspace toolbox controller uses these helpers to keep filtering,
 * manager selection, and local optimistic state updates predictable and easy
 * to verify in tests.
 */

import type {
  ToolboxAssetRecord,
  ToolboxEntityType,
  ToolboxManagerDraft,
  ToolboxPageData,
  ToolboxState,
  ToolboxWorkflowRecord,
} from "./types.js";
import { createAssetDraft, createWorkflowDraft } from "./drafts.js";

export function createInitialToolboxState(): ToolboxState {
  return {
    status: "idle",
    data: null,
    activeMode: "工作流",
    activeAssetCategory: "全部",
    search: "",
    manager: {
      openSection: null,
      selectedId: "",
      draft: null,
    },
    error: null,
  };
}

export function createReadyToolboxState(
  data: ToolboxPageData,
  managerSection: ToolboxEntityType | null = null,
): ToolboxState {
  const baseState: ToolboxState = {
    ...createInitialToolboxState(),
    status: "ready",
    data,
    activeMode: data.page.defaultMode,
    activeAssetCategory: data.page.assetCategories[0] ?? "全部",
  };
  return managerSection ? openToolboxManager(baseState, managerSection) : baseState;
}

export function filterToolboxWorkflows(state: ToolboxState): ToolboxWorkflowRecord[] {
  const workflows = state.data?.workflows ?? [];
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return workflows;
  }
  return workflows.filter((workflow) => {
    const haystack = [workflow.title, workflow.summary, workflow.agentName].join("\n").toLowerCase();
    return haystack.includes(query);
  });
}

export function filterToolboxAssets(state: ToolboxState): ToolboxAssetRecord[] {
  const assets = state.data?.assets ?? [];
  const query = state.search.trim().toLowerCase();
  return assets.filter((asset) => {
    const matchesCategory = state.activeAssetCategory === "全部" || asset.category === state.activeAssetCategory;
    if (!matchesCategory) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [asset.title, asset.summary, asset.badge, asset.category, asset.href].join("\n").toLowerCase();
    return haystack.includes(query);
  });
}

export function openToolboxManager(state: ToolboxState, section: ToolboxEntityType): ToolboxState {
  if (!state.data) {
    return state;
  }
  const records = getManagerRecords(state.data, section);
  const selected = records.find((record) => isEditableRecord(record)) ?? records[0] ?? null;
  return {
    ...state,
    manager: {
      openSection: section,
      selectedId: selected?.id ?? "",
      draft: createManagerDraft(section, selected),
    },
  };
}

export function closeToolboxManager(state: ToolboxState): ToolboxState {
  return {
    ...state,
    manager: {
      openSection: null,
      selectedId: "",
      draft: null,
    },
  };
}

export function selectToolboxManagerRecord(state: ToolboxState, id: string): ToolboxState {
  if (!state.data || !state.manager.openSection) {
    return state;
  }
  const section = state.manager.openSection;
  const record = getManagerRecords(state.data, section).find((item) => item.id === id) ?? null;
  return {
    ...state,
    manager: {
      ...state.manager,
      selectedId: id,
      draft: createManagerDraft(section, record),
    },
  };
}

export function updateToolboxManagerDraft(
  state: ToolboxState,
  field: keyof ToolboxManagerDraft,
  value: string,
): ToolboxState {
  if (!state.manager.draft) {
    return state;
  }
  return {
    ...state,
    manager: {
      ...state.manager,
      draft: {
        ...state.manager.draft,
        [field]: value,
      },
    },
  };
}

export function insertManagedRecord(data: ToolboxPageData, record: ToolboxWorkflowRecord | ToolboxAssetRecord): ToolboxPageData {
  if (record.entityType === "workflow") {
    return {
      ...data,
      workflows: [record, ...data.workflows],
    };
  }
  return {
    ...data,
    assets: [record, ...data.assets],
  };
}

export function upsertManagedRecord(data: ToolboxPageData, record: ToolboxWorkflowRecord | ToolboxAssetRecord): ToolboxPageData {
  if (record.entityType === "workflow") {
    return {
      ...data,
      workflows: data.workflows.map((item) => (item.id === record.id ? record : item)),
    };
  }
  return {
    ...data,
    assets: data.assets.map((item) => (item.id === record.id ? record : item)),
  };
}

export function removeManagedRecord(data: ToolboxPageData, section: ToolboxEntityType, id: string): ToolboxPageData {
  if (section === "workflow") {
    return {
      ...data,
      workflows: data.workflows.filter((item) => item.id !== id),
    };
  }
  return {
    ...data,
    assets: data.assets.filter((item) => item.id !== id),
  };
}

export function getManagerRecords(
  data: ToolboxPageData,
  section: ToolboxEntityType,
): Array<ToolboxWorkflowRecord | ToolboxAssetRecord> {
  return section === "workflow" ? data.workflows : data.assets;
}

export function isEditableDraft(draft: ToolboxManagerDraft | null): boolean {
  return Boolean(draft && draft.sourceType === "managed");
}

export function createManagerDraft(
  section: ToolboxEntityType,
  record: ToolboxWorkflowRecord | ToolboxAssetRecord | null,
): ToolboxManagerDraft {
  if (section === "workflow") {
    return createWorkflowDraft(record);
  }
  return createAssetDraft(record);
}

function isEditableRecord(record: ToolboxWorkflowRecord | ToolboxAssetRecord): boolean {
  return record.entityType === "workflow" || record.source.type === "managed";
}
