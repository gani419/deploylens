import type { AndroidMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const androidTargetSdkRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SDK-001', revision: '2026.10', platform: 'android',
  category: 'sdk-compatibility', severity: 'blocker', name: 'Target SDK Level Compliance',
  description: 'Checks Google Play new app/update target API requirements effective August 31, 2026.',
  whyItMatters: 'New submissions must satisfy the current target API requirement for their device category.',
  remediation: 'Target API 36 for phone/tablet, 35 for Wear OS/Automotive, or 34 for TV/XR. Check Play Console for account-specific extensions.',
  officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/11926878',
  sourceReviewDate: '2026-10-21', effectiveDates: '2026-08-31',
  applicabilityDescription: 'New apps and updates; existing-app availability and granted extensions require Play Console review.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const features = metadata.hardwareFeatures?.filter(f => f.required).map(f => f.name) ?? [];
    const category = features.includes('android.hardware.type.watch') ? 'Wear OS'
      : features.includes('android.hardware.type.automotive') ? 'Automotive'
      : features.includes('android.software.leanback') || features.includes('android.hardware.type.television') ? 'TV'
      : features.some(f => f.startsWith('android.software.xr.') || f === 'android.hardware.type.xr') ? 'XR' : 'phone/tablet';
    const minimum = category === 'TV' || category === 'XR' ? 34 : category === 'phone/tablet' ? 36 : 35;
    const target = metadata.targetSdkVersion;
    return {
      ruleId: 'RULE-AND-SDK-001',
      outcome: target !== null && Number.isInteger(target) && target >= minimum ? 'pass' : 'fail',
      evidence: `targetSdkVersion: ${target ?? 'not declared'}. ${category} new apps/updates require API ${minimum}+ from August 31, 2026 (policy reviewed October 21, 2026). Device category inferred from required manifest features. Any granted extension must be confirmed in Play Console. Note: targetSdkVersion declares API compatibility level, not the maximum supported Android version.`,
      affectedFileOrConfig: 'AndroidManifest.xml (<uses-sdk>)',
    };
  },
};

export const androidMinSdkRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SDK-002',
  revision: '2026.1',
  platform: 'android',
  category: 'sdk-compatibility',
  severity: 'quality',
  name: 'Minimum SDK Level Check',
  description: 'Ensures minSdkVersion is declared and within reasonable modern Android support boundaries.',
  whyItMatters: 'Setting minSdkVersion below 24 increases maintenance overhead for legacy TLS and permission architectures; setting it too high excludes devices unnecessarily.',
  remediation: 'Review minSdkVersion in build.gradle. API 24 (Android 7.0) or API 26 (Android 8.0) covers >95% of active global devices while supporting modern crypto.',
  officialReferenceUrl: 'https://developer.android.com/guide/topics/manifest/uses-sdk-element',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all Android builds.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const minSdk = metadata.minSdkVersion;
    if (minSdk === null) {
      return {
        ruleId: 'RULE-AND-SDK-002',
        outcome: 'fail',
        evidence: 'minSdkVersion is missing from AndroidManifest.xml. Android defaults to API 1 if omitted.',
        affectedFileOrConfig: 'AndroidManifest.xml',
      };
    }

    if (minSdk < 21) {
      return {
        ruleId: 'RULE-AND-SDK-002',
        outcome: 'needs-review',
        evidence: `minSdkVersion is ${minSdk}. Devices below API 21 (Android 5.0) lack modern TLS 1.3/multidex standard support.`,
        affectedFileOrConfig: 'AndroidManifest.xml (<uses-sdk>)',
      };
    }

    return {
      ruleId: 'RULE-AND-SDK-002',
      outcome: 'pass',
      evidence: `minSdkVersion is declared as ${minSdk}.`,
      affectedFileOrConfig: 'AndroidManifest.xml (<uses-sdk>)',
    };
  },
};

export const androidMaxSdkRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SDK-003',
  revision: '2026.1',
  platform: 'android',
  category: 'sdk-compatibility',
  severity: 'risk',
  name: 'Max SDK Declaration Audit',
  description: 'Checks whether maxSdkVersion is present. Google strongly advises against using maxSdkVersion for standard applications.',
  whyItMatters: 'Declaring maxSdkVersion causes the app to be completely uninstallable on future OS updates.',
  remediation: 'Remove android:maxSdkVersion from AndroidManifest.xml unless targeting a specialized kiosk or OEM hardware device.',
  officialReferenceUrl: 'https://developer.android.com/guide/topics/manifest/uses-sdk-element#max',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all Android builds.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    if (!metadata.maxSdkVersionDeclared || metadata.maxSdkVersion === null) {
      return {
        ruleId: 'RULE-AND-SDK-003',
        outcome: 'pass',
        evidence: 'maxSdkVersion: Not declared (Recommended practice per Android documentation).',
        affectedFileOrConfig: 'AndroidManifest.xml (<uses-sdk>)',
      };
    }

    return {
      ruleId: 'RULE-AND-SDK-003',
      outcome: 'needs-review',
      evidence: `maxSdkVersion is declared as ${metadata.maxSdkVersion}. The app will be blocked from installing on devices running Android versions higher than API ${metadata.maxSdkVersion}.`,
      affectedFileOrConfig: 'AndroidManifest.xml (android:maxSdkVersion)',
    };
  },
};
