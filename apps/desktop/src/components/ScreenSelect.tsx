import React, { useState } from 'react';
import type { ArtifactIdentity, CapabilityReport, UserAppInfo } from '@deploylens/contracts';
import { Button, Card, Badge } from '@deploylens/ui';

interface ScreenSelectProps {
  capabilities: CapabilityReport | null;
  onStartValidation: (artifact: ArtifactIdentity, appInfo: UserAppInfo) => void;
  onSelectFile: () => Promise<ArtifactIdentity | null>;
}

export const ScreenSelect: React.FC<ScreenSelectProps> = ({
  capabilities,
  onStartValidation,
  onSelectFile,
}) => {
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactIdentity | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAppInfo, setShowAppInfo] = useState(false);

  // In-memory optional app info
  const [appPurpose, setAppPurpose] = useState('');
  const [intendedUsers, setIntendedUsers] = useState('');
  const [mainFeatures, setMainFeatures] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en-US');

  const handleChooseFile = async () => {
    const artifact = await onSelectFile();
    if (artifact) {
      setSelectedArtifact(artifact);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]!;
      const filePath = (file as any).path || file.name;
      const ext = file.name.split('.').pop()?.toLowerCase();

      let platform: ArtifactIdentity['platform'] = 'android';
      let artifactType: ArtifactIdentity['artifactType'] = 'apk';

      if (ext === 'ipa') {
        platform = 'ios';
        artifactType = 'ipa';
      } else if (ext === 'aab') {
        platform = 'android';
        artifactType = 'aab';
      }

      setSelectedArtifact({
        path: filePath,
        fileName: file.name,
        sizeBytes: file.size,
        platform,
        artifactType,
      });
    }
  };

  const handleStart = () => {
    if (!selectedArtifact) return;
    onStartValidation(selectedArtifact, {
      appPurpose: appPurpose.trim() || undefined,
      intendedUsers: intendedUsers.trim() || undefined,
      mainFeatures: mainFeatures.trim() || undefined,
      preferredListingLanguage: preferredLanguage.trim() || undefined,
    });
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header & Branding */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            🔍
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            DeployLens
          </h1>
        </div>
        <p style={{ fontSize: '1.15rem', color: '#94a3b8', fontWeight: 400 }}>
          Inspect your app. Prepare your release.
        </p>
      </div>

      {/* Main Drag-Drop Card */}
      <Card
        style={{
          border: isDragOver ? '2px dashed #6366f1' : '1px solid #1e293b',
          background: isDragOver ? 'rgba(99, 102, 241, 0.05)' : '#0f172a',
          transition: 'all 0.2s ease',
          marginBottom: '24px',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!selectedArtifact ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.8 }}>📦</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
              Drag and drop your app build artifact here
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
              Accepted formats: <code>.apk</code>, <code>.aab</code>, <code>.ipa</code>
            </p>
            <Button variant="primary" size="md" onClick={handleChooseFile}>
              Choose File from Disk
            </Button>
            <div style={{ marginTop: '24px', fontSize: '0.8rem', color: '#64748b' }}>
              🔒 100% Local Inspection. No accounts, backend, cloud uploads, or external AI APIs.
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Selected Build Artifact
                </span>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px', wordBreak: 'break-all' }}>
                  {selectedArtifact.fileName}
                </h3>
              </div>
              <Button variant="secondary" size="sm" onClick={handleChooseFile}>
                Replace File
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <Badge variant="primary" label={`Platform: ${selectedArtifact.platform.toUpperCase()}`} />
              <Badge variant="secondary" label={`Format: .${selectedArtifact.artifactType}`} />
              <Badge variant="neutral" label={`Size: ${(selectedArtifact.sizeBytes / (1024 * 1024)).toFixed(2)} MB`} />
            </div>

            <div style={{ fontSize: '0.82rem', color: '#94a3b8', background: '#131b2e', padding: '10px 14px', borderRadius: '6px' }}>
              <strong>Path: </strong> <code style={{ color: '#cbd5e1' }}>{selectedArtifact.path}</code>
            </div>

            {/* Local Tool Availability Indicator */}
            {capabilities && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Detected Local Tool Availability:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {selectedArtifact.platform === 'android' ? (
                    <>
                      <Badge variant={capabilities.apksigner.available ? 'pass' : 'not-checked'} label={`apksigner: ${capabilities.apksigner.available ? 'Ready' : 'Fallback Engine'}`} size="sm" />
                      <Badge variant={capabilities.apkanalyzer.available ? 'pass' : 'not-checked'} label={`apkanalyzer: ${capabilities.apkanalyzer.available ? 'Ready' : 'Fallback Engine'}`} size="sm" />
                      <Badge variant={capabilities.zipalign.available ? 'pass' : 'not-checked'} label={`zipalign: ${capabilities.zipalign.available ? 'Ready' : 'Skipped'}`} size="sm" />
                    </>
                  ) : (
                    <>
                      <Badge variant={capabilities.codesign.available ? 'pass' : 'not-checked'} label={`codesign: ${capabilities.codesign.available ? 'Ready' : 'macOS Only'}`} size="sm" />
                      <Badge variant="pass" label="Plist/Archive Parser: Ready" size="sm" />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Optional "About your app" Section */}
      <Card style={{ marginBottom: '24px' }}>
        <div
          onClick={() => setShowAppInfo(!showAppInfo)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          role="button"
          tabIndex={0}
        >
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
              About your app <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Used purely in-memory to generate tailored store listing suggestions. Never uploaded or persisted.
            </p>
          </div>
          <span style={{ color: '#94a3b8' }}>{showAppInfo ? '▲' : '▼'}</span>
        </div>

        {showAppInfo && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                App Purpose
              </label>
              <input
                type="text"
                placeholder="e.g. Budget tracker and expense manager for families"
                value={appPurpose}
                onChange={(e) => setAppPurpose(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#131b2e',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                Intended Users
              </label>
              <input
                type="text"
                placeholder="e.g. Small business owners and freelancers"
                value={intendedUsers}
                onChange={(e) => setIntendedUsers(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#131b2e',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                Main Features (comma or line separated)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Multi-currency support, receipt photo scanning, monthly PDF export"
                value={mainFeatures}
                onChange={(e) => setMainFeatures(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#131b2e',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                Preferred Listing Language
              </label>
              <input
                type="text"
                placeholder="en-US"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                style={{
                  width: '120px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#131b2e',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Start Button */}
      <div style={{ textAlign: 'center' }}>
        <Button
          variant="primary"
          size="lg"
          disabled={!selectedArtifact}
          onClick={handleStart}
          style={{ minWidth: '220px' }}
        >
          Start Validation
        </Button>
      </div>
    </div>
  );
};
