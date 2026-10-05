import React from 'react';
import { Spinner } from './Spinner.js';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  style,
  ...props
}) => {
  let bg = '#4f46e5';
  let color = '#ffffff';
  let border = 'none';

  if (variant === 'secondary') {
    bg = '#1e293b';
    color = '#f1f5f9';
    border = '1px solid #334155';
  } else if (variant === 'danger') {
    bg = '#dc2626';
    color = '#ffffff';
    border = 'none';
  } else if (variant === 'ghost') {
    bg = 'transparent';
    color = '#94a3b8';
    border = '1px solid transparent';
  }

  const padding = size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '8px 16px';
  const fontSize = size === 'sm' ? '0.85rem' : size === 'lg' ? '1.05rem' : '0.95rem';

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '8px',
        background: disabled ? '#334155' : bg,
        color: disabled ? '#64748b' : color,
        border,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        outline: 'none',
        ...style,
      }}
      {...props}
    >
      {isLoading && <Spinner size={size === 'sm' ? 14 : 18} color={color} />}
      {children}
    </button>
  );
};
