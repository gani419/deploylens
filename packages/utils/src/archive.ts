import { supportedFormats, inspectionLimits } from '@deploylens/config';
import type { ArtifactType } from '@deploylens/contracts';

export interface ArchiveDescriptor { name: string; size: number }
export function archiveType(name: string): ArtifactType | null {
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
  return supportedFormats.find(format => format === extension) ?? null;
}
export function validateArchive(file: ArchiveDescriptor, limit: number = inspectionLimits.maxUploadBytes): string | null {
  if (!archiveType(file.name)) return 'Choose an APK, AAB, or IPA build archive. Other archive formats are not supported.';
  if (!Number.isFinite(file.size) || file.size < 4 || file.size > limit) return `Choose a non-empty archive up to ${Math.round(limit / 1024 / 1024)} MB.`;
  return null;
}
