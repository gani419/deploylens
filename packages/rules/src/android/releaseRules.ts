import type { AndroidMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const androidDebuggableRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-REL-001',
  revision: '2026.1',
  platform: 'android',
  category: 'release-configuration',
  severity: 'blocker',
  name: 'Production Debuggable Flag Audit',
  description: 'android:debuggable must be false in production release builds submitted to stores.',
  whyItMatters: 'Enabling debuggable allows arbitrary code injection, memory inspection, and reverse engineering via ADB on any user device.',
  remediation: 'Set android:debuggable="false" or rely on standard Gradle release build types which set debuggable false by default.',
  officialReferenceUrl: 'https://developer.android.com/guide/topics/manifest/application-element#debug',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Mandatory for production release builds on Google Play and standard app stores.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const isDebuggable = metadata.debuggable.value;
    const isExplicit = metadata.debuggable.isExplicit;

    if (isDebuggable) {
      return {
        ruleId: 'RULE-AND-REL-001',
        outcome: 'fail',
        evidence: `android:debuggable is true (${isExplicit ? 'explicitly declared in manifest' : 'resolved from build config'}). Google Play strictly rejects debuggable builds.`,
        affectedFileOrConfig: 'AndroidManifest.xml (<application android:debuggable="true">)',
      };
    }

    return {
      ruleId: 'RULE-AND-REL-001',
      outcome: 'pass',
      evidence: `android:debuggable is false (${isExplicit ? 'explicitly declared' : 'resolved default for release builds'}).`,
      affectedFileOrConfig: 'AndroidManifest.xml (<application>)',
    };
  },
};

export const androidTestOnlyRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-REL-002',
  revision: '2026.1',
  platform: 'android',
  category: 'release-configuration',
  severity: 'blocker',
  name: 'Test-Only Flag Check',
  description: 'android:testOnly must not be enabled on release builds.',
  whyItMatters: 'Test-only builds cannot be installed by standard end-user package installers or submitted to Google Play without adb -t flags.',
  remediation: 'Ensure android:testOnly="false" in manifest and avoid using Android Studio "Run" build artifacts for production releases; use "Build > Generate Signed Bundle / APK".',
  officialReferenceUrl: 'https://developer.android.com/guide/topics/manifest/application-element#testonly',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all Android store candidates.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const isTestOnly = metadata.testOnly.value;
    const isExplicit = metadata.testOnly.isExplicit;

    if (isTestOnly) {
      return {
        ruleId: 'RULE-AND-REL-002',
        outcome: 'fail',
        evidence: `android:testOnly is true (${isExplicit ? 'explicitly declared in manifest' : 'injected by IDE test runner'}). Production package managers will reject direct installation.`,
        affectedFileOrConfig: 'AndroidManifest.xml (<application android:testOnly="true">)',
      };
    }

    return {
      ruleId: 'RULE-AND-REL-002',
      outcome: 'pass',
      evidence: `android:testOnly is false (${isExplicit ? 'explicitly declared' : 'resolved default'}).`,
      affectedFileOrConfig: 'AndroidManifest.xml (<application>)',
    };
  },
};
