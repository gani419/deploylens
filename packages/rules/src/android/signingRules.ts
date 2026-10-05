import type { AndroidMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const androidApkSigningSchemeRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SIGN-001',
  revision: '2026.1',
  platform: 'android',
  category: 'signing',
  severity: 'blocker',
  name: 'APK Signature Scheme Compliance',
  description: 'Validates that APK packages include modern signature schemes (v2/v3).',
  whyItMatters: 'Android 11+ and modern devices enforce APK Signature Scheme v2/v3. V1-only signed APKs are vulnerable to archive manipulation and rejected for devices targeting API 30+.',
  remediation: 'Sign the APK using apksigner or Gradle signing config with v1SigningEnabled and v2SigningEnabled true.',
  officialReferenceUrl: 'https://source.android.com/docs/security/features/apksigning',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to APK artifacts.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    if (metadata.signing.isBundleSigning) {
      return {
        ruleId: 'RULE-AND-SIGN-001',
        outcome: 'not-applicable',
        evidence: 'Artifact is an Android App Bundle (AAB). AAB signing is verified using bundle signature verification, not APK signature schemes v2/v3.',
        applicabilityNote: 'Rule applies only to APK files.',
      };
    }

    if (!metadata.signing.signingVerified) {
      return {
        ruleId: 'RULE-AND-SIGN-001',
        outcome: 'fail',
        evidence: `APK signature verification failed. Details: ${metadata.signing.warnings.join('; ') || 'No valid signatures found'}.`,
        affectedFileOrConfig: 'META-INF/ & APK Signing Block',
      };
    }

    if (!metadata.signing.schemeV2 && !metadata.signing.schemeV3 && !metadata.signing.schemeV4) {
      return {
        ruleId: 'RULE-AND-SIGN-001',
        outcome: 'fail',
        evidence: 'APK is signed with legacy scheme v1 (JAR signature) only. Modern Android platforms require at least Scheme v2.',
        affectedFileOrConfig: 'APK Signing Block',
      };
    }

    const schemesUsed = [
      metadata.signing.schemeV1 ? 'v1 (JAR)' : null,
      metadata.signing.schemeV2 ? 'v2 (APK Signature)' : null,
      metadata.signing.schemeV3 ? 'v3 (Key Rotation)' : null,
      metadata.signing.schemeV4 ? 'v4 (Incremental)' : null,
    ].filter(Boolean).join(', ');

    return {
      ruleId: 'RULE-AND-SIGN-001',
      outcome: 'pass',
      evidence: `APK verified with signature schemes: ${schemesUsed}. Signer SHA-256 fingerprint: ${metadata.signing.signers[0]?.fingerprintSha256 ?? 'Present'}. Note: DeployLens verifies signature validity, but cannot verify if this certificate matches your specific Google Play Store upload key without your Google Play Console configuration.`,
      affectedFileOrConfig: 'APK Signing Block',
    };
  },
};

export const androidAabSigningRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SIGN-002',
  revision: '2026.1',
  platform: 'android',
  category: 'signing',
  severity: 'blocker',
  name: 'AAB Bundle Signing Verification',
  description: 'Verifies the original Android App Bundle (AAB) JAR signature block.',
  whyItMatters: 'AAB archives must be signed by the developer upload key using JAR signing (META-INF/*.RSA or *.EC) before upload to Google Play, which then generates device-specific APKs signed by the Play app signing key.',
  remediation: 'Configure your release signing config in build.gradle with your Google Play upload keystore.',
  officialReferenceUrl: 'https://developer.android.com/studio/publish/app-signing#app-signing-google-play',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to AAB artifacts.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    if (!metadata.signing.isBundleSigning) {
      return {
        ruleId: 'RULE-AND-SIGN-002',
        outcome: 'not-applicable',
        evidence: 'Artifact is an APK. AAB bundle signing check applies only to .aab files.',
        applicabilityNote: 'Rule applies only to AAB files.',
      };
    }

    if (!metadata.signing.signingVerified) {
      return {
        ruleId: 'RULE-AND-SIGN-002',
        outcome: 'fail',
        evidence: `AAB bundle signature verification failed: ${metadata.signing.warnings.join('; ') || 'Missing META-INF signing block in bundle'}.`,
        affectedFileOrConfig: 'META-INF/',
      };
    }

    return {
      ruleId: 'RULE-AND-SIGN-002',
      outcome: 'pass',
      evidence: `Original AAB upload signature verified. Signer SHA-256 fingerprint: ${metadata.signing.signers[0]?.fingerprintSha256 ?? 'Present'}. Note: This verifies the bundle package integrity. Generated device APK signatures are produced by Google Play App Signing during release distribution.`,
      affectedFileOrConfig: 'META-INF/',
    };
  },
};
