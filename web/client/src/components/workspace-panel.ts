interface WorkspaceResponse {
  success: boolean;
  data?: {
    groups: WorkspaceGroup[];
    pending: PendingWorkItem[];
  };
  error?: string;
}

interface WorkspaceGroup {
  name: string;
  entries: WorkspaceEntry[];
}

interface WorkspaceEntry {
  path: string;
  status: string;
  project: string;
  recommendation: "delete" | "keep";
  reason: string;
  kind: "file" | "directory";
}

interface PendingWorkItem {
  id: string;
  title: string;
  area: string;
  status: "暂缓" | "半成品" | "MVP 后续" | "外部依赖阻塞";
  description: string;
  pausedReason: string;
  nextStep: string;
}

export function renderWorkspacePanel(): HTMLElement {
  const panel = document.createElement("aside");
  panel.className = "project-log-page__workspace";
  panel.dataset.projectWorkspace = "";
  panel.innerHTML = `
    <div class="project-log-page__workspace-header">
      <div>
        <div class="eyebrow">WORKSPACE</div>
        <h2>\u5de5\u4f5c\u533a\u7559\u5b58\u6587\u4ef6</h2>
      </div>
      <button type="button" class="btn btn-secondary btn-inline" data-project-workspace-refresh>\u5237\u65b0</button>
    </div>
    <div class="project-log-page__workspace-copy">\u6309\u9879\u76ee\u5206\u7ec4\u67e5\u770b\u5f53\u524d\u5de5\u4f5c\u533a\u5185\u7684\u6539\u52a8\u3001\u7559\u5b58\u6587\u4ef6\u548c\u5f85\u5b8c\u6210\u4e8b\u9879\u3002</div>
    <div class="project-log-page__workspace-list" data-project-workspace-list>
      <p>\u6b63\u5728\u8bfb\u53d6\u5de5\u4f5c\u533a...</p>
    </div>
  `;

  panel
    .querySelector<HTMLElement>("[data-project-workspace-refresh]")
    ?.addEventListener("click", () => {
      void loadWorkspace(panel);
    });

  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLElement>("[data-workspace-delete]");
    if (!button) return;
    const relPath = button.dataset.workspaceDelete ?? "";
    if (!relPath) return;
    void deleteWorkspacePath(panel, relPath, button);
  });

  void loadWorkspace(panel);
  return panel;
}

async function loadWorkspace(root: HTMLElement): Promise<void> {
  const list = root.querySelector<HTMLElement>("[data-project-workspace-list]")!;
  list.innerHTML = "<p>\u6b63\u5728\u8bfb\u53d6\u5de5\u4f5c\u533a...</p>";

  try {
    const response = await fetch("/api/project-log/workspace");
    const payload = (await readJsonResponse(
      response,
      "\u5de5\u4f5c\u533a\u7559\u5b58\u6587\u4ef6\u63a5\u53e3\u672a\u8fd4\u56de JSON\uff0c\u8bf7\u91cd\u542f WebUI \u540e\u518d\u8bd5\u3002",
    )) as WorkspaceResponse;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "workspace load failed");
    }

    list.innerHTML = renderWorkspaceSections(payload.data.groups, payload.data.pending ?? []);
  } catch (error) {
    list.innerHTML = `<p class="project-log-page__error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

async function deleteWorkspacePath(
  root: HTMLElement,
  relPath: string,
  button: HTMLElement,
): Promise<void> {
  const list = root.querySelector<HTMLElement>("[data-project-workspace-list]")!;
  const originalText = button.textContent;
  button.textContent = "\u5220\u9664\u4e2d...";
  button.setAttribute("disabled", "true");

  try {
    const response = await fetch("/api/project-log/workspace", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: relPath }),
    });
    const payload = (await readJsonResponse(
      response,
      "\u5220\u9664\u63a5\u53e3\u672a\u8fd4\u56de JSON\uff0c\u8bf7\u91cd\u542f WebUI \u540e\u518d\u8bd5\u3002",
    )) as { success: boolean; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? "workspace delete failed");
    }
    await loadWorkspace(root);
  } catch (error) {
    list.insertAdjacentHTML(
      "afterbegin",
      `<p class="project-log-page__error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`,
    );
    button.textContent = originalText ?? "\u5220\u9664";
    button.removeAttribute("disabled");
  }
}

function renderWorkspaceSections(groups: WorkspaceGroup[], pending: PendingWorkItem[]): string {
  if (groups.length === 0 && pending.length === 0) {
    return `<p>\u5f53\u524d\u5de5\u4f5c\u533a\u6ca1\u6709\u989d\u5916\u7559\u5b58\u6587\u4ef6\u3002</p>`;
  }

  const deleteGroups = groups
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.recommendation === "delete") }))
    .filter((group) => group.entries.length > 0);
  const keepGroups = groups
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.recommendation === "keep") }))
    .filter((group) => group.entries.length > 0);

  return [
    renderWorkspaceSection("\u5efa\u8bae\u5220\u9664", deleteGroups, true),
    renderWorkspaceSection("\u5efa\u8bae\u4fdd\u7559", keepGroups, false),
    renderPendingSection(pending),
  ]
    .filter(Boolean)
    .join("");
}

