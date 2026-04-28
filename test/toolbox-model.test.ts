/**
 * Toolbox state helper regression tests.
 *
 * These tests pin the draft-mapping behavior for managed workspace toolbox
 * records so `fallow` can attribute direct coverage to the model helpers before
 * any further refactors.
 */

import { describe, expect, it } from "vitest";
import {
  createReadyToolboxState,
  openToolboxManager,
} from "../web/client/src/pages/workspace/toolbox/model.js";
import {
  createAssetDraft,
  createWorkflowDraft,
} from "../web/client/src/pages/workspace/toolbox/drafts.js";
import type {
  ToolboxAssetRecord,
  ToolboxPageData,
  ToolboxWorkflowRecord,
} from "../web/client/src/pages/workspace/toolbox/types.js";

describe("toolbox model", () => {
  it("maps workflow records into workflow manager drafts", () => {
    const workflow: ToolboxWorkflowRecord = {
      id: "research-flow",
      entityType: "workflow",
      title: "资料收集流",
      summary: "抓取资料并整理结构化结论",
      ratioLabel: "16:9",
      agentName: "收集 Agent",
      accent: "green",
    };

    expect(createWorkflowDraft(workflow)).toEqual({
      id: "research-flow",
      entityType: "workflow",
      title: "资料收集流",
      summary: "抓取资料并整理结构化结论",
      category: "",
      badge: "",
      href: "",
      ratioLabel: "16:9",
      agentName: "收集 Agent",
      accent: "green",
      sourceType: "managed",
    });
  });

  it("maps asset records into asset manager drafts and keeps their source type", () => {
    const asset: ToolboxAssetRecord = {
      id: "figma",
      entityType: "asset",
      title: "Figma",
      summary: "设计协作入口",
      category: "软件",
      badge: "设计",
      href: "https://www.figma.com",
      source: {
        type: "legacy-markdown",
        path: "工具箱/网站软件/Figma.md",
      },
    };

    expect(createAssetDraft(asset)).toEqual({
      id: "figma",
      entityType: "asset",
      title: "Figma",
      summary: "设计协作入口",
      category: "软件",
      badge: "设计",
      href: "https://www.figma.com",
      ratioLabel: "",
      agentName: "",
      accent: "blue",
      sourceType: "legacy-markdown",
    });
  });

  it("prefers editable managed assets when opening the asset manager", () => {
    const state = createReadyToolboxState(createPageData());
    const nextState = openToolboxManager(state, "asset");

    expect(nextState.manager.openSection).toBe("asset");
    expect(nextState.manager.selectedId).toBe("managed-asset");
    expect(nextState.manager.draft).toEqual({
      id: "managed-asset",
      entityType: "asset",
      title: "周报模板",
      summary: "每周同步模板",
      category: "模板",
      badge: "模板",
      href: "",
      ratioLabel: "",
      agentName: "",
      accent: "blue",
      sourceType: "managed",
    });
  });
});

function createPageData(): ToolboxPageData {
  return {
    page: {
      title: "工具箱",
      subtitle: "工作流与资产",
      defaultMode: "工作流",
      modes: ["工作流", "工具资产"],
      assetCategories: ["全部", "模板", "软件"],
    },
    workflows: [
      {
        id: "research-flow",
        entityType: "workflow",
        title: "资料收集流",
        summary: "抓取资料并整理结构化结论",
        ratioLabel: "16:9",
        agentName: "收集 Agent",
        accent: "green",
      },
    ],
    assets: [
      {
        id: "legacy-asset",
        entityType: "asset",
        title: "Figma",
        summary: "设计协作入口",
        category: "软件",
        badge: "设计",
        href: "https://www.figma.com",
        source: {
          type: "legacy-markdown",
          path: "工具箱/网站软件/Figma.md",
        },
      },
      {
        id: "managed-asset",
        entityType: "asset",
        title: "周报模板",
        summary: "每周同步模板",
        category: "模板",
        badge: "模板",
        href: "",
        source: {
          type: "managed",
        },
      },
    ],
    recentRuns: [],
    favorites: [],
  };
}
