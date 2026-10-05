export type Severity = 'blocker' | 'risk' | 'security' | 'quality' | 'info';

export type CheckOutcome = 'pass' | 'fail' | 'needs-review' | 'not-checked' | 'not-applicable';

export interface Finding {
  id: string;
  ruleId: string;
  ruleRevision: string;
  title: string;
  severity: Severity;
  outcome: CheckOutcome;
  evidence: string;
  affectedFileOrConfig?: string;
  whyItMatters: string;
  suggestedRemediation: string;
  officialReferenceUrl?: string;
  sourceReviewDate?: string;
  effectiveDates?: string;
  isSuspectedHeuristic?: boolean;
  applicabilityNote?: string;
}

export interface CheckResult {
  checkId: string;
  name: string;
  outcome: CheckOutcome;
  findings: Finding[];
  details?: string;
}
