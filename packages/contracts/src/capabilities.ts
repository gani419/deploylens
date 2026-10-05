export type KnownTool =
  | 'apkanalyzer'
  | 'bundletool'
  | 'apksigner'
  | 'zipalign'
  | 'readelf'
  | 'codesign'
  | 'security';

export interface ToolCapability {
  tool: KnownTool;
  available: boolean;
  version: string | null;
  path: string | null;
  supportedFeatures: string[];
  limitations: string[];
  diagnosticMessage?: string;
}

export type CapabilityReport = Record<KnownTool, ToolCapability>;
