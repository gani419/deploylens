import type { IosMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const iosBundleIdentityRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-BND-001',
  revision: '2026.1',
  platform: 'ios',
  category: 'identity-versioning',
  severity: 'blocker',
  name: 'Bundle Identity and Semantic Versioning',
  description: 'Verifies CFBundleIdentifier, CFBundleShortVersionString, and CFBundleVersion are properly formatted.',
  whyItMatters: 'App Store Connect enforces strict reverse-DNS format for bundle identifiers and requires strictly increasing CFBundleVersion numbers for each submission.',
  remediation: 'Verify CFBundleIdentifier (e.g. com.example.app), CFBundleShortVersionString (e.g. 1.0.0), and CFBundleVersion (e.g. 42) in Info.plist.',
  officialReferenceUrl: 'https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleidentifier',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all iOS IPA archives.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const id = metadata.bundleIdentifier;
    const marketing = metadata.marketingVersion;
    const build = metadata.buildNumber;

    if (!id || !id.includes('.')) {
      return {
        ruleId: 'RULE-IOS-BND-001',
        outcome: 'fail',
        evidence: `Invalid CFBundleIdentifier "${id || 'missing'}". Must be reverse-DNS format (e.g., com.company.app).`,
        affectedFileOrConfig: 'Info.plist (CFBundleIdentifier)',
      };
    }

    if (!marketing || !/^\d+(\.\d+)*$/.test(marketing)) {
      return {
        ruleId: 'RULE-IOS-BND-001',
        outcome: 'fail',
        evidence: `Invalid CFBundleShortVersionString "${marketing}". Must consist of period-separated integers (e.g. 1.0.0).`,
        affectedFileOrConfig: 'Info.plist (CFBundleShortVersionString)',
      };
    }

    if (!build) {
      return {
        ruleId: 'RULE-IOS-BND-001',
        outcome: 'fail',
        evidence: 'Missing CFBundleVersion in Info.plist.',
        affectedFileOrConfig: 'Info.plist (CFBundleVersion)',
      };
    }

    return {
      ruleId: 'RULE-IOS-BND-001',
      outcome: 'pass',
      evidence: `Bundle ID: "${id}", Version: ${marketing} (Build ${build}). Format complies with App Store Connect rules.`,
      affectedFileOrConfig: 'Info.plist',
    };
  },
};

export const iosMinimumOsAndDevicesRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-BND-002',
  revision: '2026.1',
  platform: 'ios',
  category: 'sdk-compatibility',
  severity: 'quality',
  name: 'Minimum OS Version and Target Device Families',
  description: 'Audits MinimumOSVersion and UIDeviceFamily declarations.',
  whyItMatters: 'Targeting obsolete iOS versions risks deprecated API usage; declaring iPad support requires adherence to iPad multitasking and responsive guidelines.',
  remediation: 'Set MinimumOSVersion to at least 16.0 or 17.0 for modern Swift/SwiftUI features. Ensure device families reflect tested layouts.',
  officialReferenceUrl: 'https://developer.apple.com/documentation/bundleresources/information_property_list/minimumosversion',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all iOS IPA archives.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const minOs = parseFloat(metadata.minimumOsVersion || '0');
    const families = metadata.declaredDeviceFamilies;

    const deviceNote = families.includes('iPad')
      ? ' Note: Declaring iPad support indicates universal capability, but does not prove iPad responsive layout or multitasking correctness.'
      : '';

    if (minOs < 15.0) {
      return {
        ruleId: 'RULE-IOS-BND-002',
        outcome: 'needs-review',
        evidence: `MinimumOSVersion is ${metadata.minimumOsVersion || 'unknown'} (< 15.0). Devices running iOS < 15 lack modern WebKit and privacy features.${deviceNote}`,
        affectedFileOrConfig: 'Info.plist (MinimumOSVersion)',
      };
    }

    return {
      ruleId: 'RULE-IOS-BND-002',
      outcome: 'pass',
      evidence: `MinimumOSVersion is ${metadata.minimumOsVersion}. Supported device families: [${families.join(', ')}].${deviceNote}`,
      affectedFileOrConfig: 'Info.plist',
    };
  },
};
