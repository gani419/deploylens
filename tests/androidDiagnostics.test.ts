import { describe, expect, it } from 'vitest';
import type { AndroidMetadata } from '@deploylens/contracts';
import { inspectBundlePageAlignment, inspectElfBuffer, toNativeLibraryInfo, extractManifestMetadata, parseAxml } from '@deploylens/android';
import { androidBundlePageAlignmentRule } from '@deploylens/rules';
import { pb } from './helpers/proto.js';

function elf(alignment = 16384, count = 1) {
  const data = Buffer.alloc(120); data.writeUInt32LE(0x464c457f); data[4] = 2; data[5] = 1; data.writeUInt16LE(183, 18); data.writeBigUInt64LE(64n, 32); data.writeUInt16LE(56, 54); data.writeUInt16LE(count, 56); data.writeUInt32LE(1, 64); data.writeBigUInt64LE(BigInt(alignment), 112); return data;
}
describe('Android diagnostics evidence', () => {
  it.each([[1, '4kb'], [2, '16kb'], [3, '64kb']])('reads bundletool page alignment enum %s', (alignment, expected) => {
    const config = pb(2, pb(2, Buffer.concat([pb(1, 1), pb(2, alignment as number)])));
    expect(inspectBundlePageAlignment(config)).toEqual({ bundlePageAlignment: expected, bundleUncompressNativeLibraries: true });
  });
  it('does not assume 16 KB packaging when config is missing or invalid', () => {
    expect(inspectBundlePageAlignment().bundlePageAlignment).toBe('not-checked');
    expect(inspectBundlePageAlignment(Buffer.from('BAD DATA')).bundlePageAlignment).toBe('not-checked');
    expect(inspectBundlePageAlignment(Buffer.alloc(0)).bundlePageAlignment).toBe('unspecified');
  });
  it('does not treat a generation setting as runtime evidence', () => {
    const metadata = { signing: { isBundleSigning: true }, nativeLibraries: { libraries: [{}], bundlePageAlignment: '16kb', bundleUncompressNativeLibraries: true } } as unknown as AndroidMetadata;
    const result = androidBundlePageAlignmentRule.evaluate({ metadata, toolCapabilities: {} });
    expect(result.outcome).toBe('pass'); expect(result.evidence).toContain('runtime compatibility are not verified');
    metadata.nativeLibraries.bundlePageAlignment = '4kb';
    expect(androidBundlePageAlignmentRule.evaluate({ metadata, toolCapabilities: {} }).outcome).toBe('needs-review');
  });
  it('distinguishes aligned, misaligned and incomplete ELF data', () => {
    expect(inspectElfBuffer(elf(), 'lib.so').loadSegmentCount).toBe(1);
    expect(toNativeLibraryInfo('lib/arm64-v8a/lib.so', elf()).is16KbAligned).toBe(true);
    expect(toNativeLibraryInfo('lib/arm64-v8a/lib.so', elf(4096)).is16KbAligned).toBe(false);
    expect(toNativeLibraryInfo('lib/arm64-v8a/lib.so', elf(16384, 0)).is16KbAligned).toBeNull();
    expect(toNativeLibraryInfo('lib/arm64-v8a/lib.so', elf(16384, 2)).is16KbAligned).toBeNull();
    const noLoad = elf(); noLoad.writeUInt32LE(0, 64);
    expect(toNativeLibraryInfo('lib/arm64-v8a/lib.so', noLoad).is16KbAligned).toBeNull();
  });
  it('reports profiling declarations without claiming a runtime test', () => {
    const root = parseAxml(Buffer.from('<manifest package="com.test.app"><application><profileable android:shell="true" /></application></manifest>'))!;
    expect(extractManifestMetadata(root).profileableByShell).toBe(true);
  });
});
