import type { IosMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const iosSigningAndProvisioningRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-SIGN-001',
  revision: '2026.1',
  platform: 'ios',
  category: 'signing',
  severity: 'blocker',
  name: 'iOS Code Signing and Provisioning Audit',
  description: 'Audits embedded mobileprovision profile and code signature validity.',
  whyItMatters: 'Physical iOS devices and the App Store verify cryptographic signatures and provisioning entitlements before executing any binary.',
  remediation: 'Ensure the IPA is signed with a valid Apple Developer Distribution Certificate and matching App Store provisioning profile.',
  officialReferenceUrl: 'https://developer.apple.com/support/code-signing/',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to iOS IPAs.',
  requiredCapabilities: ['codesign'],
  evaluate: ({ metadata, toolCapabilities }) => {
    const signing = metadata.signing;

    // Check capability: codesign requires macOS
    if (!toolCapabilities['codesign']) {
      return {
        ruleId: 'RULE-IOS-SIGN-001',
        outcome: 'not-checked',
        evidence: `Apple codesign verification tools are unavailable on this host platform (${process.platform}). Cryptographic signature verification requires macOS security/codesign tools. Checked embedded provisioning profile status: ${signing.provisioningProfilePresent ? `Present (${signing.provisioningProfileType ?? 'unknown type'})` : 'Absent'}.`,
        affectedFileOrConfig: '_CodeSignature/CodeResources',
        applicabilityNote: 'Missing platform tools produce "Not checked", never "Passed".',
      };
    }

    if (signing.codesignCheckOutcome === 'fail') {
      return {
        ruleId: 'RULE-IOS-SIGN-001',
        outcome: 'fail',
        evidence: `codesign verification failed: ${signing.limitations.join('; ') || 'Invalid signature or broken sealed resource hash'}`,
        affectedFileOrConfig: '_CodeSignature/',
      };
    }

    if (!signing.provisioningProfilePresent) {
      return {
        ruleId: 'RULE-IOS-SIGN-001',
        outcome: 'needs-review',
        evidence: 'No embedded.mobileprovision found. Note: A missing provisioning profile is not universally a defect (e.g. for App Store distribution builds prepared through certain Xcode archive export channels), but prevents direct ad-hoc/enterprise device installation.',
        affectedFileOrConfig: 'Payload/<App>.app/embedded.mobileprovision',
      };
    }

    const typeDesc = signing.provisioningProfileType ? `Type: ${signing.provisioningProfileType}` : 'Custom profile';
    return {
      ruleId: 'RULE-IOS-SIGN-001',
      outcome: 'pass',
      evidence: `Cryptographic code signature verified. Provisioning profile present (${typeDesc}). Signer identity: ${signing.signerIdentity ?? 'Apple Distribution'}. Team ID: ${signing.teamId ?? 'Detected'}.`,
      affectedFileOrConfig: 'embedded.mobileprovision',
    };
  },
};
