export type Platform = 'android' | 'ios';
export type ArtifactType = 'apk' | 'aab' | 'ipa';

export interface ArtifactIdentity {
  path: string;
  fileName: string;
  sizeBytes: number;
  platform: Platform;
  artifactType: ArtifactType;
  sha256?: string;
}
