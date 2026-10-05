export interface PrivacyManifestEntry {
  trackingDomains?: string[];
  collectedDataTypes?: Array<{
    dataType: string;
    purposes: string[];
    linkedToUser: boolean;
    tracking: boolean;
  }>;
  accessedApiTypes?: Array<{
    apiType: string;
    reasons: string[];
  }>;
  trackingEnabled?: boolean;
}

export interface IosSigningInfo {
  isSigned: boolean;
  signerIdentity?: string;
  authorityNames?: string[];
  teamId?: string;
  provisioningProfilePresent: boolean;
  provisioningProfileType?: 'development' | 'ad-hoc' | 'enterprise' | 'app-store' | 'unknown';
  entitlements?: Record<string, unknown>;
  codesignCheckOutcome: 'pass' | 'fail' | 'not-checked';
  limitations: string[];
}

export interface IosMetadata {
  platform: 'ios';
  bundleIdentifier: string;
  displayName: string;
  marketingVersion: string; // CFBundleShortVersionString
  buildNumber: string; // CFBundleVersion
  minimumOsVersion: string;
  declaredDeviceFamilies: string[]; // ['iPhone', 'iPad', 'Universal']
  buildSdkMetadata: {
    sdkName?: string;
    sdkBuild?: string;
    xcodeVersion?: string;
    platformVersion?: string;
  };
  embeddedFrameworks: string[];
  embeddedExtensions: string[];
  architectures: string[];
  purposeStrings: Record<string, string>; // e.g. NSCameraUsageDescription -> "Reason"
  transportSecurity: {
    allowsArbitraryLoads: boolean | null;
    exceptionDomains: string[];
    hasCustomConfiguration: boolean;
  };
  privacyManifest: {
    present: boolean;
    path?: string;
    details?: PrivacyManifestEntry;
    syntaxValid: boolean;
  };
  signing: IosSigningInfo;
  archiveSizeBreakdown: {
    archiveSizeBytes: number;
    uncompressedSizeBytes: number;
    payloadAppSizeBytes: number;
    frameworksSizeBytes: number;
    largeFiles: Array<{ path: string; sizeBytes: number }>;
  };
}
