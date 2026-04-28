// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  repairUntouchedTaskPlanPoolDraft,
  renderWorkspacePage,
} from "../web/client/src/pages/workspace/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  window.location.hash = "";
});

describe("workspace page", () => {
  it("defaults to the project progress tab", () => {
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    expect(page.querySelector("[data-workspace-sidebar]")).not.toBeNull();
    expect(page.querySelector("[data-workspace-sidebar-toggle]")).not.toBeNull();
    expect(page.querySelector("[data-workspace-sidebar-resize]")).not.toBeNull();
    expect(page.querySelector("[data-workspace-tab='project-progress']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-workspace-view='project-progress']")).not.toBeNull();
    expect(page.textContent).toContain("\u4eca\u65e5\u65f6\u95f4\u8868");
    expect(page.textContent).toContain("\u5f53\u524d\u4efb\u52a1");
    expect(page.textContent).toContain("\u4eca\u65e5\u5b8c\u6210\u8868");
  });

  it("renders the confirmed shared schedule on the project progress page", async () => {
    const { fetchMock, taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.schedule = {
      ...taskPlan.state.schedule,
      confirmed: true,
      items: [
        {
          id: "confirmed-schedule-1",
          title: "\u5df2\u786e\u8ba4\u7684\u65e9\u4f1a",
          startTime: "09:30",
          priority: "high",
        },
        {
          id: "confirmed-schedule-2",
          title: "\u5df2\u786e\u8ba4\u7684\u8054\u8c03",
          startTime: "14:00",
          priority: "mid",
        },
      ],
    };
    const page = renderWorkspacePage();
    document.body.appendChild(page);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/state");
    expect(page.querySelector("[data-workspace-view='project-progress']")).not.toBeNull();
    expect(page.textContent).toContain("\u5df2\u786e\u8ba4\u7684\u65e9\u4f1a");
    expect(page.textContent).toContain("\u5df2\u786e\u8ba4\u7684\u8054\u8c03");
    expect(page.textContent).toContain("09:30");
    expect(page.textContent).toContain("14:00");
    expect(page.textContent).not.toContain(
      "\u4eca\u65e5\u6b63\u5f0f\u65e5\u7a0b\u5c1a\u672a\u786e\u8ba4\uff0c\u8bf7\u5148\u5230\u4efb\u52a1\u8ba1\u5212\u9875\u786e\u8ba4\u65e5\u7a0b\u3002",
    );
  });

  it("renders the project progress schedule without crashing when shared priority is unknown", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.schedule = {
      ...taskPlan.state.schedule,
      confirmed: true,
      items: [
        {
          id: "confirmed-schedule-unknown-priority",
          title: "\u810f priority \u65e5\u7a0b",
          startTime: "16:45",
          priority: "mystery" as unknown as MockTaskPlanPriority,
        },
      ],
    };

    const page = renderWorkspacePage();
    document.body.appendChild(page);
    await flush();

    const schedulePanel = page.querySelector(".workspace-panel--todo");
    expect(schedulePanel?.textContent).toContain("\u810f priority \u65e5\u7a0b");
    expect(schedulePanel?.textContent).toContain("16:45");
  });

  it("renders the shared schedule title as text instead of HTML on the project progress page", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.schedule = {
      ...taskPlan.state.schedule,
      confirmed: true,
      items: [
        {
          id: "confirmed-schedule-html",
          title: "<img src=x onerror=alert(1)>正式日程",
          startTime: "<b>09:30</b>",
          priority: "high",
        },
      ],
    };
    const page = renderWorkspacePage();
    document.body.appendChild(page);
    await flush();

    const schedulePanel = page.querySelector(".workspace-panel--todo");
    expect(schedulePanel?.textContent).toContain("<img src=x onerror=alert(1)>正式日程");
    expect(schedulePanel?.textContent).toContain("<b>09:30</b>");
    expect(schedulePanel?.querySelector("img")).toBeNull();
    expect(schedulePanel?.querySelector("b")).toBeNull();
  });

  it("shows an empty state on the project progress page when the shared schedule is not confirmed", async () => {
    const { fetchMock, taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.schedule = {
      ...taskPlan.state.schedule,
      confirmed: false,
      items: [
        {
          id: "unconfirmed-schedule-1",
          title: "\u672a\u786e\u8ba4\u7684\u65e5\u7a0b",
          startTime: "11:00",
          priority: "high",
        },
      ],
    };
    const page = renderWorkspacePage();
    document.body.appendChild(page);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/state");
    expect(page.querySelector("[data-workspace-view='project-progress']")).not.toBeNull();
    expect(page.textContent).toContain(
      "\u4eca\u65e5\u6b63\u5f0f\u65e5\u7a0b\u5c1a\u672a\u786e\u8ba4\uff0c\u8bf7\u5148\u5230\u4efb\u52a1\u8ba1\u5212\u9875\u786e\u8ba4\u65e5\u7a0b\u3002",
    );
    expect(page.textContent).toContain(
      "\u4efb\u52a1\u8ba1\u5212\u9875\u786e\u8ba4\u540e\u7684\u6b63\u5f0f\u7248\u65f6\u95f4\u8868\u4f1a\u81ea\u52a8\u540c\u6b65\u5230\u8fd9\u91cc\u3002",
    );
    expect(page.textContent).not.toContain("\u672a\u786e\u8ba4\u7684\u65e5\u7a0b");
    expect(page.querySelector(".workspace-panel--todo")?.textContent).not.toContain("\u672a\u786e\u8ba4\u7684\u65e5\u7a0b");
  });

  it("shows a loading state on the project progress page while the shared schedule is loading", () => {
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(() => {
          return undefined;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/state");
    expect(page.querySelector(".workspace-panel--todo")?.textContent).toContain("\u6b63\u5728\u540c\u6b65\u4efb\u52a1\u8ba1\u5212\u9875\u7684\u6b63\u5f0f\u65e5\u7a0b");
    expect(page.querySelector(".workspace-panel--todo")?.textContent).not.toContain(
      "\u4eca\u65e5\u6b63\u5f0f\u65e5\u7a0b\u5c1a\u672a\u786e\u8ba4\uff0c\u8bf7\u5148\u5230\u4efb\u52a1\u8ba1\u5212\u9875\u786e\u8ba4\u65e5\u7a0b\u3002",
    );
  });

  it("shows an error state on the project progress page when the shared schedule fails to load", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/task-plan/state") {
        return {
          ok: false,
          json: async () => ({
            success: false,
            error: "\u5171\u4eab\u65e5\u7a0b\u52a0\u8f7d\u5931\u8d25",
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderWorkspacePage();
    document.body.appendChild(page);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/state");
    expect(page.querySelector(".workspace-panel--todo")?.textContent).toContain("\u5171\u4eab\u65e5\u7a0b\u52a0\u8f7d\u5931\u8d25");
    expect(page.querySelector(".workspace-panel--todo")?.textContent).not.toContain(
      "\u4eca\u65e5\u6b63\u5f0f\u65e5\u7a0b\u5c1a\u672a\u786e\u8ba4\uff0c\u8bf7\u5148\u5230\u4efb\u52a1\u8ba1\u5212\u9875\u786e\u8ba4\u65e5\u7a0b\u3002",
    );
  });

  it("hydrates the task plan tab from backend state", async () => {
    const { fetchMock } = installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/state");
    expect(page.querySelector("[data-workspace-tab='task-plan']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-workspace-view='task-plan']")).not.toBeNull();
    expect(page.textContent).toContain("\u4efb\u52a1\u8ba1\u5212\u9875");
    expect(page.textContent).toContain("AI \u667a\u80fd\u6392\u671f\u52a9\u624b");
    expect(page.textContent).toContain("\u6668\u95f4\u6d41\u7a0b\u5efa\u8bae");
    expect(page.textContent).toContain("\u5f55\u97f3\u540e\u7684\u65b0\u60f3\u6cd5");
    expect(page.textContent).toContain("\u4eca\u5929\u5148\u63a8\u8fdb\u53ef\u4ea4\u4ed8\u4efb\u52a1");
    expect(page.textContent).toContain("\u4eca\u65e5\u5efa\u8bae\u65f6\u95f4\u8868");
    expect(page.textContent).toContain("\u6765\u81ea\u540e\u7aef\u7684\u6392\u671f A");
    expect(page.textContent).toContain("\u6587\u5b57\u8f93\u5165");
    expect(page.textContent).toContain("AI \u751f\u6210");
    expect(page.textContent).toContain("\u9886\u57df / \u8de8\u56e2\u961f\u9879\u76ee");
    expect(page.textContent).toContain("2024\u5e746\u6708");
    expect(page.textContent).toContain("\u9886\u57df\u4e0e\u9879\u76ee\u63a8\u8fdb");
    expect(page.querySelector("[data-task-plan-layout]")).not.toBeNull();
    expect(page.querySelector<HTMLElement>("[data-task-plan-layout]")?.style.getPropertyValue("--task-plan-top-ratio")).toBe("0.34");
    expect(page.querySelector("[data-task-plan-text-input]")).not.toBeNull();
    expect(page.querySelector("[data-task-plan-status-input]")).not.toBeNull();
    expect(page.querySelector("[data-task-plan-voice-file]")).toBeNull();
    expect(page.querySelector("[data-task-plan-viewport]")).toBeNull();
    expect(page.querySelector("[data-task-plan-artboard]")).toBeNull();
    expect(page.querySelector("[data-task-plan-assistant-actions]")?.textContent).not.toContain("保存文本输入");
    expect(
      page
        .querySelector("[data-task-plan-card='text']")
        ?.querySelector<HTMLButtonElement>("[data-task-plan-text-save]")?.textContent,
    ).toContain("保存");
  });

  it("renders shared pool items on the task pool page", async () => {
    const { fetchMock } = installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/state");
    expect(page.querySelector("[data-workspace-tab='task-pool']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-workspace-view='task-pool']")).not.toBeNull();
    expect(page.textContent).toContain("\u4efb\u52a1\u6c60");
    expect(page.textContent).toContain("\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 1");
    expect(page.textContent).toContain("\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 2");
    expect(page.textContent).not.toContain("\u540e\u7eed\u4f1a\u5728\u8fd9\u91cc\u63a5\u5165");
  });

  it("renders the task pool safely when shared priority is malicious", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool = {
      items: [
        {
          id: "pool-malicious-priority",
          title: "\u810f priority \u4efb\u52a1",
          priority: 'high" data-priority-hacked="true' as unknown as MockTaskPlanPriority,
          source: "\u6587\u5b57\u8f93\u5165",
        },
      ],
    };

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();

    const priorityPill = page.querySelector<HTMLElement>(".workspace-task-plan-poster__pill");
    expect(priorityPill?.textContent).toBe("\u4f4e");
    expect(priorityPill?.className).toContain("workspace-task-plan-poster__pill--neutral");
    expect(priorityPill?.className).not.toContain('data-priority-hacked="true');
    expect(priorityPill?.getAttribute("data-priority-hacked")).toBeNull();
    expect(page.querySelector("[data-priority-hacked='true']")).toBeNull();
    expect(page.textContent).toContain("\u810f priority \u4efb\u52a1");
    expect(page.textContent).not.toContain("undefined");
  });

  it("saves shared pool edits from the task pool page", async () => {
    const taskPlan = createMockTaskPlanFixture();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/task-plan/state") {
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/pool" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as {
          items: Array<{ id: string; title: string; priority: MockTaskPlanPriority; source: MockTaskPlanSource }>;
        };
        taskPlan.state = {
          ...taskPlan.state,
          pool: {
            items: payload.items,
          },
        };
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-filter='AI 生成']")?.click();
    expect(page.textContent).toContain("\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 2");
    expect(page.textContent).not.toContain("\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 1");

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-filter='全部']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-remove='pool-2']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-add]")?.click();

    const existingTitleInput = page.querySelector<HTMLInputElement>("[data-task-plan-pool-title-input='pool-1']");
    const draftTitleInput = page.querySelector<HTMLInputElement>("[data-task-plan-pool-title-input='draft-pool-1']");
    const draftSourceInput = page.querySelector<HTMLSelectElement>("[data-task-plan-pool-source-input='draft-pool-1']");
    const draftPriorityInput = page.querySelector<HTMLSelectElement>("[data-task-plan-pool-priority-input='draft-pool-1']");

    expect(existingTitleInput).not.toBeNull();
    expect(draftTitleInput).not.toBeNull();
    expect(draftSourceInput).not.toBeNull();
    expect(draftPriorityInput).not.toBeNull();

    existingTitleInput!.value = "\u4efb\u52a1\u6c60\u9996\u9879\uff08\u5df2\u7f16\u8f91\uff09";
    existingTitleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    draftTitleInput!.value = "\u4efb\u52a1\u6c60\u65b0\u589e\u9879";
    draftTitleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    draftSourceInput!.value = "\u5de5\u4f5c\u65e5\u5fd7";
    draftSourceInput!.dispatchEvent(new Event("change", { bubbles: true }));
    draftPriorityInput!.value = "low";
    draftPriorityInput!.dispatchEvent(new Event("change", { bubbles: true }));

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/pool",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: "pool-1",
              title: "\u4efb\u52a1\u6c60\u9996\u9879\uff08\u5df2\u7f16\u8f91\uff09",
              priority: "high",
              source: "\u6587\u5b57\u8f93\u5165",
            },
            {
              id: "draft-pool-1",
              title: "\u4efb\u52a1\u6c60\u65b0\u589e\u9879",
              priority: "low",
              source: "\u5de5\u4f5c\u65e5\u5fd7",
            },
          ],
        }),
      }),
    );
    expect(page.textContent).toContain("\u4efb\u52a1\u6c60\u9996\u9879\uff08\u5df2\u7f16\u8f91\uff09");
    expect(page.textContent).toContain("\u4efb\u52a1\u6c60\u65b0\u589e\u9879");
    expect(page.textContent).not.toContain("\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 2");
  });

  it("repairs an untouched empty pool draft from the shared task pool", () => {
    const fixture = createMockTaskPlanFixture();

    const repaired = repairUntouchedTaskPlanPoolDraft({
      state: fixture.state,
      poolDraft: [],
      poolEditMode: true,
      poolDraftTouched: false,
    });

    expect(repaired).toEqual(fixture.state.pool.items);
    expect(repaired).not.toBe(fixture.state.pool.items);
  });

  it("keeps an intentionally cleared pool draft empty", () => {
    const fixture = createMockTaskPlanFixture();

    const repaired = repairUntouchedTaskPlanPoolDraft({
      state: fixture.state,
      poolDraft: [],
      poolEditMode: true,
      poolDraftTouched: true,
    });

    expect(repaired).toEqual([]);
  });

  it("disables pool editing controls while shared pool save is in flight", async () => {
    const taskPlan = createMockTaskPlanFixture();
    const { resolvePoolSave } = installPendingTaskPlanPoolSaveFetchMock(taskPlan);
    const page = renderWorkspacePage();
    document.body.appendChild(page);
    await openTaskPoolEditor(page);
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
    await flush();

    const controls = getTaskPlanPoolBusyControls(page);
    expectTaskPlanPoolControlsDisabled(controls, true);
    exerciseDisabledTaskPlanPoolControls(controls);

    expect(page.querySelector("[data-task-plan-pool-title-input='draft-pool-1']")).toBeNull();
    expect(page.querySelector("[data-task-plan-pool-remove='pool-2']")).not.toBeNull();
    expect(page.querySelector("[data-task-plan-pool-filter='AI 生成']")?.className).not.toContain("is-active");
    resolvePoolSave?.();
  });

  it("renders the task-pool tree view with project-level checkbox filtering", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool = {
      items: [
        {
          id: "pool-1",
          title: "完成任务池树状图视图",
          priority: "high",
          source: "文字输入",
          domain: "产品设计",
          project: "工作台改版",
        },
        {
          id: "pool-2",
          title: "联通项目推进页同步",
          priority: "mid",
          source: "AI 生成",
          domain: "产品设计",
          project: "任务同步",
        },
        {
          id: "pool-3",
          title: "统一健康卡片视觉",
          priority: "low",
          source: "工作日志",
          domain: "产品设计",
          project: "视觉梳理",
        },
      ],
    };

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();

    expect(page.querySelector("[data-task-pool-tree-level='project']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-task-pool-tree-options]")?.textContent).toContain("工作台改版");
    expect(page.querySelector("[data-task-pool-tree-options]")?.textContent).toContain("任务同步");
    expect(page.querySelector("[data-task-pool-tree-options]")?.textContent).toContain("视觉梳理");

    const visualToggle = Array.from(
      page.querySelectorAll<HTMLLabelElement>(".workspace-task-pool-tree__option"),
    ).find((label) => label.textContent?.includes("视觉梳理"))?.querySelector<HTMLInputElement>(
      "[data-task-pool-tree-option]",
    );
    expect(visualToggle).not.toBeNull();
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).not.toContain("视觉梳理");

    visualToggle!.click();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("视觉梳理");
  });

  it("renders editable tree controls when the shared pool editor is enabled in tree mode", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")).not.toBeNull();
    expect(page.querySelector("[data-task-pool-tree-root]")).not.toBeNull();
    expect(page.querySelector("[data-task-pool-tree-node-type='domain']")).not.toBeNull();
    expect(page.querySelector("[data-task-pool-tree-save-indicator]")).not.toBeNull();
    expect(page.querySelector("[data-task-plan-pool-save]")).not.toBeNull();
    expect(page.querySelector("[data-task-plan-pool-add]")).toBeNull();
  });

  it("marks selected, editing, and drag target tree nodes with visual state classes", async () => {
    const taskPlan = createMockTaskPlanFixture();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
      {
        id: "pool-2",
        title: "联通项目推进页同步",
        priority: "mid",
        source: "AI 生成",
        domain: "产品设计",
        project: "任务同步",
      },
    ];
    installTaskPlanPoolSaveFetchMock(taskPlan);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    page
      .querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    const selectedTaskNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']");
    expect(selectedTaskNode?.className).toContain("is-selected");

    selectedTaskNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    const editingTaskNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']");
    expect(editingTaskNode?.className).toContain("is-editing");
    expect(page.querySelector("[data-task-pool-tree-edit-input]")).not.toBeNull();

    const draggingTaskNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-2']");
    const transfer = createMockDataTransfer();
    dispatchDragEvent(draggingTaskNode!, "dragstart", transfer);
    await flush();

    dispatchDragEvent(
      page.querySelector<HTMLElement>("[data-task-pool-tree-node-project='工作台改版']")!,
      "dragover",
      transfer,
    );
    await flush();

    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-node-project='工作台改版']")?.className).toContain(
      "is-drop-target",
    );

    dispatchDragEvent(page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-2']")!, "dragend", transfer);
    await flush();

    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-node-project='工作台改版']")?.className).not.toContain(
      "is-drop-target",
    );
  });

  it("keeps a visible tree sidebar toggle when the filter sidebar is collapsed", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-sidebar-toggle]")?.click();
    await flush();

    expect(page.style.getPropertyValue("--task-pool-tree-sidebar-width")).toBe("56px");
    expect(page.querySelector<HTMLButtonElement>("[data-task-pool-tree-sidebar-toggle]")).not.toBeNull();
    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-sidebar]")?.className).toContain("is-collapsed");
  });

  it("adds a child task when pressing Enter on a project node", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='project']");
    projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    projectNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();

    const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    expect(input?.value).toBe("");
    expect(page.querySelector("[data-task-pool-tree-level='task']")?.getAttribute("data-active")).toBe("true");
    expect(page.textContent).toContain("树状图有未保存更改");
  });

  it("commits project edits and creates a child task when pressing Enter inside the tree edit input", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='project']");
    projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    input!.value = "交互改版";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();

    const nextInput = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(nextInput).not.toBeNull();
    expect(nextInput?.value).toBe("");
    expect(page.querySelector("[data-task-pool-tree-level='task']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("交互改版");
    expect(page.textContent).toContain("树状图有未保存更改");
  });

  it("creates a project-level editor when pressing Enter on a domain node", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const domainNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='domain']");
    domainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    domainNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();

    expect(page.querySelector("[data-task-pool-tree-level='project']")?.getAttribute("data-active")).toBe("true");
    const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    expect(input?.value).toBe("");
  });

  it("moves project tasks into the same domain's 待分组 bucket when deleting a project", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='project']");
    projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    projectNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await flush();

    expect(page.textContent).toContain("待分组");
    expect(page.textContent).toContain("完成任务池树状图视图");
  });

  it("moves domain tasks into 未归类 / 待分组 when deleting a domain", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const domainNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='domain']");
    domainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    domainNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await flush();

    expect(page.textContent).toContain("未归类");
    expect(page.textContent).toContain("待分组");
    expect(page.textContent).toContain("完成任务池树状图视图");
  });

  it("does not delete fallback domain or project buckets in tree mode", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "未归类任务",
        priority: "high",
        source: "文字输入",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const fallbackDomainNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='domain']");
    fallbackDomainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    fallbackDomainNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("未归类");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("未归类任务");

    const fallbackProjectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='project']");
    fallbackProjectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    fallbackProjectNode?.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("待分组");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("未归类任务");
  });

  it("preserves task-pool tree expansion depth by tree level", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-node-type='domain']")).not.toBeNull();
    expect(page.querySelector("[data-task-pool-tree-node-type='project']")).toBeNull();
    expect(page.querySelector("[data-task-pool-tree-node-type='task']")).toBeNull();

    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-node-type='project']")).not.toBeNull();
    expect(page.querySelector("[data-task-pool-tree-node-type='task']")).toBeNull();

    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-node-type='task']")).not.toBeNull();
  });

  it("relinks a task to the drop target project when dragging a task node onto another project", async () => {
    const taskPlan = createMockTaskPlanFixture();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
      {
        id: "pool-2",
        title: "联通项目推进页同步",
        priority: "mid",
        source: "AI 生成",
        domain: "产品设计",
        project: "任务同步",
      },
    ];
    installTaskPlanPoolSaveFetchMock(taskPlan);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const transfer = createMockDataTransfer();
    const taskNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']");
    const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-project='任务同步']");
    expect(taskNode).not.toBeNull();
    expect(projectNode).not.toBeNull();

    dispatchDragEvent(taskNode!, "dragstart", transfer);
    dispatchDragEvent(projectNode!, "dragover", transfer);
    dispatchDragEvent(projectNode!, "drop", transfer);
    dispatchDragEvent(taskNode!, "dragend", transfer);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
    await flush();

    const moved = taskPlan.state.pool.items.find((item) => item.id === "pool-1");
    expect(moved?.project).toBe("任务同步");
    expect(moved?.domain).toBe("产品设计");
  });

  it("ignores project drops when no task drag is active", async () => {
    const taskPlan = createMockTaskPlanFixture();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
      {
        id: "pool-2",
        title: "联通项目推进页同步",
        priority: "mid",
        source: "AI 生成",
        domain: "产品设计",
        project: "任务同步",
      },
    ];
    installTaskPlanPoolSaveFetchMock(taskPlan);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const transfer = createMockDataTransfer();
    transfer.setData("text/plain", "pool-1");
    const projectNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-project='任务同步']");
    expect(projectNode).not.toBeNull();

    dispatchDragEvent(projectNode!, "dragover", transfer);
    dispatchDragEvent(projectNode!, "drop", transfer);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
    await flush();

    const unchanged = taskPlan.state.pool.items.find((item) => item.id === "pool-1");
    expect(unchanged?.project).toBe("工作台改版");
    expect(unchanged?.domain).toBe("产品设计");
  });

  it("updates the tree zoom percentage when wheeling over the canvas", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    await flush();

    expect(page.textContent).toContain("90%");
    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-canvas]")?.style.getPropertyValue("--task-pool-zoom")).toBe(
      "0.9",
    );

    const canvasWrap = page.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]");
    canvasWrap?.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: false, deltaY: -120 }),
    );
    await flush();

    expect(page.textContent).toContain("100%");
    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-canvas]")?.style.getPropertyValue("--task-pool-zoom")).toBe(
      "1",
    );
  });

  it("updates the tree zoom percentage when pinching over the canvas", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    await flush();

    expect(page.textContent).toContain("90%");
    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-canvas]")?.style.getPropertyValue("--task-pool-zoom")).toBe(
      "0.9",
    );

    const canvasWrap = page.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]");
    dispatchGestureEvent(canvasWrap!, "gesturestart", 1);
    dispatchGestureEvent(canvasWrap!, "gesturechange", 1.2);
    await flush();

    expect(page.textContent).toContain("100%");
    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-canvas]")?.style.getPropertyValue("--task-pool-zoom")).toBe(
      "1",
    );
  });

  it("does not compound pinch zoom across a single gesture sequence", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    await flush();

    expect(page.textContent).toContain("90%");
    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-canvas]")?.style.getPropertyValue("--task-pool-zoom")).toBe(
      "0.9",
    );

    const canvasWrap = page.querySelector<HTMLElement>("[data-task-pool-tree-canvas-wrap]");
    dispatchGestureEvent(canvasWrap!, "gesturestart", 1);
    dispatchGestureEvent(canvasWrap!, "gesturechange", 1.1);
    dispatchGestureEvent(canvasWrap!, "gesturechange", 1.2);
    dispatchGestureEvent(canvasWrap!, "gesturechange", 1.3);
    await flush();

    expect(page.textContent).toContain("100%");
    expect(page.textContent).not.toContain("110%");
    expect(page.querySelector<HTMLElement>("[data-task-pool-tree-canvas]")?.style.getPropertyValue("--task-pool-zoom")).toBe(
      "1",
    );
  });

  it("renaming the active task-pool domain keeps the edited branch visible", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "域内任务",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
      {
        id: "pool-2",
        title: "其他域任务",
        priority: "mid",
        source: "AI 生成",
        domain: "工程效率",
        project: "自动化",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    const scopedChip = Array.from(page.querySelectorAll<HTMLButtonElement>("[data-task-pool-domain-chip]")).find(
      (button) => button.textContent?.trim() === "产品设计",
    );
    scopedChip?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const domainNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='domain']");
    domainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    domainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    input!.value = "体验设计";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new Event("blur", { bubbles: true }));
    await flush();

    expect(page.querySelector<HTMLElement>("[data-workspace-view='task-pool'] h2")?.textContent).toBe("体验设计");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("体验设计");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("域内任务");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).not.toContain("工程效率");
    expect(window.location.hash).toBe("#/workspace/task-pool/domain/%E4%BD%93%E9%AA%8C%E8%AE%BE%E8%AE%A1");
  });

  it("keeps same-named projects in different domains independently filterable at project level", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "设计一部任务",
        priority: "high",
        source: "文字输入",
        domain: "设计一部",
        project: "周会",
      },
      {
        id: "pool-2",
        title: "设计二部任务",
        priority: "mid",
        source: "AI 生成",
        domain: "设计二部",
        project: "周会",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();
    await flush();

    const projectOptions = Array.from(
      page.querySelectorAll<HTMLLabelElement>(".workspace-task-pool-tree__option"),
    );
    expect(projectOptions).toHaveLength(2);
    expect(projectOptions.map((option) => option.textContent?.trim())).toEqual([
      "周会（设计一部）",
      "周会（设计二部）",
    ]);
    expect(
      new Set(
        projectOptions.map((option) => option.querySelector<HTMLInputElement>("[data-task-pool-tree-option]")?.dataset.taskPoolTreeOption),
      ).size,
    ).toBe(2);
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("设计一部");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("设计二部");

    projectOptions
      .find((option) => option.textContent?.includes("周会（设计一部）"))
      ?.querySelector<HTMLInputElement>("[data-task-pool-tree-option]")
      ?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).not.toContain("设计一部");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("设计二部");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("周会");
  });

  it("keeps single-domain project labels plain when only one project option exists", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "任务一",
        priority: "high",
        source: "文字输入",
        domain: "设计一部",
        project: "周会",
      },
      {
        id: "pool-2",
        title: "任务二",
        priority: "mid",
        source: "AI 生成",
        domain: "设计一部",
        project: "周会",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();
    await flush();

    const projectOptions = Array.from(
      page.querySelectorAll<HTMLLabelElement>(".workspace-task-pool-tree__option"),
    );
    expect(projectOptions).toHaveLength(1);
    expect(projectOptions[0]?.textContent?.trim()).toBe("周会");
  });

  it("keeps unsaved list edits visible when switching back to the task-pool tree", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "旧列表标题",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();

    const titleInput = page.querySelector<HTMLInputElement>("[data-task-plan-pool-title-input='pool-1']");
    expect(titleInput).not.toBeNull();
    titleInput!.value = "未保存列表标题";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));

    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("未保存列表标题");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).not.toContain("旧列表标题");
  });

  it("keeps duplicate task titles independently filterable in task-level tree mode", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "重复任务",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
      {
        id: "pool-2",
        title: "重复任务",
        priority: "mid",
        source: "AI 生成",
        domain: "产品设计",
        project: "任务同步",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-option='pool-1']")).not.toBeNull();
    expect(page.querySelector("[data-task-pool-tree-option='pool-2']")).not.toBeNull();

    page.querySelector<HTMLInputElement>("[data-task-pool-tree-option='pool-2']")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("工作台改版");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).not.toContain("任务同步");

    page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    input!.value = "已重命名任务";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new Event("blur", { bubbles: true }));
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("已重命名任务");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).not.toContain("任务同步");

    page.querySelector<HTMLInputElement>("[data-task-pool-tree-option='pool-2']")?.click();
    await flush();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("已重命名任务");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("重复任务");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("任务同步");
  });

  it("keeps tree edits local until the shared pool save button is clicked", async () => {
    const { taskPlan } = installTaskPlanFetchMock();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='task']")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    page.querySelector<HTMLElement>("[data-task-pool-tree-node-type='task']")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    const input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    input!.value = "树状图草稿任务";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new Event("blur", { bubbles: true }));
    await flush();

    expect(page.textContent).toContain("树状图有未保存更改");
    expect(taskPlan.state.pool.items[0]?.title).toBe("完成任务池树状图视图");
  });

  it("persists tree edits through the shared pool save action", async () => {
    const taskPlan = createMockTaskPlanFixture();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "完成任务池树状图视图",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
      {
        id: "pool-2",
        title: "同步项目任务",
        priority: "mid",
        source: "AI 生成",
        domain: "产品设计",
        project: "工作台改版",
      },
      {
        id: "pool-3",
        title: "未归类任务",
        priority: "low",
        source: "工作日志",
      },
    ];
    installTaskPlanPoolSaveFetchMock(taskPlan);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    await flush();

    const domainNode = Array.from(page.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='domain']")).find(
      (node) => node.textContent?.trim() === "产品设计",
    );
    domainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    domainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    let input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    input!.value = "体验设计";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new Event("blur", { bubbles: true }));
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();
    await flush();

    const projectNode = Array.from(page.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='project']")).find(
      (node) => node.textContent?.trim() === "工作台改版",
    );
    projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    projectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    input!.value = "交互改版";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new Event("blur", { bubbles: true }));
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();
    await flush();

    const taskNode = page.querySelector<HTMLElement>("[data-task-pool-tree-node-task-id='pool-1']");
    taskNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    taskNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    input = page.querySelector<HTMLInputElement>("[data-task-pool-tree-edit-input]");
    expect(input).not.toBeNull();
    input!.value = "树状图已保存任务";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new Event("blur", { bubbles: true }));
    await flush();

    const fallbackDomainNode = Array.from(
      page.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='domain']"),
    ).find((node) => node.textContent?.trim() === "未归类");
    fallbackDomainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    fallbackDomainNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.querySelector("[data-task-pool-tree-edit-input]")).toBeNull();

    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='project']")?.click();
    await flush();

    const fallbackProjectNode = Array.from(
      page.querySelectorAll<HTMLElement>("[data-task-pool-tree-node-type='project']"),
    ).find((node) => node.textContent?.trim() === "待分组");
    fallbackProjectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    fallbackProjectNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(page.querySelector("[data-task-pool-tree-edit-input]")).toBeNull();

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
    await flush();

    const renamedTask = taskPlan.state.pool.items.find((item) => item.id === "pool-1");
    const renamedProjectSibling = taskPlan.state.pool.items.find((item) => item.id === "pool-2");
    const fallbackTask = taskPlan.state.pool.items.find((item) => item.id === "pool-3");

    expect(renamedTask?.title).toBe("树状图已保存任务");
    expect(renamedTask?.domain).toBe("体验设计");
    expect(renamedTask?.project).toBe("交互改版");
    expect(renamedProjectSibling?.domain).toBe("体验设计");
    expect(renamedProjectSibling?.project).toBe("交互改版");
    expect(fallbackTask?.domain).toBeUndefined();
    expect(fallbackTask?.project).toBeUndefined();
    expect(page.textContent).not.toContain("树状图有未保存更改");
  });

  it("does not leave the task-pool tree filtered to stale options after saving shared pool edits", async () => {
    const taskPlan = createMockTaskPlanFixture();
    taskPlan.state.pool.items = [
      {
        id: "pool-1",
        title: "旧任务标题",
        priority: "high",
        source: "文字输入",
        domain: "产品设计",
        project: "工作台改版",
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/task-plan/state") {
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/pool" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as {
          items: Array<{
            id: string;
            title: string;
            priority: MockTaskPlanPriority;
            source: MockTaskPlanSource;
            domain?: string;
            project?: string;
          }>;
        };
        taskPlan.state = {
          ...taskPlan.state,
          pool: {
            items: payload.items,
          },
        };
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-tree-level='task']")?.click();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("旧任务标题");

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='list']")?.click();

    const titleInput = page.querySelector<HTMLInputElement>("[data-task-plan-pool-title-input='pool-1']");
    expect(titleInput).not.toBeNull();
    titleInput!.value = "新任务标题";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-pool-view-mode='tree']")?.click();

    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).toContain("新任务标题");
    expect(page.querySelector("[data-task-pool-tree-canvas]")?.textContent).not.toContain("旧任务标题");
  });

  it("renders the health domain page with sleep-focused metrics and import controls", async () => {
    installWorkspaceHealthFetchMock();
    window.location.hash = "#/workspace/task-pool/domain/health";
    const page = renderWorkspacePage({ routeSection: "task-pool/domain/health" });
    document.body.appendChild(page);
    await flush();

    expect(page.querySelector("[data-workspace-tab='task-pool']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-workspace-domain-view='health']")).not.toBeNull();
    expect(page.textContent).toContain("健康");
    expect(page.textContent).toContain("入睡时间");
    expect(page.textContent).toContain("23:48");
    expect(page.textContent).toContain("起床时间");
    expect(page.textContent).toContain("07:26");
    expect(page.textContent).toContain("深度睡眠质量");
    expect(page.textContent).toContain("偏低");
    expect(page.textContent).toContain("影响睡眠的因素");
    expect(page.textContent).toContain("入睡时间最近?7 天波动偏大");
    expect(page.querySelector("[data-health-import-open]")).not.toBeNull();

    page.querySelector<HTMLButtonElement>("[data-health-import-open]")?.click();

    expect(page.querySelector("[data-health-import-modal]")).not.toBeNull();
    expect(page.textContent).toContain("验证码连接");
    expect(page.textContent).toContain("高级连接");
    expect(page.querySelector("[data-health-import-tab='account']")).not.toBeNull();
    expect(page.querySelector("[data-health-import-tab='api']")).not.toBeNull();

    page.querySelector<HTMLButtonElement>("[data-health-import-tab='api']")?.click();

    expect(page.textContent).toContain("二维码登录生成 token");
    expect(page.querySelector("[data-health-qr-login]")).not.toBeNull();
  });

  it("shows a captcha challenge instead of mojibake when Xiaomi asks for image verification", async () => {
    installWorkspaceHealthCaptchaFetchMock();
    window.location.hash = "#/workspace/task-pool/domain/health";
    const page = renderWorkspacePage({ routeSection: "task-pool/domain/health" });
    document.body.appendChild(page);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-health-import-open]")?.click();
    page.querySelector<HTMLInputElement>("[data-health-account-input='username']")!.value = "19000000000";
    page.querySelector<HTMLInputElement>("[data-health-account-input='username']")!.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-health-send-code]")?.click();
    await flush();

    expect(page.textContent).toContain("获取验证码前需要先完成图形验证码。");
    expect(page.textContent).toContain("验证码连接");
    expect(page.querySelector("[data-health-captcha-challenge]")).not.toBeNull();
    expect(page.querySelector<HTMLImageElement>(".workspace-health-domain__captcha-image")?.src).toContain("data:image/png;base64,");
    expect(page.querySelector<HTMLInputElement>("[data-health-account-input='captchaCode']")).not.toBeNull();
    expect(page.querySelector("[data-health-account-input='password']")).toBeNull();
  });

  it("treats Xiaomi phone-info failures as a partial success when the sms has already been sent", async () => {
    installWorkspaceHealthPartialVerificationFetchMock();
    window.location.hash = "#/workspace/task-pool/domain/health";
    const page = renderWorkspacePage({ routeSection: "task-pool/domain/health" });
    document.body.appendChild(page);
    await flush();

    page.querySelector<HTMLButtonElement>("[data-health-import-open]")?.click();
    page.querySelector<HTMLInputElement>("[data-health-account-input='username']")!.value = "19000000000";
    page.querySelector<HTMLInputElement>("[data-health-account-input='username']")!.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-health-send-code]")?.click();
    await flush();

    page.querySelector<HTMLInputElement>("[data-health-account-input='captchaCode']")!.value = "aBcD";
    page.querySelector<HTMLInputElement>("[data-health-account-input='captchaCode']")!.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-health-send-code]")?.click();
    await flush();

    expect(page.textContent).toContain("短信验证码已经发到你的手机");
    expect(page.textContent).toContain("验证码登录并连接");
    expect(page.querySelector("[data-health-captcha-challenge]")).not.toBeNull();
    expect(page.querySelector<HTMLInputElement>("[data-health-account-input='captchaCode']")?.value).toBe("aBcD");
  });

  it("keeps the active content visible after collapsing the workspace sidebar", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-workspace-sidebar-toggle]")?.click();

    expect(page.querySelector("[data-workspace-sidebar]")?.className).toContain("is-collapsed");
    expect(page.querySelector("[data-workspace-view='task-plan']")).not.toBeNull();
    expect(page.querySelector("[data-task-plan-layout]")).not.toBeNull();
    expect(page.textContent).toContain("\u5f55\u97f3\u540e\u7684\u65b0\u60f3\u6cd5");
  });

  it("wires task plan actions to backend routes", async () => {
    const taskPlan = createMockTaskPlanFixture();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/task-plan/state") {
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/text" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as { text: string };
        taskPlan.state = {
          ...taskPlan.state,
          voice: {
            transcript: payload.text,
            audioPath: null,
            updatedAt: "2026-04-24T09:15:00.000Z",
          },
          morningFlow: {
            ...taskPlan.state.morningFlow,
            voiceDone: true,
          },
        };
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/status" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as { statusSummary: string };
        taskPlan.state = {
          ...taskPlan.state,
          statusSummary: payload.statusSummary,
        };
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/status/refresh" && init?.method === "POST") {
        taskPlan.state = {
          ...taskPlan.state,
          statusSummary: "\u7531\u540e\u7aef\u5237\u65b0\u7684\u8fd1\u65e5\u72b6\u6001",
        };
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/pool" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as {
          items: Array<{ id: string; title: string; priority: MockTaskPlanPriority; source: MockTaskPlanSource }>;
        };
        taskPlan.state = {
          ...taskPlan.state,
          pool: {
            items: payload.items,
          },
        };
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/generate" && init?.method === "POST") {
        taskPlan.state = {
          ...taskPlan.state,
          schedule: {
            generationId: "task-plan-generation-2",
            revisionId: taskPlan.state.schedule.revisionId,
            confirmed: false,
            items: [
              {
                id: "schedule-generated-1",
                title: "\u7ecf AI \u91cd\u65b0\u7f16\u6392\u7684\u65e5\u7a0b",
                startTime: "08:30",
                priority: "high",
              },
            ],
          },
          morningFlow: {
            ...taskPlan.state.morningFlow,
            diaryDone: true,
            planningDone: true,
            fineTuneDone: false,
          },
        };
        return jsonResponse({
          success: true,
          data: {
            schedule: taskPlan.state.schedule,
          },
        });
      }
      if (url === "/api/task-plan/schedule" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as {
          items: Array<{ id: string; title: string; startTime: string; priority: string }>;
          confirmed: boolean;
        };
        taskPlan.state = {
          ...taskPlan.state,
          schedule: {
            generationId: taskPlan.state.schedule.generationId,
            revisionId: "schedule-revision-2",
            items: payload.items.map((item) => ({
              id: item.id,
              title: item.title,
              startTime: item.startTime,
              priority: normalizeTaskPlanPriority(item.priority),
            })),
            confirmed: payload.confirmed,
          },
          morningFlow: {
            ...taskPlan.state.morningFlow,
            fineTuneDone: payload.confirmed,
          },
        };
        return jsonResponse({
          success: true,
          data: {
            schedule: taskPlan.state.schedule,
          },
        });
      }
      if (url === "/api/task-plan/roadmap?window=prev&view=week") {
        taskPlan.state = {
          ...taskPlan.state,
          roadmap: {
            view: "week",
            windowStart: "2024-06-03",
            topLabel: "\u9886\u57df / \u65b0\u7a97\u53e3",
            windowLabel: "2024\u5e747\u6708",
            groups: [
              {
                id: "roadmap-group-next",
                title: "1. \u65b0\u5468\u89c6\u56fe",
                items: [{ id: "roadmap-item-next", title: "\u5f00\u59cb\u4e0b\u4e00\u4e2a\u8282\u70b9" }],
              },
            ],
          },
        };
        return jsonResponse({
          success: true,
          data: {
            roadmap: taskPlan.state.roadmap,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();

    const textInput = page.querySelector<HTMLTextAreaElement>("[data-task-plan-text-input]");
    expect(textInput).not.toBeNull();
    textInput!.value = "\u65b0\u7684\u6587\u5b57\u60f3\u6cd5";
    textInput!.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-task-plan-text-save]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/text",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "\u65b0\u7684\u6587\u5b57\u60f3\u6cd5",
        }),
      }),
    );
    expect(page.textContent).toContain("\u65b0\u7684\u6587\u5b57\u60f3\u6cd5");

    const statusInput = page.querySelector<HTMLTextAreaElement>("[data-task-plan-status-input]");
    expect(statusInput).not.toBeNull();
    statusInput!.value = "\u624b\u52a8\u7f16\u8f91\u7684\u8fd1\u65e5\u72b6\u6001";
    statusInput!.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-task-plan-status-save]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/status",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          statusSummary: "\u624b\u52a8\u7f16\u8f91\u7684\u8fd1\u65e5\u72b6\u6001",
        }),
      }),
    );
    expect(page.textContent).toContain("\u624b\u52a8\u7f16\u8f91\u7684\u8fd1\u65e5\u72b6\u6001");

    page.querySelector<HTMLButtonElement>("[data-task-plan-status-refresh]")?.click();
    expect(page.querySelector("[data-task-plan-feedback-inline]")?.textContent).toContain("\u6b63\u5728\u5237\u65b0\u8fd1\u65e5\u72b6\u6001");
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/status/refresh",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(page.textContent).toContain("\u7531\u540e\u7aef\u5237\u65b0\u7684\u8fd1\u65e5\u72b6\u6001");

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-filter=\"AI 生成\"]")?.click();
    expect(page.textContent).toContain("\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 2");
    expect(page.textContent).not.toContain("\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 1");

    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-add]")?.click();
    const poolTitleInput = page.querySelector<HTMLInputElement>("[data-task-plan-pool-title-input='draft-pool-1']");
    const poolSourceInput = page.querySelector<HTMLSelectElement>("[data-task-plan-pool-source-input='draft-pool-1']");
    const poolPriorityInput = page.querySelector<HTMLSelectElement>("[data-task-plan-pool-priority-input='draft-pool-1']");
    expect(poolTitleInput).not.toBeNull();
    expect(poolSourceInput).not.toBeNull();
    expect(poolPriorityInput).not.toBeNull();
    poolTitleInput!.value = "\u624b\u52a8\u65b0\u589e\u7684\u4efb\u52a1";
    poolTitleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    poolSourceInput!.value = "\u624b\u52a8\u65b0\u589e";
    poolSourceInput!.dispatchEvent(new Event("change", { bubbles: true }));
    poolPriorityInput!.value = "mid";
    poolPriorityInput!.dispatchEvent(new Event("change", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/pool",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [
            { id: "pool-1", title: "\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 1", priority: "high", source: "\u6587\u5b57\u8f93\u5165" },
            { id: "pool-2", title: "\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 2", priority: "mid", source: "AI \u751f\u6210" },
            { id: "draft-pool-1", title: "\u624b\u52a8\u65b0\u589e\u7684\u4efb\u52a1", priority: "mid", source: "\u624b\u52a8\u65b0\u589e" },
          ],
        }),
      }),
    );
    expect(page.textContent).toContain("\u624b\u52a8\u65b0\u589e\u7684\u4efb\u52a1");

    page.querySelector<HTMLButtonElement>("[data-task-plan-generate]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/generate",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(page.textContent).toContain("\u7ecf AI \u91cd\u65b0\u7f16\u6392\u7684\u65e5\u7a0b");

    page.querySelector<HTMLButtonElement>("[data-task-plan-schedule-edit-toggle]")?.click();
    const addButton = page.querySelector<HTMLButtonElement>("[data-task-plan-schedule-add]");
    expect(addButton).not.toBeNull();
    addButton!.click();
    const timeInput = page.querySelector<HTMLInputElement>("[data-task-plan-schedule-time-input='schedule-generated-1']");
    const titleInput = page.querySelector<HTMLInputElement>("[data-task-plan-schedule-title-input='schedule-generated-1']");
    const priorityInput = page.querySelector<HTMLSelectElement>("[data-task-plan-schedule-priority-input='schedule-generated-1']");
    expect(timeInput).not.toBeNull();
    expect(titleInput).not.toBeNull();
    expect(priorityInput).not.toBeNull();
    timeInput!.value = "10:15";
    timeInput!.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput!.value = "\u624b\u52a8\u5fae\u8c03\u540e\u7684\u65e5\u7a0b";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    priorityInput!.value = "mid";
    priorityInput!.dispatchEvent(new Event("change", { bubbles: true }));
    const newTimeInput = page.querySelector<HTMLInputElement>("[data-task-plan-schedule-time-input='draft-schedule-1']");
    const newTitleInput = page.querySelector<HTMLInputElement>("[data-task-plan-schedule-title-input='draft-schedule-1']");
    const newPriorityInput = page.querySelector<HTMLSelectElement>("[data-task-plan-schedule-priority-input='draft-schedule-1']");
    expect(newTimeInput).not.toBeNull();
    expect(newTitleInput).not.toBeNull();
    expect(newPriorityInput).not.toBeNull();
    newTimeInput!.value = "18:30";
    newTimeInput!.dispatchEvent(new Event("input", { bubbles: true }));
    newTitleInput!.value = "\u65b0\u589e\u7684\u665a\u95f4\u590d\u76d8";
    newTitleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    newPriorityInput!.value = "low";
    newPriorityInput!.dispatchEvent(new Event("change", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-task-plan-schedule-remove='schedule-generated-1']")?.click();
    page.querySelector<HTMLButtonElement>("[data-task-plan-schedule-save]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/schedule",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: "draft-schedule-1",
              title: "\u65b0\u589e\u7684\u665a\u95f4\u590d\u76d8",
              startTime: "18:30",
              priority: "low",
            },
          ],
          confirmed: true,
        }),
      }),
    );
    expect(page.textContent).toContain("\u5fae\u8c03\u5df2\u4fdd\u5b58");
    expect(page.textContent).toContain("\u65b0\u589e\u7684\u665a\u95f4\u590d\u76d8");

    page.querySelector<HTMLButtonElement>("[data-task-plan-roadmap-nav='prev']")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/task-plan/roadmap?window=prev&view=week");
    expect(page.textContent).toContain("\u9886\u57df / \u65b0\u7a97\u53e3");
    expect(page.textContent).toContain("2024\u5e747\u6708");
    expect(page.querySelector("[data-task-plan-execute]")).toBeNull();
    expect(page.textContent).not.toContain("\u5f00\u59cb\u6267\u884c");
  });

  it("adds a new editable schedule row when Enter is pressed in edit mode", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-plan-schedule-edit-toggle]")?.click();

    const titleInput = page.querySelector<HTMLInputElement>("[data-task-plan-schedule-title-input='schedule-a']");
    expect(titleInput).not.toBeNull();
    titleInput!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    await flush();

    expect(page.querySelectorAll("[data-task-plan-schedule-row]")).toHaveLength(2);
    expect(page.querySelector("[data-task-plan-schedule-row='draft-schedule-1']")).not.toBeNull();
  });

  it("reorders editable schedule rows by drag-and-drop and remaps time slots to the new order", async () => {
    const taskPlan = createMockTaskPlanFixture();
    taskPlan.state.schedule.items = [
      { id: "schedule-a", title: "\u6392\u671f A", startTime: "09:00", priority: "high" },
      { id: "schedule-b", title: "\u6392\u671f B", startTime: "10:30", priority: "mid" },
      { id: "schedule-c", title: "\u6392\u671f C", startTime: "14:00", priority: "low" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/task-plan/state") {
        return jsonResponse({
          success: true,
          data: {
            state: taskPlan.state,
          },
        });
      }
      if (url === "/api/task-plan/schedule" && init?.method === "PUT") {
        return jsonResponse({
          success: true,
          data: {
            schedule: taskPlan.state.schedule,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();
    page.querySelector<HTMLButtonElement>("[data-task-plan-schedule-edit-toggle]")?.click();

    const firstRow = page.querySelector<HTMLElement>("[data-task-plan-schedule-row='schedule-a']");
    const lastRow = page.querySelector<HTMLElement>("[data-task-plan-schedule-row='schedule-c']");
    expect(firstRow).not.toBeNull();
    expect(lastRow).not.toBeNull();

    dispatchDragEvent(firstRow!, "dragstart");
    dispatchDragEvent(lastRow!, "dragover");
    dispatchDragEvent(lastRow!, "drop");
    dispatchDragEvent(firstRow!, "dragend");
    await flush();

    page.querySelector<HTMLButtonElement>("[data-task-plan-schedule-save]")?.click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/task-plan/schedule",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [
            { id: "schedule-b", title: "\u6392\u671f B", startTime: "09:00", priority: "mid" },
            { id: "schedule-c", title: "\u6392\u671f C", startTime: "10:30", priority: "low" },
            { id: "schedule-a", title: "\u6392\u671f A", startTime: "14:00", priority: "high" },
          ],
          confirmed: true,
        }),
      }),
    );
  });

  it("renders the task-plan feedback inside the top action row", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();

    const actions = page.querySelector("[data-task-plan-assistant-actions]");
    const feedback = page.querySelector("[data-task-plan-feedback-inline]");
    expect(actions).not.toBeNull();
    expect(feedback).not.toBeNull();
    expect(actions?.contains(feedback as Node)).toBe(true);
  });

  it("persists the task plan split ratio locally after dragging the split handle", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();

    const layout = page.querySelector<HTMLElement>("[data-task-plan-layout]");
    const handle = page.querySelector<HTMLElement>("[data-task-plan-split-handle]");
    expect(layout).not.toBeNull();
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute("role")).toBe("separator");
    expect(handle?.getAttribute("aria-orientation")).toBe("horizontal");

    vi.spyOn(layout!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 1000,
      width: 1200,
      height: 1000,
      toJSON() {
        return {};
      },
    } as DOMRect);

    handle!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientY: 500 }));
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientY: 700 }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientY: 700 }));

    expect(localStorage.getItem("workspace.taskPlanSplitRatio")).toBe("0.7");
    expect(layout?.style.getPropertyValue("--task-plan-top-ratio")).toBe("0.7");
  });

  it("collapses the top or bottom task-plan pane when the split handle is dragged to the edge", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();

    const layout = page.querySelector<HTMLElement>("[data-task-plan-layout]");
    const handle = page.querySelector<HTMLElement>("[data-task-plan-split-handle]");
    expect(layout).not.toBeNull();
    expect(handle).not.toBeNull();

    vi.spyOn(layout!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 1000,
      width: 1200,
      height: 1000,
      toJSON() {
        return {};
      },
    } as DOMRect);

    handle!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientY: 500 }));
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientY: 40 }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientY: 40 }));

    expect(layout?.dataset.taskPlanCollapse).toBe("top");
    expect(layout?.style.gridTemplateRows).toContain("60px");

    handle!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientY: 500 }));
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientY: 960 }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientY: 960 }));

    expect(layout?.dataset.taskPlanCollapse).toBe("bottom");
    expect(layout?.style.gridTemplateRows).toContain("68px");
  });

  it("keeps assistant feedback on a compact row so dragging down expands the card grid instead of blank space", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();

    const assistant = page.querySelector<HTMLElement>(".workspace-task-plan-poster__assistant");
    expect(assistant).not.toBeNull();
    expect(assistant?.dataset.taskPlanAssistantLayout).toBe("compact-feedback");
  });

  it("marks pool and schedule scrollers as flexible regions that can grow with the split layout", async () => {
    installTaskPlanFetchMock();
    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-plan']")?.click();
    await flush();

    expect(page.querySelector("[data-task-plan-pool-list]")?.getAttribute("data-task-plan-scroll-mode")).toBe("flex");
    expect(page.querySelector("[data-task-plan-schedule-list]")?.getAttribute("data-task-plan-scroll-mode")).toBe("flex");
  });

  it.skip("renders the legacy toolbox replica page and manages assets through section management", async () => {
    const fetchMock = installLegacyToolboxFetchMock();

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>("[data-workspace-tab='toolbox']")?.click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/toolbox");
    expect(page.querySelector("[data-workspace-view='toolbox']")).not.toBeNull();
  });

  it("renders toolbox child routes as real workspace routes and keeps management pages editable", async () => {
    const fetchMock = installManagedToolboxFetchMock();

    window.location.hash = "#/workspace/toolbox/assets";
    const page = renderWorkspacePage({ routeSection: "toolbox/assets" });
    document.body.appendChild(page);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/toolbox");
    expect(page.querySelector("[data-workspace-view='toolbox']")).not.toBeNull();
    expect(page.querySelector("[data-workspace-tab='toolbox']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-toolbox-manager-page='assets']")).not.toBeNull();
    expect(window.location.hash).toBe("#/workspace/toolbox/assets");
    expect(page.textContent).toContain("管理工具资产");
    expect(page.querySelector("[data-toolbox-manager-back]")).not.toBeNull();

    page.querySelector<HTMLButtonElement>("[data-toolbox-manager-back]")?.click();
    expect(window.location.hash).toBe("#/workspace/toolbox");
    expect(page.textContent).toContain("Research Kit");
    expect(page.textContent).not.toContain("Agent =");
    expect(page.textContent).toContain("\u5de5\u4f5c\u6d41 = \u573a\u666f\uff0c\u5e94\u7528 = \u6267\u884c\u80fd\u529b");
    expect(page.querySelector("[data-toolbox-asset-category='\u6807\u51c6\u8d44\u6599']")).not.toBeNull();
    expect(page.querySelector("[data-toolbox-asset-category='\u8f6f\u4ef6']")).not.toBeNull();

    const search = page.querySelector<HTMLInputElement>("[data-toolbox-search]");
    expect(search).not.toBeNull();
    search!.value = "Research";
    search!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(page.querySelector("[data-toolbox-assets-grid]")?.textContent).toContain("Research Kit");
    expect(page.querySelector("[data-toolbox-assets-grid]")?.textContent).not.toContain("Figma");

    search!.value = "";
    search!.dispatchEvent(new Event("input", { bubbles: true }));
    page.querySelector<HTMLButtonElement>("[data-toolbox-asset-category='\u8f6f\u4ef6']")?.click();
    expect(page.querySelector("[data-toolbox-assets-grid]")?.textContent).toContain("Figma");

    page.querySelector<HTMLButtonElement>("[data-toolbox-manage='workflows']")?.click();
    expect(window.location.hash).toBe("#/workspace/toolbox/workflows");
    expect(page.querySelector("[data-toolbox-manager-page='workflows']")).not.toBeNull();

    page.querySelector<HTMLButtonElement>("[data-toolbox-manager-back]")?.click();
    expect(window.location.hash).toBe("#/workspace/toolbox");
    expect(page.querySelector("[data-toolbox-manager-page='workflows']")).toBeNull();

    page.querySelector<HTMLButtonElement>("[data-toolbox-manage='assets']")?.click();
    expect(window.location.hash).toBe("#/workspace/toolbox/assets");
    expect(page.querySelector("[data-toolbox-manager-page='assets']")).not.toBeNull();
    page.querySelector<HTMLButtonElement>("[data-toolbox-manager-create]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/toolbox",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );

    const titleInput = page.querySelector<HTMLInputElement>("[data-toolbox-manager-field='title']");
    const summaryInput = page.querySelector<HTMLInputElement>("[data-toolbox-manager-field='summary']");
    expect(titleInput).not.toBeNull();
    expect(summaryInput).not.toBeNull();
    titleInput!.value = "Article Rewrite Tool";
    titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
    summaryInput!.value = "Rewrite drafts and normalize tone";
    summaryInput!.dispatchEvent(new Event("input", { bubbles: true }));

    page.querySelector<HTMLButtonElement>("[data-toolbox-manager-save]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/toolbox",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
      }),
    );

    page.querySelector<HTMLButtonElement>("[data-toolbox-manager-delete]")?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/toolbox",
      expect.objectContaining({
        method: "DELETE",
        headers: { "content-type": "application/json" },
      }),
    );

    page.querySelector<HTMLButtonElement>("[data-toolbox-manager-back]")?.click();
    expect(window.location.hash).toBe("#/workspace/toolbox");
    expect(page.querySelector("[data-toolbox-assets-grid]")).not.toBeNull();
  });

  it("loads work-log as a low-fidelity file-tree workspace and switches between document levels", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/workspace/docs" && (!init || init.method === undefined)) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              documents: [
                {
                  id: "root",
                  kind: "root",
                  label: "领域",
                  path: "领域.md",
                  title: "领域",
                  html: "<h1>领域</h1><p>领域总览。</p>",
                  raw: "# 领域",
                  modifiedAt: "2026-04-23T10:00:00.000Z",
                  domain: null,
                  project: null,
                },
                {
                  id: "domain:产品",
                  kind: "domain",
                  label: "产品",
                  path: "领域/产品.md",
                  title: "产品",
                  html: "<h1>产品</h1><p>产品领域说明。</p>",
                  raw: "# 产品",
                  modifiedAt: "2026-04-23T10:05:00.000Z",
                  domain: "产品",
                  project: null,
                },
                {
                  id: "project:产品/LLM Wiki WebUI",
                  kind: "project",
                  label: "LLM Wiki WebUI",
                  path: "领域/产品/LLM Wiki WebUI.md",
                  title: "LLM Wiki WebUI",
                  html: "<h1>LLM Wiki WebUI</h1><h2>项目文档</h2><p>项目文档。</p>",
                  raw: "# LLM Wiki WebUI\n\n## Overview\n\nProject notes.",
                  modifiedAt: "2026-04-23T10:10:00.000Z",
                  domain: "产品",
                  project: "LLM Wiki WebUI",
                },
                {
                  id: "work-log:产品/LLM Wiki WebUI",
                  kind: "work-log",
                  label: "工作日志",
                  path: "领域/产品/LLM Wiki WebUI/工作日志.md",
                  title: "Work Log",
                  html: "<h1>Work Log</h1><h2>Today</h2><p>Updated the workspace documents.</p>",
                  raw: "# Work Log\n\n## Today\n\nUpdated the workspace documents.",
                  modifiedAt: "2026-04-23T10:20:00.000Z",
                  domain: "产品",
                  project: "LLM Wiki WebUI",
                },
              ],
            },
          }),
        } as Response;
      }

      if (url === "/api/workspace/docs" && init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response;
      }

      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    const page = renderWorkspacePage();
    document.body.appendChild(page);

    expect(page.textContent).toContain("\u5de5\u4f5c\u65e5\u5fd7");
    page.querySelector<HTMLButtonElement>("[data-workspace-tab='work-log']")?.click();
    await flush();

    expect(page.querySelector("[data-workspace-tab='work-log']")?.getAttribute("data-active")).toBe("true");
    expect(page.querySelector("[data-workspace-view='work-log']")).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/workspace/docs");
    expect(page.querySelector("[data-workspace-sidebar]")).not.toBeNull();
    expect(page.textContent).toContain("\u76ee\u5f55");
    expect(page.querySelector("[data-workspace-tree-search]")).not.toBeNull();
    expect(page.querySelector("[data-workspace-outline-lane]")).not.toBeNull();
    expect(page.querySelector("[data-workspace-stage]")).not.toBeNull();
    expect(page.querySelector("[data-workspace-tree-resize]")).not.toBeNull();
    expect(page.querySelector("[data-workspace-tree]")?.textContent).toContain("领域");
    expect(page.querySelector("[data-workspace-outline-list]")?.textContent).toContain("领域");
    expect(page.querySelector("[data-workspace-doc-content]")?.innerHTML).toContain("<h1>领域</h1>");

    page.querySelector<HTMLButtonElement>("[data-workspace-doc-id='work-log:产品/LLM Wiki WebUI']")?.click();

    expect(page.querySelector("[data-workspace-stage-title]")?.textContent).toContain("Work Log");
    expect(page.querySelector("[data-workspace-doc-content]")?.textContent).toContain(
      "Updated the workspace documents.",
    );

    page.querySelector<HTMLButtonElement>("[data-workspace-outline-toggle]")?.click();
    expect(page.querySelector("[data-workspace-outline-lane]")?.hasAttribute("hidden")).toBe(true);
    page.querySelector<HTMLButtonElement>("[data-workspace-outline-toggle]")?.click();
    expect(page.querySelector("[data-workspace-outline-list]")?.textContent).toContain("Today");

    page.querySelector<HTMLButtonElement>("[data-workspace-edit-toggle]")?.click();
    const editor = page.querySelector<HTMLElement>("[data-workspace-doc-editor]");
    expect(editor?.getAttribute("contenteditable")).toBe("true");
    expect(page.querySelector("[data-workspace-toolbar]")).not.toBeNull();
    editor!.innerHTML = "<h1>Work Log</h1><p><strong>Done</strong> Workspace refresh.</p>";

    page.querySelector<HTMLButtonElement>("[data-workspace-save]")?.click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/docs",
      expect.objectContaining({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "领域/产品/LLM Wiki WebUI/工作日志.md",
          raw: "# Work Log\n\n**Done** Workspace refresh.",
        }),
      }),
    );
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

