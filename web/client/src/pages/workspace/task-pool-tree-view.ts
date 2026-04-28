/**
 * DOM-string rendering helpers for the workspace task-pool tree.
 *
 * The workspace page owns fetch state and event binding, while this module owns the
 * tree-specific markup contract. Keeping the sidebar, zoom area, and hierarchy DOM
 * together here reduces the size of `index.ts` and gives tests a stable set of
 * hooks for tree rendering without changing how the shared task pool is stored.
 */
import type { TaskPlanPoolItem } from "./index.js";
import {
  buildTaskPoolTreeHierarchy,
  filterTaskPoolTreeItems,
  getTaskPoolProjectOptionKey,
  getTaskPoolTreeOptions,
  type TaskPoolTreeDomainNode,
  type TaskPoolTreeLevel,
  type TaskPoolTreeNodeIdentity,
  type TaskPoolTreeOption,
  type TaskPoolTreeProjectNode,
  type TaskPoolTreeTaskNode,
} from "./task-pool-tree-model.js";

export interface TaskPoolTreeRenderState {
  readonly level: TaskPoolTreeLevel;
  readonly selectedOptions: readonly string[];
  readonly isSidebarCollapsed: boolean;
  readonly zoomPercent: number;
  readonly isEditorEnabled: boolean;
  readonly selectedNode: TaskPoolTreeNodeIdentity | null;
  readonly editingNode: TaskPoolTreeNodeIdentity | null;
  readonly editValue: string;
  readonly draggingTaskId: string | null;
  readonly dropProjectKey: string | null;
  readonly dirty: boolean;
}

/**
 * Renders the full task-pool tree layout, including sidebar controls and canvas.
 */
