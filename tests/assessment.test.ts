import { describe, expect, it } from 'vitest';
import { computeAssessment } from '@deploylens/core';
import type { ValidationStage, CapabilityReport } from '@deploylens/contracts';

describe('Evidence-based assessments', () => {
  it('never calls an empty scan successful', () => {
    expect(computeAssessment([], {} as CapabilityReport).status).toBe('INCOMPLETE');
  });
  it('counts only actionable findings as risks', () => {
    const stage = { lifecycle: 'completed', checks: [{ outcome: 'pass', findings: [{ severity: 'risk', outcome: 'pass' }] }] } as ValidationStage;
    expect(computeAssessment([stage], {} as CapabilityReport).findingBreakdown.policyRisks).toBe(0);
  });
  it('keeps skipped verification visible in the verdict', () => {
    const stage = { lifecycle: 'completed', checks: [{ outcome: 'not-checked', findings: [] }] } as unknown as ValidationStage;
    expect(computeAssessment([stage], {} as CapabilityReport).status).toBe('REVIEW REQUIRED');
  });
});
