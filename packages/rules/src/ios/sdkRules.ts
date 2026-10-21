import type { IosMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const iosBuildSdkRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-SDK-001', revision: '2026.10', platform: 'ios', category: 'store-policy', severity: 'blocker',
  name: 'App Store Build SDK Requirement',
  description: 'Checks the iOS/iPadOS 26 SDK minimum for App Store Connect uploads.',
  whyItMatters: 'From April 28, 2026, iOS/iPadOS uploads must use SDK 26 or later.',
  remediation: 'Build and export with Xcode 26 or later using the iOS/iPadOS 26 SDK or later. This is the build SDK, not MinimumOSVersion.',
  officialReferenceUrl: 'https://developer.apple.com/news/?id=ueeok6yw',
  sourceReviewDate: '2026-10-21', effectiveDates: '2026-04-28',
  applicabilityDescription: 'iOS/iPadOS App Store Connect uploads.', requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const sdk = metadata.buildSdkMetadata.sdkName;
    const version = sdk?.match(/^iphoneos(\d+)(?:\.\d+)*$/i);
    return {
      ruleId: 'RULE-IOS-SDK-001',
      outcome: !version ? 'not-checked' : Number(version[1]) >= 26 ? 'pass' : 'fail',
      evidence: version ? `Build SDK ${sdk}; App Store Connect requires iOS/iPadOS SDK 26+ from April 28, 2026. MinimumOSVersion remains independent.`
        : `A supported iOS build SDK could not be established from DTSDKName (${sdk ?? 'missing'}). Verify the archive SDK in Xcode.`,
      affectedFileOrConfig: 'Info.plist (DTSDKName)',
    };
  },
};
