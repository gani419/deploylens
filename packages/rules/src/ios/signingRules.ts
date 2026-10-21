import type { IosMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const iosSigningAndProvisioningRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-SIGN-001',
  revision: '2026.10',
  platform: 'ios',
  category: 'signing',
  severity: 'blocker',
  name: 'iOS Code Signing and Provisioning Audit',
  description: 'Audits embedded mobileprovision profile and code signature validity.',
  whyItMatters: 'Physical iOS devices and the App Store verify cryptographic signatures and provisioning entitlements before executing any binary.',
  remediation: 'Ensure the IPA is signed with a valid Apple Developer Distribution Certificate and matching App Store provisioning profile.',
  officialReferenceUrl: 'https://developer.apple.com/support/code-signing/',
  sourceReviewDate: '2026-10-21',
  applicabilityDescription: 'Applies to iOS IPAs.',
  requiredCapabilities: ['codesign'],
  evaluate: ({ metadata, toolCapabilities }) => {
    const signing = metadata.signing;

    const failure = !signing.isSigned ? 'No code signature found in the main app bundle.'
      : signing.entitlements?.['get-task-allow'] === true ? 'Development debugging entitlement get-task-allow is enabled.'
      : signing.provisioningProfileType && ['development', 'ad-hoc', 'enterprise'].includes(signing.provisioningProfileType)
        ? `Profile type ${signing.provisioningProfileType} is not for App Store submission.`
      : signing.provisioningProfileExpiresAt && Date.parse(signing.provisioningProfileExpiresAt) <= Date.now()
        ? `Provisioning profile expired on ${signing.provisioningProfileExpiresAt}.` : null;
    if (failure) return { ruleId: 'RULE-IOS-SIGN-001', outcome: 'fail', evidence: failure };

    const applicationId = signing.entitlements?.['application-identifier'];
    if (typeof applicationId === 'string' && signing.teamId && applicationId !== `${signing.teamId}.${metadata.bundleIdentifier}`) {
      return { ruleId: 'RULE-IOS-SIGN-001', outcome: 'needs-review', evidence: `Profile application-identifier ${applicationId} does not exactly match ${signing.teamId}.${metadata.bundleIdentifier}. Confirm profile, wildcard applicability and signed entitlements in Xcode.` };
    }

    // Check capability: codesign requires macOS
    if (!toolCapabilities['codesign'] || signing.codesignCheckOutcome === 'not-checked') {
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

    if (signing.provisioningProfileType !== 'app-store') {
      return { ruleId: 'RULE-IOS-SIGN-001', outcome: 'needs-review', evidence: 'Code signature checked, but the provisioning profile distribution type is unknown.' };
    }

    const typeDesc = signing.provisioningProfileType ? `Type: ${signing.provisioningProfileType}` : 'Custom profile';
    return {
      ruleId: 'RULE-IOS-SIGN-001',
      outcome: 'pass',
      evidence: `Apple-anchored cryptographic code signature verified, including nested code. Embedded provisioning metadata: ${typeDesc}. Signer identity: ${signing.signerIdentity ?? 'Unknown'}. Team ID: ${signing.teamId ?? 'Unknown'}. Store account eligibility and the signed entitlement/profile match still require Xcode/App Store Connect validation.`,
      affectedFileOrConfig: 'embedded.mobileprovision',
    };
  },
};
