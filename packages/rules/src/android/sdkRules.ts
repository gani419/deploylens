import type { AndroidMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const androidTargetSdkRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SDK-001',
  revision: '2026.1',
  platform: 'android',
  category: 'sdk-compatibility',
  severity: 'blocker',
  name: 'Target SDK Level Compliance',
  description: 'Google Play requires new apps and app updates to target a recent Android API level (API 34+ for updates, API 35 recommended).',
  whyItMatters: 'Google Play rejects APK/AAB submissions that target obsolete API levels to ensure users benefit from modern security, privacy, and battery enhancements.',
  remediation: 'Update targetSdkVersion in build.gradle to API 34 (Android 14) or API 35 (Android 15), test compatibility, and rebuild.',
  officialReferenceUrl: 'https://developer.android.com/google/play/requirements/target-sdk',
  sourceReviewDate: '2026-01-10',
  effectiveDates: 'August 31, 2024 onwards',
  applicabilityDescription: 'Applies to all Android applications submitted to Google Play.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const targetSdk = metadata.targetSdkVersion;
    if (targetSdk === null) {
      return {
        ruleId: 'RULE-AND-SDK-001',
        outcome: 'fail',
        evidence: 'targetSdkVersion was not specified in the Android manifest.',
        affectedFileOrConfig: 'AndroidManifest.xml (<uses-sdk>)',
      };
    }

    if (targetSdk >= 35) {
      return {
        ruleId: 'RULE-AND-SDK-001',
        outcome: 'pass',
        evidence: `targetSdkVersion is ${targetSdk} (Android 15+), exceeding current Google Play requirements. Note: targetSdkVersion declares API compatibility level, not the maximum supported Android version.`,
        affectedFileOrConfig: 'AndroidManifest.xml (<uses-sdk>)',
      };
    }

    if (targetSdk === 34) {
      return {
        ruleId: 'RULE-AND-SDK-001',
        outcome: 'pass',
        evidence: `targetSdkVersion is 34 (Android 14), satisfying current minimum Google Play target API policy. Note: targetSdkVersion declares API compatibility level, not the maximum supported Android version.`,
        affectedFileOrConfig: 'AndroidManifest.xml (<uses-sdk>)',
      };
    }

    return {
      ruleId: 'RULE-AND-SDK-001',
      outcome: 'fail',
      evidence: `targetSdkVersion is ${targetSdk}. Google Play requires targetSdkVersion >= 34 for new app releases and updates.`,
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
