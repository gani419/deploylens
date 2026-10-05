import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid #1e293b',
        marginBottom: '20px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '10px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
              color: isActive ? '#f8fafc' : '#94a3b8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'color 0.15s',
              outline: 'none',
            }}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: isActive ? '#6366f1' : '#334155',
                  color: '#ffffff',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