export function renderTaskPoolTreeLayout(
  items: readonly TaskPlanPoolItem[],
  renderState: TaskPoolTreeRenderState,
): string {
  const options = getTaskPoolTreeOptions(items, renderState.level);
  return `
    <section class="workspace-task-pool-tree" data-task-pool-tree-layout>
      <aside class="workspace-task-pool-tree__sidebar${renderState.isSidebarCollapsed ? " is-collapsed" : ""}" data-task-pool-tree-sidebar>
        <div class="workspace-task-pool-tree__sidebar-head">
          <span>筛选</span>
          <button type="button" class="workspace-task-pool-tree__toggle" data-task-pool-tree-sidebar-toggle>${renderState.isSidebarCollapsed ? "›" : "‹"}</button>
        </div>
        <div class="workspace-task-pool-tree__sidebar-body">
          <div class="workspace-task-pool-tree__section">
            <div class="workspace-task-pool-tree__section-head">
              <span>视图层级</span>
              <div class="workspace-task-pool-tree__levels">
                ${renderTaskPoolTreeLevelButton("domain", "领域", renderState.level)}
                ${renderTaskPoolTreeLevelButton("project", "项目", renderState.level)}
                ${renderTaskPoolTreeLevelButton("task", "任务", renderState.level)}
              </div>
            </div>
            <div class="workspace-task-pool-tree__options" data-task-pool-tree-options>
              ${renderTaskPoolTreeOptions(options, renderState.selectedOptions)}
            </div>
          </div>
          <div class="workspace-task-pool-tree__section">
            <span class="workspace-task-pool-tree__legend-title">层级颜色</span>
            <div class="workspace-task-pool-tree__legend"><span class="workspace-task-pool-tree__legend-dot workspace-task-pool-tree__legend-dot--domain"></span><span>领域</span></div>
            <div class="workspace-task-pool-tree__legend"><span class="workspace-task-pool-tree__legend-dot workspace-task-pool-tree__legend-dot--project"></span><span>项目</span></div>
            <div class="workspace-task-pool-tree__legend"><span class="workspace-task-pool-tree__legend-dot workspace-task-pool-tree__legend-dot--task"></span><span>任务</span></div>
          </div>
        </div>
      </aside>
        <div class="workspace-task-pool-tree__resize panel-resize-handle" data-task-pool-tree-resize ${renderState.isSidebarCollapsed ? "hidden" : ""}></div>
      <div class="workspace-task-pool-tree__stage">
        <div class="workspace-task-pool-tree__canvas-wrap" data-task-pool-tree-canvas-wrap>
          <div class="workspace-task-pool-tree__canvas" data-task-pool-tree-canvas style="--task-pool-zoom:${renderState.zoomPercent / 100};">
            <div class="workspace-task-pool-tree__save-indicator" data-task-pool-tree-save-indicator>${renderTaskPoolTreeSaveIndicator(renderState)}</div>
            ${renderTaskPoolTreeCanvas(items, renderState)}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTaskPoolTreeLevelButton(
  level: TaskPoolTreeLevel,
  label: string,
  activeLevel: TaskPoolTreeLevel,
): string {
  const active = level === activeLevel;
  return `
    <button
      type="button"
      class="workspace-task-pool-tree__level${active ? " is-active" : ""}"
      data-task-pool-tree-level="${level}"
      data-active="${active ? "true" : "false"}"
    >${label}</button>
  `;
}

function renderTaskPoolTreeOptions(
  options: readonly TaskPoolTreeOption[],
  selectedOptions: readonly string[],
): string {
  return options
    .map((option) => `
      <label class="workspace-task-pool-tree__option">
        <input
          type="checkbox"
          data-task-pool-tree-option="${escapeHtml(option.key)}"
          ${selectedOptions.includes(option.key) ? "checked" : ""}
        />
        <span>${escapeHtml(option.label)}</span>
      </label>
    `)
    .join("");
}

function renderTaskPoolTreeCanvas(
  items: readonly TaskPlanPoolItem[],
  renderState: TaskPoolTreeRenderState,
): string {
  const visibleItems = filterTaskPoolTreeItems(
    items,
    renderState.level,
    renderState.selectedOptions,
  );
  const hierarchy = buildTaskPoolTreeHierarchy(visibleItems);
  return `
    <div class="workspace-task-pool-tree__map">
      <div class="workspace-task-pool-tree__root" data-task-pool-tree-root>共享任务池</div>
      <div class="workspace-task-pool-tree__branches">
        ${hierarchy.map((domain) => renderTaskPoolTreeDomain(domain, renderState)).join("")}
      </div>
    </div>
  `;
}

function renderTaskPoolTreeSaveIndicator(renderState: TaskPoolTreeRenderState): string {
  if (!renderState.isEditorEnabled) {
    return "树状图只读预览";
  }
  return renderState.dirty ? "树状图有未保存更改" : "通过顶部保存按钮同步共享任务池";
}

function renderTaskPoolTreeDomain(
  domain: TaskPoolTreeDomainNode,
  renderState: TaskPoolTreeRenderState,
): string {
  const nodeIdentity: TaskPoolTreeNodeIdentity = {
    type: "domain",
    domain: domain.label,
    project: "",
    taskId: null,
  };
  const selected = isSelectedTaskPoolTreeNode(renderState.selectedNode, nodeIdentity);
  const editing = isSelectedTaskPoolTreeNode(renderState.editingNode, nodeIdentity);
  return `
    <div class="workspace-task-pool-tree__domain-group">
      <div
        class="workspace-task-pool-tree__node workspace-task-pool-tree__node--domain${selected ? " is-selected" : ""}${editing ? " is-editing" : ""}"
        data-task-pool-tree-node
        data-task-pool-tree-node-type="domain"
        data-task-pool-tree-node-domain="${escapeHtml(domain.label)}"
        tabindex="0"
      >${renderTaskPoolTreeNodeContent(domain.label, editing, renderState.editValue)}</div>
      ${
        renderState.level === "domain"
          ? ""
          : `<div class="workspace-task-pool-tree__project-list">${domain.projects
              .map((project) => renderTaskPoolTreeProject(project, renderState))
              .join("")}</div>`
      }
    </div>
  `;
}

function renderTaskPoolTreeProject(
  project: TaskPoolTreeProjectNode,
  renderState: TaskPoolTreeRenderState,
): string {
  return `
    <div class="workspace-task-pool-tree__project-group">
      ${renderTaskPoolTreeProjectNode(project, renderState)}
      ${
        renderState.level === "task"
          ? `<div class="workspace-task-pool-tree__task-list">${project.tasks
              .map((task) => renderTaskPoolTreeTaskNode(task, renderState))
              .join("")}</div>`
          : ""
      }
    </div>
  `;
}

function renderTaskPoolTreeProjectNode(
  project: TaskPoolTreeProjectNode,
  renderState: TaskPoolTreeRenderState,
): string {
  const nodeIdentity: TaskPoolTreeNodeIdentity = {
    type: "project",
    domain: project.domain,
    project: project.label,
    taskId: null,
  };
  const selected = isSelectedTaskPoolTreeNode(renderState.selectedNode, nodeIdentity);
  const editing = isSelectedTaskPoolTreeNode(renderState.editingNode, nodeIdentity);
  const isDropTarget =
    renderState.dropProjectKey === getTaskPoolProjectOptionKey(project.domain, project.label);
  return `
    <div
      class="workspace-task-pool-tree__node workspace-task-pool-tree__node--project${selected ? " is-selected" : ""}${editing ? " is-editing" : ""}${isDropTarget ? " is-drop-target" : ""}"
      data-task-pool-tree-node
      data-task-pool-tree-node-type="project"
      data-task-pool-tree-node-domain="${escapeHtml(project.domain)}"
      data-task-pool-tree-node-project="${escapeHtml(project.label)}"
      tabindex="0"
    >${renderTaskPoolTreeNodeContent(project.label, editing, renderState.editValue)}</div>
  `;
}

function renderTaskPoolTreeTaskNode(
  task: TaskPoolTreeTaskNode,
  renderState: TaskPoolTreeRenderState,
): string {
  const selected = isSelectedTaskPoolTreeNode(renderState.selectedNode, {
    type: "task",
    domain: task.domain,
    project: task.project,
    taskId: task.id,
  });
  const editing = isSelectedTaskPoolTreeNode(renderState.editingNode, {
    type: "task",
    domain: task.domain,
    project: task.project,
    taskId: task.id,
  });
  const isDragging = renderState.draggingTaskId === task.id;
  return `
    <div
      class="workspace-task-pool-tree__task${selected ? " is-selected" : ""}${editing ? " is-editing" : ""}${isDragging ? " is-dragging" : ""}"
      data-task-pool-tree-node
      data-task-pool-tree-node-type="task"
      data-task-pool-tree-node-domain="${escapeHtml(task.domain)}"
      data-task-pool-tree-node-project="${escapeHtml(task.project)}"
      data-task-pool-tree-node-task-id="${escapeHtml(task.id)}"
      ${renderState.isEditorEnabled ? 'draggable="true"' : ""}
      tabindex="0"
    >${renderTaskPoolTreeNodeContent(task.title, editing, renderState.editValue)}</div>
  `;
}

function renderTaskPoolTreeNodeContent(
  label: string,
  editing: boolean,
  editValue: string,
): string {
  if (!editing) {
    return escapeHtml(label);
  }
  return `<input class="workspace-task-pool-tree__edit-input" data-task-pool-tree-edit-input value="${escapeHtml(editValue)}" />`;
}

function isSelectedTaskPoolTreeNode(
  selectedNode: TaskPoolTreeNodeIdentity | null,
  candidateNode: TaskPoolTreeNodeIdentity,
): boolean {
  return Boolean(
    selectedNode &&
      selectedNode.type === candidateNode.type &&
      selectedNode.domain === candidateNode.domain &&
      selectedNode.project === candidateNode.project &&
      selectedNode.taskId === candidateNode.taskId,
  );
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
