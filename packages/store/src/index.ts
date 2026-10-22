import { inspectionLimits } from '@deploylens/config';
import type { InspectionEvent, ScanSummary, ValidationStage } from '@deploylens/contracts';

/** No React, DOM, native storage, file bytes or Node globals in this package. */
export function createStore<State>(initial: State) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(updater: (previous: State) => State) {
      const next = updater(state);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
  };
}
export interface InspectionState {
  phase: 'idle' | 'uploading' | 'scanning';
  progress: number;
  error: string;
  summary: ScanSummary | null;
  stages: ValidationStage[];
  scanId: string | null;
  limit: number;
}
const initialInspection = (): InspectionState => ({ phase: 'idle', progress: 0, error: '', summary: null, stages: [], scanId: null, limit: inspectionLimits.maxUploadBytes });
export function createInspectionStore() {
  const store = createStore(initialInspection());
  return { ...store,
    begin() { store.update(previous => ({ ...initialInspection(), limit: previous.limit, phase: 'uploading' })); },
    reset() { store.update(previous => ({ ...initialInspection(), limit: previous.limit })); },
    setLimit(limit: number) { if (Number.isFinite(limit) && limit >= 4) store.update(state => ({ ...state, limit })); },
    progress(progress: number) { store.update(state => state.phase === 'idle' ? state : { ...state, progress: Math.max(0, Math.min(100, progress)) }); },
    fail(error: string) { store.update(state => ({ ...state, phase: 'idle', error, summary: null })); },
    finish() { store.update(state => ({ ...state, phase: 'idle' })); },
    event(event: InspectionEvent) {
      store.update(state => {
        if (state.phase === 'idle') return state;
        if ('scanId' in event && state.scanId && state.scanId !== event.scanId) return state;
        if (event.type === 'upload.completed' || event.type === 'scan.started') return { ...state, scanId: event.scanId, phase: 'scanning' };
        if (event.type === 'stage.started') {
          const stage: ValidationStage = { id: event.stageId, name: event.stageName, stageNumber: event.stageNumber, totalStages: event.totalStages, lifecycle: 'running', checks: [] };
          return { ...state, stages: state.stages.some(item => item.id === stage.id) ? state.stages.map(item => item.id === stage.id ? stage : item) : [...state.stages, stage] };
        }
        if (event.type === 'stage.completed') return { ...state, stages: state.stages.some(item => item.id === event.stage.id) ? state.stages.map(item => item.id === event.stage.id ? event.stage : item) : [...state.stages, event.stage] };
        if (event.type === 'stage.error') return { ...state, stages: state.stages.map(stage => stage.id === event.stageId ? { ...stage, lifecycle: 'error', error: event.error } : stage) };
        if (event.type === 'scan.completed') return { ...state, summary: event.summary };
        if (event.type === 'scan.error') return { ...state, error: event.message, summary: null };
        if (event.type === 'scan.cancelled') return { ...state, phase: 'idle', summary: null, error: event.reason };
        return state;
      });
    },
  };
}
export interface SharingDraft { subject: string; body: string; to: string; includeBuild: boolean; destination: string }
export interface ReportSessionState {
  scanId: string | null;
  reviewed: string[];
  listingDrafts: Record<string, string>;
  sharingDraft: SharingDraft | null;
}
export function createReportSessionStore(scanId: string | null) {
  const store = createStore<ReportSessionState>({ scanId, reviewed: [], listingDrafts: {}, sharingDraft: null });
  return { ...store,
    setReviewed(update: (previous: string[]) => string[]) { store.update(state => ({ ...state, reviewed: [...new Set(update(state.reviewed))] })); },
    setListingDraft(key: string, value: string) { store.update(state => ({ ...state, listingDrafts: { ...state.listingDrafts, [key]: value } })); },
    setSharingDraft(update: SharingDraft) { store.update(state => ({ ...state, sharingDraft: update })); },
  };
}
