import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createInspectionStore } from '@deploylens/store';
import { validateArchive } from '@deploylens/utils';
import { browserInspectionTransport } from '../adapters/inspectionTransport.js';

export function useInspection() {
  const [file, setFile] = useState<File | null>(null);
  const [store] = useState(createInspectionStore);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const request = useRef<{ cancel(): void } | null>(null);
  const generation = useRef(0);
  const busy = state.phase !== 'idle';
  useEffect(() => {
    let mounted = true;
    browserInspectionTransport.health().then(data => { if (mounted) store.setLimit(data.maxUploadBytes); }).catch(() => {});
    return () => { mounted = false; generation.current++; request.current?.cancel(); };
  }, [store]);
  function choose(candidate?: File) {
    if (!candidate || busy) return;
    store.reset();
    const error = validateArchive(candidate, state.limit);
    if (error) { setFile(null); store.fail(error); return; }
    setFile(candidate);
  }
  function start() {
    if (!file || busy) return;
    const id = ++generation.current;
    store.begin();
    request.current = browserInspectionTransport.inspect(file, {
      onEvent: event => { if (generation.current === id) store.event(event); },
      onProgress: progress => { if (generation.current === id) store.progress(progress); },
      onError: error => { if (generation.current === id) { store.fail(error); request.current = null; } },
      onComplete: () => { if (generation.current === id) { store.finish(); request.current = null; } },
    });
  }
  function reset() { generation.current++; request.current?.cancel(); request.current = null; setFile(null); store.reset(); }
  function cancel() { generation.current++; request.current?.cancel(); request.current = null; store.fail('Inspection cancelled. No verdict was issued.'); }
  return { file, ...state, busy, choose, start, reset, cancel };
}
export type Inspection = ReturnType<typeof useInspection>;
