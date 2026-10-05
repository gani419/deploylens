import { contextBridge, ipcRenderer } from 'electron';
import type {
  ScanRequest,
  ScanEvent,
  ScanSummary,
  CapabilityReport,
  ArtifactIdentity,
} from '@deploylens/contracts';

export interface DeployLensApi {
  selectFile: () => Promise<ArtifactIdentity | null>;
  detectCapabilities: () => Promise<CapabilityReport>;
  inspectArtifact: (request: ScanRequest) => Promise<ScanSummary>;
  cancelScan: (scanId: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  onScanEvent: (callback: (event: ScanEvent) => void) => () => void;
}

const api: DeployLensApi = {
  selectFile: () => ipcRenderer.invoke('deploylens:select-file'),
  detectCapabilities: () => ipcRenderer.invoke('deploylens:detect-capabilities'),
  inspectArtifact: (request: ScanRequest) => ipcRenderer.invoke('deploylens:inspect-artifact', request),
  cancelScan: (scanId: string) => ipcRenderer.invoke('deploylens:cancel-scan', scanId),
  openExternal: (url: string) => ipcRenderer.invoke('deploylens:open-external', url),
  copyToClipboard: (text: string) => ipcRenderer.invoke('deploylens:copy-clipboard', text),
  onScanEvent: (callback: (event: ScanEvent) => void) => {
    const handler = (_: any, event: ScanEvent) => callback(event);
    ipcRenderer.on('deploylens:scan-event', handler);
    return () => {
      ipcRenderer.removeListener('deploylens:scan-event', handler);
    };
  },
};

contextBridge.exposeInMainWorld('deployLens', api);

declare global {
  interface Window {
    deployLens: DeployLensApi;
  }
}
