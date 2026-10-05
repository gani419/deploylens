import React, { useEffect, useState } from 'react';
import type { ArtifactIdentity, ValidationStage } from '@deploylens/contracts';
import { Button, StageItem } from '@deploylens/ui';

interface ScreenValidationProps {
  artifact: ArtifactIdentity;
  stages: ValidationStage[];
  onCancelScan: () => void;
  onOpenExternalLink?: (url: string) => void;
}

export const ScreenValidation: React.FC<ScreenValidationProps> = ({
  artifact,
  stages,
  onCancelScan,
  onOpenExternalLink,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const completedCount = stages.filter((s) => s.lifecycle === 'completed').length;
  const totalStages = artifact.platform === 'android' ? 9 : 8;

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '36px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Live Validation
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', wordBreak: 'break-all' }}>
            {artifact.fileName}
          </h2>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
            Platform: <strong style={{ color: '#cbd5e1' }}>{artifact.platform.toUpperCase()}</strong> ({artifact.artifactType.toUpperCase()})
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6366f1' }}>
              {completedCount} of {totalStages} stages completed
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Elapsed: {elapsedSeconds}s
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={onCancelScan}>
            Cancel Scan
          </Button>
        </div>
      </div>

      {/* Vertical List of Stages */}
      <div>
        {stages.map((stage) => (
          <StageItem
            key={stage.id}
            stage={stage}
            onOpenExternalLink={onOpenExternalLink}
          />
        ))}
      </div>
    </div>
  );
};
