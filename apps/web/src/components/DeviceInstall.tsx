import { useState } from 'react';
import type { ScanSummary } from '@deploylens/contracts';

interface Device { serial: string; state: string; model: string; kind: string }
export function DeviceInstall({ summary, file }: { summary: ScanSummary; file: File | null }) {
  const [devices, setDevices] = useState<Device[]>([]), [serial, setSerial] = useState('');
  const [replace, setReplace] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const apk = summary.artifact.artifactType === 'apk';
  const ios = summary.artifact.platform === 'ios';
  const installable = apk || ios;
  const format = ios ? 'IPA' : 'APK';
  const distribution = summary.metadata.ios?.signing.provisioningProfileType;
  const appStoreOnly = ios && distribution === 'app-store';
  const headers = { 'X-DeployLens-Device': '1' };
  async function refresh() {
    setBusy(true); setError(''); setMessage(''); setSerial(''); setDevices([]); setConfirmed(false);
    try {
      const response = await fetch(`/api/devices?platform=${ios ? 'ios' : 'android'}`, { headers: { ...headers, 'X-Requested-With': 'DeployLens' } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setDevices(data.devices); setMessage(data.devices.length ? 'Choose the device you want to install to.' : 'No devices found. Connect a device or start an emulator, then refresh.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Device connection failed.'); }
    finally { setBusy(false); }
  }
  async function install() {
    if (!file || !serial || !confirmed || busy || !installable || appStoreOnly) return;
    setBusy(true); setError(''); setMessage(`Uploading the inspected ${format} to the local installer...`);
    try {
      const response = await fetch(`/api/devices/install?platform=${ios ? 'ios' : 'android'}&serial=${encodeURIComponent(serial)}&sha256=${summary.artifact.sha256}&replace=${replace}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: file, signal: AbortSignal.timeout(260000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(data.message); setConfirmed(false);
    } catch (failure) { setMessage(''); setError(failure instanceof Error ? failure.message : 'Installation failed.'); }
    finally { setBusy(false); }
  }
  return <section className="report-view"><div className="section-heading"><div><p className="eyebrow">TRY IT ON A DEVICE</p><h2>{ios ? 'Install on iPhone' : 'Install on Android'}</h2><p>{ios ? 'Install an eligible signed IPA on an iPhone or iPad connected by USB to this local computer, including Windows.' : 'Install an inspected APK on a physical device or a running emulator connected to your local DeployLens server.'}</p></div></div>
    <div className="collaboration-grid"><section className="panel collaboration-panel"><h3>Local device connection</h3><p>The installer is available when DeployLens runs on this computer with local device access enabled. Hosted websites cannot reach your local USB devices.</p><ol><li>{ios ? <>Install libimobiledevice and ideviceinstaller with their dependencies. Add them to PATH or set <code>DEPLOYLENS_IOS_TOOLS</code> to the tools folder. On Windows, install the Apple USB device driver.</> : 'Install Android SDK Platform-Tools and make adb available.'}</li><li>Run DeployLens locally with <code>DEPLOYLENS_LOCAL_DEVICES=1</code>, bound to <code>127.0.0.1</code>.</li><li>{ios ? 'Connect the iPhone/iPad with USB, unlock it and trust this computer. Development-signed apps may require Developer Mode.' : 'Connect your Android device and approve USB debugging, or start an Android emulator.'}</li><li>Refresh devices, choose a target, and explicitly confirm installation.</li></ol>{ios ? <><a href="https://github.com/libimobiledevice/ideviceinstaller" target="_blank" rel="noreferrer">Apple device tool setup</a><p className="callout warning">The IPA must be signed and provisioned for this device and distribution method. This feature does not re-sign apps, register devices, bypass Apple trust or install arbitrary App Store exports. An existing app with the same identifier may be updated.</p><p>Detected distribution: {distribution || 'Not established'}. Provisioning profile expires: {summary.metadata.ios?.signing.provisioningProfileExpiresAt || 'Not established'}.</p></> : <a href="https://developer.android.com/tools/adb" target="_blank" rel="noreferrer">Android device setup guide</a>}</section>
    <section className="panel collaboration-panel"><h3>Install {summary.artifact.fileName}</h3>{!installable ? <p className="callout warning">{summary.artifact.artifactType === 'aab' ? 'An AAB cannot be installed directly. Generate a signed APK or APK set with bundletool / Android Studio. Inspect an APK here to use the installer; APK-set installation is not supported here yet.' : 'Use an eligible APK or IPA archive.'}</p> : <><button className="secondary" onClick={refresh} disabled={busy}>Refresh connected devices</button><label className="form-field">Target device<select value={serial} disabled={busy} onChange={event => { setSerial(event.target.value); setConfirmed(false); }}><option value="">Select a device</option>{devices.map(device => <option key={device.serial} value={device.serial} disabled={device.state !== 'device'}>{device.model} · {device.kind} · {device.serial} ({device.state})</option>)}</select></label>{!ios && <label className="attachment-toggle"><input type="checkbox" checked={replace} disabled={busy} onChange={event => { setReplace(event.target.checked); setConfirmed(false); }}/><span>Update an existing installation (keep app data)</span></label>}<label className="attachment-toggle"><input type="checkbox" checked={confirmed} disabled={busy || !serial} onChange={event => setConfirmed(event.target.checked)}/><span>Install this {format} on {serial || 'the selected device'}{ios ? ' (may update an existing app with the same identifier)' : replace ? ' and update the existing app' : ''}.</span></label><button className="primary" onClick={install} disabled={busy || !serial || !confirmed || !file || !summary.artifact.sha256 || appStoreOnly}>{busy ? 'Working…' : `Install ${format} on selected device`}</button></>}{appStoreOnly && <p className="callout warning">This profile is for App Store distribution. Use TestFlight for that export, or upload a development/ad-hoc IPA provisioned for your connected device.</p>}{message && <p className="callout info" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}<p className="field-note">Installation does not launch the app, run tests, collect runtime metrics, or change the readiness verdict. No app is uninstalled automatically.</p></section></div>
  </section>;
}
