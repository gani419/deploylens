import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { connect as connectHttp2 } from 'node:http2';
// @ts-expect-error The server is deliberately framework-independent Node ESM.
import { createWebServer } from '../apps/server/src/index.mjs';

let directory: string;
let servers: ReturnType<typeof createWebServer>[];
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deploylens-http-test-')); servers = []; });
afterEach(async () => {
  for (const server of servers) {
    if ('closeAllConnections' in server) server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});
async function serve(options = {}) {
  const server = createWebServer({ tempRoot: directory, ...options }); servers.push(server);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
function upload(base: string, name: string, body: Buffer) {
  return fetch(`${base}/api/scans?filename=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
}
async function cleaned() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (!(await fs.readdir(directory)).some(name => name.startsWith('deploylens-upload-'))) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  expect(await fs.readdir(directory)).toEqual([]);
}

describe('Website upload service', () => {
  it('serves health checks over cleartext HTTP/2 for Cloud Run end-to-end HTTP/2 mode', async () => {
    const server = createWebServer({ tempRoot: directory, useHttp2: true }); servers.push(server);
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const client = connectHttp2(`http://127.0.0.1:${server.address().port}`);
    try {
      const request = client.request({ ':path': '/api/health' });
      let status: number | undefined; let body = '';
      request.on('response', headers => { status = Number(headers[':status']); });
      request.setEncoding('utf8'); request.on('data', chunk => { body += chunk; }); request.end();
      await once(request, 'end');
      expect(status).toBe(200);
      expect(JSON.parse(body).retainsHistory).toBe(false);
    } finally { client.close(); }
  });
  it('serves the website and documents no upload history', async () => {
    const base = await serve();
    expect((await fetch(base)).status).toBe(200);
    expect((await fetch(base + '/documentation')).status).toBe(200);
      expect((await fetch(base + '/privacy')).status).toBe(200);
    const response = await fetch(base + '/api/health');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).retainsHistory).toBe(false);
    expect((await fetch(base + '/api/history')).status).toBe(404);
  });
  it('inspects an uploaded AAB without exposing server paths, then deletes it', async () => {
    const base = await serve();
    const response = await upload(base, 'my-release.aab', await fs.readFile('fixtures/android/test-app.aab'));
    expect(response.status).toBe(200);
    const text = await response.text();
    const events = text.trim().split('\n').map(line => JSON.parse(line));
    const result = events.find(event => event.type === 'scan.completed');
    expect(result.summary.artifact.fileName).toBe('my-release.aab');
    expect(result.summary.artifact.path).toBe('my-release.aab');
    expect(result.summary.metadata.android.signing.signingVerified).toBe(false);
    const finding = result.summary.stages.flatMap((stage: { checks: Array<{ findings: Array<{ guidance?: { meaning: string; steps: string[]; verification: string[] } }> }> }) => stage.checks.flatMap(check => check.findings)).find((item: { guidance?: unknown }) => item.guidance);
    expect(finding.guidance.meaning).toBeTruthy();
    expect(finding.guidance.steps.length).toBeGreaterThan(0);
    expect(finding.guidance.verification.length).toBeGreaterThan(0);
    expect(result.summary.assessment.status).toBe('ACTION REQUIRED');
    expect(text).not.toContain('deploylens-upload-');
    await cleaned();
  });
  it('returns an error event for corrupt uploads and cleans them', async () => {
    const base = await serve();
    const response = await upload(base, 'corrupt.apk', Buffer.from('not a real archive'));
    const text = await response.text();
    expect(text).toContain('scan.error'); expect(text).not.toContain('scan.completed');
    await cleaned();
  });
  it('rejects unsupported extensions, path injection, oversized files and cross-origin requests', async () => {
    const base = await serve({ maxUploadBytes: 4 });
    expect((await upload(base, '../file.apk', Buffer.from('1234'))).status).toBe(400);
    expect((await upload(base, 'file.exe', Buffer.from('1234'))).status).toBe(400);
    expect((await upload(base, 'file.apk', Buffer.from('12345'))).status).toBe(413);
    expect((await fetch(base + '/api/scans?filename=file.apk', { method: 'POST', headers: { Origin: 'https://other.example' } })).status).toBe(403);
    expect(await fs.readdir(directory)).toEqual([]);
  });
  it('kills timed out scans and deletes temporary data', async () => {
    const workerPath = path.join(directory, 'hang.mjs');
    await fs.writeFile(workerPath, "process.on('message', () => setInterval(() => {}, 1000));");
    const base = await serve({ workerPath, scanTimeoutMs: 50 });
    const response = await upload(base, 'file.apk', Buffer.from('1234'));
    expect(await response.text()).toContain('time limit');
    await cleaned();
  });
  it('bounds concurrent uploads and cancels workers on disconnect', async () => {
    const workerPath = path.join(directory, 'hang.mjs');
    await fs.writeFile(workerPath, "process.on('message', () => setInterval(() => {}, 1000));");
    const base = await serve({ workerPath, maxConcurrentScans: 1 });
    const first = await upload(base, 'file.apk', Buffer.from('1234'));
    const second = await upload(base, 'file.apk', Buffer.from('1234'));
    expect(second.status).toBe(429);
    await first.body!.cancel();
    await cleaned();
  });
});


