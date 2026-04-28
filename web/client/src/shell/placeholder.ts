import { renderIcon } from "../components/icon.js";

const COPY: Record<string, { title: string; copy: string }> = {
  check: {
    title: "\u68c0\u67e5 \u00b7 \u5373\u5c06\u63a8\u51fa",
    copy: "\u5c06\u5728 Phase 4 \u4e0a\u7ebf\uff1a\u8fd0\u884c lint\uff0c\u5b9e\u65f6\u67e5\u770b\u65e5\u5fd7\u5e76\u5c06\u95ee\u9898\u6c47\u5165\u5ba1\u67e5\u3002",
  },
  sync: {
    title: "\u540c\u6b65 \u00b7 \u5373\u5c06\u63a8\u51fa",
    copy: "\u5c06\u5728 Phase 4 \u4e0a\u7ebf\uff1a\u4e00\u952e\u540c\u6b65\u6e90\u76ee\u5f55\u5e76\u91cd\u65b0\u7f16\u8bd1 wiki\u3002",
  },
  review: {
    title: "\u5ba1\u67e5 \u00b7 \u5373\u5c06\u63a8\u51fa",
    copy: "\u5c06\u5728 Phase 5 \u4e0a\u7ebf\uff1a\u6c47\u603b lint\u3001\u540c\u6b65\u5931\u8d25\u548c\u7cfb\u7edf\u68c0\u67e5\u4e2d\u9700\u8981\u786e\u8ba4\u7684\u6761\u76ee\u3002",
  },
  settings: {
    title: "\u8bbe\u7f6e \u00b7 \u5373\u5c06\u63a8\u51fa",
    copy: "\u5c06\u5728 Phase 6 \u4e0a\u7ebf\uff1a\u4ed3\u5e93\u3001\u6a21\u578b\u3001\u641c\u7d22\u3001\u5916\u89c2\u56db\u7c7b\u8bbe\u7f6e\u3002",
  },
};

export function renderPlaceholder(routeName: string): HTMLElement {
  const info = COPY[routeName] ?? { title: "\u5373\u5c06\u63a8\u51fa", copy: "" };
  const root = document.createElement("div");
  root.className = "shell-placeholder";
  root.innerHTML = `
    <div class="shell-placeholder__card">
      <div class="shell-placeholder__icon">${renderIcon("hammer", { size: 32 })}</div>
      <h2 class="shell-placeholder__title">${escapeHtml(info.title)}</h2>
      <p class="shell-placeholder__copy">${escapeHtml(info.copy)}</p>
    </div>
  `;
  return root;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
