import http from 'node:http';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fork, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createDeviceService, deviceRequestAllowed } from './devices.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

export function createWebServer({ maxUploadBytes = 512 * 1024 * 1024, maxConcurrentScans = 2,
  scanTimeoutMs = 120000, uploadTimeoutMs = 120000, staticDir = path.resolve(here, '../dist'),
  tempRoot = os.tmpdir(), workerPath = path.join(here, 'worker.mjs'),
  localDevices = process.env.DEPLOYLENS_LOCAL_DEVICES === '1', adbRun } = {}) {
  let active = 0;
  const jobs = new Set();
  const deviceService = createDeviceService({ tempRoot, maxUploadBytes, run: adbRun });
  // Crashes can interrupt finally blocks. Sweep only stale uploads, after a window
  // longer than the maximum permitted upload + scan duration.
  const sweep = async () => {
    const cutoff = Date.now() - Math.max(600000, uploadTimeoutMs + scanTimeoutMs + 60000);
    try {
      for (const entry of await fsp.readdir(tempRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith('deploylens-upload-')) continue;
        const candidate = path.resolve(tempRoot, entry.name);
        if (!candidate.startsWith(path.resolve(tempRoot) + path.sep)) continue;
        const stat = await fsp.lstat(candidate);
        if (stat.isDirectory() && stat.mtimeMs < cutoff) await fsp.rm(candidate, { recursive: true, force: true });
      }
    } catch { console.error('Stale upload cleanup could not complete'); }
  };
  void sweep();
  const sweepTimer = setInterval(() => void sweep(), 300000); sweepTimer.unref();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, body) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { json(400, { error: 'Invalid request' }); return; }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(200, { status: 'ok', maxUploadBytes, acceptedFormats: ['apk', 'aab', 'ipa'], retainsHistory: false }); return;
    }
    if (url.pathname === '/api/devices' || url.pathname === '/api/devices/install') {
      if (!deviceRequestAllowed(req, server, localDevices)) {
        json(403, { error: 'Local device access is disabled. Run DeployLens on this computer with DEPLOYLENS_LOCAL_DEVICES=1, bound to 127.0.0.1, and open its local website.' }); req.resume(); return;
      }
      try {
        if (req.method === 'GET' && url.pathname === '/api/devices') json(200, { devices: await deviceService.devices() });
        else if (req.method === 'POST' && url.pathname === '/api/devices/install') json(200, await deviceService.install(req, url));
        else json(405, { error: 'Method not allowed' });
      } catch (error) {
        json(error.status || 503, { error: error.code === 'ENOENT' ? 'ADB was not found. Install Android SDK Platform-Tools and add adb to PATH or set ANDROID_HOME / ANDROID_SDK_ROOT.' : error.status ? error.message : 'Could not communicate with local ADB. Check Platform-Tools, device authorization and the local ADB server.' });
      }
      req.resume(); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/scans') {
      // Same-origin upload only. No CORS support or ambient credentials are required.
      if (req.headers['sec-fetch-site'] === 'cross-site') { json(403, { error: 'Use the upload form on this website' }); req.resume(); return; }
      const origin = req.headers.origin;
      if (origin) {
        try { if (new URL(origin).host !== req.headers.host) throw new Error(); }
        catch { json(403, { error: 'Cross-origin uploads are not allowed' }); req.resume(); return; }
      }
      const fileName = url.searchParams.get('filename') ?? '';
      const ext = path.extname(fileName).toLowerCase();
      if (!['.apk', '.aab', '.ipa'].includes(ext) || fileName.length > 255 || /[\\/\x00-\x1f]/.test(fileName)) {
        json(400, { error: 'Select an APK, AAB, or IPA build archive' }); req.resume(); return;
      }
      if (req.headers['content-type'] !== 'application/octet-stream') { json(415, { error: 'Expected a binary build archive' }); req.resume(); return; }
      const contentLength = Number(req.headers['content-length']);
      if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) { json(413, { error: 'Build exceeds the upload size limit' }); req.resume(); return; }
      if (active >= maxConcurrentScans) { res.setHeader('Retry-After', '15'); json(429, { error: 'All inspection slots are busy. Please try again shortly.' }); req.resume(); return; }
      active++;
      let directory, worker, timer;
      let disconnected = false;
      const stop = () => {
        if (!worker?.pid || worker.exitCode !== null) return;
        if (process.platform === 'win32') execFile('taskkill', ['/pid', String(worker.pid), '/T', '/F'], { windowsHide: true }, error => { if (error) worker.kill('SIGKILL'); });
        else { try { process.kill(-worker.pid, 'SIGKILL'); } catch { worker.kill('SIGKILL'); } }
      };
      const job = { stop };
      jobs.add(job);
      const onClose = () => { if (!res.writableEnded) { disconnected = true; stop(); } };
      res.once('close', onClose);
      try {
        directory = await fsp.mkdtemp(path.join(tempRoot, 'deploylens-upload-'));
        const artifactPath = path.join(directory, `artifact${ext}`);
        let received = 0;
        const uploadController = new AbortController();
        timer = setTimeout(() => uploadController.abort(), uploadTimeoutMs);
        const limit = new Transform({ transform(chunk, _encoding, callback) {
          received += chunk.length;
          callback(received > maxUploadBytes ? Object.assign(new Error('Upload limit exceeded'), { status: 413 }) : null, chunk);
        }});
        await pipeline(req, limit, fs.createWriteStream(artifactPath, { flags: 'wx', mode: 0o600 }), { signal: uploadController.signal });
        clearTimeout(timer);
        if (received < 4) { json(400, { error: 'The selected archive is empty or truncated' }); return; }
        if (disconnected) return;
        const scanId = randomUUID();
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'X-Accel-Buffering': 'no' });
        res.write(JSON.stringify({ type: 'upload.completed', scanId }) + '\n');
        const workerEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
          ['PATH', 'JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL'].includes(key.toUpperCase())));
        worker = fork(workerPath, [], { execArgv: ['--max-old-space-size=512'], detached: process.platform !== 'win32',
          env: { ...workerEnv, TMPDIR: directory, TMP: directory, TEMP: directory }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        const send = event => {
          if (!res.destroyed) {
            // Defense in depth: redact worker-private workspace paths from findings.
            const serialized = JSON.stringify(event).split(JSON.stringify(directory).slice(1, -1)).join('[temporary workspace]');
            res.write(serialized + '\n');
          }
        };
        await new Promise(resolve => {
          let terminal = false;
          timer = setTimeout(() => { terminal = true; send({ type: 'scan.error', message: 'Inspection exceeded the time limit. No readiness verdict was issued.' }); stop(); }, scanTimeoutMs);
          worker.on('message', event => {
            if (terminal) return;
            if (event.type === 'scan.completed' || event.type === 'scan.error') terminal = true;
            send(event);
          });
          worker.once('error', () => { if (!terminal) send({ type: 'scan.error', message: 'Inspection worker could not start.' }); resolve(); });
          worker.once('exit', () => { if (!terminal && !disconnected) send({ type: 'scan.error', message: 'Inspection stopped unexpectedly. No readiness verdict was issued.' }); resolve(); });
          worker.send({ artifactPath, fileName, scanId });
        });
      } catch (error) {
        if (!res.headersSent) json(error.status ?? 400, { error: 'Upload could not be read. Check the archive and size limit, then try again.' });
      } finally {
        clearTimeout(timer);
        jobs.delete(job);
        // Every normal, failed and cancelled job deletes its entire private workspace.
        if (directory) {
          try { await fsp.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
          catch { console.error('Temporary upload cleanup failed; operator action required'); }
        }
        active--;
        res.end();
      }
      return;
    }
    if (url.pathname.startsWith('/api/')) { json(404, { error: 'Endpoint not found' }); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { json(405, { error: 'Method not allowed' }); return; }
    let relative;
    try { relative = decodeURIComponent(url.pathname); } catch { json(400, { error: 'Invalid URL' }); return; }
    const target = path.resolve(staticDir, '.' + (relative === '/' || relative === '/documentation' ? '/index.html' : relative));
    if (!target.startsWith(path.resolve(staticDir) + path.sep)) { json(404, { error: 'Not found' }); return; }
    try {
      const stat = await fsp.stat(target);
      if (!stat.isFile()) throw new Error();
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Content-Length': stat.size });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
    } catch { json(404, { error: 'Not found. Build the website before starting the server.' }); }
  });
  server.requestTimeout = uploadTimeoutMs + 10000;
  server.headersTimeout = 15000;
  server.on('close', () => { clearInterval(sweepTimer); for (const job of jobs) job.stop(); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createWebServer();
  server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1', () => console.log('DeployLens website listening on port ' + (process.env.PORT ?? 3000)));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
}
