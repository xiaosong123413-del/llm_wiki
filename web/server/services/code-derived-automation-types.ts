/**
 * Contracts for source-owned automation flow modules.
 *
 * Real automation DAGs live beside the code they describe, but the workspace
 * server still needs one shared seed shape to load them uniformly and turn
 * them into API-ready automation definitions.
 */

import type { AutomationFlow } from "./automation-flow.js";

export interface CodeDerivedAutomationSeed {
  slug: string;
  name: string;
  summary: string;
  icon: string;
  sourcePaths: string[];
  flow: AutomationFlow;
  mermaid?: string;
}

export interface CodeDerivedAutomationModule {
  codeDerivedAutomationSeeds: readonly CodeDerivedAutomationSeed[];
}
