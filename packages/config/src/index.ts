export * from './product.js';
export * from './theme.js';
export * from './typography.js';

export const supportedFormats = ['apk', 'aab', 'ipa'] as const;
export const inspectionLimits = {
  maxUploadBytes: 512 * 1024 * 1024,
  maxConcurrentScans: 2,
  uploadTimeoutMs: 120000,
  scanTimeoutMs: 120000,
  requestTimeoutMs: 260000,
} as const;
