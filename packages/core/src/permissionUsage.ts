import type { CheckResult, Finding, PermissionUsageAudit, Platform } from '@deploylens/contracts';
import type { SafeZipReader, ZipEntryHeader } from './safeZip.js';

interface Spec { feature: string; declaration: string; alternatives?: string[]; markers: string[][] }
const android: Spec[] = [
  { feature: 'Camera', declaration: 'android.permission.CAMERA', markers: [['Landroid/hardware/Camera;'], ['Landroid/hardware/camera2/CameraManager;', 'openCamera'], ['android.permission.CAMERA', 'requestPermissions']] },
  { feature: 'Microphone', declaration: 'android.permission.RECORD_AUDIO', markers: [['Landroid/media/AudioRecord;'], ['android.permission.RECORD_AUDIO', 'requestPermissions']] },
  { feature: 'Contacts', declaration: 'android.permission.READ_CONTACTS', markers: [['android.permission.READ_CONTACTS', 'requestPermissions'], ['Landroid/provider/ContactsContract$Contacts;']] },
  { feature: 'Location', declaration: 'android.permission.ACCESS_FINE_LOCATION or ACCESS_COARSE_LOCATION', alternatives: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'], markers: [['Landroid/location/LocationManager;', 'requestLocationUpdates'], ['Lcom/google/android/gms/location/FusedLocationProviderClient;', 'getCurrentLocation']] },
  { feature: 'Photo library permission request', declaration: 'android.permission.READ_MEDIA_IMAGES or READ_EXTERNAL_STORAGE (OS-dependent)', alternatives: ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_EXTERNAL_STORAGE'], markers: [['android.permission.READ_MEDIA_IMAGES', 'requestPermissions'], ['android.permission.READ_EXTERNAL_STORAGE', 'requestPermissions']] },
];
const ios: Spec[] = [
  { feature: 'Camera', declaration: 'NSCameraUsageDescription', markers: [['AVCaptureDevice', 'AVMediaTypeVideo'], ['UIImagePickerController', 'isSourceTypeAvailable:']] },
  { feature: 'Microphone', declaration: 'NSMicrophoneUsageDescription', markers: [['requestRecordPermission:'], ['AVAudioRecorder']] },
  { feature: 'Photo library', declaration: 'NSPhotoLibraryUsageDescription', markers: [['PHPhotoLibrary', 'requestAuthorization:'], ['PHPhotoLibrary', 'requestAuthorizationForAccessLevel:']] },
  { feature: 'Location', declaration: 'NSLocationWhenInUseUsageDescription or NSLocationAlwaysAndWhenInUseUsageDescription', alternatives: ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription'], markers: [['CLLocationManager', 'requestWhenInUseAuthorization'], ['CLLocationManager', 'requestAlwaysAuthorization']] },
  { feature: 'Contacts', declaration: 'NSContactsUsageDescription', markers: [['CNContactStore', 'requestAccessForEntityType:completionHandler:']] },
];
export function auditPermissionReferences(platform: Platform, files: Array<{ path: string; bytes: Buffer }>, declarations: string[], skipped = 0): PermissionUsageAudit {
  const signals = new Map<string, PermissionUsageAudit['signals'][number]>();
  let runtimeRequestReference = false, settingsRedirectReference = false, systemPickerReference = false;
  for (const file of files) {
    const contains = (value: string) => file.bytes.includes(Buffer.from(value));
    runtimeRequestReference ||= (platform === 'android' ? ['requestPermissions'] : ['requestAccessForMediaType:', 'requestAuthorization', 'requestRecordPermission:']).some(contains);
    settingsRedirectReference ||= (platform === 'android' ? ['android.settings.APPLICATION_DETAILS_SETTINGS'] : ['UIApplicationOpenSettingsURLString', 'app-settings:']).some(contains);
    systemPickerReference ||= (platform === 'android' ? ['android.provider.action.PICK_IMAGES', 'android.intent.action.OPEN_DOCUMENT', 'PickVisualMedia'] : ['PHPickerViewController', 'PhotosPicker']).some(contains);
    for (const spec of platform === 'android' ? android : ios) {
      const matches = spec.markers.find(group => group.every(contains));
      if (!matches) continue;
      const signal = signals.get(spec.feature) || { feature: spec.feature, declaration: spec.declaration, declarationPresent: (spec.alternatives || [spec.declaration]).some(value => declarations.includes(value)), evidence: [] };
      if (signal.evidence.length < 8) signal.evidence.push(`${file.path}: ${matches.join(' + ')}`);
      signals.set(spec.feature, signal);
    }
  }
  return { method: 'static-reference-heuristic', filesScanned: files.length, filesSkipped: skipped, runtimeRequestReference, settingsRedirectReference, systemPickerReference, signals: [...signals.values()], limitations: [
    'References may come from unused code or bundled SDKs. They do not prove an API executes or that a store will reject the build.',
    'Allow, deny, permanently denied, settings-return and permission-revocation flows require device testing; references do not prove correct control flow.',
    platform === 'android' ? 'Only bounded DEX entries are searched. Native/JNI, Dart/AOT, reflection, encrypted or downloaded code and dynamic-feature manifests are not fully analyzed. A system photo picker or delegated camera intent may not require the same permissions as direct API access.' : 'Main executable and bounded embedded framework binaries are searched. App extensions, encrypted/stripped symbols, dynamically loaded code and precise camera-versus-microphone or photo access levels need further review. A system photo picker can avoid broad library permission.',
    'Missing references do not establish that a permission is unnecessary. Declaration presence does not establish that the purpose text is accurate or complete.',
  ] };
}
export function scanPermissionReferences(reader: SafeZipReader, entries: ZipEntryHeader[], platform: Platform, declarations: string[], mainBinary?: string): PermissionUsageAudit {
  // Bounds are independent of total archive size to avoid duplicating large payloads in memory.
  const files: Array<{ path: string; bytes: Buffer }> = [];
  let total = 0, skipped = 0;
  for (const entry of entries) {
    const eligible = platform === 'android' ? /(^|\/)classes\d*\.dex$/.test(entry.fileName) : entry.fileName === mainBinary || /\/Frameworks\/([^/]+)\.framework\/\1$/.test(entry.fileName);
    if (!eligible || (platform === 'ios' && entry.fileName.includes('.appex/'))) continue;
    if (entry.uncompressedSize > 32 * 1024 * 1024 || total + entry.uncompressedSize > 64 * 1024 * 1024 || files.length >= 32) { skipped++; continue; }
    try { const bytes = reader.readEntry(entry.fileName); if (bytes) { files.push({ path: entry.fileName, bytes }); total += bytes.length; } else skipped++; }
    catch { skipped++; }
  }
  return auditPermissionReferences(platform, files, declarations, skipped);
}
export function permissionUsageCheck(platform: Platform, audit: PermissionUsageAudit): CheckResult {
  const reference = platform === 'android' ? 'https://developer.android.com/training/permissions/requesting' : 'https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription';
  const findings: Finding[] = audit.signals.map(signal => ({
    id: `permission-usage-${platform}-${signal.feature}`, ruleId: `PERMISSION-USAGE-${platform}-${signal.feature.toUpperCase().replace(/\W+/g, '-')}`, ruleRevision: '2026.10.22',
    title: signal.declarationPresent ? `${signal.feature}: declaration found for referenced API` : `${signal.feature}: API references without a matching declaration`,
    severity: 'risk', outcome: signal.declarationPresent ? 'pass' : 'needs-review', isSuspectedHeuristic: true,
    affectedFileOrConfig: platform === 'android' ? 'AndroidManifest.xml' : 'Main application Info.plist',
    evidence: `${signal.evidence.join('; ')}. Required declaration to review: ${signal.declaration}. ${signal.declarationPresent ? 'A matching declaration was found.' : 'No matching non-empty declaration was extracted.'}`,
    whyItMatters: 'Direct access to protected APIs can fail, terminate the app, or trigger submission review when required declarations are missing. Permission requirements depend on the API, OS and access level.',
    suggestedRemediation: `Confirm whether these references execute in your app. If direct protected access is required, declare ${signal.declaration} in the final release configuration and implement the appropriate runtime request. Prefer a system picker for selected photos where suitable. Remove unused access instead of adding unnecessary permissions.`,
    officialReferenceUrl: reference, sourceReviewDate: '2026-10-22',
    guidance: { meaning: 'This is a possible code-to-declaration mismatch inferred from binary references, not a confirmed runtime failure or automatic store rejection.', steps: ['Find the referenced API or SDK and reproduce the feature on a test device.', `Confirm the appropriate declaration and access level: ${signal.declaration}.`, 'Rebuild the release archive and inspect it again.'], verification: ['Test fresh install, allow, deny, repeated denial, settings return and permission revocation.', 'Test camera capture and system gallery picker independently on supported OS versions.'], limitation: audit.limitations.join(' ') },
  }));
  findings.push({ id: `permission-flow-${platform}`, ruleId: `PERMISSION-RUNTIME-FLOW-${platform}`, ruleRevision: '2026.10.22', title: 'Runtime permission flow requires device verification', severity: 'info', outcome: 'not-checked', evidence: `${audit.filesScanned} binaries scanned; ${audit.filesSkipped} skipped. Request reference: ${audit.runtimeRequestReference}. Settings reference: ${audit.settingsRedirectReference}. System picker reference: ${audit.systemPickerReference}. No runtime flow was executed.`, whyItMatters: 'An archive cannot prove that allow/deny/settings handling works on a device.', suggestedRemediation: 'Exercise permission-dependent features from a clean install, including denial, settings changes and returning to the app.', officialReferenceUrl: reference, applicabilityNote: audit.limitations.join(' ') });
  return { checkId: `CHK-${platform.toUpperCase()}-PERMISSION-USAGE`, name: 'API references versus permission declarations', outcome: findings.some(finding => finding.outcome === 'needs-review') ? 'needs-review' : 'not-checked', findings };
}
