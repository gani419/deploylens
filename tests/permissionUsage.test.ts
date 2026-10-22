import { describe, expect, it } from 'vitest';
import { auditPermissionReferences, permissionUsageCheck, scanPermissionReferences } from '../packages/core/src/permissionUsage.js';
import { SafeZipReader } from '../packages/core/src/safeZip.js';
import { zip } from './helpers/zip.js';

const binary = (text: string) => [{ path: 'classes.dex', bytes: Buffer.from(text) }];
describe('Permission usage diagnostic scope', () => {
  it('flags camera references with missing manifest permission as suspected rather than confirmed failure', () => {
    const audit = auditPermissionReferences('android', binary('Landroid/hardware/camera2/CameraManager; openCamera requestPermissions android.settings.APPLICATION_DETAILS_SETTINGS'), []);
    expect(audit.signals[0]?.declarationPresent).toBe(false); expect(audit.runtimeRequestReference).toBe(true); expect(audit.settingsRedirectReference).toBe(true);
    const check = permissionUsageCheck('android', audit); expect(check.outcome).toBe('needs-review'); expect(check.findings[0]?.isSuspectedHeuristic).toBe(true);
    expect(check.findings.some(finding => finding.outcome === 'fail')).toBe(false);
  });
  it('does not call a valid declaration proof of runtime permission handling', () => {
    const audit = auditPermissionReferences('android', binary('Landroid/hardware/Camera;'), ['android.permission.CAMERA']);
    expect(audit.signals[0]?.declarationPresent).toBe(true); expect(permissionUsageCheck('android', audit).outcome).toBe('not-checked');
  });
  it('accepts permission-free system photo picker references without inventing a missing storage permission', () => {
    const audit = auditPermissionReferences('android', binary('PickVisualMedia android.provider.action.PICK_IMAGES'), []);
    expect(audit.systemPickerReference).toBe(true); expect(audit.signals).toHaveLength(0);
  });
  it('checks iOS usage descriptions against camera and photo library references', () => {
    const audit = auditPermissionReferences('ios', binary('AVCaptureDevice AVMediaTypeVideo PHPhotoLibrary requestAuthorization: app-settings:'), ['NSPhotoLibraryUsageDescription']);
    expect(audit.signals.find(signal => signal.feature === 'Camera')?.declarationPresent).toBe(false);
    expect(audit.signals.find(signal => signal.feature === 'Photo library')?.declarationPresent).toBe(true);
    expect(permissionUsageCheck('ios', audit).findings.some(finding => finding.title.includes('Camera') && finding.outcome === 'needs-review')).toBe(true);
  });
  it('does not infer direct photo library access from an iOS system picker alone', () => {
    const audit = auditPermissionReferences('ios', binary('PHPickerViewController PhotosPicker'), []);
    expect(audit.systemPickerReference).toBe(true); expect(audit.signals).toHaveLength(0);
  });
  it('keeps absent signatures and skipped binaries explicitly unverified', () => {
    const audit = auditPermissionReferences('android', [], [], 3);
    const check = permissionUsageCheck('android', audit); expect(check.outcome).toBe('not-checked'); expect(check.findings[0]?.evidence).toContain('3 skipped');
  });
  it('finds references in actual archive entries, including multidex modules', () => {
    const reader = new SafeZipReader(zip([{ name: 'base/dex/classes2.dex', data: Buffer.from('Landroid/hardware/Camera;') }, { name: 'assets/strings.txt', data: Buffer.from('Landroid/media/AudioRecord;') }]));
    const audit = scanPermissionReferences(reader, reader.getEntries(), 'android', []);
    expect(audit.filesScanned).toBe(1); expect(audit.signals.map(signal => signal.feature)).toEqual(['Camera']);
  });
});
