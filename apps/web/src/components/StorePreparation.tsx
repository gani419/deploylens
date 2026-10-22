import { useRef, useState } from 'react';
import type { ScanSummary, ListingField } from '@deploylens/contracts';
import { Icon } from './Icon.js';
import { safeLink } from '@deploylens/utils';

function ListingCard({ field, value, onSave }: { field: ListingField; value: string; onSave: (value: string) => void }) {
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState(field.value);
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  const preview = useRef<HTMLButtonElement>(null);
  const displayedValue = editing ? draft : value;
  function startEditing() { cancelled.current = false; setDraft(value); setEditing(true); }
  function finishEditing() { if (!cancelled.current) { onSave(draft); setNotice(''); } setEditing(false); }
  async function copy() {
    try { await navigator.clipboard.writeText(value); setNotice('Copied to clipboard'); }
    catch { setNotice('Clipboard unavailable. Select the listing text and copy it manually.'); }
  }
  return <section className="panel listing-card"><div className="panel-heading"><div><h3>{field.label}</h3><p>{displayedValue.length} / {field.maxChars} characters</p></div><button className="secondary small" onClick={() => void copy()} aria-label={`Copy ${field.label}`}><Icon name="copy"/>Copy</button></div>{editing ? <textarea autoFocus className="listing-text listing-editor" aria-label={field.label} value={draft} rows={Math.min(12, Math.max(3, Math.ceil(draft.length / 70)))} onChange={event => setDraft(event.target.value)} onBlur={finishEditing} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; setEditing(false); requestAnimationFrame(() => preview.current?.focus()); } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur(); requestAnimationFrame(() => preview.current?.focus()); } }}/> : <button ref={preview} type="button" className="listing-text listing-preview" aria-label={`Edit ${field.label}`} title="Click to edit" onClick={startEditing}>{value || 'Tap to add listing text'}</button>} {displayedValue.length > field.maxChars && <p className="error">This draft exceeds the store character limit by {displayedValue.length - field.maxChars} characters.</p>}{field.notes && <p className="field-note">{field.notes}</p>}<p className="clipboard-notice" role="status">{notice}</p></section>;
}
export function StorePreparation({ summary, drafts, onDraftChange }: { summary: ScanSummary; drafts: Record<string, string>; onDraftChange: (key: string, value: string) => void }) {
  const guidance = summary.storeGuidance;
  const fields = Object.values(guidance.listingTemplates).filter((field): field is ListingField => Boolean(field && typeof field === 'object' && 'value' in field));
  return <section className="report-view"><div className="section-heading"><div><p className="eyebrow">PREPARE YOUR SUBMISSION</p><h2>Store preparation</h2><p>Use these as a starting point. Tap any draft to edit it, then copy your updated text. Changes stay in this page session. Confirm every claim and complete the store declarations for your app.</p></div></div><div className="callout info"><Icon name="info"/><p>Listing drafts are deterministic templates based on the build metadata. They are not verified descriptions of your app's features.</p></div><div className="detail-grid">{fields.map(field => <ListingCard key={field.label} field={field} value={drafts[field.label] ?? field.value} onSave={value => onDraftChange(field.label, value)}/>)}</div><div className="section-heading checklist-heading"><div><h2>Submission checklist</h2><p>Evidence from the archive and tasks that require your review.</p></div><span className="subtle-badge">{guidance.checklist.length} items</span></div><div className="checklist-grid">{guidance.checklist.map(item => <article className="panel checklist-card" key={item.id}><div className="checklist-top"><span className="section-tag">{item.topic}</span><span className="subtle-badge">{item.isDetectedFromArtifact ? 'Archive evidence' : 'Manual task'}</span></div><h3>{item.title}</h3><p>{item.description}</p>{item.evidence && <p className="evidence-text">{item.evidence}</p>}{safeLink(item.officialReferenceUrl) && <a href={safeLink(item.officialReferenceUrl)} target="_blank" rel="noreferrer">Official guidance ↗</a>}</article>)}</div></section>;
}
