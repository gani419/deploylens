# Rule Authoring Guide

DeployLens uses versioned, evidence-based technical and policy rules bundled with the application.

## Rule Schema

Every rule is defined as an implementation of the `Rule<TMetadata>` interface in `@deploylens/rules`:

```typescript
export interface RuleDefinition {
  id: string;                         // Stable identifier, e.g. "RULE-AND-SDK-001"
  revision: string;                   // Revision version, e.g. "2026.1"
  platform: Platform;                 // 'android' | 'ios'
  category: RuleCategory;             // Categorical classification
  severity: Severity;                 // 'blocker' | 'risk' | 'security' | 'quality' | 'info'
  name: string;                       // Human-readable title
  description: string;                // Concise explanation of the rule
  whyItMatters: string;               // Technical or store policy rationale
  remediation: string;                // Concrete developer steps to resolve
  officialReferenceUrl: string;       // Direct official documentation link
  sourceReviewDate: string;           // ISO date when the rule was last audited (YYYY-MM-DD)
  effectiveDates?: string;            // Applicable policy effective dates (e.g. "August 31, 2024 onwards")
  applicabilityDescription: string;   // Conditions under which this rule applies
  requiredCapabilities: string[];     // Platform tool requirements (e.g. ['zipalign', 'codesign'])
}
```

## Evaluation Contract

The `evaluate` function receives the typed metadata and the current host's capability map:

```typescript
export interface Rule<TMetadata = unknown> extends RuleDefinition {
  evaluate: (ctx: RuleEvaluationContext<TMetadata>) => RuleEvaluationResult;
}

export interface RuleEvaluationResult {
  ruleId: string;
  outcome: 'pass' | 'fail' | 'needs-review' | 'not-checked' | 'not-applicable';
  evidence: string;                   // Factual data extracted from the artifact
  affectedFileOrConfig?: string;      // The target file or manifest key
  applicabilityNote?: string;         // Why rule was skipped or conditional
  isSuspectedHeuristic?: boolean;     // True if finding is a heuristic suspicion
}
```

## Authoring Principles

1. **Evidence-Based**: Every finding must state the exact evidence observed from the build (e.g. `minSdkVersion is 24`, not just "Min SDK is okay").
2. **Never Overclaim**:
   - Never describe `targetSdkVersion` as the maximum supported Android version.
   - If `maxSdkVersion` is absent, report `"maxSdkVersion: Not declared (Recommended)"`.
   - Never claim guaranteed 16 KB runtime compatibility; report `"alignment checks passed"`.
   - Never claim certificate correctness for a store account without expected store console certificate fingerprints.
3. **Missing Tool Discipline**:
   - If a host tool is missing (e.g. `codesign` on non-macOS), return `not-checked`, **never** `pass`.
4. **Offline Resilience**:
   - Rules must be bundled within the application.
   - Do not make runtime network calls to fetch store policies.
5. **Heuristics Labeling**:
   - Flag static heuristic detections with `isSuspectedHeuristic: true`.
