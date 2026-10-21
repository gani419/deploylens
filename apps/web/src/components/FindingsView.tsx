import { useState } from 'react';
import type { Finding, ScanSummary } from '@deploylens/contracts';
import { StatusBadge } from './StatusBadge.js';
import { safeLink } from './presentation.js';
import { Icon } from './Icon.js';

export function FindingDetails({ finding, initiallyOpen = false }: { finding: Finding; initiallyOpen?: boolean }) {
  const guidance = finding.guidance;
  const fallback = finding.outcome === 'needs-review' ? 'This needs a developer decision. Review the evidence and intended app behavior before treating it as a defect.'
    : finding.outcome === 'not-checked' ? 'This could not be verified with the available tools or archive data. It is not proof of a broken build.'
    : finding.outcome === 'fail' ? 'The inspected evidence did not satisfy this check. Review the affected configuration and confirm the fix in the final release artifact.'
    : 'This outcome applies to the inspected evidence only. Other release requirements may still need verification.';
  return <details className={`finding-card ${finding.outcome}`} open={initiallyOpen}>
    <summary><span className="finding-type"><Icon name={finding.outcome === 'fail' ? 'findings' : finding.outcome === 'pass' ? 'check' : 'info'}/></span><div className="finding-heading"><h3>{finding.title}</h3><p>{finding.affectedFileOrConfig || 'Build archive configuration'}</p></div><StatusBadge outcome={finding.outcome}/><Icon name="chevron" className="disclosure-icon"/></summary>
    <div className="finding-body"><div className="meaning-block"><span className="section-tag">WHAT THIS MEANS</span><p>{guidance?.meaning ?? fallback}</p></div>
      <div className="finding-explanation"><section><h4>Observed evidence</h4><p className="evidence-text">{finding.evidence}</p>{finding.isSuspectedHeuristic && <p className="field-note">Heuristic indication; confirm this against actual app behavior.</p>}</section><section><h4>Why it matters</h4><p>{finding.whyItMatters}</p></section></div>
      {!['pass', 'not-applicable'].includes(finding.outcome) && <div className="finding-explanation action-columns"><section><h4><Icon name="details"/>What to do next</h4><ol>{(guidance?.steps ?? [finding.suggestedRemediation]).map((step, index) => <li key={index}>{step}</li>)}</ol></section><section><h4><Icon name="checks"/>How to verify</h4><ol>{(guidance?.verification ?? ['Inspect the final rebuilt artifact again and verify the affected feature using platform tools.']).map((step, index) => <li key={index}>{step}</li>)}</ol></section></div>}
      <div className="finding-scope"><Icon name="info"/><p>{guidance?.limitation ?? finding.applicabilityNote ?? 'This check does not guarantee production readiness or store approval.'}</p></div>
      <footer className="finding-footer"><div><code>{finding.ruleId}</code><span>Revision {finding.ruleRevision}</span>{finding.sourceReviewDate && <span>Reviewed {finding.sourceReviewDate}</span>}{finding.effectiveDates && <span>Effective: {finding.effectiveDates}</span>}</div>{safeLink(finding.officialReferenceUrl) && <a href={safeLink(finding.officialReferenceUrl)} target="_blank" rel="noreferrer">Official reference <Icon name="arrow"/></a>}</footer>
    </div>
  </details>;
}
export function FindingsView({ summary }: { summary: ScanSummary }) {
  const [query, setQuery] = useState(''), [status, setStatus] = useState('attention'), [severity, setSeverity] = useState('all');
  const findings = summary.stages.flatMap(stage => stage.checks.flatMap(check => check.findings));
  const visible = findings.filter(finding => (status === 'all' || (status === 'attention' ? !['pass', 'not-applicable'].includes(finding.outcome) : finding.outcome === status))
    && (severity === 'all' || finding.severity === severity)
    && `${finding.title} ${finding.evidence} ${finding.affectedFileOrConfig ?? ''} ${finding.ruleId}`.toLowerCase().includes(query.toLowerCase()));
  const sorted = [...visible].sort((a, b) => (['fail', 'needs-review', 'not-checked', 'pass', 'not-applicable'].indexOf(a.outcome) - ['fail', 'needs-review', 'not-checked', 'pass', 'not-applicable'].indexOf(b.outcome)));
  return <section className="report-view"><div className="section-heading"><div><p className="eyebrow">UNDERSTAND. FIX. VERIFY.</p><h2>Findings & fixes</h2><p>Start with failures, then review configuration risks and verification gaps.</p></div><span className="subtle-badge">{visible.length} of {findings.length} findings</span></div>
    <div className="report-toolbar"><label className="search-field"><Icon name="search"/><input aria-label="Search findings" placeholder="Search findings, files, or rule IDs…" value={query} onChange={event => setQuery(event.target.value)}/></label><label className="select-field">Result<select aria-label="Filter findings by result" value={status} onChange={event => setStatus(event.target.value)}><option value="attention">Needs attention</option><option value="all">All findings</option><option value="fail">Failed</option><option value="needs-review">Needs review</option><option value="not-checked">Not checked</option><option value="pass">Passed</option><option value="not-applicable">Not applicable</option></select></label><label className="select-field">Category<select aria-label="Filter findings by severity" value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">All categories</option>{['blocker', 'risk', 'security', 'quality', 'info'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <p className="field-note result-legend"><strong>Failed</strong> = check did not satisfy requirements. <strong>Needs review</strong> = a developer decision is needed. <strong>Not checked</strong> = evidence or tooling was unavailable.</p>
    <div className="finding-list">{sorted.map((finding, index) => <FindingDetails key={`${finding.id}-${status}`} finding={finding} initiallyOpen={index === 0}/>)}</div>{!visible.length && <div className="panel empty-state"><Icon name="search"/><h3>No matching findings</h3><p>Try another filter, or review all checks and the manual verification list before release.</p></div>}
  </section>;
}

export function AllChecks({ summary }: { summary: ScanSummary }) {
  return <section className="report-view"><div className="section-heading"><div><p className="eyebrow">THE COMPLETE INSPECTION</p><h2>All checks</h2><p>Every recorded result, grouped by stage. Open a check to read its evidence and follow-up guidance.</p></div></div>{summary.stages.map(stage => <section className="panel check-stage" key={stage.id}><div className="panel-heading"><span className="stage-number">{String(stage.stageNumber).padStart(2, '0')}</span><div><h3>{stage.name}</h3><p>{stage.checks.length} checks · {stage.lifecycle}</p></div></div>{stage.error && <p className="error">{stage.error}</p>}{stage.checks.map(check => <details className="check-item" key={check.checkId}><summary><span>{check.name}</span><StatusBadge outcome={check.outcome}/><Icon name="chevron"/></summary><div className="check-content">{check.details && <p>{check.details}</p>}{check.findings.map(finding => <FindingDetails key={finding.id} finding={finding} initiallyOpen/>)}{!check.findings.length && <p className="field-note">{check.details ? 'This stage records a direct observation rather than a separate rule finding.' : 'No additional structured evidence was recorded for this check. Use the build details and platform validation before relying on this result.'}</p>}</div></details>)}</section>)}</section>;
}
