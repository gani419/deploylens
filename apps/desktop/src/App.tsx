import React, { useState, useEffect } from 'react';
import type {
  ArtifactIdentity,
  CapabilityReport,
  ScanSummary,
  ValidationStage,
  UserAppInfo,
  ScanEvent,
} from '@deploylens/contracts';
import { Tabs, type TabItem } from '@deploylens/ui';
import { ScreenSelect } from './components/ScreenSelect.js';
import { ScreenValidation } from './components/ScreenValidation.js';
import { ScreenAssessment } from './components/ScreenAssessment.js';
import { ScreenStoreGuidance } from './components/ScreenStoreGuidance.js';

type AppScreen = 'select' | 'validation' | 'results';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('select');
  const [capabilities, setCapabilities] = useState<CapabilityReport | null>(null);

  // In-memory scan state
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactIdentity | null>(null);
  const [stages, setStages] = useState<ValidationStage[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);

  // Results tab state: 'assessment' vs 'store-guidance'
  const [resultsTab, setResultsTab] = useState<string>('assessment');

  // Load capabilities once on mount
  useEffect(() => {
    if (window.deployLens?.detectCapabilities) {
      window.deployLens.detectCapabilities().then(setCapabilities).catch(console.error);
    }
  }, []);

  // Listen to IPC scan events
  useEffect(() => {
    if (!window.deployLens?.onScanEvent) return;

    const cleanup = window.deployLens.onScanEvent((event: ScanEvent) => {
      if (event.type === 'scan.started') {
        setCurrentScanId(event.scanId);
        setStages([]);
      } else if (event.type === 'stage.started') {
        setStages((prev) => {
          const existing = prev.find((s) => s.id === event.stageId);
          if (existing) {
            return prev.map((s) =>
              s.id === event.stageId ? { ...s, lifecycle: 'running', startedAt: event.timestamp } : s
            );
          }
          return [
            ...prev,
            {
              id: event.stageId,
              name: event.stageName,
              stageNumber: event.stageNumber,
              totalStages: event.totalStages,
              lifecycle: 'running',
              startedAt: event.timestamp,
              checks: [],
            },
          ];
        });
      } else if (event.type === 'stage.completed') {
        setStages((prev) =>
          prev.map((s) => (s.id === event.stage.id ? event.stage : s))
        );
      } else if (event.type === 'stage.error') {
        setStages((prev) =>
          prev.map((s) =>
            s.id === event.stageId ? { ...s, lifecycle: 'error', error: event.error } : s
          )
        );
      } else if (event.type === 'scan.completed') {
        setSummary(event.summary);
        setCurrentScreen('results');
      } else if (event.type === 'scan.cancelled') {
        setCurrentScreen('select');
      }
    });

    return cleanup;
  }, []);

  const handleSelectFile = async (): Promise<ArtifactIdentity | null> => {
    if (window.deployLens?.selectFile) {
      return window.deployLens.selectFile();
    }
    return null;
  };

  const handleStartValidation = async (artifact: ArtifactIdentity, appInfo: UserAppInfo) => {
    setSelectedArtifact(artifact);
    setCurrentScreen('validation');
    setStages([]);
    setSummary(null);

    try {
      if (window.deployLens?.inspectArtifact) {
        const result = await window.deployLens.inspectArtifact({
          artifactPath: artifact.path,
          userAppInfo: appInfo,
        });
        setSummary(result);
        setCurrentScreen('results');
      }
    } catch (err: any) {
      console.error('Validation error:', err);
    }
  };

  const handleCancelScan = async () => {
    if (currentScanId && window.deployLens?.cancelScan) {
      await window.deployLens.cancelScan(currentScanId);
    }
    setCurrentScreen('select');
  };

  const handleInspectAnother = () => {
    setSelectedArtifact(null);
    setSummary(null);
    setStages([]);
    setCurrentScanId(null);
    setCurrentScreen('select');
  };

  const handleOpenExternal = (url: string) => {
    if (window.deployLens?.openExternal) {
      window.deployLens.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyToClipboard = (text: string) => {
    if (window.deployLens?.copyToClipboard) {
      window.deployLens.copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  const resultTabs: TabItem[] = [
    { id: 'assessment', label: 'Release Readiness Assessment' },
    {
      id: 'store-guidance',
      label: 'Store Preparation Guidance',
      badge: summary?.storeGuidance.checklist.length,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid #1e293b',
          background: '#0a0f1d',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          onClick={handleInspectAnother}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}
          >
            🔍
          </div>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            DeployLens
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: '#64748b' }}>
          <span>100% Local Engine</span>
          <span>•</span>
          <span>No Data Persisted</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {currentScreen === 'select' && (
          <ScreenSelect
            capabilities={capabilities}
            onSelectFile={handleSelectFile}
            onStartValidation={handleStartValidation}
          />
        )}

        {currentScreen === 'validation' && selectedArtifact && (
          <ScreenValidation
            artifact={selectedArtifact}
            stages={stages}
            onCancelScan={handleCancelScan}
            onOpenExternalLink={handleOpenExternal}
          />
        )}

        {currentScreen === 'results' && summary && (
          <div>
            <div style={{ maxWidth: '960px', margin: '20px auto 0', padding: '0 20px' }}>
              <Tabs
                tabs={resultTabs}
                activeTab={resultsTab}
                onTabChange={setResultsTab}
              />
            </div>

            {resultsTab === 'assessment' && (
              <ScreenAssessment
                summary={summary}
                onInspectAnother={handleInspectAnother}
                onOpenExternalLink={handleOpenExternal}
                onCopyToClipboard={handleCopyToClipboard}
              />
            )}

            {resultsTab === 'store-guidance' && (
              <ScreenStoreGuidance
                guidance={summary.storeGuidance}
                onOpenExternalLink={handleOpenExternal}
                onCopyToClipboard={handleCopyToClipboard}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};