type MockTaskPlanPriority = "high" | "mid" | "low" | "cool" | "neutral";
type MockTaskPlanSource = string;

interface MockTaskPlanState {
  voice: {
    transcript: string;
    audioPath: string | null;
    updatedAt: string | null;
  };
  statusSummary: string;
  pool: {
    items: Array<{
      id: string;
      title: string;
      priority: MockTaskPlanPriority;
      source: MockTaskPlanSource;
      domain?: string;
      project?: string;
    }>;
  };
  schedule: {
    generationId: string | null;
    revisionId: string | null;
    items: Array<{ id: string; title: string; startTime: string; priority: MockTaskPlanPriority }>;
    confirmed: boolean;
  };
  roadmap: {
    view: "week";
    windowStart: string;
    topLabel: string;
    windowLabel: string;
    groups: Array<{
      id: string;
      title: string;
      items: Array<{ id: string; title: string }>;
    }>;
  };
  morningFlow: {
    voiceDone: boolean;
    diaryDone: boolean;
    planningDone: boolean;
    fineTuneDone: boolean;
  };
}

interface TaskPlanPoolBusyControls {
  editToggle: HTMLButtonElement | null;
  addButton: HTMLButtonElement | null;
  saveButton: HTMLButtonElement | null;
  removeButton: HTMLButtonElement | null;
  titleInput: HTMLInputElement | null;
  sourceInput: HTMLSelectElement | null;
  priorityInput: HTMLSelectElement | null;
  filterButton: HTMLButtonElement | null;
}

