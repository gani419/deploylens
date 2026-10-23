import type {Server} from 'node:http';

export interface WebServerOptions {
  maxUploadBytes?: number;
  maxConcurrentScans?: number;
  scanTimeoutMs?: number;
  uploadTimeoutMs?: number;
  staticDir?: string;
  tempRoot?: string;
  workerPath?: string;
  localDevices?: boolean;
  adbRun?: (...args: unknown[]) => unknown;
}

export function createWebServer(options?: WebServerOptions): Server;
