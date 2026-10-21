import { describe, expect, it } from 'vitest';
import { SafeZipReader, DeployLensEngine } from '@deploylens/core';
import { parseProtoManifest, extractManifestMetadata } from '@deploylens/android';
import { inspectIpaData } from '@deploylens/ios';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { zip } from './helpers/zip.js';

describe('Untrusted build archives', () => {
  it('rejects duplicate names', () => {
    expect(() => new SafeZipReader(zip([{ name: 'a', data: Buffer.from('a') }, { name: 'a', data: Buffer.from('b') }]))).toThrow(/duplicate/i);
  });
  it('checks CRC rather than trusting directory metadata', () => {
    const buffer = zip([{ name: 'a', data: Buffer.from('hello') }]); buffer[31] = 0;
    expect(() => new SafeZipReader(buffer).readEntry('a')).toThrow(/integrity/i);
  });
  it('bounds decompression even when the archive lies about expanded size', () => {
    const buffer = zip([{ name: 'a', data: Buffer.alloc(1024 * 1024), deflate: true, declaredSize: 10 }]);
    expect(() => new SafeZipReader(buffer).readEntry('a')).toThrow(/decompress/i);
  });
  it('enforces actual entry count', () => {
    const buffer = zip([{ name: 'a', data: Buffer.from('hello') }]); buffer.writeUInt16LE(0, buffer.length - 12);
    expect(() => new SafeZipReader(buffer)).toThrow(/entry count/i);
  });
  it('never substitutes manifest defaults after a decode failure', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deploylens-regression-'));
    try {
      const artifactPath = path.join(directory, 'broken.aab');
      fs.writeFileSync(artifactPath, zip([{ name: 'base/manifest/AndroidManifest.xml', data: Buffer.from('UNREADABLE') }]));
      await expect(new DeployLensEngine().inspectArtifact({ artifactPath })).rejects.toThrow(/manifest/i);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
  it('does not manufacture iOS identity or architecture', () => {
    expect(() => inspectIpaData({ archiveSizeBytes: 0, uncompressedSizeBytes: 0, entries: [], hasCodeSignature: false, infoPlistBuffer: Buffer.from('NOT A PLIST') })).toThrow(/plist/i);
  });
  it('decodes protobuf AAB attributes and nested elements', () => {
    const field = (id: number, data: Buffer | string) => { const b = Buffer.isBuffer(data) ? data : Buffer.from(data); expect(b.length).toBeLessThan(128); return Buffer.concat([Buffer.from([id * 8 + 2, b.length]), b]); };
    const attr = (name: string, value: string) => field(4, Buffer.concat([field(2, name), field(3, value)]));
    // Field numbers follow AOSP tools/aapt2/Resources.proto, not APK binary XML.
    const sdk = field(5, field(1, Buffer.concat([field(3, 'uses-sdk'), attr('targetSdkVersion', '36')])));
    const buffer = field(1, Buffer.concat([field(3, 'manifest'), attr('package', 'com.test.app'), sdk]));
    const root = parseProtoManifest(buffer);
    expect(root).not.toBeNull();
    expect(extractManifestMetadata(root!).targetSdkVersion).toBe(36);
    expect(extractManifestMetadata(root!).packageId).toBe('com.test.app');
  });
});
