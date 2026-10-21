import { useState } from 'react';
import type { ScanSummary } from '@deploylens/contracts';

interface Device { serial: string; state: string; model: string; kind: string }
export function DeviceInstall({ summary, file }: { summary: ScanSummary; file: File | null }) {
  const [devices, setDevices] = useState<Device[]>([]), [serial, setSerial] = useState('');
  const [replace, setReplace] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const apk = summary.artifact.artifactType === 'apk';
  const headers = { 'X-DeployLens-Device': '1' };
  async function refresh() {
    setBusy(true); setError(''); setMessage(''); setSerial(''); setDevices([]); setConfirmed(false);
    try {
      const response = await fetch('/api/devices', { headers: { ...headers, 'X-Requested-With': 'DeployLens' } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setDevices(data.devices); setMessage(data.devices.length ? 'Choose the device you want to install to.' : 'No devices found. Connect a device or start an emulator, then refresh.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Device connection failed.'); }
    finally { setBusy(false); }
  }
  async function install() {
    if (!file || !serial || !confirmed || busy || !apk) return;
    setBusy(true); setError(''); setMessage('Uploading the inspected APK to the local installer…');
    try {
      const response = await fetch(`/api/devices/install?serial=${encodeURIComponent(serial)}&sha256=${summary.artifact.sha256}&replace=${replace}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: file, signal: AbortSignal.timeout(260000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(data.message); setConfirmed(false);
    } catch (failure) { setMessage(''); setError(failure instanceof Error ? failure.message : 'Installation failed.'); }
    finally { setBusy(false); }
  }
  return <section className="report-view"><div className="section-heading"><div><p className="eyebrow">TRY IT ON A DEVICE</p><h2>Install on Android</h2><p>Install an inspected APK on a physical device or a running emulator connected to your local DeployLens server.</p></div></div>
    <div className="collaboration-grid"><section className="panel collaboration-panel"><h3>Local device connection</h3><p>The installer is available when DeployLens runs on this computer with local device access enabled. A hosted website cannot use the server's ADB connection to access your computer.</p><ol><li>Install Android SDK Platform-Tools and make adb available.</li><li>Run DeployLens locally with <code>DEPLOYLENS_LOCAL_DEVICES=1</code>, bound to <code>127.0.0.1</code>.</li><li>Connect your Android device and approve USB debugging, or start an Android emulator.</li><li>Refresh devices, choose a target, and explicitly confirm installation.</li></ol><a href="https://developer.android.com/tools/adb" target="_blank" rel="noreferrer">Android device setup guide</a></section>
    <section className="panel collaboration-panel"><h3>Install {summary.artifact.fileName}</h3>{!apk ? <p className="callout warning">{summary.artifact.artifactType === 'aab' ? 'An AAB cannot be installed directly. Generate a signed APK or APK set with bundletool / Android Studio. Inspect an APK here to use the installer; APK-set installation is not supported here yet.' : 'IPA installation is not supported here. Use Xcode, TestFlight or an authorized iOS distribution flow.'}</p> : <><button className="secondary" onClick={refresh} disabled={busy}>Refresh connected devices</button><label className="form-field">Target device<select value={serial} disabled={busy} onChange={event => { setSerial(event.target.value); setConfirmed(false); }}><option value="">Select a device</option>{devices.map(device => <option key={device.serial} value={device.serial} disabled={device.state !== 'device'}>{device.model} · {device.kind} · {device.serial} ({device.state})</option>)}</select></label><label className="attachment-toggle"><input type="checkbox" checked={replace} disabled={busy} onChange={event => { setReplace(event.target.checked); setConfirmed(false); }}/><span>Update an existing installation (keep app data)</span></label><label className="attachment-toggle"><input type="checkbox" checked={confirmed} disabled={busy || !serial} onChange={event => setConfirmed(event.target.checked)}/><span>Install this APK on {serial || 'the selected device'}{replace ? ' and update the existing app' : ''}.</span></label><button className="primary" onClick={install} disabled={busy || !serial || !confirmed || !file || !summary.artifact.sha256}>{busy ? 'Working…' : 'Install APK on selected device'}</button></>}{message && <p className="callout info" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}<p className="field-note">Installation does not launch the app, run tests, collect runtime metrics, or change the readiness verdict. No app is uninstalled automatically.</p></section></div>
  </section>;
}
