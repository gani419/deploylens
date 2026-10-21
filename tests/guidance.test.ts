import { describe, expect, it } from 'vitest';
import { createFindingFromRule, androidAabSigningRule, iosBuildSdkRule, iosSigningAndProvisioningRule, explainFinding } from '@deploylens/rules';

describe('Actionable finding descriptions', () => {
  it('includes explanation and verification steps in exported rule findings', () => {
    const finding = createFindingFromRule(androidAabSigningRule, { ruleId: androidAabSigningRule.id, outcome: 'fail', evidence: 'JAR verification failed.' });
    expect(finding.guidance?.meaning).toContain('found an issue');
    expect(finding.guidance?.steps.join(' ')).toContain('jarsigner');
    expect(finding.guidance?.verification.join(' ')).toContain('Play Console');
    expect(finding.guidance?.limitation).toContain('correct upload key');
  });
  it('does not describe missing tooling as a broken build', () => {
    const finding = createFindingFromRule(iosSigningAndProvisioningRule, { ruleId: iosSigningAndProvisioningRule.id, outcome: 'not-checked', evidence: 'macOS unavailable.' });
    expect(finding.guidance?.meaning).toContain('verification gap');
    expect(finding.guidance?.steps.join(' ')).toContain('macOS');
  });
  it('explains review as a decision and distinguishes SDK from minimum OS', () => {
    expect(explainFinding('RULE-AND-SEC-002', 'needs-review', 'Review permissions').meaning).toContain('not a confirmed rejection');
    const finding = createFindingFromRule(iosBuildSdkRule, { ruleId: iosBuildSdkRule.id, outcome: 'fail', evidence: 'Old SDK.' });
    expect(finding.guidance?.steps.join(' ')).toContain('MinimumOSVersion');
    expect(finding.guidance?.verification.join(' ')).toContain('DTSDKName');
  });
});
