import { getRegisteredRules } from "./rules/registry.js";
import type { RuleContext, RuleIssue } from "./rules/types.js";

export function runRules(context: RuleContext): RuleIssue[] {
  return getRegisteredRules().flatMap((rule) => rule.run(context));
}
