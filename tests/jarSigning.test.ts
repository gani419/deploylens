import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { javaTool, runToolSafe, verifyAabSignature } from '@deploylens/android';
import { zip } from './helpers/zip.js';

describe('Real JDK signature verification', () => {
  it('accepts a signed archive and rejects modified signed content', async context => {
    if (!(await runToolSafe(javaTool('keytool'), ['-help'])).success) { context.skip(); return; }
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deploylens-signature-test-'));
    try {
      const archive = path.join(directory, 'signed.aab');
      const keystore = path.join(directory, 'test.p12');
      await fs.writeFile(archive, zip([{ name: 'base/manifest/AndroidManifest.xml', data: Buffer.from('PAYLOAD_ORIGINAL') }]));
      // Disposable test-only credentials; no user keys or signing identities are used.
      const generated = await runToolSafe(javaTool('keytool'), ['-genkeypair', '-alias', 'test', '-keystore', keystore, '-storepass', 'test-only-password', '-keypass', 'test-only-password', '-keyalg', 'RSA', '-dname', 'CN=DeployLens Test', '-validity', '1']);
      expect(generated.success).toBe(true);
      const signed = await runToolSafe(javaTool('jarsigner'), ['-keystore', keystore, '-storepass', 'test-only-password', archive, 'test']);
      expect(signed.success).toBe(true);
      const verified = await verifyAabSignature(archive);
      expect(verified.outcome).toBe('pass');
      expect(verified.signers[0]?.subject).toContain('DeployLens Test');
      expect(verified.signers[0]?.fingerprintSha256).toMatch(/^(?:[A-F\d]{2}:){31}[A-F\d]{2}$/);
      const bytes = await fs.readFile(archive);
      // Repack the signed archive preserving signature files but changing the payload.
      const { SafeZipReader } = await import('@deploylens/core');
      const reader = new SafeZipReader(bytes);
      const entries = reader.getEntries().filter(entry => !entry.fileName.endsWith('/')).map(entry => ({ name: entry.fileName, data: entry.fileName === 'base/manifest/AndroidManifest.xml' ? Buffer.from('PAYLOAD_MODIFIED') : reader.readEntry(entry.fileName)! }));
      await fs.writeFile(archive, zip(entries));
      expect((await verifyAabSignature(archive)).outcome).toBe('fail');
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
});