function renderWorkspaceSection(
  title: string,
  groups: WorkspaceGroup[],
  isDanger: boolean,
): string {
  if (groups.length === 0) return "";
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return `
    <details class="project-log-page__workspace-section" ${isDanger ? "open" : ""}>
      <summary class="project-log-page__workspace-section-summary">
        <div>
          <div class="project-log-page__workspace-section-title">${title}</div>
          <div class="project-log-page__workspace-section-count">${total} \u9879</div>
        </div>
        <span class="badge ${isDanger ? "project-log-page__badge-danger" : "project-log-page__badge-keep"}">${title}</span>
      </summary>
      <div class="project-log-page__workspace-section-body">
        ${groups.map(renderWorkspaceGroup).join("")}
      </div>
    </details>
  `;
}

function renderWorkspaceGroup(group: WorkspaceGroup): string {
  const items = group.entries
    .map((entry) => {
      const recommendationLabel =
        entry.recommendation === "delete" ? "\u5efa\u8bae\u5220\u9664" : "\u5efa\u8bae\u4fdd\u7559";
      return `
        <li class="project-log-page__workspace-item">
          <div class="project-log-page__workspace-item-main">
            <div class="project-log-page__workspace-item-path">${escapeHtml(entry.path)}</div>
            <div class="project-log-page__workspace-item-meta">
              <span class="badge">${escapeHtml(entry.status)}</span>
              <span class="badge ${entry.recommendation === "delete" ? "project-log-page__badge-danger" : "project-log-page__badge-keep"}">${recommendationLabel}</span>
            </div>
            <p>${escapeHtml(entry.reason)}</p>
          </div>
          <button type="button" class="btn btn-secondary btn-inline project-log-page__delete" data-workspace-delete="${escapeHtmlAttribute(entry.path)}">\u5220\u9664</button>
        </li>
      `;
    })
    .join("");

  return `
    <section class="project-log-page__workspace-group">
      <header>
        <h3>${escapeHtml(group.name)}</h3>
        <span>${group.entries.length} \u9879</span>
      </header>
      <ul>${items}</ul>
    </section>
  `;
}

function renderPendingSection(items: PendingWorkItem[]): string {
  if (items.length === 0) return "";
  const groups = new Map<string, PendingWorkItem[]>();
  for (const item of items) {
    const bucket = groups.get(item.area) ?? [];
    bucket.push(item);
    groups.set(item.area, bucket);
  }

  return `
    <details class="project-log-page__workspace-section" open>
      <summary class="project-log-page__workspace-section-summary">
        <div>
          <div class="project-log-page__workspace-section-title">\u5f85\u5b8c\u6210</div>
          <div class="project-log-page__workspace-section-count">${items.length} \u9879</div>
        </div>
        <span class="badge project-log-page__badge-pending">\u5f85\u5b8c\u6210</span>
      </summary>
      <div class="project-log-page__workspace-section-body">
        ${[...groups.entries()].map(([area, areaItems]) => renderPendingGroup(area, areaItems)).join("")}
      </div>
    </details>
  `;
}

function renderPendingGroup(area: string, items: PendingWorkItem[]): string {
  return `
    <section class="project-log-page__workspace-group">
      <header>
        <h3>${escapeHtml(area)}</h3>
        <span>${items.length} \u9879</span>
      </header>
      <ul>
        ${items.map(renderPendingItem).join("")}
      </ul>
    </section>
  `;
}

function renderPendingItem(item: PendingWorkItem): string {
  return `
    <li class="project-log-page__workspace-item project-log-page__workspace-item--pending">
      <div class="project-log-page__workspace-item-main">
        <div class="project-log-page__workspace-item-path">${escapeHtml(item.title)}</div>
        <div class="project-log-page__workspace-item-meta">
          <span class="badge project-log-page__badge-pending">${escapeHtml(item.status)}</span>
          <span class="badge">${escapeHtml(item.area)}</span>
        </div>
        <p><strong>\u8fd9\u662f\u4ec0\u4e48\uff1a</strong>${escapeHtml(item.description)}</p>
        <p><strong>\u5f53\u65f6\u4e3a\u4ec0\u4e48\u6682\u505c\uff1a</strong>${escapeHtml(item.pausedReason)}</p>
        <p><strong>\u4e0b\u6b21\u600e\u4e48\u6062\u590d\uff1a</strong>${escapeHtml(item.nextStep)}</p>
      </div>
    </li>
  `;
}

async function readJsonResponse(response: Response, htmlFallbackMessage: string): Promise<unknown> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    if (/<!DOCTYPE html/i.test(raw) || /<html/i.test(raw)) {
      throw new Error(htmlFallbackMessage);
    }
    throw new Error("\u63a5\u53e3\u8fd4\u56de\u4e86\u65e0\u6548\u7684 JSON \u5185\u5bb9\u3002");
  }
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

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
