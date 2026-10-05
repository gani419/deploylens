import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeployLensEngine } from '@deploylens/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Strict Offline Operation Guarantee', () => {
  it('performs complete scan with zero outbound network requests', async () => {
    const httpSpy = vi.spyOn(http, 'request');
    const httpsSpy = vi.spyOn(https, 'request');

    const engine = new DeployLensEngine();
    const apkPath = path.join(fixturesDir, 'android', 'valid-app.apk');

    const summary = await engine.inspectArtifact({ artifactPath: apkPath });

    expect(summary.stages.length).toBe(9);
    expect(httpSpy).not.toHaveBeenCalled();
    expect(httpsSpy).not.toHaveBeenCalled();

    httpSpy.mockRestore();
    httpsSpy.mockRestore();
  });
});
