import {createInspectionStore, createReportSessionStore, createStore} from '@deploylens/store';
import {createSharingDraft} from '@deploylens/reporting';
import type {InspectionObserver} from '@deploylens/api-client';
import type {MobileArchive} from '../adapters/documentPicker';

type Request = {cancel(): void};
type Dependencies = {
  pickBuild(limit: number): Promise<MobileArchive | null>;
  removeCachedBuild(archive: MobileArchive | null): Promise<void>;
  inspectArchive(url: string, archive: MobileArchive, observer: InspectionObserver): Request;
  cleanup(): Promise<void>;
};

/** Owns native handles independently of screen mounting and navigation. */
export function createMobileInspectionSession(deps: Dependencies) {
  const current = createInspectionStore(), baseline = createInspectionStore();
  const report = createReportSessionStore(null);
  const files = createStore<{archive: MobileArchive | null; choosing: boolean}>({archive: null, choosing: false});
  let request: Request | null = null, baselineRequest: Request | null = null;
  let baselineArchive: MobileArchive | null = null;
  let generation = 0, baselineGeneration = 0, disposed = false;
  // Complete orphan cleanup before creating any new cache copies.
  const ready = deps.cleanup();
  const remove = (archive: MobileArchive | null) => { void deps.removeCachedBuild(archive); };

  function clearComparison() {
    baselineGeneration++;
    baselineRequest?.cancel(); baselineRequest = null;
    remove(baselineArchive); baselineArchive = null;
    baseline.reset();
  }
  function reset() {
    generation++;
    request?.cancel(); request = null;
    clearComparison();
    remove(files.getState().archive);
    files.update(() => ({archive: null, choosing: false}));
    current.reset(); report.reset(null);
  }
  async function choose() {
    if (disposed || current.getState().phase !== 'idle' || files.getState().choosing) return;
    const id = generation;
    files.update(state => ({...state, choosing: true}));
    try {
      await ready;
      if (disposed || generation !== id) return;
      const selected = await deps.pickBuild(current.getState().limit);
      if (!selected) return;
      if (disposed || generation !== id) { remove(selected); return; }
      reset();
      files.update(() => ({archive: selected, choosing: false}));
    } catch (error) {
      // A picker error must not erase an existing report or its drafts.
      if (!disposed && generation === id) current.update(state => ({...state, error: error instanceof Error ? error.message : 'The build could not be selected.'}));
    } finally {
      if (!disposed && generation === id) files.update(state => ({...state, choosing: false}));
    }
  }
  function start(serviceUrl: string, connected: boolean) {
    const {archive, choosing} = files.getState();
    if (disposed || choosing || !archive || current.getState().phase !== 'idle' || current.getState().summary) return false;
    if (!connected) { current.fail('Test the inspection service connection before uploading a build.'); return false; }
    const id = ++generation;
    current.begin();
    const fail = (message: string) => {
      if (generation !== id || disposed) return;
      current.fail(message); report.reset(null); request = null;
      remove(archive); files.update(state => ({...state, archive: null}));
    };
    try {
      request = deps.inspectArchive(serviceUrl, archive, {
        onEvent: event => {
          if (generation !== id || disposed) return;
          current.event(event);
          if (event.type === 'scan.completed') {
            report.reset(event.summary.scanId);
            report.setSharingDraft(createSharingDraft(event.summary, 'native'));
          }
        },
        onProgress: value => { if (generation === id && !disposed) current.progress(value); },
        onError: fail,
        onComplete: () => {
          if (generation !== id || disposed) return;
          current.finish(); request = null;
          // Keep a successful original only for optional sharing in this session.
          if (!current.getState().summary) { remove(archive); files.update(state => ({...state, archive: null})); }
        },
      });
    } catch (error) { fail(error instanceof Error ? error.message : 'The inspection could not start.'); return false; }
    return true;
  }
  function cancel() {
    generation++; request?.cancel(); request = null;
    remove(files.getState().archive); files.update(() => ({archive: null, choosing: false}));
    current.fail('Inspection cancelled. No verdict was issued.'); report.reset(null);
  }
  async function compare(serviceUrl: string, connected: boolean) {
    if (disposed || !current.getState().summary || current.getState().phase !== 'idle' || files.getState().choosing || baseline.getState().phase !== 'idle') return;
    if (!connected) { baseline.fail('Test the inspection service connection before comparing a build.'); return; }
    const id = ++baselineGeneration;
    // Reserve the comparison before awaiting a picker to prevent duplicates.
    baseline.begin();
    try {
      await ready;
      if (disposed || baselineGeneration !== id) return;
      const selected = await deps.pickBuild(current.getState().limit);
      if (disposed || baselineGeneration !== id) { remove(selected); return; }
      if (!selected) { baseline.finish(); return; }
      baselineArchive = selected;
      baseline.begin();
      const release = () => { baselineRequest = null; baselineArchive = null; remove(selected); };
      baselineRequest = deps.inspectArchive(serviceUrl, selected, {
        onEvent: event => { if (baselineGeneration === id && !disposed) baseline.event(event); },
        onProgress: value => { if (baselineGeneration === id && !disposed) baseline.progress(value); },
        onError: message => { if (baselineGeneration === id && !disposed) { baseline.fail(message); release(); } },
        onComplete: () => { if (baselineGeneration === id && !disposed) { baseline.finish(); release(); } },
      });
    } catch (error) {
      if (baselineGeneration === id && !disposed) {
        baseline.fail(error instanceof Error ? error.message : 'The previous build could not be selected.');
        remove(baselineArchive); baselineArchive = null; baselineRequest = null;
      }
    }
  }
  function cancelComparison() { clearComparison(); baseline.fail('Comparison cancelled. The current report was not changed.'); }
  function removeOriginal() {
    if (current.getState().phase !== 'idle') return;
    remove(files.getState().archive); files.update(state => ({...state, archive: null}));
    const draft = report.getState().sharingDraft;
    if (draft) report.setSharingDraft({...draft, includeBuild: false});
  }
  function dispose() { reset(); disposed = true; }
  return {current, baseline, report, files, choose, start, reset, cancel, compare, cancelComparison, clearComparison, removeOriginal, dispose};
}
