import React from 'react';
import type { CheckOutcome, ReadinessStatus, Severity } from '@deploylens/contracts';

export type BadgeVariant =
  | CheckOutcome
  | ReadinessStatus
  | Severity
  | 'primary'
  | 'secondary'
  | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({ variant, label, children, size = 'md' }) => {
  const text = label ?? children;

  let bg = '#2a2f3a';
  let color = '#e2e8f0';
  let border = '1px solid #4a5568';

  switch (variant) {
    case 'pass':
    case 'PASSED AVAILABLE CHECKS':
      bg = 'rgba(34, 197, 94, 0.15)';
      color = '#4ade80';
      border = '1px solid rgba(74, 222, 128, 0.4)';
      break;
    case 'fail':
    case 'blocker':
    case 'ACTION REQUIRED':
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
      border = '1px solid rgba(248, 113, 113, 0.4)';
      break;
    case 'needs-review':
    case 'risk':
    case 'REVIEW REQUIRED':
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = '1px solid rgba(251, 191, 36, 0.4)';
      break;
    case 'security':
      bg = 'rgba(168, 85, 247, 0.15)';
      color = '#c084fc';
      border = '1px solid rgba(192, 132, 252, 0.4)';
      break;
    case 'quality':
      bg = 'rgba(59, 130, 246, 0.15)';
      color = '#60a5fa';
      border = '1px solid rgba(96, 165, 250, 0.4)';
      break;
    case 'INCOMPLETE':
    case 'not-checked':
    case 'not-applicable':
      bg = 'rgba(148, 163, 184, 0.12)';
      color = '#94a3b8';
      border = '1px solid rgba(148, 163, 184, 0.3)';
      break;
    case 'primary':
      bg = 'rgba(99, 102, 241, 0.2)';
      color = '#818cf8';
      border = '1px solid rgba(129, 140, 248, 0.4)';
      break;
    default:
      break;
  }

  const padding = size === 'sm' ? '2px 6px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? '0.72rem' : size === 'lg' ? '0.9rem' : '0.8rem';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '6px',
        background: bg,
        color,
        border,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        userSelect: 'none',
        lineHeight: 1.2,
      }}
    >
      {text}
    </span>
  );
};
