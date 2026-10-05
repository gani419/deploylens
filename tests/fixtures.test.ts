import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeployLensEngine } from '@deploylens/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Fixture Parsing and Real Inspection', () => {
  const engine = new DeployLensEngine();

  it('correctly inspects valid Android APK fixture', async () => {
    const apkPath = path.join(fixturesDir, 'android', 'valid-app.apk');
    const summary = await engine.inspectArtifact({ artifactPath: apkPath });

    expect(summary.artifact.platform).toBe('android');
    expect(summary.artifact.artifactType).toBe('apk');
    expect(summary.metadata.android?.packageId).toBe('com.deploylens.sample');
    expect(summary.metadata.android?.targetSdkVersion).toBe(35);
    expect(summary.metadata.android?.minSdkVersion).toBe(24);
    expect(summary.metadata.android?.maxSdkVersionDeclared).toBe(false);
    expect(summary.metadata.android?.nativeLibraries.has64BitCoverage).toBe(true);
    expect(summary.metadata.android?.nativeLibraries.allLibraries16KbAligned).toBe(true);
  });

  it('correctly inspects valid Android AAB bundle fixture', async () => {
    const aabPath = path.join(fixturesDir, 'android', 'test-app.aab');
    const summary = await engine.inspectArtifact({ artifactPath: aabPath });

    expect(summary.artifact.platform).toBe('android');
    expect(summary.artifact.artifactType).toBe('aab');
    expect(summary.metadata.android?.signing.isBundleSigning).toBe(true);
    expect(summary.metadata.android?.signing.signingVerified).toBe(true);
    expect(summary.metadata.android?.signing.signers.length).toBeGreaterThan(0);
    // AAB should satisfy AAB submission format rule
    const aabRuleFinding = summary.stages
      .flatMap((s) => s.checks.flatMap((c) => c.findings))
      .find((f) => f.ruleId === 'RULE-AND-PKG-001');
    expect(aabRuleFinding?.outcome).toBe('pass');
  });

  it('flags blockers on debuggable-app.apk', async () => {
    const debugApkPath = path.join(fixturesDir, 'android', 'debuggable-app.apk');
    const summary = await engine.inspectArtifact({ artifactPath: debugApkPath });

    expect(summary.assessment.status).toBe('ACTION REQUIRED');
    expect(summary.assessment.blockerCount).toBeGreaterThan(0);

    const findings = summary.stages.flatMap((s) => s.checks.flatMap((c) => c.findings));
    const debugFinding = findings.find((f) => f.ruleId === 'RULE-AND-REL-001');
    expect(debugFinding?.outcome).toBe('fail');

    const testOnlyFinding = findings.find((f) => f.ruleId === 'RULE-AND-REL-002');
    expect(testOnlyFinding?.outcome).toBe('fail');

    const nat64Finding = findings.find((f) => f.ruleId === 'RULE-AND-NAT-001');
    expect(nat64Finding?.outcome).toBe('fail'); // 32-bit only without 64-bit
  });

  it('correctly inspects valid iOS IPA fixture', async () => {
    const ipaPath = path.join(fixturesDir, 'ios', 'valid-app.ipa');
    const summary = await engine.inspectArtifact({ artifactPath: ipaPath });

    expect(summary.artifact.platform).toBe('ios');
    expect(summary.artifact.artifactType).toBe('ipa');
    expect(summary.metadata.ios?.bundleIdentifier).toBe('com.deploylens.sampleios');
    expect(summary.metadata.ios?.marketingVersion).toBe('1.2.0');
    expect(summary.metadata.ios?.buildNumber).toBe('42');
    expect(summary.metadata.ios?.minimumOsVersion).toBe('16.0');
    expect(summary.metadata.ios?.declaredDeviceFamilies).toContain('iPhone');
    expect(summary.metadata.ios?.declaredDeviceFamilies).toContain('iPad');
    expect(summary.metadata.ios?.privacyManifest.present).toBe(true);
    expect(summary.metadata.ios?.signing.provisioningProfilePresent).toBe(true);
  });

  it('rejects corrupt non-zip file cleanly', async () => {
    const corruptPath = path.join(fixturesDir, 'corrupt', 'corrupt.apk');
    await expect(engine.inspectArtifact({ artifactPath: corruptPath })).rejects.toThrow(
      /not a valid ZIP/i
    );
  });

  it('detects and blocks path traversal attempts', async () => {
    const traversalPath = path.join(fixturesDir, 'corrupt', 'traversal.apk');
    await expect(engine.inspectArtifact({ artifactPath: traversalPath })).rejects.toThrow(
      /Security violation: Archive entry contains path traversal/i
    );
  });
});
