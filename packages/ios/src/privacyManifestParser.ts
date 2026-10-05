import type { PrivacyManifestEntry } from '@deploylens/contracts';
import { parsePlistBuffer } from './plistParser.js';

export function parsePrivacyManifestBuffer(buffer: Buffer): {
  syntaxValid: boolean;
  entry?: PrivacyManifestEntry;
} {
  const parsed = parsePlistBuffer(buffer);
  if (!parsed || typeof parsed !== 'object') {
    return { syntaxValid: false };
  }

  const rawTracking = parsed['NSPrivacyTracking'];
  const trackingEnabled = typeof rawTracking === 'boolean' ? rawTracking : false;

  const rawDomains = parsed['NSPrivacyTrackingDomains'];
  const trackingDomains = Array.isArray(rawDomains)
    ? rawDomains.map((d) => String(d))
    : [];

  const rawCollected = parsed['NSPrivacyCollectedDataTypes'];
  const collectedDataTypes: PrivacyManifestEntry['collectedDataTypes'] = [];
  if (Array.isArray(rawCollected)) {
    for (const item of rawCollected) {
      if (typeof item === 'object' && item !== null) {
        collectedDataTypes.push({
          dataType: String((item as any)['NSPrivacyCollectedDataType'] || ''),
          purposes: Array.isArray((item as any)['NSPrivacyCollectedDataTypePurposes'])
            ? (item as any)['NSPrivacyCollectedDataTypePurposes'].map(String)
            : [],
          linkedToUser: Boolean((item as any)['NSPrivacyCollectedDataTypeLinked']),
          tracking: Boolean((item as any)['NSPrivacyCollectedDataTypeTracking']),
        });
      }
    }
  }

  const rawApis = parsed['NSPrivacyAccessedAPITypes'];
  const accessedApiTypes: PrivacyManifestEntry['accessedApiTypes'] = [];
  if (Array.isArray(rawApis)) {
    for (const item of rawApis) {
      if (typeof item === 'object' && item !== null) {
        accessedApiTypes.push({
          apiType: String((item as any)['NSPrivacyAccessedAPIType'] || ''),
          reasons: Array.isArray((item as any)['NSPrivacyAccessedAPITypeReasons'])
            ? (item as any)['NSPrivacyAccessedAPITypeReasons'].map(String)
            : [],
        });
      }
    }
  }

  return {
    syntaxValid: true,
    entry: {
      trackingEnabled,
      trackingDomains,
      collectedDataTypes,
      accessedApiTypes,
    },
  };
}
