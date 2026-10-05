import type { CheckResult } from './findings.js';

export type StageLifecycle = 'pending' | 'running' | 'completed' | 'error' | 'cancelled';

export type AndroidStageId =
  | 'android-validate-artifact'
  | 'android-read-app-info'
  | 'android-read-os-device'
  | 'android-inspect-release-config'
  | 'android-inspect-signing'
  | 'android-inspect-native-libs'
  | 'android-review-permissions-security'
  | 'android-review-packaging'
  | 'android-store-guidance';

export type IosStageId =
  | 'ios-validate-artifact'
  | 'ios-read-info-plist'
  | 'ios-extract-identity'
  | 'ios-inspect-frameworks-archs'
  | 'ios-inspect-purpose-transport'
  | 'ios-parse-privacy-manifest'
  | 'ios-inspect-entitlements-signing'
  | 'ios-store-guidance';

export type ValidationStageId = AndroidStageId | IosStageId;

export interface ValidationStage {
  id: ValidationStageId;
  name: string;
  stageNumber: number;
  totalStages: number;
  lifecycle: StageLifecycle;
  startedAt?: string;
  completedAt?: string;
  checks: CheckResult[];
  error?: string;
}
