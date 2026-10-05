import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { TemporaryWorkspace } from '@deploylens/core';

describe('TemporaryWorkspace Lifecycle and Isolation', () => {
  it('creates dedicated temp directory and cleans it up completely', () => {
    const ws = new TemporaryWorkspace('test-scan-1');
    expect(fs.existsSync(ws.dir)).toBe(true);

    const testFile = ws.resolvePath('temp.txt');
    fs.writeFileSync(testFile, 'hello local workspace');
    expect(fs.existsSync(testFile)).toBe(true);

    ws.cleanup();
    expect(fs.existsSync(ws.dir)).toBe(false);
  });

  it('prevents resolving paths outside of workspace root', () => {
    const ws = new TemporaryWorkspace('test-scan-2');
    try {
      expect(() => ws.resolvePath('../../../sensitive.txt')).toThrow(/Path security violation/);
    } finally {
      ws.cleanup();
    }
  });
});
