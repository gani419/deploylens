import { afterEach, describe, expect, it, vi } from 'vitest';

const exec = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile: exec }));
import { synthesizeAndroidSigningInfo, verifyAabSignature, verifyWithApksigner } from '@deploylens/android';
import { runMacOsCodesignVerify } from '@deploylens/ios';

function output(stdout: string, error: Error | null = null) {
  exec.mockImplementation((_command, _args, _options, callback) => callback(error, { stdout, stderr: '' }));
}
afterEach(() => { vi.restoreAllMocks(); exec.mockReset(); });

describe('Cryptographic signing verification', () => {
  it('never verifies a fake certificate or a signing block by presence', () => {
    for (const isAab of [true, false]) {
      const result = synthesizeAndroidSigningInfo({ isAab, hasMetaInfSignature: true, metaInfCert: Buffer.from('FAKE CERT'), apkSigBlock: { hasSigningBlock: true, schemeV2: true, schemeV3: false, schemeV4: false, certificates: [] } });
      expect(result.signingVerified).toBe(false);
      expect(result.verificationOutcome).toBe('not-checked');
      expect(result.signers).toEqual([]);
    }
  });
  it('keeps an apksigner rejection as a failed result', async () => {
    output('DOES NOT VERIFY', Object.assign(new Error('rejected'), { code: 1 }));
    expect((await verifyWithApksigner('apksigner', 'app.apk')).outcome).toBe('fail');
  });
  it('reports unavailable tools as not checked', async () => {
    output('', Object.assign(new Error('missing'), { code: 'ENOENT' }));
    expect((await verifyWithApksigner('apksigner', 'app.apk')).outcome).toBe('not-checked');
    expect((await verifyAabSignature('app.aab')).outcome).toBe('not-checked');
  });
  it.each([['jar verified.', 'pass'], ['jar is unsigned.', 'fail'], ['jar verified.\nThis jar contains unsigned entries', 'fail']])('handles jarsigner output %s', async (stdout, outcome) => {
    output(stdout);
    expect((await verifyAabSignature('app.aab')).outcome).toBe(outcome);
  });
  it('verifies iOS code before displaying certificate details', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    output('Authority=Apple Distribution\nTeamIdentifier=TEAM');
    expect((await runMacOsCodesignVerify('/tmp/App.app')).codesignCheckOutcome).toBe('pass');
    expect(exec.mock.calls[0]?.[1]).toContain('--verify');
    expect(exec.mock.calls[0]?.[1]).toContain('--deep');
    expect(exec.mock.calls[0]?.[1]).toContain('--strict');
    expect(exec.mock.calls[1]?.[1]).toContain('-dvvv');
  });
  it('does not fall back to a display-only iOS signature check on failure', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    output('', Object.assign(new Error('invalid resource seal'), { code: 1 }));
    expect((await runMacOsCodesignVerify('/tmp/App.app')).codesignCheckOutcome).toBe('fail');
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
