import React, { useState } from 'react';
import type { StoreGuidance } from '@deploylens/contracts';
import { Card, Badge, Button } from '@deploylens/ui';

interface ScreenStoreGuidanceProps {
  guidance: StoreGuidance;
  onOpenExternalLink?: (url: string) => void;
  onCopyToClipboard?: (text: string) => void;
}

export const ScreenStoreGuidance: React.FC<ScreenStoreGuidanceProps> = ({
  guidance,
  onOpenExternalLink,
  onCopyToClipboard,
}) => {
  const { listingTemplates, checklist, detectedFacts, generalReminders, platform } = guidance;

  // Editable local template state
  const [appName, setAppName] = useState(listingTemplates.appName.value);
  const [shortDesc, setShortDesc] = useState(listingTemplates.shortDescription?.value ?? listingTemplates.subtitle?.value ?? '');
  const [fullDesc, setFullDesc] = useState(listingTemplates.fullDescription.value);
  const [keywords, setKeywords] = useState(listingTemplates.keywords?.value ?? '');

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    if (onCopyToClipboard) {
      onCopyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 1800);
  };

  const appNameMax = listingTemplates.appName.maxChars;
  const shortDescMax = platform === 'android' ? 80 : 30;
  const fullDescMax = 4000;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '30px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
          Store Preparation
        </div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
          {platform === 'android' ? 'Google Play Store' : 'Apple App Store'} Release Guidance
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
          Local deterministic templates with validated character counts and store readiness checklists. No cloud AI used.
        </p>
      </div>

      {/* Suggested Category (if detected) */}
      {listingTemplates.suggestedCategory && (
        <div style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Suggested Store Category:</span>
          <Badge variant="primary" label={listingTemplates.suggestedCategory} />
        </div>
      )}

      {/* Section 1: Listing Text Templates */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
          Store Listing Text Templates
        </h3>

        {/* App Title */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
              App Title / Name
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  color: appName.length <= appNameMax ? '#4ade80' : '#f87171',
                }}
              >
                {appName.length} / {appNameMax} chars
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleCopy('title', appName)}>
                {copiedSection === 'title' ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#131b2e',
              border: `1px solid ${appName.length <= appNameMax ? '#334155' : '#ef4444'}`,
              color: '#f8fafc',
              fontSize: '0.9rem',
            }}
          />
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            {listingTemplates.appName.notes}
          </div>
        </div>

        {/* Short Description or Subtitle */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
              {platform === 'android' ? 'Short Description' : 'Subtitle'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  color: shortDesc.length <= shortDescMax ? '#4ade80' : '#f87171',
                }}
              >
                {shortDesc.length} / {shortDescMax} chars
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleCopy('shortDesc', shortDesc)}>
                {copiedSection === 'shortDesc' ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <input
            type="text"
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#131b2e',
              border: `1px solid ${shortDesc.length <= shortDescMax ? '#334155' : '#ef4444'}`,
              color: '#f8fafc',
              fontSize: '0.9rem',
            }}
          />
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            {platform === 'android' ? 'Google Play max 80 characters.' : 'App Store subtitle max 30 characters.'}
          </div>
        </div>

        {/* Full Description */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
              Full Description
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  color: fullDesc.length <= fullDescMax ? '#4ade80' : '#f87171',
                }}
              >
                {fullDesc.length} / {fullDescMax} chars
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleCopy('fullDesc', fullDesc)}>
                {copiedSection === 'fullDesc' ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <textarea
            rows={7}
            value={fullDesc}
            onChange={(e) => setFullDesc(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              background: '#131b2e',
              border: `1px solid ${fullDesc.length <= fullDescMax ? '#334155' : '#ef4444'}`,
              color: '#f8fafc',
              fontSize: '0.88rem',
              lineHeight: 1.4,
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            {listingTemplates.fullDescription.notes}
          </div>
        </div>

        {/* Keywords (iOS) */}
        {platform === 'ios' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                App Store Search Keywords
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    color: keywords.length <= 100 ? '#4ade80' : '#f87171',
                  }}
                >
                  {keywords.length} / 100 chars
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleCopy('keywords', keywords)}>
                  {copiedSection === 'keywords' ? '✓ Copied' : 'Copy'}
                </Button>
              </div>
            </div>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                background: '#131b2e',
                border: `1px solid ${keywords.length <= 100 ? '#334155' : '#ef4444'}`,
                color: '#f8fafc',
                fontSize: '0.9rem',
              }}
            />
          </div>
        )}
      </Card>

      {/* Section 2: Store Readiness Checklist */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '14px' }}>
          Release Checklist & Technical Requirements
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {checklist.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#131b2e',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                    {item.topic}
                  </span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>
                    {item.title}
                  </span>
                </div>
                <Badge variant={item.severity === 'blocker' ? 'blocker' : item.severity === 'recommended' ? 'quality' : 'neutral'} size="sm" />
              </div>

              <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                {item.description}
              </div>

              {item.evidence && (
                <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <strong>Detected from build: </strong> {item.evidence}
                </div>
              )}

              {item.officialReferenceUrl && (
                <div style={{ marginTop: '6px' }}>
                  <a
                    href={item.officialReferenceUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      if (onOpenExternalLink) onOpenExternalLink(item.officialReferenceUrl!);
                      else window.open(item.officialReferenceUrl, '_blank', 'noopener,noreferrer');
                    }}
                    style={{ fontSize: '0.76rem', color: '#818cf8', textDecoration: 'none' }}
                  >
                    Official Store Documentation ↗
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Section 3: Detected Artifact Facts vs General Reminders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        <Card>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4ade80', marginBottom: '10px' }}>
            Detected Artifact Facts
          </h4>
          <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {detectedFacts.map((fact, idx) => (
              <li key={idx}>{fact}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fbbf24', marginBottom: '10px' }}>
            General Policy Reminders
          </h4>
          <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {generalReminders.map((rem, idx) => (
              <li key={idx}>{rem}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};
