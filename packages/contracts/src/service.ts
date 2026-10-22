import type { ScanEvent } from './events.js';
import type { ArtifactType } from './artifact.js';

/** Public HTTP protocol shared by browser and native transports. */
export type InspectionEvent = ScanEvent
  | { type: 'upload.completed'; scanId: string }
  | { type: 'scan.error'; message: string };

export interface InspectionServiceHealth {
  status: 'ok';
  maxUploadBytes: number;
  acceptedFormats: ArtifactType[];
  retainsHistory: false;
}
