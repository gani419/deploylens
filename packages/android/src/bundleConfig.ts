import { decodeProtoFields as fields, protoBytes as bytes } from './protoManifest.js';
import type { NativeLibrarySummary } from '@deploylens/contracts';

// https://github.com/google/bundletool/blob/master/src/main/proto/config.proto
export function inspectBundlePageAlignment(buffer?: Buffer): Pick<NativeLibrarySummary, 'bundlePageAlignment' | 'bundleUncompressNativeLibraries'> {
  try {
    if (!buffer) throw new Error('Missing BundleConfig.pb');
    const optimizations = bytes(fields(buffer), 2);
    const native = optimizations ? bytes(fields(optimizations), 2) : undefined;
    if (!native) return { bundlePageAlignment: 'unspecified', bundleUncompressNativeLibraries: null };
    const config = fields(native);
    const enabled = config.find(f => f.id === 1)?.value;
    const alignment = config.find(f => f.id === 2)?.value;
    return { bundlePageAlignment: alignment === 1 ? '4kb' : alignment === 2 ? '16kb' : alignment === 3 ? '64kb' : 'unspecified',
      bundleUncompressNativeLibraries: enabled === 1 };
  } catch { return { bundlePageAlignment: 'not-checked', bundleUncompressNativeLibraries: null }; }
}
