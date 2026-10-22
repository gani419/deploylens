import {describe, expect, it, vi} from 'vitest';
import type {InspectionObserver} from '@deploylens/api-client';
import type {ScanSummary} from '@deploylens/contracts';
import {createMobileInspectionSession} from '../apps/mobile/src/app/inspectionSession';

const build = (name = 'current.apk') => ({name, size: 100, type: 'apk' as const, localUri: `file:///cache/${name}`});
function summary(scanId = 'current'): ScanSummary {
  return {scanId, artifact: {fileName: `${scanId}.apk`, sizeBytes: 100, platform: 'android', artifactType: 'apk'},
    metadata: {android: {appLabel: 'Sample', packageId: 'com.sample', versionName: '1.0', versionCode: 1}}, stages: [],
    assessment: {status: 'REVIEW REQUIRED', blockerCount: 0, warningReviewCount: 1, passedCheckCount: 1, notCheckedCount: 0, disclaimer: 'Static inspection only'}} as unknown as ScanSummary;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => {resolve = yes;}); return {promise, resolve}; }
function setup(cleanup = Promise.resolve()) {
  const requests: {observer: InspectionObserver; cancel: ReturnType<typeof vi.fn>}[] = [];
  const deps = {
    cleanup: vi.fn(() => cleanup), pickBuild: vi.fn(async (): Promise<ReturnType<typeof build> | null> => build()), removeCachedBuild: vi.fn(async () => {}),
    inspectArchive: vi.fn((_url: string, _archive: ReturnType<typeof build>, observer: InspectionObserver) => {
      const request = {observer, cancel: vi.fn()}; requests.push(request); return request;
    }),
  };
  const session = createMobileInspectionSession(deps);
  const complete = (index: number, id = 'current') => {
    const sink = requests[index].observer;
    sink.onEvent({type: 'scan.completed', scanId: id, summary: summary(id), timestamp: ''}); sink.onComplete();
  };
  const scan = async () => {await session.choose(); session.start('https://inspect.example', true); complete(0);};
  return {session, deps, requests, complete, scan};
}

describe('Mobile report sessions', () => {
  it('waits for startup cleanup and prevents duplicate system pickers', async () => {
    const cleanup = deferred<void>(), picked = deferred<ReturnType<typeof build>>();
    const {session, deps} = setup(cleanup.promise);
    deps.pickBuild.mockReturnValueOnce(picked.promise);
    const choosing = session.choose(); await session.choose();
    expect(deps.pickBuild).not.toHaveBeenCalled();
    cleanup.resolve(); await Promise.resolve();
    expect(deps.pickBuild).toHaveBeenCalledTimes(1);
    picked.resolve(build()); await choosing;
    expect(session.files.getState()).toMatchObject({choosing: false, archive: build()});
  });
  it('retains a successful original for sharing and lets it be removed without losing the report', async () => {
    const {session, deps, scan} = setup(); await scan();
    expect(deps.removeCachedBuild).not.toHaveBeenCalledWith(build());
    session.report.setSharingDraft({...session.report.getState().sharingDraft!, includeBuild: true});
    session.removeOriginal();
    expect(deps.removeCachedBuild).toHaveBeenCalledWith(build());
    expect(session.current.getState().summary?.scanId).toBe('current');
    expect(session.report.getState().sharingDraft?.includeBuild).toBe(false);
  });
  it('clears comparison, drafts, markers and originals when replacing the current report', async () => {
    const {session, deps, requests, scan} = setup(); await scan();
    session.report.setListingDraft('Description', 'Edited'); session.report.setReviewed(() => ['Runtime']);
    await session.compare('https://inspect.example', true);
    const old = requests[1];
    deps.pickBuild.mockResolvedValueOnce(build('new.apk')); await session.choose();
    expect(old.cancel).toHaveBeenCalledOnce();
    old.observer.onEvent({type: 'scan.completed', scanId: 'old', summary: summary('old'), timestamp: ''}); old.observer.onComplete();
    expect(session.baseline.getState().summary).toBeNull();
    expect(session.report.getState()).toMatchObject({scanId: null, listingDrafts: {}, reviewed: [], sharingDraft: null});
    expect(session.files.getState().archive?.name).toBe('new.apk');
  });
  it('ignores a late picker response after reset and removes the newly created cache copy', async () => {
    const {session, deps} = setup(); const picked = deferred<ReturnType<typeof build>>();
    deps.pickBuild.mockReturnValueOnce(picked.promise);
    const choosing = session.choose(); await Promise.resolve(); session.reset();
    picked.resolve(build('late.apk')); await choosing;
    expect(session.files.getState().archive).toBeNull();
    expect(deps.removeCachedBuild).toHaveBeenCalledWith(build('late.apk'));
  });
  it('cancels only the comparison and cleans its archive, preserving the current report and drafts', async () => {
    const {session, deps, requests, scan} = setup(); await scan();
    session.report.setListingDraft('Description', 'Keep this');
    deps.pickBuild.mockResolvedValueOnce(build('old.apk')); await session.compare('https://inspect.example', true);
    await session.compare('https://inspect.example', true);
    expect(requests).toHaveLength(2);
    session.cancelComparison(); requests[1].observer.onError('Late error');
    expect(requests[1].cancel).toHaveBeenCalledOnce();
    expect(deps.removeCachedBuild).toHaveBeenCalledWith(build('old.apk'));
    expect(session.current.getState().summary?.scanId).toBe('current');
    expect(session.report.getState().listingDrafts.Description).toBe('Keep this');
    expect(session.baseline.getState().error).toContain('cancelled');
  });
  it('cleans comparison archives on completion and reports a disconnected service', async () => {
    const {session, deps, complete, scan} = setup(); await scan();
    await session.compare('https://inspect.example', false);
    expect(session.baseline.getState().error).toContain('connection');
    deps.pickBuild.mockResolvedValueOnce(build('old.apk')); await session.compare('https://inspect.example', true); complete(1, 'old');
    expect(session.baseline.getState().summary?.scanId).toBe('old');
    expect(deps.removeCachedBuild).toHaveBeenCalledWith(build('old.apk'));
  });
  it('keeps the report and edits when choosing a replacement fails or is cancelled', async () => {
    const {session, deps, scan} = setup(); await scan();
    session.report.setReviewed(() => ['Runtime']);
    deps.pickBuild.mockRejectedValueOnce(new Error('Provider unavailable')); await session.choose();
    expect(session.current.getState().summary?.scanId).toBe('current');
    expect(session.current.getState().error).toBe('Provider unavailable');
    expect(session.report.getState().reviewed).toEqual(['Runtime']);
    deps.pickBuild.mockResolvedValueOnce(null); await session.choose();
    expect(session.current.getState().summary?.scanId).toBe('current');
    expect(session.report.getState().reviewed).toEqual(['Runtime']);
  });
  it('cleans failed and cancelled current scans and ignores stale completion after dispose', async () => {
    const {session, deps, requests} = setup(); await session.choose(); session.start('https://inspect.example', true);
    requests[0].observer.onError('Network lost');
    expect(session.files.getState().archive).toBeNull(); expect(deps.removeCachedBuild).toHaveBeenCalledWith(build());
    await session.choose(); session.start('https://inspect.example', true); session.dispose();
    requests[1].observer.onEvent({type: 'scan.completed', scanId: 'late', summary: summary('late'), timestamp: ''});
    expect(session.current.getState().summary).toBeNull(); expect(session.report.getState().sharingDraft).toBeNull();
  });
});
