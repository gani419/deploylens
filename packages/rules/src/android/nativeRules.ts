import type { AndroidMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const androidNative64BitRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-NAT-001',
  revision: '2026.1',
  platform: 'android',
  category: 'native-binaries',
  severity: 'blocker',
  name: '64-Bit Native Architecture Coverage',
  description: 'Google Play requires all apps containing 32-bit native code to also provide corresponding 64-bit versions.',
  whyItMatters: 'Modern 64-bit Android hardware runs 64-bit binaries significantly faster and more securely. Devices without 32-bit support (e.g. Pixel 7+) cannot run apps lacking 64-bit code.',
  remediation: 'Enable arm64-v8a (and x86_64 if providing x86) in ndk.abiFilters within build.gradle.',
  officialReferenceUrl: 'https://developer.android.com/google/play/requirements/64-bit',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to Android builds containing native code (.so libraries).',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const abis = metadata.nativeLibraries.abis;
    if (abis.length === 0) {
      return {
        ruleId: 'RULE-AND-NAT-001',
        outcome: 'not-applicable',
        evidence: 'No native libraries (.so files) detected in the build artifact. App is pure bytecode (DEX).',
        applicabilityNote: 'Rule applies only when native libraries are bundled.',
      };
    }

    const has32Bit = abis.some((a) => a === 'armeabi-v7a' || a === 'x86');
    const has64Bit = metadata.nativeLibraries.has64BitCoverage;

    if (has32Bit && !has64Bit) {
      return {
        ruleId: 'RULE-AND-NAT-001',
        outcome: 'fail',
        evidence: `Build includes 32-bit ABIs (${abis.join(', ')}) but is missing corresponding 64-bit ABIs (arm64-v8a / x86_64). Google Play strictly rejects 32-bit-only native apps.`,
        affectedFileOrConfig: 'lib/',
      };
    }

    return {
      ruleId: 'RULE-AND-NAT-001',
      outcome: 'pass',
      evidence: `Native library ABIs detected: [${abis.join(', ')}]. 64-bit architecture coverage is complete.`,
      affectedFileOrConfig: 'lib/',
    };
  },
};

export const android16KbPageAlignmentRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-NAT-002',
  revision: '2026.1',
  platform: 'android',
  category: 'native-binaries',
  severity: 'risk',
  name: '16 KB ELF Page Alignment Inspection',
  description: 'Checks whether ELF load segments in native libraries (.so) are aligned to at least 16 KB boundaries for Android 15 compatibility.',
  whyItMatters: 'Android 15 introduces support for 16 KB memory page sizes. Apps containing 4 KB-only aligned native libraries will crash when loaded on 16 KB page-size kernel configurations.',
  remediation: 'Compile native libraries with -Wl,-z,max-page-size=16384 using Android NDK r27 or newer, and ensure packaging preserves page alignment.',
  officialReferenceUrl: 'https://developer.android.com/guide/practices/page-sizes',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to Android builds containing native code.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const libs = metadata.nativeLibraries.libraries;
    if (libs.length === 0) {
      return {
        ruleId: 'RULE-AND-NAT-002',
        outcome: 'not-applicable',
        evidence: 'No native libraries present; 16 KB page alignment does not apply.',
        applicabilityNote: 'Pure DEX applications do not have native ELF alignment requirements.',
      };
    }

    const unalignedLibs = libs.filter((l) => l.is16KbAligned === false);
    const unknownLibs = libs.filter((l) => l.is16KbAligned === null);

    if (unalignedLibs.length > 0) {
      return {
        ruleId: 'RULE-AND-NAT-002',
        outcome: 'needs-review',
        evidence: `${unalignedLibs.length} of ${libs.length} native libraries are aligned to 4 KB instead of 16 KB (e.g. ${unalignedLibs.slice(0, 3).map((l) => l.name).join(', ')}). May crash on 16 KB page Android 15 devices.`,
        affectedFileOrConfig: unalignedLibs[0]?.path,
      };
    }

    if (unknownLibs.length > 0 && unalignedLibs.length === 0) {
      return {
        ruleId: 'RULE-AND-NAT-002',
        outcome: 'needs-review',
        evidence: `Could not verify alignment on ${unknownLibs.length} libraries. ${metadata.nativeLibraries.alignmentReport}`,
        affectedFileOrConfig: 'lib/',
      };
    }

    return {
      ruleId: 'RULE-AND-NAT-002',
      outcome: 'pass',
      evidence: `ELF segment alignment checks passed across all ${libs.length} native libraries (load segments aligned to >= 16384 bytes). Note: This confirms binary alignment checks passed; it does not guarantee complete 16 KB runtime compatibility for internal memory allocators or JNI code.`,
      affectedFileOrConfig: 'lib/',
    };
  },
};

export const androidPackagingAlignmentRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-NAT-003',
  revision: '2026.1',
  platform: 'android',
  category: 'packaging',
  severity: 'quality',
  name: 'APK Zip Alignment Inspection',
  description: 'Validates that uncompressed archive entries (especially native libraries and resources) are aligned to 4-byte / page boundaries.',
  whyItMatters: 'Unaligned APK entries require the OS to allocate additional memory copies during mmap execution, degrading runtime performance and memory footprint.',
  remediation: 'Run zipalign -c -v 4 <apk> or verify that Gradle packagingOptions / bundletool alignment is enabled.',
  officialReferenceUrl: 'https://developer.android.com/studio/command-line/zipalign',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to APK packages.',
  requiredCapabilities: ['zipalign'],
  evaluate: ({ metadata, toolCapabilities }) => {
    if (metadata.signing.isBundleSigning) {
      return {
        ruleId: 'RULE-AND-NAT-003',
        outcome: 'not-applicable',
        evidence: 'Artifact is an AAB. Zip alignment is performed by Google Play when generating device APKs.',
        applicabilityNote: 'Zipalign operates on final APK files.',
      };
    }

    if (!toolCapabilities['zipalign'] && metadata.nativeLibraries.packagingAlignmentOk === null) {
      return {
        ruleId: 'RULE-AND-NAT-003',
        outcome: 'not-checked',
        evidence: 'zipalign tool not detected on system. Could not run full zipalign verification.',
        affectedFileOrConfig: 'APK Archive',
      };
    }

    if (metadata.nativeLibraries.packagingAlignmentOk === false) {
      return {
        ruleId: 'RULE-AND-NAT-003',
        outcome: 'fail',
        evidence: 'APK archive contains unaligned entries. Direct memory-mapped access may fail or degrade performance.',
        affectedFileOrConfig: 'APK Archive',
      };
    }

    return {
      ruleId: 'RULE-AND-NAT-003',
      outcome: 'pass',
      evidence: 'APK entries and uncompressed resources are properly zip-aligned (4-byte alignment).',
      affectedFileOrConfig: 'APK Archive',
    };
  },
};
