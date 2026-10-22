import { useState } from 'react';
import type { SharingDraft } from '@deploylens/store';
import type { ScanSummary } from '@deploylens/contracts';
import { size } from '@deploylens/utils';
import { defaultMessage } from '@deploylens/reporting';
import { emailDraft, reportFile, saveFile } from './reportExport.js';

export function ShareReport({ summary, file, draft, onDraftChange }: { summary: ScanSummary; file: File | null; draft: SharingDraft; onDraftChange: (draft: SharingDraft) => void }) {
  const [notice, setNotice] = useState('');
  const { subject, body, to, includeBuild, destination } = draft;
  const setSubject = (subject: string) => onDraftChange({ ...draft, subject });
  const setBody = (body: string) => onDraftChange({ ...draft, body });
  const setTo = (to: string) => onDraftChange({ ...draft, to });
  const setIncludeBuild = (includeBuild: boolean) => onDraftChange({ ...draft, includeBuild });
  const setDestination = (destination: string) => onDraftChange({ ...draft, destination });
  const report = reportFile(summary);
  const attachments = includeBuild && file ? [report, file] : [report];
  const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: attachments });
  async function nativeShare() {
    try {
      if (!navigator.share) { const copied = await copy(); setNotice(copied ? 'System sharing is unavailable in this browser. Message copied; download attachments and paste into your preferred app.' : 'System sharing and clipboard access are unavailable. Select the message to copy manually, then download and attach the files.'); return; }
      await navigator.share(canShare ? { title: subject, text: body, files: attachments } : { title: subject, text: body }); setNotice(canShare ? 'Share handoff completed. Check the selected app to confirm delivery.' : 'Message handed to the share menu. Attachments were not included because this browser cannot share these file types. Download and attach them separately.'); }
    catch (error) { setNotice(error instanceof Error && error.name === 'AbortError' ? 'Sharing cancelled. Nothing was sent by DeployLens.' : 'This file combination could not be shared. Download the files and attach them in your chosen app.'); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${subject}\n\n${body}`); setNotice('Message copied. Paste it into your conversation, then attach the downloaded files.'); return true; }
    catch { setNotice('Clipboard access is unavailable. Select and copy the message below.'); return false; }
  }
  function open(url: string) { window.open(url, '_blank', 'noopener,noreferrer'); setNotice('Composer opened with your message where supported. Download and attach the report and optional build before sending.'); }
  return <section className="report-view"><div className="section-heading"><div><p className="eyebrow">KEEP YOUR TEAM INFORMED</p><h2>Share report & build</h2><p>Edit the message, choose your attachments, and send from your own email or messaging app.</p></div></div>
    <div className="collaboration-grid"><section className="panel collaboration-panel"><h3>Message draft</h3><label className="form-field">Email recipients (optional)<input value={to} onChange={event => setTo(event.target.value)} placeholder="team@example.com"/></label><label className="form-field">Subject<input value={subject} onChange={event => setSubject(event.target.value)}/></label><label className="form-field">Message<textarea rows={20} value={body} onChange={event => setBody(event.target.value)}/></label><button className="secondary" onClick={() => { setBody(defaultMessage(summary)); setNotice('Default message restored.'); }}>Restore default message</button></section>
    <aside className="panel collaboration-panel"><h3>Attachments</h3><p><strong>Report:</strong> {report.name}</p><p className="field-note">A readable, standalone HTML report with evidence and fixes. Open it in a browser; use Print → Save as PDF if needed.</p><label className="attachment-toggle"><input type="checkbox" checked={includeBuild} disabled={!file} onChange={event => setIncludeBuild(event.target.checked)}/><span>Also share the original {summary.artifact.artifactType.toUpperCase()}<small>{file ? `${file.name} · ${size(file.size)}` : 'Original build is no longer available.'}</small></span></label><p className="field-note">The build is optional. Check your team's sharing policy and the receiving app's file restrictions and size limits.</p>
      <div className="action-stack"><button className="primary" onClick={() => saveFile(report, report.name)}>Download readable report</button>{includeBuild && file && <button className="secondary" onClick={() => saveFile(file, file.name)}>Download original build</button>}<button className="primary" onClick={nativeShare}>Share</button></div><p className="field-note">{canShare ? 'Choose an available app from your device share menu. Supported targets vary by device.' : 'File sharing is unavailable for these attachments in this browser. Download and attach them manually.'}</p>
      <h3>Copy to your preferred app</h3><p className="field-note">Share opens your device's available sharing apps when supported. You can also copy the editable message and open an app yourself.</p><div className="action-stack"><button className="secondary" onClick={copy}>Copy message</button><label className="form-field">Open after copying<select aria-label="Sharing destination" value={destination} onChange={event => setDestination(event.target.value)}><option value="gmail">Gmail</option><option value="outlook">Outlook</option><option value="whatsapp">WhatsApp</option><option value="chat">Google Chat</option></select></label><button className="secondary" onClick={() => { const urls: Record<string, string> = { gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, outlook: `https://outlook.live.com/mail/0/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, whatsapp: `https://wa.me/?text=${encodeURIComponent(`${subject}\n\n${body}`)}`, chat: 'https://chat.google.com/' }; open(urls[destination]!); void copy(); }}>Copy &amp; open selected app</button><button className="secondary" onClick={async () => { const draft = await emailDraft(subject, body, to, report); saveFile(draft, draft.name); setNotice('Email file downloaded with the report attached. Opening/importing EML depends on your mail client. The original build is not included; attach it separately if selected.'); }}>Download email with report attached (.eml)</button></div><p className="field-note">Compose links cannot attach local files. For other mail or chat apps, use Copy message and paste it manually, then attach your downloaded files.</p>
    </aside></div>{notice && <p className="callout info" role="status">{notice}</p>}<p className="field-note">No public report link is created and DeployLens does not send messages. Drafts and the selected build stay in page memory until you inspect another build or reload.</p>
  </section>;
}
