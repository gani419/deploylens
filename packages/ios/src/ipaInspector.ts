import type { IosMetadata } from '@deploylens/contracts';
import { parsePlistBuffer } from './plistParser.js';
import { inspectMachOBinary } from './machoInspector.js';
import { parsePrivacyManifestBuffer } from './privacyManifestParser.js';
import { synthesizeIosSigningInfo } from './macosAdapter.js';

export interface IpaArchiveData {
  archiveSizeBytes: number;
  uncompressedSizeBytes: number;
  entries: Array<{ path: string; sizeBytes: number }>;
  infoPlistBuffer?: Buffer;
  mobileProvisionBuffer?: Buffer;
  privacyManifestBuffer?: Buffer;
  mainBinaryBuffer?: Buffer;
  hasCodeSignature: boolean;
}

export function inspectIpaData(archiveData: IpaArchiveData): IosMetadata {
  const {
    archiveSizeBytes,
    uncompressedSizeBytes,
    entries,
    infoPlistBuffer,
    mobileProvisionBuffer,
    privacyManifestBuffer,
    mainBinaryBuffer,
    hasCodeSignature,
  } = archiveData;

  const infoPlist = infoPlistBuffer ? parsePlistBuffer(infoPlistBuffer) : null;

  // Extract Info.plist fields
  const bundleIdentifier = String(infoPlist?.['CFBundleIdentifier'] || 'com.unknown.app');
  const displayName = String(
    infoPlist?.['CFBundleDisplayName'] ||
    infoPlist?.['CFBundleName'] ||
    'iOS App'
  );
  const marketingVersion = String(infoPlist?.['CFBundleShortVersionString'] || '1.0.0');
  const buildNumber = String(infoPlist?.['CFBundleVersion'] || '1');
  const minimumOsVersion = String(infoPlist?.['MinimumOSVersion'] || '15.0');

  // Declared device families: 1 = iPhone, 2 = iPad, 3 = Apple TV, 4 = Watch, 6 = Vision
  const rawFamilies = infoPlist?.['UIDeviceFamily'];
  const declaredDeviceFamilies: string[] = [];
  if (Array.isArray(rawFamilies)) {
    for (const f of rawFamilies) {
      const num = Number(f);
      if (num === 1) declaredDeviceFamilies.push('iPhone');
      else if (num === 2) declaredDeviceFamilies.push('iPad');
      else if (num === 3) declaredDeviceFamilies.push('Apple TV');
      else if (num === 6) declaredDeviceFamilies.push('Apple Vision');
      else declaredDeviceFamilies.push(`DeviceFamily_${num}`);
    }
  } else if (rawFamilies) {
    const num = Number(rawFamilies);
    if (num === 1) declaredDeviceFamilies.push('iPhone');
    else if (num === 2) declaredDeviceFamilies.push('iPad');
  }
  if (declaredDeviceFamilies.length === 0) {
    declaredDeviceFamilies.push('iPhone');
  }

  // Build SDK Metadata
  const buildSdkMetadata = {
    sdkName: infoPlist?.['DTSDKName'] ? String(infoPlist['DTSDKName']) : undefined,
    sdkBuild: infoPlist?.['DTSDKBuild'] ? String(infoPlist['DTSDKBuild']) : undefined,
    xcodeVersion: infoPlist?.['DTXcode'] ? String(infoPlist['DTXcode']) : undefined,
    platformVersion: infoPlist?.['DTPlatformVersion'] ? String(infoPlist['DTPlatformVersion']) : undefined,
  };

  // Embedded frameworks and extensions
  const embeddedFrameworks: string[] = [];
  const embeddedExtensions: string[] = [];
  let payloadAppSize = 0;
  let frameworksSize = 0;
  const largeFiles: Array<{ path: string; sizeBytes: number }> = [];

  for (const entry of entries) {
    if (entry.path.startsWith('Payload/')) {
      payloadAppSize += entry.sizeBytes;
    }
    if (entry.sizeBytes > 10 * 1024 * 1024) {
      largeFiles.push(entry);
    }

    const fwMatch = entry.path.match(/Frameworks\/([^/]+\.framework)/i);
    if (fwMatch && !embeddedFrameworks.includes(fwMatch[1]!)) {
      embeddedFrameworks.push(fwMatch[1]!);
      frameworksSize += entry.sizeBytes;
    }

    const extMatch = entry.path.match(/PlugIns\/([^/]+\.appex)/i);
    if (extMatch && !embeddedExtensions.includes(extMatch[1]!)) {
      embeddedExtensions.push(extMatch[1]!);
    }
  }

  largeFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);

  // Architectures
  let architectures: string[] = [];
  if (mainBinaryBuffer) {
    const macho = inspectMachOBinary(mainBinaryBuffer);
    if (macho.isMachO && macho.architectures.length > 0) {
      architectures = macho.architectures;
    }
  }
  if (architectures.length === 0) {
    architectures = ['arm64']; // Standard default for iOS 64-bit devices
  }

  // Purpose strings: Look for all keys matching NS*UsageDescription
  const purposeStrings: Record<string, string> = {};
  if (infoPlist) {
    for (const [key, val] of Object.entries(infoPlist)) {
      if (key.startsWith('NS') && key.endsWith('UsageDescription') && typeof val === 'string') {
        purposeStrings[key] = val;
      }
    }
  }

  // Transport Security (ATS)
  const ats = (infoPlist?.['NSAppTransportSecurity'] as Record<string, unknown>) || null;
  let allowsArbitraryLoads: boolean | null = null;
  const exceptionDomains: string[] = [];
  let hasCustomConfiguration = false;

  if (ats && typeof ats === 'object') {
    hasCustomConfiguration = true;
    if (typeof ats['NSAllowsArbitraryLoads'] === 'boolean') {
      allowsArbitraryLoads = ats['NSAllowsArbitraryLoads'];
    }
    const exc = ats['NSExceptionDomains'];
    if (exc && typeof exc === 'object') {
      exceptionDomains.push(...Object.keys(exc));
    }
  }

  // Privacy Manifest
  let privacyManifestPresent = false;
  let privacySyntaxValid = false;
  let privacyEntry = undefined;

  if (privacyManifestBuffer) {
    privacyManifestPresent = true;
    const parsedPm = parsePrivacyManifestBuffer(privacyManifestBuffer);
    privacySyntaxValid = parsedPm.syntaxValid;
    privacyEntry = parsedPm.entry;
  }

  // Signing & Provisioning Profile
  const signing = synthesizeIosSigningInfo({
    hasCodeSignature,
    mobileProvisionBuffer,
  });

  return {
    platform: 'ios',
    bundleIdentifier,
    displayName,
    marketingVersion,
    buildNumber,
    minimumOsVersion,
    declaredDeviceFamilies,
    buildSdkMetadata,
    embeddedFrameworks,
    embeddedExtensions,
    architectures,
    purposeStrings,
    transportSecurity: {
      allowsArbitraryLoads,
      exceptionDomains,
      hasCustomConfiguration,
    },
    privacyManifest: {
      present: privacyManifestPresent,
      path: privacyManifestPresent ? 'Payload/<App>.app/PrivacyInfo.xcprivacy' : undefined,
      details: privacyEntry,
      syntaxValid: privacySyntaxValid,
    },
    signing,
    archiveSizeBreakdown: {
      archiveSizeBytes,
      uncompressedSizeBytes,
      payloadAppSizeBytes: payloadAppSize,
      frameworksSizeBytes: frameworksSize,
      largeFiles,
    },
  };
}
