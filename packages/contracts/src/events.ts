import type { ArtifactIdentity } from './artifact.js';
import type { ValidationStage, ValidationStageId } from './stages.js';
import type { AndroidMetadata } from './android.js';
import type { IosMetadata } from './ios.js';
import type { ScanAssessment } from './readiness.js';
import type { StoreGuidance, UserAppInfo } from './storeGuidance.js';

export interface ScanRequest {
  artifactPath: string;
  userAppInfo?: UserAppInfo;
}

export interface ScanSummary {
  scanId: string;
  artifact: ArtifactIdentity;
  metadata: {
    android?: AndroidMetadata;
    ios?: IosMetadata;
  };
  stages: ValidationStage[];
  assessment: ScanAssessment;
  storeGuidance: StoreGuidance;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
}

export type ScanEvent =
  | {
      type: 'scan.started';
      scanId: string;
      artifact: ArtifactIdentity;
      timestamp: string;
    }
  | {
      type: 'stage.started';
      scanId: string;
      stageId: ValidationStageId;
      stageName: string;
      stageNumber: number;
      totalStages: number;
      timestamp: string;
    }
  | {
      type: 'stage.progress';
      scanId: string;
      stageId: ValidationStageId;
      message: string;
      completedChecks?: number;
      totalChecks?: number;
      timestamp: string;
    }
  | {
      type: 'stage.completed';
      scanId: string;
      stage: ValidationStage;
      timestamp: string;
    }
  | {
      type: 'stage.error';
      scanId: string;
      stageId: ValidationStageId;
      error: string;
      timestamp: string;
    }
  | {
      type: 'scan.completed';
      scanId: string;
      summary: ScanSummary;
      timestamp: string;
    }
  | {
      type: 'scan.cancelled';
      scanId: string;
      reason: string;
      timestamp: string;
    };
