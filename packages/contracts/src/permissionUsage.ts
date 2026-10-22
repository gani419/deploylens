export interface PermissionUsageAudit {
  method: 'static-reference-heuristic';
  filesScanned: number;
  filesSkipped: number;
  runtimeRequestReference: boolean;
  settingsRedirectReference: boolean;
  systemPickerReference: boolean;
  signals: Array<{ feature: string; declaration: string; declarationPresent: boolean; evidence: string[] }>;
  limitations: string[];
}