describe('Opt-in local device installer', () => {
  const apk = Buffer.from('PK sample APK bytes');
  const hash = createHash('sha256').update(apk).digest('hex');
  function headers(base: string) { return { Origin: base, 'X-DeployLens-Device': '1', 'Content-Type': 'application/octet-stream' }; }
  it('is disabled by default and rejects cross-origin or rebinding requests', async () => {
    let calls = 0;
    const adbRun = async () => { calls++; return { stdout: '', stderr: '' }; };
    const disabled = await serve({ adbRun });
    expect((await fetch(disabled + '/api/devices', { headers: headers(disabled) })).status).toBe(403);
    const base = await serve({ localDevices: true, adbRun });
    expect((await fetch(base + '/api/devices', { headers: { ...headers(base), Origin: 'https://evil.example' } })).status).toBe(403);
    const forgedHost = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(base + '/api/devices', { headers: { ...headers(base), Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject); request.end();
    });
    expect(forgedHost).toBe(403);
    expect((await fetch(base + '/api/devices')).status).toBe(403);
    expect(calls).toBe(0);
  });
  it('installs exact inspected bytes on an explicitly selected device and removes the temporary file', async () => {
    const calls: string[][] = [];
    const adbRun = async (_file: string, args: string[]) => {
      calls.push(args);
      if (args[0] === 'devices') return { stdout: 'List of devices attached\nemulator-5554 device model:Pixel_8\nphone unauthorized model:Phone\n', stderr: '' };
      expect(await fs.readFile(args.at(-1)!)).toEqual(apk);
      return { stdout: 'Performing Streamed Install\nSuccess\n', stderr: '' };
    };
    const base = await serve({ localDevices: true, adbRun });
    const devices = await fetch(base + '/api/devices', { headers: { 'X-DeployLens-Device': '1' } });
    expect((await devices.json()).devices[0].model).toBe('Pixel 8');
    const response = await fetch(base + `/api/devices/install?serial=emulator-5554&sha256=${hash}`, { method: 'POST', headers: headers(base), body: apk });
    expect(response.status).toBe(200); expect((await response.json()).message).toContain('installed successfully');
    expect(calls.at(-1)?.slice(0, 3)).toEqual(['-s', 'emulator-5554', 'install']);
    expect(calls.at(-1)).not.toContain('-r'); await cleaned();
    const update = await fetch(base + `/api/devices/install?serial=emulator-5554&sha256=${hash}&replace=true`, { method: 'POST', headers: headers(base), body: apk });
    expect(update.status).toBe(200); expect(calls.at(-1)).toContain('-r'); await cleaned();
  });
  it('rejects changed bytes, unauthorized devices and argument injection without installing', async () => {
    let installs = 0;
    const adbRun = async (_file: string, args: string[]) => { if (args[0] !== 'devices') installs++; return { stdout: 'List of devices attached\nphone unauthorized\nemulator-5554 device\n', stderr: '' }; };
    const base = await serve({ localDevices: true, adbRun });
    const send = (serial: string, sha256 = hash) => fetch(base + `/api/devices/install?serial=${encodeURIComponent(serial)}&sha256=${sha256}`, { method: 'POST', headers: headers(base), body: apk });
    expect((await send('-s evil')).status).toBe(400);
    expect((await send('phone')).status).toBe(409);
    expect((await send('emulator-5554', '0'.repeat(64))).status).toBe(400);
    expect(installs).toBe(0); await cleaned();
  });
  it('bounds installer uploads and surfaces missing ADB', async () => {
    const base = await serve({ localDevices: true, maxUploadBytes: 4, adbRun: async () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); } });
    const response = await fetch(base + '/api/devices', { headers: headers(base) });
    expect(response.status).toBe(503); expect((await response.json()).error).toContain('ADB was not found');
    const oversized = await fetch(base + `/api/devices/install?serial=emulator-5554&sha256=${hash}`, { method: 'POST', headers: headers(base), body: apk });
    expect(oversized.status).toBe(413); await cleaned();
  });
});


