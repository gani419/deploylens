import React, { useState } from 'react';
import type { Finding } from '@deploylens/contracts';
import { Badge } from './Badge.js';

interface FindingCardProps {
  finding: Finding;
  onOpenExternalLink?: (url: string) => void;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  onOpenExternalLink,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    if (onOpenExternalLink) {
      onOpenExternalLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      style={{
        background: '#131b2e',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        margin: '8px 0',
        padding: '12px 16px',
        transition: 'border-color 0.2s',
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '12px',
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <Badge variant={finding.severity} size="sm" />
          <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem', wordBreak: 'break-word' }}>
            {finding.title}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
            ({finding.ruleId})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant={finding.outcome} size="sm" />
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', userSelect: 'none' }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.4 }}>
        <strong>Evidence: </strong> {finding.evidence}
      </div>

      {isExpanded && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.82rem',
          }}
        >
          {finding.affectedFileOrConfig && (
            <div>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>Affected File/Config: </span>
              <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', color: '#e2e8f0' }}>
                {finding.affectedFileOrConfig}
              </code>
            </div>
          )}

          <div>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Why it matters: </span>
            <span style={{ color: '#cbd5e1' }}>{finding.whyItMatters}</span>
          </div>

          <div>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Remediation: </span>
            <span style={{ color: '#38bdf8' }}>{finding.suggestedRemediation}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
              Rule Revision: {finding.ruleRevision} | Review Date: {finding.sourceReviewDate ?? '2026'}
            </span>

            {finding.officialReferenceUrl && (
              <a
                href={finding.officialReferenceUrl}
                onClick={(e) => handleLinkClick(e, finding.officialReferenceUrl!)}
                style={{
                  color: '#818cf8',
                  textDecoration: 'none',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Official Docs ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
