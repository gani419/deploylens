import React, { useState } from 'react';
import type { ValidationStage } from '@deploylens/contracts';
import { Spinner } from './Spinner.js';
import { Badge } from './Badge.js';
import { FindingCard } from './FindingCard.js';

interface StageItemProps {
  stage: ValidationStage;
  onOpenExternalLink?: (url: string) => void;
}

export const StageItem: React.FC<StageItemProps> = ({
  stage,
  onOpenExternalLink,
}) => {
  const [isOpen, setIsOpen] = useState(stage.lifecycle === 'running' || stage.lifecycle === 'error');

  const hasFailures = stage.checks.some((c) => c.outcome === 'fail');
  const hasReviews = stage.checks.some((c) => c.outcome === 'needs-review');
  const allPassed = stage.checks.length > 0 && stage.checks.every((c) => c.outcome === 'pass');

  let stageOutcomeText = 'Pending';
  let stageOutcomeColor = '#64748b';
  let stageIcon: React.ReactNode = (
    <span style={{ color: '#64748b' }} aria-hidden="true">
      ○
    </span>
  );

  if (stage.lifecycle === 'running') {
    stageOutcomeText = 'Running';
    stageOutcomeColor = '#818cf8';
    stageIcon = <Spinner size={16} color="#818cf8" />;
  } else if (stage.lifecycle === 'error') {
    stageOutcomeText = 'Error';
    stageOutcomeColor = '#f87171';
    stageIcon = <span style={{ color: '#f87171' }} aria-hidden="true">✕</span>;
  } else if (stage.lifecycle === 'cancelled') {
    stageOutcomeText = 'Cancelled';
    stageOutcomeColor = '#94a3b8';
    stageIcon = <span style={{ color: '#94a3b8' }} aria-hidden="true">⊘</span>;
  } else if (stage.lifecycle === 'completed') {
    if (hasFailures) {
      stageOutcomeText = 'Failures Found';
      stageOutcomeColor = '#f87171';
      stageIcon = <span style={{ color: '#f87171' }} aria-hidden="true">✕</span>;
    } else if (hasReviews) {
      stageOutcomeText = 'Needs Review';
      stageOutcomeColor = '#fbbf24';
      stageIcon = <span style={{ color: '#fbbf24' }} aria-hidden="true">⚠</span>;
    } else if (allPassed) {
      stageOutcomeText = 'Passed';
      stageOutcomeColor = '#4ade80';
      stageIcon = <span style={{ color: '#4ade80' }} aria-hidden="true">✓</span>;
    } else {
      stageOutcomeText = 'Completed';
      stageOutcomeColor = '#94a3b8';
      stageIcon = <span style={{ color: '#94a3b8' }} aria-hidden="true">✓</span>;
    }
  }

  const allFindings = stage.checks.flatMap((c) => c.findings);

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        marginBottom: '10px',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          cursor: 'pointer',
          userSelect: 'none',
          gap: '12px',
          background: stage.lifecycle === 'running' ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px' }}>
            {stageIcon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                STAGE {stage.stageNumber} OF {stage.totalStages}
              </span>
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc' }}>
              {stage.name}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: stageOutcomeColor }}>
            {stageOutcomeText}
          </span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            padding: '12px 18px 16px',
            borderTop: '1px solid #1e293b',
            background: '#090d16',
          }}
        >
          {stage.error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.85rem',
                marginBottom: '10px',
              }}
            >
              <strong>Stage Error: </strong> {stage.error}
            </div>
          )}

          {stage.checks.length === 0 && !stage.error && (
            <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
              {stage.lifecycle === 'running' ? 'Inspection in progress...' : 'Pending execution...'}
            </div>
          )}

          {stage.checks.map((check) => (
            <div key={check.checkId} style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.88rem' }}>
                    {check.name}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    [{check.checkId}]
                  </span>
                </div>
                <Badge variant={check.outcome} size="sm" />
              </div>

              {check.details && (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 8px' }}>
                  {check.details}
                </div>
              )}
            </div>
          ))}

          {allFindings.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                Stage Findings ({allFindings.length})
              </div>
              {allFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onOpenExternalLink={onOpenExternalLink}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
