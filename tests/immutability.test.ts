import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DeployLensEngine } from '@deploylens/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Artifact Immutability & Clean Workspace', () => {
  const engine = new DeployLensEngine();

  it('guarantees original input artifact is never modified during inspection', async () => {
    const targetPath = path.join(fixturesDir, 'android', 'valid-app.apk');
    const initialBytes = fs.readFileSync(targetPath);
    const initialHash = crypto.createHash('sha256').update(initialBytes).digest('hex');
    const initialMtime = fs.statSync(targetPath).mtimeMs;

    await engine.inspectArtifact({ artifactPath: targetPath });

    const postBytes = fs.readFileSync(targetPath);
    const postHash = crypto.createHash('sha256').update(postBytes).digest('hex');
    const postMtime = fs.statSync(targetPath).mtimeMs;

    expect(postHash).toBe(initialHash);
    expect(postBytes.length).toBe(initialBytes.length);
    expect(postMtime).toBe(initialMtime);
  });

  it('accurately sequences progress events without missing stages', async () => {
    const targetPath = path.join(fixturesDir, 'android', 'valid-app.apk');
    const eventTypes: string[] = [];

    await engine.inspectArtifact({ artifactPath: targetPath }, (evt) => {
      eventTypes.push(evt.type);
    });

    expect(eventTypes[0]).toBe('scan.started');
    expect(eventTypes[eventTypes.length - 1]).toBe('scan.completed');
    expect(eventTypes.filter((t) => t === 'stage.started').length).toBe(9);
    expect(eventTypes.filter((t) => t === 'stage.completed').length).toBe(9);
  });
});
