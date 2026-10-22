import type { InspectionEvent, InspectionServiceHealth } from '@deploylens/contracts';

export interface InspectionObserver {
  onEvent: (event: InspectionEvent) => void;
  onProgress: (percentage: number) => void;
  onError: (message: string) => void;
  onComplete: () => void;
}
/** Native URI/filesystem/browser File handles belong to the respective adapter. */
export interface InspectionTransport<Upload> {
  health(): Promise<InspectionServiceHealth>;
  inspect(upload: Upload, observer: InspectionObserver): { cancel(): void };
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export function isInspectionEvent(value: unknown): value is InspectionEvent {
  if (!record(value) || typeof value.type !== 'string') return false;
  if (value.type === 'scan.error') return typeof value.message === 'string';
  if (typeof value.scanId !== 'string') return false;
  switch (value.type) {
    case 'upload.completed': return true;
    case 'scan.started': return record(value.artifact);
    case 'stage.started': return typeof value.stageId === 'string' && typeof value.stageName === 'string' && typeof value.stageNumber === 'number' && typeof value.totalStages === 'number';
    case 'stage.progress': return typeof value.stageId === 'string' && typeof value.message === 'string';
    case 'stage.completed': return record(value.stage) && typeof value.stage.id === 'string' && Array.isArray(value.stage.checks);
    case 'stage.error': return typeof value.stageId === 'string' && typeof value.error === 'string';
    case 'scan.cancelled': return typeof value.reason === 'string';
    case 'scan.completed': return record(value.summary) && record(value.summary.artifact) && record(value.summary.metadata) && record(value.summary.assessment) && record(value.summary.storeGuidance) && Array.isArray(value.summary.stages);
    default: return false;
  }
}
export function createInspectionDecoder(onEvent: (event: InspectionEvent) => void) {
  let pending = '', finished = false;
  const parse = (line: string) => {
    if (!line.trim()) return;
    const event: unknown = JSON.parse(line);
    if (!isInspectionEvent(event)) throw new Error('Invalid inspection event');
    onEvent(event);
  };
  return {
    push(chunk: string) {
      if (finished) throw new Error('Inspection stream is already closed');
      pending += chunk;
      let end: number;
      while ((end = pending.indexOf('\n')) !== -1) { const line = pending.slice(0, end); pending = pending.slice(end + 1); parse(line); }
    },
    finish() { if (finished) return; parse(pending); pending = ''; finished = true; },
  };
}
export function scanUploadPath(fileName: string): string { return `/api/scans?filename=${encodeURIComponent(fileName)}`; }
