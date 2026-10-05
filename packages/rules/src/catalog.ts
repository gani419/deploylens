import type { AndroidMetadata, IosMetadata } from '@deploylens/contracts';
import type { Rule } from './types.js';
import {
  androidTargetSdkRule,
  androidMinSdkRule,
  androidMaxSdkRule,
} from './android/sdkRules.js';
import {
  androidDebuggableRule,
  androidTestOnlyRule,
} from './android/releaseRules.js';
import {
  androidApkSigningSchemeRule,
  androidAabSigningRule,
} from './android/signingRules.js';
import {
  androidNative64BitRule,
  android16KbPageAlignmentRule,
  androidPackagingAlignmentRule,
} from './android/nativeRules.js';
import {
  androidCleartextTrafficRule,
  androidSensitivePermissionsRule,
  androidExportedComponentsRule,
} from './android/securityRules.js';
import {
  androidAabSubmissionFormatRule,
  androidArchiveSizeRule,
} from './android/packagingRules.js';

import {
  iosBundleIdentityRule,
  iosMinimumOsAndDevicesRule,
} from './ios/bundleRules.js';
import {
  iosTransportSecurityRule,
  iosPurposeStringsRule,
} from './ios/securityRules.js';
import { iosPrivacyManifestRule } from './ios/privacyRules.js';
import { iosSigningAndProvisioningRule } from './ios/signingRules.js';

export const ANDROID_RULES: Rule<AndroidMetadata>[] = [
  androidTargetSdkRule,
  androidMinSdkRule,
  androidMaxSdkRule,
  androidDebuggableRule,
  androidTestOnlyRule,
  androidApkSigningSchemeRule,
  androidAabSigningRule,
  androidNative64BitRule,
  android16KbPageAlignmentRule,
  androidPackagingAlignmentRule,
  androidCleartextTrafficRule,
  androidSensitivePermissionsRule,
  androidExportedComponentsRule,
  androidAabSubmissionFormatRule,
  androidArchiveSizeRule,
];

export const IOS_RULES: Rule<IosMetadata>[] = [
  iosBundleIdentityRule,
  iosMinimumOsAndDevicesRule,
  iosTransportSecurityRule,
  iosPurposeStringsRule,
  iosPrivacyManifestRule,
  iosSigningAndProvisioningRule,
];

export const ALL_RULES = [...ANDROID_RULES, ...IOS_RULES];

export function getRuleById(id: string) {
  return ALL_RULES.find((r) => r.id === id);
}

export function getRuleRevisionsMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const rule of ALL_RULES) {
    map[rule.id] = rule.revision;
  }
  return map;
}
