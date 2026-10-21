import type { ScanSummary } from '@deploylens/contracts';
import { identity, resultLabels } from './presentation.js';
import { product } from '../product.js';
import reportCss from '../styles/export-report.css?raw';

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function reportFile(summary: ScanSummary) {
  const app = identity(summary), assessment = summary.assessment;
  const e = escapeHtml;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${e(app.name)} — DeployLens report</title><style>${reportCss}</style></head><body>
<header><h1>${e(app.name)} — build inspection report</h1><p>${e(product.name)} ${e(product.version)} · Inspected ${e(summary.completedAt)}</p></header>
<dl><dt>App identifier</dt><dd>${e(app.identifier)}</dd><dt>Version / build</dt><dd>${e(app.version)} (${e(app.build)})</dd><dt>Archive</dt><dd>${e(summary.artifact.fileName)} · ${e(summary.artifact.artifactType.toUpperCase())}</dd><dt>SHA-256</dt><dd>${e(summary.artifact.sha256 || 'Not established')}</dd></dl>
<h2>${e(assessment.status)}</h2><p>${e(assessment.summary)}</p><p>${assessment.blockerCount} blockers · ${assessment.warningReviewCount} need review · ${assessment.passedCheckCount} passed · ${assessment.notCheckedCount} not checked</p>
${summary.stages.map(stage => `<section><h2>${e(stage.name)}</h2>${stage.error ? `<p>Stage error: ${e(stage.error)}</p>` : ''}${stage.checks.map(check => `<h3>${e(check.name)} — ${e(resultLabels[check.outcome])}</h3>${check.details ? `<p>${e(check.details)}</p>` : ''}${check.findings.map(finding => `<article><h4>${e(finding.title)} — ${e(resultLabels[finding.outcome])}</h4><p><strong>Evidence:</strong> ${e(finding.evidence)}</p><p><strong>Location:</strong> ${e(finding.affectedFileOrConfig || 'See evidence')}</p><p><strong>Meaning:</strong> ${e(finding.guidance?.meaning || finding.whyItMatters)}</p><p><strong>Why it matters:</strong> ${e(finding.whyItMatters)}</p><p><strong>Recommended fix:</strong> ${e(finding.suggestedRemediation)}</p>${finding.guidance ? `<ol>${finding.guidance.steps.map(step => `<li>${e(step)}</li>`).join('')}</ol><p><strong>How to verify</strong></p><ul>${finding.guidance.verification.map(step => `<li>${e(step)}</li>`).join('')}</ul><p>${e(finding.guidance.limitation)}</p>` : ''}<p>Rule ${e(finding.ruleId)} · revision ${e(finding.ruleRevision)}</p>${finding.officialReferenceUrl?.startsWith('https://') ? `<p><a href="${e(finding.officialReferenceUrl)}" rel="noreferrer">Official reference</a></p>` : ''}</article>`).join('')}`).join('')}</section>`).join('')}
<section><h2>Developer verification still required</h2><ul>${assessment.unverifiedAreas.map(area => `<li><strong>${e(area.area)}:</strong> ${e(area.reason)}</li>`).join('')}</ul></section><footer><p>${e(assessment.disclaimer)}</p><p>This attachment records automated archive checks. It does not include device test results or certify store approval.</p></footer></body></html>`;
  return new File([html], `${summary.artifact.fileName}.deploylens.html`, { type: 'text/html' });
}
export function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function defaultMessage(summary: ScanSummary) {
  const app = identity(summary), a = summary.assessment;
  const findings = summary.stages.flatMap(stage => stage.checks.flatMap(check => check.findings)).filter(f => f.outcome === 'fail' || f.outcome === 'needs-review');
  return `Hello team,\n\nPlease review the ${summary.artifact.artifactType.toUpperCase()} build report for ${app.name}.\n\nApp: ${app.identifier}\nVersion: ${app.version} (${app.build})\nBuild: ${summary.artifact.fileName}\nAssessment: ${a.status}\nResults: ${a.blockerCount} blockers, ${a.warningReviewCount} need review, ${a.passedCheckCount} passed, ${a.notCheckedCount} not checked.\n${findings.length ? `\nPriority findings:\n${[...findings].sort((x, y) => Number(y.outcome === 'fail') - Number(x.outcome === 'fail')).slice(0, 5).map(f => `- ${f.title}: ${f.suggestedRemediation}`).join('\n')}\n` : ''}\nKindly review the findings, fix the issues, and share an update with the team. Please also complete the device and developer checks before release.\n\nThe report is available as a separate attachment. Please attach the downloaded report before sending.\n${a.disclaimer}\n\nRegards,\n[Name]\n[Number]`;
}
export async function emailDraft(subject: string, body: string, to: string, attachment: File) {
  // Export a portable MIME email with a real report attachment; no message is sent.
  const bytes = new Uint8Array(await attachment.arrayBuffer());
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).match(/.{1,76}/g)?.join('\r\n') ?? '';
  const utf8Base64 = (value: string) => {
    let text = ''; for (const byte of new TextEncoder().encode(value)) text += String.fromCharCode(byte);
    return btoa(text);
  };
  const boundary = `deploylens-${crypto.randomUUID()}`;
  const message = [`To: ${to.replace(/[\r\n]/g, '')}`, `Subject: =?UTF-8?B?${utf8Base64(subject)}?=`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', utf8Base64(body).match(/.{1,76}/g)?.join('\r\n') ?? '', `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Disposition: attachment; filename="DeployLens-report.html"', 'Content-Transfer-Encoding: base64', '', encoded, `--${boundary}--`, ''].join('\r\n');
  return new File([message], 'DeployLens-report.eml', { type: 'message/rfc822' });
}
