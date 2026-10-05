import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';

const activeWorkspaces = new Set<TemporaryWorkspace>();

// Global process cleanup hook
let exitHookRegistered = false;
function registerExitHooks() {
  if (exitHookRegistered) return;
  exitHookRegistered = true;

  const cleanupAll = () => {
    for (const ws of activeWorkspaces) {
      try {
        ws.cleanup();
      } catch {
        // Suppress on exit
      }
    }
  };

  process.once('exit', cleanupAll);
  process.once('SIGINT', () => {
    cleanupAll();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanupAll();
    process.exit(143);
  });
}

export class TemporaryWorkspace {
  public readonly dir: string;
  public readonly scanId: string;
  private childProcesses: Set<ChildProcess> = new Set();
  private isCleaned = false;

  constructor(scanId: string) {
    this.scanId = scanId;
    registerExitHooks();
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), `deploylens-${scanId}-`));
    activeWorkspaces.add(this);
  }

  resolvePath(...subPaths: string[]): string {
    const target = path.resolve(this.dir, ...subPaths);
    if (!target.startsWith(this.dir)) {
      throw new Error(`Path security violation: resolved path "${target}" is outside workspace "${this.dir}"`);
    }
    return target;
  }

  trackProcess(cp: ChildProcess) {
    this.childProcesses.add(cp);
    cp.once('close', () => {
      this.childProcesses.delete(cp);
    });
  }

  cleanup() {
    if (this.isCleaned) return;
    this.isCleaned = true;

    // Terminate any running child processes
    for (const cp of this.childProcesses) {
      try {
        cp.kill('SIGKILL');
      } catch {
        // Ignore kill errors
      }
    }
    this.childProcesses.clear();

    // Remove temp directory
    try {
      if (fs.existsSync(this.dir)) {
        fs.rmSync(this.dir, { recursive: true, force: true });
      }
    } catch {
      // Best effort cleanup
    }

    activeWorkspaces.delete(this);
  }
}
