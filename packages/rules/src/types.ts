import type { Platform, Severity, CheckOutcome, Finding } from '@deploylens/contracts';

export type RuleCategory =
  | 'artifact-integrity'
  | 'identity-versioning'
  | 'sdk-compatibility'
  | 'release-configuration'
  | 'signing'
  | 'native-binaries'
  | 'permissions-security'
  | 'packaging'
  | 'privacy-declarations'
  | 'store-policy';

export interface RuleDefinition {
  id: string;
  revision: string;
  platform: Platform;
  category: RuleCategory;
  severity: Severity;
  name: string;
  description: string;
  whyItMatters: string;
  remediation: string;
  officialReferenceUrl: string;
  sourceReviewDate: string; // ISO date e.g. '2026-01-15'
  effectiveDates?: string;
  applicabilityDescription: string;
  requiredCapabilities: string[];
}

export interface RuleEvaluationContext<TMetadata = unknown> {
  metadata: TMetadata;
  toolCapabilities: Record<string, boolean>;
  options?: Record<string, unknown>;
}

export interface RuleEvaluationResult {
  ruleId: string;
  outcome: CheckOutcome;
  evidence: string;
  affectedFileOrConfig?: string;
  applicabilityNote?: string;
  isSuspectedHeuristic?: boolean;
}

export interface Rule<TMetadata = unknown> extends RuleDefinition {
  evaluate: (ctx: RuleEvaluationContext<TMetadata>) => RuleEvaluationResult;
}

export function createFindingFromRule(
  rule: RuleDefinition,
  result: RuleEvaluationResult
): Finding {
  return {
    id: `${rule.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    ruleId: rule.id,
    ruleRevision: rule.revision,
    title: rule.name,
    severity: rule.severity,
    outcome: result.outcome,
    evidence: result.evidence,
    affectedFileOrConfig: result.affectedFileOrConfig,
    whyItMatters: rule.whyItMatters,
    suggestedRemediation: rule.remediation,
    officialReferenceUrl: rule.officialReferenceUrl,
    sourceReviewDate: rule.sourceReviewDate,
    effectiveDates: rule.effectiveDates,
    isSuspectedHeuristic: result.isSuspectedHeuristic,
    applicabilityNote: result.applicabilityNote,
  };
}