describe('Local iPhone IPA installation', () => {
  const ipa = Buffer.from('PK signed IPA sample bytes');
  const hash = createHash('sha256').update(ipa).digest('hex');
  const udid = '00008030-0012345678901234';
  const headers = (base: string) => ({ Origin: base, 'X-DeployLens-Device': '1', 'Content-Type': 'application/octet-stream' });
  it.each([false, true])('selects the Apple USB device and supports legacy installer CLI: %s', async legacy => {
    const calls: Array<{ tool: string; args: string[] }> = [];
    const adbRun = async (tool: string, args: string[]) => {
      calls.push({ tool, args });
      if (tool.includes('idevice_id')) return { stdout: udid + '\n', stderr: '' };
      if (args[0] === '--help') return { stdout: legacy ? '-i, --install FILE' : 'install PATH', stderr: '' };
      expect(await fs.readFile(args.at(-1)!)).toEqual(ipa);
      return { stdout: 'Install: Complete\n', stderr: '' };
    };
    const base = await serve({ localDevices: true, adbRun });
    const devices = await fetch(base + '/api/devices?platform=ios', { headers: headers(base) });
    expect((await devices.json()).devices[0].serial).toBe(udid);
    const response = await fetch(base + `/api/devices/install?platform=ios&serial=${udid}&sha256=${hash}`, { method: 'POST', headers: headers(base), body: ipa });
    expect(response.status).toBe(200);
    expect((await response.json()).message).toContain('confirmed completion');
    expect(calls.at(-1)?.args.slice(0, 3)).toEqual(['-u', udid, legacy ? '-i' : 'install']); await cleaned();
  });
  it('does not report completion when signing is rejected or the tool gives no confirmation', async () => {
    let failure = true;
    const adbRun = async (tool: string, args: string[]) => {
      if (tool.includes('idevice_id')) return { stdout: udid, stderr: '' };
      if (args[0] === '--help') return { stdout: 'install PATH', stderr: '' };
      return { stdout: failure ? 'ERROR: ApplicationVerificationFailed. Invalid provisioning profile.' : 'Waiting for device', stderr: '' };
    };
    const base = await serve({ localDevices: true, adbRun });
    const send = () => fetch(base + `/api/devices/install?platform=ios&serial=${udid}&sha256=${hash}`, { method: 'POST', headers: headers(base), body: ipa });
    expect((await send()).status).toBe(400); await cleaned();
    failure = false; expect((await send()).status).toBe(400); await cleaned();
  });
  it('reports missing Apple tools and rejects unknown platforms', async () => {
    const base = await serve({ localDevices: true, adbRun: async () => { throw Object.assign(new Error('not installed'), { code: 'ENOENT' }); } });
    const response = await fetch(base + '/api/devices?platform=ios', { headers: headers(base) });
    expect(response.status).toBe(503); expect((await response.json()).error).toContain('Apple device tools');
    expect((await fetch(base + '/api/devices?platform=unknown', { headers: headers(base) })).status).toBe(400);
  });
});
