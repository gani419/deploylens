import { describe, expect, it } from 'vitest';
import { resolveArscLabel, resolveProtoLabel, parseProtoManifest, parseAxml, extractManifestMetadata, runToolSafe } from '@deploylens/android';
import { DeployLensEngine, SafeZipReader } from '@deploylens/core';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pb, message } from './helpers/proto.js';
import { zip } from './helpers/zip.js';

const resourceId = 0x7f010000;
function protoResources() {
  const defaultValue = pb(6, pb(2, pb(4, pb(2, pb(1, 'Real App Name')))));
  const localized = pb(6, message(pb(1, pb(3, 'fr')), pb(2, pb(4, pb(2, pb(1, 'Nom localisé'))))));
  const entry = pb(3, message(pb(1, Buffer.alloc(0)), pb(2, 'app_name'), localized, defaultValue));
  return pb(2, message(pb(1, pb(1, 0x7f)), pb(3, message(pb(1, pb(1, 1)), pb(2, 'string'), entry))));
}
function protoManifest() {
  const attr = (name: string, value: string) => pb(4, message(pb(2, name), pb(3, value)));
  const label = pb(4, message(pb(2, 'label'), pb(6, pb(1, pb(2, resourceId)))));
  const application = pb(5, pb(1, message(pb(3, 'application'), label)));
  return pb(1, message(pb(3, 'manifest'), attr('package', 'com.test.realapp'), attr('versionCode', '12'), attr('versionName', '2.1'), application));
}
function stringPool(strings: string[]) {
  const data = strings.map(value => { const bytes = Buffer.from(value); return Buffer.concat([Buffer.from([value.length, bytes.length]), bytes, Buffer.from([0])]); });
  const start = 28 + strings.length * 4;
  const size = Math.ceil((start + data.reduce((n, bytes) => n + bytes.length, 0)) / 4) * 4;
  const result = Buffer.alloc(size); result.writeUInt16LE(1); result.writeUInt16LE(28, 2); result.writeUInt32LE(size, 4); result.writeUInt32LE(strings.length, 8); result.writeUInt32LE(256, 16); result.writeUInt32LE(start, 20);
  let offset = 0; data.forEach((bytes, index) => { result.writeUInt32LE(offset, 28 + index * 4); bytes.copy(result, start + offset); offset += bytes.length; });
  return result;
}
function arscResources() {
  const global = stringPool(['APK App Name']), names = stringPool(['string']), keys = stringPool(['app_name']);
  const type = Buffer.alloc(104); type.writeUInt16LE(0x0201); type.writeUInt16LE(84, 2); type.writeUInt32LE(type.length, 4); type[8] = 1; type.writeUInt32LE(1, 12); type.writeUInt32LE(88, 16); type.writeUInt32LE(64, 20);
  type.writeUInt16LE(8, 88); type.writeUInt16LE(8, 96); type[99] = 3;
  const pkg = Buffer.alloc(288); pkg.writeUInt16LE(0x0200); pkg.writeUInt16LE(288, 2); pkg.writeUInt32LE(pkg.length + names.length + keys.length + type.length, 4); pkg.writeUInt32LE(0x7f, 8); pkg.writeUInt32LE(288, 268); pkg.writeUInt32LE(288 + names.length, 276);
  const header = Buffer.alloc(12); header.writeUInt16LE(2); header.writeUInt16LE(12, 2); header.writeUInt32LE(12 + global.length + pkg.length + names.length + keys.length + type.length, 4); header.writeUInt32LE(1, 8);
  return Buffer.concat([header, global, pkg, names, keys, type]);
}

