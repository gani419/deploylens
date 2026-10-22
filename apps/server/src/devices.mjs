import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const execute = promisify(execFile);
const loopback = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1', '[::1]', 'localhost'].includes(value);
export function deviceRequestAllowed(req, server, enabled) {
  if (!enabled || !loopback(server.address()?.address) || !loopback(req.socket.remoteAddress)) return false;
  try {
    const host = new URL(`http://${req.headers.host}`);
    if (!loopback(host.hostname) || req.headers['sec-fetch-site'] === 'cross-site' || req.headers['x-deploylens-device'] !== '1') return false;
    if (!req.headers.origin) return req.method === 'GET';
    return new URL(req.headers.origin).host === host.host && ['http:', 'https:'].includes(new URL(req.headers.origin).protocol);
  } catch { return false; }
}
export function createDeviceService({ tempRoot, maxUploadBytes, run = execute }) {
  let installing = false;
  const adbPath = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  const adb = adbPath ? path.join(adbPath, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb';
  const command = async (args, timeout = 15000) => run(adb, args, { timeout, windowsHide: true, maxBuffer: 256 * 1024, env: { ...process.env, ADB_SERVER_SOCKET: 'tcp:localhost:5037', ANDROID_ADB_SERVER_PORT: '5037' } });
  const iosCommand = async (tool, args, timeout = 15000) => {
    const executable = process.env.DEPLOYLENS_IOS_TOOLS ? path.join(process.env.DEPLOYLENS_IOS_TOOLS, tool + (process.platform === 'win32' ? '.exe' : '')) : tool;
    return run(executable, args, { timeout, windowsHide: true, maxBuffer: 256 * 1024 });
  };
  async function devices(platform = 'android') {
    if (platform === 'ios') {
      const { stdout } = await iosCommand('idevice_id', ['-l']);
      return stdout.split(/\r?\n/).map(value => value.trim()).filter(serial => /^[a-fA-F0-9-]{16,80}$/.test(serial)).map(serial => ({ serial, state: 'device', model: 'iPhone / iPad', kind: 'Apple USB device' }));
    }
    const { stdout } = await command(['devices', '-l']);
    return stdout.split(/\r?\n/).slice(1).filter(line => line.trim() && !line.startsWith('*')).map(line => {
      const [serial, state, ...details] = line.trim().split(/\s+/);
      return { serial, state, model: details.find(value => value.startsWith('model:'))?.slice(6).replace(/_/g, ' ') || serial, kind: serial.startsWith('emulator-') ? 'Emulator' : 'Device' };
    });
  }
  async function install(req, url) {
    const platform = url.searchParams.get('platform') || 'android';
    if (!['android', 'ios'].includes(platform)) throw Object.assign(new Error('Unsupported device platform.'), { status: 400 });
    const label = platform === 'ios' ? 'IPA' : 'APK';
    if (installing) throw Object.assign(new Error('Another device installation is in progress.'), { status: 409 });
    if (req.headers['content-type'] !== 'application/octet-stream') throw Object.assign(new Error(`Expected an ${label} file.`), { status: 415 });
    const serial = url.searchParams.get('serial') || '', expectedHash = url.searchParams.get('sha256') || '';
    if (!/^[a-zA-Z0-9_.:\[\]-]{1,200}$/.test(serial) || serial.startsWith('-') || !/^[a-f0-9]{64}$/.test(expectedHash)) throw Object.assign(new Error('Select a connected device and a successfully inspected APK.'), { status: 400 });
    if (Number(req.headers['content-length']) > maxUploadBytes) throw Object.assign(new Error('APK exceeds the upload limit.'), { status: 413 });
    installing = true;
    let directory;
    try {
      if (!(await devices(platform)).some(device => device.serial === serial && device.state === 'device')) throw Object.assign(new Error(platform === 'ios' ? 'Apple device disconnected. Connect with USB, unlock it, trust this computer and refresh.' : 'Device is disconnected, offline or unauthorized. Unlock it and approve USB debugging, then refresh.'), { status: 409 });
      directory = await fs.mkdtemp(path.join(tempRoot, 'deploylens-upload-install-'));
      const target = path.join(directory, platform === 'ios' ? 'build.ipa' : 'build.apk'), hash = createHash('sha256');
      let bytes = 0;
      const limit = new Transform({ transform(chunk, _encoding, done) { bytes += chunk.length; hash.update(chunk); done(bytes > maxUploadBytes ? Object.assign(new Error('APK exceeds upload limit.'), { status: 413 }) : null, chunk); } });
      await pipeline(req, limit, (await import('node:fs')).createWriteStream(target, { flags: 'wx', mode: 0o600 }), { signal: AbortSignal.timeout(120000) });
      if (hash.digest('hex') !== expectedHash) throw Object.assign(new Error('Build bytes do not match the inspected archive. Inspect this APK again.'), { status: 400 });
      if (platform === 'ios') {
        const help = await iosCommand('ideviceinstaller', ['--help']);
        const legacy = /--install/.test(help.stdout + help.stderr);
        const result = await iosCommand('ideviceinstaller', ['-u', serial, legacy ? '-i' : 'install', target], 120000);
        const output = `${result.stdout}\n${result.stderr}`;
        if (/\bERROR\b|InstallationFailed|ApplicationVerificationFailed|provisioning profile.*(?:invalid|not found)/i.test(output) || !/\bComplete\b|installed successfully/i.test(output)) throw new Error(output || 'The Apple device did not confirm installation.');
        return { message: 'The Apple device installer confirmed completion. Launch the app on the iPhone/iPad and verify its behavior. Apple signing, provisioning, device eligibility and Developer Mode requirements still apply. This does not change the archive assessment.' };
      }
      const args = ['-s', serial, 'install', ...(url.searchParams.get('replace') === 'true' ? ['-r'] : []), target];
      const { stdout, stderr } = await command(args, 120000);
      if (!/^Success\s*$/m.test(stdout)) throw new Error((stdout || stderr || 'ADB did not confirm installation.').slice(0, 2000));
      return { message: 'APK installed successfully. Launch it on the device and complete runtime testing. Installation does not change the archive assessment.' };
    } catch (error) {
      // Never leak a private server workspace or arbitrary environment data to the page.
      if (error.code === 'ENOENT') throw Object.assign(new Error(platform === 'ios' ? 'Apple device tools were not found. Install libimobiledevice and ideviceinstaller with their dependencies; add them to PATH or set DEPLOYLENS_IOS_TOOLS. Windows also needs the Apple device USB driver.' : 'ADB was not found. Install Android SDK Platform-Tools and set ANDROID_HOME / ANDROID_SDK_ROOT or add adb to PATH.'), { status: 503 });
      const output = error.stdout || error.stderr || error.message || 'Installation failed.';
      const message = String(output).split(directory || '\0').join('[temporary workspace]').slice(0, 2000);
      throw Object.assign(new Error(message), { status: error.status || 400 });
    } finally {
      try { if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
      finally { installing = false; }
    }
  }
  return { devices, install };
}
