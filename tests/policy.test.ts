import { describe, expect, it } from 'vitest';
import type { AndroidMetadata, IosMetadata } from '@deploylens/contracts';
import { androidTargetSdkRule, iosBuildSdkRule, iosSigningAndProvisioningRule } from '@deploylens/rules';

describe('October 2026 submission policies', () => {
  it.each([[34, 'fail'], [35, 'fail'], [36, 'pass'], [37, 'pass']])('checks phone target API %s', (target, outcome) => {
    expect(androidTargetSdkRule.evaluate({ metadata: { targetSdkVersion: target, hardwareFeatures: [] } as unknown as AndroidMetadata, toolCapabilities: {} }).outcome).toBe(outcome);
  });
  it.each([['android.hardware.type.watch', 35], ['android.hardware.type.automotive', 35], ['android.software.leanback', 34], ['android.software.xr.api.openxr', 34]])('applies category exception %s', (name, target) => {
    const metadata = { targetSdkVersion: target, hardwareFeatures: [{ name, required: true }] } as unknown as AndroidMetadata;
    expect(androidTargetSdkRule.evaluate({ metadata, toolCapabilities: {} }).outcome).toBe('pass');
    metadata.hardwareFeatures[0]!.required = false;
    expect(androidTargetSdkRule.evaluate({ metadata, toolCapabilities: {} }).outcome).toBe('fail');
  });
  it.each([['iphoneos17.2', 'fail'], ['iphoneos26.0', 'pass'], ['iphoneos27.0', 'pass'], [undefined, 'not-checked'], ['iphonesimulator26.0', 'not-checked']])('checks build SDK %s independently of deployment minimum', (sdkName, outcome) => {
    const metadata = { minimumOsVersion: '16.0', buildSdkMetadata: { sdkName } } as IosMetadata;
    expect(iosBuildSdkRule.evaluate({ metadata, toolCapabilities: {} }).outcome).toBe(outcome);
  });
  it('does not pass signing merely because macOS tools exist', () => {
    const metadata = { signing: { isSigned: true, provisioningProfilePresent: true, provisioningProfileType: 'app-store', codesignCheckOutcome: 'not-checked', limitations: [] } } as IosMetadata;
    expect(iosSigningAndProvisioningRule.evaluate({ metadata, toolCapabilities: { codesign: true } }).outcome).toBe('not-checked');
  });
  it.each(['development', 'ad-hoc', 'enterprise'])('rejects %s profiles even without macOS tools', type => {
    const metadata = { signing: { isSigned: true, provisioningProfilePresent: true, provisioningProfileType: type, codesignCheckOutcome: 'not-checked', limitations: [] } } as IosMetadata;
    expect(iosSigningAndProvisioningRule.evaluate({ metadata, toolCapabilities: {} }).outcome).toBe('fail');
  });
});