describe('App name and archive identity', () => {
  it('resolves real AAPT2 compiled APK and protobuf bundle resources', async context => {
    const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.USERPROFILE ?? os.homedir(), 'AppData/Local/Android/Sdk');
    const versions = await fs.readdir(path.join(sdk, 'build-tools')).catch(() => []);
    const latest = versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    const aapt2 = path.join(sdk, 'build-tools', latest ?? 'missing', process.platform === 'win32' ? 'aapt2.exe' : 'aapt2');
    const androidJar = path.join(sdk, 'platforms/android-36/android.jar');
    if (!(await fs.stat(aapt2).catch(() => null)) || !(await fs.stat(androidJar).catch(() => null))) { context.skip(); return; }
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deploylens-aapt-test-'));
    try {
      await fs.mkdir(path.join(directory, 'res/values'), { recursive: true });
      await fs.writeFile(path.join(directory, 'res/values/strings.xml'), '<resources><string name="app_name">AAPT Built App</string></resources>');
      await fs.writeFile(path.join(directory, 'AndroidManifest.xml'), '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.test.aapt" android:versionCode="1" android:versionName="1.0"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/><application android:label="@string/app_name"><profileable android:shell="true"/></application></manifest>');
      const compiled = path.join(directory, 'compiled.zip'), apk = path.join(directory, 'sample.apk'), proto = path.join(directory, 'proto.apk');
      const compile = await runToolSafe(aapt2, ['compile', '--dir', path.join(directory, 'res'), '-o', compiled]);
      expect(compile.success, compile.stderr).toBe(true);
      const linked = await runToolSafe(aapt2, ['link', '-I', androidJar, '--manifest', path.join(directory, 'AndroidManifest.xml'), '-o', apk, compiled]);
      expect(linked.success, linked.stderr).toBe(true);
      const reader = SafeZipReader.fromFile(apk);
      const metadata = extractManifestMetadata(parseAxml(reader.readEntry('AndroidManifest.xml')!)!);
      expect(metadata.targetSdkVersion).toBe(36);
      expect(metadata.profileableByShell).toBe(true);
      expect(resolveArscLabel(reader.readEntry('resources.arsc')!, metadata.appLabel!)).toBe('AAPT Built App');
      const converted = await runToolSafe(aapt2, ['convert', '--output-format', 'proto', '-o', proto, apk]);
      expect(converted.success, converted.stderr).toBe(true);
      const protoReader = SafeZipReader.fromFile(proto);
      const bundleMetadata = extractManifestMetadata(parseProtoManifest(protoReader.readEntry('AndroidManifest.xml')!)!);
      expect(resolveProtoLabel(protoReader.readEntry('resources.pb')!, bundleMetadata.appLabel!)).toBe('AAPT Built App');
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
  it('decodes compiled AAB label references and default resource entry zero', () => {
    const root = parseProtoManifest(protoManifest())!;
    expect(extractManifestMetadata(root).appLabel).toBe('@0x7f010000');
    expect(resolveProtoLabel(protoResources(), '@0x7f010000')).toBe('Real App Name');
    expect(resolveProtoLabel(protoResources(), '@string/app_name')).toBe('Real App Name');
    expect(resolveProtoLabel(protoResources(), '@string/missing')).toBeUndefined();
  });
  it('resolves APK resource IDs and named strings', () => {
    expect(resolveArscLabel(arscResources(), '@0x7f010000')).toBe('APK App Name');
    expect(resolveArscLabel(arscResources(), '@string/app_name')).toBe('APK App Name');
  });
  it('extracts the AAB app name into the actual report', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deploylens-name-test-'));
    try {
      const artifactPath = path.join(directory, 'uploaded-bundle.aab');
      await fs.writeFile(artifactPath, zip([{ name: 'base/manifest/AndroidManifest.xml', data: protoManifest() }, { name: 'base/resources.pb', data: protoResources() }]));
      const report = await new DeployLensEngine().inspectArtifact({ artifactPath });
      expect(report.metadata.android?.appLabel).toBe('Real App Name');
      expect(report.metadata.android?.appLabelSource).toBe('resources');
      expect(report.artifact.artifactType).toBe('aab');
      expect(report.artifact.fileName).toBe('uploaded-bundle.aab');
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
  it('rejects a misleading extension and unsupported archive payload', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deploylens-type-test-'));
    try {
      const artifactPath = path.join(directory, 'renamed.apk');
      await fs.writeFile(artifactPath, zip([{ name: 'base/manifest/AndroidManifest.xml', data: protoManifest() }]));
      await expect(new DeployLensEngine().inspectArtifact({ artifactPath })).rejects.toThrow(/does not match detected AAB/i);
      await fs.writeFile(artifactPath, zip([{ name: 'readme.txt', data: Buffer.from('Not an app') }]));
      await expect(new DeployLensEngine().inspectArtifact({ artifactPath })).rejects.toThrow(/unsupported/i);
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
});
