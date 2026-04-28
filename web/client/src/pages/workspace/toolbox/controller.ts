/**
 * Workspace toolbox controller.
 *
 * The workspace page re-renders the whole content region on every state
 * change. This controller keeps the toolbox dashboard state in one place and
 * exposes a small render/bind/load surface for the workspace entry file.
 */

import {
  closeToolboxManager,
  createInitialToolboxState,
  createManagerDraft,
  createReadyToolboxState,
  getManagerRecords,
  insertManagedRecord,
  openToolboxManager,
  removeManagedRecord,
  selectToolboxManagerRecord,
  updateToolboxManagerDraft,
  upsertManagedRecord,
} from "./model.js";
import type {
  ToolboxAssetRecord,
  ToolboxEntityType,
  ToolboxManagerDraft,
  ToolboxPayload,
  ToolboxState,
  ToolboxWorkflowRecord,
} from "./types.js";
import { renderToolboxView } from "./view.js";

interface WorkspaceToolboxControllerOptions {
  rerender: () => void;
  initialSection?: ToolboxEntityType | null;
  navigateTo?: (section: ToolboxEntityType | null) => void;
}

interface WorkspaceToolboxController {
  ensureLoaded(): void;
  render(): string;
  bind(root: HTMLElement): void;
  status(): ToolboxState["status"];
}

interface ToolboxMutationPayload {
  success?: boolean;
  error?: string;
}

interface ToolboxCreatePayload extends ToolboxMutationPayload {
  data?: {
    record?: ToolboxWorkflowRecord | ToolboxAssetRecord;
  };
}

export function createWorkspaceToolboxController(
  options: WorkspaceToolboxControllerOptions,
): WorkspaceToolboxController {
  let state = createInitialToolboxState();

  const rerender = (): void => {
    options.rerender();
  };

  const load = async (): Promise<void> => {
    try {
      const response = await fetch("/api/toolbox");
      const payload = (await response.json()) as ToolboxPayload;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "工具箱读取失败");
      }
      state = createReadyToolboxState(payload.data, options.initialSection ?? null);
    } catch (error) {
      state = {
        ...state,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    rerender();
  };

  const ensureLoaded = (): void => {
    if (state.status === "loading" || state.status === "ready") {
      return;
    }
    state = {
      ...state,
      status: "loading",
      error: null,
    };
    rerender();
    void load();
  };

  const bind = (root: HTMLElement): void => {
    root.querySelector<HTMLInputElement>("[data-toolbox-search]")?.addEventListener("input", (event) => {
      state = {
        ...state,
        search: (event.currentTarget as HTMLInputElement).value,
      };
      rerender();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-toolbox-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.toolboxMode;
        if (!state.data || (nextMode !== "工作流" && nextMode !== "工具资产")) {
          return;
        }
        state = {
          ...state,
          activeMode: nextMode,
        };
        rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-toolbox-asset-category]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextCategory = button.dataset.toolboxAssetCategory ?? "全部";
        state = {
          ...state,
          activeAssetCategory: nextCategory,
        };
        rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-toolbox-manage]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = normalizeManageSection(button.dataset.toolboxManage);
        if (!section) {
          return;
        }
        state = openToolboxManager(state, section);
        rerender();
        options.navigateTo?.(section);
      });
    });

    root.querySelector<HTMLButtonElement>("[data-toolbox-manager-back]")?.addEventListener("click", () => {
      state = closeToolboxManager(state);
      rerender();
      options.navigateTo?.(null);
    });

    root.querySelector<HTMLButtonElement>("[data-toolbox-manager-create]")?.addEventListener("click", () => {
      void createRecord();
    });

    root.querySelector<HTMLButtonElement>("[data-toolbox-manager-save]")?.addEventListener("click", () => {
      void saveRecord();
    });

    root.querySelector<HTMLButtonElement>("[data-toolbox-manager-delete]")?.addEventListener("click", () => {
      void deleteRecord();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-toolbox-manager-record]").forEach((button) => {
      button.addEventListener("click", () => {
        const recordId = button.dataset.toolboxManagerRecord ?? "";
        state = selectToolboxManagerRecord(state, recordId);
        rerender();
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-toolbox-manager-field]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const field = (event.currentTarget as HTMLInputElement).dataset.toolboxManagerField;
        if (!field || !isDraftField(field)) {
          return;
        }
        state = updateToolboxManagerDraft(
          state,
          field,
          (event.currentTarget as HTMLInputElement).value,
        );
      });
    });
  };

  const createRecord = async (): Promise<void> => {
    if (!state.data || !state.manager.openSection) {
      return;
    }
    const entityType = state.manager.openSection;
    const payload = await requestToolboxMutation<ToolboxCreatePayload>({
      method: "POST",
      body: buildCreateRecordBody(entityType, state.activeAssetCategory),
    });
    if (!payload.data?.record) {
      throw new Error("工具箱新增失败");
    }
    state = {
      ...state,
      data: insertManagedRecord(state.data, payload.data.record),
      manager: buildManagerSelection(entityType, payload.data.record),
    };
    rerender();
  };

  const saveRecord = async (): Promise<void> => {
    if (!state.data || !state.manager.openSection || !state.manager.draft) {
      return;
    }
    const draft = state.manager.draft;
    await requestToolboxMutation({
      method: "PUT",
      body: draft,
    });
    const updatedRecord = buildManagedRecordFromDraft(draft);
    state = {
      ...state,
      data: upsertManagedRecord(state.data, updatedRecord),
      manager: {
        ...state.manager,
        draft: createManagerDraft(draft.entityType, updatedRecord),
      },
    };
    rerender();
  };

  const deleteRecord = async (): Promise<void> => {
    if (!state.data || !state.manager.openSection || !state.manager.draft?.id) {
      return;
    }
    const section = state.manager.openSection;
    const id = state.manager.draft.id;
    await requestToolboxMutation({
      method: "DELETE",
      body: {
        entityType: section,
        id,
      },
    });
    const nextData = removeManagedRecord(state.data, section, id);
    const nextRecord = selectNextManagerRecord(nextData, section);
    state = {
      ...state,
      data: nextData,
      manager: buildManagerSelection(section, nextRecord),
    };
    rerender();
  };

  const requestToolboxMutation = async <TPayload extends ToolboxMutationPayload>(
    input: {
      method: "POST" | "PUT" | "DELETE";
      body: Record<string, unknown>;
    },
  ): Promise<TPayload> => {
    const response = await fetch("/api/toolbox", {
      method: input.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.body),
    });
    const payload = (await response.json()) as TPayload;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? resolveToolboxErrorMessage(input.method));
    }
    return payload;
  };

  return {
    ensureLoaded,
    render() {
      return renderToolboxView(state);
    },
    bind,
    status() {
      return state.status;
    },
  };
}

