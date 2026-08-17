'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';

export const Header: React.FC = () => {
  const { view, currency, setCurrency, openAddModal } = useWealth();

  const viewTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    platforms: 'Platforms',
    assets: 'Assets',
    estimate: 'Estimate',
    history: 'History',
  };

  const viewSubtitles: Record<string, string> = {
    dashboard: "Here's your full financial picture, today.",
    platforms: "Every account you've linked, side by side.",
    assets: 'Every holding you own, in one table.',
    estimate: "See where you're headed — move the sliders and watch it change.",
    history: 'How your net worth has moved, checkpoint by checkpoint.',
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '18px 28px',
        borderBottom: '1px solid var(--color-divider)',
        flex: 'none',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--color-text)' }}>
          {viewTitles[view] || 'Dashboard'}
        </h4>
        <div
          style={{
            fontSize: '12.5px',
            color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
            marginTop: '2px',
          }}
        >
          {viewSubtitles[view]}
        </div>
      </div>

      {/* Currency Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px',
          border: '1px solid var(--color-divider)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface)',
        }}
      >
        <button
          onClick={() => setCurrency('USD')}
          style={{
            padding: '5px 11px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            color: currency === 'USD' ? 'var(--color-accent)' : 'var(--color-text)',
            background: currency === 'USD' ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
            transition: 'all 0.15s ease',
          }}
        >
          USD
        </button>
        <button
          onClick={() => setCurrency('ARS')}
          style={{
            padding: '5px 11px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            color: currency === 'ARS' ? 'var(--color-accent)' : 'var(--color-text)',
            background: currency === 'ARS' ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
            transition: 'all 0.15s ease',
          }}
        >
          ARS
        </button>
      </div>

      {/* Add Asset CTA */}
      <button onClick={openAddModal} className="btn btn-primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5V19M5 12H19" />
        </svg>
        Add an asset
      </button>
    </header>
  );
};
