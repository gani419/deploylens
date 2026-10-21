import type { CheckOutcome, ScanSummary } from '@deploylens/contracts';
export const formats = { apk: 'Android application package', aab: 'Android App Bundle', ipa: 'iOS / iPadOS app archive' };
export const resultLabels: Record<CheckOutcome, string> = { pass: 'Passed', fail: 'Failed', 'needs-review': 'Needs review', 'not-checked': 'Not checked', 'not-applicable': 'Not applicable' };
export const size = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export const yesNo = (value: boolean | null | undefined) => value === true ? 'Yes' : value === false ? 'No' : 'Not established';
export const safeLink = (url?: string) => url && /^https:\/\//.test(url) ? url : undefined;
export function identity(summary: ScanSummary) {
  const android = summary.metadata.android, ios = summary.metadata.ios;
  return { name: android?.appLabel || ios?.displayName || android?.packageId || ios?.bundleIdentifier || 'App name unavailable',
    identifier: android?.packageId || ios?.bundleIdentifier || 'Not established',
    version: android?.versionName || ios?.marketingVersion || 'Not established',
    build: android?.versionCode ?? ios?.buildNumber ?? 'Not established' };
}
