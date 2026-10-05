'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { HoldingFormDialog } from '@/components/dialogs/HoldingFormDialog';
import { usesMockData } from '@/lib/dataSource';

export const Header: React.FC = () => {
  const { view } = useWealth();
  const { openDialog } = useUi();
  // Mounted per opening, so it starts from the current platforms and classes.
  const openAddModal = () => openDialog((close) => <HoldingFormDialog onClose={close} />);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--color-text)' }}>
            {viewTitles[view] || 'Dashboard'}
          </h4>
          {usesMockData && (
            <span
              className="tag tag-accent-2"
              title="A preview: made-up data kept in this tab. Nothing is saved, nothing reaches production."
            >
              Demo data
            </span>
          )}
        </div>
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