function installTaskPlanFetchMock() {
  const taskPlan = createMockTaskPlanFixture();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({
        success: true,
        data: {
          state: taskPlan.state,
        },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, taskPlan };
}

function installWorkspaceHealthFetchMock() {
  const taskPlan = createMockTaskPlanFixture();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({
        success: true,
        data: {
          state: taskPlan.state,
        },
      });
    }
    if (url === "/api/workspace/health/state") {
      return jsonResponse({
        success: true,
        data: {
          state: {
            connection: {
              mode: "api",
              status: "connected",
              label: "小米运动健康",
              lastSyncedAt: "2026-04-26T11:40:00.000Z",
            },
            sleep: {
              latest: {
                bedTime: "23:48",
                wakeTime: "07:26",
                totalSleep: "7小时12分",
                deepSleepQuality: "偏低",
                deepSleepMinutes: 62,
                restingHeartRate: "62 bpm",
              },
              insights: [
                "入睡时间最近?7 天波动偏大",
                "深度睡眠占比连续 3 天低于目标",
              ],
              trends: {
                bedTimes: ["23:18", "23:54", "00:12"],
                wakeTimes: ["07:05", "07:26", "07:42"],
                deepSleepMinutes: [88, 71, 62],
              },
            },
          },
        },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, taskPlan };
}

function installWorkspaceHealthCaptchaFetchMock() {
  const taskPlan = createMockTaskPlanFixture();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({
        success: true,
        data: {
          state: taskPlan.state,
        },
      });
    }
    if (url === "/api/workspace/health/state") {
      return jsonResponse({
        success: true,
        data: {
          state: {
            connection: {
              mode: null,
              status: "disconnected",
              label: null,
              lastSyncedAt: null,
              lastError: null,
            },
            sleep: {
              latest: {
                bedTime: null,
                wakeTime: null,
                totalSleep: null,
                deepSleepQuality: null,
                deepSleepMinutes: null,
                restingHeartRate: null,
              },
              insights: [],
              trends: {
                bedTimes: [],
                wakeTimes: [],
                deepSleepMinutes: [],
              },
            },
          },
        },
      });
    }
    if (url === "/api/workspace/health/connection/account/send-code" && init?.method === "POST") {
      return jsonResponse({
        success: false,
        error: {
          code: "captcha_required",
          message: "获取验证码前需要先完成图形验证码。",
          captchaImageDataUrl: "data:image/png;base64,ZmFrZQ==",
        },
      }, 409);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, taskPlan };
}

function installWorkspaceHealthPartialVerificationFetchMock() {
  const taskPlan = createMockTaskPlanFixture();
  let sendCodeCalls = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({
        success: true,
        data: {
          state: taskPlan.state,
        },
      });
    }
    if (url === "/api/workspace/health/state") {
      return jsonResponse({
        success: true,
        data: {
          state: {
            connection: {
              mode: null,
              status: "disconnected",
              label: null,
              lastSyncedAt: null,
              lastError: null,
            },
            sleep: {
              latest: {
                bedTime: null,
                wakeTime: null,
                totalSleep: null,
                deepSleepQuality: null,
                deepSleepMinutes: null,
                restingHeartRate: null,
              },
              insights: [],
              trends: {
                bedTimes: [],
                wakeTimes: [],
                deepSleepMinutes: [],
              },
            },
          },
        },
      });
    }
    if (url === "/api/workspace/health/connection/account/send-code" && init?.method === "POST") {
      sendCodeCalls += 1;
      if (sendCodeCalls === 1) {
        return jsonResponse({
          success: false,
          error: {
            code: "captcha_required",
            message: "获取验证码前需要先完成图形验证码。",
            captchaImageDataUrl: "data:image/png;base64,ZmFrZQ==",
          },
        }, 409);
      }
      return jsonResponse({
        success: true,
        data: {
          maskedPhone: "190******00",
          ticketReady: false,
          message: "短信验证码已经发到你的手机；如果已经收到，请直接填写短信验证码并点“验证码登录并连接”。",
        },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, taskPlan };
}

function installLegacyToolboxFetchMock() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/toolbox" && (!init || init.method === undefined)) {
      return jsonResponse(buildLegacyToolboxListPayload());
    }
    if (url === "/api/toolbox" && init?.method === "POST") {
      return jsonResponse(buildLegacyToolboxCreatePayload());
    }
    if (url === "/api/toolbox" && (init?.method === "PUT" || init?.method === "DELETE")) {
      return jsonResponse({ success: true });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installManagedToolboxFetchMock() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/toolbox" && (!init || init.method === undefined)) {
      return jsonResponse(buildManagedToolboxListPayload());
    }
    if (url === "/api/toolbox" && init?.method === "POST") {
      return jsonResponse(buildManagedToolboxCreatePayload());
    }
    if (url === "/api/toolbox" && (init?.method === "PUT" || init?.method === "DELETE")) {
      return jsonResponse({ success: true });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function buildLegacyToolboxListPayload() {
  return {
    success: true,
    data: {
      categories: ["checklist", "assets"],
      items: [
        {
          path: "toolbox/checklist/research-flow.md",
          kind: "checklist",
          title: "Research Flow",
          solves: "Collect source material before drafting",
          url: "",
          tags: ["research", "sources"],
          body: "Review the source list before writing.",
          raw: "# Research Flow",
          modifiedAt: "2026-04-24T08:00:00.000Z",
        },
        {
          path: "toolbox/assets/figma.md",
          kind: "assets",
          title: "Figma",
          solves: "Design and prototype UI",
          url: "https://www.figma.com/",
          tags: ["design"],
          body: "Collaborative design tool.",
          raw: "# Figma",
          modifiedAt: "2026-04-24T08:05:00.000Z",
        },
      ],
    },
  };
}

function buildLegacyToolboxCreatePayload() {
  return {
    success: true,
    data: {
      item: {
        path: "toolbox/checklist/new-tool.md",
        kind: "checklist",
        title: "New Tool",
        solves: "",
        url: "",
        tags: [],
        body: "",
        raw: "# New Tool",
        modifiedAt: "2026-04-24T08:10:00.000Z",
      },
    },
  };
}

function buildManagedToolboxListPayload() {
  return {
    success: true,
    data: {
      page: {
        title: "Toolbox",
        subtitle: "Managed workspace tools",
        defaultMode: "工作流",
        modes: ["工作流", "工具资产"],
        assetCategories: ["全部", "标准资料", "软件"],
      },
      workflows: [
        {
          id: "workflow-1",
          entityType: "workflow",
          title: "Daily Brief",
          summary: "Prepare a short daily brief",
          ratioLabel: "1:1",
          agentName: "Brief Agent",
          accent: "blue",
        },
      ],
      assets: [
        {
          id: "asset-1",
          entityType: "asset",
          title: "Research Kit",
          summary: "Collect source material for article drafts",
          category: "标准资料",
          badge: "标准资料",
          href: "",
          source: {
            type: "managed",
          },
        },
        {
          id: "asset-2",
          entityType: "asset",
          title: "Figma",
          summary: "UI design and prototyping",
          category: "软件",
          badge: "软件",
          href: "https://www.figma.com/",
          source: {
            type: "managed",
          },
        },
      ],
      recentRuns: [
        {
          id: "recent-1",
          agentName: "Brief Agent",
          ranAtLabel: "09:00",
          accent: "blue",
        },
      ],
      favorites: [
        {
          id: "favorite-1",
          title: "Pinned Tool",
          accent: "green",
        },
      ],
    },
  };
}

function buildManagedToolboxCreatePayload() {
  return {
    success: true,
    data: {
      record: {
        id: "asset-new",
        entityType: "asset",
        title: "New Managed Asset",
        summary: "",
        category: "标准资料",
        badge: "标准资料",
        href: "",
        source: {
          type: "managed",
        },
      },
    },
  };
}

function createMockTaskPlanFixture(): { state: MockTaskPlanState } {
  return {
    state: {
      voice: {
        transcript: "\u5f55\u97f3\u540e\u7684\u65b0\u60f3\u6cd5",
        audioPath: null,
        updatedAt: "2026-04-24T08:00:00.000Z",
      },
      statusSummary: "\u4eca\u5929\u5148\u63a8\u8fdb\u53ef\u4ea4\u4ed8\u4efb\u52a1\uff0c\u4e0b\u5348\u96c6\u4e2d\u5904\u7406\u6c9f\u901a\u4e0e\u6574\u7406\u5de5\u4f5c\u3002",
      pool: {
        items: [
          { id: "pool-1", title: "\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 1", priority: "high", source: "\u6587\u5b57\u8f93\u5165" },
          { id: "pool-2", title: "\u6765\u81ea\u540e\u7aef\u7684\u4efb\u52a1\u6c60 2", priority: "mid", source: "AI \u751f\u6210" },
        ],
      },
      schedule: {
        generationId: "task-plan-generation-1",
        revisionId: "schedule-revision-1",
        confirmed: false,
        items: [
          {
            id: "schedule-a",
            title: "\u6765\u81ea\u540e\u7aef\u7684\u6392\u671f A",
            startTime: "09:00",
            priority: "high",
          },
        ],
      },
      roadmap: {
        view: "week",
        windowStart: "2024-06-01",
        topLabel: "\u9886\u57df / \u8de8\u56e2\u961f\u9879\u76ee",
        windowLabel: "2024\u5e746\u6708",
        groups: [
          {
            id: "roadmap-group-1",
            title: "1. \u4ea7\u54c1 & \u8bbe\u8ba1",
            items: [{ id: "roadmap-item-1", title: "\u5de5\u4f5c\u53f0\u6539\u7248" }],
          },
        ],
      },
      morningFlow: {
        voiceDone: true,
        diaryDone: true,
        planningDone: false,
        fineTuneDone: false,
      },
    },
  };
}

function installPendingTaskPlanPoolSaveFetchMock(taskPlan: { state: MockTaskPlanState }): {
  resolvePoolSave: (() => void) | null;
} {
  let resolvePoolSave: (() => void) | null = null;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({ success: true, data: { state: taskPlan.state } });
    }
    if (url === "/api/task-plan/pool" && init?.method === "PUT") {
      const payload = JSON.parse(String(init.body)) as {
        items: Array<{ id: string; title: string; priority: MockTaskPlanPriority; source: MockTaskPlanSource }>;
      };
      await new Promise<void>((resolve) => {
        resolvePoolSave = () => {
          taskPlan.state = { ...taskPlan.state, pool: { items: payload.items } };
          resolve();
        };
      });
      return jsonResponse({ success: true, data: { state: taskPlan.state } });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { resolvePoolSave };
}

function installTaskPlanPoolSaveFetchMock(taskPlan: { state: MockTaskPlanState }): void {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/task-plan/state") {
      return jsonResponse({ success: true, data: { state: taskPlan.state } });
    }
    if (url === "/api/task-plan/pool" && init?.method === "PUT") {
      const payload = JSON.parse(String(init.body)) as {
        items: Array<{
          id: string;
          title: string;
          priority: MockTaskPlanPriority;
          source: MockTaskPlanSource;
          domain?: string;
          project?: string;
        }>;
      };
      taskPlan.state = { ...taskPlan.state, pool: { items: payload.items } };
      return jsonResponse({ success: true, data: { state: taskPlan.state } });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

async function openTaskPoolEditor(page: HTMLElement): Promise<void> {
  page.querySelector<HTMLButtonElement>("[data-workspace-tab='task-pool']")?.click();
  await flush();
  page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]")?.click();
}

function getTaskPlanPoolBusyControls(page: HTMLElement): TaskPlanPoolBusyControls {
  return {
    editToggle: page.querySelector<HTMLButtonElement>("[data-task-plan-pool-edit-toggle]"),
    addButton: page.querySelector<HTMLButtonElement>("[data-task-plan-pool-add]"),
    saveButton: page.querySelector<HTMLButtonElement>("[data-task-plan-pool-save]"),
    removeButton: page.querySelector<HTMLButtonElement>("[data-task-plan-pool-remove='pool-1']"),
    titleInput: page.querySelector<HTMLInputElement>("[data-task-plan-pool-title-input='pool-1']"),
    sourceInput: page.querySelector<HTMLSelectElement>("[data-task-plan-pool-source-input='pool-1']"),
    priorityInput: page.querySelector<HTMLSelectElement>("[data-task-plan-pool-priority-input='pool-1']"),
    filterButton: page.querySelector<HTMLButtonElement>("[data-task-plan-pool-filter='AI 生成']"),
  };
}

function expectTaskPlanPoolControlsDisabled(controls: TaskPlanPoolBusyControls, disabled: boolean): void {
  const elements = [
    controls.editToggle,
    controls.addButton,
    controls.saveButton,
    controls.removeButton,
    controls.titleInput,
    controls.sourceInput,
    controls.priorityInput,
    controls.filterButton,
  ];
  for (const element of elements) {
    expect(element?.disabled).toBe(disabled);
  }
}

function exerciseDisabledTaskPlanPoolControls(controls: TaskPlanPoolBusyControls): void {
  controls.addButton?.click();
  controls.editToggle?.click();
  controls.removeButton?.click();
  controls.filterButton?.click();
  controls.titleInput!.value = "\u4fdd\u5b58\u4e2d\u4e0d\u5e94\u518d\u6539";
  controls.titleInput?.dispatchEvent(new Event("input", { bubbles: true }));
  controls.sourceInput!.value = "\u5de5\u4f5c\u65e5\u5fd7";
  controls.sourceInput?.dispatchEvent(new Event("change", { bubbles: true }));
  controls.priorityInput!.value = "low";
  controls.priorityInput?.dispatchEvent(new Event("change", { bubbles: true }));
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

interface MockDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  setData: (format: string, value: string) => void;
  getData: (format: string) => string;
}

function createMockDataTransfer(): MockDataTransfer {
  const store = new Map<string, string>();
  return {
    effectAllowed: "move",
    dropEffect: "move",
    setData(format: string, value: string) {
      store.set(format, value);
    },
    getData(format: string) {
      return store.get(format) ?? "";
    },
  };
}

function dispatchDragEvent(target: Element, type: string, dataTransfer?: MockDataTransfer): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    dataTransfer?: MockDataTransfer;
  };
  event.dataTransfer = dataTransfer ?? createMockDataTransfer();
  target.dispatchEvent(event);
}

function dispatchGestureEvent(target: Element, type: string, scale: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    scale?: number;
  };
  event.scale = scale;
  target.dispatchEvent(event);
}

function normalizeTaskPlanPriority(value: string): MockTaskPlanPriority {
  return value === "high" || value === "mid" || value === "low" || value === "cool" || value === "neutral"
    ? value
    : "neutral";
}
