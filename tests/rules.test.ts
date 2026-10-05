import { describe, it, expect } from 'vitest';
import {
  androidTargetSdkRule,
  androidMaxSdkRule,
  androidDebuggableRule,
  androidNative64BitRule,
  android16KbPageAlignmentRule,
  androidAabSigningRule,
  androidApkSigningSchemeRule,
  iosPurposeStringsRule,
  iosSigningAndProvisioningRule,
} from '@deploylens/rules';
import { generateStoreGuidance } from '@deploylens/store-guidance';
import type { AndroidMetadata, IosMetadata } from '@deploylens/contracts';

describe('Versioned Rule Evaluation & Constraints', () => {
  it('RULE-AND-SDK-003 reports maxSdkVersion as Not declared when absent', () => {
    const meta: Partial<AndroidMetadata> = {
      maxSdkVersion: null,
      maxSdkVersionDeclared: false,
    };
    const res = androidMaxSdkRule.evaluate({
      metadata: meta as AndroidMetadata,
      toolCapabilities: {},
    });
    expect(res.outcome).toBe('pass');
    expect(res.evidence).toContain('maxSdkVersion: Not declared');
  });

  it('RULE-AND-SDK-001 distinguishes targetSdkVersion >= 34 without claiming it is maximum supported OS', () => {
    const meta: Partial<AndroidMetadata> = { targetSdkVersion: 35 };
    const res = androidTargetSdkRule.evaluate({
      metadata: meta as AndroidMetadata,
      toolCapabilities: {},
    });
    expect(res.outcome).toBe('pass');
    expect(res.evidence).toContain('targetSdkVersion declares API compatibility level, not the maximum supported Android version');
  });

  it('RULE-AND-REL-001 distinguishes explicit vs resolved defaults', () => {
    const metaExplicit: Partial<AndroidMetadata> = {
      debuggable: { value: false, isExplicit: true },
    };
    const resExplicit = androidDebuggableRule.evaluate({
      metadata: metaExplicit as AndroidMetadata,
      toolCapabilities: {},
    });
    expect(resExplicit.outcome).toBe('pass');
    expect(resExplicit.evidence).toContain('explicitly declared');

    const metaDefault: Partial<AndroidMetadata> = {
      debuggable: { value: false, isExplicit: false },
    };
    const resDefault = androidDebuggableRule.evaluate({
      metadata: metaDefault as AndroidMetadata,
      toolCapabilities: {},
    });
    expect(resDefault.outcome).toBe('pass');
    expect(resDefault.evidence).toContain('resolved default');
  });

  it('RULE-AND-SIGN separates original AAB signing from APK signing', () => {
    const aabMeta: Partial<AndroidMetadata> = {
      signing: {
        isBundleSigning: true,
        signingVerified: true,
        schemeV1: true,
        schemeV2: false,
        schemeV3: false,
        schemeV4: false,
        signers: [{ subject: 'AAB', issuer: 'AAB', fingerprintSha256: 'AA:BB' }],
        storeCertificateMatchVerified: false,
        warnings: [],
      },
    };

    // APK rule should be marked not-applicable on AAB
    const apkRuleRes = androidApkSigningSchemeRule.evaluate({
      metadata: aabMeta as AndroidMetadata,
      toolCapabilities: {},
    });
    expect(apkRuleRes.outcome).toBe('not-applicable');

    // AAB rule should pass
    const aabRuleRes = androidAabSigningRule.evaluate({
      metadata: aabMeta as AndroidMetadata,
      toolCapabilities: {},
    });
    expect(aabRuleRes.outcome).toBe('pass');
  });

  it('RULE-AND-NAT-002 reports "alignment checks passed", not guaranteed 16 KB runtime compatibility', () => {
    const meta: Partial<AndroidMetadata> = {
      nativeLibraries: {
        abis: ['arm64-v8a'],
        has64BitCoverage: true,
        libraries: [{ path: 'lib/arm64-v8a/libfoo.so', name: 'libfoo.so', abi: 'arm64-v8a', fileSizeBytes: 100, is16KbAligned: true }],
        allLibraries16KbAligned: true,
        packagingAlignmentOk: true,
        alignmentReport: 'All aligned',
      },
    };
    const res = android16KbPageAlignmentRule.evaluate({
      metadata: meta as AndroidMetadata,
      toolCapabilities: {},
    });
    expect(res.outcome).toBe('pass');
    expect(res.evidence).toContain('alignment checks passed');
    expect(res.evidence).toContain('does not guarantee complete 16 KB runtime compatibility');
  });

  it('RULE-IOS-SIGN-001 produces "Not checked", never "Passed" when macOS tools are missing', () => {
    const meta: Partial<IosMetadata> = {
      signing: {
        isSigned: true,
        provisioningProfilePresent: true,
        codesignCheckOutcome: 'not-checked',
        limitations: [],
      },
    };
    const res = iosSigningAndProvisioningRule.evaluate({
      metadata: meta as IosMetadata,
      toolCapabilities: { codesign: false }, // missing on non-macOS
    });
    expect(res.outcome).toBe('not-checked');
  });

  it('RULE-IOS-SEC-002 flags placeholder or generic purpose strings', () => {
    const meta: Partial<IosMetadata> = {
      purposeStrings: {
        NSCameraUsageDescription: 'test',
      },
    };
    const res = iosPurposeStringsRule.evaluate({
      metadata: meta as IosMetadata,
      toolCapabilities: {},
    });
    expect(res.outcome).toBe('fail');
    expect(res.evidence).toContain('generic or empty purpose string');
  });

  it('Store guidance does not invent claims or features when app summary is absent', () => {
    const guidance = generateStoreGuidance('android', {
      android: {
        platform: 'android',
        packageId: 'com.example.plain',
        appLabel: 'SimpleApp',
        versionName: '1.0',
        versionCode: 1,
        minSdkVersion: 24,
        targetSdkVersion: 34,
        maxSdkVersion: null,
        maxSdkVersionDeclared: false,
        hardwareFeatures: [],
        debuggable: { value: false, isExplicit: false },
        testOnly: { value: false, isExplicit: false },
        signing: {} as any,
        nativeLibraries: {} as any,
        permissions: { declared: [], sensitivePermissions: [], requiresSpecialApproval: [] },
        security: { usesCleartextTraffic: false, networkSecurityConfigPresent: false, exportedComponents: [] },
        packaging: {} as any,
      },
    });

    expect(guidance.listingTemplates.appName.value).toBe('SimpleApp');
    expect(guidance.listingTemplates.shortDescription?.value).toContain('[Summary of SimpleApp');
    expect(guidance.listingTemplates.fullDescription.value).toContain('[Describe what SimpleApp does');
    expect(guidance.listingTemplates.fullDescription.value).not.toMatch(/award-winning|best-in-class|#1 app/i);
  });
});
