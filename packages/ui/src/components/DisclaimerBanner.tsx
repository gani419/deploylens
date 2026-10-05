import React from 'react';
import { OFFICIAL_DISCLAIMER } from '@deploylens/contracts';

export const DisclaimerBanner: React.FC = () => {
  return (
    <div
      role="note"
      aria-label="Official Disclaimer"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 18px',
        borderRadius: '8px',
        background: 'rgba(234, 179, 8, 0.08)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        color: '#fef08a',
        fontSize: '0.85rem',
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: '1.2rem', lineHeight: 1 }} aria-hidden="true">
        ⚠️
      </span>
      <div>
        <strong style={{ color: '#facc15' }}>Notice: </strong>
        {OFFICIAL_DISCLAIMER}
      </div>
    </div>
  );
};
