import { describe, expect, it } from "vitest";
import {
  buildAutomationCommentAnchors,
  layoutAutomationFlow,
  type AutomationFlowDetail,
} from "../web/client/src/pages/automation/flow-layout.js";

describe("automation flow layout", () => {
  it("keeps the trigger at the top and applies branch offsets to whole branch groups", () => {
    const detail = createDetailFixture();
    const initial = layoutAutomationFlow(detail, {});
    const moved = layoutAutomationFlow(detail, {
      branchOffsets: {
        "content-branches": { x: 40, y: 24 },
      },
    });

    expect(initial.nodes.trigger.y).toBeLessThan(initial.nodes.left.y);
    expect(initial.nodes.trigger.y).toBeLessThan(initial.nodes.right.y);
    expect(moved.nodes.left.x).toBeGreaterThan(initial.nodes.left.x);
    expect(moved.nodes.left.y).toBeGreaterThan(initial.nodes.left.y);
    expect(moved.nodes.right.x).toBeGreaterThan(initial.nodes.right.x);
    expect(moved.nodes.merge.x).toBe(initial.nodes.merge.x);
  });

  it("adds extra vertical spacing for tall cards so successive levels do not collapse together", () => {
    const detail = createDetailFixture();
    detail.nodes = detail.nodes.map((node) => (
      node.id === "left"
        ? {
            ...node,
            description: "这是一个非常长的描述，用来模拟真实自动化详情页里很长的步骤说明、提示词摘要和上下文信息，确保布局会为高卡片预留额外的垂直空间。",
            appLabel: "小红书决策笔记助手",
            modelLabel: "应用模型 · relay / claude-sonnet-4-20250514",
          }
        : node
    ));

    const layout = layoutAutomationFlow(detail, {});

    expect(layout.nodes.left.y - layout.nodes.branch.y).toBeGreaterThan(180);
    expect(layout.nodes.merge.y - layout.nodes.left.y).toBeGreaterThan(180);
  });

  it("recomputes comment anchors from moved nodes and edges", () => {
    const detail = createDetailFixture();
    const layout = layoutAutomationFlow(detail, {
      branchOffsets: {
        "content-branches": { x: 32, y: 16 },
      },
    });
    const anchors = buildAutomationCommentAnchors(layout, [
      {
        id: "comment-node",
        automationId: "daily-sync",
        targetType: "node",
        targetId: "left",
        text: "node comment",
        createdAt: "2026-04-25T00:00:00.000Z",
      },
      {
        id: "comment-edge",
        automationId: "daily-sync",
        targetType: "edge",
        targetId: "edge-left-merge",
        text: "edge comment",
        createdAt: "2026-04-25T00:00:00.000Z",
      },
    ]);

    expect(anchors["comment-node"]).toEqual({
      x: layout.nodes.left.x,
      y: layout.nodes.left.y,
    });
    expect(anchors["comment-edge"].x).toBeGreaterThan(layout.nodes.left.x);
    expect(anchors["comment-edge"].y).toBeGreaterThan(layout.nodes.left.y);
  });

  it("returns arrow path geometry for each edge so the detail page can render directional connectors", () => {
    const detail = createDetailFixture();
    const layout = layoutAutomationFlow(detail, {});
    const connector = layout.edges["edge-trigger-branch"];

    expect(connector.path).toContain("M");
    expect(connector.path).toContain("L");
    expect(connector.startY).toBeLessThan(connector.endY);
    expect(connector.y).toBeGreaterThan(connector.startY);
    expect(connector.y).toBeLessThan(connector.endY);
  });

  it("keeps parallel branch cards separated even when both cards are wide and tall", () => {
    const detail = createDetailFixture();
    detail.nodes = detail.nodes.map((node) => (
      node.type === "action"
        ? {
            ...node,
            title: "这是一个很长的分支标题，用来验证分支卡片不会再横向挤在一起",
            description: "这是一个更长的说明，用来模拟真实页面里节点说明、应用信息和模型信息叠加后的卡片宽高占用。",
            appLabel: "超长应用名称示例",
            modelLabel: "跟随默认模型 · openai / 一个很长的模型名称示例",
          }
        : node
    ));

    const layout = layoutAutomationFlow(detail, {});

    expect(layout.nodes.right.x - layout.nodes.left.x).toBeGreaterThan(320);
  });
});

function createDetailFixture(): AutomationFlowDetail {
  return {
    nodes: [
      { id: "trigger", type: "trigger", title: "触发器", description: "触发", modelLabel: "" },
      { id: "branch", type: "branch", title: "分支", description: "分流", modelLabel: "" },
      { id: "left", type: "action", title: "左分支", description: "左侧", appLabel: "", modelLabel: "" },
      { id: "right", type: "action", title: "右分支", description: "右侧", appLabel: "", modelLabel: "" },
      { id: "merge", type: "merge", title: "汇总", description: "汇总", modelLabel: "" },
    ],
    edges: [
      { id: "edge-trigger-branch", source: "trigger", target: "branch" },
      { id: "edge-branch-left", source: "branch", target: "left" },
      { id: "edge-branch-right", source: "branch", target: "right" },
      { id: "edge-left-merge", source: "left", target: "merge" },
      { id: "edge-right-merge", source: "right", target: "merge" },
    ],
    branches: [
      {
        id: "content-branches",
        title: "内容分支",
        sourceNodeId: "branch",
        mergeNodeId: "merge",
        nodeIds: ["left", "right"],
      },
    ],
  };
}
