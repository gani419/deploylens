import fs from 'node:fs';
import path from 'node:path';
import type {
  ScanRequest,
  ScanEvent,
  ScanSummary,
  ArtifactIdentity,
  Platform,
  ArtifactType,
  ValidationStage,
  ValidationStageId,
  CheckResult,
  AndroidMetadata,
  NativeLibrarySummary,
  CapabilityReport,
} from '@deploylens/contracts';
import {
  createFindingFromRule,
  androidTargetSdkRule,
  androidMinSdkRule,
  androidMaxSdkRule,
  androidDebuggableRule,
  androidTestOnlyRule,
  androidApkSigningSchemeRule,
  androidAabSigningRule,
  androidNative64BitRule,
  android16KbPageAlignmentRule,
  androidPackagingAlignmentRule,
  androidCleartextTrafficRule,
  androidSensitivePermissionsRule,
  androidExportedComponentsRule,
  androidAabSubmissionFormatRule,
  androidArchiveSizeRule,
  iosBundleIdentityRule,
  iosMinimumOsAndDevicesRule,
  iosTransportSecurityRule,
  iosPurposeStringsRule,
  iosPrivacyManifestRule,
  iosSigningAndProvisioningRule,
} from '@deploylens/rules';
import {
  parseAxml,
  extractManifestMetadata,
  toNativeLibraryInfo,
  inspectApkSigningBlock,
  synthesizeAndroidSigningInfo,
  analyzePackaging,
  verifyWithApksigner,
  verifyWithZipalign,
} from '@deploylens/android';
import { inspectIpaData } from '@deploylens/ios';
import { generateStoreGuidance } from '@deploylens/store-guidance';
import { SafeZipReader, type ZipEntryHeader } from './safeZip.js';
import { TemporaryWorkspace } from './workspace.js';
import { detectAllCapabilities } from './capabilities.js';
import { computeAssessment } from './summarizer.js';

export class DeployLensEngine {
  private activeScans = new Map<string, { cancelled: boolean; workspace?: TemporaryWorkspace }>();

  async detectCapabilities(): Promise<CapabilityReport> {
    return detectAllCapabilities();
  }

  cancelScan(scanId: string) {
    const scan = this.activeScans.get(scanId);
    if (scan) {
      scan.cancelled = true;
      if (scan.workspace) {
        scan.workspace.cleanup();
      }
    }
  }

