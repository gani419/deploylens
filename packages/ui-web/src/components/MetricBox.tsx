import React from 'react';

interface MetricBoxProps {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}

export const MetricBox: React.FC<MetricBoxProps> = ({
  label,
  value,
  color = '#94a3b8',
  icon,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '16px 20px',
        flex: 1,
        minWidth: '130px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {icon}
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
};
