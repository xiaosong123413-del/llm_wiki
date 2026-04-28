type RuleSeverity = "error" | "warn" | "suggest";

export interface RuleContext {
  wikiRoot: string;
  projectRoot: string;
}

export interface RuleIssue {
  id: string;
  ruleId: string;
  severity: RuleSeverity;
  title: string;
  detail: string;
  createdAt: string;
  target?: string;
}

export interface RuleDefinition {
  id: string;
  run(context: RuleContext): RuleIssue[];
}
