import { describe, expect, it, vi } from 'vitest';
import { createInspectionStore, createReportSessionStore } from '@deploylens/store';
import { createInspectionDecoder, scanUploadPath } from '@deploylens/api-client';
import { archiveType, validateArchive } from '@deploylens/utils';
import type { InspectionEvent, ScanSummary } from '@deploylens/contracts';

describe('Portable inspection protocol', () => {
  it('decodes split NDJSON, CRLF, blank lines and an unterminated final event', () => {
    const received: InspectionEvent[] = [], decoder = createInspectionDecoder(event => received.push(event));
    decoder.push('{"type":"upload.comp');
    decoder.push('leted","scanId":"one"}\r\n\n{"type":"scan.error","message":"No ');
    decoder.push('verdict"}'); decoder.finish(); decoder.finish();
    expect(received).toEqual([{ type: 'upload.completed', scanId: 'one' }, { type: 'scan.error', message: 'No verdict' }]);
    expect(() => decoder.push('')).toThrow('closed');
  });
  it.each(['{"type":"unknown"}\n', '{"type":"scan.completed","scanId":"one","summary":{}}\n', '{broken}\n'])('rejects unusable wire data: %s', input => {
    expect(() => createInspectionDecoder(() => {}).push(input)).toThrow();
  });
  it('encodes filenames and validates portable archive descriptors without file APIs', () => {
    expect(scanUploadPath('my app & release.aab')).toBe('/api/scans?filename=my%20app%20%26%20release.aab');
    expect(archiveType('APP.APK')).toBe('apk'); expect(archiveType('file.zip')).toBe(null); expect(archiveType('apk')).toBe(null);
    expect(validateArchive({ name: 'a.apk', size: 100 }, 101)).toBe(null);
    expect(validateArchive({ name: 'a.apk', size: 102 }, 101)).toContain('non-empty');
    expect(validateArchive({ name: 'a.zip', size: 100 })).toContain('not supported');
    expect(validateArchive({ name: 'a.apk', size: Number.NaN })).toContain('non-empty');
  });
});
describe('Portable session state', () => {
  it('isolates current and baseline scans and ignores events from a different scan', () => {
    const current = createInspectionStore(), baseline = createInspectionStore();
    const notify = vi.fn(), unsubscribe = current.subscribe(notify);
    current.begin(); current.event({ type: 'upload.completed', scanId: 'current' });
    current.event({ type: 'scan.error', message: 'Current inspection failed' });
    expect(current.getState().error).toContain('Current'); expect(baseline.getState().error).toBe('');
    current.reset(); current.begin(); current.event({ type: 'upload.completed', scanId: 'new' });
    const snapshot = current.getState();
    current.event({ type: 'stage.error', scanId: 'old', stageId: 'android-read-app-info', error: 'Stale error', timestamp: '' });
    expect(current.getState()).toBe(snapshot); expect(notify).toHaveBeenCalled(); unsubscribe();
  });
  it('preserves service limits on reset and never accepts completion after cancellation', () => {
    const store = createInspectionStore(); store.setLimit(400); store.begin(); store.progress(200);
    expect(store.getState().progress).toBe(100);
    store.fail('Cancelled'); store.event({ type: 'scan.completed', scanId: 'late', summary: {} as ScanSummary, timestamp: '' });
    expect(store.getState().summary).toBe(null); store.reset();
    expect(store.getState()).toMatchObject({ phase: 'idle', limit: 400, error: '', summary: null });
  });
  it('retains edits within a report session without leaking into another report', () => {
    const first = createReportSessionStore('one'), second = createReportSessionStore('two');
    const initial = first.getState();
    first.setReviewed(() => ['Runtime', 'Runtime']); first.setListingDraft('Description', 'My edited listing');
    first.setSharingDraft({ subject: 'Release', body: 'Hello team', to: '', includeBuild: true, destination: 'gmail' });
    expect(first.getState().reviewed).toEqual(['Runtime']); expect(initial.listingDrafts).toEqual({});
    expect(second.getState()).toEqual({ scanId: 'two', reviewed: [], listingDrafts: {}, sharingDraft: null });
  });
});
