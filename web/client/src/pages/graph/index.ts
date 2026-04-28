import { renderGraph, type GraphData } from "../../../graph.js";

export function renderGraphPage(): HTMLElement {
  const root = document.createElement("section") as HTMLElement & { __dispose?: () => void };
  root.className = "graph-page";
  root.innerHTML = `
    <section class="graph-stage graph-stage--full">
      <div class="graph-stage__canvas-wrap">
        <div class="graph-stage__overlay">
          <span class="graph-stage__meta" data-graph-status>\u6b63\u5728\u8bfb\u53d6\u56fe\u8c31...</span>
          <button type="button" class="btn btn-secondary btn-inline graph-stage__refresh" data-graph-refresh>\u5237\u65b0</button>
        </div>
        <svg class="graph-stage__canvas" data-graph-canvas></svg>
      </div>
    </section>
  `;
  bindGraphPage(root);
  return root;
}

function bindGraphPage(root: HTMLElement): void {
  let disposeGraph = () => {};
  (root as HTMLElement & { __dispose?: () => void }).__dispose = () => {
    disposeGraph();
  };
  root.querySelector<HTMLButtonElement>("[data-graph-refresh]")?.addEventListener("click", () => {
    void loadGraph(root, (nextDispose) => {
      disposeGraph();
      disposeGraph = nextDispose;
    });
  });
  void loadGraph(root, (nextDispose) => {
    disposeGraph();
    disposeGraph = nextDispose;
  });
}

async function loadGraph(
  root: HTMLElement,
  setDisposeGraph: (dispose: () => void) => void,
): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-graph-status]");
  const svg = root.querySelector<SVGSVGElement>("[data-graph-canvas]");
  if (!status || !svg) {
    return;
  }

  status.textContent = "\u6b63\u5728\u8bfb\u53d6\u56fe\u8c31...";
  try {
    const response = await fetch("/api/graph");
    const data = (await response.json()) as GraphData;
    if (!response.ok || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error("graph load failed");
    }
    setDisposeGraph(renderGraph(svg, data));
    status.textContent = `\u5171 ${data.nodes.length} \u4e2a\u8282\u70b9\uff0c${data.edges.length} \u6761\u8fde\u7ebf`;
  } catch (error) {
    svg.replaceChildren();
    setDisposeGraph(() => {});
    status.textContent = `\u8bfb\u53d6\u5931\u8d25\uff1a${escapeHtml(error instanceof Error ? error.message : String(error))}`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}
