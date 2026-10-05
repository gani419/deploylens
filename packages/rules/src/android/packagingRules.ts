import type { AndroidMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const androidAabSubmissionFormatRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-PKG-001',
  revision: '2026.1',
  platform: 'android',
  category: 'packaging',
  severity: 'blocker',
  name: 'Google Play Submission Format (AAB Requirement)',
  description: 'Google Play mandates Android App Bundle (.aab) format for new app submissions.',
  whyItMatters: 'APKs cannot be uploaded as new applications on Google Play. App Bundles allow dynamic delivery, optimized download sizes per device ABI and density, and asset pack streaming.',
  remediation: 'Generate an Android App Bundle (.aab) using Gradle (./gradlew bundleRelease) or Android Studio "Build > Build Bundle(s) / APK(s) > Build Bundle(s)".',
  officialReferenceUrl: 'https://developer.android.com/guide/app-bundle',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to builds intended for new Google Play submissions (APKs are permitted for existing apps or alternative app stores).',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    if (metadata.signing.isBundleSigning) {
      return {
        ruleId: 'RULE-AND-PKG-001',
        outcome: 'pass',
        evidence: 'Artifact is packaged as an Android App Bundle (AAB), compliant with Google Play distribution standards.',
        affectedFileOrConfig: 'Archive format (.aab)',
      };
    }

    return {
      ruleId: 'RULE-AND-PKG-001',
      outcome: 'needs-review',
      evidence: 'Artifact is packaged as a standalone APK. Note: Google Play requires AAB format for new apps. APK is acceptable for internal distribution, enterprise deployment, or existing apps updated before AAB mandates.',
      affectedFileOrConfig: 'Archive format (.apk)',
      applicabilityNote: 'Conditional on submission target: Blocker for new Google Play releases, acceptable for side-loading / existing apps.',
    };
  },
};

export const androidArchiveSizeRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-PKG-002',
  revision: '2026.1',
  platform: 'android',
  category: 'packaging',
  severity: 'quality',
  name: 'Artifact Size and Large File Audit',
  description: 'Analyzes compressed archive size versus uncompressed breakdown and highlights large individual files.',
  whyItMatters: 'Google Play maximum download size limit for base APK generated from bundle is 200MB. Large downloads increase installation drop-off and battery usage.',
  remediation: 'Use ProGuard/R8 code shrinking, WebP image compression, Play Feature Delivery, or Play Asset Delivery for assets over 10 MB.',
  officialReferenceUrl: 'https://developer.android.com/topic/performance/reduce-apk-size',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all Android builds.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const pkg = metadata.packaging;
    const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

    let downloadSizeText = '';
    if (pkg.estimatedDownloadSizeBytes !== undefined) {
      downloadSizeText = ` Estimated device download size: ${mb(pkg.estimatedDownloadSizeBytes)} MB.`;
    } else {
      downloadSizeText = ' (Estimated device download size is not calculated; displaying actual archive size).';
    }

    if (pkg.archiveSizeBytes > 200 * 1024 * 1024) {
      return {
        ruleId: 'RULE-AND-PKG-002',
        outcome: 'fail',
        evidence: `Archive size is ${mb(pkg.archiveSizeBytes)} MB, exceeding the 200 MB Google Play base delivery limit.${downloadSizeText}`,
        affectedFileOrConfig: 'Archive Root',
      };
    }

    if (pkg.largeFiles.length > 0) {
      return {
        ruleId: 'RULE-AND-PKG-002',
        outcome: 'needs-review',
        evidence: `Archive size: ${mb(pkg.archiveSizeBytes)} MB. Uncompressed payload: ${mb(pkg.uncompressedSizeBytes)} MB.${downloadSizeText} Detected ${pkg.largeFiles.length} file(s) exceeding 10MB (e.g. ${pkg.largeFiles.slice(0, 2).map((f) => `${f.path} [${mb(f.sizeBytes)} MB]`).join(', ')}).`,
        affectedFileOrConfig: pkg.largeFiles[0]?.path,
      };
    }

    return {
      ruleId: 'RULE-AND-PKG-002',
      outcome: 'pass',
      evidence: `Archive size: ${mb(pkg.archiveSizeBytes)} MB. Uncompressed payload: ${mb(pkg.uncompressedSizeBytes)} MB.${downloadSizeText} No unusually large files detected.`,
      affectedFileOrConfig: 'Archive Root',
    };
  },
};
