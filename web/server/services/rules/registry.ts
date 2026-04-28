import { assetProvenanceRule } from "./asset-provenance.js";
import { imageProvenanceRule } from "./image-provenance.js";
import type { RuleDefinition } from "./types.js";

const builtinRuleRegistry: readonly RuleDefinition[] = [
  assetProvenanceRule,
  imageProvenanceRule,
];
const ruleRegistry: RuleDefinition[] = [];

export function registerRule(rule: RuleDefinition): void {
  ruleRegistry.push(rule);
}

export function clearRuleRegistry(): void {
  ruleRegistry.length = 0;
}

export function getRegisteredRules(): readonly RuleDefinition[] {
  return [...builtinRuleRegistry, ...ruleRegistry];
}
