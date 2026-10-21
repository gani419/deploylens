import type { ArtifactIdentity, CapabilityReport, ScanEvent, ScanRequest, ScanSummary } from '@deploylens/contracts';

declare global {
  interface Window {
    deployLens: {
      selectFile(): Promise<ArtifactIdentity | null>;
      getPathForFile(file: File): string;
      detectCapabilities(): Promise<CapabilityReport>;
      inspectArtifact(request: ScanRequest): Promise<ScanSummary>;
      cancelScan(scanId: string): Promise<void>;
      openExternal(url: string): Promise<void>;
      copyToClipboard(text: string): Promise<void>;
      onScanEvent(callback: (event: ScanEvent) => void): () => void;
    };
  }
}
