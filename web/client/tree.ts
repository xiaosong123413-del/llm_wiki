export interface TreeNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: TreeNode[];
}

interface RenderTreeOptions {
  activePath?: string;
  multiSelectEnabled?: boolean;
  selectedPaths?: string[];
  onToggleSelect?: (path: string) => void;
}

export function renderTree(
  container: HTMLElement,
  root: TreeNode,
  onSelect: (path: string) => void,
  options: string | RenderTreeOptions = "",
): void {
  const normalized = normalizeOptions(options);
  container.innerHTML = "";
  const ul = document.createElement("ul");
  renderNode(ul, root, onSelect, normalized, true);
  container.appendChild(ul);
}

function renderNode(
  parent: HTMLElement,
  node: TreeNode,
  onSelect: (path: string) => void,
  options: Required<RenderTreeOptions>,
  isRoot: boolean,
): void {
  if (node.kind === "dir") {
    const branch = document.createElement("ul");
    branch.dataset.branchPath = node.path;

    if (!isRoot) {
      const li = document.createElement("li");
      li.className = "tree-dir-row";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tree-dir";
      toggle.dataset.dirPath = node.path;
      toggle.setAttribute("aria-expanded", "true");
      toggle.innerHTML = `
        <span class="tree-dir__caret" aria-hidden="true">▾</span>
        <span class="tree-dir__label">${escapeHtml(node.name)}</span>
      `;
      toggle.addEventListener("click", () => {
        const nextExpanded = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
        branch.hidden = !nextExpanded;
      });

      li.appendChild(toggle);
      parent.appendChild(li);
    }

    for (const child of node.children ?? []) {
      renderNode(branch, child, onSelect, options, false);
    }
    parent.appendChild(branch);
    return;
  }

  const li = document.createElement("li");
  if (options.multiSelectEnabled) {
    const label = document.createElement("label");
    label.className = "tree-file-row";
    label.dataset.rowPath = node.path;
    if (options.selectedPaths.includes(node.path)) {
      label.classList.add("selected");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = options.selectedPaths.includes(node.path);
    checkbox.dataset.selectPath = node.path;
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    label.addEventListener("click", (event) => {
      event.preventDefault();
      options.onToggleSelect(node.path);
    });

    const text = document.createElement("span");
    text.className = "tree-file-row__text";
    text.textContent = node.name;

    label.appendChild(checkbox);
    label.appendChild(text);
    li.appendChild(label);
    parent.appendChild(li);
    return;
  }

  const a = document.createElement("a");
  a.href = `/?page=${encodeURIComponent(node.path)}`;
  a.textContent = node.name;
  a.setAttribute("data-path", node.path);
  if (node.path === options.activePath) {
    a.classList.add("active");
  }
  a.addEventListener("click", (e) => {
    e.preventDefault();
    onSelect(node.path);
  });
  li.appendChild(a);
  parent.appendChild(li);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeOptions(options: string | RenderTreeOptions): Required<RenderTreeOptions> {
  if (typeof options === "string") {
    return {
      activePath: options,
      multiSelectEnabled: false,
      selectedPaths: [],
      onToggleSelect: () => {},
    };
  }

  return {
    activePath: options.activePath ?? "",
    multiSelectEnabled: options.multiSelectEnabled ?? false,
    selectedPaths: options.selectedPaths ?? [],
    onToggleSelect: options.onToggleSelect ?? (() => {}),
  };
}
