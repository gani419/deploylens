import React, { useState } from 'react';
import type { ScanSummary } from '@deploylens/contracts';
import { Button, Card, Badge, MetricBox, DisclaimerBanner, FindingCard, StageItem } from '@deploylens/ui';

interface ScreenAssessmentProps {
  summary: ScanSummary;
  onInspectAnother: () => void;
  onOpenExternalLink?: (url: string) => void;
  onCopyToClipboard?: (text: string) => void;
}

export const ScreenAssessment: React.FC<ScreenAssessmentProps> = ({
  summary,
  onInspectAnother,
  onOpenExternalLink,
  onCopyToClipboard,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'categories' | 'stages'>('categories');

  const { assessment, artifact, metadata } = summary;
  const allFindings = summary.stages.flatMap((s) => s.checks.flatMap((c) => c.findings));

  const blockers = allFindings.filter((f) => f.severity === 'blocker');
  const policyRisks = allFindings.filter((f) => f.severity === 'risk');
  const securityConcerns = allFindings.filter((f) => f.severity === 'security');
  const qualityRecommendations = allFindings.filter((f) => f.severity === 'quality');

  const filteredFindings = allFindings.filter((f) => {
    if (filterSeverity === 'all') return true;
    return f.severity === filterSeverity;
  });

  const handleCopy = () => {
    const text = [
      `DeployLens Release Readiness Assessment`,
      `Artifact: ${artifact.fileName} (${artifact.platform.toUpperCase()})`,
      `Status: ${assessment.status}`,
      `Summary: ${assessment.summary}`,
      `Metrics: ${assessment.blockerCount} Blockers, ${assessment.warningReviewCount} Needs Review, ${assessment.passedCheckCount} Passed`,
      `Coverage: ${assessment.coverageRatio.description}`,
      `Disclaimer: ${assessment.disclaimer}`,
    ].join('\n');

    if (onCopyToClipboard) {
      onCopyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // App details label
  const appTitle = metadata.android?.appLabel || metadata.android?.packageId || metadata.ios?.displayName || metadata.ios?.bundleIdentifier || 'Application';
  const appVersion = metadata.android ? `${metadata.android.versionName} (${metadata.android.versionCode})` : metadata.ios ? `${metadata.ios.marketingVersion} (${metadata.ios.buildNumber})` : '1.0';

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '30px 20px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Assessment Report
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
            {appTitle} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 400 }}>v{appVersion}</span>
          </h2>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
            {artifact.fileName} • {(artifact.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {(summary.elapsedMs / 1000).toFixed(2)}s inspection time
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? '✓ Copied Summary' : 'Copy Summary'}
          </Button>
          <Button variant="primary" size="sm" onClick={onInspectAnother}>
            Inspect Another Build
          </Button>
        </div>
      </div>

      {/* Readiness Status Banner */}
      <Card
        style={{
          marginBottom: '24px',
          background:
            assessment.status === 'ACTION REQUIRED'
              ? 'rgba(239, 68, 68, 0.08)'
              : assessment.status === 'REVIEW REQUIRED'
              ? 'rgba(245, 158, 11, 0.08)'
              : 'rgba(34, 197, 94, 0.08)',
          border:
            assessment.status === 'ACTION REQUIRED'
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : assessment.status === 'REVIEW REQUIRED'
              ? '1px solid rgba(245, 158, 11, 0.3)'
              : '1px solid rgba(34, 197, 94, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em' }}>
              Release Readiness Status
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px' }}>
              <Badge variant={assessment.status} size="lg" />
            </div>
          </div>
          <div style={{ maxWidth: '520px', fontSize: '0.9rem', color: '#cbd5e1' }}>
            {assessment.summary}
          </div>
        </div>
      </Card>

      {/* Metrics Row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <MetricBox
          label="Blockers"
          value={assessment.blockerCount}
          color={assessment.blockerCount > 0 ? '#f87171' : '#94a3b8'}
          icon={<span style={{ color: '#f87171' }}>⛔</span>}
        />
        <MetricBox
          label="Needs Review"
          value={assessment.warningReviewCount}
          color={assessment.warningReviewCount > 0 ? '#fbbf24' : '#94a3b8'}
          icon={<span style={{ color: '#fbbf24' }}>⚠</span>}
        />
        <MetricBox
          label="Passed Checks"
          value={assessment.passedCheckCount}
          color="#4ade80"
          icon={<span style={{ color: '#4ade80' }}>✓</span>}
        />
        <MetricBox
          label="Not Checked"
          value={assessment.notCheckedCount}
          color="#94a3b8"
          icon={<span style={{ color: '#94a3b8' }}>○</span>}
        />
      </div>

      {/* Coverage Notice */}
      <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '24px', background: '#0f172a', padding: '10px 16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
        <strong>Coverage: </strong> {assessment.coverageRatio.description}
      </div>

      {/* Toggle View Mode: Categories vs Stages */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('categories')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'categories' ? '#4f46e5' : '#1e293b',
              color: '#f8fafc',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Categorized Findings
          </button>
          <button
            onClick={() => setViewMode('stages')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'stages' ? '#4f46e5' : '#1e293b',
              color: '#f8fafc',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Validation Stages ({summary.stages.length})
          </button>
        </div>

        {viewMode === 'categories' && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'blocker', 'risk', 'security', 'quality'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: filterSeverity === sev ? '#6366f1' : '#334155',
                  background: filterSeverity === sev ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  color: filterSeverity === sev ? '#ffffff' : '#94a3b8',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {sev}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Findings Content */}
      {viewMode === 'categories' ? (
        <div style={{ marginBottom: '32px' }}>
          {filteredFindings.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ color: '#4ade80', fontSize: '1.5rem', marginBottom: '8px' }}>✓</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>No findings matching this filter.</div>
            </Card>
          ) : (
            filteredFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onOpenExternalLink={onOpenExternalLink}
              />
            ))
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '32px' }}>
          {summary.stages.map((stage) => (
            <StageItem
              key={stage.id}
              stage={stage}
              onOpenExternalLink={onOpenExternalLink}
            />
          ))}
        </div>
      )}

      {/* Mandatory Unverified Areas Section */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
          Unverified Areas (Requires Manual Device and Policy Validation)
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '14px' }}>
          DeployLens inspects static binary packages and metadata locally. The following areas cannot be verified through static archive inspection alone:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          {assessment.unverifiedAreas.map((area) => (
            <div
              key={area.area}
              style={{
                background: '#131b2e',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '3px' }}>
                • {area.area}
              </div>
              <div style={{ color: '#94a3b8', lineHeight: 1.35 }}>
                {area.reason}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Versions & Tools Used */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '0.78rem', color: '#64748b', marginBottom: '20px' }}>
        <div>
          <strong>Tools Detected: </strong>
          {Object.entries(assessment.toolVersionsUsed).map(([k, v]) => `${k} (${v})`).join(', ') || 'Built-in TypeScript engines'}
        </div>
        <div>
          <strong>Rules Catalog Revision: </strong> 2026.1
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <DisclaimerBanner />
    </div>
  );
};
