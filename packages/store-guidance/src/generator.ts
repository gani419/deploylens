import type {
  Platform,
  AndroidMetadata,
  IosMetadata,
  UserAppInfo,
  StoreGuidance,
} from '@deploylens/contracts';
import { generateDeterministicListingTemplates } from './templates.js';
import { buildStoreChecklist } from './checklist.js';

export function generateStoreGuidance(
  platform: Platform,
  metadata: { android?: AndroidMetadata; ios?: IosMetadata },
  userAppInfo?: UserAppInfo
): StoreGuidance {
  let appName = 'My App';
  if (platform === 'android' && metadata.android?.appLabel) {
    appName = metadata.android.appLabel;
  } else if (platform === 'android' && metadata.android?.packageId) {
    // derive readable title from package id last segment if no label
    const parts = metadata.android.packageId.split('.');
    appName = parts[parts.length - 1] ?? 'App';
    appName = appName.charAt(0).toUpperCase() + appName.slice(1);
  } else if (platform === 'ios' && metadata.ios?.displayName) {
    appName = metadata.ios.displayName;
  } else if (platform === 'ios' && metadata.ios?.bundleIdentifier) {
    const parts = metadata.ios.bundleIdentifier.split('.');
    appName = parts[parts.length - 1] ?? 'App';
    appName = appName.charAt(0).toUpperCase() + appName.slice(1);
  }

  const listingTemplates = generateDeterministicListingTemplates(
    platform,
    appName,
    userAppInfo
  );

  const { checklist, detectedFacts, generalReminders } = buildStoreChecklist(
    platform,
    metadata,
    userAppInfo
  );

  return {
    platform,
    listingTemplates,
    checklist,
    detectedFacts,
    generalReminders,
    ruleRevision: '2026.1',
  };
}
