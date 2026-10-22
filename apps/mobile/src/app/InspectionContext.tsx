import React, {createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {createInspectionStore} from '@deploylens/store';
import {useApp} from './AppContext';
import {inspectArchive} from '../adapters/inspectionTransport';
import {pickBuild, removeCachedBuild, type MobileArchive} from '../adapters/documentPicker';

type InspectionContextValue = ReturnType<typeof useInspectionState>;
const InspectionContext = createContext<InspectionContextValue | null>(null);

function useInspectionState() {
  const {serviceUrl, connection} = useApp();
  const [store] = useState(createInspectionStore);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [archive, setArchive] = useState<MobileArchive | null>(null);
  const request = useRef<{cancel(): void} | null>(null);
  const generation = useRef(0);
  useEffect(() => { if (connection.health) store.setLimit(connection.health.maxUploadBytes); }, [connection.health, store]);
  useEffect(() => () => { generation.current++; request.current?.cancel(); void removeCachedBuild(archive); }, [archive]);
  const choose = async () => {
    if (state.phase !== 'idle') return;
    try { const selected = await pickBuild(state.limit); if (!selected) return; await removeCachedBuild(archive); store.reset(); setArchive(selected); }
    catch (error) { store.fail(error instanceof Error ? error.message : 'The build could not be selected.'); }
  };
  const start = () => {
    if (!archive || state.phase !== 'idle') return false;
    if (connection.state !== 'connected') { store.fail('Test the inspection service connection before uploading a build.'); return false; }
    const id = ++generation.current; store.begin();
    request.current = inspectArchive(serviceUrl, archive, {
      onEvent: event => { if (generation.current === id) store.event(event); },
      onProgress: value => { if (generation.current === id) store.progress(value); },
      onError: message => { if (generation.current === id) { store.fail(message); request.current = null; void removeCachedBuild(archive); setArchive(null); } },
      onComplete: () => { if (generation.current === id) { store.finish(); request.current = null; void removeCachedBuild(archive); setArchive(null); } },
    });
    return true;
  };
  const cancel = () => { generation.current++; request.current?.cancel(); request.current = null; store.fail('Inspection cancelled. No verdict was issued.'); void removeCachedBuild(archive); setArchive(null); };
  const reset = () => { generation.current++; request.current?.cancel(); request.current = null; void removeCachedBuild(archive); setArchive(null); store.reset(); };
  return useMemo(() => ({...state, archive, busy: state.phase !== 'idle', choose, start, cancel, reset}), [archive, state]);
}

export function InspectionProvider({children}: React.PropsWithChildren) { const value = useInspectionState(); return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>; }
export function useInspection() { const value = useContext(InspectionContext); if (!value) throw new Error('useInspection must be inside InspectionProvider'); return value; }