function buildCreateRecordBody(
  entityType: ToolboxEntityType,
  activeAssetCategory: string,
): Record<string, unknown> {
  if (entityType === "asset") {
    return {
      entityType,
      title: "新建工具",
      category: activeAssetCategory !== "全部" ? activeAssetCategory : "标准资料",
    };
  }
  return {
    entityType,
    title: "新工作流",
  };
}

function buildManagedRecordFromDraft(
  draft: ToolboxManagerDraft,
): ToolboxWorkflowRecord | ToolboxAssetRecord {
  if (draft.entityType === "workflow") {
    return {
      id: draft.id,
      entityType: "workflow",
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      ratioLabel: draft.ratioLabel.trim() || "1:1",
      agentName: draft.agentName.trim(),
      accent: draft.accent,
    };
  }
  const category = draft.category.trim() || "标准资料";
  return {
    id: draft.id,
    entityType: "asset",
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    category,
    badge: draft.badge.trim() || category,
    href: draft.href.trim(),
    source: {
      type: "managed",
    },
  };
}

function buildManagerSelection(
  section: ToolboxEntityType,
  record: ToolboxWorkflowRecord | ToolboxAssetRecord | null,
): ToolboxState["manager"] {
  return {
    openSection: section,
    selectedId: record?.id ?? "",
    draft: createManagerDraft(section, record),
  };
}

function selectNextManagerRecord(
  data: ToolboxState["data"],
  section: ToolboxEntityType,
): ToolboxWorkflowRecord | ToolboxAssetRecord | null {
  const records = getManagerRecords(data, section);
  return records.find((record) => {
    return record.entityType === "workflow" || record.source.type === "managed";
  }) ?? records[0] ?? null;
}

function resolveToolboxErrorMessage(method: "POST" | "PUT" | "DELETE"): string {
  if (method === "POST") {
    return "工具箱新增失败";
  }
  if (method === "PUT") {
    return "工具箱保存失败";
  }
  return "工具箱删除失败";
}

function normalizeManageSection(input: string | undefined): ToolboxEntityType | null {
  if (input === "workflows") {
    return "workflow";
  }
  if (input === "assets") {
    return "asset";
  }
  return null;
}

function isDraftField(
  input: string,
): input is "title" | "summary" | "category" | "badge" | "href" | "agentName" | "ratioLabel" {
  return input === "title"
    || input === "summary"
    || input === "category"
    || input === "badge"
    || input === "href"
    || input === "agentName"
    || input === "ratioLabel";
}
