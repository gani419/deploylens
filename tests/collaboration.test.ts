import { describe, expect, it } from 'vitest';
import type { Finding, ScanSummary } from '@deploylens/contracts';
import { compareBuilds } from '@deploylens/reporting';
import { renderReportHtml, defaultMessage } from '@deploylens/reporting';
import { emailDraft, reportFile } from '../apps/web/src/components/reportExport.js';

function finding(outcome: Finding['outcome'], patch: Partial<Finding> = {}): Finding {
  return { id: Math.random().toString(), ruleId: 'SDK-1', ruleRevision: '2026.10', title: 'Target SDK', outcome, severity: 'blocker', evidence: 'targetSdkVersion: 35', affectedFileOrConfig: 'AndroidManifest.xml', whyItMatters: 'Store requirement', suggestedRemediation: 'Update target SDK', ...patch };
}
function summary(findings: Finding[]): ScanSummary {
  return { scanId: 'sample', artifact: { fileName: 'release.apk', sizeBytes: 100, platform: 'android', artifactType: 'apk', path: 'release.apk' }, metadata: { android: { appLabel: 'Sample', packageId: 'com.sample', versionName: '1.0', versionCode: 1, permissions: { declared: [], sensitivePermissions: [], requiresSpecialApproval: [] } } }, stages: [{ name: 'SDK', checks: [{ name: 'SDK check', outcome: 'fail', findings }] }], assessment: { status: 'ACTION REQUIRED', summary: 'Resolve blockers', blockerCount: 1, warningReviewCount: 0, passedCheckCount: 0, notCheckedCount: 0, unverifiedAreas: [{ area: 'Runtime', reason: 'Test on a device' }], disclaimer: 'No store approval guarantee' }, completedAt: '2026-10-21T10:00:00Z' } as ScanSummary;
}
describe('Build comparison evidence', () => {
  it('matches stable rules and locations, not randomized finding IDs, and detects new issues', () => {
    const result = compareBuilds(summary([finding('fail')]), summary([finding('pass'), finding('fail', { ruleId: 'NEW' })]));
    expect(result.error).toBeUndefined(); expect(result.fixed).toHaveLength(1); expect(result.added).toHaveLength(1);
  });
  it.each(['missing', 'not-checked', 'not-applicable', 'revision-change', 'location-change'] as const)('does not call %s evidence a fix', mode => {
    const next = mode === 'missing' ? [] : [finding(mode === 'not-checked' || mode === 'not-applicable' ? mode : 'pass', mode === 'revision-change' ? { ruleRevision: '2027' } : mode === 'location-change' ? { affectedFileOrConfig: 'different file' } : {})];
    const result = compareBuilds(summary([finding('fail')]), summary(next));
    expect(result.fixed).toHaveLength(0); expect(result.unconfirmed).toHaveLength(1);
  });
  it('rejects unrelated apps and flags differences in coverage and format', () => {
    const previous = summary([finding('fail')]), current = summary([finding('pass')]);
    current.metadata.android!.packageId = 'com.other'; expect(compareBuilds(previous, current).error).toContain('same platform');
    current.metadata.android!.packageId = 'com.sample'; current.artifact.artifactType = 'aab';
    current.stages[0]!.checks[0]!.findings[0]!.ruleRevision = 'new';
    const result = compareBuilds(previous, current); expect(result.formatChanged).toBe(true); expect(result.ruleSetChanged).toBe(true);
  });
  it('matches the same XML element when the failing attribute value is removed from its location label', () => {
    const result = compareBuilds(summary([finding('fail', { affectedFileOrConfig: 'AndroidManifest.xml (<application android:debuggable="true">)' })]), summary([finding('pass', { affectedFileOrConfig: 'AndroidManifest.xml (<application>)' })]));
    expect(result.fixed).toHaveLength(1);
  });
});
describe('Shareable reports', () => {
  it('gives native recipients attachment instructions appropriate to a share handoff', () => {
    const message = defaultMessage(summary([]), 'native');
    expect(message).toContain('Confirm the receiving app includes it');
    expect(message).not.toContain('attach the downloaded report');
  });
  it('escapes archive-supplied HTML, includes fixes, and generates an offline report', async () => {
    const data = summary([finding('fail', { evidence: '<img src=x onerror=alert(1)>' })]);
    data.metadata.android!.appLabel = '<script>alert(1)</script>';
    const html = await reportFile(data).text();
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x'); expect(html).toContain('&lt;img'); expect(html).toContain('Update target SDK'); expect(html).toContain('<style>'); expect(html).toContain('Runtime');
  });
  it('exports an editable-context UTF-8 email with a genuine base64 report attachment', async () => {
    const data = summary([finding('fail')]); data.metadata.android!.appLabel = 'Café';
    const body = defaultMessage(data); expect(body).toContain('Hello team,'); expect(body).toContain('Café'); expect(body).toContain('[Number]');
    const draft = await emailDraft('Café report', body, 'team@example.com\r\nBcc: injected@example.com', reportFile(data));
    const text = await draft.text(); expect(text).toContain('Content-Disposition: attachment;'); expect(text).toContain('multipart/mixed'); expect(text).not.toContain('\r\nBcc:');
    const encoded = text.split('Content-Transfer-Encoding: base64\r\n\r\n')[2]!.split('\r\n--')[0]!;
    expect(Buffer.from(encoded.replace(/\r\n/g, ''), 'base64').toString()).toContain('Café');
  });
});

describe('Portable readable report export', () => {
  it('uses the same report content across web and native and escapes session drafts', async () => {
    const data = summary([finding('fail')]);
    const html = renderReportHtml(data, {reviewed: ['Runtime <script>'], listingDrafts: {Description: '<img src=x onerror=alert(1)>'}});
    expect(html).toContain('Session review markers'); expect(html).toContain('Edited listing drafts');
    expect(html).toContain('&lt;img'); expect(html).not.toContain('<img'); expect(html).not.toContain('<script>');
    expect(html).toContain('do not change the automated verdict');
    const web = await reportFile(data).text();
    expect(web.slice(web.indexOf('<dl>'))).toBe(renderReportHtml(data).slice(renderReportHtml(data).indexOf('<dl>')));
  });
});
