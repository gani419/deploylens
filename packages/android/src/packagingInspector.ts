import type { AndroidPackagingBreakdown } from '@deploylens/contracts';

export interface ArchiveEntrySummary {
  path: string;
  uncompressedSizeBytes: number;
  compressedSizeBytes: number;
}

export function analyzePackaging(
  archiveSizeBytes: number,
  entries: ArchiveEntrySummary[],
  calculatedDownloadSize?: number
): AndroidPackagingBreakdown {
  let uncompressedTotal = 0;
  let dexTotal = 0;
  let nativeLibsTotal = 0;
  let assetsTotal = 0;
  let resTotal = 0;
  let otherTotal = 0;

  const largeFiles: Array<{ path: string; sizeBytes: number }> = [];

  for (const entry of entries) {
    uncompressedTotal += entry.uncompressedSizeBytes;

    if (entry.uncompressedSizeBytes > 10 * 1024 * 1024) {
      largeFiles.push({
        path: entry.path,
        sizeBytes: entry.uncompressedSizeBytes,
      });
    }

    const lower = entry.path.toLowerCase();
    if (lower.endsWith('.dex')) {
      dexTotal += entry.uncompressedSizeBytes;
    } else if (lower.includes('/lib/') || lower.startsWith('lib/') || lower.endsWith('.so')) {
      nativeLibsTotal += entry.uncompressedSizeBytes;
    } else if (lower.includes('/assets/') || lower.startsWith('assets/')) {
      assetsTotal += entry.uncompressedSizeBytes;
    } else if (lower.includes('/res/') || lower.startsWith('res/') || lower.endsWith('resources.arsc')) {
      resTotal += entry.uncompressedSizeBytes;
    } else {
      otherTotal += entry.uncompressedSizeBytes;
    }
  }

  largeFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return {
    archiveSizeBytes,
    uncompressedSizeBytes: uncompressedTotal,
    dexSizeBytes: dexTotal,
    nativeLibsSizeBytes: nativeLibsTotal,
    assetsSizeBytes: assetsTotal,
    resourcesSizeBytes: resTotal,
    otherSizeBytes: otherTotal,
    largeFiles,
    estimatedDownloadSizeBytes: calculatedDownloadSize,
  };
}
