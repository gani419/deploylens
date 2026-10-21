import { useEffect, useRef, useState } from 'react';
import type { ReactNode, MouseEvent } from 'react';
import type { ScanSummary } from '@deploylens/contracts';
import { product } from '../product.js';
import { Icon } from './Icon.js';

export type ReportView = 'overview' | 'findings' | 'checks' | 'details' | 'android' | 'ios' | 'guidance' | 'verification' | 'share' | 'compare' | 'install';
export const viewTitles: Record<ReportView, string> = { overview: 'Release overview', findings: 'Findings & fixes', checks: 'All checks', details: 'Build details', android: 'Android diagnostics', ios: 'iOS diagnostics', guidance: 'Store preparation', verification: 'Manual verification', share: 'Share report & build', compare: 'Compare builds', install: 'Install on Android' };
function initialTheme(): 'light' | 'dark' {
  try { const saved = localStorage.getItem('deploylens-theme'); if (saved === 'light' || saved === 'dark') return saved; } catch { /* Appearance is optional. */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
const startingTheme = initialTheme(); document.documentElement.dataset.theme = startingTheme;

export function WorkspaceShell({ children, page, view, summary, onNavigate, onView }: {
  children: ReactNode; page: string; view: ReportView; summary: ScanSummary | null;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, page: 'inspect' | 'documentation') => void;
  onView: (view: ReportView) => void;
}) {
  const [theme, setTheme] = useState(startingTheme);
  const [drawer, setDrawer] = useState(false);
  const [narrow, setNarrow] = useState(matchMedia('(max-width: 900px)').matches);
  const sidebar = useRef<HTMLElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)');
    const update = () => { setNarrow(media.matches); if (!media.matches) setDrawer(false); };
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  function changeTheme(next: 'dark' | 'light') {
    setTheme(next); document.documentElement.dataset.theme = next;
    try { localStorage.setItem('deploylens-theme', next); } catch { /* Keep the current page functional without storage. */ }
  }
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [theme]);
  useEffect(() => {
    if (!drawer) return;
    document.body.classList.add('drawer-open');
    const controls = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a,button:not(:disabled)') ?? []);
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false);
      if (event.key === 'Tab') {
        const items = controls(), first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.classList.remove('drawer-open'); document.removeEventListener('keydown', keyboard); trigger.current?.focus(); };
  }, [drawer]);
  const links: Array<{ id: ReportView; icon: string; count?: number }> = [
    { id: 'overview', icon: 'grid' }, { id: 'findings', icon: 'findings', count: summary ? summary.stages.flatMap(stage => stage.checks.flatMap(check => check.findings)).filter(finding => !['pass', 'not-applicable'].includes(finding.outcome)).length : undefined },
    { id: 'checks', icon: 'checks' }, { id: 'details', icon: 'details' },
    { id: summary?.artifact.platform === 'ios' ? 'ios' : 'android', icon: 'chip' },
    { id: 'guidance', icon: 'store' }, { id: 'verification', icon: 'shield' },
    { id: 'share', icon: 'copy' }, { id: 'compare', icon: 'grid' }, { id: 'install', icon: 'chip' },
  ];
  return <div className="app-shell">
    <a className="skip-link" href="#workspace-content">Skip to content</a>
    {drawer && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setDrawer(false)}/>}
    <aside id="workspace-sidebar" ref={sidebar} className={`sidebar ${drawer ? 'is-open' : ''}`} inert={narrow && !drawer} aria-hidden={narrow && !drawer ? true : undefined} role={narrow && drawer ? 'dialog' : undefined} aria-modal={narrow && drawer ? true : undefined} aria-label="Workspace navigation">
      <div className="sidebar-brand"><a href="/" onClick={event => { onNavigate(event, 'inspect'); setDrawer(false); }} aria-label="DeployLens home"><span className="brand-symbol"><Icon name="shield"/></span><span>DeployLens<small>RELEASE WORKSPACE</small></span></a><button className="drawer-close icon-button" aria-label="Close navigation" onClick={() => setDrawer(false)}><Icon name="close"/></button></div>
      <div className="workspace-label"><span className="workspace-avatar">DL</span><div>Build inspection<small>Android & iOS</small></div><span className="alpha">ALPHA</span></div>
      <nav aria-label="Primary navigation"><p className="nav-caption">WORKSPACE</p><a className={`sidebar-link ${page === 'inspect' && !summary ? 'active' : ''}`} href="/" onClick={event => { onNavigate(event, 'inspect'); setDrawer(false); }} aria-current={page === 'inspect' && !summary ? 'page' : undefined}><Icon name="upload"/>Inspect a build</a>
        <p className="nav-caption report-caption">CURRENT REPORT</p>{links.map(link => <button key={link.id} className={`sidebar-link ${page === 'inspect' && summary && view === link.id ? 'active' : ''}`} disabled={!summary} title={!summary ? 'Inspect a build to view this report' : undefined} aria-current={page === 'inspect' && summary && view === link.id ? 'page' : undefined} onClick={() => { onView(link.id); setDrawer(false); }}><Icon name={link.icon}/><span>{viewTitles[link.id]}</span>{link.count !== undefined && <span className="nav-count">{link.count}</span>}</button>)}
        <p className="nav-caption report-caption">RESOURCES</p><a href="/documentation" className={`sidebar-link ${page === 'documentation' ? 'active' : ''}`} onClick={event => { onNavigate(event, 'documentation'); setDrawer(false); }} aria-current={page === 'documentation' ? 'page' : undefined}><Icon name="book"/>Documentation</a>
      </nav><div className="sidebar-bottom"><Icon name="shield"/><strong>Your build, briefly here.</strong><p>Temporary processing.<br/>No saved upload history.</p><span>Inspect. Understand. Release.</span></div>
    </aside>
    <div className="workspace"><header className="workspace-header"><div className="header-location"><button ref={trigger} className="drawer-trigger icon-button" aria-label="Open navigation" aria-expanded={drawer} aria-controls="workspace-sidebar" onClick={() => setDrawer(true)}><Icon name="menu"/></button><span>Workspace</span><Icon name="chevron"/><strong>{page === 'documentation' ? 'Documentation' : summary ? viewTitles[view] : 'Inspect a build'}</strong></div><div className="header-actions"><span className="session-indicator"><span/>Private scan session</span><div className="theme-switch" role="group" aria-label="Appearance"><button aria-label="Light theme" aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}><Icon name="sun"/></button><button aria-label="Dark theme" aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}><Icon name="moon"/></button></div></div></header>
      <div id="workspace-content" className="workspace-content" tabIndex={-1}>{children}</div>
      <footer className="workspace-footer"><span>{product.name} v{product.version} <span>·</span> Build confidence with evidence.</span><span>Static inspection · Runtime testing still required</span></footer>
    </div>
  </div>;
}
