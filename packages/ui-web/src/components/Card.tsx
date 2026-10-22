import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'surface' | 'highlight';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  style,
  ...props
}) => {
  let bg = '#0f172a';
  let border = '1px solid #1e293b';

  if (variant === 'surface') {
    bg = '#1e293b';
    border = '1px solid #334155';
  } else if (variant === 'highlight') {
    bg = 'rgba(99, 102, 241, 0.05)';
    border = '1px solid rgba(99, 102, 241, 0.25)';
  }

  return (
    <div
      style={{
        background: bg,
        border,
        borderRadius: '12px',
        padding: '20px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
