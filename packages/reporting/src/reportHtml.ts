import type { ScanSummary } from '@deploylens/contracts';
import { identity, resultLabels } from '@deploylens/utils';

export interface ReportHtmlOptions {
  css?: string;
  productLabel?: string;
  reviewed?: readonly string[];
  listingDrafts?: Readonly<Record<string, string>>;
}
const defaultReportCss = 'body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:auto;padding:24px;color:#172c23}h1,h2,h3{line-height:1.25}section,article{border-top:1px solid #cbd5ce;margin-top:24px;padding-top:12px}p,dd,li{white-space:pre-wrap;overflow-wrap:anywhere}dt{font-weight:bold}dd{margin-bottom:10px}footer{border-top:1px solid #cbd5ce;margin-top:32px}';

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function renderReportHtml(summary: ScanSummary, options: ReportHtmlOptions = {}) {
  const app = identity(summary), assessment = summary.assessment;
  const e = escapeHtml;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${e(app.name)} — DeployLens report</title><style>${options.css || defaultReportCss}</style></head><body>
<header><h1>${e(app.name)} — build inspection report</h1><p>${e(options.productLabel || 'DeployLens')} · Inspected ${e(summary.completedAt)}</p></header>
<dl><dt>App identifier</dt><dd>${e(app.identifier)}</dd><dt>Version / build</dt><dd>${e(app.version)} (${e(app.build)})</dd><dt>Archive</dt><dd>${e(summary.artifact.fileName)} · ${e(summary.artifact.artifactType.toUpperCase())}</dd><dt>SHA-256</dt><dd>${e(summary.artifact.sha256 || 'Not established')}</dd></dl>
<h2>${e(assessment.status)}</h2><p>${e(assessment.summary)}</p><p>${assessment.blockerCount} blockers · ${assessment.warningReviewCount} need review · ${assessment.passedCheckCount} passed · ${assessment.notCheckedCount} not checked</p>
${summary.stages.map(stage => `<section><h2>${e(stage.name)}</h2>${stage.error ? `<p>Stage error: ${e(stage.error)}</p>` : ''}${stage.checks.map(check => `<h3>${e(check.name)} — ${e(resultLabels[check.outcome])}</h3>${check.details ? `<p>${e(check.details)}</p>` : ''}${check.findings.map(finding => `<article><h4>${e(finding.title)} — ${e(resultLabels[finding.outcome])}</h4><p><strong>Evidence:</strong> ${e(finding.evidence)}</p><p><strong>Location:</strong> ${e(finding.affectedFileOrConfig || 'See evidence')}</p><p><strong>Meaning:</strong> ${e(finding.guidance?.meaning || finding.whyItMatters)}</p><p><strong>Why it matters:</strong> ${e(finding.whyItMatters)}</p><p><strong>Recommended fix:</strong> ${e(finding.suggestedRemediation)}</p>${finding.guidance ? `<ol>${finding.guidance.steps.map(step => `<li>${e(step)}</li>`).join('')}</ol><p><strong>How to verify</strong></p><ul>${finding.guidance.verification.map(step => `<li>${e(step)}</li>`).join('')}</ul><p>${e(finding.guidance.limitation)}</p>` : ''}<p>Rule ${e(finding.ruleId)} · revision ${e(finding.ruleRevision)}</p>${finding.officialReferenceUrl?.startsWith('https://') ? `<p><a href="${e(finding.officialReferenceUrl)}" rel="noreferrer">Official reference</a></p>` : ''}</article>`).join('')}`).join('')}</section>`).join('')}
${options.reviewed?.length ? `<section><h2>Session review markers</h2><p>These markers record manual review and do not change the automated verdict.</p><ul>${options.reviewed.map(area => `<li>${e(area)}</li>`).join('')}</ul></section>` : ''}
${options.listingDrafts && Object.keys(options.listingDrafts).length ? `<section><h2>Edited listing drafts</h2>${Object.entries(options.listingDrafts).map(([label, value]) => `<h3>${e(label)}</h3><p>${e(value)}</p>`).join('')}</section>` : ''}
<section><h2>Developer verification still required</h2><ul>${assessment.unverifiedAreas.map(area => `<li><strong>${e(area.area)}:</strong> ${e(area.reason)}</li>`).join('')}</ul></section><footer><p>${e(assessment.disclaimer)}</p><p>This attachment records automated archive checks. It does not include device test results or certify store approval.</p></footer></body></html>`;
  return html;
}
