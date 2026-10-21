import { useState } from 'react';
import type { ScanSummary, ListingField } from '@deploylens/contracts';
import { Icon } from './Icon.js';
import { safeLink } from './presentation.js';

function ListingCard({ field }: { field: ListingField }) {
  const [notice, setNotice] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(field.value); setNotice('Copied to clipboard'); }
    catch { setNotice('Clipboard unavailable. Select the listing text and copy it manually.'); }
  }
  return <section className="panel listing-card"><div className="panel-heading"><div><h3>{field.label}</h3><p>{field.value.length} / {field.maxChars} characters</p></div><button className="secondary small" onClick={() => void copy()} aria-label={`Copy ${field.label}`}><Icon name="copy"/>Copy</button></div><p className="listing-text">{field.value}</p>{field.notes && <p className="field-note">{field.notes}</p>}<p className="clipboard-notice" role="status">{notice}</p></section>;
}
export function StorePreparation({ summary }: { summary: ScanSummary }) {
  const guidance = summary.storeGuidance;
  const fields = Object.values(guidance.listingTemplates).filter((field): field is ListingField => Boolean(field && typeof field === 'object' && 'value' in field));
  return <section className="report-view"><div className="section-heading"><div><p className="eyebrow">PREPARE YOUR SUBMISSION</p><h2>Store preparation</h2><p>Use these as a starting point. Confirm every claim and complete the store declarations for your app.</p></div></div><div className="callout info"><Icon name="info"/><p>Listing drafts are deterministic templates based on the build metadata. They are not verified descriptions of your app's features.</p></div><div className="detail-grid">{fields.map(field => <ListingCard key={field.label} field={field}/>)}</div><div className="section-heading checklist-heading"><div><h2>Submission checklist</h2><p>Evidence from the archive and tasks that require your review.</p></div><span className="subtle-badge">{guidance.checklist.length} items</span></div><div className="checklist-grid">{guidance.checklist.map(item => <article className="panel checklist-card" key={item.id}><div className="checklist-top"><span className="section-tag">{item.topic}</span><span className="subtle-badge">{item.isDetectedFromArtifact ? 'Archive evidence' : 'Manual task'}</span></div><h3>{item.title}</h3><p>{item.description}</p>{item.evidence && <p className="evidence-text">{item.evidence}</p>}{safeLink(item.officialReferenceUrl) && <a href={safeLink(item.officialReferenceUrl)} target="_blank" rel="noreferrer">Official guidance ↗</a>}</article>)}</div></section>;
}
