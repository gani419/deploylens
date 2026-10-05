import {
  OFFICIAL_DISCLAIMER,
  MANDATORY_UNVERIFIED_AREAS,
  type ValidationStage,
  type ScanAssessment,
  type Finding,
  type ReadinessStatus,
  type CapabilityReport,
} from '@deploylens/contracts';
import { getRuleRevisionsMap } from '@deploylens/rules';

export function computeAssessment(
  stages: ValidationStage[],
  capabilities: CapabilityReport
): ScanAssessment {
  let blockerCount = 0;
  let warningReviewCount = 0;
  let passedCheckCount = 0;
  let notCheckedCount = 0;
  let notApplicableCount = 0;

  let policyRisks = 0;
  let securityConcerns = 0;
  let qualityRecommendations = 0;
  let manualTestingRequirements = 0;

  const allFindings: Finding[] = [];
  let hasStageError = false;

  for (const stage of stages) {
    if (stage.lifecycle === 'error') {
      hasStageError = true;
    }

    for (const check of stage.checks) {
      if (check.outcome === 'pass') {
        passedCheckCount++;
      } else if (check.outcome === 'fail') {
        blockerCount++;
      } else if (check.outcome === 'needs-review') {
        warningReviewCount++;
      } else if (check.outcome === 'not-checked') {
        notCheckedCount++;
      } else if (check.outcome === 'not-applicable') {
        notApplicableCount++;
      }

      for (const finding of check.findings) {
        allFindings.push(finding);
        if (finding.severity === 'blocker') {
          // already counted in blockerCount
        } else if (finding.severity === 'risk') {
          policyRisks++;
        } else if (finding.severity === 'security') {
          securityConcerns++;
        } else if (finding.severity === 'quality') {
          qualityRecommendations++;
        }
      }
    }
  }

  // Count manual testing items from unverified areas
  manualTestingRequirements = MANDATORY_UNVERIFIED_AREAS.length;

  let status: ReadinessStatus;
  let summary = '';

  if (hasStageError) {
    status = 'INCOMPLETE';
    summary = 'Critical inspection stages could not complete due to execution or parsing errors.';
  } else if (blockerCount > 0) {
    status = 'ACTION REQUIRED';
    summary = `Identified ${blockerCount} submission blocker(s) that require resolution prior to store release.`;
  } else if (warningReviewCount > 0 || notCheckedCount > 0) {
    status = 'REVIEW REQUIRED';
    summary = `No critical blockers detected, but ${warningReviewCount} item(s) require manual review or validation.`;
  } else {
    status = 'PASSED AVAILABLE CHECKS';
    summary = 'All performed checks passed with no detected blockers or unresolved policy flags.';
  }

  const performedCount = passedCheckCount + blockerCount + warningReviewCount;
  const totalPossible = performedCount + notCheckedCount;

  const toolVersionsUsed: Record<string, string> = {};
  for (const [toolName, cap] of Object.entries(capabilities)) {
    if (cap.available && cap.version) {
      toolVersionsUsed[toolName] = cap.version;
    }
  }

  return {
    status,
    summary,
    blockerCount,
    warningReviewCount,
    passedCheckCount,
    notCheckedCount,
    notApplicableCount,
    totalChecksEvaluated: stages.reduce((acc, s) => acc + s.checks.length, 0),
    findingBreakdown: {
      blockers: blockerCount,
      policyRisks,
      securityConcerns,
      qualityRecommendations,
      manualTestingRequirements,
    },
    coverageRatio: {
      performed: performedCount,
      totalPossible: totalPossible > 0 ? totalPossible : 1,
      description: `${performedCount} of ${totalPossible} checks executed (${notCheckedCount} skipped due to missing host capabilities).`,
    },
    unverifiedAreas: MANDATORY_UNVERIFIED_AREAS,
    toolVersionsUsed,
    ruleRevisionsUsed: getRuleRevisionsMap(),
    disclaimer: OFFICIAL_DISCLAIMER,
  };
}