  async inspectArtifact(
    request: ScanRequest,
    onEvent?: (event: ScanEvent) => void
  ): Promise<ScanSummary> {
    const scanId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const scanRecord = { cancelled: false, workspace: undefined as TemporaryWorkspace | undefined };
    this.activeScans.set(scanId, scanRecord);

    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const emit = (event: ScanEvent) => {
      if (scanRecord.cancelled && event.type !== 'scan.cancelled') return;
      onEvent?.(event);
    };

    // 1. Verify existence of artifact file
    const resolvedPath = path.resolve(request.artifactPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Artifact file not found: "${request.artifactPath}"`);
    }

    const stat = fs.statSync(resolvedPath);
    const fileName = path.basename(resolvedPath);
    const sizeBytes = stat.size;

    // Detect platform and artifact type
    const { platform, artifactType } = this.detectArtifactType(resolvedPath);

    const artifactIdentity: ArtifactIdentity = {
      path: resolvedPath,
      fileName,
      sizeBytes,
      platform,
      artifactType,
    };

    emit({
      type: 'scan.started',
      scanId,
      artifact: artifactIdentity,
      timestamp: new Date().toISOString(),
    });

    const workspace = new TemporaryWorkspace(scanId);
    scanRecord.workspace = workspace;

    try {
      const capabilities = await this.detectCapabilities();
      const capBooleans: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(capabilities)) {
        capBooleans[k] = v.available;
      }

      let summary: ScanSummary;
      if (platform === 'android') {
        summary = await this.runAndroidInspection(
          scanId,
          scanRecord,
          artifactIdentity,
          capabilities,
          capBooleans,
          request,
          startedAt,
          startTime,
          emit
        );
      } else {
        summary = await this.runIosInspection(
          scanId,
          scanRecord,
          artifactIdentity,
          capabilities,
          capBooleans,
          request,
          startedAt,
          startTime,
          emit
        );
      }

      workspace.cleanup();
      this.activeScans.delete(scanId);

      if (scanRecord.cancelled) {
        emit({
          type: 'scan.cancelled',
          scanId,
          reason: 'User cancelled scan',
          timestamp: new Date().toISOString(),
        });
        throw new Error('Scan was cancelled');
      }

      emit({
        type: 'scan.completed',
        scanId,
        summary,
        timestamp: new Date().toISOString(),
      });

      return summary;
    } catch (err: any) {
      workspace.cleanup();
      this.activeScans.delete(scanId);
      if (scanRecord.cancelled) {
        emit({
          type: 'scan.cancelled',
          scanId,
          reason: 'User cancelled scan',
          timestamp: new Date().toISOString(),
        });
        throw new Error('Scan was cancelled');
      }
      throw err;
    }
  }

  private detectArtifactType(filePath: string): { platform: Platform; artifactType: ArtifactType } {
    const ext = path.extname(filePath).toLowerCase();
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    fs.closeSync(fd);

    const isZip = header.readUInt32LE(0) === 0x04034b50;
    if (!isZip) {
      throw new Error(`File "${path.basename(filePath)}" is not a valid ZIP/mobile build archive (invalid magic bytes)`);
    }

    if (ext === '.aab') {
      return { platform: 'android', artifactType: 'aab' };
    }
    if (ext === '.ipa') {
      return { platform: 'ios', artifactType: 'ipa' };
    }
    if (ext === '.apk') {
      return { platform: 'android', artifactType: 'apk' };
    }

    // Inspect archive contents to disambiguate
    const zip = SafeZipReader.fromFile(filePath);
    if (zip.hasEntry('Payload/')) {
      return { platform: 'ios', artifactType: 'ipa' };
    }
    if (zip.hasEntry('base/manifest/AndroidManifest.xml') || zip.hasEntry('BundleConfig.pb')) {
      return { platform: 'android', artifactType: 'aab' };
    }
    if (zip.hasEntry('AndroidManifest.xml')) {
      return { platform: 'android', artifactType: 'apk' };
    }

    return { platform: 'android', artifactType: 'apk' };
  }

  private async runAndroidInspection(
    scanId: string,
    scanRecord: { cancelled: boolean },
    artifact: ArtifactIdentity,
    capabilities: CapabilityReport,
    capBooleans: Record<string, boolean>,
    request: ScanRequest,
    startedAt: string,
    startTime: number,
    emit: (event: ScanEvent) => void
  ): Promise<ScanSummary> {
    const totalStages = 9;
    const stages: ValidationStage[] = [];

    const executeStage = async (
      stageNumber: number,
      stageId: ValidationStageId,
      stageName: string,
      fn: () => Promise<CheckResult[]>
    ): Promise<ValidationStage> => {
      if (scanRecord.cancelled) throw new Error('Scan cancelled');

      const stageStart = new Date().toISOString();
      emit({
        type: 'stage.started',
        scanId,
        stageId,
        stageName,
        stageNumber,
        totalStages,
        timestamp: stageStart,
      });

      let stage: ValidationStage;
      try {
        const checks = await fn();
        const compTime = new Date().toISOString();
        stage = {
          id: stageId,
          name: stageName,
          stageNumber,
          totalStages,
          lifecycle: 'completed',
          startedAt: stageStart,
          completedAt: compTime,
          checks,
        };
        emit({ type: 'stage.completed', scanId, stage, timestamp: compTime });
      } catch (err: any) {
        const errTime = new Date().toISOString();
        stage = {
          id: stageId,
          name: stageName,
          stageNumber,
          totalStages,
          lifecycle: 'error',
          startedAt: stageStart,
          completedAt: errTime,
          checks: [],
          error: err.message,
        };
        emit({ type: 'stage.error', scanId, stageId, error: err.message, timestamp: errTime });
      }

      stages.push(stage);
      return stage;
    };

    // Stage 1: Validate artifact
    const fileBuffer = fs.readFileSync(artifact.path);
    const zipReader = new SafeZipReader(fileBuffer);
    const isAab = artifact.artifactType === 'aab';

    await executeStage(1, 'android-validate-artifact', 'Validate artifact', async () => {
      const requiredFile = isAab ? 'base/manifest/AndroidManifest.xml' : 'AndroidManifest.xml';
      const hasManifest = zipReader.hasEntry(requiredFile) || zipReader.hasEntry('AndroidManifest.xml');

      const check: CheckResult = {
        checkId: 'CHK-AND-ARCHIVE-INTEGRITY',
        name: 'Archive Structure and Integrity',
        outcome: hasManifest ? 'pass' : 'fail',
        findings: hasManifest
          ? []
          : [
              {
                id: `find-${Date.now()}`,
                ruleId: 'RULE-AND-PKG-001',
                ruleRevision: '2026.1',
                title: 'Missing Required Manifest',
                severity: 'blocker',
                outcome: 'fail',
                evidence: `Archive missing expected manifest entry: "${requiredFile}"`,
                whyItMatters: 'An Android build without a manifest cannot be installed or submitted.',
                suggestedRemediation: 'Rebuild your project with a valid AndroidManifest.xml.',
              },
            ],
      };
      return [check];
    });

    const manifestPath = isAab && zipReader.hasEntry('base/manifest/AndroidManifest.xml')
      ? 'base/manifest/AndroidManifest.xml'
      : 'AndroidManifest.xml';

    const manifestBuf = zipReader.readEntry(manifestPath);
    const parsedXml = manifestBuf ? parseAxml(manifestBuf) : null;
    const manifestData = parsedXml
      ? extractManifestMetadata(parsedXml)
      : {
          packageId: 'com.unknown.app',
          versionCode: 1,
          versionName: '1.0.0',
          minSdkVersion: 21,
          targetSdkVersion: 34,
          maxSdkVersion: null,
          maxSdkVersionDeclared: false,
          appLabel: undefined,
          debuggable: { value: false, isExplicit: false },
          testOnly: { value: false, isExplicit: false },
          usesCleartextTraffic: null,
          networkSecurityConfigPresent: false,
          permissions: [],
          features: [],
          components: [],
        };

    // Stage 2: Read app information
    await executeStage(2, 'android-read-app-info', 'Read app information', async () => {
      const check: CheckResult = {
        checkId: 'CHK-AND-APP-INFO',
        name: 'Application Identity and Versioning',
        outcome: manifestData.packageId ? 'pass' : 'fail',
        findings: [],
        details: `Package: ${manifestData.packageId}, Version: ${manifestData.versionName} (${manifestData.versionCode})`,
      };
      return [check];
    });

    // Stage 3: Read OS and device declarations
    await executeStage(3, 'android-read-os-device', 'Read OS and device declarations', async () => {
      const dummyMeta: Partial<AndroidMetadata> = {
        platform: 'android',
        minSdkVersion: manifestData.minSdkVersion,
        targetSdkVersion: manifestData.targetSdkVersion,
        maxSdkVersion: manifestData.maxSdkVersion,
        maxSdkVersionDeclared: manifestData.maxSdkVersionDeclared,
      };

      const resTarget = androidTargetSdkRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resMin = androidMinSdkRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resMax = androidMaxSdkRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-AND-TARGET-SDK',
          name: 'Target SDK Level',
          outcome: resTarget.outcome,
          findings: [createFindingFromRule(androidTargetSdkRule, resTarget)],
        },
        {
          checkId: 'CHK-AND-MIN-SDK',
          name: 'Minimum SDK Level',
          outcome: resMin.outcome,
          findings: [createFindingFromRule(androidMinSdkRule, resMin)],
        },
        {
          checkId: 'CHK-AND-MAX-SDK',
          name: 'Max SDK Declaration',
          outcome: resMax.outcome,
          findings: [createFindingFromRule(androidMaxSdkRule, resMax)],
        },
      ];
    });

    // Stage 4: Inspect release configuration
    await executeStage(4, 'android-inspect-release-config', 'Inspect release configuration', async () => {
      const dummyMeta: Partial<AndroidMetadata> = {
        platform: 'android',
        debuggable: manifestData.debuggable,
        testOnly: manifestData.testOnly,
      };

      const resDebug = androidDebuggableRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resTest = androidTestOnlyRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-AND-DEBUGGABLE',
          name: 'Debuggable Flag',
          outcome: resDebug.outcome,
          findings: [createFindingFromRule(androidDebuggableRule, resDebug)],
        },
        {
          checkId: 'CHK-AND-TESTONLY',
          name: 'Test-Only Flag',
          outcome: resTest.outcome,
          findings: [createFindingFromRule(androidTestOnlyRule, resTest)],
        },
      ];
    });

    // Stage 5: Inspect signing
    const metaInfSignEntry = zipReader.getEntries().find((e: ZipEntryHeader) =>
      e.fileName.startsWith('META-INF/') && (e.fileName.endsWith('.RSA') || e.fileName.endsWith('.EC'))
    );
    const metaInfCert = metaInfSignEntry ? (zipReader.readEntry(metaInfSignEntry.fileName) ?? undefined) : undefined;

    const signingInfo = synthesizeAndroidSigningInfo({
      isAab,
      hasMetaInfSignature: zipReader.getEntries().some((e: ZipEntryHeader) =>
        e.fileName.startsWith('META-INF/') && (e.fileName.endsWith('.RSA') || e.fileName.endsWith('.EC') || e.fileName.endsWith('.SF'))
      ),
      apkSigBlock: inspectApkSigningBlock(fileBuffer),
      metaInfCert,
    });

    if (!isAab && capabilities.apksigner.available && capabilities.apksigner.path) {
      try {
        const apksignerRes = await verifyWithApksigner(capabilities.apksigner.path, artifact.path);
        if (apksignerRes.verified) {
          signingInfo.signingVerified = true;
          signingInfo.schemeV1 = apksignerRes.v1;
          signingInfo.schemeV2 = apksignerRes.v2;
          signingInfo.schemeV3 = apksignerRes.v3;
          signingInfo.schemeV4 = apksignerRes.v4;
        }
      } catch {
        // Fall back to built-in inspection
      }
    }

    await executeStage(5, 'android-inspect-signing', 'Inspect signing', async () => {
      const dummyMeta: Partial<AndroidMetadata> = {
        platform: 'android',
        signing: signingInfo,
      };

      const resApk = androidApkSigningSchemeRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resAab = androidAabSigningRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-AND-SIGNING-SCHEMES',
          name: isAab ? 'AAB Bundle Signing Verification' : 'APK Signature Schemes v2/v3',
          outcome: isAab ? resAab.outcome : resApk.outcome,
          findings: [createFindingFromRule(isAab ? androidAabSigningRule : androidApkSigningSchemeRule, isAab ? resAab : resApk)],
        },
      ];
    });

    // Stage 6: Inspect native libraries
    const entries = zipReader.getEntries();
    const soEntries = entries.filter((e: ZipEntryHeader) => e.fileName.endsWith('.so'));
    const nativeLibs = soEntries.map((e: ZipEntryHeader) => {
      const buf = zipReader.readEntry(e.fileName) || Buffer.alloc(0);
      return toNativeLibraryInfo(e.fileName, buf);
    });

    const abis: string[] = Array.from(new Set(nativeLibs.map((l) => l.abi))).filter((a) => a !== 'unknown');
    const has64Bit = abis.some((a) => a === 'arm64-v8a' || a === 'x86_64');
    const all16KbAligned = nativeLibs.length > 0 ? nativeLibs.every((l) => l.is16KbAligned === true) : true;

    let packagingAlignmentOk: boolean | null = null;
    if (!isAab && capabilities.zipalign.available && capabilities.zipalign.path) {
      try {
        const za = await verifyWithZipalign(capabilities.zipalign.path, artifact.path);
        packagingAlignmentOk = za.aligned;
      } catch {
        packagingAlignmentOk = null;
      }
    }

    const nativeSummary: NativeLibrarySummary = {
      abis,
      has64BitCoverage: has64Bit,
      libraries: nativeLibs,
      allLibraries16KbAligned: nativeLibs.length > 0 ? all16KbAligned : null,
      packagingAlignmentOk,
      alignmentReport: nativeLibs.length > 0
        ? `Audited ${nativeLibs.length} native libraries.`
        : 'No native code found.',
    };

    await executeStage(6, 'android-inspect-native-libs', 'Inspect native libraries', async () => {
      const dummyMeta: Partial<AndroidMetadata> = {
        platform: 'android',
        signing: signingInfo,
        nativeLibraries: nativeSummary,
      };

      const res64 = androidNative64BitRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const res16k = android16KbPageAlignmentRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resPkgAlign = androidPackagingAlignmentRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-AND-64BIT',
          name: '64-Bit Architecture Coverage',
          outcome: res64.outcome,
          findings: [createFindingFromRule(androidNative64BitRule, res64)],
        },
        {
          checkId: 'CHK-AND-16KB-ALIGNMENT',
          name: '16 KB ELF Page Alignment',
          outcome: res16k.outcome,
          findings: [createFindingFromRule(android16KbPageAlignmentRule, res16k)],
        },
        {
          checkId: 'CHK-AND-ZIP-ALIGNMENT',
          name: 'Packaging Zip Alignment',
          outcome: resPkgAlign.outcome,
          findings: [createFindingFromRule(androidPackagingAlignmentRule, resPkgAlign)],
        },
      ];
    });

    // Stage 7: Review permissions and security configuration
    const sensitivePerms = [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
    ];
    const restrictedPerms = [
      'android.permission.MANAGE_EXTERNAL_STORAGE',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.READ_CALL_LOG',
      'android.permission.READ_SMS',
      'android.permission.SEND_SMS',
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.PACKAGE_USAGE_STATS',
    ];

    const declaredPerms = manifestData.permissions;
    const detectedSensitive = declaredPerms.filter((p) => sensitivePerms.includes(p));
    const detectedRestricted = declaredPerms.filter((p) => restrictedPerms.includes(p));

    const exportedComps = manifestData.components.map((c) => ({
      type: c.type,
      name: c.name,
      exported: c.exported,
      permissionRequired: c.permission,
      isSuspectedVulnerable: c.exported && !c.permission && !c.hasIntentFilter,
    }));

    await executeStage(7, 'android-review-permissions-security', 'Review permissions and security configuration', async () => {
      const dummyMeta: Partial<AndroidMetadata> = {
        platform: 'android',
        permissions: {
          declared: declaredPerms,
          sensitivePermissions: detectedSensitive,
          requiresSpecialApproval: detectedRestricted,
        },
        security: {
          usesCleartextTraffic: manifestData.usesCleartextTraffic,
          networkSecurityConfigPresent: manifestData.networkSecurityConfigPresent,
          exportedComponents: exportedComps,
        },
      };

      const resClear = androidCleartextTrafficRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resPerms = androidSensitivePermissionsRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resExp = androidExportedComponentsRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-AND-CLEARTEXT',
          name: 'Cleartext HTTP Traffic Policy',
          outcome: resClear.outcome,
          findings: [createFindingFromRule(androidCleartextTrafficRule, resClear)],
        },
        {
          checkId: 'CHK-AND-PERMISSIONS',
          name: 'Sensitive and High-Risk Permissions',
          outcome: resPerms.outcome,
          findings: [createFindingFromRule(androidSensitivePermissionsRule, resPerms)],
        },
        {
          checkId: 'CHK-AND-EXPORTED',
          name: 'Exported Component Security',
          outcome: resExp.outcome,
          findings: [createFindingFromRule(androidExportedComponentsRule, resExp)],
        },
      ];
    });

    // Stage 8: Review packaging
    const packagingData = analyzePackaging(
      artifact.sizeBytes,
      entries.map((e: ZipEntryHeader) => ({
        path: e.fileName,
        uncompressedSizeBytes: e.uncompressedSize,
        compressedSizeBytes: e.compressedSize,
      }))
    );

    await executeStage(8, 'android-review-packaging', 'Review packaging', async () => {
      const dummyMeta: Partial<AndroidMetadata> = {
        platform: 'android',
        signing: signingInfo,
        packaging: packagingData,
      };

      const resFormat = androidAabSubmissionFormatRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });
      const resSize = androidArchiveSizeRule.evaluate({
        metadata: dummyMeta as AndroidMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-AND-PKG-FORMAT',
          name: 'Google Play Submission Format',
          outcome: resFormat.outcome,
          findings: [createFindingFromRule(androidAabSubmissionFormatRule, resFormat)],
        },
        {
          checkId: 'CHK-AND-PKG-SIZE',
          name: 'Artifact Size Breakdown',
          outcome: resSize.outcome,
          findings: [createFindingFromRule(androidArchiveSizeRule, resSize)],
        },
      ];
    });

    // Assemble final AndroidMetadata
    const androidMetadata: AndroidMetadata = {
      platform: 'android',
      packageId: manifestData.packageId,
      appLabel: manifestData.appLabel,
      versionName: manifestData.versionName,
      versionCode: manifestData.versionCode,
      minSdkVersion: manifestData.minSdkVersion,
      targetSdkVersion: manifestData.targetSdkVersion,
      maxSdkVersion: manifestData.maxSdkVersion,
      maxSdkVersionDeclared: manifestData.maxSdkVersionDeclared,
      hardwareFeatures: manifestData.features,
      debuggable: manifestData.debuggable,
      testOnly: manifestData.testOnly,
      signing: signingInfo,
      nativeLibraries: nativeSummary,
      permissions: {
        declared: declaredPerms,
        sensitivePermissions: detectedSensitive,
        requiresSpecialApproval: detectedRestricted,
      },
      security: {
        usesCleartextTraffic: manifestData.usesCleartextTraffic,
        networkSecurityConfigPresent: manifestData.networkSecurityConfigPresent,
        exportedComponents: exportedComps,
      },
      packaging: packagingData,
    };

    // Stage 9: Generate store guidance and assessment
    const storeGuidance = generateStoreGuidance(
      'android',
      { android: androidMetadata },
      request.userAppInfo
    );

    const assessment = computeAssessment(stages, capabilities);

    await executeStage(9, 'android-store-guidance', 'Generate store guidance and assessment', async () => {
      return [
        {
          checkId: 'CHK-AND-STORE-GUIDANCE',
          name: 'Release Readiness & Listing Guidance Generation',
          outcome: assessment.status === 'ACTION REQUIRED' ? 'fail' : assessment.status === 'REVIEW REQUIRED' ? 'needs-review' : 'pass',
          findings: [],
          details: `Readiness: ${assessment.status}. ${storeGuidance.checklist.length} checklist items generated.`,
        },
      ];
    });

    const completedAt = new Date().toISOString();
    return {
      scanId,
      artifact,
      metadata: { android: androidMetadata },
      stages,
      assessment,
      storeGuidance,
      startedAt,
      completedAt,
      elapsedMs: Date.now() - startTime,
    };
  }

  private async runIosInspection(
    scanId: string,
    scanRecord: { cancelled: boolean },
    artifact: ArtifactIdentity,
    capabilities: CapabilityReport,
    capBooleans: Record<string, boolean>,
    request: ScanRequest,
    startedAt: string,
    startTime: number,
    emit: (event: ScanEvent) => void
  ): Promise<ScanSummary> {
    const totalStages = 8;
    const stages: ValidationStage[] = [];

    const executeStage = async (
      stageNumber: number,
      stageId: ValidationStageId,
      stageName: string,
      fn: () => Promise<CheckResult[]>
    ): Promise<ValidationStage> => {
      if (scanRecord.cancelled) throw new Error('Scan cancelled');

      const stageStart = new Date().toISOString();
      emit({
        type: 'stage.started',
        scanId,
        stageId,
        stageName,
        stageNumber,
        totalStages,
        timestamp: stageStart,
      });

      let stage: ValidationStage;
      try {
        const checks = await fn();
        const compTime = new Date().toISOString();
        stage = {
          id: stageId,
          name: stageName,
          stageNumber,
          totalStages,
          lifecycle: 'completed',
          startedAt: stageStart,
          completedAt: compTime,
          checks,
        };
        emit({ type: 'stage.completed', scanId, stage, timestamp: compTime });
      } catch (err: any) {
        const errTime = new Date().toISOString();
        stage = {
          id: stageId,
          name: stageName,
          stageNumber,
          totalStages,
          lifecycle: 'error',
          startedAt: stageStart,
          completedAt: errTime,
          checks: [],
          error: err.message,
        };
        emit({ type: 'stage.error', scanId, stageId, error: err.message, timestamp: errTime });
      }

      stages.push(stage);
      return stage;
    };

    // Stage 1: Validate IPA archive and Payload structure
    const fileBuffer = fs.readFileSync(artifact.path);
    const zipReader = new SafeZipReader(fileBuffer);
    let appBundleDir = '';

    await executeStage(1, 'ios-validate-artifact', 'Validate IPA archive and Payload structure', async () => {
      const entries = zipReader.getEntries();
      const payloadEntry = entries.find((e: ZipEntryHeader) => e.fileName.startsWith('Payload/') && e.fileName.includes('.app/'));
      if (!payloadEntry) {
        return [
          {
            checkId: 'CHK-IOS-PAYLOAD',
            name: 'Payload Directory Verification',
            outcome: 'fail',
            findings: [
              {
                id: `find-${Date.now()}`,
                ruleId: 'RULE-IOS-BND-001',
                ruleRevision: '2026.1',
                title: 'Missing Payload Directory',
                severity: 'blocker',
                outcome: 'fail',
                evidence: 'IPA archive does not contain a standard Payload/<App>.app directory structure.',
                whyItMatters: 'iOS IPA packages must strictly adhere to the Payload structure for device installation and App Store ingestion.',
                suggestedRemediation: 'Ensure your build export or archive pipeline outputs a standard IPA structure.',
              },
            ],
          },
        ];
      }

      const match = payloadEntry.fileName.match(/Payload\/([^/]+\.app)\//);
      appBundleDir = match ? `Payload/${match[1]}/` : 'Payload/App.app/';

      return [
        {
          checkId: 'CHK-IOS-PAYLOAD',
          name: 'Payload Directory Verification',
          outcome: 'pass',
          findings: [],
          details: `Valid Payload structure located at: ${appBundleDir}`,
        },
      ];
    });

    const entries = zipReader.getEntries();
    const infoPlistPath = entries.find((e: ZipEntryHeader) => e.fileName.startsWith(appBundleDir) && e.fileName.endsWith('Info.plist'))?.fileName;
    const infoPlistBuffer = infoPlistPath ? (zipReader.readEntry(infoPlistPath) ?? undefined) : undefined;

    const provisionPath = entries.find((e: ZipEntryHeader) => e.fileName.startsWith(appBundleDir) && e.fileName.endsWith('embedded.mobileprovision'))?.fileName;
    const mobileProvisionBuffer = provisionPath ? (zipReader.readEntry(provisionPath) ?? undefined) : undefined;

    const privacyPath = entries.find((e: ZipEntryHeader) => e.fileName.startsWith(appBundleDir) && e.fileName.endsWith('PrivacyInfo.xcprivacy'))?.fileName;
    const privacyManifestBuffer = privacyPath ? (zipReader.readEntry(privacyPath) ?? undefined) : undefined;

    const hasCodeSig = entries.some((e: ZipEntryHeader) => e.fileName.startsWith(appBundleDir) && e.fileName.includes('_CodeSignature/'));

    const mainBinaryEntry = entries.find((e: ZipEntryHeader) => {
      if (!e.fileName.startsWith(appBundleDir)) return false;
      const rel = e.fileName.slice(appBundleDir.length);
      return !rel.includes('/') && !rel.includes('.');
    });
    const mainBinaryBuffer = mainBinaryEntry ? (zipReader.readEntry(mainBinaryEntry.fileName) ?? undefined) : undefined;

    const iosMetadata = inspectIpaData({
      archiveSizeBytes: artifact.sizeBytes,
      uncompressedSizeBytes: entries.reduce((acc: number, e: ZipEntryHeader) => acc + e.uncompressedSize, 0),
      entries: entries.map((e: ZipEntryHeader) => ({ path: e.fileName, sizeBytes: e.uncompressedSize })),
      infoPlistBuffer,
      mobileProvisionBuffer,
      privacyManifestBuffer,
      mainBinaryBuffer,
      hasCodeSignature: hasCodeSig,
    });

    // Stage 2: Read main app Info.plist
    await executeStage(2, 'ios-read-info-plist', 'Read main app Info.plist and nested bundles', async () => {
      return [
        {
          checkId: 'CHK-IOS-INFO-PLIST',
          name: 'Info.plist Parsing',
          outcome: infoPlistBuffer ? 'pass' : 'fail',
          findings: infoPlistBuffer
            ? []
            : [
                {
                  id: `find-${Date.now()}`,
                  ruleId: 'RULE-IOS-BND-001',
                  ruleRevision: '2026.1',
                  title: 'Missing Info.plist',
                  severity: 'blocker',
                  outcome: 'fail',
                  evidence: 'Could not locate Info.plist in main application bundle.',
                  whyItMatters: 'Info.plist defines runtime identities, icons, and permissions.',
                  suggestedRemediation: 'Rebuild the Xcode project to ensure Info.plist is packaged.',
                },
              ],
        },
      ];
    });

    // Stage 3: Extract Identity & Versions
    await executeStage(3, 'ios-extract-identity', 'Extract identity, versioning, and target devices', async () => {
      const resBnd = iosBundleIdentityRule.evaluate({
        metadata: iosMetadata,
        toolCapabilities: capBooleans,
      });
      const resDev = iosMinimumOsAndDevicesRule.evaluate({
        metadata: iosMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-IOS-BUNDLE-ID',
          name: 'Bundle Identifier and Versioning',
          outcome: resBnd.outcome,
          findings: [createFindingFromRule(iosBundleIdentityRule, resBnd)],
        },
        {
          checkId: 'CHK-IOS-DEVICES-MINOS',
          name: 'Minimum OS and Device Families',
          outcome: resDev.outcome,
          findings: [createFindingFromRule(iosMinimumOsAndDevicesRule, resDev)],
        },
      ];
    });

    // Stage 4: Inspect embedded frameworks, extensions, and architectures
    await executeStage(4, 'ios-inspect-frameworks-archs', 'Inspect embedded frameworks and architectures', async () => {
      const check: CheckResult = {
        checkId: 'CHK-IOS-FRAMEWORKS-ARCHS',
        name: 'Mach-O Architectures & Embedded Frameworks',
        outcome: iosMetadata.architectures.includes('arm64') ? 'pass' : 'needs-review',
        findings: [],
        details: `Architectures: [${iosMetadata.architectures.join(', ')}], Embedded Frameworks: ${iosMetadata.embeddedFrameworks.length}`,
      };
      return [check];
    });

    // Stage 5: Inspect purpose strings and transport security configuration
    await executeStage(5, 'ios-inspect-purpose-transport', 'Inspect purpose strings and transport security', async () => {
      const resATS = iosTransportSecurityRule.evaluate({
        metadata: iosMetadata,
        toolCapabilities: capBooleans,
      });
      const resPurp = iosPurposeStringsRule.evaluate({
        metadata: iosMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-IOS-ATS',
          name: 'App Transport Security (ATS)',
          outcome: resATS.outcome,
          findings: [createFindingFromRule(iosTransportSecurityRule, resATS)],
        },
        {
          checkId: 'CHK-IOS-PURPOSE-STRINGS',
          name: 'Privacy Purpose Descriptions',
          outcome: resPurp.outcome,
          findings: [createFindingFromRule(iosPurposeStringsRule, resPurp)],
        },
      ];
    });

    // Stage 6: Parse privacy manifests and check structure
    await executeStage(6, 'ios-parse-privacy-manifest', 'Parse privacy manifests and check structure', async () => {
      const resPriv = iosPrivacyManifestRule.evaluate({
        metadata: iosMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-IOS-PRIVACY-MANIFEST',
          name: 'Privacy Manifest Structure (PrivacyInfo.xcprivacy)',
          outcome: resPriv.outcome,
          findings: [createFindingFromRule(iosPrivacyManifestRule, resPriv)],
        },
      ];
    });

    // Stage 7: Inspect entitlements/signing where tools and artifact data allow
    await executeStage(7, 'ios-inspect-entitlements-signing', 'Inspect entitlements and code signature', async () => {
      const resSign = iosSigningAndProvisioningRule.evaluate({
        metadata: iosMetadata,
        toolCapabilities: capBooleans,
      });

      return [
        {
          checkId: 'CHK-IOS-SIGNING-PROVISIONING',
          name: 'Code Signing & Provisioning Profile',
          outcome: resSign.outcome,
          findings: [createFindingFromRule(iosSigningAndProvisioningRule, resSign)],
        },
      ];
    });

    // Stage 8: Generate store guidance and assessment
    const storeGuidance = generateStoreGuidance(
      'ios',
      { ios: iosMetadata },
      request.userAppInfo
    );

    const assessment = computeAssessment(stages, capabilities);

    await executeStage(8, 'ios-store-guidance', 'Generate store guidance and assessment', async () => {
      return [
        {
          checkId: 'CHK-IOS-STORE-GUIDANCE',
          name: 'Release Readiness & Listing Guidance Generation',
          outcome: assessment.status === 'ACTION REQUIRED' ? 'fail' : assessment.status === 'REVIEW REQUIRED' ? 'needs-review' : 'pass',
          findings: [],
          details: `Readiness: ${assessment.status}. ${storeGuidance.checklist.length} checklist items generated.`,
        },
      ];
    });

    const completedAt = new Date().toISOString();
    return {
      scanId,
      artifact,
      metadata: { ios: iosMetadata },
      stages,
      assessment,
      storeGuidance,
      startedAt,
      completedAt,
      elapsedMs: Date.now() - startTime,
    };
  }
}
