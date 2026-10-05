import type { IosMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const iosPrivacyManifestRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-PRV-001',
  revision: '2026.1',
  platform: 'ios',
  category: 'privacy-declarations',
  severity: 'risk',
  name: 'Privacy Manifest Structure Audit (PrivacyInfo.xcprivacy)',
  description: 'Audits presence and structural validity of PrivacyInfo.xcprivacy.',
  whyItMatters: 'Apple requires third-party SDKs and apps accessing Required Reason APIs (e.g., UserDefaults, FileTimestamp, DiskSpace) to declare reasons in PrivacyInfo.xcprivacy.',
  remediation: 'Add a PrivacyInfo.xcprivacy file to your app bundle with valid NSPrivacyTracking, NSPrivacyCollectedDataTypes, and NSPrivacyAccessedAPITypes declarations.',
  officialReferenceUrl: 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Mandatory for apps and SDKs using Apple-designated sensitive APIs.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const pm = metadata.privacyManifest;

    if (!pm.present) {
      return {
        ruleId: 'RULE-IOS-PRV-001',
        outcome: 'needs-review',
        evidence: 'No PrivacyInfo.xcprivacy file detected in the main bundle. Note: If your app or embedded frameworks access Required Reason APIs (e.g. system boot time, user defaults), App Store Connect will flag missing reasons during submission.',
        affectedFileOrConfig: 'Payload/<App>.app/PrivacyInfo.xcprivacy',
        isSuspectedHeuristic: false,
      };
    }

    if (!pm.syntaxValid) {
      return {
        ruleId: 'RULE-IOS-PRV-001',
        outcome: 'fail',
        evidence: `PrivacyInfo.xcprivacy exists at ${pm.path} but failed property list parsing. App Store validation rejects malformed privacy manifests.`,
        affectedFileOrConfig: pm.path,
      };
    }

    const accessedApis = pm.details?.accessedApiTypes?.length ?? 0;
    const collectedData = pm.details?.collectedDataTypes?.length ?? 0;
    const tracking = pm.details?.trackingEnabled ? 'Tracking declared' : 'No tracking declared';

    return {
      ruleId: 'RULE-IOS-PRV-001',
      outcome: 'pass',
      evidence: `Valid PrivacyInfo.xcprivacy detected (${accessedApis} accessed API types, ${collectedData} collected data types, ${tracking}). Note: The physical presence of a privacy manifest does not prove complete runtime privacy compliance.`,
      affectedFileOrConfig: pm.path,
    };
  },
};
