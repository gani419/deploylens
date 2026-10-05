export interface CertificateMetadata {
  subject: string;
  issuer: string;
  fingerprintSha256: string;
  validFrom?: string;
  validUntil?: string;
  serialNumber?: string;
}

export interface AndroidSigningInfo {
  schemeV1: boolean;
  schemeV2: boolean;
  schemeV3: boolean;
  schemeV4: boolean;
  signingVerified: boolean;
  isBundleSigning: boolean;
  signers: CertificateMetadata[];
  storeCertificateMatchVerified: boolean; // false unless expected store certificate is provided
  warnings: string[];
}

export interface NativeLibraryInfo {
  path: string;
  name: string;
  abi: string;
  fileSizeBytes: number;
  is16KbAligned: boolean | null;
  loadAlignmentBytes?: number;
}

export interface NativeLibrarySummary {
  abis: string[];
  has64BitCoverage: boolean;
  libraries: NativeLibraryInfo[];
  allLibraries16KbAligned: boolean | null;
  packagingAlignmentOk: boolean | null;
  alignmentReport: string;
}

export interface ComponentExposure {
  type: 'activity' | 'service' | 'receiver' | 'provider';
  name: string;
  exported: boolean;
  permissionRequired?: string;
  isSuspectedVulnerable?: boolean;
}

export interface AndroidPackagingBreakdown {
  archiveSizeBytes: number;
  uncompressedSizeBytes: number;
  dexSizeBytes: number;
  nativeLibsSizeBytes: number;
  assetsSizeBytes: number;
  resourcesSizeBytes: number;
  otherSizeBytes: number;
  largeFiles: Array<{ path: string; sizeBytes: number }>;
  estimatedDownloadSizeBytes?: number; // Only when actually calculated
}

export interface AndroidMetadata {
  platform: 'android';
  packageId: string;
  appLabel?: string;
  versionName: string;
  versionCode: number;
  minSdkVersion: number | null;
  targetSdkVersion: number | null;
  maxSdkVersion: number | null;
  maxSdkVersionDeclared: boolean; // if false, "Not declared"
  hardwareFeatures: Array<{ name: string; required: boolean }>;
  screenDensities?: string[];
  supportedScreens?: string[];
  debuggable: {
    value: boolean;
    isExplicit: boolean;
  };
  testOnly: {
    value: boolean;
    isExplicit: boolean;
  };
  signing: AndroidSigningInfo;
  nativeLibraries: NativeLibrarySummary;
  permissions: {
    declared: string[];
    sensitivePermissions: string[];
    requiresSpecialApproval: string[];
  };
  security: {
    usesCleartextTraffic: boolean | null;
    networkSecurityConfigPresent: boolean;
    exportedComponents: ComponentExposure[];
  };
  packaging: AndroidPackagingBreakdown;
}
