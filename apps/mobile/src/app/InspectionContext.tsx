import React, {createContext, useContext, useEffect, useState, useSyncExternalStore} from 'react';
import {useApp} from './AppContext';
import {createMobileInspectionSession} from './inspectionSession';
import {inspectArchive} from '../adapters/inspectionTransport';
import {pickBuild, removeCachedBuild, removeOrphanedBuildCopies} from '../adapters/documentPicker';
import {removeOrphanedReportExports} from '../adapters/collaboration';

type InspectionContextValue = ReturnType<typeof useInspectionState>;
const InspectionContext = createContext<InspectionContextValue | null>(null);

function useInspectionState() {
  const {serviceUrl, connection} = useApp();
  const [controller] = useState(() => createMobileInspectionSession({
    pickBuild, removeCachedBuild, inspectArchive,
    cleanup: async () => { await removeOrphanedBuildCopies(); await removeOrphanedReportExports(); },
  }));
  const state = useSyncExternalStore(controller.current.subscribe, controller.current.getState, controller.current.getState);
  const baseline = useSyncExternalStore(controller.baseline.subscribe, controller.baseline.getState, controller.baseline.getState);
  const files = useSyncExternalStore(controller.files.subscribe, controller.files.getState, controller.files.getState);
  const reportSession = useSyncExternalStore(controller.report.subscribe, controller.report.getState, controller.report.getState);
  useEffect(() => { if (connection.health) controller.current.setLimit(connection.health.maxUploadBytes); }, [connection.health, controller]);
  useEffect(() => () => controller.dispose(), [controller]);
  return {...state, ...files, reportSession, reportActions: controller.report,
    busy: state.phase !== 'idle', choose: controller.choose,
    start: () => controller.start(serviceUrl, connection.state === 'connected'),
    cancel: controller.cancel, reset: controller.reset, removeOriginal: controller.removeOriginal,
    baseline: {...baseline, busy: baseline.phase !== 'idle'},
    compare: () => controller.compare(serviceUrl, connection.state === 'connected'),
    cancelComparison: controller.cancelComparison, clearComparison: controller.clearComparison};
}

export function InspectionProvider({children}: React.PropsWithChildren) { const value = useInspectionState(); return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>; }
export function useInspection() { const value = useContext(InspectionContext); if (!value) throw new Error('useInspection must be inside InspectionProvider'); return value; }
