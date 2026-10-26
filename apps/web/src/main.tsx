import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Documentation } from './Documentation.js';
import { PrivacyPolicy } from './PrivacyPolicy.js';
import { AndroidDiagnostics } from './AndroidDiagnostics.js';
import { useInspection } from './hooks/useInspection.js';
import { WorkspaceShell } from './components/WorkspaceShell.js';
import type { ReportView } from './components/WorkspaceShell.js';
import { UploadHome } from './components/UploadHome.js';
import { ReportHeader, ReportOverview } from './components/ReportOverview.js';
import { FindingsView, AllChecks } from './components/FindingsView.js';
import { BuildDetails, IosDiagnostics } from './components/BuildDetails.js';
import { StorePreparation } from './components/StorePreparation.js';
import { createReportSessionStore } from '@deploylens/store';
import { createSharingDraft } from '@deploylens/reporting';
import { ManualVerification } from './components/ManualVerification.js';
import { ShareReport } from './components/ShareReport.js';
import { CompareBuilds } from './components/CompareBuilds.js';
import { DeviceInstall } from './components/DeviceInstall.js';
import './styles/variables.css';
import './styles/styles.css';
import './styles/workspace.css';
import './styles/home.css';
import './styles/report.css';
import './styles/documentation.css';
import './styles/collaboration.css';

function App() {
  const scan = useInspection();
  const baseline = useInspection();
  type Page = 'inspect' | 'documentation' | 'privacy';
  const pageForPath = (): Page => location.pathname === '/documentation' ? 'documentation' : location.pathname === '/privacy' ? 'privacy' : 'inspect';
  const [page, setPage] = useState<Page>(pageForPath);
  const [view, setView] = useState<ReportView>('overview');
  const sessionStore = useMemo(() => {
    const store = createReportSessionStore(scan.summary?.scanId ?? null);
    if (scan.summary) store.setSharingDraft(createSharingDraft(scan.summary));
    return store;
  }, [scan.summary]);
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState);
  useEffect(() => {
    const pop = () => setPage(pageForPath());
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => { if (scan.summary) { setView('overview'); window.scrollTo({ top: 0 }); } }, [scan.summary]);
  function navigate(event: MouseEvent<HTMLAnchorElement>, next: Page) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); history.pushState(null, '', next === 'documentation' ? '/documentation' : next === 'privacy' ? '/privacy' : '/');
    setPage(next); window.scrollTo({ top: 0 });
  }
  function showView(next: ReportView) {
    if (page !== 'inspect') history.pushState(null, '', '/');
    setPage('inspect'); setView(next); window.scrollTo({ top: 0 });
  }
  function download() {
    if (!scan.summary) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(scan.summary, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${scan.summary.artifact.fileName}.deploylens.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <WorkspaceShell page={page} view={view} summary={scan.summary} onNavigate={navigate} onView={showView}>
    {page === 'documentation' ? <Documentation/> : page === 'privacy' ? <PrivacyPolicy/> : !scan.summary ? <UploadHome scan={scan}/> : <main className="report-page" aria-label="Inspection results"><ReportHeader summary={scan.summary} onDownload={download} onNew={() => { baseline.reset(); scan.reset(); }} onShare={() => showView('share')}/>
      {view === 'overview' && <ReportOverview summary={scan.summary} onView={showView}/>}
      {view === 'findings' && <FindingsView summary={scan.summary}/>}
      {view === 'checks' && <AllChecks summary={scan.summary}/>}
      {view === 'details' && <BuildDetails summary={scan.summary}/>}
      {view === 'android' && scan.summary.metadata.android && <AndroidDiagnostics metadata={scan.summary.metadata.android} artifactType={scan.summary.artifact.artifactType}/>}
      {view === 'ios' && <IosDiagnostics summary={scan.summary}/>}
      <div hidden={view !== 'guidance'}><StorePreparation key={scan.summary.scanId} summary={scan.summary} drafts={session.listingDrafts} onDraftChange={sessionStore.setListingDraft}/></div>
      {view === 'verification' && <ManualVerification summary={scan.summary} checked={session.reviewed} setChecked={sessionStore.setReviewed}/>}
      <div hidden={view !== 'share'}><ShareReport key={scan.summary.scanId} summary={scan.summary} file={scan.file} draft={session.sharingDraft!} onDraftChange={sessionStore.setSharingDraft}/></div>
      {view === 'compare' && <CompareBuilds current={scan.summary} baseline={baseline}/>}
      {view === 'install' && <DeviceInstall key={scan.summary.scanId} summary={scan.summary} file={scan.file}/>}
      <p className="report-disclaimer">{scan.summary.assessment.disclaimer}</p>
    </main>}
  </WorkspaceShell>;
}
createRoot(document.getElementById('root')!).render(<App/>);
